/**
 * Navigator milestone N3: RouteTracker — projection via the existing
 * `projectOntoRoute`, plus the one thing the wrapper adds: a route-mile
 * that is monotonic by construction. Covers cloverleaf back-projection
 * rejection, genuine-reversal acceptance after 3 consecutive consistent
 * fixes, remaining-miles, the tolerance boundary, unprojectable fixes, and
 * two committed synthetic replay traces run through the REAL
 * GPSSessionManager -> RouteTracker composition (the first replay fixtures
 * of the architecture package's test plan; synthetic, never recorded from
 * a real driver).
 *
 * Run:
 *   npx esbuild scripts/test-route-tracker.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --outfile=/tmp/test-route-tracker.cjs && node /tmp/test-route-tracker.cjs
 */
import { readFileSync } from 'node:fs';
import {
  BACKWARD_TOLERANCE_MI,
  createRouteTracker,
  MAX_PROJECTION_MILES,
  REVERSAL_CONFIRM_FIXES,
} from '@/lib/navigator/route-tracker';
import { createGpsSession } from '@/lib/navigator/gps-session';
import type { RoutePoint } from '@/lib/trip-planner/directory-layer';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

const MILE_LAT = 1 / 69.05;

/** A straight northbound route along lng=-84: one point per 0.05 mi. */
function straightRoute(totalMi: number): RoutePoint[] {
  const pts: RoutePoint[] = [];
  for (let mile = 0; mile <= totalMi + 1e-9; mile += 0.05) {
    pts.push({
      position: { lat: 35 + mile * MILE_LAT, lng: -84 },
      routeMile: Number(mile.toFixed(2)),
    });
  }
  return pts;
}

const atMile = (mile: number, lngOffset = 0) => ({
  lat: 35 + mile * MILE_LAT,
  lng: -84 + lngOffset,
});

// ------------------------------------------------------------ construction
{
  let threw = false;
  try {
    createRouteTracker([{ position: { lat: 35, lng: -84 }, routeMile: 0 }]);
  } catch {
    threw = true;
  }
  check('construction: rejects a one-point route', threw);
}

// ------------------------------------------------------- forward tracking
{
  const t = createRouteTracker(straightRoute(10));
  const first = t.update(atMile(0.2));
  check('forward: projects onto the route', Math.abs(first.routeMile - 0.2) < 0.05, first.routeMile);
  check('forward: high confidence on-route', first.confidence === 'high');
  check('forward: offRoute ~0 on the line', first.offRouteMiles !== null && first.offRouteMiles < 0.05);
  const second = t.update(atMile(1.0));
  check('forward: advances', Math.abs(second.routeMile - 1.0) < 0.05, second.routeMile);
  check('forward: remaining = total - mile', Math.abs(second.remainingMi - 9.0) < 0.1, second.remainingMi);
}

// ------------------------------------------------- within-tolerance jitter
{
  const t = createRouteTracker(straightRoute(10));
  t.update(atMile(2.0));
  const jitter = t.update(atMile(2.0 - BACKWARD_TOLERANCE_MI + 0.01));
  check('jitter: small backward projection never lowers the mile', jitter.routeMile >= 2.0 - 0.05, jitter.routeMile);
  check('jitter: stays high confidence', jitter.confidence === 'high');
  check('jitter: no reversal counting', jitter.heldBackwardFixes === 0);
}

// ------------------------------------------- cloverleaf back-projection
{
  // A ramp passing under the mainline: the nearest-point projection snaps
  // 2 miles backwards for two fixes, then normal forward fixes resume.
  const t = createRouteTracker(straightRoute(10));
  t.update(atMile(3.0));
  const snap1 = t.update(atMile(1.0));
  check('cloverleaf: first back-projection held', snap1.routeMile >= 2.95, snap1.routeMile);
  check('cloverleaf: hold reports low confidence', snap1.confidence === 'low');
  check('cloverleaf: hold counted', snap1.heldBackwardFixes === 1);
  const snap2 = t.update(atMile(1.0));
  check('cloverleaf: second identical snap still held', snap2.routeMile >= 2.95, snap2.routeMile);
  const resume = t.update(atMile(3.1));
  check('cloverleaf: forward fix ends the hold', Math.abs(resume.routeMile - 3.1) < 0.05, resume.routeMile);
  check('cloverleaf: counter reset on resume', resume.heldBackwardFixes === 0);
  check('cloverleaf: confidence recovers', resume.confidence === 'high');
}

// ----------------------------------------------------- genuine reversal
{
  const t = createRouteTracker(straightRoute(10));
  t.update(atMile(3.0));
  const r1 = t.update(atMile(2.6));
  const r2 = t.update(atMile(2.4));
  check('reversal: first two backward fixes hold', r1.routeMile >= 2.95 && r2.routeMile >= 2.95);
  check('reversal: counting toward confirmation', r2.heldBackwardFixes === 2);
  const r3 = t.update(atMile(2.2));
  check(
    `reversal: adopted after ${REVERSAL_CONFIRM_FIXES} consecutive consistent fixes`,
    Math.abs(r3.routeMile - 2.2) < 0.05,
    r3.routeMile,
  );
  check('reversal: confidence high once adopted', r3.confidence === 'high');
  const onward = t.update(atMile(2.5));
  check('reversal: forward progress resumes from the adopted mile', Math.abs(onward.routeMile - 2.5) < 0.05);
}
{
  // INCONSISTENT backward fixes (projection flicker between crossing
  // roadways) never confirm a reversal: each inconsistent jump restarts
  // the count.
  const t = createRouteTracker(straightRoute(10));
  t.update(atMile(5.0));
  t.update(atMile(4.5)); // held (1)
  const flick = t.update(atMile(2.0)); // 2.5 mi from previous backward candidate
  check('flicker: inconsistent backward candidate restarts the count', flick.heldBackwardFixes === 1);
  t.update(atMile(4.4)); // inconsistent with 2.0 again -> restart
  const still = t.state();
  check('flicker: mile never moved through all of it', still.routeMile >= 4.95, still.routeMile);
}

// ------------------------------------------------------- unprojectable
{
  const t = createRouteTracker(straightRoute(10));
  t.update(atMile(1.0));
  // ~3.4 mi east of the route at 35°N — beyond MAX_PROJECTION_MILES.
  const off = t.update(atMile(1.0, 0.06));
  check('unprojectable: mile held', off.routeMile >= 0.95, off.routeMile);
  check('unprojectable: offRouteMiles null', off.offRouteMiles === null);
  check('unprojectable: low confidence', off.confidence === 'low');
  check(
    `unprojectable: window is ${MAX_PROJECTION_MILES} mi`,
    MAX_PROJECTION_MILES === 2,
  );
  const back = t.update(atMile(1.2));
  check('unprojectable: recovers on the next on-route fix', back.confidence === 'high' && Math.abs(back.routeMile - 1.2) < 0.05);
}

// ------------------------------------------------------ off-route distance
{
  const t = createRouteTracker(straightRoute(10));
  // ~0.57 mi east of the line (0.01° lng at 35°N).
  const st = t.update(atMile(2.0, 0.01));
  check(
    'off-route: reports the projected distance',
    st.offRouteMiles !== null && st.offRouteMiles > 0.4 && st.offRouteMiles < 0.8,
    st.offRouteMiles,
  );
  check('off-route: still projects the mile', Math.abs(st.routeMile - 2.0) < 0.1);
}

// ----------------------------------------- replay: northbound composition
{
  type TraceRow = { tMs: number; lat: number; lng: number; accuracy: number; speed: number | null; heading: number | null };
  const rows: TraceRow[] = readFileSync('scripts/fixtures/traces/synthetic-northbound-60mph.jsonl', 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
  check('replay nb: fixture committed and readable (120 fixes)', rows.length === 120);

  const session = createGpsSession();
  const tracker = createRouteTracker(straightRoute(5));
  let lastMile = -1;
  let monotonic = true;
  let lowConfidence = 0;
  for (const r of rows) {
    const st = session.ingestFix({
      lat: r.lat, lng: r.lng, accuracyM: r.accuracy, speedMps: r.speed, headingDeg: r.heading, tMs: r.tMs,
    });
    session.tick(r.tMs);
    if (!st.fix || st.fix.tMs !== r.tMs) continue;
    const tr = tracker.update(st.fix);
    if (tr.routeMile < lastMile) monotonic = false;
    lastMile = tr.routeMile;
    if (tr.confidence === 'low') lowConfidence++;
  }
  check('replay nb: session gates accept the whole clean trace', session.state().health === 'good');
  check('replay nb: route-mile monotonic across 120 fixes', monotonic);
  check('replay nb: zero low-confidence ticks', lowConfidence === 0, lowConfidence);
  check('replay nb: final mile ≈ 2.0 (120 s at 60 mph)', Math.abs(lastMile - 2.0) < 0.1, lastMile);
}

// -------------------------------------------- replay: genuine reversal
{
  type TraceRow = { tMs: number; lat: number; lng: number; accuracy: number; speed: number | null; heading: number | null };
  const rows: TraceRow[] = readFileSync('scripts/fixtures/traces/synthetic-genuine-reversal.jsonl', 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
  check('replay rev: fixture committed and readable (120 fixes)', rows.length === 120);

  const session = createGpsSession();
  const tracker = createRouteTracker(straightRoute(5));
  let peak = 0;
  for (const r of rows) {
    const st = session.ingestFix({
      lat: r.lat, lng: r.lng, accuracyM: r.accuracy, speedMps: r.speed, headingDeg: r.heading, tMs: r.tMs,
    });
    session.tick(r.tMs);
    if (!st.fix || st.fix.tMs !== r.tMs) continue;
    const tr = tracker.update(st.fix);
    peak = Math.max(peak, tr.routeMile);
  }
  const final = tracker.state();
  check('replay rev: reached ~mile 1.0 before reversing', Math.abs(peak - 0.98) < 0.1, peak);
  check(
    'replay rev: continuous 60 s backward run was ACCEPTED as a genuine reversal',
    final.routeMile < peak - 0.15,
    { final: final.routeMile, peak },
  );
  // A sustained reversal descends in confirmation steps (each new step needs
  // the 0.15 mi tolerance plus 3 consistent fixes), so the tracker trails the
  // truck (at ~mile 0.65) by at most one step rather than matching it exactly.
  check(
    'replay rev: tracker follows the truck to within one confirmation step',
    final.routeMile >= 0.6 && final.routeMile <= 0.9,
    final.routeMile,
  );
}

console.log(`route-tracker: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
