/**
 * The heading controller (MapLibre heading-up milestone) — pure tests.
 *
 * Every rule the driving map's orientation depends on, exercised without
 * a browser: angle math that must cross 359°→0° the short way, the
 * evidence ladder (GPS course → route bearing → last reliable → nothing),
 * noise smoothing that still turns fast enough to be useful, and the
 * refusal that matters most — one bad sample must never spin the map
 * around the driver, while a truck that genuinely reversed must be
 * believed a moment later.
 *
 * The screen-geometry section is the milestone's headline claim in pure
 * form: with the map rotated to the travel heading, a LEFT maneuver must
 * come out on the left of the screen and a RIGHT one on the right, for
 * every compass direction — not just for a northbound truck, where a
 * north-up map would accidentally look correct.
 *
 * Run:
 *   node scripts/run-tests.mjs navigator-heading
 */
import {
  bearingBetween,
  branchSide,
  cameraBearing,
  followPadding,
  headingStep,
  interpolateHeading,
  normalizeHeading,
  resetHeading,
  routeBearingAt,
  screenOffsetOf,
  shortestDelta,
  truckScreenFraction,
  FOLLOW_BOTTOM_RESERVED_PX,
  FOLLOW_MARKER_HALF_PX,
  FOLLOW_TOP_PADDING_FRACTION,
  INITIAL_HEADING_STATE,
  MOVING_MIN_MPH,
  REVERSAL_DEG,
  type HeadingSample,
  type HeadingState,
} from '@/lib/navigator/heading';
import type { LatLng } from '@/lib/map/bounds';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(
      `FAIL: ${name}${detail === undefined ? '' : ` — ${String(JSON.stringify(detail)).slice(0, 200)}`}`,
    );
  }
}
const near = (a: number | null, b: number, tol = 1e-6) => a !== null && Math.abs(a - b) <= tol;

const T0 = 1_754_000_000_000;

/* ==================== 1. normalization ================================== */
{
  check('normalize: 0 stays 0', normalizeHeading(0) === 0);
  check('normalize: 359 stays 359', normalizeHeading(359) === 359);
  check('normalize: 360 wraps to 0', normalizeHeading(360) === 0);
  check('normalize: 450 wraps to 90', normalizeHeading(450) === 90);
  check('normalize: -90 wraps to 270', normalizeHeading(-90) === 270);
  check('normalize: -370 wraps to 350', normalizeHeading(-370) === 350);
  check('normalize: 1080 wraps to 0', normalizeHeading(1080) === 0);
  check('normalize: NaN is not a heading', normalizeHeading(Number.NaN) === null);
  check(
    'normalize: Infinity is not a heading',
    normalizeHeading(Number.POSITIVE_INFINITY) === null,
  );
  check(
    'normalize: every output is in [0,360)',
    (() => {
      for (const v of [-1000, -0.5, 0, 12.3, 359.999, 360, 719.5]) {
        const n = normalizeHeading(v);
        if (n === null || n < 0 || n >= 360) return false;
      }
      return true;
    })(),
  );
}

/* ==================== 2. shortest-path delta ============================= */
{
  // THE 359→0 RULE. Naive subtraction answers -358 and sweeps the map
  // the long way around; the driver sees the world spin.
  check('delta: 359 → 1 is +2 (never -358)', shortestDelta(359, 1) === 2);
  check('delta: 1 → 359 is -2 (never +358)', shortestDelta(1, 359) === -2);
  check('delta: 350 → 10 is +20', shortestDelta(350, 10) === 20);
  check('delta: 10 → 350 is -20', shortestDelta(10, 350) === -20);
  check('delta: 0 → 90 is +90', shortestDelta(0, 90) === 90);
  check('delta: 90 → 0 is -90', shortestDelta(90, 0) === -90);
  check('delta: 0 → 180 is +180 (stable, never -180)', shortestDelta(0, 180) === 180);
  check('delta: 180 → 0 is +180 by the same rule', Math.abs(shortestDelta(180, 0)) === 180);
  check(
    'delta: never exceeds a half turn',
    (() => {
      for (let a = 0; a < 360; a += 7) {
        for (let b = 0; b < 360; b += 11) {
          const d = shortestDelta(a, b);
          if (d <= -180 || d > 180) return false;
        }
      }
      return true;
    })(),
  );
  check(
    'delta: is the inverse rotation both ways',
    (() => {
      for (let a = 0; a < 360; a += 13) {
        for (let b = 0; b < 360; b += 17) {
          if (normalizeHeading(a + shortestDelta(a, b)) !== normalizeHeading(b)) return false;
        }
      }
      return true;
    })(),
  );
}

/* ==================== 3. interpolation across the boundary ============== */
{
  check('interp: 359 → 1 at t=0.5 crosses 0 (lands at 0)', interpolateHeading(359, 1, 0.5) === 0);
  check('interp: 0 → 359 at t=0.5 lands at 359.5', near(interpolateHeading(0, 359, 0.5), 359.5));
  check('interp: 350 → 10 at t=0.25 lands at 355', near(interpolateHeading(350, 10, 0.25), 355));
  check('interp: 10 → 350 at t=0.25 lands at 5', near(interpolateHeading(10, 350, 0.25), 5));
  check('interp: t=0 is the start', interpolateHeading(42, 300, 0) === 42);
  check('interp: t=1 is the destination', interpolateHeading(42, 300, 1) === 300);
  check('interp: t clamps below 0', interpolateHeading(90, 100, -5) === 90);
  check('interp: t clamps above 1', interpolateHeading(90, 100, 5) === 100);
  check(
    'interp: output always normalized',
    (() => {
      for (let t = 0; t <= 1; t += 0.1) {
        const v = interpolateHeading(355, 5, t);
        if (v === null || v < 0 || v >= 360) return false;
      }
      return true;
    })(),
  );
}

/* ==================== 4. bearings from coordinates ====================== */
{
  const at = { lat: 35, lng: -85 };
  check('bearing: due north is 0', near(bearingBetween(at, { lat: 35.1, lng: -85 }), 0, 0.5));
  check('bearing: due east is 90', near(bearingBetween(at, { lat: 35, lng: -84.9 }), 90, 0.5));
  check('bearing: due south is 180', near(bearingBetween(at, { lat: 34.9, lng: -85 }), 180, 0.5));
  check('bearing: due west is 270', near(bearingBetween(at, { lat: 35, lng: -85.1 }), 270, 0.5));
  check('bearing: identical points carry no bearing', bearingBetween(at, { ...at }) === null);
  check(
    'bearing: northeast lands in the first quadrant',
    (() => {
      const b = bearingBetween(at, { lat: 35.1, lng: -84.9 });
      return b !== null && b > 30 && b < 60;
    })(),
  );
}

/* ==================== 5. route bearing (evidence rung 2) ================ */
/** A straight polyline of `n` segments — the shape the map component holds. */
function line(from: LatLng, to: LatLng, n = 40): LatLng[] {
  const pts: LatLng[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({
      lat: from.lat + (to.lat - from.lat) * t,
      lng: from.lng + (to.lng - from.lng) * t,
    });
  }
  return pts;
}
{
  const north = line({ lat: 35, lng: -85 }, { lat: 35.1, lng: -85 });
  const east = line({ lat: 35, lng: -85 }, { lat: 35, lng: -84.85 });
  const west = line({ lat: 35, lng: -85 }, { lat: 35, lng: -85.15 });
  const south = line({ lat: 35, lng: -85 }, { lat: 34.9, lng: -85 });
  check(
    'route bearing: northbound route reads ~0',
    near(routeBearingAt(north, { lat: 35.02, lng: -85 }), 0, 1),
  );
  check(
    'route bearing: eastbound route reads ~90',
    near(routeBearingAt(east, { lat: 35, lng: -84.96 }), 90, 1),
  );
  check(
    'route bearing: southbound route reads ~180',
    near(routeBearingAt(south, { lat: 34.97, lng: -85 }), 180, 1),
  );
  check(
    'route bearing: westbound route reads ~270',
    near(routeBearingAt(west, { lat: 35, lng: -85.05 }), 270, 1),
  );
  check(
    'route bearing: a route of one point has none',
    routeBearingAt([north[0]], north[0]) === null,
  );
  check(
    'route bearing: a truck far off the route gets nothing (never a guess)',
    routeBearingAt(north, { lat: 36.5, lng: -83 }) === null,
  );
  check(
    'route bearing: at the very end there is no road ahead to read',
    routeBearingAt(north, north[north.length - 1]) === null,
  );
  check(
    'route bearing: looks AHEAD, not at the nearest two quantized points',
    // A dense polyline: consecutive points are inches apart, so a naive
    // implementation reads noise. The lookahead window fixes the answer.
    near(
      routeBearingAt(line({ lat: 35, lng: -85 }, { lat: 35.02, lng: -85 }, 400), {
        lat: 35.005,
        lng: -85,
      }),
      0,
      1,
    ),
  );
}

/* ==================== 6. the evidence ladder ============================ */
function step(state: HeadingState, over: Partial<HeadingSample>, tMs = T0): HeadingState {
  return headingStep(state, {
    gpsHeadingDeg: null,
    speedMph: 55,
    routeBearingDeg: null,
    tMs,
    ...over,
  });
}
{
  // Rung 4 first: nothing is invented at a cold parked start.
  const cold = step(INITIAL_HEADING_STATE, { gpsHeadingDeg: 217, speedMph: 0 });
  check(
    'ladder: a PARKED truck produces no heading, even with a GPS course',
    cold.heading === null,
  );
  check('ladder: and the map is told so explicitly', cold.source === 'none');
  check('ladder: parked means north-up, not an invented bearing', cameraBearing(cold, true) === 0);

  const crawling = step(INITIAL_HEADING_STATE, {
    gpsHeadingDeg: 217,
    speedMph: MOVING_MIN_MPH - 0.5,
  });
  check('ladder: below the movement floor the course is still noise', crawling.heading === null);

  // Rung 1: moving with a course.
  const gps = step(INITIAL_HEADING_STATE, { gpsHeadingDeg: 90, speedMph: 55 });
  check(
    'ladder: the first real evidence is adopted EXACTLY (no sweep from north)',
    gps.heading === 90,
  );
  check('ladder: and it is labelled as the GPS course', gps.source === 'gps');

  // Rung 2: moving, no course, but on a route.
  const routeOnly = step(INITIAL_HEADING_STATE, {
    gpsHeadingDeg: null,
    speedMph: 55,
    routeBearingDeg: 270,
  });
  check('ladder: a missing GPS course falls back to the ROUTE bearing', routeOnly.heading === 270);
  check('ladder: and says the route supplied it', routeOnly.source === 'route');

  const prefersGps = step(INITIAL_HEADING_STATE, {
    gpsHeadingDeg: 90,
    speedMph: 55,
    routeBearingDeg: 270,
  });
  check('ladder: a valid GPS course OUTRANKS the route bearing', prefersGps.heading === 90);

  // Rung 3: stopped, or evidence gone — hold the last reliable heading.
  const held = step(gps, { gpsHeadingDeg: null, speedMph: 0, routeBearingDeg: null });
  check('ladder: a temporary stop RETAINS the last reliable heading', held.heading === 90);
  check('ladder: and reports that it is being held, not measured', held.source === 'held');
  const stillHeld = step(held, { gpsHeadingDeg: null, speedMph: null, routeBearingDeg: null });
  check('ladder: unknown speed also holds rather than spinning', stillHeld.heading === 90);
  const heldThroughGpsLoss = step(stillHeld, { gpsHeadingDeg: null, speedMph: 55 });
  check(
    'ladder: moving with NO evidence at all still holds the last heading',
    heldThroughGpsLoss.heading === 90,
  );
}

/* ==================== 7. smoothing: noise vs a real turn ================ */
{
  let s = step(INITIAL_HEADING_STATE, { gpsHeadingDeg: 90, speedMph: 55 });
  // Ordinary receiver jitter: ±4° back and forth must not shake the map.
  const jitter = [94, 86, 93, 87, 92, 88];
  let maxExcursion = 0;
  for (const j of jitter) {
    s = step(s, { gpsHeadingDeg: j, speedMph: 55 });
    maxExcursion = Math.max(maxExcursion, Math.abs(shortestDelta(90, s.heading ?? 0)));
  }
  check('smoothing: ±4° jitter never moves the map more than 2°', maxExcursion <= 2, maxExcursion);

  // A real turn: 90° east → 0° north, sustained. It must ARRIVE, and
  // quickly enough to be useful — the driver is in the turn now.
  let t = step(INITIAL_HEADING_STATE, { gpsHeadingDeg: 90, speedMph: 35 });
  const seen: number[] = [];
  for (let i = 0; i < 6; i++) {
    t = step(t, { gpsHeadingDeg: 0, speedMph: 35 });
    seen.push(Math.round(t.heading ?? -1));
  }
  check(
    'smoothing: a real 90° turn is >60% complete within 2 samples',
    Math.abs(shortestDelta(90, seen[1])) >= 54,
    seen,
  );
  // The TAIL is deliberately slower than the body of the turn: once the
  // remaining error drops under TURN_DEG it is indistinguishable from
  // receiver noise, and chasing it is what makes a map twitch at speed.
  // Measured: within 8° by 6 samples, within 3° by 10 — a lag the driver
  // cannot see, on a map that does not shake.
  check(
    'smoothing: within 8° of the new direction by 6 samples',
    Math.abs(shortestDelta(0, seen[5])) <= 8,
    seen,
  );
  check(
    'smoothing: and fully settled (≤3°) by 10 samples — the tail converges, it does not stall',
    (() => {
      let x = step(INITIAL_HEADING_STATE, { gpsHeadingDeg: 90, speedMph: 35 });
      for (let i = 0; i < 10; i++) x = step(x, { gpsHeadingDeg: 0, speedMph: 35 });
      return Math.abs(shortestDelta(0, x.heading ?? 90)) <= 3;
    })(),
  );
  check(
    'smoothing: the turn is monotone — no overshoot past the target',
    (() => {
      let prev = 90;
      for (const v of seen) {
        const d = shortestDelta(v, 0); // remaining rotation to the target
        if (Math.abs(d) > Math.abs(shortestDelta(prev, 0)) + 1e-9) return false;
        prev = v;
      }
      return true;
    })(),
  );

  // The same turn ACROSS the 0/360 boundary: 10° → 350°.
  let w = step(INITIAL_HEADING_STATE, { gpsHeadingDeg: 10, speedMph: 35 });
  for (let i = 0; i < 6; i++) w = step(w, { gpsHeadingDeg: 350, speedMph: 35 });
  check(
    'smoothing: a turn through 0°/360° takes the SHORT way and lands correctly',
    Math.abs(shortestDelta(350, w.heading ?? 0)) <= 3,
    w.heading,
  );
  check(
    'smoothing: and never wandered through the far side of the circle',
    (() => {
      let x = step(INITIAL_HEADING_STATE, { gpsHeadingDeg: 10, speedMph: 35 });
      for (let i = 0; i < 6; i++) {
        x = step(x, { gpsHeadingDeg: 350, speedMph: 35 });
        const h = x.heading ?? 0;
        // The short arc from 10 to 350 passes through 0, never through 180.
        if (h > 20 && h < 340) return false;
      }
      return true;
    })(),
  );
}

/* ==================== 8. the one-bad-sample refusal ===================== */
{
  let s = step(INITIAL_HEADING_STATE, { gpsHeadingDeg: 90, speedMph: 60 });
  for (let i = 0; i < 3; i++) s = step(s, { gpsHeadingDeg: 90, speedMph: 60 });
  const before = s.heading;

  // ONE reflected sample, 180° out. The map must not move at all.
  const glitched = step(s, { gpsHeadingDeg: 270, speedMph: 60 });
  check('reversal: a single 180° sample does NOT move the map', glitched.heading === before, {
    before,
    after: glitched.heading,
  });
  check('reversal: but it is remembered as a candidate', glitched.pending !== null);
  check('reversal: and the state says the heading is being held', glitched.source === 'held');

  // The very next sample is normal again: the glitch is forgotten.
  const recovered = step(glitched, { gpsHeadingDeg: 91, speedMph: 60 });
  check('reversal: a return to normal clears the suspicion', recovered.pending === null);
  check(
    'reversal: and the map is still pointing the way the truck is going',
    Math.abs(shortestDelta(90, recovered.heading ?? 0)) <= 2,
  );

  // A GENUINE reversal (backing off a dock, a U-turn): sustained samples.
  let u = step(INITIAL_HEADING_STATE, { gpsHeadingDeg: 90, speedMph: 25 });
  const first = step(u, { gpsHeadingDeg: 268, speedMph: 25 });
  check('reversal: the first sample of a real U-turn is still refused', first.heading === 90);
  const second = step(first, { gpsHeadingDeg: 270, speedMph: 25 });
  check('reversal: the SECOND agreeing sample is believed', second.heading === 270, second);
  check('reversal: and the suspicion is cleared once accepted', second.pending === null);

  // Two DISAGREEING wild samples are not a reversal — they are noise.
  // Both are beyond REVERSAL_DEG from the held heading of 90 (so each is
  // individually suspect) but 100° apart from each other, so neither
  // confirms the other and the map does not move.
  const wild1 = step(u, { gpsHeadingDeg: 220, speedMph: 25 });
  const wild2 = step(wild1, { gpsHeadingDeg: 320, speedMph: 25 });
  check(
    'reversal: two disagreeing wild samples never confirm each other',
    wild2.heading === 90,
    wild2,
  );
  check(
    'reversal: the second wild sample replaces the candidate, it does not stack',
    wild2.pending?.count === 1,
    wild2.pending,
  );
  // A sample inside the plausible band is NOT a reversal and is simply
  // smoothed — the guard exists for impossible swings, not for sharp turns.
  const sharp = step(u, { gpsHeadingDeg: 20, speedMph: 25 });
  check(
    'reversal: a 70° swing is a plausible turn and is smoothed, not refused',
    sharp.heading !== 90 && Math.abs(shortestDelta(20, sharp.heading ?? 0)) < 70,
  );

  // A stop between the two halves of a suspected reversal drops it: the
  // truck that stopped may have been repositioned, and stale evidence
  // must not combine with fresh evidence to force a flip.
  const paused = step(first, { gpsHeadingDeg: null, speedMph: 0 });
  const afterPause = step(paused, { gpsHeadingDeg: 270, speedMph: 25 });
  check(
    'reversal: a stop clears pending evidence (no stale confirmation)',
    afterPause.heading === 90,
  );
  check('reversal: threshold is a documented constant, not a magic number', REVERSAL_DEG === 120);
}

/* ==================== 9. trip end resets the orientation ================ */
{
  let s = step(INITIAL_HEADING_STATE, { gpsHeadingDeg: 180, speedMph: 55 });
  check('reset: a live trip has a heading', s.heading === 180);
  s = resetHeading();
  check('reset: a genuinely ended trip drops it', s.heading === null);
  check('reset: and the next cold start invents nothing', cameraBearing(s, true) === 0);
  check(
    'reset: the reset state is the initial state',
    JSON.stringify(s) === JSON.stringify(INITIAL_HEADING_STATE),
  );
  check(
    'reset: returns a fresh object (frozen initial state is never mutated)',
    s !== INITIAL_HEADING_STATE,
  );
}

/* ==================== 10. camera bearing + follow padding =============== */
{
  const live: HeadingState = { ...INITIAL_HEADING_STATE, heading: 137, source: 'gps' };
  check('camera: heading-up while guidance is live', cameraBearing(live, true) === 137);
  check(
    'camera: north-up when guidance is NOT live (parked, briefing)',
    cameraBearing(live, false) === 0,
  );
  check(
    'camera: north-up when there is no evidence, even mid-trip',
    cameraBearing(INITIAL_HEADING_STATE, true) === 0,
  );

  const pad = followPadding(800, true);
  check(
    'padding: the top is padded, pushing the truck DOWN the screen',
    pad.top > 0 && pad.bottom === 0,
  );
  check(
    'padding: the truck sits in the lower middle (65–80% down)',
    (() => {
      // The camera centers in the padded box: center = top + (h - top)/2.
      const center = pad.top + (800 - pad.top) / 2;
      const frac = center / 800;
      return frac >= 0.65 && frac <= 0.8;
    })(),
  );
  check(
    'padding: more road ahead than behind (≥2:1)',
    (() => {
      const center = pad.top + (800 - pad.top) / 2;
      return center / (800 - center) >= 2;
    })(),
  );
  check(
    'padding: parked/overview centers normally',
    JSON.stringify(followPadding(800, false)) ===
      JSON.stringify({ top: 0, bottom: 0, left: 0, right: 0 }),
  );
  check(
    'padding: a zero-height container never produces NaN padding',
    followPadding(0, true).top === 0,
  );

  /*
   * SHORT SCREENS. The cockpit's own bottom band — trip strip, HOS
   * clocks, Stop row — owns the last ~220 px, and an unconditional 0.42
   * buries the truck underneath it. Measured in Chromium at 320x568 and
   * 932x430: the obstruction check failed on both until the target was
   * clamped above the band.
   */
  const shortPad = followPadding(568, true);
  check(
    'padding: on a short phone the truck stays ABOVE the cockpit band',
    truckScreenFraction(568, shortPad.top) * 568 <= 568 - FOLLOW_BOTTOM_RESERVED_PX + 1,
    { top: shortPad.top, y: truckScreenFraction(568, shortPad.top) * 568 },
  );
  check(
    'padding: and is still below the middle of the screen',
    truckScreenFraction(568, shortPad.top) > 0.5,
    truckScreenFraction(568, shortPad.top),
  );
  const landscapePad = followPadding(430, true);
  check(
    'padding: a short LANDSCAPE screen has no room to favour ahead, so it centres',
    landscapePad.top === 0 && truckScreenFraction(430, landscapePad.top) === 0.5,
    landscapePad,
  );
  /*
   * THE CLAMP BINDS WHEN, AND ONLY WHEN, THE BAND NEEDS IT.
   *
   * This used to assert that a tall phone was "unaffected by the clamp
   * (still ~71%)", which was true of the DEFAULT 220 px reserve and not
   * true of the screen drivers actually hold: the measured band at
   * 390x844 is 254 px, so the clamp binds there and always did — the
   * cleanup milestone simply made the measurement reach the camera.
   *
   * What is worth pinning is the shape of the rule, so it is pinned
   * directly: give the band room and the 0.42 fraction governs; take the
   * room away and the truck is lifted exactly enough to clear.
   */
  check(
    'padding: with a SMALL band a tall phone keeps the unclamped fraction',
    Math.abs(truckScreenFraction(844, followPadding(844, true, 120).top) - 0.71) < 0.01,
    truckScreenFraction(844, followPadding(844, true, 120).top),
  );
  {
    // The real 390x844 cockpit: 254 px of band, measured in Chromium.
    const real = followPadding(844, true, 254);
    const centre = truckScreenFraction(844, real.top) * 844;
    check(
      'padding: with the REAL band the clamp lifts the truck clear of it',
      centre <= 844 - 254 - FOLLOW_MARKER_HALF_PX,
      { centre, bandTop: 844 - 254 },
    );
    check(
      'padding: and the marker itself clears, not merely its centre',
      centre + FOLLOW_MARKER_HALF_PX < 844 - 254,
      { markerBottom: centre + FOLLOW_MARKER_HALF_PX, bandTop: 844 - 254 },
    );
    check(
      'padding: while staying in the lower half — road ahead still favoured',
      truckScreenFraction(844, real.top) > 0.5,
      truckScreenFraction(844, real.top),
    );
  }
  check(
    'padding: the reserved band is a documented constant, not a magic number',
    FOLLOW_BOTTOM_RESERVED_PX >= 180 && FOLLOW_BOTTOM_RESERVED_PX <= 260,
  );
  check(
    'padding: the reserve is overridable, so the layout can tune it in one place',
    followPadding(568, true, 0).top > followPadding(568, true, 300).top,
  );
  check(
    'padding: the fraction is a named constant',
    FOLLOW_TOP_PADDING_FRACTION > 0.3 && FOLLOW_TOP_PADDING_FRACTION < 0.5,
  );
}

/* ==================== 11. THE HEADLINE: turns branch correctly ========== */
{
  /*
   * The milestone's acceptance standard, in pure geometry: with the map
   * rotated to the travel bearing, the road after the maneuver must land
   * on the correct SIDE of the screen — for a truck travelling in any
   * direction, not just north.
   *
   * Each case: the truck is at the maneuver point travelling `bearing`,
   * and the road after the turn heads off in `after`.
   */
  const truck: LatLng = { lat: 35, lng: -85 };
  const d = 0.05;
  const N: LatLng = { lat: truck.lat + d, lng: truck.lng };
  const S: LatLng = { lat: truck.lat - d, lng: truck.lng };
  const E: LatLng = { lat: truck.lat, lng: truck.lng + d };
  const W: LatLng = { lat: truck.lat, lng: truck.lng - d };

  const cases: [string, number, LatLng, 'left' | 'right'][] = [
    ['northbound truck turning west', 0, W, 'left'],
    ['northbound truck turning east', 0, E, 'right'],
    ['eastbound truck turning north', 90, N, 'left'],
    ['eastbound truck turning south', 90, S, 'right'],
    ['southbound truck turning east', 180, E, 'left'],
    ['southbound truck turning west', 180, W, 'right'],
    ['westbound truck turning south', 270, S, 'left'],
    ['westbound truck turning north', 270, N, 'right'],
  ];
  for (const [name, bearing, after, want] of cases) {
    check(
      `branch: ${name} → branches ${want} on screen`,
      branchSide(truck, after, bearing) === want,
      {
        got: branchSide(truck, after, bearing),
        offset: screenOffsetOf(truck, after, bearing),
      },
    );
  }

  // The road AHEAD must be up the screen (negative y in browser axes) for
  // every direction of travel — that is what "heading-up" means.
  for (const [name, bearing, ahead] of [
    ['northbound', 0, N],
    ['eastbound', 90, E],
    ['southbound', 180, S],
    ['westbound', 270, W],
  ] as [string, number, LatLng][]) {
    const off = screenOffsetOf(truck, ahead, bearing);
    check(
      `heading-up: the ${name} road ahead is UP the screen`,
      off.y < 0 && Math.abs(off.x) < 1e-6,
      off,
    );
  }

  // And the road already travelled must be BELOW the truck.
  const behind = screenOffsetOf(truck, S, 0);
  check('heading-up: a northbound truck sees travelled road BELOW it', behind.y > 0);

  // An off-axis case, to prove the rotation is real trigonometry and not
  // four hard-coded compass branches. Note the point one degree-step
  // north-east is NOT at bearing 45: a degree of longitude is shorter
  // than a degree of latitude at 35°N, so its true bearing is ~39°. The
  // invariant under test is the general one — rotating by the bearing TO
  // a point puts that point straight up the screen, whatever the angle.
  const ne: LatLng = { lat: truck.lat + d, lng: truck.lng + d };
  const neBearing = bearingBetween(truck, ne) ?? 0;
  check(
    'heading-up: the off-axis bearing is genuinely oblique (~39°, not 45)',
    neBearing > 35 && neBearing < 43,
    neBearing,
  );
  const offNe = screenOffsetOf(truck, ne, neBearing);
  // Angular alignment, not an absolute offset: the screen model is
  // equirectangular while the bearing is spherical, so a few miles out
  // they differ by ~0.02° — far below anything visible, and the renderer
  // does the real projection anyway. What must hold is that the road
  // lands on the vertical axis.
  check(
    'heading-up: rotating to that bearing puts the road straight up (<0.06° off axis)',
    Math.abs(offNe.x / offNe.y) < 0.001 && offNe.y < 0,
    offNe,
  );
  // And one degree of rotation either side moves it to the correct side.
  check(
    'heading-up: rotating 10° short of it leaves the road to the RIGHT',
    screenOffsetOf(truck, ne, neBearing - 10).x > 0,
  );
  check(
    'heading-up: rotating 10° past it leaves the road to the LEFT',
    screenOffsetOf(truck, ne, neBearing + 10).x < 0,
  );
  check(
    'branch: a road dead ahead is neither left nor right',
    branchSide(truck, N, 0) === 'straight',
  );

  // Compared against a NORTH-UP map: the same eastbound left turn would
  // appear at the TOP of the screen, not the left — the exact confusion
  // this milestone removes.
  const northUp = screenOffsetOf(truck, N, 0);
  check(
    "contrast: north-up puts an eastbound truck's LEFT turn at the top of the screen, not the left",
    Math.abs(northUp.x) < 1e-6 && northUp.y < 0,
  );
  check(
    'contrast: heading-up puts that same turn on the left where the driver looks',
    screenOffsetOf(truck, N, 90).x < 0,
  );
}

console.log(`navigator-heading: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
