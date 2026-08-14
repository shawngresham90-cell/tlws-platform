/**
 * Trip Planner Phase 1 — the foundation the whole plan rests on.
 *
 * Four things are proved here, in the order they are trusted:
 *
 *   1. THE REQUEST asks for traffic. A plan built from `departureTime=any`
 *      is a free-flow estimate, and HERE excludes current and predicted
 *      traffic entirely for it.
 *   2. THE RESPONSE proves traffic was applied, via `baseDuration`. Asking
 *      is not evidence; the free-flow baseline coming back is.
 *   3. THE CLOCK PIN comes from provider timings or is refused. There is
 *      no average-speed fallback, because a confident pin computed from
 *      an assumed speed is wrong in the dangerous direction exactly when
 *      traffic is bad.
 *   4. THE BUFFER only ever moves the stop EARLIER. It can never add a
 *      legal minute, whatever a caller passes.
 *
 * Provider-shaped fixtures, no network, no key.
 */
import {
  buildHereRouteUrl,
  parseHereResponse,
  type HereManeuver,
} from '@/lib/trip-planner/here-routing';
import type { RoutingRequest } from '@/lib/trip-planner/providers';
import { DEFAULT_TRUCK_PROFILE, HOS, type RemainingClocks } from '@/lib/trip-planner/types';
import {
  DELAY_REPORTING_FLOOR_S,
  mayClaimLiveTraffic,
  trafficVerdict,
  TRAFFIC_NO_DELAY,
} from '@/lib/trip-planner/traffic';
import {
  arrivalAtMeters,
  buildTimeAxis,
  projectAtSeconds,
  COARSE_WINDOW_S,
  TIMING_TOLERANCE,
  type TimeAxis,
} from '@/lib/trip-planner/route-time-axis';
import {
  driveWindow,
  roundDownMinutes,
  DEFAULT_SAFETY_BUFFER_MIN,
  SAFETY_BUFFER_PRESETS,
  isSafetyBufferPreset,
} from '@/lib/trip-planner/drive-window';
import { readFileSync } from 'node:fs';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const T0 = 1_750_000_000_000;
const ATL = { lat: 33.749, lng: -84.388 };
const KNX = { lat: 35.9606, lng: -83.9207 };
/** Reference vector from the flexible-polyline spec: 4 points. */
const SPEC_POLYLINE = 'BFoz5xJ67i1B1B7PzIhaxL7Y';

function req(over: Partial<RoutingRequest> = {}): RoutingRequest {
  return {
    origin: ATL,
    destination: KNX,
    waypoints: [],
    truck: DEFAULT_TRUCK_PROFILE,
    departAtMs: T0,
    avoid: [],
    ...over,
  } as RoutingRequest;
}

/** A provider-shaped section. `base` omitted models a no-traffic response. */
function section(length: number, duration: number, base?: number) {
  return {
    summary: base === undefined ? { length, duration } : { length, duration, baseDuration: base },
    polyline: SPEC_POLYLINE,
    actions: [
      { action: 'depart', instruction: 'Head north.', offset: 0, length, duration },
      { action: 'arrive', instruction: 'Arrive.', offset: 3, length: 0, duration: 0 },
    ],
  };
}
const response = (...sections: unknown[]) => ({ routes: [{ sections }] });

/* ============ 1. the request asks for traffic ========================= */
{
  const url = buildHereRouteUrl(req(), 'TEST_KEY');
  const p = new URLSearchParams(url.split('?')[1]);

  check('request: transportMode is truck', p.get('transportMode') === 'truck');
  const dt = p.get('departureTime');
  check('request: a departureTime is sent at all', dt !== null, dt);
  check(
    'request: departureTime is a real timestamp, never the literal `any`',
    dt !== null && dt.toLowerCase() !== 'any',
    dt,
  );
  check(
    'request: and it is the requested departure, to the second',
    dt === new Date(T0).toISOString(),
    dt,
  );
  // The whole traffic argument rests on this parameter, so a future edit
  // that drops it should fail here rather than in a driver's cab.
  check('request: the key is carried as a parameter, not a header', p.get('apiKey') === 'TEST_KEY');
}

/* ============ 2. the response proves traffic was applied ============== */
{
  const withBase = parseHereResponse(response(section(160934, 7200, 6600)));
  check('parse: baseDuration is read when present', withBase?.baseSeconds === 6600, withBase);
  check('parse: traffic-aware duration is still the primary', withBase?.seconds === 7200);

  const both = parseHereResponse(response(section(80467, 3600, 3300), section(80467, 3600, 3300)));
  check('parse: baseDuration sums across sections', both?.baseSeconds === 6600, both?.baseSeconds);

  // ALL-OR-NOTHING. A partial sum would understate free-flow time and so
  // UNDERSTATE the delay — the failure that matters.
  const partial = parseHereResponse(response(section(80467, 3600, 3300), section(80467, 3600)));
  check(
    'parse: one section without baseDuration discards the whole baseline',
    partial !== null && partial.baseSeconds === null,
    partial?.baseSeconds,
  );

  const none = parseHereResponse(response(section(160934, 7200)));
  check('parse: no baseDuration anywhere reads as null', none?.baseSeconds === null);

  // A baseline longer than the traffic duration is not "negative traffic".
  const inverted = parseHereResponse(response(section(160934, 7200, 7800)));
  check(
    'parse: a baseline longer than the duration is refused, not shown as early',
    inverted !== null && inverted.baseSeconds === null,
    inverted?.baseSeconds,
  );
}

/* ============ 3. what the driver is allowed to be told =============== */
{
  const iso = new Date(T0).toISOString();

  const live = trafficVerdict({ seconds: 7200, baseSeconds: 6600, departureTimeParam: iso });
  check('traffic: proven response is live', live.confidence === 'live');
  check('traffic: delay is duration − baseline', live.delaySeconds === 600, live.delaySeconds);
  check('traffic: the label names the delay in minutes', /10 min/.test(live.label), live.label);
  check('traffic: live may be claimed', mayClaimLiveTraffic(live));

  const quiet = trafficVerdict({
    seconds: 6600 + DELAY_REPORTING_FLOOR_S - 1,
    baseSeconds: 6600,
    departureTimeParam: iso,
  });
  check(
    'traffic: a delay under the floor is not dressed up as a number',
    quiet.label === TRAFFIC_NO_DELAY,
    quiet.label,
  );

  const unconfirmed = trafficVerdict({ seconds: 7200, baseSeconds: null, departureTimeParam: iso });
  check(
    'traffic: asked correctly but unproven is NOT live',
    unconfirmed.confidence === 'unconfirmed',
  );
  check('traffic: and says so', /unavailable/i.test(unconfirmed.label), unconfirmed.label);
  check('traffic: unconfirmed may not claim live', !mayClaimLiveTraffic(unconfirmed));
  check('traffic: unconfirmed reports no delay figure', unconfirmed.delaySeconds === null);

  // The case the whole module exists for.
  for (const bad of ['any', 'ANY', '', null]) {
    const v = trafficVerdict({ seconds: 7200, baseSeconds: 6600, departureTimeParam: bad });
    check(
      `traffic: departureTime=${JSON.stringify(bad)} can never be live`,
      v.confidence === 'not-requested' && !mayClaimLiveTraffic(v),
      v.confidence,
    );
    check(
      `traffic: ...and its baseline is discarded too (${JSON.stringify(bad)})`,
      v.baseSeconds === null && v.delaySeconds === null,
    );
  }

  // The plan is always built from the traffic-aware number.
  check('traffic: the planning duration is always the traffic-aware one', live.seconds === 7200);
}

/* ============ 4. the clock pin comes from provider timings =========== */

/** A straight 100-point route; each action carries real duration + offset. */
function corridor(actions: { offset: number; duration: number; length: number }[]) {
  const positions = Array.from({ length: 100 }, (_, i) => ({
    lat: 33 + i * 0.01,
    lng: -84,
  }));
  const maneuvers: HereManeuver[] = actions.map((a, i) => ({
    action: i === 0 ? 'depart' : 'turn',
    instruction: `step ${i}`,
    direction: null,
    severity: null,
    offset: a.offset,
    lengthM: a.length,
    durationS: a.duration,
  }));
  return { positions, maneuvers };
}

{
  const { positions, maneuvers } = corridor([
    { offset: 0, duration: 1800, length: 40000 },
    { offset: 40, duration: 1800, length: 40000 },
    { offset: 80, duration: 900, length: 20000 },
  ]);
  const total = 1800 + 1800 + 900;
  const axis = buildTimeAxis({
    maneuvers,
    positions,
    totalSeconds: total,
    totalMeters: 100000,
  });
  check('axis: builds from provider actions', axis.ok === true, axis);
  const a = axis as TimeAxis;
  check('axis: total equals the summed action durations', a.totalS === total, a.totalS);

  // Halfway through the second action.
  const mid = projectAtSeconds(a, positions, 1800 + 900);
  check('project: a mid-route target resolves', mid.ok === true, mid);
  if (mid.ok) {
    check(
      'project: the point sits inside the containing action, not at its edge',
      mid.polylineIndex > 40 && mid.polylineIndex < 80,
      mid.polylineIndex,
    );
    check(
      'project: the window is the provider action, stated honestly',
      mid.window.startS === 1800 && mid.window.endS === 3600,
      mid.window,
    );
    check(
      'project: a 30-minute action is reported as coarse, not a pin',
      mid.precision === 'coarse',
      mid.precision,
    );
  }

  // A short action earns a tight answer.
  const fine = corridor([
    { offset: 0, duration: 120, length: 3000 },
    { offset: 50, duration: 120, length: 3000 },
  ]);
  const fineAxis = buildTimeAxis({
    maneuvers: fine.maneuvers,
    positions: fine.positions,
    totalSeconds: 240,
    totalMeters: 6000,
  });
  if (fineAxis.ok) {
    const p = projectAtSeconds(fineAxis, fine.positions, 60);
    check(
      'project: a short action is tight enough to speak of a point',
      p.ok === true && p.precision === 'tight',
      p.ok ? p.precision : p,
    );
    check(
      `project: ...because it is under the ${COARSE_WINDOW_S}s coarse threshold`,
      120 < COARSE_WINDOW_S,
    );
  }

  // Past the end is a DIFFERENT answer, not a pin at the destination.
  const past = projectAtSeconds(a, positions, total + 1);
  check(
    'project: a clock that outlasts the trip refuses rather than pinning the destination',
    past.ok === false && past.reason === 'beyond-route-end',
    past,
  );
}

{
  // Not enough timing to build an axis at all.
  const { positions } = corridor([]);
  const bare: HereManeuver[] = [
    {
      action: 'depart',
      instruction: 'Head north.',
      direction: null,
      severity: null,
      offset: 0,
      lengthM: 1000,
      durationS: null,
    },
  ];
  const refused = buildTimeAxis({
    maneuvers: bare,
    positions,
    totalSeconds: 3600,
    totalMeters: 100000,
  });
  check(
    'axis: refuses when the provider sent no usable timing',
    refused.ok === false && refused.reason === 'no-provider-timing',
    refused,
  );

  // Actions that do not decompose this route must not place a marker on it.
  const drifted = corridor([
    { offset: 0, duration: 1000, length: 40000 },
    { offset: 50, duration: 1000, length: 40000 },
  ]);
  const inconsistent = buildTimeAxis({
    maneuvers: drifted.maneuvers,
    positions: drifted.positions,
    totalSeconds: 7200, // the summary disagrees by ~72%
    totalMeters: 80000,
  });
  check(
    'axis: refuses when action timings contradict the route summary',
    inconsistent.ok === false && inconsistent.reason === 'timing-inconsistent',
    inconsistent,
  );
  check(
    'axis: ...and the refusal quotes both numbers so the blocker is diagnosable',
    inconsistent.ok === false && /\d+s.*\d+s/.test(inconsistent.detail),
    inconsistent.ok === false ? inconsistent.detail : '',
  );
  check(
    `axis: the tolerance is a stated ${(TIMING_TOLERANCE * 100).toFixed(0)}%, not a magic number`,
    TIMING_TOLERANCE > 0 && TIMING_TOLERANCE < 0.1,
  );

  /*
   * GEOMETRY IS OPTIONAL, AND THE DEGRADATION IS ASYMMETRIC ON PURPOSE.
   *
   * The planner's routing port does not retain full polylines. Refusing
   * it timing on that basis would push parking eligibility back onto
   * assumed speed — the failure this work exists to remove. So an axis
   * built without geometry still answers "when do I reach mile N", and
   * only the map PIN degrades.
   */
  const timingOnly = buildTimeAxis({
    maneuvers: drifted.maneuvers,
    totalSeconds: 2000,
    totalMeters: 80000,
  });
  check(
    'axis: builds from timings alone when the provider kept no geometry',
    timingOnly.ok === true && timingOnly.hasGeometry === false,
    timingOnly,
  );
  if (timingOnly.ok) {
    const when = arrivalAtMeters(timingOnly, 40000);
    check(
      'axis: ...and can still time a point on the route, which is what safety needs',
      when.ok === true,
      when,
    );
    const pin = projectAtSeconds(timingOnly, [], 500);
    check(
      'axis: ...while refusing to PLACE one, which needs geometry it does not have',
      pin.ok === false && pin.reason === 'no-geometry',
      pin,
    );
  }

  const noGeometry = buildTimeAxis({
    maneuvers: drifted.maneuvers,
    positions: [{ lat: 1, lng: 1 }],
    totalSeconds: 2000,
    totalMeters: 80000,
  });
  check(
    'axis: a single-point polyline is treated as no geometry, not as a route',
    noGeometry.ok === true && noGeometry.hasGeometry === false,
    noGeometry,
  );
}

{
  /*
   * STRUCTURAL: no average-speed fallback may exist in the projector.
   * A future edit that "helpfully" estimates a pin when the provider
   * timing is missing would defeat every check above, and would do it
   * silently. The source itself is the assertion.
   */
  const src = readFileSync('src/lib/trip-planner/route-time-axis.ts', 'utf8');
  check(
    'axis: the module contains no mph constant',
    !/\bmph\b/i.test(src.replace(/^\s*\*.*$/gm, '')),
  );
  check('axis: and never imports the straight-line estimator', !/route-estimate/.test(src));
}

/* ============ 5. the buffer may only ever cost time ================== */

function clocks(over: Partial<RemainingClocks> = {}): RemainingClocks {
  return {
    drivingMin: 8 * 60,
    windowMin: 10 * 60,
    untilBreakMin: 6 * 60,
    cycleMin: 30 * 60,
    limitedBy: '11-hour',
    legalDrivingMin: 8 * 60,
    ...over,
  };
}

{
  const w = driveWindow(clocks(), 45);
  check('window: a valid clock set produces a window', 'clockLimitMin' in w, w);
  if ('clockLimitMin' in w) {
    check('window: the buffer is recorded as chosen', w.bufferMin === 45);
    check(
      'window: the stop target sits earlier by exactly the buffer',
      w.stopTargetMin === w.clockLimitMin - 45,
      w,
    );
    check('window: and never later than the clock limit', w.stopTargetMin <= w.clockLimitMin);
  }

  // Earliest constraint wins — one case per rule.
  const byDriving = driveWindow(clocks({ drivingMin: 60, windowMin: 600, cycleMin: 1800 }), 0);
  check(
    'window: the 11-hour rule binds when driving time is shortest',
    'limitedBy' in byDriving && byDriving.limitedBy === '11-hour' && byDriving.clockLimitMin === 60,
    byDriving,
  );
  const byCycle = driveWindow(
    clocks({ drivingMin: 600, windowMin: 600, untilBreakMin: 600, cycleMin: 90 }),
    0,
  );
  check(
    'window: the cycle binds when it is shortest',
    'limitedBy' in byCycle && byCycle.limitedBy === 'cycle' && byCycle.clockLimitMin === 90,
    byCycle,
  );

  /*
   * THE BREAK BURNS THE WINDOW. 7h of driving left, 7h of window left,
   * and a break due after 1h: the 30 minutes come out of the window that
   * never pauses, so the usable drive is 6h30m — not 7h.
   */
  const withBreak = driveWindow(
    clocks({ drivingMin: 420, windowMin: 420, untilBreakMin: 60, cycleMin: 3000 }),
    0,
  );
  check(
    'window: a required break consumes the 14-hour window',
    'clockLimitMin' in withBreak && withBreak.clockLimitMin === 420 - HOS.MIN_BREAK_MIN,
    withBreak,
  );
  check(
    'window: and the break is reported as due',
    'breakDueAfterMin' in withBreak &&
      withBreak.breakDueAfterMin === 60 &&
      withBreak.breakConsumesWindow,
    withBreak,
  );

  const noBreak = driveWindow(
    clocks({ drivingMin: 120, windowMin: 300, untilBreakMin: 300, cycleMin: 3000 }),
    0,
  );
  check(
    'window: no break inside the drive means no break claimed',
    'breakDueAfterMin' in noBreak &&
      noBreak.breakDueAfterMin === null &&
      !noBreak.breakConsumesWindow,
    noBreak,
  );

  /*
   * THE INVARIANT. Across the whole preset range and a spread of clock
   * sets, a buffer can never produce a stop target beyond the clock
   * limit — which is the arithmetic form of "a buffer is not legal time".
   */
  let violations = 0;
  for (const buffer of SAFETY_BUFFER_PRESETS) {
    for (const driving of [30, 120, 400, 660]) {
      for (const window of [45, 200, 500, 840]) {
        const r = driveWindow(clocks({ drivingMin: driving, windowMin: window }), buffer);
        if ('clockLimitMin' in r && r.stopTargetMin > r.clockLimitMin) violations++;
      }
    }
  }
  check(
    'window: no preset buffer can ever move the stop target LATER',
    violations === 0,
    violations,
  );

  // A negative buffer must not buy time back.
  const negative = driveWindow(clocks(), -120);
  check(
    'window: a negative buffer is clamped to zero, never added as time',
    'bufferMin' in negative &&
      negative.bufferMin === 0 &&
      negative.stopTargetMin === negative.clockLimitMin,
    negative,
  );

  // An oversized buffer means "stop now", not a negative target.
  const huge = driveWindow(clocks({ drivingMin: 30, windowMin: 30 }), 90);
  check(
    'window: an oversized buffer floors at zero',
    'stopTargetMin' in huge && huge.stopTargetMin === 0,
    huge,
  );

  // Corrupt clocks are refused, never repaired into something plausible.
  for (const bad of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
    const r = driveWindow(clocks({ drivingMin: bad }), 45);
    check(
      `window: a corrupt clock (${bad}) is refused, not repaired`,
      'ok' in r && r.ok === false,
      r,
    );
  }

  check(
    'buffer: the recommended default is one of the presets',
    isSafetyBufferPreset(DEFAULT_SAFETY_BUFFER_MIN),
  );
  check('buffer: 45 minutes is the recommended default', DEFAULT_SAFETY_BUFFER_MIN === 45);
  check('buffer: a non-preset value is rejected', !isSafetyBufferPreset(37));

  // Rounding is conservative in ONE direction, fixed here.
  check('rounding: available time rounds DOWN', roundDownMinutes(59) === 55);
  check('rounding: an exact multiple is unchanged', roundDownMinutes(60) === 60);
  check('rounding: never returns a negative', roundDownMinutes(-10) === 0);
}

console.log(`trip-planner-foundation: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
