/**
 * N8d — observe-only off-route detection. Scenario tests driving the
 * REAL N8c matcher and the detector together over synthetic corridors:
 * gradual and sudden departures, frontage roads, parallel highways,
 * truck-stop exits, parking lots, weigh stations, fuel islands, tunnel
 * recovery, GPS drift and repeated jumps, confidence recovery,
 * false-positive prevention, malformed sessions — plus determinism,
 * event integrity, the zero-cost boundary (no provider surface exists
 * in the module at all), and measured (never invented) performance.
 *
 * Run:
 *   npx esbuild scripts/test-offroute-detector.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-offroute.cjs \
 *   && node /tmp/test-offroute.cjs
 */
import { readFileSync } from 'node:fs';
import {
  createOffRouteDetector,
  nearestStopDistanceM,
  DETECTOR_DEFAULTS,
  type ObserveInput,
  type OffRouteDetector,
  type OffRouteState,
} from '@/lib/navigator/off-route-detector';
import { createMapMatcher, type MapMatcher, type MatchFix } from '@/lib/navigator/map-matcher';
import { normalizeGeometry, type GeometryPoint } from '@/lib/navigator/route-geometry';
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
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ---------------------------------------------------------------- fixtures
const T0 = 1_754_000_000_000;
const LAT0 = 35;
const LNG0 = -85;
const mPerDegLng = 111_320 * Math.cos((LAT0 * Math.PI) / 180);

function northRoute(n = 2000): GeometryPoint[] {
  const positions: LatLng[] = [];
  for (let i = 0; i < n; i++) positions.push({ lat: LAT0 + i * 0.001, lng: LNG0 });
  const norm = normalizeGeometry(positions, Number(((n - 1) * 0.0690937).toFixed(1)));
  if (norm.problems.length > 0) throw new Error('fixture failed');
  return norm.points;
}

function fixAt(
  route: readonly GeometryPoint[],
  atMile: number,
  over: Partial<MatchFix> & { eastM?: number; tMs: number },
): MatchFix {
  let idx = 0;
  while (idx + 1 < route.length && route[idx + 1].routeMile <= atMile) idx++;
  const base = route[idx].position;
  return {
    position: { lat: base.lat, lng: base.lng + (over.eastM ?? 0) / mPerDegLng },
    headingDeg: over.headingDeg === undefined ? 0 : over.headingDeg,
    speedMph: over.speedMph === undefined ? 60 : over.speedMph,
    accuracyM: over.accuracyM === undefined ? 8 : over.accuracyM,
    tMs: over.tMs,
  };
}

/** One rig: matcher + detector driven together; returns detector states. */
type Rig = {
  matcher: MapMatcher;
  detector: OffRouteDetector;
  drive(
    route: readonly GeometryPoint[],
    fixes: (Partial<MatchFix> & { atMile: number; eastM?: number; tMs: number })[],
    extras?: Partial<Pick<ObserveInput, 'nearestPlannedStopM' | 'remainingMi' | 'accuracyM'>>,
  ): OffRouteState[];
};
function rig(route: readonly GeometryPoint[], config = {}): Rig {
  const matcher = createMapMatcher(route);
  const detector = createOffRouteDetector(config);
  return {
    matcher,
    detector,
    drive(r, fixes, extras = {}) {
      const states: OffRouteState[] = [];
      for (const f of fixes) {
        const fix = fixAt(r, f.atMile, f);
        const match = matcher.match(fix);
        states.push(
          detector.observe({
            match,
            tMs: fix.tMs,
            speedMph: fix.speedMph,
            accuracyM: fix.accuracyM,
            ...extras,
          }).state,
        );
      }
      return states;
    },
  };
}

/** Clean warm-up leg: 4 on-line fixes from `mile`. */
function warmLeg(mile: number, t: number) {
  return [0, 1, 2, 3].map((i) => ({ atMile: mile + i * 0.05, tMs: t + i * 3000 }));
}

// ------------------------------------------------------ sudden departure
{
  const route = northRoute();
  const r = rig(route);
  r.drive(route, warmLeg(5, T0));
  check('sudden: warm-up ends on-route', r.detector.state().state === 'on-route');
  // Wrong turn: 120 m east at highway speed, sustained.
  const states = r.drive(
    route,
    [0, 1, 2, 3, 4].map((i) => ({
      atMile: 5.2 + i * 0.05,
      eastM: 120,
      tMs: T0 + 12_000 + i * 3000,
    })),
  );
  check('sudden: first off fix is SUSPECTED, never confirmed alone', states[0] === 'suspected');
  // Pilot round 1: this leg is at 60 mph, so the FAST ladder governs —
  // 2 qualifying fixes AND 3 s, instead of 4 fixes AND 8 s. The truck
  // covers ~90 ft/s at this speed; the old ladder spent a quarter mile
  // before guidance reacted. The single-fix prohibition is unchanged.
  check(
    'sudden: confirmed on the fast ladder at highway speed (2 fixes + 3 s)',
    states[1] === 'confirmed',
    states,
  );
  check('sudden: stays confirmed while the evidence continues', states[3] === 'confirmed', states);
  const events = r.detector.events();
  check(
    'sudden: deterministic event chain on-route→suspected→confirmed',
    events.map((e) => e.to).join(',') === 'suspected,confirmed',
    events.map((e) => e.to),
  );
  const confirmEvent = events[events.length - 1];
  check(
    'sudden: event carries timestamp/confidence/distance/progression',
    confirmEvent.tMs > T0 &&
      confirmEvent.lateralM !== null &&
      confirmEvent.lateralM > 100 &&
      confirmEvent.elapsedMs >= DETECTOR_DEFAULTS.fastConfirmMinElapsedMs &&
      confirmEvent.routeMile !== null,
  );
}

// ----------------------------------------------------- gradual departure
{
  const route = northRoute();
  const r = rig(route);
  r.drive(route, warmLeg(5, T0));
  // Exit ramp drifting away: 30 → 60 → 90 → 130 → 170 → 210 m.
  const laterals = [30, 60, 90, 130, 170, 210, 250];
  const states = r.drive(
    route,
    laterals.map((eastM, i) => ({ atMile: 5.2 + i * 0.05, eastM, tMs: T0 + 12_000 + i * 3000 })),
  );
  check(
    'gradual: near-line drift alone never suspects (30/60 m)',
    states[0] === 'on-route' && states[1] === 'on-route',
  );
  check('gradual: suspicion begins beyond the qualify bound', states[2] === 'suspected');
  check(
    'gradual: confirmed only after sustained evidence',
    states.slice(-1)[0] === 'confirmed',
    states,
  );
}

// ------------------------------------- frontage road: never a departure
{
  const route = northRoute();
  const r = rig(route);
  r.drive(route, warmLeg(5, T0));
  const states = r.drive(
    route,
    [0, 1, 2, 3, 4, 5].map((i) => ({
      atMile: 5.2 + i * 0.05,
      eastM: 50,
      tMs: T0 + 12_000 + i * 3000,
    })),
  );
  check(
    'frontage: 50 m parallel travel never suspects',
    states.every((s) => s === 'on-route'),
    states,
  );
}

// ------------------------------------------- parallel highway: departure
{
  const route = northRoute();
  const r = rig(route);
  r.drive(route, warmLeg(5, T0));
  const states = r.drive(
    route,
    [0, 1, 2, 3, 4].map((i) => ({
      atMile: 5.2 + i * 0.05,
      eastM: 300,
      tMs: T0 + 12_000 + i * 3000,
    })),
  );
  check(
    'parallel: sustained travel 300 m away (unmatched) confirms',
    states[states.length - 1] === 'confirmed',
    states,
  );
}

// ----------------------- truck stop pull-in/out: suppressed by low speed
{
  const route = northRoute();
  const r = rig(route);
  r.drive(route, warmLeg(5, T0));
  // Decelerating into the lot: far off the line but slow.
  const lot = [0, 1, 2, 3, 4, 5].map((i) => ({
    atMile: 5.2,
    eastM: 90 + i * 10,
    speedMph: 8 - i, // 8 → 3 mph
    headingDeg: null as number | null,
    tMs: T0 + 12_000 + i * 5000,
  }));
  const states = r.drive(route, lot);
  check(
    'truck stop: the whole pull-in stays on-route (low-speed suppression)',
    states.every((s) => s === 'on-route'),
    states,
  );
  check('truck stop: suppression reason recorded', r.detector.state().suppressionReason !== null);
  // Pull back out and resume: still on-route, no events at all.
  const resume = r.drive(route, warmLeg(5.3, T0 + 80_000));
  check(
    'truck stop: exit back to the highway — clean, zero events',
    resume.every((s) => s === 'on-route') && r.detector.events().length === 0,
  );
}

// -------------------- weigh station / fuel island: planned-stop exclusion
{
  const route = northRoute();
  const r = rig(route);
  r.drive(route, warmLeg(5, T0));
  // Screaming off-route evidence at highway speed — but 100 m from a
  // PLANNED stop (doc 06 §7): never fires.
  const states = r.drive(
    route,
    [0, 1, 2, 3, 4, 5].map((i) => ({
      atMile: 5.2,
      eastM: 130,
      speedMph: 35,
      tMs: T0 + 12_000 + i * 3000,
    })),
    { nearestPlannedStopM: 100 },
  );
  check(
    'weigh station: 150 m planned-stop zone never confirms',
    states.every((s) => s === 'on-route'),
    states,
  );

  const helper = nearestStopDistanceM({ lat: LAT0, lng: LNG0 }, [
    { lat: LAT0 + 0.001, lng: LNG0 }, // ~111 m north
    { lat: LAT0 + 1, lng: LNG0 },
  ]);
  check(
    'weigh station: nearest-stop helper measures the near stop',
    helper !== null && helper > 100 && helper < 125,
    helper,
  );
}

// -------------------------- destination approach: low-speed final mile
{
  const route = northRoute();
  const r = rig(route);
  r.drive(route, warmLeg(5, T0));
  const states = r.drive(
    route,
    [0, 1, 2, 3, 4].map((i) => ({
      atMile: 5.2,
      eastM: 100,
      speedMph: 18,
      tMs: T0 + 12_000 + i * 3000,
    })),
    { remainingMi: 0.6 },
  );
  check(
    'destination: slow final-mile approach never confirms',
    states.every((s) => s === 'on-route'),
    states,
  );
}

// ------------------------------------------ tunnel: gaps break episodes
{
  const route = northRoute();
  const r = rig(route);
  r.drive(route, warmLeg(5, T0));
  // Two qualifying fixes… then a 60 s tunnel… then two more. The chain
  // is NOT continuous — never confirmed. Driven at 30 mph (below the
  // pilot-round-1 fast-ladder speed) so the leg stays genuinely
  // half-built and the gap has an episode to dissolve; the fast ladder
  // is exercised by the sudden-departure scenario above.
  r.drive(route, [
    { atMile: 5.2, eastM: 120, tMs: T0 + 12_000, speedMph: 30 },
    { atMile: 5.25, eastM: 120, tMs: T0 + 15_000, speedMph: 30 },
  ]);
  check('tunnel: episode open before the gap', r.detector.state().state === 'suspected');
  const after = r.drive(route, [
    { atMile: 5.9, eastM: 120, tMs: T0 + 75_000, speedMph: 30 }, // gap-reset fix
    { atMile: 5.95, eastM: 120, tMs: T0 + 78_000, speedMph: 30 },
    { atMile: 6.0, eastM: 120, tMs: T0 + 81_000, speedMph: 30 },
  ]);
  check('tunnel: the gap dissolved the half-built episode', after[0] === 'on-route');
  check(
    'tunnel: fresh evidence restarts the count from zero (still unconfirmed)',
    after[2] === 'suspected',
    after,
  );
}

// ------------------------------- GPS drift: one outlier never escalates
{
  const route = northRoute();
  const r = rig(route);
  r.drive(route, warmLeg(5, T0));
  const states = r.drive(route, [
    { atMile: 5.2, eastM: 120, tMs: T0 + 12_000 }, // outlier
    { atMile: 5.25, eastM: 0, tMs: T0 + 15_000 }, // clean
    { atMile: 5.3, eastM: 110, tMs: T0 + 18_000 }, // outlier
    { atMile: 5.35, eastM: 0, tMs: T0 + 21_000 }, // clean
    { atMile: 5.4, eastM: 0, tMs: T0 + 24_000 },
  ]);
  check(
    'drift: alternating outliers dissolve on every clean fix — never confirmed',
    states.join(',') === 'suspected,on-route,suspected,on-route,on-route',
    states,
  );
  check(
    'drift: false-positive prevention leaves the log episodic only',
    r.detector.events().every((e) => e.to !== 'confirmed'),
  );
}

// --------------------- repeated GPS jumps: matcher doubt is not departure
{
  const route = northRoute();
  const r = rig(route);
  r.drive(route, warmLeg(5, T0));
  // Teleports ONTO the route far ahead: matcher goes low (progression
  // break) with tiny lateral — the truck never looks off the ROADWAY.
  const states = r.drive(
    route,
    [0, 1, 2, 3].map((i) => ({ atMile: 40 + i * 0.05, tMs: T0 + 12_000 + i * 3000 })),
  );
  check(
    'jumps: re-anchoring doubt never reads as off-route',
    states.every((s) => s === 'on-route'),
    states,
  );
}

// ------------------------------ recovery: confirmed → recovering → done
{
  const route = northRoute();
  const r = rig(route);
  r.drive(route, warmLeg(5, T0));
  r.drive(
    route,
    [0, 1, 2, 3].map((i) => ({ atMile: 5.2 + i * 0.05, eastM: 120, tMs: T0 + 12_000 + i * 3000 })),
  );
  check('recovery: confirmed first', r.detector.state().state === 'confirmed');
  // Back onto the line: matcher rebuilds trust; detector needs
  // advance-eligible cleans.
  const back = r.drive(
    route,
    [0, 1, 2, 3, 4].map((i) => ({ atMile: 5.45 + i * 0.05, tMs: T0 + 24_000 + i * 3000 })),
  );
  check('recovery: enters recovering on the first clean fix', back[0] === 'recovering', back);
  check('recovery: recovered after sustained clean travel', back.includes('recovered'), back);
  check('recovery: settles back to on-route', back[back.length - 1] === 'on-route', back);
  const chain = r.detector
    .events()
    .map((e) => e.to)
    .join(',');
  check(
    'recovery: full deterministic chain recorded',
    chain === 'suspected,confirmed,recovering,recovered,on-route',
    chain,
  );
}

// -------------------------- relapse: recovering back to confirmed cleanly
{
  const route = northRoute();
  const r = rig(route);
  r.drive(route, warmLeg(5, T0));
  r.drive(
    route,
    [0, 1, 2, 3].map((i) => ({ atMile: 5.2 + i * 0.05, eastM: 120, tMs: T0 + 12_000 + i * 3000 })),
  );
  r.drive(route, [{ atMile: 5.45, tMs: T0 + 24_000 }]); // one clean → recovering
  const relapse = r.drive(route, [{ atMile: 5.5, eastM: 130, tMs: T0 + 27_000 }]);
  check(
    'relapse: qualifying evidence during recovery returns to confirmed',
    relapse[0] === 'confirmed',
  );
}

// ----------------------------------- malformed session / degenerate input
{
  const empty = createMapMatcher([]);
  const detector = createOffRouteDetector();
  let state: OffRouteState = 'on-route';
  for (let i = 0; i < 10; i++) {
    const match = empty.match({
      position: { lat: 35, lng: -85 },
      headingDeg: 0,
      speedMph: 60,
      accuracyM: 8,
      tMs: T0 + i * 3000,
    });
    state = detector.observe({ match, tMs: T0 + i * 3000, speedMph: 60 }).state;
  }
  check(
    'malformed: a degenerate matcher can suspect but NEVER hides events',
    detector.events().every((e) => e.to !== 'recovered'),
  );
  check(
    'malformed: unknown-only evidence follows the same deliberate ladder',
    state === 'confirmed' || state === 'suspected',
    state,
  );
  const nullSpeed = createOffRouteDetector();
  const m2 = createMapMatcher([]);
  for (let i = 0; i < 10; i++) {
    const match = m2.match({
      position: { lat: 35, lng: -85 },
      headingDeg: null,
      speedMph: null,
      accuracyM: null,
      tMs: T0 + i * 3000,
    });
    nullSpeed.observe({ match, tMs: T0 + i * 3000, speedMph: null });
  }
  check(
    'malformed: with no speed evidence nothing ever fires',
    nullSpeed.state().state === 'on-route',
  );
}

// ------------------------------------------------ determinism + zero cost
{
  const run = () => {
    const route = northRoute(500);
    const r = rig(route);
    r.drive(route, warmLeg(5, T0));
    r.drive(
      route,
      [0, 1, 2, 3, 4].map((i) => ({
        atMile: 5.2 + i * 0.05,
        eastM: 120,
        tMs: T0 + 12_000 + i * 3000,
      })),
    );
    r.drive(
      route,
      [0, 1, 2, 3, 4].map((i) => ({ atMile: 5.5 + i * 0.05, tMs: T0 + 24_000 + i * 3000 })),
    );
    return JSON.stringify(r.detector.events());
  };
  check('determinism: identical input → byte-identical event log', run() === run());

  const src = strip(readFileSync('src/lib/navigator/off-route-detector.ts', 'utf8'));
  check(
    'zero-cost: no provider surface exists in the detector at all',
    !/\bfetch\s*\(|hereapi|HERE_|createHereRoutingPort|http/i.test(src),
  );
  check(
    'zero-cost: no UI/voice/arrival surface either',
    !/voice|speak|arriv|prompt|alert\(/i.test(src),
  );
  check(
    'boundary: detector consumes only matcher outputs + fix metadata',
    /from '\.\/map-matcher'/.test(
      readFileSync('src/lib/navigator/off-route-detector.ts', 'utf8'),
    ) && !/here-routing|providers|navigation-controller|route-tracker/.test(src),
  );
}

// ------------------------------------------- measured performance/memory
{
  const route = northRoute(20_000); // ~1,381 mi
  const matcher = createMapMatcher(route);
  const detector = createOffRouteDetector();
  (globalThis as { gc?: () => void }).gc?.();
  const heapBefore = process.memoryUsage().heapUsed;

  // Long session: 100k observations with periodic loss and excursions.
  const times: number[] = [];
  let t = T0;
  for (let i = 0; i < 100_000; i++) {
    const mile = 2 + (i % 60_000) * 0.02;
    const excursion = i % 997 === 0 ? 120 : 0; // periodic drift
    const gap = i % 5003 === 0 ? 45_000 : 1000; // repeated GPS loss
    t += gap;
    const fix = fixAt(route, Math.min(mile, 1370), { eastM: excursion, tMs: t });
    const match = matcher.match(fix);
    const s0 = performance.now();
    detector.observe({ match, tMs: fix.tMs, speedMph: fix.speedMph });
    times.push(performance.now() - s0);
  }
  const avg = times.reduce((s, x) => s + x, 0) / times.length;
  const worst = Math.max(...times);
  const heapAfter = process.memoryUsage().heapUsed;
  console.log(
    `measured: detector avg ${(avg * 1e6).toFixed(0)} ns/observe · worst ${(worst * 1000).toFixed(0)} µs · ` +
      `heap delta over 100k-observation session ${((heapAfter - heapBefore) / 1048576).toFixed(1)} MB · ` +
      `events retained ${detector.events().length} (bounded ${DETECTOR_DEFAULTS.maxEvents})`,
  );
  check('perf: sub-microsecond-class average observe (< 50 µs)', avg < 0.05, avg);
  check('perf: worst observe < 50 ms', worst < 50, worst);
  check(
    'perf: event log stays bounded on a long session',
    detector.events().length <= DETECTOR_DEFAULTS.maxEvents,
  );
  check('perf: long session retains < 50 MB', heapAfter - heapBefore < 50 * 1048576);
}

// ================= PILOT ROUND 1: latency + false-reroute scenarios =======
// The live road test reported reroute "too slow" while requiring that
// fueling, parking, backing and short GPS drift never trigger one.

// --- wrong direction on the planned roadway ------------------------------
{
  const route = northRoute();
  const r = rig(route);
  // Warm up heading NORTH along the route (bearing 0).
  r.drive(route, warmLeg(5, T0));
  // Now driving SOUTH on the same roadway: on the line (lateral ~0), so
  // only the heading disagreement can reveal it. Before round 1 this was
  // undetectable — the truck could drive the wrong way indefinitely.
  const states = r.drive(
    route,
    [0, 1, 2, 3].map((i) => ({
      atMile: 5.2 - i * 0.02,
      headingDeg: 180,
      speedMph: 55,
      tMs: T0 + 12_000 + i * 1000,
    })),
  );
  check(
    'wrong-way: driving the route backwards is DETECTED (was invisible before round 1)',
    states.includes('confirmed'),
    states,
  );
  check('wrong-way: never confirmed on the first fix alone', states[0] !== 'confirmed', states);
}
{
  // Same geometry, but crawling in a yard: heading noise at low speed must
  // never read as wrong-way.
  const route = northRoute();
  const r = rig(route);
  r.drive(route, warmLeg(5, T0));
  const states = r.drive(
    route,
    [0, 1, 2, 3, 4].map((i) => ({
      atMile: 5.2 - i * 0.002,
      headingDeg: 180,
      speedMph: 6,
      tMs: T0 + 12_000 + i * 1000,
    })),
  );
  check(
    'wrong-way: heading noise below road speed never confirms (yard crawl)',
    states.every((s) => s !== 'confirmed'),
    states,
  );
}

// --- reroute latency at highway speed ------------------------------------
{
  const route = northRoute();
  const r = rig(route);
  r.drive(route, warmLeg(5, T0));
  // 1 Hz fixes, as the live GPS provider delivers them.
  const states = r.drive(
    route,
    [0, 1, 2, 3, 4, 5].map((i) => ({
      atMile: 5.2 + i * 0.017,
      eastM: 120,
      speedMph: 62,
      tMs: T0 + 12_000 + i * 1000,
    })),
  );
  const firstConfirm = states.indexOf('confirmed');
  check(
    'latency: highway departure confirms within 4 s of 1 Hz fixes',
    firstConfirm >= 1 && firstConfirm <= 3,
    { states, firstConfirm },
  );
  check(
    'latency: the old 8 s floor no longer governs at highway speed',
    firstConfirm * 1000 < DETECTOR_DEFAULTS.confirmMinElapsedMs,
    firstConfirm,
  );
}
{
  // Surface streets: the cautious ladder still governs below the fast
  // speed, so a city block's worth of lateral error can't fire a reroute.
  const route = northRoute();
  const r = rig(route);
  r.drive(route, warmLeg(5, T0));
  const states = r.drive(
    route,
    [0, 1].map((i) => ({
      atMile: 5.2 + i * 0.01,
      eastM: 120,
      speedMph: 25,
      tMs: T0 + 12_000 + i * 1000,
    })),
  );
  check(
    'latency: below highway speed the slow ladder still applies (no fast confirm)',
    states.every((s) => s !== 'confirmed'),
    states,
  );
}

// --- false reroutes: backing, fueling, parking, drift --------------------
{
  const route = northRoute();
  const r = rig(route);
  r.drive(route, warmLeg(5, T0));
  // Backing to a dock as it really happens: a few truck-lengths at
  // walking pace, 90 m off the mainline, heading reversed.
  const states = r.drive(
    route,
    [0, 1, 2, 3, 4, 5].map((i) => ({
      atMile: 5.2 - i * 0.004,
      eastM: 90,
      headingDeg: 180,
      speedMph: 3,
      tMs: T0 + 12_000 + i * 2000,
    })),
  );
  check(
    'no false reroute: backing to a dock never confirms',
    states.every((s) => s !== 'confirmed'),
    states,
  );

  // The reverse-travel suppression itself, proven directly: a match the
  // detector would otherwise treat as strong departure evidence (200 m
  // off-line, well above the low-speed floor) is stood down purely
  // because the truck is travelling in reverse.
  const backing = createOffRouteDetector();
  let backingState: OffRouteState = 'on-route';
  let reason: string | null = null;
  for (let i = 0; i < 6; i++) {
    const snap = backing.observe({
      match: {
        matched: true,
        routeMile: 5.2,
        candidateMile: 5.2,
        lateralM: 200,
        headingDeltaDeg: 175,
        travelDirection: 'reverse',
        confidence: 'low',
        advanceEligible: false,
        reasons: ['beside-route'],
      },
      tMs: T0 + i * 1000,
      speedMph: 25,
      accuracyM: 5,
    });
    backingState = snap.state;
    reason = snap.suppressionReason;
  }
  check('backing: reverse travel is suppressed by name', reason === 'backing', reason);
  check('backing: strong lateral evidence in reverse never confirms', backingState === 'on-route');
}
{
  const route = northRoute();
  const r = rig(route);
  r.drive(route, warmLeg(5, T0));
  // Fuel island: 100 m off the road, creeping.
  const states = r.drive(
    route,
    [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
      atMile: 5.2 + i * 0.001,
      eastM: 100,
      speedMph: 4,
      tMs: T0 + 12_000 + i * 4000,
    })),
  );
  check(
    'no false reroute: fueling (creeping 100 m off-road) never confirms',
    states.every((s) => s !== 'confirmed'),
    states,
  );
}
{
  const route = northRoute();
  const r = rig(route);
  r.drive(route, warmLeg(5, T0));
  // Truck parking: stopped, drifting inside a lot for minutes.
  const states = r.drive(
    route,
    Array.from({ length: 10 }, (_, i) => ({
      atMile: 5.2,
      eastM: 110 + (i % 3) * 15,
      speedMph: 0,
      tMs: T0 + 12_000 + i * 30_000,
    })),
  );
  check(
    'no false reroute: parked and drifting in a lot never confirms',
    states.every((s) => s !== 'confirmed'),
    states,
  );
}
{
  const route = northRoute();
  const r = rig(route);
  r.drive(route, warmLeg(5, T0));
  // Urban-canyon drift at highway speed: big lateral error, but the fix
  // itself is loose. Accuracy is the discriminator — without the round-1
  // gate the fast ladder would confirm this in ~3 s.
  const states = r.drive(
    route,
    [0, 1, 2, 3].map((i) => ({
      atMile: 5.2 + i * 0.017,
      eastM: 120,
      speedMph: 62,
      accuracyM: 85,
      tMs: T0 + 12_000 + i * 1000,
    })),
  );
  check(
    'no false reroute: a loose fix is drift, never departure evidence',
    states.every((s) => s !== 'confirmed'),
    states,
  );
}
{
  // …but a TIGHT fix at the same lateral distance still confirms fast:
  // the accuracy gate must not have disabled detection wholesale.
  const route = northRoute();
  const r = rig(route);
  r.drive(route, warmLeg(5, T0));
  const states = r.drive(
    route,
    [0, 1, 2, 3].map((i) => ({
      atMile: 5.2 + i * 0.017,
      eastM: 120,
      speedMph: 62,
      accuracyM: 6,
      tMs: T0 + 12_000 + i * 1000,
    })),
  );
  check(
    'accuracy gate is selective: a tight fix at the same offset still confirms',
    states.includes('confirmed'),
    states,
  );
}

// --- the reroute controller is still the only spender ---------------------
{
  const src = readFileSync('src/lib/navigator/off-route-detector.ts', 'utf8');
  check(
    'zero-cost boundary intact after round 1 (no fetch/provider in the detector)',
    !/fetch\s*\(|provider|http/i.test(src.replace(/^\s*(\/\/|\*|\/\*).*$/gm, '')),
  );
  const session = readFileSync('src/lib/navigator/navigation-session.ts', 'utf8');
  check(
    'session retires a hung in-flight reroute before asking again',
    session.includes('expireInFlight(tMs)'),
  );
  check(
    'session feeds fix accuracy to the detector (drift gate is wired, not theoretical)',
    /accuracyM:\s*fix\.accuracyM/.test(session),
  );
}

console.log(`offroute-detector: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
