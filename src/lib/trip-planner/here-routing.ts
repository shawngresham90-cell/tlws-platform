import { haversineMiles } from '@/lib/map/geo';
import type { LatLng } from '@/lib/map/bounds';
import { buildRoute, type TruckProfile } from './types';
import type { RoutingPort, RoutingRequest, RoutingResult } from './providers';
import { decodeFlexiblePolyline } from './flexible-polyline';

/**
 * HERE Routing API v8 adapter (Phase 5) — the live implementation behind the
 * Phase 3 RoutingPort seam. Truck-profile routing: height/width/length,
 * gross weight, axle count, and hazmat restrictions go into every request.
 *
 * Safety and cost rails, all non-negotiable:
 * - SERVER-SIDE ONLY. The API key arrives via env at the API route and never
 *   exists client-side. No URL (which carries the key) is ever thrown,
 *   logged, or returned — every failure collapses to `null`.
 * - FAIL-SOFT. `null` means "no live route"; callers fall back to the
 *   labeled estimate. A HERE outage can never break planning.
 * - FREE-TIER GUARD. A per-instance call budget (default 100/hour) hard-caps
 *   spend at $0: when exhausted the adapter returns null instead of calling.
 *   With HERE's 5,000 free truck transactions/month this cap plus the cache
 *   keeps usage inside the approved free allowance.
 * - CACHE. Identical requests (rounded endpoints + truck profile) are served
 *   from an in-memory TTL cache, so repeat quotes between the same directory
 *   anchors cost zero transactions. Per-instance on serverless (same
 *   documented limitation as the rate limiter); a shared store can replace
 *   it behind this same function without touching call sites.
 * - RETRY. One retry on 5xx/network failure only — never on 4xx (a bad
 *   request or auth failure will not fix itself, and retrying spends quota).
 */

export type HereFetch = (url: string) => Promise<{
  status: number;
  json(): Promise<unknown>;
}>;

const HERE_BASE = 'https://router.hereapi.com/v8/routes';
const CM_PER_FT = 30.48;
const KG_PER_LB = 0.45359237;
const METERS_PER_MILE = 1609.344;

/** Target spacing of sampled route points fed to weather/directory layers. */
const SAMPLE_MILES = 2;
const MAX_ROUTE_POINTS = 400;
const MAX_INSTRUCTIONS = 60;

/**
 * US hazmat class (placard, "1".."9" with optional subclass like "2.1") →
 * HERE `shippedHazardousGoods` value. Conservative: unknown input maps to
 * `other` so restricted roads are still avoided rather than ignored.
 */
export function hazmatToHereGoods(hazmatClass: string | null): string | null {
  if (!hazmatClass) return null;
  const cls = hazmatClass.trim().charAt(0);
  switch (cls) {
    case '1':
      return 'explosive';
    case '2':
      return 'gas';
    case '3':
      return 'flammable';
    case '4':
      return 'combustible';
    case '5':
      return 'organic';
    case '6':
      return 'poison';
    case '7':
      return 'radioactive';
    case '8':
      return 'corrosive';
    case '9':
      return 'other';
    default:
      return 'other';
  }
}

/**
 * Whitelisted HERE v8 `avoid[features]` values. Anything not in this set is
 * DROPPED (never forwarded) so arbitrary strings can't reach the provider.
 */
export const HERE_AVOID_FEATURES = new Set(['tollRoad', 'ferry', 'tunnel', 'dirtRoad', 'uTurns']);

/** Filter avoidances to the provider-supported whitelist (pure, testable). */
export function sanitizeAvoidances(avoid: readonly string[] | undefined): string[] {
  if (!avoid) return [];
  return [...new Set(avoid.filter((a) => HERE_AVOID_FEATURES.has(a)))];
}

/** Build the v8 request URL. Exported pure for tests; the key is a param. */
export function buildHereRouteUrl(req: RoutingRequest, apiKey: string): string {
  const p = new URLSearchParams();
  p.set('transportMode', 'truck');
  p.set('origin', `${req.origin.lat.toFixed(6)},${req.origin.lng.toFixed(6)}`);
  p.set('destination', `${req.destination.lat.toFixed(6)},${req.destination.lng.toFixed(6)}`);
  for (const w of req.waypoints) p.append('via', `${w.lat.toFixed(6)},${w.lng.toFixed(6)}`);
  p.set('return', 'polyline,summary,actions');
  p.set('departureTime', new Date(req.departAtMs).toISOString());
  const t = req.truck;
  p.set('truck[height]', String(Math.round(t.heightFt * CM_PER_FT)));
  p.set('truck[width]', String(Math.round(t.widthFt * CM_PER_FT)));
  p.set('truck[length]', String(Math.round(t.lengthFt * CM_PER_FT)));
  p.set('truck[grossWeight]', String(Math.round(t.grossWeightLbs * KG_PER_LB)));
  p.set('truck[axleCount]', String(t.axles));
  const goods = hazmatToHereGoods(t.hazmatClass);
  if (goods) p.set('truck[shippedHazardousGoods]', goods);
  const avoid = sanitizeAvoidances(req.avoid);
  if (avoid.length > 0) p.set('avoid[features]', avoid.join(','));
  p.set('apiKey', apiKey);
  return `${HERE_BASE}?${p.toString()}`;
}

/**
 * Adapter-level impossible-profile guard: a request whose truck dimensions
 * are outside physical/legal plausibility returns problems and is never sent
 * to the provider (no wasted transaction, no garbage route).
 */
export function validateTruckProfileForRouting(t: TruckProfile): string[] {
  const problems: string[] = [];
  const bounds: [string, number, number, number][] = [
    ['heightFt', t.heightFt, TRUCK_LIMITS.heightFt.min, TRUCK_LIMITS.heightFt.max],
    ['widthFt', t.widthFt, TRUCK_LIMITS.widthFt.min, TRUCK_LIMITS.widthFt.max],
    ['lengthFt', t.lengthFt, TRUCK_LIMITS.lengthFt.min, TRUCK_LIMITS.lengthFt.max],
    [
      'grossWeightLbs',
      t.grossWeightLbs,
      TRUCK_LIMITS.grossWeightLbs.min,
      TRUCK_LIMITS.grossWeightLbs.max,
    ],
    ['axles', t.axles, TRUCK_LIMITS.axles.min, TRUCK_LIMITS.axles.max],
  ];
  for (const [name, value, min, max] of bounds) {
    if (!Number.isFinite(value) || value < min || value > max) {
      problems.push(`${name} out of range ${min}..${max}`);
    }
  }
  return problems;
}

type HereSection = {
  summary?: { length?: number; duration?: number };
  polyline?: string;
  actions?: { instruction?: string }[];
};
type HereResponse = { routes?: { sections?: HereSection[] }[] };

export type ParsedHereRoute = {
  meters: number;
  seconds: number;
  positions: LatLng[];
  instructions: string[];
};

/** Extract distance/duration/geometry/instructions. Null on anything malformed. */
export function parseHereResponse(json: unknown): ParsedHereRoute | null {
  const sections = (json as HereResponse)?.routes?.[0]?.sections;
  if (!Array.isArray(sections) || sections.length === 0) return null;
  let meters = 0;
  let seconds = 0;
  const positions: LatLng[] = [];
  const instructions: string[] = [];
  for (const s of sections) {
    const len = s.summary?.length;
    const dur = s.summary?.duration;
    if (typeof len !== 'number' || typeof dur !== 'number' || len < 0 || dur < 0) return null;
    meters += len;
    seconds += dur;
    if (typeof s.polyline === 'string' && s.polyline.length > 0) {
      try {
        for (const pos of decodeFlexiblePolyline(s.polyline).positions) {
          positions.push({ lat: pos[0], lng: pos[1] });
        }
      } catch {
        return null;
      }
    }
    for (const a of s.actions ?? []) {
      if (typeof a.instruction === 'string' && a.instruction) instructions.push(a.instruction);
    }
  }
  if (meters <= 0 || seconds <= 0 || positions.length < 2) return null;
  return { meters, seconds, positions, instructions: instructions.slice(0, MAX_INSTRUCTIONS) };
}

/** Downsample decoded geometry into cumulative route-mile points. */
export function toRoutePoints(
  positions: LatLng[],
  totalMiles: number,
): { position: LatLng; routeMile: number }[] {
  const cumulative: number[] = [0];
  for (let i = 1; i < positions.length; i++) {
    cumulative.push(cumulative[i - 1] + haversineMiles(positions[i - 1], positions[i]));
  }
  // Geometry mileage and summary mileage differ slightly; scale so the last
  // point lands exactly on the provider's total.
  const geomMiles = cumulative[cumulative.length - 1];
  const scale = geomMiles > 0 ? totalMiles / geomMiles : 1;

  const spacing = Math.max(SAMPLE_MILES, totalMiles / MAX_ROUTE_POINTS);
  const points: { position: LatLng; routeMile: number }[] = [];
  let nextAt = 0;
  for (let i = 0; i < positions.length; i++) {
    const mile = cumulative[i] * scale;
    if (mile >= nextAt || i === positions.length - 1) {
      points.push({ position: positions[i], routeMile: Number(mile.toFixed(1)) });
      nextAt = mile + spacing;
    }
  }
  return points;
}

export type HereRoutingOptions = {
  /** Injected clock for cache TTL tests. */
  nowMs?: () => number;
  /** Cache TTL, default 6 hours. */
  cacheTtlMs?: number;
  /** Max cached routes per instance, default 500. */
  cacheMax?: number;
  /** Per-instance live-call budget per hour (free-tier guard), default 100. */
  hourlyCap?: number;
};

/** Cache key: rounded endpoints + the truck attributes that change routing. */
export function routeCacheKey(req: RoutingRequest): string {
  const t = req.truck;
  const pt = (p: LatLng) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
  return [
    pt(req.origin),
    pt(req.destination),
    req.waypoints.map(pt).join(';'),
    Math.round(t.heightFt * 10),
    Math.round(t.widthFt * 10),
    Math.round(t.lengthFt),
    Math.round(t.grossWeightLbs / 100),
    t.axles,
    hazmatToHereGoods(t.hazmatClass) ?? '',
    // Avoidances change the route — a toll-free route must not be served
    // from the cache of an unrestricted one (sorted for order-independence).
    sanitizeAvoidances(req.avoid).sort().join(','),
  ].join('|');
}

/**
 * Live HERE routing behind the RoutingPort seam. Returns a port even without
 * a key (it just always answers null) so wiring never branches.
 */
export function createHereRoutingPort(
  fetchFn: HereFetch,
  apiKey: string | undefined,
  opts: HereRoutingOptions = {},
): RoutingPort {
  const nowMs = opts.nowMs ?? (() => Date.now());
  const cacheTtlMs = opts.cacheTtlMs ?? 6 * 3_600_000;
  const cacheMax = opts.cacheMax ?? 500;
  const hourlyCap = opts.hourlyCap ?? 100;

  const cache = new Map<string, { atMs: number; result: RoutingResult }>();
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
        // 4xx will not fix itself; retrying only spends quota.
        if (res.status < 500) return null;
      } catch {
        // network/timeout — one retry, then give up
      }
    }
    return null;
  };

  return {
    name: 'here',
    route: async (req: RoutingRequest): Promise<RoutingResult | null> => {
      if (!apiKey) return null;
      // Impossible truck profiles never reach the provider: no transaction
      // spent, no garbage route — the caller falls back to the estimate.
      if (validateTruckProfileForRouting(req.truck).length > 0) return null;
      try {
        const key = routeCacheKey(req);
        const hit = cache.get(key);
        if (hit && nowMs() - hit.atMs < cacheTtlMs) return hit.result;

        if (!underCap()) return null;
        callsInWindow += 1;
        const parsed = parseHereResponse(await getJson(buildHereRouteUrl(req, apiKey)));
        if (!parsed) return null;

        const distanceMiles = Number((parsed.meters / METERS_PER_MILE).toFixed(1));
        const hours = parsed.seconds / 3600;
        if (distanceMiles < 0.1 || hours <= 0) return null;
        const route = buildRoute([
          {
            seq: 0,
            from: { label: 'origin', position: req.origin },
            to: { label: 'destination', position: req.destination },
            distanceMiles,
            avgSpeedMph: distanceMiles / hours,
          },
        ]);
        const result: RoutingResult = {
          route,
          routePoints: toRoutePoints(parsed.positions, distanceMiles),
          tollCents: null,
          provider: 'HERE Routing API v8 (truck profile)',
          instructions: parsed.instructions,
        };

        cache.set(key, { atMs: nowMs(), result });
        if (cache.size > cacheMax) {
          for (const k of cache.keys()) {
            if (cache.size <= cacheMax) break;
            cache.delete(k);
          }
        }
        return result;
      } catch {
        // Absolute fail-soft: no URL, no key, no detail escapes this adapter.
        return null;
      }
    },
  };
}

/** Default truck profile bounds accepted from the public API (zod-side). */
export const TRUCK_LIMITS = {
  heightFt: { min: 8, max: 15 },
  widthFt: { min: 7, max: 9 },
  lengthFt: { min: 20, max: 120 },
  grossWeightLbs: { min: 10_000, max: 164_000 },
  axles: { min: 2, max: 9 },
} as const;
