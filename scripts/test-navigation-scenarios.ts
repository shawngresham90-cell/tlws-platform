/**
 * Adversarial driving scenarios (Block 2, priority A).
 *
 * The Block 1 harnesses proved the stack survives noise and failure. This
 * one asks a different question: driven through a realistic TRIP —
 * interstate miles, a city grid, a ramp, an interchange, a missed turn, a
 * turnaround, a tunnel, an arrival, then another trip — does the guidance
 * stay sane the whole way?
 *
 * It measures behaviour rather than return values. Every run records:
 *
 *   - every spoken line and the tick it was spoken on
 *   - the next-maneuver sequence, so regressions and churn are countable
 *   - every lifecycle and detector transition
 *   - provider calls, route identity changes, map geometry swaps
 *   - REROUTE DETECTION LATENCY: ticks from the first deviating fix to
 *     the tick the lifecycle admits it is off-route
 *
 * All timing is simulated 1 Hz and deterministic (seeded LCG, no
 * Math.random, no wall clock), so a latency figure here is a property of
 * the state machines and nothing else. It is NOT a real-road measurement
 * and must never be reported as one.
 *
 * Run:
 *   npx esbuild scripts/test-navigation-scenarios.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-nav-scenarios.cjs \
 *   && node /tmp/test-nav-scenarios.cjs
 */
import { createGpsSession, type GpsSession } from '@/lib/navigator/gps-session';
import {
  createNavigationLifecycle,
  type NavigationLifecycle,
  type PlanFetchResult,
} from '@/lib/navigator/navigation-lifecycle';
import type { ReplacementFetchResult } from '@/lib/navigator/reroute-controller';
import { createManeuverAnnouncer } from '@/lib/navigator/voice-guidance';
import type { DestinationInfo } from '@/lib/navigator/truck-entrance';
import type { TruckProfile } from '@/lib/trip-planner/types';
import type { LatLng } from '@/lib/map/bounds';

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
const M_PER_DEG_LAT = 111_320;
function miPerDegLng(lat: number): number {
  return MI_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

type Leg = {
  northMi: number;
  eastMi: number;
  /** Instruction for the maneuver at the START of this leg, if any. */
  instruction?: string;
  direction?: 'left' | 'right' | null;
  action?: string;
};

type Course = {
  positions: LatLng[];
  miles: number[];
  totalMi: number;
  /** Maneuvers with their geometry offset, in order. */
  maneuvers: { action: string; instruction: string; direction: string | null; offset: number }[];
};

/**
 * Build a course from legs sampled at 0.01 mi. A maneuver on a leg is
 * placed at the geometry index where that leg begins — which is exactly
 * where the turn happens.
 */
function buildCourse(startLat: number, startLng: number, legs: Leg[]): Course {
  const positions: LatLng[] = [{ lat: startLat, lng: startLng }];
  const miles: number[] = [0];
  const maneuvers: Course['maneuvers'] = [
    { action: 'depart', instruction: 'Head out on Depot Road.', direction: null, offset: 0 },
  ];
  let lat = startLat;
  let lng = startLng;
  let mile = 0;
  for (const leg of legs) {
    if (leg.instruction) {
      maneuvers.push({
        action: leg.action ?? 'turn',
        instruction: leg.instruction,
        direction: leg.direction ?? null,
        offset: positions.length - 1,
      });
    }
    const legMi = Math.hypot(leg.northMi, leg.eastMi);
    const steps = Math.max(1, Math.round(legMi / 0.01));
    const dLat = leg.northMi / MI_PER_DEG_LAT / steps;
    const dLng = leg.eastMi / miPerDegLng(lat) / steps;
    for (let s = 0; s < steps; s++) {
      lat += dLat;
      lng += dLng;
      mile += legMi / steps;
      positions.push({ lat, lng });
      miles.push(mile);
    }
  }
  maneuvers.push({
    action: 'arrive',
    instruction: 'Arrive at the receiving gate.',
    direction: null,
    offset: positions.length - 1,
  });
  return { positions, miles, totalMi: mile, maneuvers };
}

function atMile(course: Course, mi: number) {
  const clamped = Math.min(Math.max(mi, 0), course.totalMi);
  let i = 0;
  while (i + 1 < course.miles.length && course.miles[i + 1] < clamped) i++;
  const j = Math.min(i + 1, course.positions.length - 1);
  const span = course.miles[j] - course.miles[i];
  const t = span <= 0 ? 0 : (clamped - course.miles[i]) / span;
  const a = course.positions[i];
  const b = course.positions[j];
  const northMi = (b.lat - a.lat) * MI_PER_DEG_LAT;
  const eastMi = (b.lng - a.lng) * miPerDegLng(a.lat);
  const len = Math.hypot(northMi, eastMi) || 1;
  return {
    pos: { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t },
    northUnit: northMi / len,
    eastUnit: eastMi / len,
  };
}

function offsetM(p: LatLng, northM: number, eastM: number): LatLng {
  return {
    lat: p.lat + northM / M_PER_DEG_LAT,
    lng: p.lng + eastM / M_PER_MI / miPerDegLng(p.lat),
  };
}

function bearingOf(northUnit: number, eastUnit: number): number {
  return ((Math.atan2(eastUnit, northUnit) * 180) / Math.PI + 360) % 360;
}

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

/** Long interstate run: 12 miles, a keep-left, and an exit. */
const INTERSTATE = buildCourse(35.0, -85.0, [
  { northMi: 6, eastMi: 0 },
  {
    northMi: 4,
    eastMi: 0.3,
    instruction: 'Keep left to stay on Interstate 75 North.',
    action: 'keep',
    direction: 'left',
  },
  {
    northMi: 2,
    eastMi: 0,
    instruction: 'Take exit 341 toward Dalton.',
    action: 'exit',
    direction: 'right',
  },
]);

/** City grid: eight short blocks, a turn at every one. */
const CITY = buildCourse(34.77, -84.97, [
  { northMi: 0.2, eastMi: 0 },
  { northMi: 0, eastMi: 0.15, instruction: 'Turn right onto Hamilton Street.', direction: 'right' },
  { northMi: 0.15, eastMi: 0, instruction: 'Turn left onto Waugh Street.', direction: 'left' },
  { northMi: 0, eastMi: 0.15, instruction: 'Turn right onto Thornton Avenue.', direction: 'right' },
  { northMi: 0.12, eastMi: 0, instruction: 'Turn left onto Morris Street.', direction: 'left' },
  { northMi: 0, eastMi: 0.2, instruction: 'Turn right onto Glenwood Avenue.', direction: 'right' },
]);

/** Highway → ramp → surface road, the exit-ramp case. */
const RAMP = buildCourse(35.1, -85.2, [
  { northMi: 2, eastMi: 0 },
  {
    northMi: 0.25,
    eastMi: 0.18,
    instruction: 'Take the ramp on the right toward Walnut Avenue.',
    action: 'ramp',
    direction: 'right',
  },
  { northMi: 0, eastMi: 1.2, instruction: 'Turn left onto Walnut Avenue.', direction: 'left' },
]);

/** Two consecutive turns 0.08 mi apart — the chaining case. */
const CONSECUTIVE = buildCourse(34.5, -84.5, [
  { northMi: 1.5, eastMi: 0 },
  { northMi: 0, eastMi: 0.08, instruction: 'Turn right onto Mill Street.', direction: 'right' },
  { northMi: 0.9, eastMi: 0, instruction: 'Turn left onto Depot Street.', direction: 'left' },
]);

/** A course whose FIRST turn is 0.06 mi from the start. */
const SHORT_START = buildCourse(36.0, -86.0, [
  { northMi: 0.06, eastMi: 0 },
  { northMi: 0, eastMi: 1.5, instruction: 'Turn right onto Lee Highway.', direction: 'right' },
]);

function destinationFor(course: Course): DestinationInfo {
  return {
    position: course.positions[course.positions.length - 1],
    facility: 'distribution-center',
    positionSource: 'geocode',
  };
}

function planFor(course: Course, routeId: string): PlanFetchResult {
  return {
    kind: 'route',
    routeId,
    positions: course.positions,
    distanceMiles: Number(course.totalMi.toFixed(1)),
    durationSeconds: Math.max(60, Math.round((course.totalMi / 45) * 3600)),
    maneuvers: course.maneuvers,
    validationState: 'valid',
    warnings: [],
  };
}

// ------------------------------------------------------------ the driver

type Sample = {
  tick: number;
  tMs: number;
  routeMile: number | null;
  nextMile: number | null;
  nextInstruction: string | null;
  status: string;
  lifecycle: string;
  detector: string | null;
  accepted: boolean;
  routeId: string | null;
  geometryLen: number;
  matchDir: string | null;
  matchConf: string | null;
  matchReasons: string;
  headingDelta: number | null;
  speedMph: number | null;
};

type Segment =
  | { kind: 'follow'; mi: number; mph: number; jitterM?: number; accuracyM?: number }
  | { kind: 'hold'; seconds: number; jitterM?: number }
  /** Diverge sideways, ramping to `lateralM` over the segment. */
  | { kind: 'depart'; mi: number; mph: number; lateralM: number; jitterM?: number }
  /** Hold a constant sideways offset — a parallel road, a frontage road. */
  | { kind: 'parallel'; mi: number; mph: number; lateralM: number; jitterM?: number }
  /** Drive back down the route the way we came. */
  | { kind: 'reverse'; mi: number; mph: number; jitterM?: number }
  /** No fixes reach the app at all. */
  | { kind: 'gps-lost'; seconds: number }
  /** The platform reports an error. */
  | { kind: 'gps-error'; kind2: 'denied' | 'unavailable' | 'timeout'; seconds: number };

type Sim = {
  life: NavigationLifecycle;
  gps: GpsSession;
  samples: Sample[];
  spoken: { text: string; tick: number }[];
  providerCalls: () => number;
  /** Route mile the truck is currently at (the SIMULATED truth). */
  mi: number;
  tick: number;
  run(segments: Segment[]): Sample[];
  /** Ask for a reroute on every tick the lifecycle says off-route. */
  autoReroute: boolean;
};

async function startTrip(
  course: Course,
  routeId: string,
  opts: {
    replacement?: (
      req: { origin: LatLng; destination: LatLng },
      call: number,
    ) => ReplacementFetchResult;
    autoReroute?: boolean;
  } = {},
): Promise<Sim> {
  let calls = 0;
  const life = createNavigationLifecycle({
    planPort: async () => planFor(course, routeId),
    replacementPort: async (req) => {
      calls += 1;
      return opts.replacement
        ? opts.replacement({ origin: req.origin, destination: req.destination }, calls)
        : { kind: 'failure', reason: 'no-replacement-scripted' };
    },
  });
  const outcome = await life.plan(
    {
      origin: course.positions[0],
      destination: course.positions[course.positions.length - 1],
      truck: TRUCK,
      departAtMs: T0,
    },
    destinationFor(course),
    T0,
  );
  if (!outcome.ok) throw new Error(`plan failed: ${outcome.reason}`);
  if (!life.startNavigation(T0 + 1000)) throw new Error('startNavigation refused');

  const sim: Sim = {
    life,
    gps: createGpsSession(),
    samples: [],
    spoken: [],
    providerCalls: () => calls,
    mi: 0,
    tick: 0,
    autoReroute: opts.autoReroute === true,
    run: () => [],
  };
  const announcer = createManeuverAnnouncer();

  function record(accepted: boolean): Sample {
    const view = sim.life.view();
    const map = sim.life.mapData();
    if (view.maneuvers !== null) {
      for (const req of announcer.collect(view.maneuvers, view.speedMph)) {
        sim.spoken.push({ text: req.text, tick: sim.tick });
      }
    }
    const s: Sample = {
      tick: sim.tick,
      tMs: T0 + 2000 + sim.tick * 1000,
      routeMile: view.routeMile,
      nextMile: view.maneuvers?.next?.mileMi ?? null,
      nextInstruction: view.maneuvers?.next?.instruction ?? null,
      status: view.status,
      lifecycle: sim.life.state(),
      detector: sim.life.snapshot().navigation?.detector?.state ?? null,
      accepted,
      routeId: map.routeId,
      geometryLen: map.geometry.length,
      matchDir: sim.life.snapshot().navigation?.match?.travelDirection ?? null,
      matchConf: sim.life.snapshot().navigation?.match?.confidence ?? null,
      matchReasons: (sim.life.snapshot().navigation?.match?.reasons ?? []).join('|'),
      headingDelta: sim.life.snapshot().navigation?.match?.headingDeltaDeg ?? null,
      speedMph: view.speedMph,
    };
    sim.samples.push(s);
    return s;
  }

  sim.run = (segments: Segment[]) => {
    const from = sim.samples.length;
    for (const seg of segments) runSegment(sim, course, seg, record);
    return sim.samples.slice(from);
  };
  return sim;
}

/** One segment of driving, at 1 Hz. */
function runSegment(
  sim: Sim,
  course: Course,
  seg: Segment,
  record: (accepted: boolean) => Sample,
): void {
  const rng = makeRng(1000 + sim.tick * 7 + seg.kind.length);
  const tickOf = () => T0 + 2000 + sim.tick * 1000;

  const emit = (pos: LatLng, mph: number, heading: number | null, accuracyM: number) => {
    const before = sim.gps.state();
    const state = sim.gps.ingestFix({
      lat: pos.lat,
      lng: pos.lng,
      accuracyM,
      speedMps: mph / 2.236936,
      headingDeg: heading,
      tMs: tickOf(),
    });
    sim.life.tick(state, tickOf());
    record(state !== before);
    sim.tick += 1;
  };

  if (seg.kind === 'gps-lost') {
    for (let i = 0; i < seg.seconds; i++) {
      sim.life.tick(sim.gps.tick(tickOf()), tickOf());
      record(false);
      sim.tick += 1;
    }
    return;
  }
  if (seg.kind === 'gps-error') {
    for (let i = 0; i < seg.seconds; i++) {
      sim.life.tick(sim.gps.ingestError(seg.kind2), tickOf());
      record(false);
      sim.tick += 1;
    }
    return;
  }
  if (seg.kind === 'hold') {
    const j = seg.jitterM ?? 4;
    for (let i = 0; i < seg.seconds; i++) {
      const { pos } = atMile(course, sim.mi);
      emit(offsetM(pos, (rng() * 2 - 1) * j, (rng() * 2 - 1) * j), 0, null, 8);
    }
    return;
  }

  const mph = seg.mph;
  const perTickMi = mph / 3600;
  const ticks = Math.max(1, Math.round(seg.mi / Math.max(perTickMi, 1e-9)));
  const j = seg.jitterM ?? 5;
  const accuracyM = seg.kind === 'follow' ? (seg.accuracyM ?? 8) : 8;

  for (let i = 0; i < ticks; i++) {
    const forward = seg.kind === 'reverse' ? -1 : 1;
    sim.mi = Math.min(Math.max(sim.mi + forward * perTickMi, 0), course.totalMi);
    const { pos, northUnit, eastUnit } = atMile(course, sim.mi);
    let lateral = 0;
    if (seg.kind === 'depart') lateral = (seg.lateralM * (i + 1)) / ticks;
    else if (seg.kind === 'parallel') lateral = seg.lateralM;
    const shifted = offsetM(pos, -eastUnit * lateral, northUnit * lateral);
    const noisy = offsetM(shifted, (rng() * 2 - 1) * j, (rng() * 2 - 1) * j);
    const heading = mph > 2 ? bearingOf(forward * northUnit, forward * eastUnit) : null;
    emit(noisy, mph, heading, accuracyM);
  }
}

/** Drive the whole course at one speed, following it exactly. */
function followWholeCourse(sim: Sim, course: Course, mph: number, jitterM = 5): Sample[] {
  return sim.run([{ kind: 'follow', mi: course.totalMi - sim.mi, mph, jitterM }]);
}

// ------------------------------------------------------------- measures

function duplicateLines(spoken: { text: string }[]): string[] {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const s of spoken) {
    if (seen.has(s.text)) dupes.push(s.text);
    seen.add(s.text);
  }
  return dupes;
}

function maneuverRegressions(samples: Sample[]): number {
  let n = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1].nextMile;
    const b = samples[i].nextMile;
    if (a !== null && b !== null && b < a - 1e-9) n += 1;
  }
  return n;
}

function mileRegressions(samples: Sample[]): number {
  let n = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1].routeMile;
    const b = samples[i].routeMile;
    if (a !== null && b !== null && b < a - 1e-9) n += 1;
  }
  return n;
}

/** How many times the lifecycle changed state — churn, not a sequence. */
function lifecycleFlips(samples: Sample[]): number {
  let n = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].lifecycle !== samples[i - 1].lifecycle) n += 1;
  }
  return n;
}

/**
 * Ticks from the first fix of `departSamples` to the first sample in
 * `all` at or after it whose lifecycle is 'off-route'. Null when the
 * departure was never recognised.
 */
function detectionLatencyTicks(all: Sample[], departFromTick: number): number | null {
  const hit = all.find((s) => s.tick >= departFromTick && s.lifecycle === 'off-route');
  return hit === undefined ? null : hit.tick - departFromTick;
}

/**
 * Lines whose PRIMARY subject is each maneuver. A chained line reads
 * "…, Turn right onto A, then Turn left onto B" — counting every mention
 * would charge B for A's lines and make correct chaining look like
 * over-speaking, so only the part before ", then " counts.
 */
function primaryOf(text: string): string {
  const i = text.indexOf(', then ');
  return i === -1 ? text : text.slice(0, i);
}

function linesPerManeuver(spoken: { text: string }[], course: Course): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of course.maneuvers) {
    if (m.action === 'depart') continue;
    const key = m.instruction.replace(/\.$/, '');
    out.set(m.instruction, spoken.filter((s) => primaryOf(s.text).includes(key)).length);
  }
  return out;
}

const latency: { scenario: string; ticks: number | null }[] = [];

async function main() {
  // ============================================== 1. long interstate run
  {
    const sim = await startTrip(INTERSTATE, 'interstate');
    const s = followWholeCourse(sim, INTERSTATE, 65, 6);
    check('interstate: route mile never runs backwards', mileRegressions(s) === 0);
    check('interstate: next maneuver never regresses', maneuverRegressions(s) === 0);
    check(
      'interstate: no line spoken twice',
      duplicateLines(sim.spoken).length === 0,
      sim.spoken.map((x) => x.text),
    );
    check(
      'interstate: never falsely off-route',
      s.every((x) => x.lifecycle !== 'off-route'),
    );
    check('interstate: no provider spend on a clean run', sim.providerCalls() === 0);
    const per = linesPerManeuver(sim.spoken, INTERSTATE);
    check(
      'interstate: every maneuver announced, none more than 3 times',
      [...per.values()].every((n) => n >= 1 && n <= 3),
      Object.fromEntries(per),
    );
  }

  // =================================================== 2. dense city turns
  {
    const sim = await startTrip(CITY, 'city');
    const s = followWholeCourse(sim, CITY, 28, 6);
    check('city: route mile never runs backwards', mileRegressions(s) === 0);
    check('city: next maneuver never regresses', maneuverRegressions(s) === 0);
    check(
      'city: no line spoken twice',
      duplicateLines(sim.spoken).length === 0,
      sim.spoken.map((x) => x.text),
    );
    check(
      'city: never falsely off-route on a tight grid',
      s.every((x) => x.lifecycle !== 'off-route'),
    );
    const per = linesPerManeuver(sim.spoken, CITY);
    check(
      'city: every turn is announced at least once',
      [...per.values()].every((n) => n >= 1),
      Object.fromEntries(per),
    );
    check(
      'city: short blocks do not produce more than 3 lines per turn',
      [...per.values()].every((n) => n <= 3),
      Object.fromEntries(per),
    );
  }

  // ============================================== 3. consecutive turns
  {
    const sim = await startTrip(CONSECUTIVE, 'consecutive');
    const s = followWholeCourse(sim, CONSECUTIVE, 30, 5);
    check('consecutive: no regression', maneuverRegressions(s) === 0 && mileRegressions(s) === 0);
    check(
      'consecutive: no duplicate line',
      duplicateLines(sim.spoken).length === 0,
      sim.spoken.map((x) => x.text),
    );
    check(
      'consecutive: both turns reach the driver',
      sim.spoken.some((x) => x.text.includes('Mill Street')) &&
        sim.spoken.some((x) => x.text.includes('Depot Street')),
      sim.spoken.map((x) => x.text),
    );
  }

  // ==================================================== 4. exit ramp
  {
    const sim = await startTrip(RAMP, 'ramp');
    const s = followWholeCourse(sim, RAMP, 55, 6);
    check('ramp: no regression', maneuverRegressions(s) === 0 && mileRegressions(s) === 0);
    check(
      'ramp: never falsely off-route through the ramp curve',
      s.every((x) => x.lifecycle !== 'off-route'),
    );
    check(
      'ramp: the ramp instruction is spoken',
      sim.spoken.some((x) => x.text.includes('ramp')),
    );
    check('ramp: no provider spend', sim.providerCalls() === 0);
  }

  // ============================================ 5. highway interchange
  // Ramp course driven at interchange speed: the geometry turns hard
  // while the truck is committed and fast, the classic false-positive.
  {
    const sim = await startTrip(RAMP, 'interchange');
    const s = followWholeCourse(sim, RAMP, 62, 8);
    check(
      'interchange: never falsely off-route',
      s.every((x) => x.lifecycle !== 'off-route'),
    );
    check('interchange: no provider spend', sim.providerCalls() === 0);
    check('interchange: no duplicate line', duplicateLines(sim.spoken).length === 0);
  }

  // ==================================================== 6. missed turn
  {
    const sim = await startTrip(CITY, 'missed-turn', { autoReroute: false });
    sim.run([{ kind: 'follow', mi: 0.34, mph: 30, jitterM: 4 }]); // up to the 2nd turn
    const departTick = sim.tick;
    // Straight on instead of turning: the route goes east, we keep north.
    const missed = sim.run([{ kind: 'depart', mi: 0.35, mph: 30, lateralM: 300, jitterM: 4 }]);
    const lat = detectionLatencyTicks(missed, departTick);
    latency.push({ scenario: 'missed turn, 30 mph city', ticks: lat });
    check(
      'missed turn: recognised as off-route',
      lat !== null,
      missed.map((x) => x.detector).at(-1),
    );
    check('missed turn: recognised within 30 s', lat !== null && lat <= 30, lat);
  }

  // ============================================= 7. deliberate wrong way
  {
    const sim = await startTrip(INTERSTATE, 'wrong-way', { autoReroute: false });
    sim.run([{ kind: 'follow', mi: 2, mph: 60, jitterM: 5 }]);
    const departTick = sim.tick;
    const back = sim.run([{ kind: 'reverse', mi: 1, mph: 55, jitterM: 5 }]);
    const lat = detectionLatencyTicks(back, departTick);
    latency.push({ scenario: 'wrong-way on the route, 55 mph', ticks: lat });
    // The route mile SHOULD fall here, and this is the one place it may:
    // the tracker's reversal hold exists to distinguish a real
    // wrong-way from back-projection noise, and a confirmed reversal
    // means the truck genuinely is back at a lower mile. What must not
    // happen is the mile falling without the driver being told.
    check('wrong way: the mile does follow the truck back', mileRegressions(back) > 0);
    check('wrong way: the driver is told, not silently tracked backwards', lat !== null, {
      lat,
      states: [...new Set(back.map((x) => x.detector))],
    });
  }

  // ================================================= 8. U-turn / turnaround
  {
    const sim = await startTrip(CITY, 'u-turn', { autoReroute: false });
    sim.run([{ kind: 'follow', mi: 0.3, mph: 30, jitterM: 4 }]);
    const departTick = sim.tick;
    const around = sim.run([
      { kind: 'hold', seconds: 4, jitterM: 3 },
      { kind: 'reverse', mi: 0.25, mph: 22, jitterM: 4 },
    ]);
    const uLat = detectionLatencyTicks(around, departTick);
    latency.push({ scenario: 'stop and turn around, 22 mph city', ticks: uLat });
    // This one was silently undetectable before Block 2. CITY is under a
    // mile long, so `remainingMi <= suppressDestinationMi` held for the
    // whole trip, and below 25 mph the destination-approach rule
    // suppressed every observation — including an unambiguous 180-degree
    // heading disagreement at 22 mph.
    check('u-turn: the driver is told they turned around', uLat !== null, {
      uLat,
      detectors: [...new Set(around.map((x) => x.detector))],
    });
    check('u-turn: told within 20 s', uLat !== null && uLat <= 20, uLat);
    check('u-turn: no maneuver regression', maneuverRegressions(around) === 0);
  }

  // ======================================= 9+10. GPS loss then recovery
  {
    const sim = await startTrip(INTERSTATE, 'tunnel');
    sim.run([{ kind: 'follow', mi: 1.5, mph: 60, jitterM: 5 }]);
    const beforeMile = sim.samples.at(-1)!.routeMile ?? 0;
    const dark = sim.run([{ kind: 'gps-lost', seconds: 20 }]);
    check(
      'tunnel: the screen admits the position is lost',
      dark.at(-1)!.status === 'position-lost',
      dark.at(-1)!.status,
    );
    check('tunnel: no progress invented in the dark', (dark.at(-1)!.routeMile ?? 0) === beforeMile);
    check(
      'tunnel: nothing spoken while blind',
      sim.spoken.filter((x) => x.tick >= dark[0].tick && x.tick <= dark.at(-1)!.tick).length === 0,
    );
    const after = sim.run([{ kind: 'follow', mi: 1, mph: 60, jitterM: 5 }]);
    check(
      'recovery: back to navigating',
      after.at(-1)!.status === 'navigating',
      after.at(-1)!.status,
    );
    check('recovery: progress resumes', (after.at(-1)!.routeMile ?? 0) > beforeMile);
    check('recovery: no duplicate line across the gap', duplicateLines(sim.spoken).length === 0);
    check('recovery: no reroute was provoked', sim.providerCalls() === 0);
  }

  // ========================================= 11. jitter near an intersection
  {
    const sim = await startTrip(CITY, 'jitter-intersection');
    // Crawl through the first turn with the worst noise a city gives.
    const s = sim.run([
      { kind: 'follow', mi: 0.15, mph: 25, jitterM: 5 },
      { kind: 'follow', mi: 0.12, mph: 12, jitterM: 15 },
      { kind: 'follow', mi: 0.2, mph: 25, jitterM: 8 },
    ]);
    check('intersection jitter: no maneuver regression', maneuverRegressions(s) === 0);
    check('intersection jitter: no mile regression', mileRegressions(s) === 0);
    check(
      'intersection jitter: no duplicate line',
      duplicateLines(sim.spoken).length === 0,
      sim.spoken.map((x) => x.text),
    );
    check(
      'intersection jitter: not declared off-route',
      s.every((x) => x.lifecycle !== 'off-route'),
    );
    check('intersection jitter: no provider spend', sim.providerCalls() === 0);
  }

  // ================================== 12+13. route departure and re-entry
  {
    const sim = await startTrip(INTERSTATE, 'departure-return', { autoReroute: false });
    sim.run([{ kind: 'follow', mi: 1, mph: 60, jitterM: 5 }]);
    const departTick = sim.tick;
    const away = sim.run([{ kind: 'depart', mi: 0.6, mph: 60, lateralM: 400, jitterM: 5 }]);
    const lat = detectionLatencyTicks(away, departTick);
    latency.push({ scenario: 'gradual departure to 400 m, 60 mph highway', ticks: lat });
    check('departure: recognised', lat !== null, lat);
    check('departure: recognised within 25 s', lat !== null && lat <= 25, lat);
    // Come back onto the line.
    const back = sim.run([{ kind: 'follow', mi: 0.8, mph: 60, jitterM: 5 }]);
    check(
      're-entry: back to navigating',
      back.at(-1)!.lifecycle === 'navigating',
      back.at(-1)!.lifecycle,
    );
    check('re-entry: mile never ran backwards', mileRegressions(back) === 0);
    check(
      're-entry: the whole episode is at most 3 lifecycle flips',
      lifecycleFlips([...away, ...back]) <= 3,
      lifecycleFlips([...away, ...back]),
    );
  }

  // ===================================== 14. reroute while a turn approaches
  {
    let replacementCourse: Course | null = null;
    const sim = await startTrip(CITY, 'reroute-near-turn', {
      autoReroute: true,
      replacement: (req) => {
        replacementCourse = buildCourse(req.origin.lat, req.origin.lng, [
          {
            northMi: 0.4,
            eastMi: 0.4,
            instruction: 'Continue to rejoin the route.',
            action: 'continue',
          },
        ]);
        const positions = [...replacementCourse.positions.slice(0, -1), { ...req.destination }];
        return {
          kind: 'route',
          positions,
          distanceMiles: 0.9,
          durationSeconds: 200,
          maneuvers: [
            {
              action: 'depart',
              instruction: 'Continue to rejoin the route.',
              direction: null,
              offset: 0,
            },
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
      },
    });
    // Approach the first turn, then leave the route right before it.
    sim.run([{ kind: 'follow', mi: 0.16, mph: 30, jitterM: 4 }]);
    const beforeId = sim.life.mapData().routeId;
    let replaced = 0;
    const away = sim.run([{ kind: 'depart', mi: 0.4, mph: 30, lateralM: 350, jitterM: 4 }]);
    for (const s of away) {
      if (s.lifecycle !== 'off-route') continue;
      const r = await sim.life.requestReroute(s.tMs, 8);
      if (r.outcome === 'replaced') replaced += 1;
    }
    check('reroute near a turn: at most one replacement', replaced <= 1, replaced);
    if (replaced === 1) {
      check('reroute near a turn: route identity changed', sim.life.mapData().routeId !== beforeId);
      check(
        'reroute near a turn: geometry was swapped, not appended',
        sim.life.mapData().geometry.length !== CITY.positions.length,
      );
    }
    check(
      'reroute near a turn: no stale duplicate speech',
      duplicateLines(sim.spoken).length === 0,
      sim.spoken.map((x) => x.text),
    );
    check(
      'reroute near a turn: no lifecycle violations',
      sim.life.violations().length === 0,
      sim.life.violations(),
    );
  }

  // =============================== 16. trip starting close to the first turn
  {
    const sim = await startTrip(SHORT_START, 'short-start');
    const s = sim.run([{ kind: 'follow', mi: 0.5, mph: 35, jitterM: 4 }]);
    check(
      'short start: the first turn is still announced',
      sim.spoken.some((x) => x.text.includes('Lee Highway')),
      sim.spoken.map((x) => x.text),
    );
    check(
      'short start: no duplicate line',
      duplicateLines(sim.spoken).length === 0,
      sim.spoken.map((x) => x.text),
    );
    check('short start: no maneuver regression', maneuverRegressions(s) === 0);
  }

  // ======================================== 17+18+19. arrival, cancel, trip 2
  {
    const sim = await startTrip(CITY, 'arrive-1');
    sim.run([{ kind: 'follow', mi: CITY.totalMi - 0.06, mph: 28, jitterM: 4 }]);
    const arriving = sim.run([
      { kind: 'follow', mi: 0.06, mph: 4, jitterM: 3 },
      { kind: 'hold', seconds: 20, jitterM: 2 },
    ]);
    check('arrival: the lifecycle arrives', sim.life.state() === 'arrived', sim.life.state());
    check(
      'arrival: the summary is not a cancellation',
      sim.life.summary()?.endReason !== 'cancelled',
    );
    const afterArrival = arriving.filter((x) => x.lifecycle === 'arrived');
    check('arrival: no reroute after arriving', sim.providerCalls() === 0);
    check(
      'arrival: nothing is spoken repeatedly at the gate',
      duplicateLines(sim.spoken).length === 0,
      sim.spoken.map((x) => x.text),
    );
    check(
      'arrival: the trip does not flip back out of arrived',
      afterArrival.every((x) => x.lifecycle === 'arrived'),
    );
    check(
      'arrival: complete() accepted',
      sim.life.complete(sim.samples.at(-1)!.tMs + 1000) === true,
    );
    check('arrival: engines released', sim.life.resourcesReleased() === true);
    check('arrival: reset accepted', sim.life.reset(sim.samples.at(-1)!.tMs + 2000) === true);
    check('arrival: no route is shown after reset', sim.life.view().status === 'no-route');
    check('arrival: no violations', sim.life.violations().length === 0, sim.life.violations());
  }

  // Cancel before arriving, then immediately run a second trip.
  {
    const sim = await startTrip(INTERSTATE, 'cancel-1');
    sim.run([{ kind: 'follow', mi: 2, mph: 60, jitterM: 5 }]);
    const summary = sim.life.cancel(sim.samples.at(-1)!.tMs + 1000);
    check('cancel: a summary is produced', summary !== null);
    check('cancel: it is marked cancelled', summary?.endReason === 'cancelled', summary?.endReason);
    check('cancel: engines released', sim.life.resourcesReleased() === true);
    check('cancel: map is empty', sim.life.mapData().geometry.length === 0);
    check('cancel: no violations', sim.life.violations().length === 0);
  }

  // ============================================ 20. prolonged session
  {
    const sim = await startTrip(INTERSTATE, 'prolonged');
    // ~40 minutes of 1 Hz driving up and down the corridor.
    for (let lap = 0; lap < 4; lap++) {
      sim.run([{ kind: 'follow', mi: 5, mph: 62, jitterM: 6 }]);
      sim.run([{ kind: 'hold', seconds: 30, jitterM: 3 }]);
      sim.mi = Math.max(0.5, sim.mi - 4.9);
    }
    const ticks = sim.samples.length;
    check('prolonged: the session really ran long', ticks >= 1200, ticks);
    check(
      'prolonged: no duplicate line across the whole session',
      duplicateLines(sim.spoken).length === 0,
      sim.spoken.length,
    );
    check(
      'prolonged: no lifecycle violations',
      sim.life.violations().length === 0,
      sim.life.violations(),
    );
    check(
      'prolonged: transition log stayed bounded',
      sim.life.transitions().length <= 500,
      sim.life.transitions().length,
    );
    check('prolonged: no provider spend without a departure', sim.providerCalls() === 0);
    const ids = new Set(sim.samples.map((x) => x.routeId));
    check('prolonged: the route identity never churned', ids.size === 1, [...ids]);
    const geoms = new Set(sim.samples.map((x) => x.geometryLen));
    check('prolonged: the map geometry array was never rebuilt', geoms.size === 1, [...geoms]);
  }

  // ===================== B: things that must NOT be called a departure
  // A frontage road runs beside the highway at roughly 30-60 m. A truck
  // on one is off the route; a truck on the highway whose fixes are
  // biased toward one is not. The detector cannot tell them apart from
  // position alone, so the bar is: a sustained offset INSIDE the qualify
  // band never confirms, no matter how long it is held.
  {
    const sim = await startTrip(INTERSTATE, 'frontage');
    sim.run([{ kind: 'follow', mi: 1, mph: 58, jitterM: 5 }]);
    const beside = sim.run([{ kind: 'parallel', mi: 2, mph: 58, lateralM: 55, jitterM: 5 }]);
    check(
      'frontage road: never confirmed off-route',
      beside.every((x) => x.lifecycle !== 'off-route'),
    );
    check('frontage road: no provider spend', sim.providerCalls() === 0);
  }

  // A dock or fuel island: well off the line, but slow. Low speed is the
  // oldest suppression in the detector and it must still hold.
  {
    const sim = await startTrip(CITY, 'dock');
    sim.run([{ kind: 'follow', mi: 0.3, mph: 25, jitterM: 4 }]);
    const yard = sim.run([
      { kind: 'parallel', mi: 0.05, mph: 6, lateralM: 120, jitterM: 6 },
      { kind: 'hold', seconds: 15, jitterM: 5 },
      { kind: 'parallel', mi: 0.04, mph: 4, lateralM: 140, jitterM: 6 },
    ]);
    check(
      'dock manoeuvring: never confirmed off-route',
      yard.every((x) => x.lifecycle !== 'off-route'),
    );
    check('dock manoeuvring: no provider spend', sim.providerCalls() === 0);
  }

  // Loose fixes must not build a departure on their own: an urban canyon
  // throwing 120 m accuracy is drift, not evidence.
  {
    const sim = await startTrip(INTERSTATE, 'canyon');
    sim.run([{ kind: 'follow', mi: 1, mph: 55, jitterM: 5 }]);
    const loose = sim.run([{ kind: 'follow', mi: 1, mph: 55, jitterM: 5, accuracyM: 120 }]);
    check(
      'loose fixes: never confirmed off-route',
      loose.every((x) => x.lifecycle !== 'off-route'),
    );
    check(
      'loose fixes: the screen says the position is approximate',
      loose.some((x) => x.status === 'position-degraded'),
      [...new Set(loose.map((x) => x.status))],
    );
    check('loose fixes: no provider spend', sim.providerCalls() === 0);
  }

  // -------------------------------------------------- measured latency
  console.log(
    '\n  simulated reroute-detection latency (1 Hz ticks, deterministic — NOT road data):',
  );
  for (const row of latency) {
    console.log(
      `    ${row.scenario.padEnd(42)} ${row.ticks === null ? 'not detected' : `${row.ticks} s`}`,
    );
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

void main();
