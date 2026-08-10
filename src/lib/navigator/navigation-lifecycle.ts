/**
 * Navigation lifecycle orchestrator (milestone P1 — Navigator Integration
 * & Pilot Readiness). NO new navigation behavior lives here: this module
 * only CONNECTS the finished engines — route planning (N8a/N8b via an
 * injected port), the composed navigation session (N8c matcher → N8d
 * detector → N8e caged rerouter → N8f arrival), and the N5 driving-screen
 * controller — into one explicit, auditable trip lifecycle:
 *
 *   idle → planning → route-ready → navigating ⇄ off-route → rerouting
 *        → final-approach → arrived → completed → idle
 *
 * Every state change goes through ONE transition function that consults
 * an explicit legality table. An illegal transition is REFUSED (state
 * unchanged) and recorded as a violation — the machine can never be
 * driven into an invalid sequence, and the integration harness asserts
 * the violation list stays empty across every scenario.
 *
 * Completion discipline: `completed` means every engine reference —
 * navigation session (which itself nulled matcher/detector/rerouter/
 * arrival), driving-screen controller, route session — has been released.
 * `resourcesReleased()` makes that observable, not asserted on faith.
 *
 * Pure: ports injected, every timestamp arrives as an argument. No I/O,
 * no clock, no timers (the component layer owns cadence, exactly as N5
 * established).
 */

import type { LatLng } from '@/lib/map/bounds';
import type { TruckProfile } from '@/lib/trip-planner/types';
import type { RouteAvoidance } from '@/lib/trip-planner/providers';
import type { PositionState } from './types';
import {
  createNavigationSession,
  type NavigationSession,
  type NavigationSnapshot,
  type NavigationSessionConfig,
} from './navigation-session';
import { createRouteSession, sessionToControllerRoute, type RouteSession } from './route-session';
import {
  createNavigationController,
  type NavigationController,
  type DrivingView,
} from './navigation-controller';
import type { ReplacementPort, RerouteResult } from './reroute-controller';
import type { DestinationInfo } from './truck-entrance';
import type { TripSummary } from './arrival-controller';
import type { PilotLog } from './pilot-mode';
import { positionAtRouteMile } from './map-view';

export type LifecycleState =
  | 'idle'
  | 'planning'
  | 'route-ready'
  | 'navigating'
  | 'off-route'
  | 'rerouting'
  | 'final-approach'
  | 'arrived'
  | 'completed';

/**
 * The complete legal-transition table. Anything not listed is invalid and
 * will be refused. Notes on the less obvious edges:
 * - planning → idle: plan failed, was rejected, or was cancelled.
 * - route-ready → idle: the driver discarded the route before starting.
 * - off-route ⇄ final-approach: the detector can confirm inside the
 *   approach window, and the arrival window can open while confirmed.
 * - rerouting → off-route | navigating | final-approach | arrived: a
 *   refused or failed reroute falls back to whatever the engines
 *   currently say — and ticks keep feeding the engines while the
 *   replacement request is in flight, so arrival can complete under it.
 * - anything active → completed: cancellation is always available.
 */
export const LIFECYCLE_TRANSITIONS: Readonly<Record<LifecycleState, readonly LifecycleState[]>> = {
  idle: ['planning'],
  planning: ['route-ready', 'idle'],
  'route-ready': ['navigating', 'idle'],
  navigating: ['off-route', 'final-approach', 'completed'],
  'off-route': ['rerouting', 'navigating', 'final-approach', 'completed'],
  rerouting: ['navigating', 'off-route', 'final-approach', 'arrived', 'completed'],
  'final-approach': ['arrived', 'navigating', 'off-route', 'completed'],
  arrived: ['completed'],
  completed: ['idle'],
};

export type LifecycleTransition = Readonly<{
  from: LifecycleState;
  to: LifecycleState;
  tMs: number;
  cause: string;
}>;

/* --------------------------------------------------------------- ports */

/** What the plan port must return: N8a-validated route material, the same
 *  shape the reroute controller's replacement port uses, plus the id. */
export type PlanFetchResult =
  | {
      kind: 'route';
      routeId: string;
      positions: readonly LatLng[];
      distanceMiles: number;
      durationSeconds: number;
      maneuvers: readonly {
        action: string;
        instruction: string;
        direction: string | null;
        offset: number;
      }[];
      validationState: string;
      warnings?: readonly string[];
    }
  | { kind: 'failure'; reason: string };

export type PlanRequest = {
  origin: LatLng;
  destination: LatLng;
  truck: TruckProfile;
  avoid?: readonly RouteAvoidance[];
  departAtMs: number;
};

export type PlanPort = (req: PlanRequest) => Promise<PlanFetchResult>;

export type PlanOutcome =
  | { ok: true; session: RouteSession }
  | { ok: false; reason: string; refused: boolean };

/* ---------------------------------------------------------------- views */

export type LifecycleSnapshot = {
  state: LifecycleState;
  view: DrivingView;
  navigation: NavigationSnapshot | null;
  summary: TripSummary | null;
  routeId: string | null;
};

/**
 * Everything the navigation MAP needs, and nothing else (pilot round 1).
 * Read-only projection of the live session: no engine reference escapes,
 * so a map can never advance, replace, or mutate a route.
 */
export type MapData = {
  /** Route line, in order. Empty when no route is loaded. */
  geometry: readonly LatLng[];
  /** Where the trip ends — the map's destination marker. */
  destination: LatLng | null;
  /** Where the next maneuver happens, for its marker. Null when none. */
  nextManeuver: LatLng | null;
  /** Identity of the CURRENT route: changes on every replacement. */
  routeId: string | null;
  /** Provider's planned duration for the CURRENT route — the ETA basis. */
  durationSeconds: number | null;
  /**
   * Where the MATCHER says the truck is on the route line, when it is
   * confident enough to say. Null whenever it is not.
   *
   * Road test: the marker was visibly beside Hwy 92 rather than on it.
   * The map was drawing the raw fix, and a raw fix carries the platform's
   * error — eight to fifteen metres on a good day, which at map zoom is
   * a lane or two of displacement. The matcher already computes where
   * that fix corresponds to on the road; it was simply never shown.
   *
   * This is NOT snapping-to-route. It is offered only when the match is
   * confident and genuinely close to the line; when the match is doubtful
   * the value is null and the caller draws the honest raw position,
   * because a marker glued to a road the truck may have left is a lie
   * that hides exactly the situation the driver most needs to see.
   */
  matchedPosition: LatLng | null;
};

/**
 * Everything the pre-drive BRIEFING needs, and nothing else (design
 * blueprint Phase 3). Same construction rule as MapData: plain frozen
 * copies, no engine reference escapes, so a briefing can never advance,
 * replace, or mutate a route. The truck is the profile the plan request
 * actually carried; the maneuvers are the provider's own instructions at
 * their exact route miles (corridor source material — never geometry
 * guessing); the warnings are whatever the validator let through as
 * `valid-with-warning`.
 */
export type RouteBrief = Readonly<{
  truck: Readonly<TruckProfile>;
  maneuvers: readonly Readonly<{ instruction: string; mileMi: number }>[];
  warnings: readonly string[];
  distanceMiles: number;
  durationSeconds: number;
}>;

export type NavigationLifecycle = {
  state(): LifecycleState;
  /** The driving-screen view for the CURRENT state (no-route when idle). */
  view(): DrivingView;
  snapshot(): LifecycleSnapshot;
  /** Read-only geometry/destination projection for the navigation map. */
  mapData(): MapData;
  /** Read-only briefing projection for the CURRENT route; null without one. */
  routeBrief(): RouteBrief | null;
  /** idle → planning → route-ready | idle. Refused outside idle. */
  plan(req: PlanRequest, destination: DestinationInfo, tMs: number): Promise<PlanOutcome>;
  /** route-ready → navigating. Builds the full engine stack. */
  startNavigation(tMs: number): boolean;
  /** route-ready → idle without starting. */
  discardRoute(tMs: number): boolean;
  /** Feed one gated position update; derives navigating/off-route/
   *  final-approach/arrived from the engines. Inert outside a trip. */
  tick(position: PositionState, tMs: number): LifecycleSnapshot;
  /** off-route → rerouting → (navigating | off-route | …). The caged N8e
   *  controller does all spending decisions; this only sequences states. */
  requestReroute(
    tMs: number,
    accuracyM: number | null,
  ): Promise<RerouteResult | { outcome: 'not-eligible' }>;
  /** Cancel from any active state. Returns the honest summary, or null
   *  when there was nothing to cancel. */
  cancel(tMs: number): TripSummary | null;
  /** arrived → completed: acknowledge the finished trip, release engines. */
  complete(tMs: number): boolean;
  /** completed → idle: ready for the next trip. */
  reset(tMs: number): boolean;
  transitions(): readonly LifecycleTransition[];
  /** Refused-transition audit trail — must stay EMPTY in every scenario. */
  violations(): readonly string[];
  summary(): TripSummary | null;
  /** True when no engine references survive (completed or idle). */
  resourcesReleased(): boolean;
};

export type LifecycleDeps = {
  planPort: PlanPort;
  replacementPort: ReplacementPort;
  log?: PilotLog;
  sessionConfig?: NavigationSessionConfig;
};

const NO_ROUTE_VIEW: DrivingView = Object.freeze({
  status: 'no-route',
  routeMile: null,
  totalMi: null,
  remainingMi: null,
  maneuvers: null,
  lastKnown: false,
  speedMph: null,
});

/**
 * Transition-log bound. Generous — a single trip spends about seven
 * entries, so this holds roughly seventy consecutive trips — but finite,
 * because the lifecycle can outlive many trips in one mounted screen.
 */
export const MAX_TRANSITION_LOG = 500;

/**
 * How far off the line a HIGH-confidence match may still be and have the
 * marker drawn on the road.
 *
 * Deliberately tighter than the matcher's own high-confidence bound: this
 * governs what the driver SEES, and moving the marker further than a lane
 * or two would be inventing a position rather than resolving GPS error.
 */
export const MATCHED_DISPLAY_LATERAL_M = 20;

/** States in which the engine stack is live and ticks feed it. */
const ACTIVE_STATES: readonly LifecycleState[] = [
  'navigating',
  'off-route',
  'rerouting',
  'final-approach',
];

export function createNavigationLifecycle(deps: LifecycleDeps): NavigationLifecycle {
  let state: LifecycleState = 'idle';
  let routeSession: RouteSession | null = null;
  let destinationInfo: DestinationInfo | null = null;
  let nav: NavigationSession | null = null;
  let controller: NavigationController | null = null;
  let lastView: DrivingView = NO_ROUTE_VIEW;
  let lastNavSnapshot: NavigationSnapshot | null = null;
  let finalSummary: TripSummary | null = null;
  let planSeq = 0;
  // Idempotency on the same input REFERENCE (the N5 controller's rule):
  // React can evaluate a render twice with the identical PositionState
  // object; without this guard the matcher/detector/arrival stack would
  // ingest the same fix twice and double-count its evidence.
  let lastTickInput: PositionState | null = null;
  // The map's copy of the route line, kept per ROUTE rather than per call
  // (see mapData). Cleared with the engines.
  let mapGeometryCache: { source: RouteSession; geometry: readonly LatLng[] } | null = null;

  const transitionLog: LifecycleTransition[] = [];
  const violationLog: string[] = [];

  // TS control-flow analysis cannot see `transition()` mutating `state`
  // through the closure; post-await checks read through this helper so
  // the comparison is against the real, un-narrowed value.
  const currentState = (): LifecycleState => state;

  function transition(to: LifecycleState, tMs: number, cause: string): boolean {
    if (!LIFECYCLE_TRANSITIONS[state].includes(to)) {
      violationLog.push(`illegal transition ${state} -> ${to} (${cause})`);
      deps.log?.record(tMs, `transition-refused:${state}>${to}`, cause);
      return false;
    }
    const from = state;
    state = to;
    transitionLog.push(Object.freeze({ from, to, tMs, cause }));
    // A trip costs a handful of transitions; a lifecycle that survives a
    // day of trips would otherwise grow this forever. Bounded like the
    // detector's own event log, oldest dropped first. `violationLog` is
    // deliberately NOT bounded — it must stay empty, so anything in it
    // is worth keeping in full.
    if (transitionLog.length > MAX_TRANSITION_LOG) transitionLog.shift();
    deps.log?.record(tMs, `transition:${from}>${to}`, cause);
    return true;
  }

  /** Release every engine reference. The navigation session has already
   *  nulled its own internals on completion; this drops the last handles
   *  so a completed lifecycle holds nothing but the frozen summary. */
  function releaseEngines(): void {
    nav = null;
    controller = null;
    routeSession = null;
    destinationInfo = null;
    lastNavSnapshot = null;
    lastView = NO_ROUTE_VIEW;
    // The de-duplication guard has to go too, for two separate reasons.
    // It holds the driver's last position after the trip is over, which
    // AD-7 says must not outlive the session; and a trip that starts
    // before the GPS layer has published a NEW state object would have
    // its first tick swallowed as a duplicate of the previous trip's
    // last one — the new trip's engines would sit at mile zero until the
    // next fix landed.
    lastTickInput = null;
    mapGeometryCache = null;
  }

  function snapshot(): LifecycleSnapshot {
    return {
      state,
      view: lastView,
      navigation: lastNavSnapshot,
      summary: finalSummary,
      routeId: lastNavSnapshot?.routeId ?? routeSession?.routeId ?? null,
    };
  }

  /** Map the engines' truth onto the lifecycle vocabulary. Only called
   *  while the stack is live; arrival phases outrank the detector (a
   *  truck creeping toward its gate is not "off route"). */
  function deriveEngineState(snap: NavigationSnapshot): LifecycleState {
    if (!snap.active && snap.summary !== null) {
      return snap.summary.endReason === 'cancelled' ? 'completed' : 'arrived';
    }
    const arrivalState = snap.arrival?.state ?? 'en-route';
    if (arrivalState === 'final-approach' || arrivalState === 'arrival-candidate') {
      return 'final-approach';
    }
    if (snap.detector?.state === 'confirmed') return 'off-route';
    return 'navigating';
  }

  async function plan(
    req: PlanRequest,
    destination: DestinationInfo,
    tMs: number,
  ): Promise<PlanOutcome> {
    if (state !== 'idle') {
      return { ok: false, reason: `cannot plan while '${state}'`, refused: true };
    }
    transition('planning', tMs, 'plan-requested');
    planSeq += 1;
    const mySeq = planSeq;

    let fetched: PlanFetchResult;
    try {
      fetched = await deps.planPort(req);
    } catch {
      fetched = { kind: 'failure', reason: 'plan-port-threw' };
    }

    // A cancel/reset while the request was in flight wins; the stale
    // response is dropped without touching state.
    if (planSeq !== mySeq || currentState() !== 'planning') {
      return { ok: false, reason: 'superseded', refused: false };
    }

    if (fetched.kind === 'failure') {
      transition('idle', tMs, `plan-failed:${fetched.reason}`);
      return { ok: false, reason: fetched.reason, refused: false };
    }

    const made = createRouteSession({
      routeId: fetched.routeId,
      truck: req.truck,
      origin: req.origin,
      destination: req.destination,
      positions: fetched.positions,
      distanceMiles: fetched.distanceMiles,
      durationSeconds: fetched.durationSeconds,
      maneuvers: fetched.maneuvers,
      avoid: req.avoid ?? [],
      validationState: fetched.validationState,
      warnings: fetched.warnings,
    });
    if (!made.ok) {
      const reason = made.problems.map((p) => p.code).join(',');
      transition('idle', tMs, `route-refused:${reason}`);
      return { ok: false, reason, refused: false };
    }

    routeSession = made.session;
    destinationInfo = destination;
    transition('route-ready', tMs, 'route-validated');
    return { ok: true, session: made.session };
  }

  // Guarded entry points refuse cleanly (return false / refused:true)
  // BEFORE any transition is attempted — a refused REQUEST is correct
  // behavior, not a machine violation. `violations()` records only
  // internally attempted illegal transitions, which must never happen.
  function startNavigation(tMs: number): boolean {
    if (state !== 'route-ready' || routeSession === null || destinationInfo === null) {
      return false;
    }
    nav = createNavigationSession(
      routeSession,
      destinationInfo,
      deps.replacementPort,
      deps.sessionConfig,
    );
    controller = createNavigationController(sessionToControllerRoute(routeSession));
    lastView = controller.view();
    return transition('navigating', tMs, 'navigation-started');
  }

  function discardRoute(tMs: number): boolean {
    if (state !== 'route-ready') return false;
    routeSession = null;
    destinationInfo = null;
    return transition('idle', tMs, 'route-discarded');
  }

  function tick(position: PositionState, tMs: number): LifecycleSnapshot {
    if (!ACTIVE_STATES.includes(state) || nav === null || controller === null) {
      return snapshot(); // idle/planning/route-ready/arrived/completed: inert
    }
    if (position === lastTickInput) return snapshot();
    lastTickInput = position;

    lastView = controller.update(position);

    if (position.fix !== null && (position.health === 'good' || position.health === 'degraded')) {
      lastNavSnapshot = nav.ingest({
        position: { lat: position.fix.lat, lng: position.fix.lng },
        headingDeg: position.headingDeg,
        speedMph: position.speedMph,
        accuracyM: position.fix.accuracyM,
        tMs: position.fix.tMs,
      });
    }

    // A replacement fetch that opens a socket and then stalls — an
    // ordinary thing on a mobile connection — never settles its promise,
    // so `requestReroute` is still awaiting it and the lifecycle would
    // hold 'rerouting' for the rest of the trip: the screen says
    // "rerouting" forever and no later reroute can ever be attempted.
    // The reroute controller already knows how to retire an overdue
    // request; it just cannot be reached from inside the await. Ticks
    // can. When one is retired we land wherever the engines honestly
    // are, and the stale response is dropped when it eventually arrives.
    if (state === 'rerouting' && nav.expireInFlight(tMs)) {
      const derived = lastNavSnapshot === null ? 'navigating' : deriveEngineState(lastNavSnapshot);
      transition(derived, tMs, 'reroute-timed-out');
    }

    // While a reroute is in flight the lifecycle holds 'rerouting';
    // requestReroute() derives the landing state when it resolves.
    if (state !== 'rerouting' && lastNavSnapshot !== null) {
      const derived = deriveEngineState(lastNavSnapshot);
      if (derived !== state) {
        if (derived === 'arrived' || derived === 'completed') {
          finalSummary = lastNavSnapshot.summary;
        }
        transition(derived, tMs, 'engine-derived');
      }
    }
    return snapshot();
  }

  async function requestReroute(
    tMs: number,
    accuracyM: number | null,
  ): Promise<RerouteResult | { outcome: 'not-eligible' }> {
    if (state !== 'off-route' || nav === null) return { outcome: 'not-eligible' };
    transition('rerouting', tMs, 'reroute-requested');

    const result = await nav.maybeReroute(tMs, accuracyM);

    if (currentState() !== 'rerouting') {
      // Cancelled (or otherwise moved on) while in flight — the session
      // layer already refused or dropped the stale result.
      return result;
    }

    if (result.outcome === 'replaced') {
      routeSession = result.session;
      controller = createNavigationController(sessionToControllerRoute(result.session));
      lastView = controller.view(); // the view switches routes immediately
      lastNavSnapshot = nav.snapshot();
      transition('navigating', tMs, 'route-replaced');
      return result;
    }

    // Refused / rejected / failed / not eligible: the current route stands.
    // Land wherever the engines honestly are right now.
    const derived = lastNavSnapshot === null ? 'navigating' : deriveEngineState(lastNavSnapshot);
    if (derived === 'arrived' || derived === 'completed') {
      finalSummary = lastNavSnapshot?.summary ?? finalSummary;
    }
    transition(derived, tMs, `reroute-${result.outcome}`);
    return result;
  }

  function cancel(tMs: number): TripSummary | null {
    if (state === 'idle' || state === 'completed') return null;
    if (state === 'planning') {
      planSeq += 1; // invalidate the in-flight plan
      transition('idle', tMs, 'plan-cancelled');
      return null;
    }
    if (state === 'route-ready') {
      routeSession = null;
      destinationInfo = null;
      transition('idle', tMs, 'route-discarded');
      return null;
    }
    if (state === 'arrived') {
      // The trip already ended honestly; cancel just acknowledges it.
      const s = finalSummary;
      transition('completed', tMs, 'acknowledged');
      releaseEngines();
      return s;
    }
    const summary = nav === null ? null : nav.cancel(tMs);
    finalSummary = summary ?? finalSummary;
    transition('completed', tMs, 'cancelled');
    releaseEngines();
    return summary;
  }

  function complete(tMs: number): boolean {
    if (state !== 'arrived') return false;
    const ok = transition('completed', tMs, 'trip-completed');
    if (ok) releaseEngines();
    return ok;
  }

  function reset(tMs: number): boolean {
    if (state !== 'completed') return false;
    finalSummary = null;
    return transition('idle', tMs, 'reset');
  }

  function mapData(): MapData {
    // Prefer the engine's CURRENT session so a replacement route draws the
    // moment it lands; fall back to the planned session before navigation
    // starts. Positions are copied — the caller cannot reach into the
    // frozen session geometry.
    //
    // The copy is made ONCE PER ROUTE, not once per call. The driving
    // screen recomputes this on every accepted fix — once a second, for
    // hours — and at full provider resolution a long haul carries tens of
    // thousands of points, so copying per call meant tens of thousands of
    // allocations a second thrown away immediately (the map redraws only
    // when the route id changes). Measured at 20,000 points: 1.7 ms per
    // call on a desktop CPU, a second of CPU per ten minutes of driving,
    // before any phone penalty. Route identity is the cache key because a
    // session's geometry is immutable — a replacement route is a
    // different object, and that is exactly when the copy must be redone.
    const active = nav?.currentSession() ?? routeSession;
    if (active === null) {
      mapGeometryCache = null;
    } else if (mapGeometryCache === null || mapGeometryCache.source !== active) {
      mapGeometryCache = {
        source: active,
        geometry: Object.freeze(active.geometry.map((p) => Object.freeze({ ...p.position }))),
      };
    }
    const nextMi = lastView.maneuvers?.next?.mileMi ?? null;
    /*
     * Confident AND close: 'high' means the matcher liked the lateral
     * distance, the heading and the progression together, and the extra
     * lateral bound keeps a high-confidence match on a parallel frontage
     * road from dragging the marker across to the highway. Anything less
     * draws raw.
     */
    const m = lastNavSnapshot?.match ?? null;
    const matchedPosition =
      active !== null &&
      m !== null &&
      m.matched &&
      m.confidence === 'high' &&
      m.routeMile !== null &&
      m.lateralM !== null &&
      m.lateralM <= MATCHED_DISPLAY_LATERAL_M
        ? positionAtRouteMile(active.geometry, m.routeMile)
        : null;
    return {
      matchedPosition,
      geometry: mapGeometryCache?.geometry ?? [],
      destination: destinationInfo === null ? null : { ...destinationInfo.position },
      nextManeuver:
        active === null || nextMi === null ? null : positionAtRouteMile(active.geometry, nextMi),
      routeId: active === null ? null : active.routeId,
      durationSeconds: active === null ? null : active.durationSeconds,
    };
  }

  /**
   * The briefing projection (design blueprint Phase 3). Resolves the
   * current session exactly the way mapData does, and hands out plain
   * frozen copies only — the briefing reads the route, it can never
   * touch it.
   */
  function routeBrief(): RouteBrief | null {
    const active = nav?.currentSession() ?? routeSession;
    if (active === null) return null;
    return Object.freeze({
      truck: Object.freeze({ ...active.truck }),
      maneuvers: Object.freeze(
        active.maneuvers.map((m) =>
          Object.freeze({ instruction: m.instruction, mileMi: m.mileMi }),
        ),
      ),
      warnings: Object.freeze(active.warnings.slice()),
      distanceMiles: active.distanceMiles,
      durationSeconds: active.durationSeconds,
    });
  }

  return {
    state: () => state,
    view: () => lastView,
    snapshot,
    mapData,
    routeBrief,
    plan,
    startNavigation,
    discardRoute,
    tick,
    requestReroute,
    cancel,
    complete,
    reset,
    transitions: () => transitionLog.slice(),
    violations: () => violationLog.slice(),
    summary: () => finalSummary,
    resourcesReleased: () =>
      nav === null && controller === null && routeSession === null && lastNavSnapshot === null,
  };
}
