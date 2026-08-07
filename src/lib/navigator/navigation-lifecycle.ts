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
};

export type NavigationLifecycle = {
  state(): LifecycleState;
  /** The driving-screen view for the CURRENT state (no-route when idle). */
  view(): DrivingView;
  snapshot(): LifecycleSnapshot;
  /** Read-only geometry/destination projection for the navigation map. */
  mapData(): MapData;
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
    const active = nav?.currentSession() ?? routeSession;
    const nextMi = lastView.maneuvers?.next?.mileMi ?? null;
    return {
      geometry: active === null ? [] : active.geometry.map((p) => ({ ...p.position })),
      destination: destinationInfo === null ? null : { ...destinationInfo.position },
      nextManeuver:
        active === null || nextMi === null ? null : positionAtRouteMile(active.geometry, nextMi),
      routeId: active === null ? null : active.routeId,
      durationSeconds: active === null ? null : active.durationSeconds,
    };
  }

  return {
    state: () => state,
    view: () => lastView,
    snapshot,
    mapData,
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
