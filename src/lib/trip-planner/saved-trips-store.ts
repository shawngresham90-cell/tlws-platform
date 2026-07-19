/**
 * Saved Trips & Recent Searches — local-device store (Saved Trips milestone).
 *
 * DECISION GATE OUTCOME: tlws-platform has no end-user account system (Supabase
 * Auth is admin-only; there is no public sign-up and no stable per-driver user
 * ID). Per the milestone spec, this is therefore a LOCAL-DEVICE MVP — all state
 * lives in the browser via versioned localStorage. No server writes, no account
 * requirement, no analytics. A future cloud-sync layer can adopt these same
 * shapes once end-user auth exists (see the cloud-sync planning report).
 *
 * This module is PURE: it takes and returns state and never touches
 * localStorage, React, or the network directly — so every rule (versioning,
 * migration, dedup, caps, stale cleanup, fail-soft parsing) is unit-testable
 * offline. The React hook (`useSavedTrips`) supplies the storage backend.
 */

export const STORE_KEY = 'tlws:trip-planner:v1';
export const STORE_VERSION = 1 as const;

/** Caps per the milestone spec. */
export const LIMITS = {
  recentPlaces: 10,
  plannedTrips: 10,
  favorites: 20,
  truckPresets: 10,
} as const;

/** Records older than this are dropped on load (privacy: no indefinite history). */
export const STALE_MS = 90 * 24 * 3_600_000; // 90 days

/* --------------------------------------------------------------- data types */

export type PlaceRef = {
  label: string;
  lat: number;
  lng: number;
  /** 'directory' | geocode kind — for the badge; optional. */
  kind?: string;
  source?: string;
};

export type RecentPlace = PlaceRef & { usedAt: number };

export type TruckPresetInput = {
  heightFt: number;
  lengthFt: number;
  grossWeightLbs: number;
  axles: number;
  hazmatClass: string | null;
};

export type TruckPreset = TruckPresetInput & { id: string; name: string };

export type FavoriteRoute = {
  id: string;
  name: string;
  origin: PlaceRef;
  destination: PlaceRef;
  truck: TruckPresetInput;
  createdAt: number;
  updatedAt: number;
  /** Last time this favorite was re-planned. */
  lastPlannedAt: number | null;
};

export type PlannedTrip = {
  id: string;
  origin: PlaceRef;
  destination: PlaceRef;
  truck: TruckPresetInput;
  miles: number | null;
  driveMinutes: number | null;
  provider: string | null;
  plannedAt: number;
};

export type PlannerStore = {
  version: typeof STORE_VERSION;
  recentPlaces: RecentPlace[];
  plannedTrips: PlannedTrip[];
  favorites: FavoriteRoute[];
  truckPresets: TruckPreset[];
  updatedAt: number;
};

export function emptyStore(): PlannerStore {
  return {
    version: STORE_VERSION,
    recentPlaces: [],
    plannedTrips: [],
    favorites: [],
    truckPresets: [],
    updatedAt: 0,
  };
}

/* ---------------------------------------------------------- validation utils */

const isFiniteNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const validCoord = (lat: unknown, lng: unknown): boolean =>
  isFiniteNum(lat) && isFiniteNum(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

function coercePlaceRef(v: unknown): PlaceRef | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.label !== 'string' || !o.label) return null;
  if (!validCoord(o.lat, o.lng)) return null;
  const ref: PlaceRef = { label: o.label, lat: o.lat as number, lng: o.lng as number };
  if (typeof o.kind === 'string') ref.kind = o.kind;
  if (typeof o.source === 'string') ref.source = o.source;
  return ref;
}

function coerceTruck(v: unknown): TruckPresetInput {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    heightFt: isFiniteNum(o.heightFt) ? o.heightFt : 13.5,
    lengthFt: isFiniteNum(o.lengthFt) ? o.lengthFt : 70,
    grossWeightLbs: isFiniteNum(o.grossWeightLbs) ? o.grossWeightLbs : 80000,
    axles: isFiniteNum(o.axles) ? o.axles : 5,
    hazmatClass: typeof o.hazmatClass === 'string' ? o.hazmatClass : null,
  };
}

/** Rounded-coordinate identity key for de-duplication. */
export function placeKey(p: { lat: number; lng: number }): string {
  return `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
}
function routeKey(origin: PlaceRef, destination: PlaceRef): string {
  return `${placeKey(origin)}->${placeKey(destination)}`;
}

/**
 * Deterministic id from stable inputs (no Math.random / Date.now dependency in
 * the pure layer — callers pass a monotonic `now`). Good enough for local keys.
 */
export function makeId(prefix: string, seed: string, now: number): string {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
  return `${prefix}_${(h >>> 0).toString(36)}_${now.toString(36)}`;
}

/* -------------------------------------------------------- migrate / load */

type RawV0 = { recents?: unknown[] }; // hypothetical pre-versioned shape

/**
 * Parse + migrate arbitrary stored JSON into a valid PlannerStore. FAIL-SOFT:
 * corrupt or unknown data yields an empty store rather than throwing. Known
 * older versions are upgraded; unknown-but-array fields are sanitized.
 */
export function migrate(raw: unknown, now: number): PlannerStore {
  if (!raw || typeof raw !== 'object') return emptyStore();
  const o = raw as Record<string, unknown>;

  // v0: a pre-versioned blob with a flat `recents` array of place refs.
  if (o.version === undefined && Array.isArray((o as RawV0).recents)) {
    const recentPlaces = ((o as RawV0).recents ?? [])
      .map((r) => coercePlaceRef(r))
      .filter((p): p is PlaceRef => p !== null)
      .map((p) => ({ ...p, usedAt: now }));
    return cleanup({ ...emptyStore(), recentPlaces, updatedAt: now }, now);
  }

  if (o.version !== STORE_VERSION) return emptyStore();

  const recentPlaces = (Array.isArray(o.recentPlaces) ? o.recentPlaces : [])
    .map((r) => {
      const ref = coercePlaceRef(r);
      if (!ref) return null;
      const usedAt = isFiniteNum((r as Record<string, unknown>).usedAt)
        ? ((r as Record<string, unknown>).usedAt as number)
        : now;
      return { ...ref, usedAt };
    })
    .filter((p): p is RecentPlace => p !== null);

  const favorites = (Array.isArray(o.favorites) ? o.favorites : [])
    .map((f) => coerceFavorite(f, now))
    .filter((f): f is FavoriteRoute => f !== null);

  const plannedTrips = (Array.isArray(o.plannedTrips) ? o.plannedTrips : [])
    .map((t) => coercePlanned(t, now))
    .filter((t): t is PlannedTrip => t !== null);

  const truckPresets = (Array.isArray(o.truckPresets) ? o.truckPresets : [])
    .map((p) => coercePreset(p))
    .filter((p): p is TruckPreset => p !== null);

  return cleanup(
    {
      version: STORE_VERSION,
      recentPlaces,
      plannedTrips,
      favorites,
      truckPresets,
      updatedAt: isFiniteNum(o.updatedAt) ? (o.updatedAt as number) : now,
    },
    now,
  );
}

function coerceFavorite(v: unknown, now: number): FavoriteRoute | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const origin = coercePlaceRef(o.origin);
  const destination = coercePlaceRef(o.destination);
  if (!origin || !destination) return null;
  return {
    id: typeof o.id === 'string' ? o.id : makeId('fav', routeKey(origin, destination), now),
    name: typeof o.name === 'string' && o.name ? o.name : `${origin.label} → ${destination.label}`,
    origin,
    destination,
    truck: coerceTruck(o.truck),
    createdAt: isFiniteNum(o.createdAt) ? (o.createdAt as number) : now,
    updatedAt: isFiniteNum(o.updatedAt) ? (o.updatedAt as number) : now,
    lastPlannedAt: isFiniteNum(o.lastPlannedAt) ? (o.lastPlannedAt as number) : null,
  };
}

function coercePlanned(v: unknown, now: number): PlannedTrip | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const origin = coercePlaceRef(o.origin);
  const destination = coercePlaceRef(o.destination);
  if (!origin || !destination) return null;
  return {
    id: typeof o.id === 'string' ? o.id : makeId('trip', routeKey(origin, destination), now),
    origin,
    destination,
    truck: coerceTruck(o.truck),
    miles: isFiniteNum(o.miles) ? (o.miles as number) : null,
    driveMinutes: isFiniteNum(o.driveMinutes) ? (o.driveMinutes as number) : null,
    provider: typeof o.provider === 'string' ? o.provider : null,
    plannedAt: isFiniteNum(o.plannedAt) ? (o.plannedAt as number) : now,
  };
}

function coercePreset(v: unknown): TruckPreset | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.name !== 'string' || !o.name) return null;
  return { id: o.id, name: o.name, ...coerceTruck(o) };
}

/** Drop stale time-based records and re-apply caps. Pure. */
export function cleanup(store: PlannerStore, now: number): PlannerStore {
  const fresh = (t: number) => now - t <= STALE_MS;
  return {
    ...store,
    recentPlaces: store.recentPlaces.filter((r) => fresh(r.usedAt)).slice(0, LIMITS.recentPlaces),
    plannedTrips: store.plannedTrips
      .filter((t) => fresh(t.plannedAt))
      .slice(0, LIMITS.plannedTrips),
    favorites: store.favorites.slice(0, LIMITS.favorites),
    truckPresets: store.truckPresets.slice(0, LIMITS.truckPresets),
  };
}

/* ------------------------------------------------------------- operations */
/* Each returns a NEW store (immutable); callers persist the result.        */

/** Record a place the user selected — most-recent-first, deduped by coord. */
export function addRecentPlace(store: PlannerStore, place: PlaceRef, now: number): PlannerStore {
  const ref = coercePlaceRef(place);
  if (!ref) return store;
  const key = placeKey(ref);
  const deduped = store.recentPlaces.filter((r) => placeKey(r) !== key);
  const recentPlaces = [{ ...ref, usedAt: now }, ...deduped].slice(0, LIMITS.recentPlaces);
  return { ...store, recentPlaces, updatedAt: now };
}

/** Record a completed plan (device-local history; not auto-synced anywhere). */
export function addPlannedTrip(
  store: PlannerStore,
  trip: Omit<PlannedTrip, 'id' | 'plannedAt'>,
  now: number,
): PlannerStore {
  const origin = coercePlaceRef(trip.origin);
  const destination = coercePlaceRef(trip.destination);
  if (!origin || !destination) return store;
  const key = routeKey(origin, destination);
  const deduped = store.plannedTrips.filter((t) => routeKey(t.origin, t.destination) !== key);
  const record: PlannedTrip = {
    id: makeId('trip', key, now),
    origin,
    destination,
    truck: coerceTruck(trip.truck),
    miles: isFiniteNum(trip.miles) ? trip.miles : null,
    driveMinutes: isFiniteNum(trip.driveMinutes) ? trip.driveMinutes : null,
    provider: typeof trip.provider === 'string' ? trip.provider : null,
    plannedAt: now,
  };
  const plannedTrips = [record, ...deduped].slice(0, LIMITS.plannedTrips);
  return { ...store, plannedTrips, updatedAt: now };
}

/** Save (or update) a favorite route. Deduped by origin/destination. */
export function saveFavorite(
  store: PlannerStore,
  input: { name?: string; origin: PlaceRef; destination: PlaceRef; truck: TruckPresetInput },
  now: number,
): PlannerStore {
  const origin = coercePlaceRef(input.origin);
  const destination = coercePlaceRef(input.destination);
  if (!origin || !destination) return store;
  const key = routeKey(origin, destination);
  const existing = store.favorites.find((f) => routeKey(f.origin, f.destination) === key);
  const name =
    (input.name && input.name.trim()) || existing?.name || `${origin.label} → ${destination.label}`;
  const truck = coerceTruck(input.truck);

  let favorites: FavoriteRoute[];
  if (existing) {
    favorites = store.favorites.map((f) =>
      f.id === existing.id ? { ...f, name, origin, destination, truck, updatedAt: now } : f,
    );
  } else {
    const fav: FavoriteRoute = {
      id: makeId('fav', key, now),
      name,
      origin,
      destination,
      truck,
      createdAt: now,
      updatedAt: now,
      lastPlannedAt: null,
    };
    favorites = [fav, ...store.favorites].slice(0, LIMITS.favorites);
  }
  return { ...store, favorites, updatedAt: now };
}

export function renameFavorite(
  store: PlannerStore,
  id: string,
  name: string,
  now: number,
): PlannerStore {
  const trimmed = name.trim();
  if (!trimmed) return store;
  return {
    ...store,
    favorites: store.favorites.map((f) =>
      f.id === id ? { ...f, name: trimmed, updatedAt: now } : f,
    ),
    updatedAt: now,
  };
}

export function markFavoritePlanned(store: PlannerStore, id: string, now: number): PlannerStore {
  return {
    ...store,
    favorites: store.favorites.map((f) => (f.id === id ? { ...f, lastPlannedAt: now } : f)),
    updatedAt: now,
  };
}

export function deleteFavorite(store: PlannerStore, id: string, now: number): PlannerStore {
  return {
    ...store,
    favorites: store.favorites.filter((f) => f.id !== id),
    updatedAt: now,
  };
}

/** Save a named truck preset. Deduped by name (case-insensitive). */
export function saveTruckPreset(
  store: PlannerStore,
  name: string,
  truck: TruckPresetInput,
  now: number,
): PlannerStore {
  const trimmed = name.trim();
  if (!trimmed) return store;
  const lower = trimmed.toLowerCase();
  const t = coerceTruck(truck);
  const existing = store.truckPresets.find((p) => p.name.toLowerCase() === lower);
  let truckPresets: TruckPreset[];
  if (existing) {
    truckPresets = store.truckPresets.map((p) =>
      p.id === existing.id ? { ...p, ...t, name: trimmed } : p,
    );
  } else {
    truckPresets = [
      { id: makeId('preset', lower, now), name: trimmed, ...t },
      ...store.truckPresets,
    ].slice(0, LIMITS.truckPresets);
  }
  return { ...store, truckPresets, updatedAt: now };
}

export function deleteTruckPreset(store: PlannerStore, id: string, now: number): PlannerStore {
  return {
    ...store,
    truckPresets: store.truckPresets.filter((p) => p.id !== id),
    updatedAt: now,
  };
}

/** Replace favorites + presets wholesale (used after a cloud merge). */
export function replaceFavoritesAndPresets(
  store: PlannerStore,
  favorites: FavoriteRoute[],
  presets: TruckPreset[],
  now: number,
): PlannerStore {
  return {
    ...store,
    favorites: favorites.slice(0, LIMITS.favorites),
    truckPresets: presets.slice(0, LIMITS.truckPresets),
    updatedAt: now,
  };
}

export function clearRecents(store: PlannerStore, now: number): PlannerStore {
  return { ...store, recentPlaces: [], plannedTrips: [], updatedAt: now };
}

export function clearAll(now: number): PlannerStore {
  return { ...emptyStore(), updatedAt: now };
}

/** Serialize for storage (stable key). */
export function serialize(store: PlannerStore): string {
  return JSON.stringify(store);
}

/** Parse a raw string fail-soft → valid store. */
export function deserialize(raw: string | null, now: number): PlannerStore {
  if (!raw) return emptyStore();
  try {
    return migrate(JSON.parse(raw), now);
  } catch {
    return emptyStore();
  }
}
