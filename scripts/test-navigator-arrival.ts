/**
 * N8f — final approach, truck entrance intelligence & arrival. Unit tests
 * for the entrance classifier and the arrival state machine (synthetic
 * matcher verdicts for precise control), plus end-to-end integration
 * through the composed navigation session: REAL matcher → detector →
 * caged rerouter → arrival, with completion and cleanup proven
 * observable, and measured (never invented) performance.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-arrival.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-nav-arrival.cjs \
 *   && node /tmp/test-nav-arrival.cjs
 */
import {
  evaluateEntrance,
  FACILITY_ARRIVAL_RADIUS_M,
  type DestinationInfo,
} from '@/lib/navigator/truck-entrance';
import {
  createArrivalController,
  ARRIVAL_DEFAULTS,
  type ArrivalObservation,
} from '@/lib/navigator/arrival-controller';
import { createNavigationSession } from '@/lib/navigator/navigation-session';
import { createRouteSession, type RouteSession } from '@/lib/navigator/route-session';
import type {
  ReplacementFetchResult,
  ReplacementRequest,
} from '@/lib/navigator/reroute-controller';
import type { MapMatch } from '@/lib/navigator/map-matcher';
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

// ---------------------------------------------------------------- fixtures
const T0 = 1_754_000_000_000;
const LAT0 = 35;
const LNG0 = -85;
const mPerDegLng = 111_320 * Math.cos((LAT0 * Math.PI) / 180);
const TRUCK: TruckProfile = {
  lengthFt: 73,
  heightFt: 13.5,
  widthFt: 8.5,
  grossWeightLbs: 80_000,
  axles: 5,
  hazmatClass: null,
  tankGallons: 200,
  mpg: 6.5,
  fuelSafetyFactor: 0.8,
};

function line(n: number): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i < n; i++) out.push({ lat: LAT0 + i * 0.001, lng: LNG0 });
  return out;
}
const MI_PER_STEP = 0.0690937;

function makeSession(n = 1000): RouteSession {
  const positions = line(n);
  const made = createRouteSession({
    routeId: 'trip-arrive',
    truck: TRUCK,
    origin: positions[0],
    destination: positions[n - 1],
    positions,
    distanceMiles: Number(((n - 1) * MI_PER_STEP).toFixed(1)),
    durationSeconds: 4500,
    maneuvers: [
      { action: 'depart', instruction: 'Go.', direction: null, offset: 0 },
      { action: 'arrive', instruction: 'Arrive.', direction: null, offset: n - 1 },
    ],
    validationState: 'valid',
  });
  if (!made.ok) throw new Error('fixture session failed');
  return made.session;
}

const SESSION = makeSession();
const ROUTE_END = SESSION.geometry[SESSION.geometry.length - 1].position;
const TOTAL = SESSION.distanceMiles;

function dest(over: Partial<DestinationInfo> = {}): DestinationInfo {
  return { position: ROUTE_END, facility: 'warehouse', positionSource: 'geocode', ...over };
}
const VERIFIED_DEST = dest({
  entrances: [{ position: ROUTE_END, kind: 'verified', label: 'Gate 1' }],
});

/** Synthetic matcher verdict near the route end. */
function endMatch(over: Partial<MapMatch> = {}): MapMatch {
  return {
    matched: true,
    routeMile: TOTAL,
    candidateMile: TOTAL,
    lateralM: 5,
    headingDeltaDeg: null,
    travelDirection: 'stationary',
    confidence: 'medium',
    advanceEligible: true,
    reasons: ['heading-unusable'],
    ...over,
  };
}
function obsAt(over: Partial<ArrivalObservation> & { tMs: number }): ArrivalObservation {
  return {
    match: endMatch(over.match ? over.match : {}),
    position: ROUTE_END,
    speedMph: 3,
    ...over,
  };
}

// ----------------------------------------------- entrance classification
{
  const e1 = evaluateEntrance(VERIFIED_DEST, ROUTE_END);
  check(
    'entrance: verified truck entrance recognized',
    e1.kind === 'verified-truck-entrance' && e1.verified,
  );
  const gate2 = { lat: ROUTE_END.lat, lng: ROUTE_END.lng + 400 / mPerDegLng };
  const multi = evaluateEntrance(
    dest({
      entrances: [
        { position: gate2, kind: 'verified', label: 'Gate 2' },
        { position: ROUTE_END, kind: 'verified', label: 'Gate 1' },
      ],
    }),
    ROUTE_END,
  );
  check(
    'entrance: multi-entrance facility picks the gate nearest the route end',
    multi.targetToRouteEndM < 1 && multi.entranceCount === 2,
  );
  const reported = evaluateEntrance(
    dest({ entrances: [{ position: ROUTE_END, kind: 'reported' }] }),
    ROUTE_END,
  );
  check(
    'entrance: reported-only is PROBABLE, never verified',
    reported.kind === 'probable-entrance' && !reported.verified,
  );
  check(
    'entrance: caller-declared entrance point is probable',
    evaluateEntrance(dest({ positionSource: 'entrance' }), ROUTE_END).kind === 'probable-entrance',
  );
  check(
    'entrance: geocode is unverified',
    evaluateEntrance(dest({ positionSource: 'geocode' }), ROUTE_END).kind === 'unverified-entrance',
  );
  check(
    'entrance: centroid is named a centroid',
    evaluateEntrance(dest({ positionSource: 'centroid' }), ROUTE_END).kind === 'building-centroid',
  );
  const malformedRecords = evaluateEntrance(
    dest({ entrances: [{ position: { lat: Number.NaN, lng: 0 }, kind: 'verified' }] }),
    ROUTE_END,
  );
  check(
    'entrance: malformed entrance records ignored with a note, never fabricated',
    malformedRecords.kind !== 'verified-truck-entrance' && malformedRecords.notes.length > 0,
  );
  const malformedDest = evaluateEntrance(
    dest({ position: { lat: Number.NaN, lng: Number.NaN } }),
    ROUTE_END,
  );
  check(
    'entrance: malformed destination falls back to the route end honestly',
    Number.isFinite(malformedDest.target.lat) &&
      malformedDest.notes.some((x) => x.includes('malformed')),
  );
  check(
    'entrance: a truck stop lot is judged wider than a dock gate',
    FACILITY_ARRIVAL_RADIUS_M['truck-stop'] === 250 && FACILITY_ARRIVAL_RADIUS_M.warehouse === 150,
  );
}

// --------------------------------------------- arrival state machine core
{
  const a = createArrivalController(SESSION, VERIFIED_DEST);
  check('machine: starts en-route', a.snapshot().state === 'en-route');
  const far = a.observe(
    obsAt({ tMs: T0, match: endMatch({ routeMile: TOTAL - 3 }), speedMph: 60 }),
  );
  check('machine: 3 mi out stays en-route', far.state === 'en-route');
  const window = a.observe(
    obsAt({
      tMs: T0 + 3000,
      match: endMatch({ routeMile: TOTAL - 0.4, confidence: 'high' }),
      speedMph: 40,
    }),
  );
  check(
    'machine: inside 0.5 mi becomes FINAL APPROACH with slow advice',
    window.state === 'final-approach' &&
      window.approachAdviceMph === ARRIVAL_DEFAULTS.approachAdviceMph,
  );
  const c1 = a.observe(obsAt({ tMs: T0 + 6000 }));
  check(
    'machine: first qualifying fix is a CANDIDATE — never arrival',
    c1.state === 'arrival-candidate' && c1.qualifyingFixes === 1,
  );
  const c2 = a.observe(obsAt({ tMs: T0 + 9000 }));
  check('machine: two fixes still candidate (elapsed too short)', c2.state === 'arrival-candidate');
  const done = a.observe(obsAt({ tMs: T0 + 16_500 }));
  check(
    'machine: 3 qualifying fixes + 10 s → ARRIVED (verified entrance)',
    done.state === 'arrived' && done.completed,
  );
  const s = a.summary()!;
  check(
    'machine: immutable trip summary preserved',
    Object.isFrozen(s) &&
      s.endReason === 'arrived' &&
      s.entranceKind === 'verified-truck-entrance' &&
      s.routeId === 'trip-arrive',
  );
  const after = a.observe(obsAt({ tMs: T0 + 60_000, speedMph: 60 }));
  check('machine: terminal state is inert', after.state === 'arrived' && a.summary() === s);
  check('machine: cancel after completion is idempotent', a.cancel(T0 + 90_000) === s);
}

// ---------------------- unverified destinations: honest terminal state
{
  for (const [facility, source] of [
    ['warehouse', 'geocode'],
    ['distribution-center', 'centroid'],
    ['industrial-park', 'unknown'],
    ['customer-yard', 'geocode'],
  ] as const) {
    const a = createArrivalController(SESSION, dest({ facility, positionSource: source }));
    a.observe(
      obsAt({
        tMs: T0,
        match: endMatch({ routeMile: TOTAL - 0.3, confidence: 'high' }),
        speedMph: 30,
      }),
    );
    for (let i = 1; i <= 4; i++) a.observe(obsAt({ tMs: T0 + i * 4000 }));
    const snap = a.snapshot();
    check(
      `unverified: ${facility}/${source} completes as DESTINATION UNVERIFIED, never a confident arrival`,
      snap.state === 'destination-unverified' &&
        a.summary()?.endReason === 'destination-unverified',
      snap.state,
    );
  }
  // Verified/probable facilities arrive normally.
  for (const facility of ['truck-terminal', 'truck-stop'] as const) {
    const a = createArrivalController(
      SESSION,
      dest({ facility, entrances: [{ position: ROUTE_END, kind: 'verified' }] }),
    );
    a.observe(
      obsAt({
        tMs: T0,
        match: endMatch({ routeMile: TOTAL - 0.3, confidence: 'high' }),
        speedMph: 30,
      }),
    );
    for (let i = 1; i <= 4; i++) a.observe(obsAt({ tMs: T0 + i * 4000 }));
    check(`facility: ${facility} with a verified gate ARRIVES`, a.snapshot().state === 'arrived');
  }
}

// ------------------------------- facility radius + pull-in acceptance
{
  const off220 = { lat: ROUTE_END.lat, lng: ROUTE_END.lng + 220 / mPerDegLng };
  const stop = createArrivalController(
    SESSION,
    dest({ facility: 'truck-stop', entrances: [{ position: ROUTE_END, kind: 'verified' }] }),
  );
  stop.observe(
    obsAt({
      tMs: T0,
      match: endMatch({ routeMile: TOTAL - 0.3, confidence: 'high' }),
      speedMph: 20,
    }),
  );
  for (let i = 1; i <= 4; i++) stop.observe(obsAt({ tMs: T0 + i * 4000, position: off220 }));
  check(
    'radius: 220 m into a truck-stop lot still arrives (250 m radius)',
    stop.snapshot().state === 'arrived',
  );

  const dock = createArrivalController(SESSION, VERIFIED_DEST); // warehouse: 150 m
  dock.observe(
    obsAt({
      tMs: T0,
      match: endMatch({ routeMile: TOTAL - 0.3, confidence: 'high' }),
      speedMph: 20,
    }),
  );
  for (let i = 1; i <= 4; i++) dock.observe(obsAt({ tMs: T0 + i * 4000, position: off220 }));
  check(
    'radius: 220 m from a warehouse gate does NOT arrive (150 m radius)',
    dock.snapshot().state !== 'arrived',
  );

  // The matcher's low-speed pull-in LOW is arrival evidence ONLY inside
  // the radius; ordinary LOW never is.
  const pullIn = createArrivalController(SESSION, VERIFIED_DEST);
  pullIn.observe(
    obsAt({
      tMs: T0,
      match: endMatch({ routeMile: TOTAL - 0.3, confidence: 'high' }),
      speedMph: 20,
    }),
  );
  for (let i = 1; i <= 4; i++) {
    pullIn.observe(
      obsAt({
        tMs: T0 + i * 4000,
        match: endMatch({ confidence: 'low', reasons: ['low-speed-pull-in'] }),
      }),
    );
  }
  check(
    'pull-in: destination pull-in LOW is accepted as arrival evidence',
    pullIn.snapshot().state === 'arrived',
  );

  const plainLow = createArrivalController(SESSION, VERIFIED_DEST);
  plainLow.observe(
    obsAt({
      tMs: T0,
      match: endMatch({ routeMile: TOTAL - 0.3, confidence: 'high' }),
      speedMph: 20,
    }),
  );
  for (let i = 1; i <= 4; i++) {
    plainLow.observe(
      obsAt({
        tMs: T0 + i * 4000,
        match: endMatch({ confidence: 'low', reasons: ['far-from-route'] }),
      }),
    );
  }
  check(
    'pull-in: ordinary LOW confidence never completes arrival',
    plainLow.snapshot().state !== 'arrived',
  );
}

// ------------------- drift, gaps, aborts, repeats, blocked entrance
{
  // GPS drift near the destination: a drifted fix breaks the streak.
  const a = createArrivalController(SESSION, VERIFIED_DEST);
  a.observe(
    obsAt({
      tMs: T0,
      match: endMatch({ routeMile: TOTAL - 0.3, confidence: 'high' }),
      speedMph: 20,
    }),
  );
  a.observe(obsAt({ tMs: T0 + 3000 }));
  const drifted = { lat: ROUTE_END.lat, lng: ROUTE_END.lng + 400 / mPerDegLng };
  const afterDrift = a.observe(obsAt({ tMs: T0 + 6000, position: drifted }));
  check(
    'drift: a 400 m outlier aborts the candidate (never arrives through drift)',
    afterDrift.state === 'final-approach',
  );

  // Repeated attempts: re-qualify and complete on the second attempt.
  a.observe(obsAt({ tMs: T0 + 9000 }));
  for (let i = 1; i <= 3; i++) a.observe(obsAt({ tMs: T0 + 9000 + i * 4000 }));
  check('repeat: the second attempt arrives cleanly', a.snapshot().state === 'arrived');

  // GPS loss near the destination: no arrival across a gap.
  const g = createArrivalController(SESSION, VERIFIED_DEST);
  g.observe(
    obsAt({
      tMs: T0,
      match: endMatch({ routeMile: TOTAL - 0.3, confidence: 'high' }),
      speedMph: 20,
    }),
  );
  g.observe(obsAt({ tMs: T0 + 3000 }));
  g.observe(obsAt({ tMs: T0 + 6000 }));
  const afterGap = g.observe(obsAt({ tMs: T0 + 6000 + 45_000 }));
  check(
    'gap: 45 s of GPS loss resets arrival evidence',
    afterGap.state !== 'arrived' && afterGap.qualifyingFixes <= 1,
  );

  // Speeding away aborts.
  const sp = createArrivalController(SESSION, VERIFIED_DEST);
  sp.observe(
    obsAt({
      tMs: T0,
      match: endMatch({ routeMile: TOTAL - 0.3, confidence: 'high' }),
      speedMph: 20,
    }),
  );
  sp.observe(obsAt({ tMs: T0 + 3000 }));
  const sped = sp.observe(
    obsAt({ tMs: T0 + 6000, speedMph: 35, match: endMatch({ confidence: 'high' }) }),
  );
  check('abort: speeding up dissolves the candidate', sped.state === 'final-approach');

  // Blocked entrance: loitering 400 m from the gate at 2 mph forever —
  // never a false arrival, never a crash.
  const b = createArrivalController(SESSION, VERIFIED_DEST);
  b.observe(
    obsAt({
      tMs: T0,
      match: endMatch({ routeMile: TOTAL - 0.3, confidence: 'high' }),
      speedMph: 20,
    }),
  );
  const blockedPos = { lat: ROUTE_END.lat, lng: ROUTE_END.lng + 400 / mPerDegLng };
  for (let i = 1; i <= 20; i++)
    b.observe(obsAt({ tMs: T0 + i * 5000, position: blockedPos, speedMph: 2 }));
  check(
    'blocked: 20 loitering fixes outside the gate never arrive',
    b.snapshot().state === 'final-approach' && b.summary() === null,
  );

  // Cancellation mid-approach.
  const c = createArrivalController(SESSION, VERIFIED_DEST);
  c.observe(
    obsAt({
      tMs: T0,
      match: endMatch({ routeMile: TOTAL - 0.3, confidence: 'high' }),
      speedMph: 20,
    }),
  );
  const summary = c.cancel(T0 + 5000);
  check(
    'cancel: driver cancellation completes honestly, never as an arrival',
    summary.endReason === 'cancelled' && Object.isFrozen(summary),
  );
  check('cancel: controller inert afterwards', c.observe(obsAt({ tMs: T0 + 9000 })).completed);
}

// ------------- Block 2 / priority E: arrival evidence must be sustained
{
  /*
   * A truck hunting for the dock inside a large yard: it circles at
   * 19 mph — below the 20 mph abort — and stops briefly at stop signs.
   * Every stop is a qualifying fix. Before the fix, those three stops
   * accumulated across four minutes and arrival was DECLARED while the
   * truck was still driving around, because elapsed time was measured
   * from the first stop and the rolling fixes in between were treated as
   * "ambiguous" and left the tally alone.
   */
  const yard = createArrivalController(SESSION, VERIFIED_DEST);
  yard.observe(
    obsAt({
      tMs: T0,
      match: endMatch({ routeMile: TOTAL - 0.3, confidence: 'high' }),
      speedMph: 20,
    }),
  );
  check('yard: in the approach window', yard.snapshot().state === 'final-approach');

  let t = T0 + 5_000;
  let declaredEarly = false;
  for (let stop = 0; stop < 3; stop += 1) {
    // A brief stop at a stop sign — a qualifying fix.
    const s = yard.observe(obsAt({ tMs: t, speedMph: 2 }));
    if (s.completed) declaredEarly = true;
    t += 60_000;
    // …then a full minute of rolling around the yard at 19 mph.
    for (let i = 0; i < 6; i += 1) {
      const r = yard.observe(obsAt({ tMs: t - 60_000 + i * 10_000 + 5_000, speedMph: 19 }));
      if (r.completed) declaredEarly = true;
    }
  }
  check('yard: never declared arrived while still rolling', !declaredEarly);
  check('yard: no summary exists', yard.summary() === null);
  check(
    'yard: rolling fixes reset the tally rather than holding it',
    yard.snapshot().qualifyingFixes === 0,
    yard.snapshot(),
  );

  // And the ordinary pull-in still arrives: park, and stay parked.
  const parked = createArrivalController(SESSION, VERIFIED_DEST);
  parked.observe(
    obsAt({
      tMs: t,
      match: endMatch({ routeMile: TOTAL - 0.3, confidence: 'high' }),
      speedMph: 20,
    }),
  );
  parked.observe(obsAt({ tMs: t + 1_000, speedMph: 3 }));
  parked.observe(obsAt({ tMs: t + 6_000, speedMph: 1 }));
  const done = parked.observe(obsAt({ tMs: t + 12_000, speedMph: 0 }));
  check('yard: a genuine pull-in still arrives', done.state === 'arrived' && done.completed);

  /*
   * Evidence restarted after a reset must still be able to complete: the
   * episode clock has to restart with it, or `elapsed` stays measured
   * from a null start and the truck can sit at the dock forever without
   * ever being told it has arrived.
   */
  const restart = createArrivalController(SESSION, VERIFIED_DEST);
  restart.observe(
    obsAt({
      tMs: t,
      match: endMatch({ routeMile: TOTAL - 0.3, confidence: 'high' }),
      speedMph: 20,
    }),
  );
  restart.observe(obsAt({ tMs: t + 1_000, speedMph: 2 })); // candidate
  restart.observe(obsAt({ tMs: t + 3_000, speedMph: 19 })); // reset
  restart.observe(obsAt({ tMs: t + 5_000, speedMph: 2 }));
  restart.observe(obsAt({ tMs: t + 10_000, speedMph: 1 }));
  const after = restart.observe(obsAt({ tMs: t + 16_000, speedMph: 0 }));
  check(
    'yard: parking after a reset still completes',
    after.completed && after.state === 'arrived',
  );
}

// -------------------------------- integration: the composed N8 stack
async function integration() {
  const port = async (req: ReplacementRequest): Promise<ReplacementFetchResult> => {
    const n = 400;
    const positions: LatLng[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      positions.push({
        lat: req.origin.lat + (req.destination.lat - req.origin.lat) * t,
        lng: req.origin.lng + (req.destination.lng - req.origin.lng) * t,
      });
    }
    const miles = Math.max(
      0.5,
      Number((Math.abs(req.destination.lat - req.origin.lat) * 69.0937).toFixed(1)),
    );
    return {
      kind: 'route',
      positions,
      distanceMiles: miles,
      durationSeconds: Math.max(60, Math.round((miles / 55) * 3600)),
      maneuvers: [{ action: 'depart', instruction: 'Go.', direction: null, offset: 0 }],
      validationState: 'valid',
    };
  };

  // e2e: drive the real stack to the destination and arrive.
  {
    const nav = createNavigationSession(SESSION, VERIFIED_DEST, port);
    let t = T0;
    // Roll down the route at a PHYSICAL cadence: 0.15 mi per 9 s = 60 mph.
    const atMile = (mile: number): LatLng => {
      let idx = 0;
      while (idx + 1 < SESSION.geometry.length && SESSION.geometry[idx + 1].routeMile <= mile)
        idx++;
      return SESSION.geometry[idx].position;
    };
    for (let mile = 0.15; mile <= 68.9; mile += 0.15) {
      t += 9000;
      nav.ingest({ position: atMile(mile), headingDeg: 0, speedMph: 60, accuracyM: 8, tMs: t });
    }
    let snap = nav.snapshot();
    check(
      'e2e: real drive reaches final approach',
      snap.arrival?.state === 'final-approach' || snap.arrival?.state === 'arrival-candidate',
      snap.arrival?.state,
    );
    // Creep to the gate.
    for (let i = 0; i < 5; i++) {
      t += 4000;
      snap = nav.ingest({
        position: ROUTE_END,
        headingDeg: null,
        speedMph: 3,
        accuracyM: 8,
        tMs: t,
      });
    }
    check(
      'e2e: the composed stack ARRIVES',
      snap.summary?.endReason === 'arrived',
      snap.arrival?.state,
    );
    check('e2e: session inactive after arrival', !nav.isActive() && snap.active === false);
    check(
      'e2e: summary immutable and complete',
      Object.isFrozen(nav.summary()) && nav.summary()!.plannedMiles === TOTAL,
    );
    const inert = nav.ingest({
      position: ROUTE_END,
      headingDeg: 0,
      speedMph: 60,
      accuracyM: 8,
      tMs: t + 60_000,
    });
    check(
      'e2e: ingest after completion is structurally inert',
      inert.active === false && inert.match === null,
    );
    const noSpend = await nav.maybeReroute(t + 61_000, 8);
    check(
      'e2e: rerouting refused after completion (no spend possible)',
      noSpend.outcome === 'not-eligible',
    );
  }

  // Reroute mid-trip through the composed stack, then keep navigating.
  {
    const nav = createNavigationSession(SESSION, VERIFIED_DEST, port);
    let t = T0;
    for (let i = 0; i < 4; i++) {
      t += 3000;
      let idx = 0;
      while (
        idx + 1 < SESSION.geometry.length &&
        SESSION.geometry[idx + 1].routeMile <= 5 + i * 0.05
      )
        idx++;
      nav.ingest({
        position: SESSION.geometry[idx].position,
        headingDeg: 0,
        speedMph: 60,
        accuracyM: 8,
        tMs: t,
      });
    }
    // Sustained departure 300 m east → detector confirms.
    const eastLng = LNG0 + 300 / mPerDegLng;
    for (let i = 0; i < 5; i++) {
      t += 3000;
      nav.ingest({
        position: { lat: LAT0 + 0.075 + i * 0.001, lng: eastLng },
        headingDeg: 0,
        speedMph: 55,
        accuracyM: 8,
        tMs: t,
      });
    }
    check(
      'e2e-reroute: detector confirmed through the composition',
      nav.snapshot().detector?.state === 'confirmed',
    );
    const result = await nav.maybeReroute(t + 1000, 8);
    check(
      'e2e-reroute: replacement succeeds through the caged controller',
      result.outcome === 'replaced',
    );
    check(
      'e2e-reroute: the stack rebuilt on the new route',
      nav.snapshot().routeId === 'trip-arrive-r1' && nav.isActive(),
    );
    const early = await nav.maybeReroute(t + 2000, 8);
    check(
      'e2e-reroute: fresh detector means no immediate second spend',
      early.outcome === 'refused' || early.outcome === 'not-eligible',
    );
  }

  // Cancellation through the composition: cleanup observable.
  {
    const nav = createNavigationSession(SESSION, VERIFIED_DEST, port);
    nav.ingest({
      position: SESSION.geometry[10].position,
      headingDeg: 0,
      speedMph: 60,
      accuracyM: 8,
      tMs: T0,
    });
    const summary = nav.cancel(T0 + 5000);
    check(
      'e2e-cancel: summary cancelled + frozen',
      summary.endReason === 'cancelled' && Object.isFrozen(summary),
    );
    check(
      'e2e-cancel: engines released (inert snapshot, no detector/arrival state)',
      nav.snapshot().detector === null && nav.snapshot().arrival === null && !nav.isActive(),
    );
    check('e2e-cancel: cancel idempotent', nav.cancel(T0 + 9000) === summary);
  }
}

// ------------------------------------------- measured performance/memory
async function perf() {
  (globalThis as { gc?: () => void }).gc?.();
  const heapBefore = process.memoryUsage().heapUsed;

  // Entrance evaluation cost.
  const e0 = performance.now();
  for (let i = 0; i < 10_000; i++) evaluateEntrance(VERIFIED_DEST, ROUTE_END);
  const entranceUs = ((performance.now() - e0) / 10_000) * 1000;

  // Long session: 100k arrival observations (worst-case: hovering in the
  // approach window), then arrival, completion, and cleanup.
  const a = createArrivalController(SESSION, VERIFIED_DEST);
  const l0 = performance.now();
  let t = T0;
  for (let i = 0; i < 100_000; i++) {
    t += 1000;
    a.observe(
      obsAt({
        tMs: t,
        speedMph: 20,
        match: endMatch({ routeMile: TOTAL - 0.3, confidence: 'high' }),
      }),
    );
  }
  const longMs = performance.now() - l0;

  // Arrival detection latency: from first qualifying fix to terminal.
  const d0 = performance.now();
  for (let i = 1; i <= 4; i++) a.observe(obsAt({ tMs: t + i * 4000 }));
  const detectMs = performance.now() - d0;
  check('perf: hovering long session ends arrived', a.snapshot().state === 'arrived');

  // Completion/cleanup time through the composed session (cancel path).
  const nav = createNavigationSession(SESSION, VERIFIED_DEST, async () => ({
    kind: 'failure',
    reason: 'x',
  }));
  nav.ingest({
    position: SESSION.geometry[10].position,
    headingDeg: 0,
    speedMph: 60,
    accuracyM: 8,
    tMs: T0,
  });
  const c0 = performance.now();
  nav.cancel(T0 + 5000);
  const cleanupMs = performance.now() - c0;

  (globalThis as { gc?: () => void }).gc?.();
  const heapAfter = process.memoryUsage().heapUsed;

  console.log(
    `measured: entrance eval ${entranceUs.toFixed(1)} µs · 100k-obs long session ${longMs.toFixed(0)} ms ` +
      `(${((longMs / 100_000) * 1000).toFixed(1)} µs/obs) · arrival detection (4 obs) ${detectMs.toFixed(2)} ms · ` +
      `completion+cleanup ${cleanupMs.toFixed(2)} ms · retained heap after gc ${((heapAfter - heapBefore) / 1048576).toFixed(1)} MB`,
  );
  check('perf: entrance evaluation < 1 ms', entranceUs < 1000, entranceUs);
  check('perf: long-session observe average < 50 µs', longMs / 100_000 < 0.05, longMs / 100_000);
  check('perf: completion + cleanup < 50 ms', cleanupMs < 50, cleanupMs);
  check(
    'perf: retained heap after a 100k-obs session + cleanup < 50 MB',
    heapAfter - heapBefore < 50 * 1048576,
  );
}

async function main() {
  await integration();
  await perf();
  console.log(`navigator-arrival: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
