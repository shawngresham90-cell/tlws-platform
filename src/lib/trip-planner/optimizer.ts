import { advance, planDrive, remainingClocks } from './hos-engine';
import { rankCandidates, stopKindForNeed } from './directory-layer';
import {
  HOS,
  type ClockState,
  type DutySegment,
  type HosViolation,
  type Itinerary,
  type PlannedStop,
  type PlannerOptions,
  type StopCandidate,
  type TripRequest,
} from './types';

/**
 * Route optimization engine (Phase 3). Walks the route timeline from the
 * departure clock state, detects need events (30-minute break due, fuel
 * range reached, driving/window clocks exhausted), selects the best-ranked
 * directory candidate inside a look-back window before each deadline, and
 * emits a violation-free itinerary with ETAs, duty segments, and alternates
 * per stop. Pure and deterministic — same inputs, same plan.
 *
 * Selection strategy per need event:
 *   deadlineMile = the farthest route-mile the driver may legally/safely
 *   reach; the planner searches [deadlineMile − stopSearchWindowMiles,
 *   deadlineMile] and takes the highest-scoring candidate. If none exists,
 *   the stop happens at the deadline as a VIRTUAL stop with a warning —
 *   the driver must find their own spot (thin-coverage corridor).
 */

type NeedEvent = {
  need: 'break' | 'fuel' | 'overnight';
  deadlineMile: number;
  reason: string;
};

/** Average speed at a given route mile (per-leg speeds). */
function speedAtMile(req: TripRequest, mile: number): number {
  let acc = 0;
  for (const leg of req.route.legs) {
    acc += leg.distanceMiles;
    if (mile <= acc) return leg.avgSpeedMph;
  }
  return req.route.legs[req.route.legs.length - 1]?.avgSpeedMph ?? 55;
}

/** Minutes to drive from mileA to mileB using per-leg speeds. */
export function driveMinutesBetween(req: TripRequest, fromMile: number, toMile: number): number {
  if (toMile <= fromMile) return 0;
  let minutes = 0;
  let cursor = fromMile;
  let acc = 0;
  for (const leg of req.route.legs) {
    const legStart = acc;
    acc += leg.distanceMiles;
    const legEnd = acc;
    if (legEnd <= cursor) continue;
    const from = Math.max(cursor, legStart);
    const to = Math.min(toMile, legEnd);
    if (to > from) minutes += ((to - from) / leg.avgSpeedMph) * 60;
    cursor = Math.max(cursor, to);
    if (cursor >= toMile) break;
  }
  return Math.round(minutes);
}

/** The next need event given the current position, clocks, and fuel. */
function nextNeed(
  req: TripRequest,
  atMile: number,
  clocks: ClockState,
  fuelRangeLeftMiles: number,
): NeedEvent | null {
  const remainingMiles = req.route.totalMiles - atMile;
  if (remainingMiles <= 0) return null;
  const speed = speedAtMile(req, atMile);
  const rc = remainingClocks(clocks);

  const events: NeedEvent[] = [];
  // Fuel: must stop by the safety range.
  if (fuelRangeLeftMiles < remainingMiles) {
    events.push({
      need: 'fuel',
      deadlineMile: atMile + Math.max(0, fuelRangeLeftMiles),
      reason: 'fuel range (safety factor) reached',
    });
  }
  // 30-minute break: due when the break clock empties.
  const breakMiles = (rc.untilBreakMin / 60) * speed;
  const drivingMiles = (rc.drivingMin / 60) * speed;
  const windowMiles = (rc.windowMin / 60) * speed;
  const endOfDayMiles = Math.min(drivingMiles, windowMiles);
  if (
    breakMiles < remainingMiles &&
    rc.untilBreakMin < rc.drivingMin &&
    breakMiles < endOfDayMiles
  ) {
    events.push({
      need: 'break',
      deadlineMile: atMile + breakMiles,
      reason: '30-minute break due (8h cumulative driving)',
    });
  }
  // Overnight: due when the 11 or 14 clock empties.
  if (endOfDayMiles < remainingMiles) {
    events.push({
      need: 'overnight',
      deadlineMile: atMile + endOfDayMiles,
      reason: rc.drivingMin <= rc.windowMin ? '11-hour driving limit' : '14-hour window limit',
    });
  }
  if (events.length === 0) return null;
  events.sort((a, b) => a.deadlineMile - b.deadlineMile);
  return events[0];
}

function selectStop(
  req: TripRequest,
  need: 'break' | 'fuel' | 'overnight',
  fromMile: number,
  deadlineMile: number,
): { chosen: StopCandidate | null; alternates: StopCandidate[] } {
  const window = {
    fromMile: Math.max(fromMile, deadlineMile - req.options.stopSearchWindowMiles),
    toMile: deadlineMile,
  };
  const ranked = rankCandidates(req.candidates, need === 'break' ? 'break' : need, window, {
    preferredFuelBrands: req.options.preferredFuelBrands,
  });
  if (ranked.length === 0) return { chosen: null, alternates: [] };
  return {
    chosen: ranked[0].candidate,
    alternates: ranked.slice(1, 1 + req.options.maxAlternates).map((r) => r.candidate),
  };
}

/** Plan the whole trip. */
export function planTrip(req: TripRequest): Itinerary {
  const warnings: string[] = [];
  const violations: HosViolation[] = [];
  const stops: PlannedStop[] = [];
  const segments: DutySegment[] = [];

  const tankRangeMiles = req.truck.tankGallons * req.truck.mpg * req.truck.fuelSafetyFactor;
  let fuelRangeLeftMiles = Math.max(0, req.fuelLevelFraction) * tankRangeMiles;
  let clocks: ClockState = { ...req.clocks, atMs: req.departAtMs };
  let atMile = 0;
  let driveMinutesTotal = 0;
  let restMinutesTotal = 0;
  // Bounded iterations: every loop either advances miles or takes a rest.
  let guard = 500;

  stops.push({
    kind: 'origin',
    candidate: null,
    label: 'Origin',
    position: req.route.legs[0]?.from.position ?? null,
    routeMile: 0,
    arriveAtMs: req.departAtMs,
    departAtMs: req.departAtMs,
    dwellMinutes: 0,
    reason: 'trip start',
    dutyStatus: 'on-duty',
    alternates: [],
  });

  const driveTo = (toMile: number) => {
    const minutes = driveMinutesBetween(req, atMile, toMile);
    if (minutes <= 0) return;
    const step = advance(clocks, 'driving', minutes);
    violations.push(...step.violations);
    segments.push({ status: 'driving', startMs: clocks.atMs, minutes });
    clocks = step.state;
    fuelRangeLeftMiles -= toMile - atMile;
    driveMinutesTotal += minutes;
    atMile = toMile;
  };

  const rest = (
    kind: 'break' | 'fuel' | 'overnight',
    minutes: number,
    chosen: StopCandidate | null,
    alternates: StopCandidate[],
    reason: string,
  ) => {
    const duty = kind === 'overnight' ? 'sleeper' : 'off-duty';
    const arriveAtMs = clocks.atMs;
    segments.push({ status: duty, startMs: arriveAtMs, minutes, note: reason });
    clocks = advance(clocks, duty, minutes).state;
    restMinutesTotal += minutes;
    if (kind === 'fuel') fuelRangeLeftMiles = tankRangeMiles;
    stops.push({
      kind: stopKindForNeed(kind === 'break' ? 'break' : kind === 'fuel' ? 'fuel' : 'overnight'),
      candidate: chosen,
      label: chosen?.name ?? `Unassigned ${kind} stop`,
      position: chosen?.position ?? null,
      routeMile: Number(atMile.toFixed(1)),
      arriveAtMs,
      departAtMs: clocks.atMs,
      dwellMinutes: minutes,
      reason,
      dutyStatus: duty,
      alternates,
    });
    if (!chosen) {
      warnings.push(
        `no directory candidate within ${req.options.stopSearchWindowMiles} mi before mile ${atMile.toFixed(0)} for ${kind} — driver must self-select`,
      );
    }
  };

  while (atMile < req.route.totalMiles && guard-- > 0) {
    const need = nextNeed(req, atMile, clocks, fuelRangeLeftMiles);
    if (!need) {
      driveTo(req.route.totalMiles);
      break;
    }
    const { chosen, alternates } = selectStop(req, need.need, atMile, need.deadlineMile);
    const stopMile = chosen ? chosen.routeMile : need.deadlineMile;
    driveTo(Math.min(stopMile, req.route.totalMiles));
    if (atMile >= req.route.totalMiles) break;

    if (need.need === 'break') {
      rest(
        'break',
        Math.max(HOS.MIN_BREAK_MIN, req.options.breakMinutes),
        chosen,
        alternates,
        need.reason,
      );
    } else if (need.need === 'fuel') {
      // A fuel stop ≥30 min also clears the break clock (2020 rule).
      rest('fuel', Math.max(1, req.options.fuelStopMinutes), chosen, alternates, need.reason);
    } else {
      rest(
        'overnight',
        Math.max(HOS.MIN_RESET_MIN, req.options.overnightMinutes),
        chosen,
        alternates,
        need.reason,
      );
    }
  }
  if (guard <= 0) throw new Error('planTrip guard exhausted — logic error');

  stops.push({
    kind: 'destination',
    candidate: null,
    label: 'Destination',
    position: req.route.legs[req.route.legs.length - 1]?.to.position ?? null,
    routeMile: Number(req.route.totalMiles.toFixed(1)),
    arriveAtMs: clocks.atMs,
    departAtMs: clocks.atMs,
    dwellMinutes: 0,
    reason: 'trip end',
    dutyStatus: 'on-duty',
    alternates: [],
  });

  return {
    stops,
    segments,
    arriveAtMs: clocks.atMs,
    totalMinutes: Math.round((clocks.atMs - req.departAtMs) / 60_000),
    driveMinutes: driveMinutesTotal,
    restMinutes: restMinutesTotal,
    violations,
    warnings,
  };
}

/**
 * Quick ETA without stop selection: pure HOS arrival math over the route's
 * drive time (used by the route API for fast quotes).
 */
export function quickEta(req: Pick<TripRequest, 'route' | 'clocks' | 'departAtMs' | 'options'>): {
  arriveAtMs: number;
  totalMinutes: number;
  rests: number;
} {
  const plan = planDrive({ ...req.clocks, atMs: req.departAtMs }, req.route.driveMinutes, {
    breakMinutes: req.options.breakMinutes,
    resetMinutes: req.options.overnightMinutes,
  });
  return {
    arriveAtMs: req.departAtMs + plan.totalMinutes * 60_000,
    totalMinutes: plan.totalMinutes,
    rests: plan.rests.length,
  };
}
