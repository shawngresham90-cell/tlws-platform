/**
 * Saved Trips & Recent Searches — local-device store tests. Covers versioning,
 * migration (v0 → v1 and corrupt → empty), fail-soft parsing, dedup, caps,
 * stale cleanup, and every operation (recent, planned, favorite save/rename/
 * re-plan-mark/delete, truck presets, clear). Pure — no DOM, no network.
 *
 * Run:
 *   npx esbuild scripts/test-saved-trips.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-saved-trips.cjs \
 *   && node /tmp/test-saved-trips.cjs
 */
import {
  LIMITS,
  STALE_MS,
  STORE_VERSION,
  addPlannedTrip,
  addRecentPlace,
  cleanup,
  clearAll,
  clearRecents,
  deleteFavorite,
  deleteTruckPreset,
  deserialize,
  emptyStore,
  markFavoritePlanned,
  migrate,
  placeKey,
  renameFavorite,
  saveFavorite,
  saveTruckPreset,
  serialize,
  type PlaceRef,
  type PlannerStore,
} from '@/lib/trip-planner/saved-trips-store';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const T0 = 1_750_000_000_000;
const place = (label: string, lat: number, lng: number): PlaceRef => ({ label, lat, lng });
const NASH = place('Nashville, TN', 36.1627, -86.7816);
const KNX = place('Knoxville, TN', 35.9606, -83.9207);
const ATL = place('Atlanta, GA', 33.749, -84.388);
const TRUCK = { heightFt: 13.5, lengthFt: 70, grossWeightLbs: 80000, axles: 5, hazmatClass: null };

function main() {
  /* ------------------------------------------------ empty + serialize */
  {
    const s = emptyStore();
    check('empty: correct version', s.version === STORE_VERSION);
    check('empty: all lists empty', s.recentPlaces.length === 0 && s.favorites.length === 0);
    check(
      'round-trip: serialize→deserialize',
      deserialize(serialize(s), T0).version === STORE_VERSION,
    );
  }

  /* ------------------------------------------------ fail-soft parsing */
  {
    check('parse: null → empty', deserialize(null, T0).favorites.length === 0);
    check('parse: garbage string → empty', deserialize('}{not json', T0).favorites.length === 0);
    check('parse: non-object json → empty', deserialize('42', T0).favorites.length === 0);
    check('migrate: unknown version → empty', migrate({ version: 999 }, T0).favorites.length === 0);
    check('migrate: null → empty', migrate(null, T0).recentPlaces.length === 0);
  }

  /* ------------------------------------------------ v0 → v1 migration */
  {
    const v0 = { recents: [{ label: 'Old City', lat: 30, lng: -90 }, { label: 'bad' }] };
    const migrated = migrate(v0, T0);
    check(
      'migrate: v0 recents upgraded',
      migrated.version === STORE_VERSION && migrated.recentPlaces.length === 1,
    );
    check('migrate: v0 invalid entries dropped', migrated.recentPlaces[0].label === 'Old City');
  }

  /* ------------------------------------------------ coord validation */
  {
    const bad = migrate(
      { version: 1, favorites: [{ origin: { label: 'x', lat: 999, lng: 0 }, destination: KNX }] },
      T0,
    );
    check('migrate: favorite with bad coord dropped', bad.favorites.length === 0);
    const s = addRecentPlace(emptyStore(), { label: 'NaN', lat: NaN, lng: 0 } as PlaceRef, T0);
    check('recent: invalid coord rejected', s.recentPlaces.length === 0);
  }

  /* ------------------------------------------------ recent places */
  {
    let s = emptyStore();
    s = addRecentPlace(s, NASH, T0);
    s = addRecentPlace(s, KNX, T0 + 1);
    check('recent: most-recent-first', s.recentPlaces[0].label === 'Knoxville, TN');
    // Re-selecting NASH moves it to front, no duplicate.
    s = addRecentPlace(s, NASH, T0 + 2);
    check(
      'recent: dedup by coord, moved to front',
      s.recentPlaces.length === 2 && s.recentPlaces[0].label === 'Nashville, TN',
    );
    // Cap at 10.
    for (let i = 0; i < 15; i++)
      s = addRecentPlace(s, place(`P${i}`, 40 + i * 0.5, -80), T0 + 10 + i);
    check('recent: capped at 10', s.recentPlaces.length === LIMITS.recentPlaces);
  }

  /* ------------------------------------------------ planned trips */
  {
    let s = emptyStore();
    s = addPlannedTrip(
      s,
      {
        origin: NASH,
        destination: KNX,
        truck: TRUCK,
        miles: 180,
        driveMinutes: 200,
        provider: 'HERE',
      },
      T0,
    );
    check('planned: recorded', s.plannedTrips.length === 1 && s.plannedTrips[0].miles === 180);
    // Same route replans → dedup, updated to front.
    s = addPlannedTrip(
      s,
      {
        origin: NASH,
        destination: KNX,
        truck: TRUCK,
        miles: 181,
        driveMinutes: 201,
        provider: 'HERE',
      },
      T0 + 5,
    );
    check(
      'planned: dedup same route',
      s.plannedTrips.length === 1 && s.plannedTrips[0].miles === 181,
    );
    s = addPlannedTrip(
      s,
      {
        origin: KNX,
        destination: ATL,
        truck: TRUCK,
        miles: 200,
        driveMinutes: 220,
        provider: 'HERE',
      },
      T0 + 6,
    );
    check(
      'planned: distinct route added',
      s.plannedTrips.length === 2 && s.plannedTrips[0].origin.label === 'Knoxville, TN',
    );
  }

  /* ------------------------------------------------ favorites: save/rename/replan/delete */
  {
    let s = emptyStore();
    s = saveFavorite(s, { origin: NASH, destination: KNX, truck: TRUCK }, T0);
    check(
      'fav: saved with default name',
      s.favorites.length === 1 && s.favorites[0].name.includes('→'),
    );
    const id = s.favorites[0].id;
    // Saving same route again updates, not duplicates.
    s = saveFavorite(
      s,
      { origin: NASH, destination: KNX, truck: { ...TRUCK, hazmatClass: '3' } },
      T0 + 1,
    );
    check(
      'fav: dedup by route, updates',
      s.favorites.length === 1 && s.favorites[0].truck.hazmatClass === '3',
    );
    // Rename.
    s = renameFavorite(s, id, '  Weekly Haul  ', T0 + 2);
    check('fav: renamed + trimmed', s.favorites[0].name === 'Weekly Haul');
    check(
      'fav: blank rename ignored',
      renameFavorite(s, id, '   ', T0 + 3).favorites[0].name === 'Weekly Haul',
    );
    // Mark re-planned.
    s = markFavoritePlanned(s, id, T0 + 4);
    check('fav: lastPlannedAt set', s.favorites[0].lastPlannedAt === T0 + 4);
    // Delete.
    s = deleteFavorite(s, id, T0 + 5);
    check('fav: deleted', s.favorites.length === 0);
    // Cap at 20.
    for (let i = 0; i < 25; i++)
      s = saveFavorite(
        s,
        {
          origin: place(`O${i}`, 30 + i, -90),
          destination: place(`D${i}`, 31 + i, -91),
          truck: TRUCK,
        },
        T0 + 100 + i,
      );
    check('fav: capped at 20', s.favorites.length === LIMITS.favorites);
  }

  /* ------------------------------------------------ truck presets */
  {
    let s = emptyStore();
    s = saveTruckPreset(s, 'Reefer', { ...TRUCK, heightFt: 13.6 }, T0);
    check('preset: saved', s.truckPresets.length === 1 && s.truckPresets[0].name === 'Reefer');
    const id = s.truckPresets[0].id;
    // Same name (case-insensitive) updates, no dup.
    s = saveTruckPreset(s, 'reefer', { ...TRUCK, heightFt: 13.0 }, T0 + 1);
    check(
      'preset: dedup by name (case-insensitive)',
      s.truckPresets.length === 1 && s.truckPresets[0].heightFt === 13.0,
    );
    check(
      'preset: blank name ignored',
      saveTruckPreset(s, '  ', TRUCK, T0 + 2).truckPresets.length === 1,
    );
    s = deleteTruckPreset(s, id, T0 + 3);
    check('preset: deleted', s.truckPresets.length === 0);
  }

  /* ------------------------------------------------ stale cleanup */
  {
    const old = T0 - STALE_MS - 1;
    let s: PlannerStore = {
      ...emptyStore(),
      recentPlaces: [
        { ...NASH, usedAt: old },
        { ...KNX, usedAt: T0 },
      ],
      plannedTrips: [
        {
          id: 'a',
          origin: NASH,
          destination: KNX,
          truck: TRUCK,
          miles: 1,
          driveMinutes: 1,
          provider: null,
          plannedAt: old,
        },
      ],
      favorites: [
        {
          id: 'f',
          name: 'keep',
          origin: NASH,
          destination: KNX,
          truck: TRUCK,
          createdAt: old,
          updatedAt: old,
          lastPlannedAt: null,
        },
      ],
    };
    s = cleanup(s, T0);
    check(
      'cleanup: stale recent dropped',
      s.recentPlaces.length === 1 && s.recentPlaces[0].label === 'Knoxville, TN',
    );
    check('cleanup: stale planned dropped', s.plannedTrips.length === 0);
    check('cleanup: favorites are NOT time-expired (explicit user data)', s.favorites.length === 1);
  }

  /* ---------- sequential composition (hook fires 3 ops in one tick) ---------- */
  {
    // The hook records origin recent, destination recent, and the planned trip
    // back-to-back on a successful plan. Threading the ops from each result
    // (as the fixed hook does) must preserve ALL three — no clobbering.
    let s = emptyStore();
    s = addRecentPlace(s, NASH, T0);
    s = addRecentPlace(s, KNX, T0 + 1);
    s = addPlannedTrip(
      s,
      {
        origin: NASH,
        destination: KNX,
        truck: TRUCK,
        miles: 180,
        driveMinutes: 200,
        provider: 'HERE',
      },
      T0 + 2,
    );
    check(
      'compose: both recents survive alongside the planned trip',
      s.recentPlaces.length === 2 &&
        s.recentPlaces.some((r) => r.label === 'Nashville, TN') &&
        s.recentPlaces.some((r) => r.label === 'Knoxville, TN') &&
        s.plannedTrips.length === 1,
    );
  }

  /* ------------------------------------------------ clear controls */
  {
    let s = emptyStore();
    s = addRecentPlace(s, NASH, T0);
    s = addPlannedTrip(
      s,
      { origin: NASH, destination: KNX, truck: TRUCK, miles: 1, driveMinutes: 1, provider: null },
      T0,
    );
    s = saveFavorite(s, { origin: NASH, destination: KNX, truck: TRUCK }, T0);
    const cleared = clearRecents(s, T0 + 1);
    check(
      'clear: recents+planned cleared, favorites kept',
      cleared.recentPlaces.length === 0 &&
        cleared.plannedTrips.length === 0 &&
        cleared.favorites.length === 1,
    );
    check(
      'clearAll: everything empty',
      clearAll(T0).favorites.length === 0 && clearAll(T0).recentPlaces.length === 0,
    );
  }

  /* ------------------------------------------------ dedup key */
  {
    check(
      'placeKey: rounds to 3dp',
      placeKey({ lat: 36.16271, lng: -86.78169 }) === placeKey({ lat: 36.16269, lng: -86.78171 }),
    );
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
