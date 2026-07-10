/**
 * Duplicate detection for directory listings. Pure and bucketed: candidates
 * are grouped by normalized-name key, normalized-address key, and rounded
 * coordinates, then pairs are emitted only within a bucket — O(n) buckets
 * instead of O(n²) pairwise, so tens of thousands of rows stay fast.
 */

export type DupCandidate = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type DupPair = {
  aId: string;
  bId: string;
  /** Which signals matched: 'name' | 'address' | 'coords'. */
  reasons: string[];
};

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function pairKey(x: string, y: string): string {
  return x < y ? `${x}|${y}` : `${y}|${x}`;
}

/** Stable ordered pair (a < b) to match the ignore table's convention. */
export function orderPair(x: string, y: string): { a: string; b: string } {
  return x < y ? { a: x, b: y } : { a: y, b: x };
}

/**
 * Find candidate duplicate pairs.
 * - name: same normalized name AND same state (chains ignore state-less rows)
 * - address: same normalized address + city + state
 * - coords: within ~110 m (3-decimal rounding buckets, checked across the
 *   8 neighbor cells so borderline points still pair)
 */
export function findDuplicatePairs(
  rows: DupCandidate[],
  ignored: Set<string> = new Set(),
  maxPairs = 200,
): DupPair[] {
  const pairs = new Map<string, DupPair>();

  const addPair = (x: string, y: string, reason: string) => {
    if (x === y) return;
    const key = pairKey(x, y);
    if (ignored.has(key)) return;
    const existing = pairs.get(key);
    if (existing) {
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
      return;
    }
    if (pairs.size >= maxPairs) return;
    const { a, b } = orderPair(x, y);
    pairs.set(key, { aId: a, bId: b, reasons: [reason] });
  };

  const emitBucketPairs = (bucket: string[], reason: string) => {
    // Within-bucket pairwise is fine: real-world buckets are tiny. Cap the
    // pathological case (thousands of identical names) at 50 per bucket.
    const capped = bucket.slice(0, 50);
    for (let i = 0; i < capped.length; i++)
      for (let j = i + 1; j < capped.length; j++) addPair(capped[i], capped[j], reason);
  };

  const byName = new Map<string, string[]>();
  const byAddress = new Map<string, string[]>();
  const byCoords = new Map<string, string[]>();

  for (const r of rows) {
    const name = normalizeText(r.name ?? '');
    if (name) {
      const key = `${name}|${(r.state ?? '').toUpperCase()}`;
      byName.set(key, [...(byName.get(key) ?? []), r.id]);
    }
    const address = normalizeText(r.address ?? '');
    if (address) {
      const key = `${address}|${normalizeText(r.city ?? '')}|${(r.state ?? '').toUpperCase()}`;
      byAddress.set(key, [...(byAddress.get(key) ?? []), r.id]);
    }
    if (r.lat != null && r.lng != null) {
      const key = `${r.lat.toFixed(3)}|${r.lng.toFixed(3)}`;
      byCoords.set(key, [...(byCoords.get(key) ?? []), r.id]);
    }
  }

  for (const bucket of byName.values()) if (bucket.length > 1) emitBucketPairs(bucket, 'name');
  for (const bucket of byAddress.values())
    if (bucket.length > 1) emitBucketPairs(bucket, 'address');

  // Coordinates: same cell plus the 8 neighbors, so ~110 m proximity across a
  // cell boundary still matches.
  for (const [key, bucket] of byCoords) {
    if (bucket.length > 1) emitBucketPairs(bucket, 'coords');
    const [latS, lngS] = key.split('|');
    const lat = Number(latS);
    const lng = Number(lngS);
    for (const dLat of [-0.001, 0, 0.001]) {
      for (const dLng of [-0.001, 0, 0.001]) {
        if (dLat === 0 && dLng === 0) continue;
        const neighbor = byCoords.get(`${(lat + dLat).toFixed(3)}|${(lng + dLng).toFixed(3)}`);
        if (!neighbor) continue;
        for (const x of bucket.slice(0, 50))
          for (const y of neighbor.slice(0, 50)) addPair(x, y, 'coords');
      }
    }
  }

  return [...pairs.values()];
}
