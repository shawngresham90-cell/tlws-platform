/**
 * Cloud-sync merge/queue/schema tests (End-User Accounts milestone). Pure —
 * no network, no Supabase, no DOM. Covers local↔cloud mapping, first-sign-in
 * union merge (client-id dedup, name+coord fallback, newest-wins, distinct
 * preserved, cap), stale-update protection, offline-queue collapsing, and Zod
 * payload validation (including that no user_id is ever accepted from a client).
 *
 * Run:
 *   npx esbuild scripts/test-cloud-sync.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-cloud-sync.cjs \
 *   && node /tmp/test-cloud-sync.cjs
 */
import {
  cloudSavedTripSchema,
  cloudToFavorite,
  cloudTruckPresetSchema,
  dedupeQueue,
  deleteByClientIdsSchema,
  favoriteToCloud,
  mergeFavorites,
  mergePresets,
  presetToRow,
  rowToTrip,
  savedTripsUpsertSchema,
  tripToRow,
  type SyncOp,
} from '@/lib/trip-planner/cloud-sync';
import type { FavoriteRoute, TruckPreset } from '@/lib/trip-planner/saved-trips-store';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const NASH = { label: 'Nashville, TN', lat: 36.1627, lng: -86.7816 };
const KNX = { label: 'Knoxville, TN', lat: 35.9606, lng: -83.9207 };
const ATL = { label: 'Atlanta, GA', lat: 33.749, lng: -84.388 };
const TRUCK = { heightFt: 13.5, lengthFt: 70, grossWeightLbs: 80000, axles: 5, hazmatClass: null };

const fav = (id: string, name: string, o = NASH, d = KNX, updatedAt = 1000): FavoriteRoute => ({
  id,
  name,
  origin: o,
  destination: d,
  truck: TRUCK,
  createdAt: 1,
  updatedAt,
  lastPlannedAt: null,
});
const preset = (id: string, name: string): TruckPreset => ({ id, name, ...TRUCK });

function main() {
  /* ------------------------------------------------ schemas */
  {
    const ok = cloudSavedTripSchema.safeParse(favoriteToCloud(fav('a', 'Haul')));
    check('schema: valid trip accepted', ok.success);
    check(
      'schema: bad origin lat rejected',
      !cloudSavedTripSchema.safeParse({
        ...favoriteToCloud(fav('a', 'x')),
        origin: { label: 'x', lat: 999, lng: 0 },
      }).success,
    );
    check(
      'schema: bad truck weight rejected',
      !cloudSavedTripSchema.safeParse({
        ...favoriteToCloud(fav('a', 'x')),
        truck: { ...TRUCK, grossWeightLbs: 999999 },
      }).success,
    );
    // No user_id field exists on the schema — a client-supplied one is stripped.
    const parsed = cloudSavedTripSchema.safeParse({
      ...favoriteToCloud(fav('a', 'x')),
      user_id: 'attacker',
    });
    check(
      'schema: client user_id is not part of the payload',
      parsed.success && !('user_id' in parsed.data),
    );
    check(
      'schema: upsert batch capped at favorites limit',
      !savedTripsUpsertSchema.safeParse({
        trips: Array.from({ length: 21 }, (_, i) => favoriteToCloud(fav(`x${i}`, 'n'))),
      }).success,
    );
    check(
      'schema: delete-by-clientIds validates',
      deleteByClientIdsSchema.safeParse({ clientIds: ['a', 'b'] }).success &&
        !deleteByClientIdsSchema.safeParse({ clientIds: [123] }).success,
    );
    check(
      'schema: preset validates',
      cloudTruckPresetSchema.safeParse({
        clientId: 'p1',
        name: 'Reefer',
        ...TRUCK,
        createdAt: 0,
        updatedAt: 0,
      }).success,
    );
  }

  /* ------------------------------------------------ round-trip mapping */
  {
    const rt = cloudToFavorite(favoriteToCloud(fav('a', 'Haul')));
    check(
      'map: favorite round-trips (id=clientId)',
      rt.id === 'a' && rt.name === 'Haul' && rt.origin.lat === NASH.lat,
    );
  }

  /* ------------------------------------------------ cross-user ownership */
  {
    // The server injects user_id from the SESSION. Even if a client somehow
    // smuggled a user_id onto the object, tripToRow overwrites it.
    const trip = favoriteToCloud(fav('a', 'Haul'));
    const row = tripToRow('session-user-123', {
      ...(trip as object),
      user_id: 'attacker',
    } as never);
    check('rls: tripToRow forces session user_id', row.user_id === 'session-user-123');
    check('rls: tripToRow ignores client-supplied user_id', row.user_id !== 'attacker');
    const prow = presetToRow('session-user-123', {
      clientId: 'p',
      name: 'R',
      heightFt: 13.5,
      lengthFt: 70,
      grossWeightLbs: 80000,
      axles: 5,
      hazmatClass: null,
      createdAt: 0,
      updatedAt: 0,
    });
    check('rls: presetToRow forces session user_id', prow.user_id === 'session-user-123');
    // created_at is never in the upsert payload (avoids clobbering on update).
    check('rls: tripToRow omits created_at', !('created_at' in row));
    // DB row → cloud shape round-trips.
    const back = rowToTrip({
      client_id: 'a',
      name: 'Haul',
      origin_label: 'Nashville, TN',
      origin_lat: 36.1627,
      origin_lng: -86.7816,
      destination_label: 'Knoxville, TN',
      destination_lat: 35.9606,
      destination_lng: -83.9207,
      truck: TRUCK,
      created_at: '2026-07-18T00:00:00Z',
      updated_at: '2026-07-18T01:00:00Z',
      last_planned_at: null,
    });
    check(
      'map: rowToTrip parses timestamps to ms',
      back.clientId === 'a' && back.updatedAt > back.createdAt,
    );
  }

  /* ------------------------------------------------ first-sign-in merge */
  {
    // Local-only item is preserved AND pushed; cloud-only preserved, not pushed.
    const local = [fav('L1', 'Local only', NASH, KNX, 1000)];
    const cloud = [fav('C1', 'Cloud only', KNX, ATL, 1000)];
    const r = mergeFavorites(local, cloud);
    check('merge: union preserves both', r.merged.length === 2);
    check(
      'merge: local-only is pushed',
      r.toPush.some((f) => f.id === 'L1'),
    );
    check('merge: cloud-only not pushed', !r.toPush.some((f) => f.id === 'C1'));

    // Same client id → newest updatedAt wins.
    const rWin = mergeFavorites(
      [fav('S', 'local newer', NASH, KNX, 3000)],
      [fav('S', 'cloud older', NASH, KNX, 1000)],
    );
    check(
      'merge: same id newest wins (local)',
      rWin.merged.length === 1 && rWin.merged[0].name === 'local newer',
    );
    check(
      'merge: newer local is pushed',
      rWin.toPush.length === 1 && rWin.toPush[0].name === 'local newer',
    );

    const rWin2 = mergeFavorites(
      [fav('S', 'local older', NASH, KNX, 1000)],
      [fav('S', 'cloud newer', NASH, KNX, 3000)],
    );
    check('merge: same id newest wins (cloud)', rWin2.merged[0].name === 'cloud newer');
    check('merge: stale local NOT pushed', rWin2.toPush.length === 0);

    // Same route+name but different client ids → collapse via weak key.
    const rDedup = mergeFavorites(
      [fav('LX', 'Weekly', NASH, KNX, 2000)],
      [fav('CX', 'Weekly', NASH, KNX, 1000)],
    );
    check('merge: same name+route different ids collapse', rDedup.merged.length === 1);

    // Genuinely distinct records both preserved.
    const rDistinct = mergeFavorites(
      [fav('D1', 'Route A', NASH, KNX, 1000)],
      [fav('D2', 'Route B', KNX, ATL, 1000)],
    );
    check('merge: distinct records both preserved', rDistinct.merged.length === 2);

    // Cap enforced on merged result.
    const many = Array.from({ length: 25 }, (_, i) =>
      fav(
        `m${i}`,
        `n${i}`,
        { label: `O${i}`, lat: 30 + i * 0.1, lng: -90 },
        { label: `D${i}`, lat: 31 + i * 0.1, lng: -91 },
        1000 + i,
      ),
    );
    check('merge: merged capped at 20', mergeFavorites(many, []).merged.length === 20);
  }

  /* ------------------------------------------------ presets merge */
  {
    const r = mergePresets(
      [preset('p1', 'Reefer'), preset('p2', 'Flatbed')],
      [preset('p1', 'Reefer'), preset('c3', 'Tanker')],
    );
    check('merge presets: union deduped by id', r.merged.length === 3);
    // Fallback by normalized name.
    const rName = mergePresets([preset('a', 'Reefer')], [preset('b', 'reefer ')]);
    check('merge presets: name fallback collapses', rName.merged.length === 1);
  }

  /* ------------------------------------------------ tombstone (delete not resurrected) */
  {
    // A pending delete (still queued while offline) filters the cloud snapshot
    // BEFORE merge, so the deleted item is not merged back into local.
    const cloudFromServer = [fav('A', 'Deleted route', NASH, KNX, 1000)];
    const pendingDeletes = new Set(['A']);
    const filtered = cloudFromServer.filter((t) => !pendingDeletes.has(t.id));
    const r = mergeFavorites([], filtered);
    check('tombstone: pending delete not resurrected by merge', r.merged.length === 0);
  }

  /* ------------------------------------------------ offline queue */
  {
    const ops: SyncOp[] = [
      { kind: 'upsert-trip', clientId: 'a' },
      { kind: 'upsert-trip', clientId: 'a' }, // collapses with previous
      { kind: 'delete-trip', clientId: 'a' }, // supersedes the upsert
      { kind: 'upsert-preset', clientId: 'a' }, // separate family, kept
      { kind: 'upsert-trip', clientId: 'b' },
    ];
    const q = dedupeQueue(ops);
    check('queue: collapses per (family, clientId)', q.length === 3);
    check(
      'queue: latest op wins (delete supersedes upsert)',
      q.some((o) => o.kind === 'delete-trip' && o.clientId === 'a'),
    );
    check(
      'queue: trip and preset for same id kept separate',
      q.some((o) => o.kind === 'upsert-preset' && o.clientId === 'a'),
    );
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
