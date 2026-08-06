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
  // v8 semantics: `actions` returns the structured action list but the
  // human-readable `instruction` TEXT field only ships when `instructions`
  // is ALSO requested. Without it every action arrives text-less, the
  // parser's leniency rule drops them all, and validation correctly
  // refuses guidance with no-maneuvers (live pilot, deploy-preview-251).
  p.set('return', 'polyline,summary,actions,instructions');
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

type HereAction = {
  action?: string;
  instruction?: string;
  direction?: string;
  severity?: string;
  /** Index into the SECTION's decoded polyline where the maneuver occurs. */
  offset?: number;
  /** Meters covered by this action. */
  length?: number;
  /** Seconds spent in this action. */
  duration?: number;
};
type HereNotice = {
  title?: string;
  code?: string;
  severity?: string;
};
type HereSection = {
  summary?: { length?: number; duration?: number };
  polyline?: string;
  actions?: HereAction[];
  notices?: HereNotice[];
};
type HereResponse = { routes?: { sections?: HereSection[] }[] };

/**
 * Route-level notice retained by the parse (N8a). HERE attaches notices to
 * sections — e.g. a violated truck restriction ships as severity
 * `critical`. The planner has always ignored these (its route is an
 * estimate aid); the Navigator MUST see them, because a critical notice
 * means the route is not truck-legal as returned.
 */
export type HereRouteNotice = {
  code: string;
  title: string;
  severity: string;
};

/** Defense against a malformed payload, not a truncation policy. */
const MAX_NOTICES = 50;

/**
 * One turn instruction with enough structure for turn-by-turn guidance
 * (Navigator milestone N1). Purely additive next to `instructions`:
 * `composeQuote` and every existing caller ignore it.
 */
export type HereManeuver = {
  /** HERE action kind: 'depart' | 'turn' | 'exit' | 'arrive' | ... */
  action: string;
  instruction: string;
  /** 'left' | 'right' | ... when HERE supplies one. */
  direction: string | null;
  severity: string | null;
  /**
   * Index into the parsed route's CONCATENATED `positions` array (section
   * offsets are rebased during the parse), clamped to the array bounds.
   */
  offset: number;
  lengthM: number | null;
  durationS: number | null;
};

/**
 * Guidance needs the complete maneuver list — capping it the way display
 * instructions are capped would silently drop turns late in a long trip.
 * The bound below is a defense against a malformed provider payload, not a
 * truncation policy: HERE emits well under 1,000 actions for any real
 * route (a coast-to-coast run is a few hundred).
 */
const MAX_MANEUVERS = 1000;

export type ParsedHereRoute = {
  meters: number;
  seconds: number;
  positions: LatLng[];
  instructions: string[];
  maneuvers: HereManeuver[];
  /** Provider notices, always an array (empty when none). Additive (N8a). */
  notices: HereRouteNotice[];
};

/** Extract distance/duration/geometry/instructions. Null on anything malformed. */
export function parseHereResponse(json: unknown): ParsedHereRoute | null {
  const sections = (json as HereResponse)?.routes?.[0]?.sections;
  if (!Array.isArray(sections) || sections.length === 0) return null;
  let meters = 0;
  let seconds = 0;
  const positions: LatLng[] = [];
  const instructions: string[] = [];
  const maneuvers: HereManeuver[] = [];
  const notices: HereRouteNotice[] = [];
  for (const s of sections) {
    for (const n of s.notices ?? []) {
      // Leniency rule as elsewhere: a malformed notice entry is skipped,
      // never fails the route — but a well-formed one is always retained.
      if (
        notices.length < MAX_NOTICES &&
        (typeof n.code === 'string' || typeof n.title === 'string')
      ) {
        notices.push({
          code: typeof n.code === 'string' ? n.code : '',
          title: typeof n.title === 'string' ? n.title : '',
          severity: typeof n.severity === 'string' && n.severity ? n.severity : 'info',
        });
      }
    }
    const len = s.summary?.length;
    const dur = s.summary?.duration;
    if (typeof len !== 'number' || typeof dur !== 'number' || len < 0 || dur < 0) return null;
    meters += len;
    seconds += dur;
    // Captured before this section's polyline is appended: HERE action
    // offsets index into the SECTION polyline, and the maneuver list must
    // index into the concatenated route geometry.
    const sectionBase = positions.length;
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
      // A maneuver additionally needs a kind; entries without one stay in
      // the display list above but cannot drive guidance. Same leniency
      // rule as instructions: skip the malformed entry, never fail the route.
      if (
        maneuvers.length < MAX_MANEUVERS &&
        typeof a.instruction === 'string' &&
        a.instruction &&
        typeof a.action === 'string' &&
        a.action
      ) {
        const sectionOffset =
          typeof a.offset === 'number' && Number.isInteger(a.offset) && a.offset >= 0
            ? a.offset
            : 0;
        maneuvers.push({
          action: a.action,
          instruction: a.instruction,
          direction: typeof a.direction === 'string' && a.direction ? a.direction : null,
          severity: typeof a.severity === 'string' && a.severity ? a.severity : null,
          offset: sectionBase + sectionOffset,
          lengthM: typeof a.length === 'number' && a.length >= 0 ? a.length : null,
          durationS: typeof a.duration === 'number' && a.duration >= 0 ? a.duration : null,
        });
      }
    }
  }
  if (meters <= 0 || seconds <= 0 || positions.length < 2) return null;
  // Defensive clamp: a provider offset beyond the section's own geometry
  // must still land on a real route point.
  for (const m of maneuvers) {
    if (m.offset >= positions.length) m.offset = positions.length - 1;
  }
  return {
    meters,
    seconds,
    positions,
    instructions: instructions.slice(0, MAX_INSTRUCTIONS),
    maneuvers,
    notices,
  };
}

/**
 * TEMPORARY pilot diagnostic (PR #251): a sanitized, structure-only summary
 * of a provider response — counts and field NAMES only. No VALUE from the
 * payload is ever read into the output, so it cannot carry a coordinate,
 * the key, or any user data. `positionCount` comes from the caller's parse
 * so the geometry is not decoded twice.
 */
export function summarizeHereResponseShape(json: unknown, positionCount: number): string {
  const safeName = (k: string) => k.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24);
  const routes = (json as HereResponse)?.routes;
  if (!Array.isArray(routes)) return 'routes:none';
  const parts: string[] = [`routes:${routes.length}`];
  const sections = routes[0]?.sections;
  if (!Array.isArray(sections)) {
    parts.push('sections:none');
  } else {
    parts.push(`sections:${sections.length}`);
    parts.push(
      `actions:${sections
        .map((s) => (Array.isArray(s?.actions) ? s.actions.length : 'none'))
        .join('+')}`,
    );
    const first = sections[0];
    parts.push(
      `fields:${
        first && typeof first === 'object'
          ? Object.keys(first).slice(0, 12).map(safeName).join('.') || 'none'
          : 'none'
      }`,
    );
    // The discriminator for the no-maneuvers incident: which fields does
    // the FIRST action actually carry (e.g. is `instruction` present)?
    const firstAction = Array.isArray(first?.actions) ? first.actions[0] : undefined;
    parts.push(
      `action0:${
        firstAction && typeof firstAction === 'object'
          ? Object.keys(firstAction).slice(0, 10).map(safeName).join('.') || 'none'
          : 'none'
      }`,
    );
    const noticeCodes = sections
      .flatMap((s) => (Array.isArray(s?.notices) ? s.notices : []))
      .map((n) => safeName(typeof n?.code === 'string' && n.code ? n.code : 'untyped'))
      .slice(0, 8);
    parts.push(`notices:${noticeCodes.length > 0 ? noticeCodes.join('.') : 'none'}`);
  }
  parts.push(`positions:${positionCount}`);
  return parts.join(';').slice(0, 300);
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

/** Why one route() call ended the way it did (N8a observability). */
export type HereRouteOutcome =
  | 'no-key'
  | 'invalid-profile'
  | 'over-cap'
  | 'cache-hit'
  | 'coalesced'
  | 'provider-error'
  | 'malformed-response'
  | 'ok';

export type HereRoutingOptions = {
  /** Injected clock for cache TTL tests. */
  nowMs?: () => number;
  /** Cache TTL, default 6 hours. */
  cacheTtlMs?: number;
  /** Max cached routes per instance, default 500. */
  cacheMax?: number;
  /** Per-instance live-call budget per hour (free-tier guard), default 100. */
  hourlyCap?: number;
  /**
   * Optional outcome observer (N8a). Fired at most once per route() call
   * with why the call resolved as it did — the Navigator's honest
   * provider-failure reporting and the cost-control tests hang off this.
   * Exceptions from the observer are swallowed; the route path never
   * depends on it. Default: no observer, byte-identical planner behavior.
   */
  onOutcome?: (outcome: HereRouteOutcome) => void;
  /**
   * Optional provider-HTTP observer (pilot diagnostics): fired when the
   * provider answers non-200 (with the status and a short, sanitized
   * body snippet — never the key, never the URL) or when the fetch
   * throws (status null, note 'network-or-timeout'). Purely additive;
   * exceptions from the observer are swallowed. Default: no observer,
   * byte-identical planner behavior.
   */
  onProviderHttpError?: (status: number | null, note: string) => void;
  /**
   * Optional response-shape observer (TEMPORARY pilot diagnostic, PR #251):
   * fired once per live provider response with the sanitized structure
   * summary from `summarizeHereResponseShape` — counts and field names,
   * never values. Purely additive; exceptions from the observer are
   * swallowed. Default: no observer, byte-identical planner behavior.
   */
  onResponseShape?: (shape: string) => void;
  /**
   * Retain the FULL decoded geometry on results (N8b). Default FALSE:
   * the planner never needs it and its cache must not grow by holding
   * complete polylines. The Navigator route endpoint opts in and pairs
   * this with a much smaller `cacheMax`.
   */
  retainGeometry?: boolean;
};

/**
 * Departure-time bucket for the route cache/coalescing key. The request URL
 * sends `departureTime` (buildHereRouteUrl), so HERE's answer is
 * departure-dependent: traffic and time-of-day truck restrictions can change
 * the physical route. A key without it shared one cached route across every
 * departure time for the full 6h TTL and presented it as computed for the
 * requested departure. 30-minute buckets keep coalescing effective for the
 * real usage pattern (drivers quote departures near "now", which land in the
 * same bucket) while bounding cross-departure reuse to half an hour.
 */
const DEPART_BUCKET_MS = 30 * 60_000;

/** Cache key: rounded endpoints + truck attributes + departure bucket. */
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
    // Different departure times must not share a routing answer beyond the
    // bucket: the provider computes traffic and restrictions for the
    // departure we send it.
    Math.floor(req.departAtMs / DEPART_BUCKET_MS),
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
  const emit = (outcome: HereRouteOutcome): void => {
    try {
      opts.onOutcome?.(outcome);
    } catch {
      // The observer can never affect routing.
    }
  };

  const cache = new Map<string, { atMs: number; result: RoutingResult }>();
  // One in-flight request per cache key: the cache is written only after a
  // response lands, so without this two concurrent quotes for the same lane
  // would both miss and spend two transactions on one answer.
  const pending = new Map<string, Promise<RoutingResult | null>>();
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

  // Provider-HTTP observer (pilot diagnostics). The 4xx body is HERE's
  // own error JSON (title/cause/action) and never contains the key; the
  // snippet is sanitized and capped anyway so nothing secret-shaped can
  // pass through even if the provider changes its error format.
  const reportHttp = (status: number | null, note: string): void => {
    try {
      const safe = note
        .replace(/apiKey=[^&\s"']*/gi, 'apiKey=REDACTED')
        .replace(/[^\x20-\x7E]/g, ' ')
        .slice(0, 200);
      opts.onProviderHttpError?.(status, safe);
    } catch {
      // The observer can never affect routing.
    }
  };

  const getJson = async (url: string): Promise<unknown | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetchFn(url);
        if (res.status === 200) return await res.json();
        // 4xx will not fix itself; retrying only spends quota.
        if (res.status < 500) {
          let body = '';
          try {
            body = JSON.stringify(await res.json());
          } catch {
            body = '(unreadable body)';
          }
          reportHttp(res.status, body);
          return null;
        }
        reportHttp(res.status, '(5xx, will retry once)');
      } catch {
        // network/timeout — one retry, then give up
        reportHttp(null, 'network-or-timeout');
      }
    }
    return null;
  };

  const fetchRoute = async (key: string, req: RoutingRequest): Promise<RoutingResult | null> => {
    try {
      if (!underCap()) {
        emit('over-cap');
        return null;
      }
      callsInWindow += 1;
      const json = await getJson(buildHereRouteUrl(req, apiKey as string));
      if (json === null) {
        emit('provider-error');
        return null;
      }
      const parsed = parseHereResponse(json);
      try {
        opts.onResponseShape?.(summarizeHereResponseShape(json, parsed?.positions.length ?? 0));
      } catch {
        // The observer can never affect routing.
      }
      if (!parsed) {
        emit('malformed-response');
        return null;
      }

      const distanceMiles = Number((parsed.meters / METERS_PER_MILE).toFixed(1));
      const hours = parsed.seconds / 3600;
      if (distanceMiles < 0.1 || hours <= 0) {
        emit('malformed-response');
        return null;
      }
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
        // N8a additions — optional on the type; composeQuote ignores them.
        maneuvers: parsed.maneuvers,
        notices: parsed.notices,
        summary: { meters: parsed.meters, seconds: parsed.seconds },
        geometryPointCount: parsed.positions.length,
        // N8b: full geometry only on explicit opt-in (see the option doc).
        ...(opts.retainGeometry ? { geometry: parsed.positions } : {}),
      };
      emit('ok');

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
  };

  return {
    name: 'here',
    route: async (req: RoutingRequest): Promise<RoutingResult | null> => {
      if (!apiKey) {
        emit('no-key');
        return null;
      }
      // Impossible truck profiles never reach the provider: no transaction
      // spent, no garbage route — the caller falls back to the estimate.
      if (validateTruckProfileForRouting(req.truck).length > 0) {
        emit('invalid-profile');
        return null;
      }
      try {
        const key = routeCacheKey(req);
        const hit = cache.get(key);
        if (hit) {
          if (nowMs() - hit.atMs < cacheTtlMs) {
            emit('cache-hit');
            return hit.result;
          }
          // Expired entries used to sit in their slots until eviction
          // pressure — a full cache could be dead weight evicting live
          // routes. Stale on read = deleted on read.
          cache.delete(key);
        }

        const inFlight = pending.get(key);
        if (inFlight) {
          emit('coalesced');
          return inFlight;
        }
        const run = fetchRoute(key, req);
        pending.set(key, run);
        try {
          return await run;
        } finally {
          pending.delete(key);
        }
      } catch {
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
