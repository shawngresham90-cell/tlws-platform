/**
 * Break placement and weather matching, on provider time.
 *
 * Both answer a question of the form "where will the truck be, and when",
 * and both used to answer it from an assumed speed — the break by distance
 * arithmetic, the weather by a flat 50 mph inside the NWS adapter. That is
 * the same error the clock pin and parking eligibility were moved off, and
 * it fails in the same direction: it places the truck somewhere it is not.
 *
 * What is proved here:
 *
 *   1. A break inside the drive is placed from provider timing, early by a
 *      stated lead, and never claimed when the drive ends first.
 *   2. Without provider timing, neither a break nor a weather section is
 *      produced — they refuse and say so.
 *   3. An alert is matched to the time the truck ARRIVES, so expired and
 *      irrelevant ones are dropped.
 *   4. A Canadian route is never matched against US alerts.
 */
import { planBreak, BREAK_LEAD_MIN, NO_BREAK_EXPECTED } from '@/lib/trip-planner/break-plan';
import {
  relevantWeather,
  isTruckingHazard,
  CANADA_WEATHER_UNAVAILABLE,
} from '@/lib/trip-planner/route-weather-timing';
import {
  buildTimeAxis,
  routeTimingFromAxis,
  timingUnavailable,
  type RouteTiming,
} from '@/lib/trip-planner/route-time-axis';
import type { HereManeuver } from '@/lib/trip-planner/here-routing';
import type { WeatherAlert } from '@/lib/trip-planner/providers';
import type { RemainingClocks } from '@/lib/trip-planner/types';
import { readFileSync } from 'node:fs';

/** Both ends in the United States — the only shape NWS may answer for. */
const US_ROUTE = {
  origin: 'US',
  destination: 'US',
  crossBorder: false,
  fullyUS: true,
  touchesCanada: false,
} as const;
/** Both ends in Canada. */
const CA_ROUTE = {
  origin: 'CA',
  destination: 'CA',
  crossBorder: false,
  fullyUS: false,
  touchesCanada: true,
} as const;

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
const METERS_PER_MILE = 1609.344;
const MIN = 60_000;

/** Actions of `mileStep` miles each, taking `minutesPer` minutes. */
function timingFor(steps: number, mileStep: number, minutesPer: number): RouteTiming {
  const maneuvers: HereManeuver[] = Array.from({ length: steps }, (_, i) => ({
    action: i === 0 ? 'depart' : 'turn',
    instruction: `step ${i}`,
    direction: null,
    severity: null,
    offset: i,
    lengthM: mileStep * METERS_PER_MILE,
    durationS: minutesPer * 60,
  }));
  const axis = buildTimeAxis({
    maneuvers,
    totalSeconds: steps * minutesPer * 60,
    totalMeters: steps * mileStep * METERS_PER_MILE,
  });
  if (!axis.ok) throw new Error(`fixture axis failed: ${axis.detail}`);
  return routeTimingFromAxis(axis);
}

function clocks(over: Partial<RemainingClocks> = {}): RemainingClocks {
  return {
    drivingMin: 600,
    windowMin: 700,
    untilBreakMin: 240,
    cycleMin: 3000,
    limitedBy: '11-hour',
    legalDrivingMin: 600,
    ...over,
  };
}

/* ============ 1. the break, placed by the provider ================== */
{
  // 120 steps × 5 miles at 5 min = 600 miles, 600 minutes, tight windows.
  const timing = timingFor(120, 5, 5);

  const plan = planBreak({
    clocks: clocks({ untilBreakMin: 240 }),
    usableDriveMin: 500,
    timing,
    departAtMs: T0,
  });
  check(
    'break: required when the break clock runs out inside the drive',
    plan.required === true,
    plan,
  );
  if (plan.required === true) {
    check(
      `break: aimed ${BREAK_LEAD_MIN} minutes early, not at the exact limit`,
      plan.targetMin === 240 - BREAK_LEAD_MIN,
      plan.targetMin,
    );
    // 220 minutes at 1 mile/minute ≈ mile 220, from provider timing alone.
    check(
      'break: the target mile comes from provider timing',
      plan.targetMile !== null && Math.abs(plan.targetMile - 220) < 6,
      plan.targetMile,
    );
    check(
      'break: arrival is stated as a worst-case wall-clock time',
      plan.byMs > T0 && plan.byMs <= T0 + 240 * MIN,
      new Date(plan.byMs).toISOString(),
    );
    check('break: and it costs the window 30 minutes', plan.costsWindowMin === 30);
  }

  // The drive ends before the break clock does.
  const none = planBreak({
    clocks: clocks({ untilBreakMin: 400 }),
    usableDriveMin: 300,
    timing,
    departAtMs: T0,
  });
  check('break: not claimed when the drive ends first', none.required === false, none);
  check(
    'break: ...and says so in the engine’s own terms',
    none.required === false && none.reason === NO_BREAK_EXPECTED,
  );
  check(
    'break: the wording never implies a stop QUALIFIES as a legal break',
    !/qualif|legal|counts as/i.test(NO_BREAK_EXPECTED),
    NO_BREAK_EXPECTED,
  );

  // No provider timing → no placement.
  const blind = planBreak({
    clocks: clocks({ untilBreakMin: 240 }),
    usableDriveMin: 500,
    timing: timingUnavailable('route is a straight-line estimate'),
    departAtMs: T0,
  });
  check('break: refuses to place without provider timing', blind.required === null, blind);
  check(
    'break: ...and names travel times as the reason',
    blind.required === null && /travel times/i.test(blind.problem),
    blind,
  );

  const corrupt = planBreak({
    clocks: clocks({ untilBreakMin: Number.NaN }),
    usableDriveMin: 500,
    timing,
    departAtMs: T0,
  });
  check('break: a corrupt break clock refuses, never defaults', corrupt.required === null, corrupt);
}

/* ============ 2. weather matched to arrival TIME =================== */
function alert(over: Partial<WeatherAlert> = {}): WeatherAlert {
  return {
    headline: 'Winter Storm Warning',
    severity: 'warning',
    fromMile: 200,
    toMile: 260,
    expiresMs: T0 + 600 * MIN,
    ...over,
  };
}

{
  const timing = timingFor(120, 5, 5); // 1 mile per minute

  const live = relevantWeather({
    alerts: [alert()],
    timing,
    departAtMs: T0,
    region: US_ROUTE,
    source: 'nws-us',
  });
  check(
    'weather: a hazard on the route ahead is matched',
    live.ok === true && live.matches.length === 1,
    live,
  );
  if (live.ok && live.matches[0]) {
    const m = live.matches[0];
    // Mile 200 at 1 mile/min ≈ 200 minutes in.
    check(
      'weather: the encounter time comes from provider timing',
      Math.abs((m.reachesAtMs - T0) / MIN - 200) < 6,
      (m.reachesAtMs - T0) / MIN,
    );
    check('weather: and a worst case is carried beside it', m.reachesByMs >= m.reachesAtMs);
  }

  /*
   * EXPIRY IS COMPARED AGAINST ARRIVAL, NOT AGAINST NOW. This alert is
   * live at departure and lapses an hour before the truck can reach it.
   */
  const stale = relevantWeather({
    alerts: [alert({ expiresMs: T0 + 140 * MIN })],
    timing,
    departAtMs: T0,
    region: US_ROUTE,
    source: 'nws-us',
  });
  check(
    'weather: an alert that lapses before the truck arrives is dropped',
    stale.ok === true && stale.matches.length === 0,
    stale,
  );

  // ...and the same alert IS kept for a truck that gets there sooner.
  const fast = relevantWeather({
    alerts: [alert({ expiresMs: T0 + 140 * MIN })],
    timing: timingFor(120, 5, 1), // 5 miles per minute
    departAtMs: T0,
    region: US_ROUTE,
    source: 'nws-us',
  });
  check(
    'weather: ...but kept when the truck arrives before it lapses',
    fast.ok === true && fast.matches.length === 1,
    fast,
  );

  const offRoute = relevantWeather({
    alerts: [alert({ fromMile: 5000 })],
    timing,
    departAtMs: T0,
    region: US_ROUTE,
    source: 'nws-us',
  });
  check(
    'weather: an alert covering road this route never touches is dropped',
    offRoute.ok === true && offRoute.matches.length === 0,
  );

  const notTrucking = relevantWeather({
    alerts: [alert({ headline: 'Beach Hazards Statement' })],
    timing,
    departAtMs: T0,
    region: US_ROUTE,
    source: 'nws-us',
  });
  check(
    'weather: a hazard that does not change how a truck is driven is dropped',
    notTrucking.ok === true && notTrucking.matches.length === 0,
  );
  check('weather: high wind IS a trucking hazard', isTruckingHazard('High Wind Warning'));
  check('weather: ice IS a trucking hazard', isTruckingHazard('Ice Storm Warning'));
  check('weather: a beach statement is not', !isTruckingHazard('Beach Hazards Statement'));

  const blind = relevantWeather({
    alerts: [alert()],
    timing: timingUnavailable('estimate'),
    departAtMs: T0,
    region: US_ROUTE,
    source: 'nws-us',
  });
  check(
    'weather: without provider timing the section refuses rather than guessing',
    blind.ok === false && blind.reason === 'timing-unavailable',
    blind,
  );
}

/* ============ 3. Canada is never answered with a US feed =========== */
{
  const timing = timingFor(120, 5, 5);
  const ca = relevantWeather({
    alerts: [alert()],
    timing,
    departAtMs: T0,
    region: CA_ROUTE,
    source: 'nws-us',
  });
  check(
    'canada: a US feed is refused for a Canadian route, whatever it contains',
    ca.ok === false && ca.reason === 'region-unsupported',
    ca,
  );
  check(
    'canada: and the driver is told to check Environment Canada',
    ca.ok === false && /Environment Canada/.test(ca.notice),
    ca,
  );
  check(
    'canada: the notice never reads as "no alerts"',
    !/no alerts|clear/i.test(CANADA_WEATHER_UNAVAILABLE),
    CANADA_WEATHER_UNAVAILABLE,
  );

  // The region gate is checked BEFORE timing, so a Canadian route with
  // perfect timing still gets the honest refusal rather than an empty list.
  const caBlind = relevantWeather({
    alerts: [alert()],
    timing: timingUnavailable('estimate'),
    departAtMs: T0,
    region: CA_ROUTE,
    source: 'nws-us',
  });
  check(
    'canada: the region gate is reached before the timing gate',
    caBlind.ok === false && caBlind.reason === 'region-unsupported',
    caBlind,
  );
}

/* ============ 4. structural: no assumed speed in either module ===== */
{
  const clean = (src: string) => src.replace(/^\s*\*.*$/gm, '');
  const breakSrc = clean(readFileSync('src/lib/trip-planner/break-plan.ts', 'utf8'));
  const weatherSrc = clean(readFileSync('src/lib/trip-planner/route-weather-timing.ts', 'utf8'));

  check('break: contains no mph constant', !/\bmph\b/i.test(breakSrc));
  check('weather: contains no mph constant', !/\bmph\b/i.test(weatherSrc));
  check(
    'weather: does not import the NWS adapter’s flat-speed alignment',
    !/AVG_PROGRESS_MPH|nws-weather/.test(weatherSrc),
  );
  check(
    'break: refuses rather than importing the straight-line estimator',
    !/route-estimate/.test(breakSrc),
  );
}

console.log(`trip-planner-break-weather: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
