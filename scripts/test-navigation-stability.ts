/**
 * Navigation stability under REAL GPS conditions (10-hour block, P5–P7).
 *
 * Every other navigator harness tests one module against hand-written
 * inputs. This one drives the WHOLE production stack — gps-session gate →
 * navigation-lifecycle → (controller = tracker + maneuver engine) and
 * (navigation-session = matcher + off-route detector + reroute controller
 * + arrival) → maneuver announcer — from a synthetic but noisy position
 * stream, and asserts the things a driver actually notices:
 *
 *   - the route mile never runs backwards on jitter,
 *   - the next-maneuver card never flips back to a maneuver already
 *     passed, and never oscillates between two maneuvers,
 *   - the same spoken instruction never comes back because of jitter,
 *   - a lane change or a frontage-road-width wobble never reroutes,
 *   - a real, sustained departure reroutes exactly ONCE,
 *   - and nothing from trip 1 survives into trip 2.
 *
 * The position stream is deterministic: a seeded LCG, no Math.random, so a
 * failure here reproduces exactly. Noise magnitudes are stated in meters
 * at each call site rather than buried in a constant, because the whole
 * point is which magnitude breaks which invariant.
 *
 * Run:
 *   npx esbuild scripts/test-navigation-stability.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-nav-stability.cjs \
 *   && node /tmp/test-nav-stability.cjs
 */
import { createGpsSession, type GpsSession } from '@/lib/navigator/gps-session';
import {
  createNavigationLifecycle,
  MAX_TRANSITION_LOG,
  type NavigationLifecycle,
  type PlanFetchResult,
  type PlanRequest,
} from '@/lib/navigator/navigation-lifecycle';
import type {
  ReplacementRequest,
  ReplacementFetchResult,
} from '@/lib/navigator/reroute-controller';
import { createManeuverAnnouncer } from '@/lib/navigator/voice-guidance';
import type { DestinationInfo } from '@/lib/navigator/truck-entrance';
import type { TruckProfile } from '@/lib/trip-planner/types';
import type { LatLng } from '@/lib/map/bounds';
import type { PositionState } from '@/lib/navigator/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

// ---------------------------------------------------------------- geometry

const MI_PER_DEG_LAT = 69.0937;
const M_PER_MI = 1609.344;
function miPerDegLng(lat: number): number {
  return MI_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

type Leg = { northMi: number; eastMi: number };

type BuiltRoute = {
  positions: LatLng[];
  /** Cumulative route mile of positions[i]. */
  miles: number[];
  /** Index of the point ending each leg (the turn points). */
  legEndIndex: number[];
  totalMi: number;
};

/**
 * A polyline made of straight legs, sampled at `spacingMi`. Straight legs
 * are deliberate: a curve would let the matcher's lateral distance absorb
 * noise that a straight road exposes, which is the harder case.
 */
function buildRoute(startLat: number, startLng: number, legs: Leg[], spacingMi = 0.01): BuiltRoute {
  const positions: LatLng[] = [];
  const miles: number[] = [];
  const legEndIndex: number[] = [];
  let lat = startLat;
  let lng = startLng;
  let mile = 0;
  positions.push({ lat, lng });
  miles.push(0);
  for (const leg of legs) {
    const legMi = Math.hypot(leg.northMi, leg.eastMi);
    const steps = Math.max(1, Math.round(legMi / spacingMi));
    const dLat = leg.northMi / MI_PER_DEG_LAT / steps;
    const dLng = leg.eastMi / miPerDegLng(lat) / steps;
    for (let s = 0; s < steps; s++) {
      lat += dLat;
      lng += dLng;
      mile += legMi / steps;
      positions.push({ lat, lng });
      miles.push(mile);
    }
    legEndIndex.push(positions.length - 1);
  }
  return { positions, miles, legEndIndex, totalMi: mile };
}

/** Interpolated position at a route mile, plus the local bearing unit vector. */
function atMile(
  route: BuiltRoute,
  mi: number,
): { pos: LatLng; northUnit: number; eastUnit: number } {
  const clamped = Math.min(Math.max(mi, 0), route.totalMi);
  let i = 0;
  while (i + 1 < route.miles.length && route.miles[i + 1] < clamped) i++;
  const j = Math.min(i + 1, route.positions.length - 1);
  const span = route.miles[j] - route.miles[i];
  const t = span <= 0 ? 0 : (clamped - route.miles[i]) / span;
  const a = route.positions[i];
  const b = route.positions[j];
  const pos = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
  const northMi = (b.lat - a.lat) * MI_PER_DEG_LAT;
  const eastMi = (b.lng - a.lng) * miPerDegLng(a.lat);
  const len = Math.hypot(northMi, eastMi) || 1;
  return { pos, northUnit: northMi / len, eastUnit: eastMi / len };
}

/** Offset a position by meters north and east. */
function offsetM(p: LatLng, northM: number, eastM: number): LatLng {
  return {
    lat: p.lat + northM / M_PER_MI / MI_PER_DEG_LAT,
    lng: p.lng + eastM / M_PER_MI / miPerDegLng(p.lat),
  };
}

/**
 * The tail of a route from `fromMi`, shifted `lateralM` to the right of
 * travel and rejoining the true destination at the end. This is what a
 * replacement route looks like when the truck has genuinely moved onto a
 * parallel road: it starts where the truck is, not where the truck was.
 */
function offsetRouteTail(
  route: BuiltRoute,
  fromMi: number,
  lateralM: number,
  destination: LatLng,
): LatLng[] {
  const out: LatLng[] = [];
  for (let mi = fromMi; mi < route.totalMi - 0.2; mi += 0.01) {
    const { pos, northUnit, eastUnit } = atMile(route, mi);
    out.push(offsetM(pos, -eastUnit * lateralM, northUnit * lateralM));
  }
  out.push({ ...destination });
  return out;
}

function bearingOf(northUnit: number, eastUnit: number): number {
  const deg = (Math.atan2(eastUnit, northUnit) * 180) / Math.PI;
  return (deg + 360) % 360;
}

// ------------------------------------------------------------------- rng

/** Seeded LCG. Deterministic runs matter more than statistical purity. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// -------------------------------------------------------------- fixtures

const T0 = 1_754_000_000_000;
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

/** 3 mi north, 3 mi east, 2 mi north: two hard turns, 8 miles total. */
const ROUTE_A = buildRoute(35.0, -85.0, [
  { northMi: 3, eastMi: 0 },
  { northMi: 0, eastMi: 3 },
  { northMi: 2, eastMi: 0 },
]);

/** A different shape entirely, so trip-2 contamination is unmistakable. */
const ROUTE_B = buildRoute(36.5, -86.5, [
  { northMi: 0, eastMi: 2 },
  { northMi: -2.5, eastMi: 0 },
]);

function planResultFor(route: BuiltRoute, routeId: string): PlanFetchResult {
  const maneuvers = [
    { action: 'depart', instruction: 'Head north on Depot Road.', direction: null, offset: 0 },
    ...route.legEndIndex.slice(0, -1).map((idx, n) => ({
      action: 'turn',
      instruction: n === 0 ? 'Turn right onto Old Mill Road.' : 'Turn left onto Ridge Highway.',
      direction: n === 0 ? ('right' as const) : ('left' as const),
      offset: idx,
    })),
    {
      action: 'arrive',
      instruction: 'Arrive at the receiving gate.',
      direction: null,
      offset: route.positions.length - 1,
    },
  ];
  return {
    kind: 'route',
    routeId,
    positions: route.positions,
    distanceMiles: Number(route.totalMi.toFixed(1)),
    durationSeconds: Math.round((route.totalMi / 50) * 3600),
    maneuvers,
    validationState: 'valid',
    warnings: [],
  };
}

function destinationFor(route: BuiltRoute): DestinationInfo {
  return {
    position: route.positions[route.positions.length - 1],
    facility: 'distribution-center',
    positionSource: 'geocode',
  };
}

type Rig = {
  gps: GpsSession;
  life: NavigationLifecycle;
  announcer: ReturnType<typeof createManeuverAnnouncer>;
  spoken: string[];
  providerCalls: () => number;
  /**
   * One monotonic clock for the whole rig. Each `drive()` segment resumes
   * where the last one stopped — the GPS gate discards any fix whose
   * timestamp is not newer than the last ACCEPTED one, so a per-segment
   * clock would silently throw away every fix after the first segment
   * and the harness would "pass" by testing nothing.
   */
  clockMs: number;
};

/**
 * Build and START a trip. `replacement` scripts the reroute port; the
 * default one is never called in scenarios that must not reroute, which
 * is itself the assertion (providerCalls stays 0).
 */
async function startTrip(
  route: BuiltRoute,
  routeId: string,
  replacement?: (req: ReplacementRequest, call: number) => ReplacementFetchResult,
): Promise<Rig> {
  let calls = 0;
  const life = createNavigationLifecycle({
    planPort: async (_req: PlanRequest) => planResultFor(route, routeId),
    replacementPort: async (req) => {
      calls += 1;
      return replacement
        ? replacement(req, calls)
        : { kind: 'failure', reason: 'no-replacement-scripted' };
    },
  });
  const outcome = await life.plan(
    {
      origin: route.positions[0],
      destination: route.positions[route.positions.length - 1],
      truck: TRUCK,
      departAtMs: T0,
    },
    destinationFor(route),
    T0,
  );
  if (!outcome.ok) throw new Error(`plan fixture failed: ${outcome.reason}`);
  if (!life.startNavigation(T0 + 1000)) throw new Error('startNavigation refused');
  return {
    gps: createGpsSession(),
    life,
    announcer: createManeuverAnnouncer(),
    spoken: [],
    providerCalls: () => calls,
    clockMs: T0 + 2000,
  };
}

type DriveOptions = {
  /** Route mile at the first fix. */
  fromMi: number;
  /** Ground speed, mph. Zero means parked. */
  speedMph: number;
  /** Number of 1 Hz fixes. */
  fixes: number;
  /** Uniform position noise amplitude, meters (±). */
  jitterM: number;
  /**
   * Deliberate lateral offset from the route centerline, meters. When
   * `lateralRamp` is set the offset grows linearly from 0 to this value
   * across the segment — which is how a truck actually leaves a route
   * (an off-ramp, a wrong fork), and the only way the GPS gate will
   * accept it: an instantaneous 300 m sidestep implies ~700 mph and is
   * correctly discarded as a teleport for as long as it takes the
   * growing time gap to make it plausible again.
   */
  lateralM?: number;
  lateralRamp?: boolean;
  /** Reported accuracy, meters. */
  accuracyM?: number;
  /** Omit device speed so the gate derives it from displacement. */
  noDeviceSpeed?: boolean;
  seed: number;
  /**
   * Called after each tick, AWAITED. Scenarios that request a reroute do
   * it here rather than in a loop over the returned samples: a reroute
   * replaces the route, and every fix after it has to be matched against
   * the NEW route to mean anything. Replaying finished samples would
   * only ever produce one request, which is a green test that proves
   * nothing.
   */
  onTick?: (sample: TickSample) => void | Promise<void>;
};

type TickSample = {
  tMs: number;
  routeMile: number | null;
  nextMile: number | null;
  nextInstruction: string | null;
  status: string;
  lifecycleState: string;
  detector: string | null;
  accepted: boolean;
};

/** Drive the rig along the route; returns every tick's observable state. */
async function drive(rig: Rig, route: BuiltRoute, opts: DriveOptions): Promise<TickSample[]> {
  const rng = makeRng(opts.seed);
  const samples: TickSample[] = [];
  let mi = opts.fromMi;
  const perFixMi = opts.speedMph / 3600;
  for (let i = 0; i < opts.fixes; i++) {
    rig.clockMs += 1000;
    const tMs = rig.clockMs;
    const { pos, northUnit, eastUnit } = atMile(route, mi);
    const target = opts.lateralM ?? 0;
    const lateral = opts.lateralRamp ? (target * (i + 1)) / opts.fixes : target;
    // Perpendicular to travel, right-hand side.
    const withLateral = offsetM(pos, -eastUnit * lateral, northUnit * lateral);
    const noisy = offsetM(
      withLateral,
      (rng() * 2 - 1) * opts.jitterM,
      (rng() * 2 - 1) * opts.jitterM,
    );
    const before = rig.gps.state();
    const state: PositionState = rig.gps.ingestFix({
      lat: noisy.lat,
      lng: noisy.lng,
      accuracyM: opts.accuracyM ?? 10,
      speedMps: opts.noDeviceSpeed ? null : opts.speedMph / 2.236936,
      headingDeg: opts.speedMph > 2 ? bearingOf(northUnit, eastUnit) : null,
      tMs,
    });
    const accepted = state !== before;
    const snap = rig.life.tick(state, tMs);
    const view = rig.life.view();
    // Mirrors DrivingScreen: maneuvers speak only when there ARE
    // maneuvers. The view carries null for one tick after a reroute
    // swaps in a fresh controller, before the next fix lands.
    if (view.maneuvers !== null) {
      for (const req of rig.announcer.collect(view.maneuvers, view.speedMph)) {
        rig.spoken.push(req.text);
      }
    }
    const sample: TickSample = {
      tMs,
      routeMile: view.routeMile,
      nextMile: view.maneuvers?.next?.mileMi ?? null,
      nextInstruction: view.maneuvers?.next?.instruction ?? null,
      status: view.status,
      lifecycleState: snap.state,
      detector: snap.navigation?.detector?.state ?? null,
      accepted,
    };
    samples.push(sample);
    await opts.onTick?.(sample);
    mi += perFixMi;
  }
  return samples;
}

/** How many times the next-maneuver card CHANGED, and did it ever go back? */
function maneuverChurn(samples: TickSample[]): { changes: number; regressions: number } {
  let changes = 0;
  let regressions = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1].nextMile;
    const b = samples[i].nextMile;
    if (a === b) continue;
    changes += 1;
    if (a !== null && b !== null && b < a) regressions += 1;
  }
  return { changes, regressions };
}

function monotonicMile(samples: TickSample[]): number {
  let violations = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1].routeMile;
    const b = samples[i].routeMile;
    if (a !== null && b !== null && b < a - 1e-9) violations += 1;
  }
  return violations;
}

function duplicates(list: string[]): string[] {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const s of list) {
    if (seen.has(s)) dupes.push(s);
    seen.add(s);
  }
  return dupes;
}

async function main() {
  // ================================================================== P5
  // Scenario 1 — parked at a truck stop, 20 fixes of ±12 m drift.
  // A stationary truck is the purest oscillation test: every observable
  // must be frozen even though no two fixes are the same point.
  {
    const rig = await startTrip(ROUTE_A, 'trip-parked');
    const s = await drive(rig, ROUTE_A, {
      fromMi: 1.5,
      speedMph: 0,
      fixes: 20,
      jitterM: 12,
      seed: 11,
    });
    const churn = maneuverChurn(s);
    const spread = Math.max(...s.map((x) => x.routeMile ?? 0)) - (s[0].routeMile ?? 0);
    check('parked: route mile never runs backwards', monotonicMile(s) === 0);
    check('parked: route mile creeps < 0.02 mi under 12 m drift', spread < 0.02, spread);
    check('parked: next maneuver never changes', churn.changes === 0, churn);
    check(
      'parked: detector stays on-route',
      s.every((x) => x.detector === 'on-route'),
      s.map((x) => x.detector).filter((d, i, a) => a.indexOf(d) === i),
    );
    check(
      'parked: lifecycle stays navigating',
      s.every((x) => x.lifecycleState === 'navigating'),
    );
    check('parked: nothing is spoken', rig.spoken.length === 0, rig.spoken);
  }

  // Scenario 2 — crawling at 8 mph in a yard queue with ±12 m drift.
  {
    const rig = await startTrip(ROUTE_A, 'trip-crawl');
    const s = await drive(rig, ROUTE_A, {
      fromMi: 1.2,
      speedMph: 8,
      fixes: 60,
      jitterM: 12,
      seed: 23,
    });
    const churn = maneuverChurn(s);
    check('crawl: route mile monotonic', monotonicMile(s) === 0);
    check('crawl: next maneuver never regresses', churn.regressions === 0, churn);
    check(
      'crawl: detector never leaves on-route',
      s.every((x) => x.detector === 'on-route'),
    );
    check('crawl: no repeated instruction', duplicates(rig.spoken).length === 0, rig.spoken);
  }

  // Scenario 3 — the full 8-mile route at highway speed through both
  // turns. 6 m amplitude keeps the 1 Hz displacement under the gate's
  // 100 mph teleport ceiling (measured separately in scenario 3b).
  {
    const rig = await startTrip(ROUTE_A, 'trip-highway');
    const s = await drive(rig, ROUTE_A, {
      fromMi: 0,
      speedMph: 65,
      fixes: 440,
      jitterM: 6,
      seed: 37,
    });
    const churn = maneuverChurn(s);
    check('highway: route mile monotonic', monotonicMile(s) === 0);
    check('highway: next maneuver never regresses', churn.regressions === 0, churn);
    check('highway: maneuver card changes at most once per maneuver', churn.changes <= 4, churn);
    check(
      'highway: detector never falsely confirms off-route',
      s.every((x) => x.detector !== 'confirmed'),
      s.filter((x) => x.detector === 'confirmed').length,
    );
    check('highway: no instruction spoken twice', duplicates(rig.spoken).length === 0, rig.spoken);
    check(
      'highway: every maneuver is announced at least once',
      ['Old Mill', 'Ridge Highway', 'receiving gate'].every((frag) =>
        rig.spoken.some((t) => t.includes(frag)),
      ),
      rig.spoken,
    );
  }

  // Scenario 3b — MEASUREMENT, not an invariant: how many 1 Hz fixes the
  // 100 mph teleport gate discards at highway speed as noise grows. This
  // is the gate doing its job on a stream it was not sized for; the
  // number is reported so the pilot has it, and asserted only loosely.
  {
    const rows: { jitterM: number; acceptedPct: number }[] = [];
    for (const jitterM of [3, 6, 10, 15, 20]) {
      const rig = await startTrip(ROUTE_A, `trip-gate-${jitterM}`);
      const s = await drive(rig, ROUTE_A, {
        fromMi: 0,
        speedMph: 65,
        fixes: 120,
        jitterM,
        seed: 101 + jitterM,
      });
      const accepted = s.filter((x) => x.accepted).length;
      rows.push({ jitterM, acceptedPct: Math.round((accepted / s.length) * 100) });
    }
    console.log(
      `  measured 1 Hz acceptance at 65 mph: ${rows
        .map((r) => `±${r.jitterM}m=${r.acceptedPct}%`)
        .join(' ')}`,
    );
    const clean = rows.find((r) => r.jitterM === 3)!;
    check('gate: clean 65 mph stream is accepted in full', clean.acceptedPct >= 99, clean);
  }

  // Scenario 4 — the oscillation-prone moment: 25 mph straight through
  // the first turn with ±15 m noise, the magnitude that most easily
  // projects a fix back onto the leg just left.
  {
    const rig = await startTrip(ROUTE_A, 'trip-turn');
    const s = await drive(rig, ROUTE_A, {
      fromMi: 2.6,
      speedMph: 25,
      fixes: 130,
      jitterM: 15,
      seed: 59,
    });
    const churn = maneuverChurn(s);
    const passedTurnAt = s.findIndex((x) => (x.nextMile ?? 0) > 3.5);
    check('turn: route mile monotonic through the corner', monotonicMile(s) === 0);
    check('turn: next maneuver never regresses', churn.regressions === 0, churn);
    check('turn: the turn is actually passed', passedTurnAt > 0, passedTurnAt);
    check(
      'turn: once passed, the turn never returns as next',
      passedTurnAt < 0 || s.slice(passedTurnAt).every((x) => (x.nextMile ?? 0) > 3.5),
    );
    check('turn: no repeated instruction', duplicates(rig.spoken).length === 0, rig.spoken);
  }

  // Scenario 5 — leave the route for real, then come back. The detector
  // must confirm once, recover once, and the LIFECYCLE must not flap.
  {
    const rig = await startTrip(ROUTE_A, 'trip-excursion');
    const states: string[] = [];
    const record = (x: TickSample) => {
      if (states[states.length - 1] !== x.lifecycleState) states.push(x.lifecycleState);
    };
    await drive(rig, ROUTE_A, {
      fromMi: 0.5,
      speedMph: 60,
      fixes: 30,
      jitterM: 5,
      seed: 71,
      onTick: record,
    });
    await drive(rig, ROUTE_A, {
      fromMi: 1.0,
      speedMph: 55,
      fixes: 20,
      jitterM: 5,
      lateralM: 260,
      lateralRamp: true,
      seed: 73,
      onTick: record,
    });
    const back = await drive(rig, ROUTE_A, {
      fromMi: 1.3,
      speedMph: 55,
      fixes: 40,
      jitterM: 5,
      seed: 79,
      onTick: record,
    });
    check('excursion: lifecycle reached off-route', states.includes('off-route'), states);
    check(
      'excursion: lifecycle returned to navigating',
      back[back.length - 1].lifecycleState === 'navigating',
      back[back.length - 1],
    );
    check('excursion: at most 3 lifecycle transitions', states.length <= 3, states);
    check('excursion: route mile never ran backwards', monotonicMile(back) === 0);
    check('excursion: no reroute was requested (caller never asked)', rig.providerCalls() === 0);
  }

  // ================================================================== P6
  // Scenario 6 — hypersensitivity guard. A 60 m lateral wobble (a wide
  // shoulder, a frontage lane, a fix biased by a building) held for six
  // fixes must NOT confirm off-route and must never reach the provider.
  {
    const rig = await startTrip(ROUTE_A, 'trip-wobble', () => {
      throw new Error('provider must not be called for a 60 m wobble');
    });
    await drive(rig, ROUTE_A, { fromMi: 0.5, speedMph: 60, fixes: 20, jitterM: 5, seed: 83 });
    let requested = 0;
    const wobble = await drive(rig, ROUTE_A, {
      fromMi: 0.85,
      speedMph: 60,
      fixes: 12,
      jitterM: 5,
      lateralM: 60,
      lateralRamp: true,
      seed: 89,
      onTick: async (s) => {
        if (rig.life.state() !== 'off-route') return;
        requested += 1;
        await rig.life.requestReroute(s.tMs, 10);
      },
    });
    check(
      'wobble: never confirmed off-route',
      requested === 0,
      wobble.map((w) => w.detector),
    );
    check('wobble: provider never called', rig.providerCalls() === 0);
  }

  // Scenario 7 — a sustained departure, then the driver FOLLOWS the
  // replacement. One reroute, the map switches to the new line, and no
  // second call is spent for the rest of the trip.
  //
  // The replacement is built to follow where the truck actually is (the
  // route it left, shifted onto the truck's new line). A scripted
  // replacement the truck then drives away from would reroute again and
  // again — correctly — and would test nothing about spend discipline.
  const DEPART_LATERAL_M = 400;
  {
    const rig = await startTrip(ROUTE_A, 'trip-depart', (req) => {
      const positions = offsetRouteTail(ROUTE_A, 1.0, DEPART_LATERAL_M, req.destination);
      positions[0] = { ...req.origin };
      return {
        kind: 'route',
        positions,
        distanceMiles: Number((ROUTE_A.totalMi - 1.0).toFixed(1)),
        durationSeconds: 600,
        maneuvers: [
          { action: 'depart', instruction: 'Continue to rejoin.', direction: null, offset: 0 },
          {
            action: 'arrive',
            instruction: 'Arrive at the receiving gate.',
            direction: null,
            offset: positions.length - 1,
          },
        ],
        validationState: 'valid',
        warnings: [],
      };
    });
    const beforeId = rig.life.mapData().routeId;
    const beforeGeometry = rig.life.mapData().geometry.length;
    await drive(rig, ROUTE_A, { fromMi: 0.5, speedMph: 60, fixes: 25, jitterM: 5, seed: 97 });

    let replacements = 0;
    let sawOffRoute = false;
    const onTick = async (s: TickSample) => {
      if (s.lifecycleState === 'off-route') sawOffRoute = true;
      if (rig.life.state() !== 'off-route') return;
      const r = await rig.life.requestReroute(s.tMs, 10);
      if (r.outcome === 'replaced') replacements += 1;
    };
    // Diverge…
    await drive(rig, ROUTE_A, {
      fromMi: 1.0,
      speedMph: 60,
      fixes: 25,
      jitterM: 5,
      lateralM: DEPART_LATERAL_M,
      lateralRamp: true,
      seed: 101,
      onTick,
    });
    // …then hold the new line for two more minutes, which is the
    // replacement route. Nothing further may be spent.
    const callsAfterFirstLeg = rig.providerCalls();
    await drive(rig, ROUTE_A, {
      fromMi: 1.42,
      speedMph: 60,
      fixes: 120,
      jitterM: 5,
      lateralM: DEPART_LATERAL_M,
      seed: 103,
      onTick,
    });

    const after = rig.life.mapData();
    check('departure: confirmed off-route', sawOffRoute);
    check('departure: exactly one replacement', replacements === 1, replacements);
    check(
      'departure: provider called exactly once',
      rig.providerCalls() === 1,
      rig.providerCalls(),
    );
    check(
      'departure: nothing more spent once the driver follows the new route',
      rig.providerCalls() === callsAfterFirstLeg,
      { callsAfterFirstLeg, total: rig.providerCalls() },
    );
    check('departure: route identity changed', beforeId !== after.routeId, {
      beforeId,
      after: after.routeId,
    });
    check(
      'departure: map carries the replacement geometry, not the old one',
      after.geometry.length !== beforeGeometry && after.geometry.length > 2,
      { before: beforeGeometry, after: after.geometry.length },
    );
    check('departure: back to navigating', rig.life.state() === 'navigating', rig.life.state());
    check(
      'departure: no lifecycle violations',
      rig.life.violations().length === 0,
      rig.life.violations(),
    );
  }

  // Scenario 7b — MEASURED sensitivity ladder: the lateral distance at
  // which a SUSTAINED deviation confirms. Printed rather than pinned to a
  // single number, because the useful property is the shape: nothing
  // inside a wide roadway confirms, everything clearly off it does.
  {
    const ladder: { lateralM: number; confirmed: boolean }[] = [];
    for (const lateralM of [20, 40, 60, 74, 90, 160, 300]) {
      const rig = await startTrip(ROUTE_A, `trip-ladder-${lateralM}`);
      await drive(rig, ROUTE_A, { fromMi: 0.5, speedMph: 60, fixes: 20, jitterM: 4, seed: 601 });
      // Diverge over ten seconds (plausible to the GPS gate), then HOLD
      // the offset. Holding is what makes this a threshold measurement
      // rather than a measurement of how fast the ramp climbed.
      const ramp = await drive(rig, ROUTE_A, {
        fromMi: 0.85,
        speedMph: 60,
        fixes: 10,
        jitterM: 4,
        lateralM,
        lateralRamp: true,
        seed: 607 + lateralM,
      });
      const held = await drive(rig, ROUTE_A, {
        fromMi: 1.02,
        speedMph: 60,
        fixes: 20,
        jitterM: 4,
        lateralM,
        seed: 613 + lateralM,
      });
      ladder.push({
        lateralM,
        confirmed: [...ramp, ...held].some((s) => s.detector === 'confirmed'),
      });
    }
    console.log(
      `  measured confirm-off-route ladder: ${ladder
        .map((r) => `${r.lateralM}m=${r.confirmed ? 'off' : 'on'}`)
        .join(' ')}`,
    );
    // 75 m is the detector's documented qualify band (DETECTOR_DEFAULTS
    // .qualifyLateralM). Inside it, a deviation is a wide roadway, a
    // frontage lane or a biased fix — never a departure.
    // 74 m sits INSIDE the transition zone, not below it: with ±4 m of
    // jitter a 74 m centreline offset puts individual fixes on both
    // sides of the 75 m bar, so it may confirm. That is the threshold
    // behaving, not failing — so the assertion is made where the answer
    // is unambiguous, and the full ladder is printed for the rest.
    check(
      'ladder: a clearly-inside-the-roadway offset never confirms',
      ladder.filter((r) => r.lateralM <= 60).every((r) => !r.confirmed),
      ladder,
    );
    check(
      'ladder: everything outside it confirms',
      ladder.filter((r) => r.lateralM >= 90).every((r) => r.confirmed),
      ladder,
    );
  }

  // Scenario 7c — budget. Six separate sustained departures inside one
  // hour must not cost more than the doc 05 §4 hourly allowance, and the
  // controller must refuse rather than silently keep spending.
  {
    const rig = await startTrip(ROUTE_A, 'trip-budget', (req) => ({
      kind: 'route',
      positions: [req.origin, { lat: req.origin.lat + 0.01, lng: req.origin.lng }, req.destination],
      distanceMiles: 4,
      durationSeconds: 500,
      maneuvers: [
        { action: 'depart', instruction: 'Rejoin.', direction: null, offset: 0 },
        { action: 'arrive', instruction: 'Arrive.', direction: null, offset: 2 },
      ],
      validationState: 'valid',
      warnings: [],
    }));
    let attempts = 0;
    for (let round = 0; round < 8; round++) {
      await drive(rig, ROUTE_A, {
        fromMi: 0.4,
        speedMph: 60,
        fixes: 20,
        jitterM: 4,
        seed: 700 + round,
      });
      await drive(rig, ROUTE_A, {
        fromMi: 0.73,
        speedMph: 60,
        fixes: 30,
        jitterM: 4,
        lateralM: 500,
        lateralRamp: true,
        seed: 800 + round,
        onTick: async (s) => {
          if (rig.life.state() !== 'off-route') return;
          attempts += 1;
          await rig.life.requestReroute(s.tMs, 10);
        },
      });
    }
    console.log(
      `  measured reroute spend: ${attempts} eligible asks -> ${rig.providerCalls()} provider calls`,
    );
    check('budget: the caller did ask repeatedly', attempts >= 8, attempts);
    check('budget: provider spend stayed inside the hourly allowance', rig.providerCalls() <= 6, {
      providerCalls: rig.providerCalls(),
      attempts,
    });
    check('budget: no lifecycle violations', rig.life.violations().length === 0);
  }

  // Scenario 7d — a phone that reports no device speed at all (common on
  // Android): every speed downstream is derived from displacement, which
  // jitter inflates. Guidance must still not oscillate.
  {
    const rig = await startTrip(ROUTE_A, 'trip-nospeed');
    const s = await drive(rig, ROUTE_A, {
      fromMi: 0,
      speedMph: 60,
      fixes: 200,
      jitterM: 6,
      noDeviceSpeed: true,
      seed: 911,
    });
    const churn = maneuverChurn(s);
    check('no device speed: route mile monotonic', monotonicMile(s) === 0);
    check('no device speed: next maneuver never regresses', churn.regressions === 0, churn);
    check(
      'no device speed: no false off-route',
      s.every((x) => x.detector !== 'confirmed'),
    );
    check(
      'no device speed: no repeated instruction',
      duplicates(rig.spoken).length === 0,
      rig.spoken,
    );
  }

  // ================================================================== P7
  // Scenario 8 — two consecutive trips on ONE lifecycle. Trip 2 must
  // start from zero: no route mile, no maneuver, no summary, no route
  // identity, and no engine references surviving trip 1.
  {
    let plannedRoute = ROUTE_A;
    let plannedId = 'trip-one';
    const life = createNavigationLifecycle({
      planPort: async () => planResultFor(plannedRoute, plannedId),
      replacementPort: async () => ({ kind: 'failure', reason: 'not-used' }),
    });

    async function runTrip(route: BuiltRoute, id: string, tBase: number) {
      plannedRoute = route;
      plannedId = id;
      const outcome = await life.plan(
        {
          origin: route.positions[0],
          destination: route.positions[route.positions.length - 1],
          truck: TRUCK,
          departAtMs: tBase,
        },
        destinationFor(route),
        tBase,
      );
      if (!outcome.ok) throw new Error(`plan failed: ${outcome.reason}`);
      life.startNavigation(tBase + 1000);
      const gps = createGpsSession();
      // Drive most of the route fast, then crawl in for arrival.
      let mi = 0;
      let t = tBase + 2000;
      const step = (speedMph: number, fixes: number, jitterM: number, seed: number) => {
        const rng = makeRng(seed);
        for (let i = 0; i < fixes; i++) {
          const { pos, northUnit, eastUnit } = atMile(route, mi);
          const noisy = offsetM(pos, (rng() * 2 - 1) * jitterM, (rng() * 2 - 1) * jitterM);
          const state = gps.ingestFix({
            lat: noisy.lat,
            lng: noisy.lng,
            accuracyM: 8,
            speedMps: speedMph / 2.236936,
            headingDeg: speedMph > 2 ? bearingOf(northUnit, eastUnit) : null,
            tMs: t,
          });
          life.tick(state, t);
          mi = Math.min(route.totalMi, mi + speedMph / 3600);
          t += 1000;
        }
      };
      // Highway to within a tenth of a mile, then crawl the rest of the
      // way IN and stop. Arrival is not "close enough": doc 05 wants the
      // committed mile at the route end, the truck inside the facility's
      // arrival radius, AND speed under 5 mph sustained for 10 s. A
      // fixture that halts 270 m short simply never arrives — correctly.
      step(60, Math.ceil(((route.totalMi - 0.1) / 60) * 3600), 5, 401);
      step(4, 95, 4, 409); // 0.1 mi at 4 mph closes the last 160 m
      step(1, 20, 3, 411); // parked at the gate: the sustained-stop evidence
      return { endT: t, gps };
    }

    const first = await runTrip(ROUTE_A, 'trip-one', T0);
    const firstView = life.view();
    check('trip 1: reached the end of the route', (firstView.remainingMi ?? 99) < 0.3, firstView);
    // The whole point of P7 is the NATURAL ending, not a cancel: drive in,
    // arrive, acknowledge. A trip that can only be ended by cancelling
    // would leave every real trip's summary marked 'cancelled'.
    check('trip 1: lifecycle reached arrived', life.state() === 'arrived', life.state());
    check(
      'trip 1: arrival summary is not a cancellation',
      life.summary()?.endReason !== 'cancelled',
      life.summary(),
    );
    check('trip 1: complete() accepted', life.complete(first.endT) === true);
    check('trip 1: engines released', life.resourcesReleased() === true);
    check('trip 1: reset accepted', life.reset(first.endT + 1000) === true);
    check('trip 1: summary cleared on reset', life.summary() === null);
    check('trip 1: view is no-route after reset', life.view().status === 'no-route', life.view());
    check('trip 1: map data is empty after reset', life.mapData().geometry.length === 0);

    const transitionsAfterTrip1 = life.transitions().length;

    const second = await runTrip(ROUTE_B, 'trip-two', first.endT + 2000);
    const secondView = life.view();
    check(
      'trip 2: route identity is trip 2',
      life.mapData().routeId === 'trip-two',
      life.mapData().routeId,
    );
    check(
      'trip 2: total distance is route B, not route A',
      Math.abs((secondView.totalMi ?? 0) - Number(ROUTE_B.totalMi.toFixed(1))) < 0.2,
      secondView.totalMi,
    );
    check(
      'trip 2: geometry length is route B',
      life.mapData().geometry.length === ROUTE_B.positions.length,
      { got: life.mapData().geometry.length, want: ROUTE_B.positions.length },
    );
    check('trip 2: reached the end of route B', (secondView.remainingMi ?? 99) < 0.3, secondView);
    check('trip 2: arrived naturally too', life.state() === 'arrived', life.state());
    check(
      'trip 2: no lifecycle violations across both trips',
      life.violations().length === 0,
      life.violations(),
    );
    check('trip 2: complete() accepted', life.complete(second.endT) === true);
    check('trip 2: engines released', life.resourcesReleased() === true);

    // The transition log is the one thing that survives a reset by
    // design (it is an audit trail). It must still be BOUNDED, or a
    // multi-day pilot session grows it without limit.
    const grew = life.transitions().length - transitionsAfterTrip1;
    console.log(`  transition log: ${transitionsAfterTrip1} after trip 1, +${grew} for trip 2`);
    check(
      'lifecycle: transition log stays bounded across trips',
      life.transitions().length <= 200,
      life.transitions().length,
    );
  }

  // Scenario 9 — five consecutive short trips. Nothing may accumulate
  // per trip except the bounded audit log.
  {
    const life = createNavigationLifecycle({
      planPort: async () => planResultFor(ROUTE_B, 'loop'),
      replacementPort: async () => ({ kind: 'failure', reason: 'not-used' }),
    });
    const perTrip: number[] = [];
    let t = T0;
    for (let trip = 0; trip < 5; trip++) {
      const before = life.transitions().length;
      const outcome = await life.plan(
        {
          origin: ROUTE_B.positions[0],
          destination: ROUTE_B.positions[ROUTE_B.positions.length - 1],
          truck: TRUCK,
          departAtMs: t,
        },
        destinationFor(ROUTE_B),
        t,
      );
      if (!outcome.ok) throw new Error('loop plan failed');
      life.startNavigation(t + 1000);
      const gps = createGpsSession();
      for (let i = 0; i < 30; i++) {
        const { pos, northUnit, eastUnit } = atMile(ROUTE_B, i * 0.02);
        const state = gps.ingestFix({
          lat: pos.lat,
          lng: pos.lng,
          accuracyM: 8,
          speedMps: 72 / 2.236936,
          headingDeg: bearingOf(northUnit, eastUnit),
          tMs: t + 2000 + i * 1000,
        });
        life.tick(state, t + 2000 + i * 1000);
      }
      life.cancel(t + 40_000);
      life.reset(t + 41_000);
      perTrip.push(life.transitions().length - before);
      t += 100_000;
    }
    check(
      'loop: every trip costs the same number of transitions',
      new Set(perTrip).size === 1,
      perTrip,
    );
    check(
      'loop: no violations across five trips',
      life.violations().length === 0,
      life.violations(),
    );
    check('loop: released after the last trip', life.resourcesReleased() === true);
  }

  // Scenario 10 — the de-duplication guard must not outlive its trip.
  // The lifecycle ignores a tick whose PositionState is the SAME OBJECT
  // as the previous one (React can render twice with one state). If that
  // reference survives into the next trip, the new trip's very first
  // tick is discarded as a duplicate of the old trip's last one — and
  // the driver's last position from trip 1 stays in memory after it
  // ended, which AD-7 forbids.
  {
    const life = createNavigationLifecycle({
      planPort: async () => planResultFor(ROUTE_A, 'dup-guard'),
      replacementPort: async () => ({ kind: 'failure', reason: 'not-used' }),
    });
    const startTripHere = async (t: number) => {
      const outcome = await life.plan(
        {
          origin: ROUTE_A.positions[0],
          destination: ROUTE_A.positions[ROUTE_A.positions.length - 1],
          truck: TRUCK,
          departAtMs: t,
        },
        destinationFor(ROUTE_A),
        t,
      );
      if (!outcome.ok) throw new Error('dup-guard plan failed');
      life.startNavigation(t + 1000);
    };

    await startTripHere(T0);
    const gps = createGpsSession();
    let last: PositionState = gps.state();
    for (let i = 0; i < 20; i++) {
      const { pos, northUnit, eastUnit } = atMile(ROUTE_A, 0.5 + i * 0.02);
      last = gps.ingestFix({
        lat: pos.lat,
        lng: pos.lng,
        accuracyM: 8,
        speedMps: 60 / 2.236936,
        headingDeg: bearingOf(northUnit, eastUnit),
        tMs: T0 + 2000 + i * 1000,
      });
      life.tick(last, T0 + 2000 + i * 1000);
    }
    check('dup guard: trip 1 advanced', (life.view().routeMile ?? 0) > 0.5, life.view().routeMile);

    life.cancel(T0 + 40_000);
    life.reset(T0 + 41_000);
    await startTripHere(T0 + 42_000);

    // The GPS layer has published nothing new yet — the screen re-renders
    // with the very same object trip 1 ended on. Trip 2 must use it.
    const snap = life.tick(last, T0 + 43_000);
    check(
      'dup guard: trip 2 accepts the first tick even when the position object is unchanged',
      (snap.view.routeMile ?? 0) > 0.5,
      snap.view.routeMile,
    );
    check('dup guard: no violations', life.violations().length === 0, life.violations());
  }

  // Scenario 11 — the transition audit log is bounded. Long-lived screens
  // outlive many trips; an unbounded array is a slow leak.
  {
    const life = createNavigationLifecycle({
      planPort: async () => planResultFor(ROUTE_B, 'bounded'),
      replacementPort: async () => ({ kind: 'failure', reason: 'not-used' }),
    });
    let t = T0;
    for (let trip = 0; trip < 200; trip++) {
      const outcome = await life.plan(
        {
          origin: ROUTE_B.positions[0],
          destination: ROUTE_B.positions[ROUTE_B.positions.length - 1],
          truck: TRUCK,
          departAtMs: t,
        },
        destinationFor(ROUTE_B),
        t,
      );
      if (!outcome.ok) throw new Error('bounded plan failed');
      life.startNavigation(t + 1000);
      life.cancel(t + 2000);
      life.reset(t + 3000);
      t += 10_000;
    }
    console.log(`  transition log after 200 trips: ${life.transitions().length} entries`);
    check(
      'bounded log: 200 trips do not grow the log without limit',
      life.transitions().length <= MAX_TRANSITION_LOG,
      life.transitions().length,
    );
    check('bounded log: no violations across 200 trips', life.violations().length === 0);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

void main();
