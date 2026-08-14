/**
 * Parking eligibility runs on provider time, or it does not run.
 *
 * The Last Stop engine's safety design is unchanged and deliberately so:
 * reachability is a hard FILTER, never a score weight, so commission can
 * never outrank safety. What changed is the TIME SOURCE behind that
 * filter. It used to be per-leg average speeds; assumed speed places a
 * stop CLOSER in time than the truck will reach it, and does so worst
 * exactly when traffic is bad — handing a driver a stop they cannot make
 * on the day the warning mattered most.
 *
 * These checks prove the five rules that replaced it:
 *
 *   1. A stop must be reachable before the BUFFERED deadline.
 *   2. Missing provider timing yields "cannot determine safely" — never
 *      an average-speed guess.
 *   3. A coarse arrival window straddling the deadline is not guaranteed.
 *   4. Safety eligibility is decided BEFORE amenities or preference.
 *   5. A straight-line estimate produces no eligibility at all.
 */
import {
  reachWithinClocks,
  selectLastStops,
  TIMING_UNAVAILABLE_NOTICE,
} from '@/lib/trip-planner/last-stop';
import {
  routeTimingFromAxis,
  timingUnavailable,
  buildTimeAxis,
  type RouteTiming,
} from '@/lib/trip-planner/route-time-axis';
import type { HereManeuver } from '@/lib/trip-planner/here-routing';
import type { RemainingClocks, StopCandidate } from '@/lib/trip-planner/types';
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
const METERS_PER_MILE = 1609.344;

function clocks(over: Partial<RemainingClocks> = {}): RemainingClocks {
  return {
    drivingMin: 300,
    windowMin: 400,
    untilBreakMin: 300,
    cycleMin: 3000,
    limitedBy: '11-hour',
    legalDrivingMin: 300,
    ...over,
  };
}

/**
 * A route whose actions each cover `mileStep` miles in `minutesPer`
 * minutes. `minutesPer` above 10 makes the window coarse, which is how
 * the straddle case is built without inventing a special flag.
 */
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

function stop(id: string, routeMile: number, over: Partial<StopCandidate> = {}): StopCandidate {
  return {
    id,
    name: id,
    categorySlug: 'truck-stops',
    position: { lat: 35, lng: -85 },
    routeMile,
    offRouteMiles: 1,
    parkingSpaces: 80,
    freeParking: true,
    reservationUrl: null,
    amenities: [],
    fuelBrands: [],
    coordVerificationStatus: 'manually-verified',
    overnightStatus: 'allowed',
    ...over,
  } as StopCandidate;
}

/* ============ 1. reachable before the BUFFERED deadline ============== */
{
  // 60 steps × 5 miles at 5 min each = 300 miles, 300 minutes.
  const timing = timingFor(60, 5, 5);
  const rc = clocks({ drivingMin: 300, windowMin: 300, untilBreakMin: 300 });

  // Mile 240 → 240 minutes. 60 minutes of clock left on arrival.
  const inside = reachWithinClocks(timing, rc, 240, 45);
  check('a stop 60 minutes inside the clock is reachable with a 45-min buffer', inside !== null);

  // Mile 270 → 270 minutes, leaving 30 — inside the clock but INSIDE the
  // buffer, which is exactly what the buffer exists to refuse.
  const insideBuffer = reachWithinClocks(timing, rc, 270, 45);
  check(
    'a stop that lands inside the safety buffer is refused, though it is legal',
    insideBuffer === null,
  );

  // And the buffer is what moved it: with a smaller buffer it returns.
  check(
    'the same stop is allowed once the driver chooses a smaller buffer',
    reachWithinClocks(timing, rc, 270, 15) !== null,
  );

  const past = reachWithinClocks(timing, rc, 320, 45);
  check('a stop past the end of the route is never reachable', past === null);
}

/* ============ 2. no provider timing, no eligibility ================== */
{
  const rc = clocks();
  const none = timingUnavailable('route is a straight-line estimate');

  check(
    'unavailable timing yields no reach, at any distance',
    reachWithinClocks(none, rc, 10, 45) === null &&
      reachWithinClocks(none, rc, 100, 45) === null &&
      reachWithinClocks(none, rc, 1, 0) === null,
  );

  const result = selectLastStops({
    timing: none,
    candidates: [stop('a', 50), stop('b', 100), stop('c', 150)],
    clocks: rc,
    departAtMs: T0,
  });
  check('unavailable timing produces zero slots', result.slots.length === 0);
  check(
    '...and says the reason is timing, not absence of parking',
    !result.timingAvailable,
    result,
  );
  /*
   * Existence is a directory fact and stays answerable; only reachability
   * goes silent. These candidates carry no reservationUrl, so "no
   * reservable on this corridor" is TRUE and is still reported.
   */
  check(
    '...while corridor existence, which needs no timing, is still answered',
    result.noReservableOnCorridor === true,
    result,
  );
  check(
    '...and carries a driver-readable explanation',
    typeof result.timingProblem === 'string' && result.timingProblem.length > 0,
    result.timingProblem,
  );
  check(
    'the notice names the real problem, not "no parking found"',
    /cannot determine/i.test(TIMING_UNAVAILABLE_NOTICE) &&
      !/no parking/i.test(TIMING_UNAVAILABLE_NOTICE),
    TIMING_UNAVAILABLE_NOTICE,
  );
}

/* ============ 3. a coarse window that straddles is not guaranteed ==== */
{
  /*
   * 20 steps × 25 miles at 25 minutes each: every action is a 25-minute
   * window, well past the coarse threshold. A stop inside the action that
   * spans the deadline is reachable at the window's early end and not at
   * its late end — genuinely unknown, and therefore never a guarantee.
   */
  const timing = timingFor(20, 25, 25);
  const rc = clocks({ drivingMin: 300, windowMin: 300, untilBreakMin: 300 });

  // Deadline with a 45-minute buffer is 255 minutes = mile 255.
  // Mile 260 sits in the action running 250–275 minutes.
  const straddling = reachWithinClocks(timing, rc, 260, 45);
  check(
    'a stop whose coarse window crosses the deadline is refused on the worst case',
    straddling === null,
    straddling,
  );

  // Well inside: the whole window clears the deadline.
  const clear = reachWithinClocks(timing, rc, 120, 45);
  check('a stop whose whole window clears the deadline is reachable', clear !== null);

  // The engine decides on the LATE end of the window, never the early one.
  check(
    'the reported drive time is the late end of the provider window',
    clear !== null && clear.driveMinutes >= 120,
    clear,
  );

  const result = selectLastStops({
    timing,
    candidates: [stop('straddle', 260), stop('safe', 120)],
    clocks: rc,
    departAtMs: T0,
  });
  const ids = result.slots.map((s) => s.candidate.id);
  check('a straddling stop never reaches a guaranteed slot', !ids.includes('straddle'), ids);
  /*
   * AND THE EXCLUSION IS THE WORST-CASE RULE ITSELF, not a second flag.
   * An earlier draft carried an `uncertain` marker alongside it; mutation
   * testing showed the marker could never be true, because a stop failing
   * at the late end is already refused. Dead safety code is worse than
   * none — it reads as protection nobody is getting — so the rule stands
   * alone and this asserts there is no second mechanism to rot.
   */
  const engineSrc = readFileSync('src/lib/trip-planner/last-stop.ts', 'utf8');
  check(
    'no dead `uncertain` flag survives beside the worst-case rule',
    !/uncertain/.test(engineSrc),
  );
  check('a clearly-reachable stop does', ids.includes('safe'), ids);
  check('and timing is reported as available', result.timingAvailable);
}

/* ============ 4. safety first, preference second ===================== */
{
  const timing = timingFor(60, 5, 5);
  const rc = clocks({ drivingMin: 300, windowMin: 300, untilBreakMin: 300 });

  /*
   * The unreachable candidate is made maximally attractive: reservable,
   * huge, zero detour. If preference could ever outrank eligibility, this
   * is the row that would prove it.
   */
  const tempting = stop('too-far', 295, {
    reservationUrl: 'https://example.test/book',
    parkingSpaces: 400,
    offRouteMiles: 0,
  } as Partial<StopCandidate>);
  const plain = stop('reachable', 100, { parkingSpaces: 12, offRouteMiles: 3 });

  const result = selectLastStops({
    timing,
    candidates: [tempting, plain],
    clocks: rc,
    departAtMs: T0,
    bufferMin: 45,
  });
  const ids = result.slots.map((s) => s.candidate.id);
  check(
    'an attractive but unreachable stop is filtered out before ranking',
    !ids.includes('too-far'),
    ids,
  );
  check('and the plain reachable one survives', ids.includes('reachable'), ids);

  for (const slot of result.slots) {
    check(
      `SAFETY ${slot.label}: every slot still clears the buffer`,
      slot.hosRemainingMinAtArrival >= result.bufferMin,
      slot,
    );
  }
}

/* ============ 5. an estimate may never produce eligibility =========== */
{
  /*
   * STRUCTURAL. The rule is easy to state and easy to regress: a
   * straight-line estimate must never feed HOS markers, break locations,
   * parking eligibility or weather encounter times. compose-quote is
   * where that decision is made, so the source is the assertion.
   */
  const src = readFileSync('src/lib/trip-planner/compose-quote.ts', 'utf8');
  check(
    'compose-quote sends unavailable timing for an estimated route',
    /isEstimate\s*\?\s*\n?\s*timingUnavailable\(/.test(src),
    src.match(/isEstimate[\s\S]{0,120}/)?.[0],
  );
  check(
    'compose-quote never hands the stop engine a Route object again',
    !/selectLastStops\(\{\s*route:/.test(src),
  );

  const engine = readFileSync('src/lib/trip-planner/last-stop.ts', 'utf8');
  check(
    'the eligibility filter no longer consults per-leg average speeds',
    !/reachWithinClocks[\s\S]{0,900}driveMinutesToMile/.test(engine),
  );
  check(
    'and refuses outright when timing is not from a provider',
    /timing\.kind !== 'provider'/.test(engine),
  );
}

console.log(`trip-planner-parking-timing: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
