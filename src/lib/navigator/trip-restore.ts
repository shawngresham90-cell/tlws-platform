/**
 * Trip restore (pilot round 3, item 4): the driver leaves the app for a
 * phone call or another app, the OS discards the tab, and the browser
 * reloads the page — mid-drive. Without this module that reload lands on
 * the idle screen with no trip, and the driver is asked to re-plan a
 * route while rolling. With it, the active trip is put back exactly the
 * way it was planned, immediately, through the lifecycle's own front
 * door.
 *
 * WHAT IS PERSISTED — the planned ROUTE, and nothing about the driver:
 * the provider's validated route material (identical in shape to what
 * the plan port returns), the plan request it answered — WITHOUT its
 * origin, because PilotTripControls builds that origin from the live
 * GPS fix and fixes are never persisted — and the destination's
 * arrival context. On restore the request's origin is reconstructed
 * from the validated route's own first coordinate: the provider's
 * road-snapped route start, so the snapshot carries no information the
 * route itself does not, and no fix at all. A stored snapshot that
 * DOES contain a request origin was not written by this module and is
 * refused whole.
 *
 * WHAT IS NEVER PERSISTED: the driver's name (ephemeral by owner
 * decision), any GPS fix or position trail, or anything else about the
 * person.
 *
 * HOS CLOCKS ARE PERSISTED, and that reverses an earlier line in this
 * header deliberately. The clocks are duty COUNTERS — minutes used,
 * minutes elapsed, a rolling on-duty array and two plain timestamps.
 * They carry no position, no identity and nothing about where the truck
 * has been, so AD-7 is untouched. What made the old exclusion wrong is
 * what a reload did without them: the trip came back and the clocks
 * came back FULL, silently telling a driver eight hours into a shift
 * that they had eleven hours of driving left. A wrong clock on that
 * screen is more dangerous than no clock, so the snapshot now carries
 * the state the driving screen already had in memory. The field is
 * OPTIONAL: a snapshot written before this change still restores its
 * trip (with today's fresh-clock behavior) rather than being refused
 * whole, so a deploy mid-shift cannot strand a rolling driver. Reroute replacement routes are not captured either —
 * a reroute request's origin is a live truck position, and positions are
 * never written to storage (AD-7). A restore after an intervening
 * reroute therefore brings back the ORIGINAL planned route; if the truck
 * is no longer on it, the existing off-route → reroute machinery
 * recovers honestly, exactly as it would after any missed turn.
 *
 * WHERE: sessionStorage, chosen deliberately. It is per-tab and dies
 * with the tab, so a snapshot cannot outlive the browsing session that
 * made it, cannot leak across tabs, and cannot resurrect last week's
 * trip. The freshness window below bounds it further: past it a
 * snapshot is dropped, never restored — stale guidance restored hours
 * later would be confidently wrong, which is worse than asking again.
 *
 * HOW A RESTORE RUNS: through the normal lifecycle path — plan() served
 * by a port that returns the persisted material instead of the network
 * (no provider spend, no new lifecycle states, every transition
 * invariant intact), then startNavigation(). The pure helpers here own
 * serialization, strict validation, and the port/capture seams; the
 * driving screen owns storage and timing, because this core reads no
 * clock and touches no browser API.
 */

import type { LatLng } from '@/lib/map/bounds';
import type { ClockState, CycleRule, TruckProfile } from '@/lib/trip-planner/types';
import type { RouteAvoidance } from '@/lib/trip-planner/providers';
import {
  FACILITY_ARRIVAL_RADIUS_M,
  type DestinationFacility,
  type DestinationInfo,
} from './truck-entrance';
import type {
  NavigationLifecycle,
  PlanFetchResult,
  PlanPort,
  PlanRequest,
} from './navigation-lifecycle';

/** The successful branch of the plan port's result — the route material. */
export type RouteMaterial = Extract<PlanFetchResult, { kind: 'route' }>;

export type TripSnapshotInput = {
  route: RouteMaterial;
  request: PlanRequest;
  destination: DestinationInfo;
  savedAtMs: number;
  /** The driver's HOS clocks as they stood at savedAtMs. Optional: a
   *  caller without clocks writes a snapshot that restores the trip
   *  alone, exactly as this module did before. */
  clocks?: ClockState;
};

export type RestorableTrip = TripSnapshotInput;

/** sessionStorage key. The version suffix retires old shapes wholesale:
 *  a snapshot from a previous schema simply fails parsing and is dropped. */
export const TRIP_RESTORE_KEY = 'tlws-navigator-trip-v1';

/**
 * How old a snapshot may be and still restore. A phone call or a
 * Facebook detour is minutes; the driving screen refreshes the snapshot
 * on a cadence far shorter than this while a trip is active, so a live
 * trip's snapshot is always young. Past the window the snapshot is
 * dropped: restoring an hours-old route as live guidance would be
 * confidently stale.
 */
export const RESTORE_WINDOW_MS = 30 * 60 * 1000;

/** Refresh cadence for the driving screen's periodic re-save. */
export const RESTORE_REFRESH_MS = 60 * 1000;

/** Device clock moved backwards tolerance before a snapshot is refused. */
export const RESTORE_FUTURE_SKEW_MS = 2 * 60 * 1000;

/* Structural bounds. A snapshot is OUR OWN write read back, so anything
 * outside these is damage or tampering and the answer is refusal — a
 * driver can always plan again; a corrupted route restored is a hazard. */
export const MAX_GEOMETRY_POINTS = 25_000;
const MAX_MANEUVERS = 500;
const MAX_WARNINGS = 50;
const MAX_ENTRANCES = 20;
const MAX_TEXT = 500;
const MAX_ID = 120;

const POSITION_SOURCES: readonly DestinationInfo['positionSource'][] = [
  'entrance',
  'geocode',
  'centroid',
  'unknown',
];
const ENTRANCE_KINDS = ['verified', 'reported'] as const;
const AVOIDANCES: readonly RouteAvoidance[] = ['tollRoad', 'ferry', 'tunnel', 'dirtRoad', 'uTurns'];
/** The canonical facility set — the arrival-radius table's own keys, so
 *  this list can never drift from the arrival engine's. */
const FACILITIES = Object.keys(FACILITY_ARRIVAL_RADIUS_M) as DestinationFacility[];

function isLatLng(p: unknown): p is LatLng {
  if (p === null || typeof p !== 'object') return false;
  const { lat, lng } = p as { lat?: unknown; lng?: unknown };
  return (
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    Math.abs(lat) <= 90 &&
    typeof lng === 'number' &&
    Number.isFinite(lng) &&
    Math.abs(lng) <= 180
  );
}

function isText(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.length <= max;
}

function isPositiveFinite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

function isTruck(t: unknown): t is TruckProfile {
  if (t === null || typeof t !== 'object') return false;
  const truck = t as Record<string, unknown>;
  const numeric = [
    'lengthFt',
    'heightFt',
    'widthFt',
    'grossWeightLbs',
    'axles',
    'tankGallons',
    'mpg',
  ];
  if (!numeric.every((k) => isPositiveFinite(truck[k]))) return false;
  // The fuel-planning fraction is a SHARE of tank range: beyond being
  // positive and finite it can never exceed 1, and a profile missing it
  // would hand downstream fuel planning an undefined.
  const fuel = truck.fuelSafetyFactor;
  if (!isPositiveFinite(fuel) || fuel > 1) return false;
  const hazmat = truck.hazmatClass;
  return hazmat === null || isText(hazmat, MAX_TEXT);
}

/** Cycle rules the engine accepts. An unknown rule is refused, never
 *  coerced: a 60-hour driver restored as a 70-hour one would be handed
 *  ten hours that do not exist. */
const CYCLE_RULES: readonly CycleRule[] = ['60/7', '70/8'];

/** Upper bound on the rolling on-duty array — the engine keeps one
 *  bucket per cycle day; anything longer is damage, not history. */
const MAX_DAY_BUCKETS = 16;

function isNonNegativeFinite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

/**
 * Validate a stored clock state. Strict for the same reason the route is
 * strict: these numbers are read as the driver's remaining legal time, so
 * a damaged snapshot must produce NO clocks (the screen falls back to a
 * fresh state it labels honestly) rather than plausible-looking garbage.
 */
export function parseClockState(v: unknown): ClockState | null {
  if (v === null || typeof v !== 'object') return null;
  const c = v as Record<string, unknown>;
  if (!isPositiveFinite(c.atMs) || !isPositiveFinite(c.dayBucketStartMs)) return null;
  if (!CYCLE_RULES.includes(c.cycleRule as CycleRule)) return null;
  if (!isNonNegativeFinite(c.drivingUsedMin)) return null;
  if (!isNonNegativeFinite(c.drivingSinceBreakMin)) return null;
  if (!isNonNegativeFinite(c.restStreakMin)) return null;
  // -1 is the engine's own "no window open" sentinel; anything else must
  // be a real elapsed count.
  const windowElapsedMin = c.windowElapsedMin;
  if (typeof windowElapsedMin !== 'number' || !Number.isFinite(windowElapsedMin)) return null;
  if (windowElapsedMin < 0 && windowElapsedMin !== -1) return null;
  const buckets = c.onDutyByDayMin;
  if (
    !Array.isArray(buckets) ||
    buckets.length === 0 ||
    buckets.length > MAX_DAY_BUCKETS ||
    !buckets.every(isNonNegativeFinite)
  ) {
    return null;
  }
  return {
    atMs: c.atMs,
    cycleRule: c.cycleRule as CycleRule,
    drivingUsedMin: c.drivingUsedMin,
    windowElapsedMin,
    drivingSinceBreakMin: c.drivingSinceBreakMin,
    restStreakMin: c.restStreakMin,
    onDutyByDayMin: buckets as number[],
    dayBucketStartMs: c.dayBucketStartMs,
  };
}

/** Serialize a snapshot. Pure: the caller supplies the clock and owns
 *  the storage write. */
export function serializeTripSnapshot(input: TripSnapshotInput): string {
  // The request is stored WITHOUT its origin: PilotTripControls builds
  // that origin from the live GPS fix, and fixes are never persisted.
  // parseTripSnapshot reconstructs a restore origin from the validated
  // route's first coordinate instead.
  const { origin: _origin, ...request } = input.request;
  return JSON.stringify({
    v: 1,
    savedAtMs: input.savedAtMs,
    route: input.route,
    request,
    destination: input.destination,
    ...(input.clocks === undefined ? {} : { clocks: input.clocks }),
  });
}

/**
 * Parse a stored snapshot back into a restorable trip. Strict: any
 * structural damage, any unknown enum value in a load-bearing position,
 * or any staleness returns null — never a partially-trusted trip. Never
 * throws. Optional enrichment (entrances) is filtered rather than fatal.
 */
export function parseTripSnapshot(raw: string | null, nowMs: number): RestorableTrip | null {
  if (raw === null || raw.length === 0) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (data === null || typeof data !== 'object') return null;
  const snap = data as Record<string, unknown>;
  if (snap.v !== 1) return null;

  const savedAtMs = snap.savedAtMs;
  if (typeof savedAtMs !== 'number' || !Number.isFinite(savedAtMs)) return null;
  const age = nowMs - savedAtMs;
  if (age > RESTORE_WINDOW_MS) return null; // too old to trust as live
  if (age < -RESTORE_FUTURE_SKEW_MS) return null; // clock went backwards

  // ---- route material ----------------------------------------------------
  const route = snap.route as Record<string, unknown> | null;
  if (route === null || typeof route !== 'object' || route.kind !== 'route') return null;
  if (!isText(route.routeId, MAX_ID) || route.routeId.length === 0) return null;
  if (!isPositiveFinite(route.distanceMiles) || !isPositiveFinite(route.durationSeconds)) {
    return null;
  }
  if (!isText(route.validationState, MAX_TEXT)) return null;
  const rawPositions = route.positions;
  if (
    !Array.isArray(rawPositions) ||
    rawPositions.length < 2 ||
    rawPositions.length > MAX_GEOMETRY_POINTS ||
    !rawPositions.every(isLatLng)
  ) {
    return null;
  }
  const positions = rawPositions as LatLng[];
  const rawManeuvers = Array.isArray(route.maneuvers) ? route.maneuvers : null;
  if (rawManeuvers === null || rawManeuvers.length > MAX_MANEUVERS) return null;
  const maneuvers: RouteMaterial['maneuvers'][number][] = [];
  for (const m of rawManeuvers as Record<string, unknown>[]) {
    if (m === null || typeof m !== 'object') return null;
    const offset = m.offset;
    if (
      typeof offset !== 'number' ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset >= positions.length
    ) {
      return null;
    }
    if (!isText(m.action, MAX_TEXT) || !isText(m.instruction, MAX_TEXT)) return null;
    if (!(m.direction === null || isText(m.direction, MAX_TEXT))) return null;
    maneuvers.push({
      action: m.action,
      instruction: m.instruction,
      direction: m.direction,
      offset,
    });
  }
  const rawWarnings = route.warnings === undefined ? [] : route.warnings;
  if (
    !Array.isArray(rawWarnings) ||
    rawWarnings.length > MAX_WARNINGS ||
    !rawWarnings.every((w) => isText(w, MAX_TEXT))
  ) {
    return null;
  }

  // ---- the plan request the material answered ----------------------------
  const request = snap.request as Record<string, unknown> | null;
  if (request === null || typeof request !== 'object') return null;
  // A stored origin is refused, never read: the serializer does not
  // write one (that origin is a raw GPS fix, and fixes are never
  // persisted), so its presence means the snapshot was not our write.
  // The restored origin is reconstructed below from the VALIDATED
  // route's first coordinate — the provider's road-snapped route start.
  if ('origin' in request) return null;
  if (!isLatLng(request.destination)) return null;
  if (!isTruck(request.truck)) return null;
  if (!isPositiveFinite(request.departAtMs)) return null;
  const avoid =
    request.avoid === undefined
      ? undefined
      : Array.isArray(request.avoid)
        ? (request.avoid.filter((a) =>
            AVOIDANCES.includes(a as RouteAvoidance),
          ) as RouteAvoidance[])
        : undefined;

  // ---- destination arrival context ---------------------------------------
  const destination = snap.destination as Record<string, unknown> | null;
  if (destination === null || typeof destination !== 'object') return null;
  if (!isLatLng(destination.position)) return null;
  const facility = FACILITIES.includes(destination.facility as DestinationFacility)
    ? (destination.facility as DestinationFacility)
    : 'unknown';
  const positionSource = POSITION_SOURCES.includes(
    destination.positionSource as DestinationInfo['positionSource'],
  )
    ? (destination.positionSource as DestinationInfo['positionSource'])
    : 'unknown';
  let entrances: DestinationInfo['entrances'];
  if (Array.isArray(destination.entrances)) {
    const kept = (destination.entrances as Record<string, unknown>[])
      .filter(
        (e) =>
          e !== null &&
          typeof e === 'object' &&
          isLatLng(e.position) &&
          ENTRANCE_KINDS.includes(e.kind as (typeof ENTRANCE_KINDS)[number]) &&
          (e.label === undefined || isText(e.label, MAX_TEXT)),
      )
      .slice(0, MAX_ENTRANCES);
    entrances = kept.map((e) => ({
      position: e.position as LatLng,
      kind: e.kind as 'verified' | 'reported',
      ...(e.label === undefined ? {} : { label: e.label as string }),
    }));
  }

  // Clocks are OPTIONAL and independently refusable: damaged clocks lose
  // the clocks, never the trip. The screen then shows a fresh state with
  // its existing provenance label rather than inventing a middle number.
  const clocks = snap.clocks === undefined ? undefined : parseClockState(snap.clocks);

  return {
    savedAtMs,
    ...(clocks === null || clocks === undefined ? {} : { clocks }),
    route: {
      kind: 'route',
      routeId: route.routeId,
      positions,
      distanceMiles: route.distanceMiles,
      durationSeconds: route.durationSeconds,
      maneuvers,
      validationState: route.validationState,
      warnings: rawWarnings as string[],
    },
    request: {
      origin: positions[0],
      destination: request.destination,
      truck: request.truck,
      ...(avoid === undefined ? {} : { avoid }),
      departAtMs: request.departAtMs,
    },
    destination: {
      position: destination.position,
      facility,
      positionSource,
      ...(entrances === undefined ? {} : { entrances }),
    },
  };
}

/**
 * A plan port that serves an armed restore payload INSTEAD of the
 * network, once, and delegates to the real port otherwise. The payload
 * is taken through a callback so the caller keeps ownership of arming
 * and disarming; a payload is consumed by exactly one plan() call.
 * `onRoute` observes every successful route this port hands out —
 * fresh plans and restores alike — which is what keeps the snapshot
 * current without a second capture path.
 */
export function createRestorablePlanPort(
  realPort: PlanPort,
  takeRestore: () => RouteMaterial | null,
  onRoute?: (req: PlanRequest, route: RouteMaterial) => void,
): PlanPort {
  return async (req: PlanRequest): Promise<PlanFetchResult> => {
    const restored = takeRestore();
    const result = restored ?? (await realPort(req));
    if (result.kind === 'route' && onRoute) onRoute(req, result);
    return result;
  };
}

/**
 * Wrap a lifecycle so every plan() call reports its request and
 * destination before delegating. The plan port cannot see the
 * DestinationInfo (arrival context travels beside the request, not in
 * it), and a restored trip restored WITHOUT it would silently lose the
 * facility's arrival radius and any known entrances — so it is captured
 * here, at the one place both values pass together.
 */
export function withPlanCapture(
  lifecycle: NavigationLifecycle,
  onPlan: (req: PlanRequest, destination: DestinationInfo) => void,
): NavigationLifecycle {
  return {
    ...lifecycle,
    plan(req, destination, tMs) {
      onPlan(req, destination);
      return lifecycle.plan(req, destination, tMs);
    },
  };
}
