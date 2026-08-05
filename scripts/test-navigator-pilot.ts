/**
 * P1 — Navigator Integration & Pilot Readiness. Integration harness for
 * the complete navigation lifecycle: destination → plan (injected port,
 * N8a/N8b-shaped material) → immutable route session → navigation start →
 * REAL matcher → REAL detector → REAL caged rerouter → REAL arrival →
 * completion — driven through the ONE lifecycle orchestrator the driving
 * screen uses, with the transition-legality table enforced on every
 * recorded move and the violation audit required to stay empty.
 *
 * Scenarios (per the P1 block): full navigation lifecycle, reroute
 * lifecycle, arrival lifecycle, cancellation, GPS loss, long sessions,
 * repeated reroutes, cleanup after arrival — plus Pilot Mode resolution,
 * the coordinate-redacting pilot log, and structural source checks on the
 * component wiring. Performance and memory are MEASURED (run under
 * node --expose-gc), never invented.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-pilot.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-navigator-pilot.cjs \
 *   && node --expose-gc /tmp/test-navigator-pilot.cjs
 */
import { readFileSync } from 'node:fs';
import {
  createNavigationLifecycle,
  LIFECYCLE_TRANSITIONS,
  type LifecycleState,
  type NavigationLifecycle,
  type PlanFetchResult,
  type PlanPort,
  type PlanRequest,
} from '@/lib/navigator/navigation-lifecycle';
import {
  createPilotLog,
  redactCoordinates,
  resolvePilotMode,
  PILOT_LOG_MAX_ENTRIES,
} from '@/lib/navigator/pilot-mode';
import type {
  ReplacementFetchResult,
  ReplacementRequest,
} from '@/lib/navigator/reroute-controller';
import type { DestinationInfo } from '@/lib/navigator/truck-entrance';
import type { PositionState } from '@/lib/navigator/types';
import type { NavigationSessionConfig } from '@/lib/navigator/navigation-session';
import type { LatLng } from '@/lib/map/bounds';
import type { TruckProfile } from '@/lib/trip-planner/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

/* ---------------------------------------------------------------- fixtures */

const T0 = 1_754_000_000_000;
const LAT0 = 35;
const LNG0 = -85;
const MI_PER_STEP = 0.0690937; // 0.001° latitude
const N_POINTS = 1000;
const TOTAL_MI = Number(((N_POINTS - 1) * MI_PER_STEP).toFixed(1)); // 69.0

const TRUCK: TruckProfile = {
  lengthFt: 70,
  heightFt: 13.5,
  widthFt: 8.5,
  grossWeightLbs: 80_000,
  axles: 5,
  hazmatClass: null,
  tankGallons: 200,
  mpg: 6.5,
  fuelSafetyFactor: 0.75,
};

function line(n: number, startLat = LAT0): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i < n; i++) out.push({ lat: startLat + i * 0.001, lng: LNG0 });
  return out;
}
const LINE = line(N_POINTS);
const DEST = LINE[N_POINTS - 1];

const VERIFIED_DEST: DestinationInfo = {
  position: DEST,
  facility: 'warehouse',
  positionSource: 'geocode',
  entrances: [{ position: DEST, kind: 'verified', label: 'Gate 1' }],
};

function goodPlan(): PlanFetchResult {
  return {
    kind: 'route',
    routeId: 'nav-pilot-1',
    positions: LINE,
    distanceMiles: TOTAL_MI,
    durationSeconds: 4200,
    maneuvers: [
      { action: 'depart', instruction: 'Go.', direction: null, offset: 0 },
      { action: 'turn', instruction: 'Keep straight.', direction: 'left', offset: 500 },
      { action: 'arrive', instruction: 'Arrive.', direction: null, offset: N_POINTS - 1 },
    ],
    validationState: 'valid',
    warnings: [],
  };
}

/** Replacement: the remaining vertical line from the truck's latitude to
 *  the destination — geometry starts within meters of the request origin,
 *  so it passes the session's endpoint validation like a real route. */
function verticalReplacement(req: ReplacementRequest): ReplacementFetchResult {
  const startIdx = Math.max(0, Math.min(N_POINTS - 2, Math.round((req.origin.lat - LAT0) / 0.001)));
  const positions = LINE.slice(startIdx);
  return {
    kind: 'route',
    positions,
    distanceMiles: Number(((positions.length - 1) * MI_PER_STEP).toFixed(1)),
    durationSeconds: Math.max(60, Math.round(positions.length * 4)),
    maneuvers: [
      { action: 'depart', instruction: 'Rejoin the route.', direction: null, offset: 0 },
      { action: 'arrive', instruction: 'Arrive.', direction: null, offset: positions.length - 1 },
    ],
    validationState: 'valid',
    warnings: [],
  };
}

const PLAN_REQ: PlanRequest = {
  origin: LINE[0],
  destination: DEST,
  truck: TRUCK,
  departAtMs: T0,
};

function pos(
  lat: number,
  lng: number,
  tMs: number,
  speedMph: number | null,
  over: Partial<PositionState> = {},
): PositionState {
  return {
    fix: { lat, lng, accuracyM: 8, tMs, speedMph, headingDeg: 0 },
    health: 'good',
    lastFixMs: tMs,
    accuracyM: 8,
    speedMph,
    headingDeg: 0,
    deadReckoning: false,
    ...over,
  };
}

type Rig = {
  lc: NavigationLifecycle;
  planCalls: () => number;
  replacementCalls: () => number;
};

function makeRig(opts: {
  plan?: (req: PlanRequest, call: number) => PlanFetchResult | Promise<PlanFetchResult>;
  replacement?: (
    req: ReplacementRequest,
    call: number,
  ) => ReplacementFetchResult | Promise<ReplacementFetchResult>;
  sessionConfig?: NavigationSessionConfig;
  log?: ReturnType<typeof createPilotLog>;
}): Rig {
  let planCalls = 0;
  let replacementCalls = 0;
  const planPort: PlanPort = async (req) => {
    planCalls += 1;
    return (opts.plan ?? (() => goodPlan()))(req, planCalls);
  };
  const lc = createNavigationLifecycle({
    planPort,
    replacementPort: async (req) => {
      replacementCalls += 1;
      return (opts.replacement ?? verticalReplacement)(req, replacementCalls);
    },
    sessionConfig: opts.sessionConfig,
    log: opts.log,
  });
  return { lc, planCalls: () => planCalls, replacementCalls: () => replacementCalls };
}

/** Drive along the fixture line: 2 points (0.138 mi) every 8 s ≈ 62 mph. */
function drive(
  lc: NavigationLifecycle,
  fromIdx: number,
  toIdx: number,
  t0: number,
  opts: { lngOff?: number; speedMph?: number; stepIdx?: number; stepMs?: number } = {},
): number {
  const stepIdx = opts.stepIdx ?? 2;
  const stepMs = opts.stepMs ?? 8000;
  let t = t0;
  for (let i = fromIdx; i <= toIdx; i += stepIdx) {
    lc.tick(pos(LAT0 + i * 0.001, LNG0 + (opts.lngOff ?? 0), t, opts.speedMph ?? 62), t);
    t += stepMs;
  }
  return t;
}

/** Assert every recorded transition of a rig is in the legality table. */
function assertLegal(name: string, lc: NavigationLifecycle) {
  const bad = lc
    .transitions()
    .filter((tr) => !LIFECYCLE_TRANSITIONS[tr.from].includes(tr.to))
    .map((tr) => `${tr.from}>${tr.to}`);
  check(`${name}: every recorded transition is legal`, bad.length === 0, bad);
  check(`${name}: violation audit is empty`, lc.violations().length === 0, lc.violations());
}

async function main() {
  /* ------------------------------------------------ 1. Pilot Mode config */
  console.log('— Pilot Mode configuration —');

  check(
    'flag off → inactive (flag-off), even on localhost',
    resolvePilotMode({ flagValue: undefined, hostname: 'localhost' }).reason === 'flag-off',
  );
  check(
    "flag 'false' → inactive",
    !resolvePilotMode({ flagValue: 'false', hostname: 'localhost' }).active,
  );
  check(
    'flag on + no hostname (SSR) → inactive default-deny',
    resolvePilotMode({ flagValue: 'true', hostname: null }).reason === 'unknown-host',
  );
  check(
    'flag on + production host → inactive (production-host)',
    resolvePilotMode({ flagValue: 'true', hostname: 'truckinglifewithshawn.com' }).reason ===
      'production-host',
  );
  check(
    'flag on + www production host → inactive',
    resolvePilotMode({ flagValue: 'true', hostname: 'www.truckinglifewithshawn.com' }).reason ===
      'production-host',
  );
  check(
    'production check is case/port tolerant',
    resolvePilotMode({ flagValue: 'true', hostname: 'WWW.TruckingLifeWithShawn.com:443' })
      .reason === 'production-host',
  );
  const preview = resolvePilotMode({
    flagValue: 'true',
    hostname: 'deploy-preview-247--tlws.netlify.app',
  });
  check('flag on + deploy preview → ACTIVE pilot', preview.active && preview.reason === 'pilot');
  check('pilot activation carries debug logging', preview.debugLogging);
  check(
    'flag on + localhost → active (local development)',
    resolvePilotMode({ flagValue: 'true', hostname: 'localhost' }).active,
  );

  const log = createPilotLog(5);
  for (let i = 0; i < 8; i++) log.record(T0 + i, `event-${i}`);
  check('pilot log is bounded', log.entries().length === 5);
  check('pilot log counts dropped entries', log.dropped() === 3);
  check('pilot log keeps the newest entries', log.entries()[4].event === 'event-7');
  check(
    'coordinate-shaped values are redacted',
    redactCoordinates('at 35.41234,-84.99881 now') === 'at [coord],[coord] now',
  );
  check(
    'route miles and speeds survive redaction',
    redactCoordinates('mile 42.3 at 61.5 mph') === 'mile 42.3 at 61.5 mph',
  );
  const leakyLog = createPilotLog();
  leakyLog.record(T0, 'fix', 'lat 35.123456 lng -85.000001');
  check(
    'log storage itself redacts (hard rail, not caller discipline)',
    leakyLog.entries()[0].detail === 'lat [coord] lng [coord]',
    leakyLog.entries()[0],
  );
  check('default log bound is the documented constant', PILOT_LOG_MAX_ENTRIES === 500);

  /* --------------------------------- 2. transition table static sanity */
  console.log('— Lifecycle transition table —');
  const states = Object.keys(LIFECYCLE_TRANSITIONS) as LifecycleState[];
  check('exactly the 9 lifecycle states exist', states.length === 9);
  check('idle can only begin planning', LIFECYCLE_TRANSITIONS.idle.join(',') === 'planning');
  check('arrived can only complete', LIFECYCLE_TRANSITIONS.arrived.join(',') === 'completed');
  check('completed can only reset to idle', LIFECYCLE_TRANSITIONS.completed.join(',') === 'idle');
  check(
    'navigating is reachable only from route-ready or an engine fallback',
    states
      .filter((s) => LIFECYCLE_TRANSITIONS[s].includes('navigating'))
      .sort()
      .join(',') === 'final-approach,off-route,rerouting,route-ready',
    states.filter((s) => LIFECYCLE_TRANSITIONS[s].includes('navigating')),
  );
  check(
    'no trip state transitions back to route-ready or planning',
    states.every(
      (s) =>
        s === 'idle' ||
        s === 'planning' ||
        (!LIFECYCLE_TRANSITIONS[s].includes('planning') &&
          !LIFECYCLE_TRANSITIONS[s].includes('route-ready')),
    ),
  );
  check(
    'every active state can reach completed (cancellation is universal)',
    (['navigating', 'off-route', 'rerouting', 'final-approach', 'arrived'] as const).every((s) =>
      LIFECYCLE_TRANSITIONS[s].includes('completed'),
    ),
  );

  /* ------------------------------------------- 3. full happy lifecycle */
  console.log('— Full navigation lifecycle (plan → drive → arrive → complete) —');
  const happyLog = createPilotLog();
  const happy = makeRig({ log: happyLog });
  const lc = happy.lc;

  check('starts idle', lc.state() === 'idle');
  check('idle view is the honest no-route view', lc.view().status === 'no-route');
  check('idle holds no engine references', lc.resourcesReleased());

  const preTick = lc.tick(pos(LAT0, LNG0, T0 - 1000, 0), T0 - 1000);
  check('ticks before a trip are inert', preTick.state === 'idle' && lc.state() === 'idle');

  const planned = await lc.plan(PLAN_REQ, VERIFIED_DEST, T0);
  check('plan succeeds through the injected port', planned.ok, planned);
  check('plan lands in route-ready', lc.state() === 'route-ready');
  check('one plan port call', happy.planCalls() === 1);
  check(
    'session carries the full route',
    planned.ok &&
      planned.session.distanceMiles === TOTAL_MI &&
      planned.session.geometry.length === N_POINTS,
  );

  lc.tick(pos(LAT0, LNG0, T0, 0), T0);
  check('route-ready ticks do not start engines', lc.state() === 'route-ready');

  check('startNavigation from route-ready succeeds', lc.startNavigation(T0 + 1000));
  check('now navigating', lc.state() === 'navigating');
  check('navigation start does not spend a provider call', happy.replacementCalls() === 0);

  let t = drive(lc, 0, 500, T0 + 2000);
  check('mid-drive still navigating', lc.state() === 'navigating');
  const midView = lc.view();
  check(
    'driving view advances the route mile',
    midView.routeMile !== null && midView.routeMile > 30 && midView.totalMi === TOTAL_MI,
    midView,
  );
  check(
    'maneuver view shows the arrive instruction ahead',
    midView.maneuvers?.next?.instruction === 'Arrive.' ||
      midView.maneuvers?.next?.instruction === 'Keep straight.',
    midView.maneuvers?.next,
  );
  check('view reports navigating status', midView.status === 'navigating');

  t = drive(lc, 502, 990, t);
  check('still en-route just outside the approach window', lc.state() === 'navigating');

  // Into the 0.5 mi window, decelerating.
  lc.tick(pos(LAT0 + 0.994, LNG0, t, 45), t);
  t += 8000;
  check('final approach begins inside the window', lc.state() === 'final-approach', lc.state());
  lc.tick(pos(LAT0 + 0.996, LNG0, t, 30), t);
  t += 8000;
  lc.tick(pos(LAT0 + 0.998, LNG0, t, 12), t);
  t += 8000;
  check('still final-approach while rolling', lc.state() === 'final-approach');

  // Creep to a stop at the verified gate: 4 slow fixes over 18 s.
  for (let i = 0; i < 4 && lc.state() !== 'arrived'; i++) {
    lc.tick(pos(LAT0 + 0.999, LNG0, t, 3), t);
    t += 6000;
  }
  check('arrival completes after sustained stopped evidence', lc.state() === 'arrived', lc.state());
  const summary = lc.summary();
  check('summary says arrived', summary?.endReason === 'arrived', summary);
  check(
    'summary carries the verified entrance kind',
    summary?.entranceKind === 'verified-truck-entrance',
  );
  check('summary carries planned miles', summary?.plannedMiles === TOTAL_MI);
  check('summary is frozen', summary !== null && Object.isFrozen(summary));
  check('view shows arrived', lc.view().status === 'arrived');

  const arrivedTicks = lc.transitions().length;
  lc.tick(pos(LAT0 + 0.999, LNG0, t, 0), t);
  check('arrived is inert to further ticks', lc.transitions().length === arrivedTicks);

  check('complete acknowledges the trip', lc.complete(t));
  check('completed after complete()', lc.state() === 'completed');
  check('ALL engine references released after completion', lc.resourcesReleased());
  check('completed view is no-route (nothing is live)', lc.view().status === 'no-route');
  check('summary survives completion', lc.summary()?.endReason === 'arrived');
  const rrAfter = await lc.requestReroute(t, 8);
  check('reroute after completion is not eligible', rrAfter.outcome === 'not-eligible');
  check('cancel after completion is a no-op', lc.cancel(t) === null);

  check('reset returns to idle', lc.reset(t));
  check('idle again, summary cleared', lc.state() === 'idle' && lc.summary() === null);

  const seq = lc.transitions().map((tr) => tr.to);
  check(
    'exact happy-path lifecycle order',
    seq.join(',') === 'planning,route-ready,navigating,final-approach,arrived,completed,idle',
    seq,
  );
  assertLegal('happy path', lc);

  const coordLike = happyLog
    .entries()
    .filter((e) => /-?\d{1,3}\.\d{4,}/.test(`${e.event} ${e.detail ?? ''}`));
  check('pilot log captured transitions', happyLog.entries().length >= 7);
  check('NO coordinate-precision values in the pilot log', coordLike.length === 0, coordLike);

  /* -------------------------------------------- 4. invalid transitions */
  console.log('— Invalid transitions are refused —');
  const guard = makeRig({});
  check('startNavigation from idle refused', !guard.lc.startNavigation(T0));
  check('complete from idle refused', !guard.lc.complete(T0));
  check('reset from idle refused', !guard.lc.reset(T0));
  check('discardRoute from idle refused', !guard.lc.discardRoute(T0));
  check('cancel from idle is null', guard.lc.cancel(T0) === null);
  const rrIdle = await guard.lc.requestReroute(T0, 8);
  check('reroute from idle not eligible', rrIdle.outcome === 'not-eligible');
  check('refusals recorded no transitions', guard.lc.transitions().length === 0);
  check(
    'refusals are NOT violations (clean refusal ≠ illegal move)',
    guard.lc.violations().length === 0,
  );

  await guard.lc.plan(PLAN_REQ, VERIFIED_DEST, T0);
  guard.lc.startNavigation(T0);
  const planWhileDriving = await guard.lc.plan(PLAN_REQ, VERIFIED_DEST, T0 + 1);
  check(
    'plan while navigating refused as a request',
    !planWhileDriving.ok && planWhileDriving.refused,
    planWhileDriving,
  );
  const rrNav = await guard.lc.requestReroute(T0 + 2, 8);
  check(
    'reroute while merely navigating (not off-route) refused',
    rrNav.outcome === 'not-eligible',
  );
  check('discardRoute while navigating refused', !guard.lc.discardRoute(T0 + 3));
  check('complete while navigating refused', !guard.lc.complete(T0 + 4));
  check('state undamaged by the refusals', guard.lc.state() === 'navigating');
  assertLegal('refusal battery', guard.lc);

  /* --------------------------------------------- 5. plan failure paths */
  console.log('— Plan failures return to idle —');
  const failing = makeRig({ plan: () => ({ kind: 'failure', reason: 'not-enabled' }) });
  const failOut = await failing.lc.plan(PLAN_REQ, VERIFIED_DEST, T0);
  check('port failure surfaces its reason', !failOut.ok && failOut.reason === 'not-enabled');
  check('failed plan returns to idle', failing.lc.state() === 'idle');
  check('failed plan leaves no references', failing.lc.resourcesReleased());

  const review = makeRig({ plan: () => ({ ...goodPlan(), validationState: 'requires-review' }) });
  const reviewOut = await review.lc.plan(PLAN_REQ, VERIFIED_DEST, T0);
  check(
    'requires-review route can NEVER become a session',
    !reviewOut.ok && reviewOut.reason.includes('ineligible-state'),
    reviewOut,
  );
  check('requires-review lands back in idle', review.lc.state() === 'idle');

  const throwing = makeRig({
    plan: () => {
      throw new Error('boom');
    },
  });
  const threwOut = await throwing.lc.plan(PLAN_REQ, VERIFIED_DEST, T0);
  check('throwing port is contained', !threwOut.ok && threwOut.reason === 'plan-port-threw');
  check('throwing port lands back in idle', throwing.lc.state() === 'idle');

  // Cancel while the plan request is in flight: the cancel wins.
  let releasePlan: ((r: PlanFetchResult) => void) | null = null;
  const deferred = makeRig({
    plan: () => new Promise<PlanFetchResult>((resolve) => (releasePlan = resolve)),
  });
  const pending = deferred.lc.plan(PLAN_REQ, VERIFIED_DEST, T0);
  check('planning state while in flight', deferred.lc.state() === 'planning');
  deferred.lc.cancel(T0 + 500);
  check('cancel during planning returns to idle', deferred.lc.state() === 'idle');
  releasePlan!(goodPlan());
  const late = await pending;
  check('late plan response is superseded, not applied', !late.ok && late.reason === 'superseded');
  check(
    'stale response did not resurrect the route',
    deferred.lc.state() === 'idle' && deferred.lc.resourcesReleased(),
  );
  assertLegal('plan failures', deferred.lc);

  /* -------------------------------------------- 6. reroute lifecycle */
  console.log('— Reroute lifecycle (off-route → rerouting → replaced) —');
  const rr = makeRig({});
  await rr.lc.plan(PLAN_REQ, VERIFIED_DEST, T0);
  rr.lc.startNavigation(T0);
  let rt = drive(rr.lc, 0, 400, T0 + 1000);
  check('on-route before the veer', rr.lc.state() === 'navigating');
  const routeIdBefore = rr.lc.snapshot().routeId;

  // Veer ~109 m east of the corridor and keep driving north.
  rt = drive(rr.lc, 402, 412, rt, { lngOff: 0.0012 });
  check(
    'sustained lateral departure confirms off-route',
    rr.lc.state() === 'off-route',
    rr.lc.state(),
  );
  check('no provider spend before the reroute request', rr.replacementCalls() === 0);

  const rrOut = await rr.lc.requestReroute(rt, 8);
  check('confirmed off-route reroute is REPLACED', rrOut.outcome === 'replaced', rrOut);
  check('exactly one replacement call', rr.replacementCalls() === 1);
  check('back to navigating on the new route', rr.lc.state() === 'navigating');
  const snapAfter = rr.lc.snapshot();
  check(
    'route id changed with the replacement',
    snapAfter.routeId !== routeIdBefore,
    snapAfter.routeId,
  );
  check(
    'view now tracks the replacement route length',
    (rr.lc.view().totalMi ?? 99) < TOTAL_MI - 20,
    rr.lc.view().totalMi,
  );
  check(
    'transition sequence went off-route → rerouting → navigating',
    rr.lc
      .transitions()
      .map((x) => x.to)
      .join(',')
      .includes('off-route,rerouting,navigating'),
  );

  // Clean driving on the replacement: no residual off-route state.
  rt = drive(rr.lc, 414, 440, rt);
  check('replacement route tracks cleanly', rr.lc.state() === 'navigating');
  assertLegal('reroute lifecycle', rr.lc);

  /* -------------------- 7. reroute refusals keep the current route */
  console.log('— Reroute refusals and failures keep the current route —');
  const rrFail = makeRig({ replacement: () => ({ kind: 'failure', reason: 'provider-down' }) });
  await rrFail.lc.plan(PLAN_REQ, VERIFIED_DEST, T0);
  rrFail.lc.startNavigation(T0);
  let ft = drive(rrFail.lc, 0, 300, T0 + 1000);
  ft = drive(rrFail.lc, 302, 312, ft, { lngOff: 0.0012 });
  check('fixture confirms off-route', rrFail.lc.state() === 'off-route');
  const beforeFail = rrFail.lc.snapshot().routeId;
  const failRes = await rrFail.lc.requestReroute(ft, 8);
  check('provider failure surfaces honestly', failRes.outcome === 'provider-failure', failRes);
  check('failure falls back to off-route (still confirmed)', rrFail.lc.state() === 'off-route');
  check('current route stands after failure', rrFail.lc.snapshot().routeId === beforeFail);
  assertLegal('reroute failure', rrFail.lc);

  const rrBudget = makeRig({ sessionConfig: { reroute: { maxPerSession: 1 } } });
  await rrBudget.lc.plan(PLAN_REQ, VERIFIED_DEST, T0);
  rrBudget.lc.startNavigation(T0);
  let bt = drive(rrBudget.lc, 0, 200, T0 + 1000);
  bt = drive(rrBudget.lc, 202, 212, bt, { lngOff: 0.0012 });
  const firstBudget = await rrBudget.lc.requestReroute(bt, 8);
  check('first reroute inside the budget succeeds', firstBudget.outcome === 'replaced');
  bt = drive(rrBudget.lc, 214, 220, bt);
  bt = drive(rrBudget.lc, 222, 232, bt, { lngOff: 0.0012 });
  check('re-confirms on the new route', rrBudget.lc.state() === 'off-route');
  const secondBudget = await rrBudget.lc.requestReroute(bt, 8);
  check(
    'session budget refusal',
    secondBudget.outcome === 'refused' && secondBudget.reason === 'session-budget',
    secondBudget,
  );
  check('refusal lands back in off-route', rrBudget.lc.state() === 'off-route');
  check('refusal never replaced the route', rrBudget.replacementCalls() === 1);
  assertLegal('reroute budget', rrBudget.lc);

  /* ------------------------------------ 8. repeated reroutes (hourly cage) */
  console.log('— Repeated reroutes stay inside the hourly cage —');
  const many = makeRig({
    sessionConfig: { reroute: { successCooldownMs: 0, duplicateWindowMs: 0 } },
  });
  await many.lc.plan(PLAN_REQ, VERIFIED_DEST, T0);
  many.lc.startNavigation(T0);
  let mt = drive(many.lc, 0, 100, T0 + 1000);
  let replacedCount = 0;
  let refusedHourly = 0;
  let idx = 102;
  for (let cycle = 0; cycle < 7; cycle++) {
    mt = drive(many.lc, idx, idx + 4, mt); // warm up on the current route
    mt = drive(many.lc, idx + 6, idx + 16, mt, { lngOff: 0.0012 }); // veer
    if (many.lc.state() !== 'off-route') break;
    const out = await many.lc.requestReroute(mt, 8);
    if (out.outcome === 'replaced') replacedCount += 1;
    else if (out.outcome === 'refused' && out.reason === 'hourly-budget') refusedHourly += 1;
    idx += 20;
  }
  check('six replacements allowed in the trailing hour', replacedCount === 6, replacedCount);
  check(
    'the seventh confirmed reroute is refused (hourly-budget)',
    refusedHourly === 1,
    refusedHourly,
  );
  check('provider was called exactly six times', many.replacementCalls() === 6);
  check('lifecycle still coherent after the burst', many.lc.state() === 'off-route');
  assertLegal('repeated reroutes', many.lc);

  /* ----------------------------------------------- 9. cancellation */
  console.log('— Cancellation is honest from every stage —');
  const cx = makeRig({});
  await cx.lc.plan(PLAN_REQ, VERIFIED_DEST, T0);
  check(
    'cancel from route-ready returns to idle',
    cx.lc.cancel(T0 + 1) === null && cx.lc.state() === 'idle',
  );

  await cx.lc.plan(PLAN_REQ, VERIFIED_DEST, T0 + 10);
  cx.lc.startNavigation(T0 + 10);
  let ct = drive(cx.lc, 0, 100, T0 + 1000);
  const cSummary = cx.lc.cancel(ct);
  check('cancel mid-drive completes the trip', cx.lc.state() === 'completed');
  check('cancellation is never dressed as arrival', cSummary?.endReason === 'cancelled', cSummary);
  check('cancel releases every engine', cx.lc.resourcesReleased());
  const ghostTick = cx.lc.tick(pos(LAT0 + 0.2, LNG0, ct + 5000, 62), ct + 5000);
  check('ticks after cancellation are inert', ghostTick.state === 'completed');
  check(
    'second cancel is a harmless no-op, summary preserved',
    cx.lc.cancel(ct + 6000) === null &&
      cx.lc.state() === 'completed' &&
      cx.lc.summary()?.endReason === 'cancelled',
  );

  // Cancel during final approach.
  const cf = makeRig({});
  await cf.lc.plan(PLAN_REQ, VERIFIED_DEST, T0);
  cf.lc.startNavigation(T0);
  let cft = drive(cf.lc, 0, 992, T0 + 1000);
  cf.lc.tick(pos(LAT0 + 0.994, LNG0, cft, 40), cft);
  check('fixture reached final approach', cf.lc.state() === 'final-approach');
  const cfSummary = cf.lc.cancel(cft + 1000);
  check('cancel from final approach stays honest', cfSummary?.endReason === 'cancelled');
  check(
    'completed after approach cancel',
    cf.lc.state() === 'completed' && cf.lc.resourcesReleased(),
  );
  assertLegal('cancellation', cf.lc);

  /* ----------------------------------------------- 10. GPS loss */
  console.log('— GPS loss: no arrival across missing time, no false off-route —');
  const gps = makeRig({});
  await gps.lc.plan(PLAN_REQ, VERIFIED_DEST, T0);
  gps.lc.startNavigation(T0);
  let gt = drive(gps.lc, 0, 992, T0 + 1000);
  gps.lc.tick(pos(LAT0 + 0.994, LNG0, gt, 40), gt);
  gt += 8000;
  gps.lc.tick(pos(LAT0 + 0.998, LNG0, gt, 10), gt);
  gt += 8000;
  gps.lc.tick(pos(LAT0 + 0.999, LNG0, gt, 3), gt); // first arrival evidence
  check(
    'arrival candidate forming',
    gps.lc.snapshot().navigation?.arrival?.state === 'arrival-candidate',
  );

  // 25 s of darkness in the yard (garage, canyon) — then back.
  gt += 25_000;
  gps.lc.tick(pos(LAT0 + 0.999, LNG0, gt, 2), gt);
  check(
    'gap resets arrival evidence — NEVER arrive across missing time',
    gps.lc.state() !== 'arrived',
    gps.lc.state(),
  );
  const qualsAfterGap = gps.lc.snapshot().navigation?.arrival?.qualifyingFixes ?? 99;
  check('qualifying evidence restarted after the gap', qualsAfterGap <= 1, qualsAfterGap);

  // Health-lost ticks (held fix) must not feed the engines.
  const navBefore = gps.lc.snapshot().navigation;
  gt += 4000;
  gps.lc.tick(pos(LAT0 + 0.999, LNG0, gt, null, { health: 'lost' }), gt);
  check('lost-health tick shows position-lost view', gps.lc.view().status === 'position-lost');
  check('lost-health tick did not reach the engines', gps.lc.snapshot().navigation === navBefore);

  // Fresh sustained evidence still completes the trip properly.
  gt += 4000;
  for (let i = 0; i < 4 && gps.lc.state() !== 'arrived'; i++) {
    gps.lc.tick(pos(LAT0 + 0.999, LNG0, gt, 2), gt);
    gt += 6000;
  }
  check('arrival completes after FRESH post-gap evidence', gps.lc.state() === 'arrived');
  assertLegal('gps loss / arrival', gps.lc);

  // Mid-route teleport (tunnel): gap-reset must not read as off-route.
  const tun = makeRig({});
  await tun.lc.plan(PLAN_REQ, VERIFIED_DEST, T0);
  tun.lc.startNavigation(T0);
  let tt = drive(tun.lc, 0, 200, T0 + 1000);
  tt += 20_000; // 20 s silent, truck kept moving ~0.34 mi
  tt = drive(tun.lc, 210, 240, tt);
  check('tunnel gap never confirms off-route', tun.lc.state() === 'navigating', tun.lc.state());
  check(
    'detector stayed on-route through the gap',
    tun.lc.snapshot().navigation?.detector?.state === 'on-route',
  );
  assertLegal('tunnel gap', tun.lc);

  /* ------------------------------------- 11. tick reference idempotency */
  console.log('— Tick idempotency (StrictMode double render) —');
  const idem = makeRig({});
  await idem.lc.plan(PLAN_REQ, VERIFIED_DEST, T0);
  idem.lc.startNavigation(T0);
  drive(idem.lc, 0, 20, T0 + 1000);
  const samePos = pos(LAT0 + 0.022, LNG0, T0 + 100_000, 62);
  const s1 = idem.lc.tick(samePos, T0 + 100_000);
  const s2 = idem.lc.tick(samePos, T0 + 100_001);
  check(
    'identical PositionState reference is ingested once',
    s1.navigation === s2.navigation && s1.state === s2.state,
  );
  assertLegal('idempotency', idem.lc);

  /* -------------------------- 12. long session + measured performance */
  console.log('— Long session (100k ticks) + measured memory —');
  const gc: (() => void) | undefined = (globalThis as { gc?: () => void }).gc;
  if (!gc) console.log('  (run with --expose-gc for memory numbers)');

  const longRig = makeRig({});
  await longRig.lc.plan(PLAN_REQ, VERIFIED_DEST, T0);
  longRig.lc.startNavigation(T0);
  drive(longRig.lc, 0, 500, T0 + 1000); // establish mid-route tracking

  gc?.();
  const heapBefore = process.memoryUsage().heapUsed;
  const LONG_N = 100_000;
  let lt = T0 + 10_000_000;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < LONG_N; i++) {
    longRig.lc.tick(pos(LAT0 + 0.5, LNG0, lt, 2), lt);
    lt += 5000;
  }
  const t1 = process.hrtime.bigint();
  const longMs = Number(t1 - t0) / 1e6;
  gc?.();
  const heapActive = process.memoryUsage().heapUsed;

  check('long session stays navigating (low speed, on route)', longRig.lc.state() === 'navigating');
  check('100k ticks complete in bounded time (< 30 s)', longMs < 30_000, longMs);
  check(
    'no unbounded growth while active (< 24 MB over 100k ticks)',
    heapActive - heapBefore < 24 * 1024 * 1024,
    `${((heapActive - heapBefore) / 1048576).toFixed(1)} MB`,
  );

  const cSum = longRig.lc.cancel(lt);
  gc?.();
  const heapAfter = process.memoryUsage().heapUsed;
  const retainedMb = (heapAfter - heapBefore) / 1048576;
  check('long session cancels cleanly', cSum?.endReason === 'cancelled');
  check('engines released after the long session', longRig.lc.resourcesReleased());
  check(
    'retained heap after completion + GC < 4 MB',
    retainedMb < 4,
    `${retainedMb.toFixed(2)} MB`,
  );
  console.log(
    `measured: 100k ticks ${longMs.toFixed(0)} ms total (${((longMs * 1000) / LONG_N).toFixed(1)} µs/tick) · ` +
      `active-session heap delta ${((heapActive - heapBefore) / 1048576).toFixed(1)} MB · ` +
      `retained after cancel+GC ${retainedMb.toFixed(2)} MB`,
  );
  assertLegal('long session', longRig.lc);

  /* -------------------------------------- 13. cleanup after arrival */
  console.log('— Cleanup after arrival (measured) —');
  const clean = makeRig({});
  await clean.lc.plan(PLAN_REQ, VERIFIED_DEST, T0);
  clean.lc.startNavigation(T0);
  let kt = drive(clean.lc, 0, 992, T0 + 1000);
  clean.lc.tick(pos(LAT0 + 0.994, LNG0, kt, 40), kt);
  kt += 8000;
  clean.lc.tick(pos(LAT0 + 0.998, LNG0, kt, 10), kt);
  kt += 8000;
  for (let i = 0; i < 4 && clean.lc.state() !== 'arrived'; i++) {
    clean.lc.tick(pos(LAT0 + 0.999, LNG0, kt, 3), kt);
    kt += 6000;
  }
  check('cleanup fixture arrived', clean.lc.state() === 'arrived');

  const c0 = process.hrtime.bigint();
  const completed = clean.lc.complete(kt);
  const c1 = process.hrtime.bigint();
  check('completion succeeds', completed);
  check('arrival path releases everything', clean.lc.resourcesReleased());
  check('post-completion snapshot holds only the summary', clean.lc.snapshot().navigation === null);
  const cleanupMs = Number(c1 - c0) / 1e6;
  check('completion + release is immediate (< 5 ms)', cleanupMs < 5, cleanupMs);
  console.log(`measured: arrival completion + release ${cleanupMs.toFixed(3)} ms`);
  assertLegal('cleanup after arrival', clean.lc);

  /* --------------------------------- 14. component wiring (structural) */
  console.log('— Component wiring: structural source checks —');
  const drivingSrc = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
  const portSrc = readFileSync('src/components/navigator/route-port.ts', 'utf8');
  const controlsSrc = readFileSync('src/components/navigator/PilotTripControls.tsx', 'utf8');
  const pageSrc = readFileSync('src/app/(navigator)/drive/page.tsx', 'utf8');
  const actionsSrc = readFileSync('src/lib/navigator/actions.ts', 'utf8');

  check(
    'DrivingScreen resolves Pilot Mode from the real hostname after mount',
    drivingSrc.includes('window.location.hostname') && drivingSrc.includes('resolvePilotMode'),
  );
  check(
    'DrivingScreen cancels the trip on unmount',
    /useEffect\(\(\) => \(\) => void lifecycle\.cancel/.test(drivingSrc),
  );
  check(
    'DrivingScreen owns no timers (cadence stays with GpsProvider)',
    !/setInterval|setTimeout/.test(drivingSrc),
  );
  check(
    'pilot trip controls render ONLY when Pilot Mode is active',
    drivingSrc.includes('pilot.active ? (') || drivingSrc.includes('pilot.active ?'),
  );
  check(
    'stop button also cancels a live pilot trip',
    /onStop[\s\S]{0,200}lifecycle\.cancel/.test(drivingSrc),
  );
  check(
    'route port only ever talks to the flag-gated navigator endpoint',
    (portSrc.match(/\/api\//g) ?? []).length ===
      (portSrc.match(/\/api\/navigator\/route/g) ?? []).length &&
      portSrc.includes("'/api/navigator/route'"),
  );
  check(
    'route port never throws into the engines',
    portSrc.includes("{ kind: 'failure', reason: 'network' }"),
  );
  check(
    'trip controls perform no network I/O of their own',
    !/fetch\(|XMLHttpRequest|axios/.test(controlsSrc),
  );
  check(
    'trip controls add no geocoding or search (P1 adds no features)',
    !/geocode|autocomplete|search/i.test(
      controlsSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''),
    ),
  );
  check(
    '/drive page still 404s without the flag',
    pageSrc.includes("NEXT_PUBLIC_NAVIGATOR_ENABLED === 'true'") && pageSrc.includes('notFound()'),
  );
  check(
    'destination entry remains stationary-only in the action map',
    /'edit-destination':\s*false/.test(actionsSrc),
  );

  /* --------------------------------------------------------- summary */
  console.log(`\nnavigator-pilot: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
