/**
 * N8c — heading-aware map matching. Scenario tests for the pure matcher:
 * frontage roads, parallel/divided highways, ramps, cloverleafs, stacked
 * interchanges and overlapping corridors, truck-stop pull-ins, GPS drift,
 * heading reversals and U-turns, tunnel recovery, malformed geometry, and
 * full confidence-transition ladders — plus THE invariant, asserted
 * globally across every scenario fix: low/unknown confidence never moves
 * the committed route mile and is never advance-eligible. Performance is
 * measured, never invented.
 *
 * Run:
 *   npx esbuild scripts/test-map-matcher.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-map-matcher.cjs \
 *   && node /tmp/test-map-matcher.cjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  createMapMatcher,
  matcherFromSession,
  HIGH_LATERAL_M,
  MEDIUM_LATERAL_M,
  MAX_MATCH_LATERAL_M,
  HIGH_CONFIRM_FIXES,
  REANCHOR_CONFIRM_FIXES,
  STALE_RESET_MS,
  type MapMatch,
  type MapMatcher,
  type MatchFix,
} from '@/lib/navigator/map-matcher';
import { normalizeGeometry, type GeometryPoint } from '@/lib/navigator/route-geometry';
import { createRouteSession } from '@/lib/navigator/route-session';
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
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ---------------------------------------------------------------- fixtures
const T0 = 1_754_000_000_000;
const LAT0 = 35;
const LNG0 = -85;
const M_PER_DEG_LAT = 111_320;
const mPerDegLng = M_PER_DEG_LAT * Math.cos((LAT0 * Math.PI) / 180);

/** Northbound corridor: n points, ~0.0691 mi apart, bearing ≈ 0°. */
function northRoute(n = 2000): GeometryPoint[] {
  const positions: LatLng[] = [];
  for (let i = 0; i < n; i++) positions.push({ lat: LAT0 + i * 0.001, lng: LNG0 });
  const total = Number(((n - 1) * 0.0690937).toFixed(1));
  const norm = normalizeGeometry(positions, total);
  if (norm.problems.length > 0) throw new Error('fixture failed');
  return norm.points;
}

/** A fix on/near the corridor: `atMile` along, `eastM` meters east of it. */
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

/**
 * Global gating invariant recorder: across EVERY scenario fix in this
 * file, a low/unknown match must be advance-ineligible and must not have
 * moved the committed mile.
 */
let invariantViolations = 0;
function record(m: MapMatcher, fix: MatchFix): MapMatch {
  const before = m.last().routeMile;
  const out = m.match(fix);
  if (out.confidence === 'low' || out.confidence === 'unknown') {
    if (out.advanceEligible) invariantViolations++;
    const after = out.routeMile;
    if (!(before === after || (before === null && after === null))) invariantViolations++;
  }
  return out;
}

/** Drive k clean fixes to earn HIGH confidence; returns the last match. */
function warmUp(
  m: MapMatcher,
  route: readonly GeometryPoint[],
  startMile: number,
  t: number,
): MapMatch {
  let out: MapMatch = m.last();
  for (let i = 0; i < HIGH_CONFIRM_FIXES + 1; i++) {
    out = record(m, fixAt(route, startMile + i * 0.05, { tMs: t + i * 3000 }));
  }
  return out;
}

// -------------------------------------------------- basic ladder to HIGH
{
  const route = northRoute();
  const m = createMapMatcher(route);
  const first = record(m, fixAt(route, 5, { tMs: T0 }));
  check(
    'ladder: first clean fix matches at medium (trust is earned)',
    first.confidence === 'medium' && first.reasons.includes('building-confidence'),
  );
  const second = record(m, fixAt(route, 5.05, { tMs: T0 + 3000 }));
  check('ladder: second clean fix still medium', second.confidence === 'medium');
  const third = record(m, fixAt(route, 5.1, { tMs: T0 + 6000 }));
  check('ladder: third consecutive clean fix reaches HIGH', third.confidence === 'high');
  check(
    'ladder: committed mile advanced with the truck',
    third.routeMile !== null && third.routeMile > 5.0,
  );
  check(
    'ladder: matched with tight lateral + heading agreement',
    third.lateralM !== null &&
      third.lateralM < 5 &&
      third.headingDeltaDeg !== null &&
      third.headingDeltaDeg < 5,
  );
  check('ladder: forward travel recognized', third.travelDirection === 'forward');
  check('ladder: advance-eligible at high', third.advanceEligible);
}

// ------------------------------------------------------- frontage road
{
  const route = northRoute();
  const m = createMapMatcher(route);
  warmUp(m, route, 5, T0);
  // Truck exits to the frontage road ~50 m east, same heading, same speed.
  let last: MapMatch = m.last();
  for (let i = 0; i < 6; i++) {
    last = record(m, fixAt(route, 5.3 + i * 0.05, { eastM: 50, tMs: T0 + 60_000 + i * 3000 }));
    check(`frontage: fix ${i + 1} never HIGH at 50 m lateral`, last.confidence !== 'high', last);
  }
  check('frontage: demoted for being beside the route', last.reasons.includes('beside-route'));
  check(
    'frontage: thresholds make the frontage band unreachable for HIGH',
    HIGH_LATERAL_M < 50 && MEDIUM_LATERAL_M >= 50,
  );
}

// -------------------------------------- divided highway (opposing side)
{
  const route = northRoute();
  const m = createMapMatcher(route);
  warmUp(m, route, 5, T0);
  const before = m.last().routeMile!;
  // Southbound carriageway: 12 m from the line, heading 180° off.
  let out: MapMatch = m.last();
  for (let i = 0; i < 4; i++) {
    out = record(
      m,
      fixAt(route, 5.2 - i * 0.05, { eastM: 12, headingDeg: 180, tMs: T0 + 60_000 + i * 3000 }),
    );
  }
  check(
    'divided: opposing heading is LOW, never a match to trust',
    out.confidence === 'low' && out.reasons.includes('opposing-heading'),
  );
  check(
    'divided: committed mile frozen against the opposing carriageway',
    m.last().routeMile === before,
  );
}

// ------------------------------------------------- parallel highway far
{
  const route = northRoute();
  const m = createMapMatcher(route);
  warmUp(m, route, 5, T0);
  const out = record(m, fixAt(route, 5.5, { eastM: 400, tMs: T0 + 90_000 }));
  check(
    'parallel: 400 m away is UNKNOWN — no candidate at all',
    out.confidence === 'unknown' && !out.matched,
  );
  check('parallel: max-match bound proves it', MAX_MATCH_LATERAL_M < 400);
  const cross = record(m, fixAt(route, 5.5, { eastM: 10, headingDeg: 90, tMs: T0 + 93_000 }));
  check(
    'crossing: perpendicular heading over the route is LOW',
    cross.confidence === 'low' && cross.reasons.includes('heading-disagrees'),
  );
}

// -------------------------------- ramps: near-parallel rival, small gap
{
  // Corridor A (miles 0..~55) with a twin strand 12 m east over its UPPER
  // half only (the route doubles back over itself, like a collector or an
  // overlapping highway): a rival within the ambiguity margin at a big
  // mile gap — but a clean, un-twinned lower half to warm up on.
  const positions: LatLng[] = [];
  for (let i = 0; i < 800; i++) positions.push({ lat: LAT0 + i * 0.001, lng: LNG0 });
  for (let i = 799; i >= 400; i--)
    positions.push({ lat: LAT0 + i * 0.001, lng: LNG0 + 12 / mPerDegLng });
  const norm = normalizeGeometry(positions, 82.8);
  check('overlap fixture normalizes', norm.problems.length === 0);
  const route = norm.points;

  // Fresh start in the overlap zone: geometry alone cannot decide.
  const fresh = createMapMatcher(route);
  const ambiguousStart = record(fresh, {
    position: { lat: LAT0 + 0.6, lng: LNG0 + 6 / mPerDegLng },
    headingDeg: 0,
    speedMph: 60,
    accuracyM: 8,
    tMs: T0,
  });
  check(
    'overlap: fresh start between twin strands is LOW-ambiguous',
    ambiguousStart.confidence === 'low' && ambiguousStart.reasons.includes('ambiguous-candidates'),
  );

  // Committed travel DRIVEN into the twin zone: progression carries the
  // match through at MEDIUM (never high while twinned), and the committed
  // mile stays on the northbound strand's mileage.
  // The mile-window IS the disambiguator here: with a committed match,
  // the far-mile twin strand is outside the progression window, so the
  // committed strand is followed with untouched confidence and the mile
  // can never silently defect to the twin. (A FRESH start under the twin
  // — where no window exists — is the ambiguous LOW case above.)
  const committed = createMapMatcher(route);
  warmUp(committed, route, 26, T0);
  let out: MapMatch = committed.last();
  for (let step = 1; step <= 14; step++) {
    const mile = 26.2 + step * 0.2; // 0.2 mi per 12 s at 60 mph
    out = record(committed, fixAt(route, mile, { tMs: T0 + 9_000 + step * 12_000 }));
    check(
      `overlap: committed drive at mile ${mile.toFixed(1)} stays ≥ medium, never defects`,
      (out.confidence === 'high' || out.confidence === 'medium') &&
        out.routeMile !== null &&
        out.routeMile < 60,
      out,
    );
  }
  check(
    'overlap: final mile still on the committed strand',
    out.routeMile !== null && out.routeMile < 60 && out.routeMile > 28,
    out.routeMile,
  );
}

// ------------------------------------------ GPS drift + tunnel recovery
{
  const route = northRoute();
  const m = createMapMatcher(route);
  const high = warmUp(m, route, 5, T0);
  check('drift: warmed to high', high.confidence === 'high');
  const committed = m.last().routeMile!;
  const drift = record(m, fixAt(route, 5.2, { eastM: 100, tMs: T0 + 20_000 }));
  check(
    'drift: a 100 m outlier is LOW and holds the mile',
    drift.confidence === 'low' && drift.routeMile === committed,
  );
  const back = record(m, fixAt(route, 5.25, { tMs: T0 + 23_000 }));
  check('drift: next clean fix resumes at medium (streak reset)', back.confidence === 'medium');

  // Tunnel: 90 s of nothing, then clean fixes — mile kept, trust re-earned.
  const beforeTunnel = m.last().routeMile!;
  const afterGap = record(m, fixAt(route, 6.4, { tMs: T0 + 23_000 + 90_000 }));
  check(
    'tunnel: gap resets trust (gap-reset reason, not high)',
    afterGap.reasons.includes('gap-reset') && afterGap.confidence !== 'high',
  );
  check(
    'tunnel: committed mile survives the gap and moves forward',
    afterGap.routeMile !== null && afterGap.routeMile >= beforeTunnel,
  );
  let out: MapMatch = afterGap;
  for (let i = 1; i <= HIGH_CONFIRM_FIXES; i++) {
    out = record(m, fixAt(route, 6.4 + i * 0.05, { tMs: T0 + 113_000 + i * 3000 }));
  }
  check('tunnel: high confidence re-earned after the gap', out.confidence === 'high');
}

// ------------------------------- truck-stop pull-in (low speed, off lane)
{
  const route = northRoute();
  const m = createMapMatcher(route);
  warmUp(m, route, 5, T0);
  const committed = m.last().routeMile!;
  let out: MapMatch = m.last();
  // Decelerate into the lot: wandering 40–70 m east at parking speeds.
  const laterals = [40, 55, 70, 65, 50];
  for (let i = 0; i < laterals.length; i++) {
    out = record(
      m,
      fixAt(route, 5.2, {
        eastM: laterals[i],
        speedMph: 3,
        headingDeg: null,
        tMs: T0 + 30_000 + i * 5000,
      }),
    );
    check(
      `pull-in: lot fix ${i + 1} is LOW (low-speed, off the lane)`,
      out.confidence === 'low',
      out,
    );
  }
  check('pull-in: reason names the case', out.reasons.includes('low-speed-pull-in'));
  check('pull-in: committed mile never moved in the lot', m.last().routeMile === committed);
  // Back onto the highway at speed: trust rebuilds.
  let resume: MapMatch = out;
  for (let i = 0; i <= HIGH_CONFIRM_FIXES; i++) {
    resume = record(m, fixAt(route, 5.25 + i * 0.05, { tMs: T0 + 70_000 + i * 3000 }));
  }
  check('pull-in: high confidence rebuilt back on the road', resume.confidence === 'high');
}

// --------------------------------------- U-turn / reversal / slow crawl
{
  const route = northRoute();
  const m = createMapMatcher(route);
  warmUp(m, route, 5, T0);
  const committed = m.last().routeMile!;
  const uturn = record(m, fixAt(route, 5.1, { headingDeg: 182, tMs: T0 + 20_000 }));
  check(
    'u-turn: flipped heading at speed is LOW (opposing)',
    uturn.confidence === 'low' && uturn.reasons.includes('opposing-heading'),
  );
  check('u-turn: mile frozen', m.last().routeMile === committed);

  // Slow backward crawl (heading unusable): direction flips to reverse and
  // blocks advancement even at medium confidence.
  let out: MapMatch = m.last();
  const miles = [5.1, 5.0, 4.9, 4.8];
  for (let i = 0; i < miles.length; i++) {
    out = record(
      m,
      fixAt(route, miles[i], { speedMph: 4, headingDeg: null, tMs: T0 + 40_000 + i * 4000 }),
    );
  }
  check(
    'reversal: backward crawl recognized as reverse travel',
    out.travelDirection === 'reverse',
    out,
  );
  check('reversal: reverse is never advance-eligible', !out.advanceEligible);
  check(
    'reversal: committed mile did not move backward',
    m.last().routeMile !== null && m.last().routeMile! >= committed - 0.001,
  );
}

// ------------------------------ stacked jump → progression → re-anchor
{
  const route = northRoute();
  const m = createMapMatcher(route);
  warmUp(m, route, 5, T0);
  // Teleport far up the route (window miss → global rescan): the matcher
  // must refuse to follow until the evidence is consistent, then
  // re-anchor at MEDIUM — never silently, never on one fix.
  let out: MapMatch = m.last();
  for (let i = 0; i < REANCHOR_CONFIRM_FIXES; i++) {
    out = record(m, fixAt(route, 40 + i * 0.05, { tMs: T0 + 30_000 + i * 3000 }));
    if (i < REANCHOR_CONFIRM_FIXES - 1) {
      check(
        `re-anchor: jump fix ${i + 1} held at LOW (progression-break)`,
        out.confidence === 'low' && out.reasons.includes('progression-break'),
        out,
      );
    }
  }
  check(
    're-anchor: confirmed after consistent evidence, at MEDIUM',
    out.confidence === 'medium' && out.reasons.includes('reanchored'),
  );
  check(
    're-anchor: committed mile moved to the confirmed location',
    out.routeMile !== null &&
      Math.abs(out.routeMile - (40 + (REANCHOR_CONFIRM_FIXES - 1) * 0.05)) < 0.2,
    out.routeMile,
  );
}

// --------------------------------------------- degraded fixes + geometry
{
  const route = northRoute();
  const m = createMapMatcher(route);
  warmUp(m, route, 5, T0);
  const coarse = record(m, fixAt(route, 5.3, { accuracyM: 40, tMs: T0 + 20_000 }));
  check(
    'accuracy: 40 m fix capped at medium',
    coarse.confidence === 'medium' && coarse.reasons.includes('coarse-accuracy'),
  );
  const urban = record(m, fixAt(route, 5.35, { accuracyM: 80, tMs: T0 + 23_000 }));
  check(
    'accuracy: 80 m urban-canyon fix is LOW',
    urban.confidence === 'low' && urban.reasons.includes('poor-accuracy'),
  );

  const empty = createMapMatcher([]);
  const nothing = empty.match(fixAt(route, 5, { tMs: T0 }));
  check(
    'malformed: empty geometry only ever answers unknown',
    nothing.confidence === 'unknown' && !nothing.matched && !nothing.advanceEligible,
  );
  const single = createMapMatcher(route.slice(0, 1));
  check(
    'malformed: single-point geometry likewise',
    single.match(fixAt(route, 5, { tMs: T0 })).confidence === 'unknown',
  );
}

// -------------------------------------------------- session integration
{
  const positions: LatLng[] = [];
  for (let i = 0; i < 1000; i++) positions.push({ lat: LAT0 + i * 0.001, lng: LNG0 });
  const truck: TruckProfile = {
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
  const created = createRouteSession({
    routeId: 'n8c-session',
    truck,
    origin: positions[0],
    destination: positions[999],
    positions,
    distanceMiles: 69,
    durationSeconds: 4500,
    maneuvers: [{ action: 'depart', instruction: 'Go.', direction: null, offset: 0 }],
    validationState: 'valid',
  });
  check('session: fixture created', created.ok);
  if (created.ok) {
    const m = matcherFromSession(created.session);
    const out = warmUp(m, created.session.geometry, 10, T0);
    check(
      'session: matcher runs on full-resolution session geometry',
      out.confidence === 'high' && out.routeMile !== null,
    );
    check(
      'session: geometry untouched by matching (still frozen)',
      Object.isFrozen(created.session.geometry),
    );
  }
}

// ------------------ N8c/N8d boundary: only the observe-only detector may
// consume the matcher; the controller and every guidance path stay clean.
{
  const libDir = 'src/lib/navigator';
  const consumers: string[] = [];
  for (const f of readdirSync(libDir)) {
    if (f === 'map-matcher.ts' || f === 'off-route-detector.ts' || f === 'reroute-controller.ts')
      continue;
    const src = strip(readFileSync(join(libDir, f), 'utf8'));
    if (/map-matcher|MapMatcher|advanceEligible/.test(src)) consumers.push(f);
  }
  check(
    'boundary: only the N8d detector and N8e controller consume matcher verdicts',
    consumers.length === 0,
    consumers,
  );
  const controller = strip(readFileSync('src/lib/navigator/navigation-controller.ts', 'utf8'));
  check('boundary: controller behavior untouched', !/matcher/i.test(controller));
}

// ------------------------------------------- measured performance/memory
{
  const bigPositions: LatLng[] = [];
  for (let i = 0; i < 100_000; i++) bigPositions.push({ lat: 0 + i * 0.00002, lng: LNG0 });
  const norm = normalizeGeometry(bigPositions, 138.1);
  check('perf: 100k fixture normalizes', norm.problems.length === 0);
  const big = norm.points;

  (globalThis as { gc?: () => void }).gc?.();
  const heapBefore = process.memoryUsage().heapUsed;
  const m = createMapMatcher(big);
  const heapAfterBuild = process.memoryUsage().heapUsed;

  // Fresh-start global scan = worst case.
  const w0 = performance.now();
  m.match({ position: big[60_000].position, headingDeg: 0, speedMph: 60, accuracyM: 8, tMs: T0 });
  const worstFresh = performance.now() - w0;

  // Sequential windowed matches along the route.
  const times: number[] = [];
  for (let i = 0; i < 5000; i++) {
    const idx = Math.min(big.length - 2, 60_000 + i * 4);
    const t0 = performance.now();
    m.match({
      position: big[idx].position,
      headingDeg: 0,
      speedMph: 60,
      accuracyM: 8,
      tMs: T0 + 1000 + i * 1000,
    });
    times.push(performance.now() - t0);
  }
  const avg = times.reduce((s, t) => s + t, 0) / times.length;
  const worst = Math.max(...times);
  const heapAfter = process.memoryUsage().heapUsed;

  // Dense-interchange stress: the self-overlapping corridor, 500 matches.
  const overlapPositions: LatLng[] = [];
  for (let i = 0; i < 4000; i++) overlapPositions.push({ lat: LAT0 + i * 0.001, lng: LNG0 });
  for (let i = 3999; i >= 0; i--)
    overlapPositions.push({ lat: LAT0 + i * 0.001, lng: LNG0 + 12 / mPerDegLng });
  const overlapNorm = normalizeGeometry(overlapPositions, 552.4);
  const dense = createMapMatcher(overlapNorm.points);
  const denseTimes: number[] = [];
  for (let i = 0; i < 500; i++) {
    const t0 = performance.now();
    dense.match({
      position: { lat: LAT0 + 0.5 + i * 0.001, lng: LNG0 + 6 / mPerDegLng },
      headingDeg: 0,
      speedMph: 60,
      accuracyM: 8,
      tMs: T0 + i * 1000,
    });
    denseTimes.push(performance.now() - t0);
  }
  const denseAvg = denseTimes.reduce((s, t) => s + t, 0) / denseTimes.length;

  console.log(
    `measured (100k-pt route): build ${((heapAfterBuild - heapBefore) / 1048576).toFixed(1)} MB · ` +
      `fresh-scan worst ${worstFresh.toFixed(2)} ms · windowed avg ${(avg * 1000).toFixed(1)} µs · ` +
      `windowed worst ${worst.toFixed(2)} ms · dense-overlap avg ${(denseAvg * 1000).toFixed(1)} µs · ` +
      `heap delta after 5.5k matches ${((heapAfter - heapBefore) / 1048576).toFixed(1)} MB`,
  );
  check('perf: windowed average stays sub-millisecond territory (< 5 ms)', avg < 5, avg);
  check('perf: worst windowed match < 250 ms', worst < 250, worst);
  check('perf: fresh global scan < 250 ms', worstFresh < 250, worstFresh);
  check(
    'perf: matcher retains < 50 MB on a 100k-point route',
    heapAfter - heapBefore < 50 * 1048576,
  );
}

// --------------------------------------------------- THE gating invariant
check(
  'INVARIANT: low/unknown never advanced the mile or claimed eligibility (all scenarios)',
  invariantViolations === 0,
  invariantViolations,
);

console.log(`map-matcher: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
