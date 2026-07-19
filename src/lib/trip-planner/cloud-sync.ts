import { z } from 'zod';
import {
  LIMITS,
  placeKey,
  type FavoriteRoute,
  type PlaceRef,
  type TruckPreset,
} from './saved-trips-store';

/**
 * Cloud-sync merge logic + payload schemas (End-User Accounts milestone).
 *
 * PURE and offline-testable: no network, no Supabase, no React. The client's
 * stable `id` (from the local store) is the cross-device `client_id`; the
 * server's own uuid is internal and never needed here, so every operation is
 * keyed on (session user, client_id). Ownership is ALWAYS derived server-side
 * from the session — these schemas never accept a user_id from the client.
 *
 * Merge principles (spec):
 * - de-dup by stable client id; fall back to normalized name + coordinates;
 * - newest updatedAt wins ONLY when identity is clearly the same item;
 * - genuinely distinct records are both preserved;
 * - first sign-in never deletes local data (union merge).
 */

/* --------------------------------------------------------------- schemas */

const finite = z.number().finite();
const latSchema = finite.min(-90).max(90);
const lngSchema = finite.min(-180).max(180);

export const cloudPlaceSchema = z.object({
  label: z.string().min(1).max(200),
  lat: latSchema,
  lng: lngSchema,
  kind: z.string().max(40).optional(),
  source: z.string().max(40).optional(),
});

export const cloudTruckSchema = z.object({
  heightFt: finite.min(8).max(15),
  lengthFt: finite.min(20).max(120),
  grossWeightLbs: finite.min(10_000).max(164_000),
  axles: z.number().int().min(2).max(9),
  hazmatClass: z
    .string()
    .regex(/^[1-9](\.\d)?$/)
    .nullable(),
});

/** A saved trip as synced (client_id = the local store id). */
export const cloudSavedTripSchema = z.object({
  clientId: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  origin: cloudPlaceSchema,
  destination: cloudPlaceSchema,
  truck: cloudTruckSchema,
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  lastPlannedAt: z.number().int().nonnegative().nullable().default(null),
});
export type CloudSavedTrip = z.infer<typeof cloudSavedTripSchema>;

export const cloudTruckPresetSchema = z.object({
  clientId: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  heightFt: cloudTruckSchema.shape.heightFt,
  lengthFt: cloudTruckSchema.shape.lengthFt,
  grossWeightLbs: cloudTruckSchema.shape.grossWeightLbs,
  axles: cloudTruckSchema.shape.axles,
  hazmatClass: cloudTruckSchema.shape.hazmatClass,
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type CloudTruckPreset = z.infer<typeof cloudTruckPresetSchema>;

/** POST body: bounded batches so a single request can't be abused. */
export const savedTripsUpsertSchema = z.object({
  trips: z.array(cloudSavedTripSchema).max(LIMITS.favorites),
});
export const truckPresetsUpsertSchema = z.object({
  presets: z.array(cloudTruckPresetSchema).max(LIMITS.truckPresets),
});
export const deleteByClientIdsSchema = z.object({
  clientIds: z.array(z.string().min(1).max(120)).max(100),
});

/* --------------------------------------------------------- local <-> cloud */

export function favoriteToCloud(f: FavoriteRoute): CloudSavedTrip {
  return {
    clientId: f.id,
    name: f.name,
    origin: trimPlace(f.origin),
    destination: trimPlace(f.destination),
    truck: f.truck,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    lastPlannedAt: f.lastPlannedAt,
  };
}
export function cloudToFavorite(c: CloudSavedTrip): FavoriteRoute {
  return {
    id: c.clientId,
    name: c.name,
    origin: c.origin,
    destination: c.destination,
    truck: c.truck,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    lastPlannedAt: c.lastPlannedAt,
  };
}
export function presetToCloud(p: TruckPreset): CloudTruckPreset {
  return {
    clientId: p.id,
    name: p.name,
    heightFt: p.heightFt,
    lengthFt: p.lengthFt,
    grossWeightLbs: p.grossWeightLbs,
    axles: p.axles,
    hazmatClass: p.hazmatClass,
    createdAt: 0,
    updatedAt: 0,
  };
}

export function cloudToPresetLocal(c: CloudTruckPreset): TruckPreset {
  return {
    id: c.clientId,
    name: c.name,
    heightFt: c.heightFt,
    lengthFt: c.lengthFt,
    grossWeightLbs: c.grossWeightLbs,
    axles: c.axles,
    hazmatClass: c.hazmatClass,
  };
}

function trimPlace(p: PlaceRef): PlaceRef {
  const out: PlaceRef = { label: p.label, lat: p.lat, lng: p.lng };
  if (p.kind) out.kind = p.kind;
  if (p.source) out.source = p.source;
  return out;
}

/* ------------------------------------------------------------------ merge */

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export type MergeResult<T> = {
  /** The union, each identity resolved to its newest version. */
  merged: T[];
  /** Items whose local version must be written to the cloud. */
  toPush: T[];
};

/**
 * Generic identity-aware union merge. `strongKey` is the stable client id;
 * `weakKey` is the normalized fallback used only to collapse the "same thing
 * saved on two devices" case. Newest `updatedAt` wins for a matched identity;
 * unmatched items on either side are preserved.
 */
function mergeCollections<T>(
  local: T[],
  cloud: T[],
  strongKey: (t: T) => string,
  weakKey: (t: T) => string,
  updatedAt: (t: T) => number,
): MergeResult<T> {
  const byStrong = new Map<string, { item: T; from: 'local' | 'cloud' | 'both' }>();
  const weakToStrong = new Map<string, string>();

  const consider = (item: T, side: 'local' | 'cloud') => {
    const sk = strongKey(item);
    const wk = weakKey(item);
    // Resolve to an existing identity by strong key, else by weak key.
    let key = byStrong.has(sk) ? sk : weakToStrong.get(wk);
    if (key === undefined) {
      byStrong.set(sk, { item, from: side });
      weakToStrong.set(wk, sk);
      return;
    }
    const cur = byStrong.get(key)!;
    // Same identity → newest updatedAt wins; ties keep the incumbent.
    const winner = updatedAt(item) > updatedAt(cur.item) ? item : cur.item;
    byStrong.set(key, { item: winner, from: cur.from === side ? side : 'both' });
  };

  for (const c of cloud) consider(c, 'cloud');
  for (const l of local) consider(l, 'local');

  const merged: T[] = [];
  const toPush: T[] = [];
  for (const { item, from } of byStrong.values()) {
    merged.push(item);
    // Push when the winning copy is not already the cloud's copy: local-only
    // items, and identities where the local edit is the newer winner.
    const cloudMatch = cloud.find(
      (c) => strongKey(c) === strongKey(item) || weakKey(c) === weakKey(item),
    );
    if (!cloudMatch || updatedAt(item) > updatedAt(cloudMatch)) toPush.push(item);
    void from;
  }
  return { merged, toPush };
}

export function mergeFavorites(
  local: FavoriteRoute[],
  cloud: FavoriteRoute[],
): MergeResult<FavoriteRoute> {
  const res = mergeCollections(
    local,
    cloud,
    (f) => f.id,
    (f) => `${norm(f.name)}|${placeKey(f.origin)}->${placeKey(f.destination)}`,
    (f) => f.updatedAt,
  );
  // Respect the store cap on the merged result (newest first).
  res.merged.sort((a, b) => b.updatedAt - a.updatedAt);
  res.merged = res.merged.slice(0, LIMITS.favorites);
  return res;
}

export function mergePresets(
  local: TruckPreset[],
  cloud: TruckPreset[],
  updatedAt: (p: TruckPreset) => number = () => 0,
): MergeResult<TruckPreset> {
  return mergeCollections(
    local,
    cloud,
    (p) => p.id,
    (p) => norm(p.name),
    updatedAt,
  );
}

/* ------------------------------------------------------------ offline queue */

export type SyncOp =
  | { kind: 'upsert-trip'; clientId: string }
  | { kind: 'delete-trip'; clientId: string }
  | { kind: 'upsert-preset'; clientId: string }
  | { kind: 'delete-preset'; clientId: string };

/**
 * Collapse a queue of offline operations: a later op for the same
 * (kind-family, clientId) supersedes an earlier one, and a delete cancels a
 * pending upsert for the same item (and vice-versa) so we never fight
 * ourselves on reconnect. Order-preserving on first appearance.
 */
export function dedupeQueue(ops: SyncOp[]): SyncOp[] {
  const family = (k: SyncOp['kind']) => (k.endsWith('trip') ? 'trip' : 'preset');
  const latest = new Map<string, SyncOp>();
  for (const op of ops) latest.set(`${family(op.kind)}:${op.clientId}`, op);
  return [...latest.values()];
}

/* ------------------------------------------------------ DB row <-> cloud */
/* Pure (no server imports) so mapping is offline-testable. `user_id` is       */
/* injected by the server route from the SESSION, never taken from the client. */

const toIso = (ms: number | null): string | null =>
  ms == null ? null : new Date(ms).toISOString();
const toMs = (iso: string | null | undefined): number => (iso ? Date.parse(iso) : 0);

export const TRIP_COLUMNS =
  'client_id, name, origin_label, origin_lat, origin_lng, destination_label, ' +
  'destination_lat, destination_lng, truck, created_at, updated_at, last_planned_at';
export const PRESET_COLUMNS =
  'client_id, name, height_ft, length_ft, gross_weight_lbs, axles, hazmat_class, created_at, updated_at';

export function tripToRow(userId: string, t: CloudSavedTrip): Record<string, unknown> {
  return {
    user_id: userId, // from the session — overrides anything a client sent
    client_id: t.clientId,
    name: t.name,
    origin_label: t.origin.label,
    origin_lat: t.origin.lat,
    origin_lng: t.origin.lng,
    destination_label: t.destination.label,
    destination_lat: t.destination.lat,
    destination_lng: t.destination.lng,
    truck: t.truck,
    last_planned_at: toIso(t.lastPlannedAt),
    // created_at omitted (don't clobber on update); updated_at set by DB trigger.
  };
}

export function rowToTrip(r: Record<string, unknown>): CloudSavedTrip {
  return {
    clientId: String(r.client_id),
    name: String(r.name),
    origin: {
      label: String(r.origin_label),
      lat: Number(r.origin_lat),
      lng: Number(r.origin_lng),
    },
    destination: {
      label: String(r.destination_label),
      lat: Number(r.destination_lat),
      lng: Number(r.destination_lng),
    },
    truck: (r.truck ?? {}) as CloudSavedTrip['truck'],
    createdAt: toMs(r.created_at as string),
    updatedAt: toMs(r.updated_at as string),
    lastPlannedAt: r.last_planned_at ? toMs(r.last_planned_at as string) : null,
  };
}

export function presetToRow(userId: string, p: CloudTruckPreset): Record<string, unknown> {
  return {
    user_id: userId,
    client_id: p.clientId,
    name: p.name,
    height_ft: p.heightFt,
    length_ft: p.lengthFt,
    gross_weight_lbs: p.grossWeightLbs,
    axles: p.axles,
    hazmat_class: p.hazmatClass,
  };
}

export function rowToPreset(r: Record<string, unknown>): CloudTruckPreset {
  return {
    clientId: String(r.client_id),
    name: String(r.name),
    heightFt: Number(r.height_ft),
    lengthFt: Number(r.length_ft),
    grossWeightLbs: Number(r.gross_weight_lbs),
    axles: Number(r.axles),
    hazmatClass: (r.hazmat_class as string | null) ?? null,
    createdAt: toMs(r.created_at as string),
    updatedAt: toMs(r.updated_at as string),
  };
}
