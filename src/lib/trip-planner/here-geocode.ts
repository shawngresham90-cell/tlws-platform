import type { LatLng } from '@/lib/map/bounds';

/**
 * HERE Geocoding & Search API v7 adapter (free-text search milestone). Turns
 * an arbitrary user query — city+state, street address, ZIP, or place name —
 * into ranked coordinate candidates that feed the existing HERE truck-routing
 * quote. Reuses the same rails as the routing adapter:
 *
 * - SERVER-SIDE ONLY. The API key arrives via env at the API route and never
 *   exists client-side. No URL (which carries the key) is thrown, logged, or
 *   returned — every failure collapses to an empty list.
 * - FAIL-SOFT. `[]` means "no geocoding right now"; the UI still offers
 *   directory locations, so trips between known stops always work.
 * - FREE-TIER GUARD. A per-instance hourly call budget caps spend at $0 by
 *   returning [] instead of calling once exhausted.
 * - CACHE. Identical normalized queries are served from a TTL cache, so
 *   repeat/typeahead lookups cost zero transactions.
 * - RETRY. One retry on 5xx/network only — never on 4xx (bad request / auth
 *   will not fix itself and retrying spends quota).
 *
 * Draws from the same HERE Base Plan (search + routing share the free tier);
 * no new paid service is introduced.
 */

export type HereGeocodeFetch = (url: string) => Promise<{
  status: number;
  json(): Promise<unknown>;
}>;

const GEOCODE_BASE = 'https://geocode.search.hereapi.com/v1/geocode';

/** Normalized place kind surfaced to the UI for labeling. */
export type PlaceKind = 'address' | 'city' | 'postal' | 'poi' | 'area' | 'other';

export type GeocodeMatch = {
  /** Stable id for React keys / selection (HERE id or synthesized). */
  id: string;
  /** Human label ("Nashville, TN, United States"). */
  label: string;
  position: LatLng;
  kind: PlaceKind;
  /** Two-letter state code when HERE provides one. */
  stateCode: string | null;
  /** 0..1 match confidence from HERE scoring, when present. */
  score: number | null;
};

/** Map HERE resultType → our coarse kind (pure, testable). */
export function classifyResultType(resultType: string | undefined): PlaceKind {
  switch (resultType) {
    case 'houseNumber':
    case 'street':
    case 'intersection':
    case 'addressBlock':
      return 'address';
    case 'locality':
      return 'city';
    case 'postalCodePoint':
      return 'postal';
    case 'place':
      return 'poi';
    case 'administrativeArea':
      return 'area';
    default:
      return 'other';
  }
}

/** Collapse whitespace/case so equivalent queries share a cache slot. */
export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Build the v7 geocode URL. Exported pure for tests; key is a param. */
export function buildGeocodeUrl(query: string, apiKey: string, limit = 6): string {
  const p = new URLSearchParams();
  p.set('q', query);
  // Constrain to the US — this is a US trucking tool, and the filter both
  // sharpens results and avoids surfacing foreign namesakes.
  p.set('in', 'countryCode:USA');
  p.set('limit', String(Math.min(Math.max(limit, 1), 20)));
  p.set('apiKey', apiKey);
  return `${GEOCODE_BASE}?${p.toString()}`;
}

type HereItem = {
  id?: string;
  title?: string;
  resultType?: string;
  position?: { lat?: number; lng?: number };
  address?: { label?: string; stateCode?: string };
  scoring?: { queryScore?: number };
};
type HereGeocodeResponse = { items?: HereItem[] };

const validLat = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 90;
const validLng = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 180;

/**
 * Parse a geocode response into validated matches. Items with missing or
 * out-of-range coordinates are dropped — malformed coordinates never reach
 * the router. Returns [] for anything unparseable (never throws).
 */
export function parseGeocodeResponse(json: unknown, max = 6): GeocodeMatch[] {
  const items = (json as HereGeocodeResponse)?.items;
  if (!Array.isArray(items)) return [];
  const out: GeocodeMatch[] = [];
  for (let i = 0; i < items.length && out.length < max; i++) {
    const it = items[i];
    const lat = it?.position?.lat;
    const lng = it?.position?.lng;
    if (!validLat(lat) || !validLng(lng)) continue;
    const label = it.address?.label ?? it.title ?? '';
    if (!label) continue;
    const score = it.scoring?.queryScore;
    out.push({
      id: it.id ?? `here-${i}-${lat.toFixed(4)},${lng.toFixed(4)}`,
      label,
      position: { lat, lng },
      kind: classifyResultType(it.resultType),
      stateCode: it.address?.stateCode ?? null,
      score: typeof score === 'number' && Number.isFinite(score) ? score : null,
    });
  }
  return out;
}

export type GeocodePort = {
  name: string;
  /** Free-text search → ranked coordinate matches (empty when unavailable). */
  search(query: string): Promise<GeocodeMatch[]>;
};

export type HereGeocodeOptions = {
  nowMs?: () => number;
  /** Cache TTL, default 1 hour. */
  cacheTtlMs?: number;
  /** Max cached queries per instance, default 500. */
  cacheMax?: number;
  /** Per-instance hourly call cap (free-tier guard), default 200. */
  hourlyCap?: number;
  /** Max matches returned per query, default 6. */
  maxResults?: number;
};

/** Minimum query length worth spending a geocoding transaction on. */
export const MIN_QUERY_LENGTH = 3;

/**
 * Live HERE geocoding behind the GeocodePort seam. Returns a port even
 * without a key (it just always answers []), so wiring never branches.
 */
export function createHereGeocodePort(
  fetchFn: HereGeocodeFetch,
  apiKey: string | undefined,
  opts: HereGeocodeOptions = {},
): GeocodePort {
  const nowMs = opts.nowMs ?? (() => Date.now());
  const cacheTtlMs = opts.cacheTtlMs ?? 3_600_000;
  const cacheMax = opts.cacheMax ?? 500;
  const hourlyCap = opts.hourlyCap ?? 200;
  const maxResults = opts.maxResults ?? 6;

  const cache = new Map<string, { atMs: number; matches: GeocodeMatch[] }>();
  let windowStartMs = 0;
  let callsInWindow = 0;

  const underCap = (): boolean => {
    const now = nowMs();
    if (now - windowStartMs >= 3_600_000) {
      windowStartMs = now;
      callsInWindow = 0;
    }
    return callsInWindow < hourlyCap;
  };

  const getJson = async (url: string): Promise<unknown | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetchFn(url);
        if (res.status === 200) return await res.json();
        if (res.status < 500) return null;
      } catch {
        // network/timeout — one retry, then give up
      }
    }
    return null;
  };

  return {
    name: 'here-geocode',
    search: async (query: string): Promise<GeocodeMatch[]> => {
      if (!apiKey) return [];
      const normalized = normalizeQuery(query);
      if (normalized.length < MIN_QUERY_LENGTH) return [];
      try {
        const hit = cache.get(normalized);
        if (hit && nowMs() - hit.atMs < cacheTtlMs) return hit.matches;

        if (!underCap()) return [];
        callsInWindow += 1;
        const matches = parseGeocodeResponse(
          await getJson(buildGeocodeUrl(normalized, apiKey, maxResults)),
          maxResults,
        );

        cache.set(normalized, { atMs: nowMs(), matches });
        if (cache.size > cacheMax) {
          for (const k of cache.keys()) {
            if (cache.size <= cacheMax) break;
            cache.delete(k);
          }
        }
        return matches;
      } catch {
        // Absolute fail-soft: no URL, no key, no detail escapes this adapter.
        return [];
      }
    },
  };
}
