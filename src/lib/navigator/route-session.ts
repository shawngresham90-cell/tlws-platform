/**
 * Navigation route session (milestone N8b) — the clean, IMMUTABLE object
 * that carries one validated route from the route API into the
 * navigation engine. A session is created exactly once from validated
 * inputs, deep-frozen, and handed to the controller; nothing downstream
 * can mutate shared route state, and the geometry a session carries is
 * the FULL provider geometry, not the planner's sampled points.
 *
 * Session handoff changes no navigation behavior: the controller,
 * tracker, and maneuver engine are consumed exactly as N5 built them —
 * they simply receive complete geometry and exact maneuver miles.
 *
 * Pure: ids and time arrive as arguments. No I/O, no clock.
 */

import type { LatLng } from '@/lib/map/bounds';
import type { TruckProfile } from '@/lib/trip-planner/types';
import type { HereManeuver } from '@/lib/trip-planner/here-routing';
import {
  geometryFingerprint,
  normalizeGeometry,
  validateGeometryEndpoints,
  type GeometryPoint,
  type GeometryProblem,
} from './route-geometry';
import { createRouteTracker, DENSIFY_MAX_POINTS, type RouteTracker } from './route-tracker';
import { createManeuverEngine, type ManeuverEngine } from './maneuver-engine';

/** Only these N8a verdicts may become a session. */
export type SessionEligibleState = 'valid' | 'valid-with-warning';

export type SessionManeuver = {
  action: string;
  instruction: string;
  direction: string | null;
  /** Exact route mile, resolved from the FULL-resolution geometry. */
  mileMi: number;
  /** Original geometry offset, kept for integrity checks. */
  offset: number;
};

export type RouteSession = Readonly<{
  routeId: string;
  truck: Readonly<TruckProfile>;
  origin: Readonly<LatLng>;
  destination: Readonly<LatLng>;
  /** Full-resolution geometry with cumulative route miles. */
  geometry: readonly Readonly<GeometryPoint>[];
  maneuvers: readonly Readonly<SessionManeuver>[];
  distanceMiles: number;
  durationSeconds: number;
  validationState: SessionEligibleState;
  warnings: readonly string[];
  /** Integrity fingerprint of the geometry at creation time. */
  geometryFingerprint: string;
}>;

export type CreateSessionInput = {
  routeId: string;
  truck: TruckProfile;
  origin: LatLng;
  destination: LatLng;
  /** Raw decoded provider positions (full resolution). */
  positions: readonly LatLng[];
  distanceMiles: number;
  durationSeconds: number;
  maneuvers: readonly {
    action: string;
    instruction: string;
    direction: string | null;
    offset: number;
  }[];
  /** The N8a route verdict for this route. */
  validationState: string;
  warnings?: readonly string[];
};

export type CreateSessionResult =
  | { ok: true; session: RouteSession }
  | { ok: false; problems: GeometryProblem[] };

function deepFreezeSession(session: RouteSession): RouteSession {
  Object.freeze(session.truck);
  Object.freeze(session.origin);
  Object.freeze(session.destination);
  for (const p of session.geometry) {
    Object.freeze(p.position);
    Object.freeze(p);
  }
  Object.freeze(session.geometry);
  for (const m of session.maneuvers) Object.freeze(m);
  Object.freeze(session.maneuvers);
  Object.freeze(session.warnings);
  return Object.freeze(session);
}

/**
 * Create the immutable session, or refuse with structured problems.
 * Refusals: an ineligible validation state (a `requires-review` or
 * `rejected` route can NEVER become a session), any geometry
 * normalization/validation failure, or a maneuver pointing outside the
 * geometry.
 */
export function createRouteSession(input: CreateSessionInput): CreateSessionResult {
  if (input.validationState !== 'valid' && input.validationState !== 'valid-with-warning') {
    return {
      ok: false,
      problems: [
        {
          code: 'ineligible-state',
          message: `A '${input.validationState}' route cannot start a navigation session.`,
        },
      ],
    };
  }
  if (typeof input.routeId !== 'string' || input.routeId.trim() === '') {
    return {
      ok: false,
      problems: [{ code: 'missing-route-id', message: 'A session requires a route id.' }],
    };
  }

  const normalized = normalizeGeometry(input.positions, input.distanceMiles);
  if (normalized.problems.length > 0) return { ok: false, problems: normalized.problems };
  const endpointProblems = validateGeometryEndpoints(
    normalized.points,
    input.origin,
    input.destination,
  );
  if (endpointProblems.length > 0) return { ok: false, problems: endpointProblems };
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0) {
    return {
      ok: false,
      problems: [{ code: 'invalid-duration', message: 'Route duration must be positive.' }],
    };
  }

  // Resolve every maneuver to its exact route mile via the FULL geometry.
  // Provider offsets index the ORIGINAL decoded array; normalization may
  // drop duplicate points, so offsets are remapped through the
  // normalizer's index map first. Anything out of bounds after that is
  // corruption, not sloppiness — refuse the session.
  const maneuvers: SessionManeuver[] = [];
  for (const [i, m] of input.maneuvers.entries()) {
    if (!Number.isInteger(m.offset) || m.offset < 0 || m.offset >= normalized.indexMap.length) {
      return {
        ok: false,
        problems: [
          {
            code: 'maneuver-outside-geometry',
            message: `Maneuver ${i + 1} points outside the route geometry.`,
          },
        ],
      };
    }
    const mapped = normalized.indexMap[m.offset];
    if (!Number.isInteger(mapped) || mapped < 0 || mapped >= normalized.points.length) {
      return {
        ok: false,
        problems: [
          {
            code: 'maneuver-outside-geometry',
            message: `Maneuver ${i + 1} points outside the normalized geometry.`,
          },
        ],
      };
    }
    maneuvers.push({
      action: m.action,
      instruction: m.instruction,
      direction: m.direction,
      mileMi: normalized.points[mapped].routeMile,
      offset: mapped,
    });
  }

  const session: RouteSession = {
    routeId: input.routeId,
    truck: { ...input.truck },
    origin: { ...input.origin },
    destination: { ...input.destination },
    geometry: normalized.points,
    maneuvers,
    distanceMiles: Number(input.distanceMiles.toFixed(1)),
    durationSeconds: Math.round(input.durationSeconds),
    validationState: input.validationState,
    warnings: [...(input.warnings ?? [])],
    geometryFingerprint: geometryFingerprint(normalized.points),
  };
  return { ok: true, session: deepFreezeSession(session) };
}

/**
 * Memory bound for the tracker handoff, aligned with the tracker's own
 * densification bound: above it, points are thinned DETERMINISTICALLY
 * (every k-th, endpoints always kept). Thinning affects only tracking
 * resolution — never the session's stored geometry, never maneuver
 * miles, which were resolved from the full array first.
 */
export const TRACKER_HANDOFF_MAX_POINTS = DENSIFY_MAX_POINTS;

/** Deterministic every-k-th thinning that always keeps both endpoints. */
export function thinForTracker(points: readonly GeometryPoint[]): GeometryPoint[] {
  if (points.length <= TRACKER_HANDOFF_MAX_POINTS) return points.slice();
  const k = Math.ceil(points.length / TRACKER_HANDOFF_MAX_POINTS);
  const out: GeometryPoint[] = [];
  for (let i = 0; i < points.length; i += k) out.push(points[i]);
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}

export type ControllerRoute = {
  tracker: RouteTracker;
  engine: ManeuverEngine;
  totalMi: number;
};

/**
 * The handoff: build the EXISTING controller inputs (N5's tracker +
 * maneuver engine, unchanged) from a session. The maneuver engine
 * receives the full-resolution cumulative-mile array, so every maneuver
 * lands on its exact mile; the tracker receives the complete geometry
 * (thinned only above the memory bound).
 */
export function sessionToControllerRoute(session: RouteSession): ControllerRoute {
  const positionMiles = session.geometry.map((p) => p.routeMile);
  const engineManeuvers: HereManeuver[] = session.maneuvers.map((m) => ({
    action: m.action,
    instruction: m.instruction,
    direction: m.direction,
    severity: null,
    offset: m.offset,
    lengthM: null,
    durationS: null,
  }));
  return {
    tracker: createRouteTracker(thinForTracker(session.geometry)),
    engine: createManeuverEngine(engineManeuvers, positionMiles),
    totalMi: session.distanceMiles,
  };
}
