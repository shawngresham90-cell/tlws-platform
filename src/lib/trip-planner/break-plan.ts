import { HOS, type RemainingClocks } from './types';
import type { RouteTiming } from './route-time-axis';
import {
  effectiveViaDwell,
  nthBreakDueAfterMin,
  viaDwellWallMin,
  type PlannedViaDwell,
} from './drive-window';

/**
 * Where the 30-minute break should happen — timed by the provider, or not
 * claimed at all.
 *
 * Pure. No clock, no I/O.
 *
 * §395.3(a)(3)(ii): after 8 cumulative hours of driving a property-carrying
 * driver needs 30 consecutive minutes off the wheel. `untilBreakMin` in the
 * driver's stated clocks is how much driving is left before that bites.
 *
 * TWO THINGS THIS DELIBERATELY DOES NOT DO. It does not claim that any
 * given stop or off-duty period QUALIFIES as the break — the engine
 * supports the 2020 rule where any ≥30-minute non-driving period counts,
 * and whether a particular pause met that is a fact about the driver's day,
 * not something a planner can assert. And it does not place the break by
 * distance ÷ assumed speed; the target is a TIME, projected through the
 * same provider timing that decides parking eligibility, so the break and
 * the stops it is planned around cannot disagree about when the truck
 * arrives.
 */

/**
 * Aim this far before the break becomes mandatory. A driver who is told to
 * stop at the exact minute the clock expires has no room for a full lot or
 * a missed exit, and the number is small enough not to spend the day.
 */
export const BREAK_LEAD_MIN = 20;

/** Said when the drive ends before a break is ever required. */
export const NO_BREAK_EXPECTED =
  'No 30-minute break is expected before today’s planned stop window.';

export type BreakPlan =
  | {
      required: true;
      /** Driving minutes from departure to the point we aim for. */
      targetMin: number;
      /** Route miles at that point, from provider timing. */
      targetMile: number | null;
      /** Worst-case wall-clock arrival there, ms. */
      byMs: number;
      /** Minutes the break itself consumes from the 14-hour window. */
      costsWindowMin: number;
      coarse: boolean;
    }
  | { required: false; reason: string }
  | { required: null; problem: string };

/* --------------------------------------------- the full schedule (TP-3) */

/** One required 30-minute break, placed on provider time. */
export type PlannedBreak = {
  /** Driving minutes from departure at which this break becomes REQUIRED. */
  dueAfterDrivingMin: number;
  /** Driving minutes from departure to the point we aim for (lead applied). */
  targetMin: number;
  /** Route miles at that point, from provider timing. */
  targetMile: number | null;
  /**
   * Worst-case wall-clock arrival at the aim point, epoch ms — INCLUDING
   * the 30-minute dwell of every earlier break in this schedule, because
   * the truck really does stand still for each one.
   */
  byMs: number;
  /** Minutes this break consumes from the 14-hour window. */
  costsWindowMin: number;
  coarse: boolean;
};

/**
 * Every required break inside the horizon, in driving order — or an
 * honest refusal. `breaks` is empty when the horizon ends before the
 * first break falls due; `problem` is set when breaks ARE owed but the
 * provider returned no usable timing, because a break the planner cannot
 * place on the road is not one it may confidently draw.
 */
export type BreakSchedule =
  | { breaks: PlannedBreak[]; problem: null }
  | { breaks: []; problem: string };

/**
 * Find the route mile the truck reaches after `targetMin` driving
 * minutes. The axis answers time→distance only through distance→time, so
 * this walks candidate miles rather than inverting: a coarse bisection is
 * enough for a target that is honest to roughly a provider action anyway,
 * and it never invents a speed.
 */
function mileAtDrivingMinutes(
  timing: Extract<RouteTiming, { kind: 'provider' }>,
  targetMin: number,
): { targetMile: number | null; coarse: boolean; byMin: number } {
  let lo = 0;
  let hi = 5000; // miles; far beyond any single duty period
  let targetMile: number | null = null;
  let coarse = false;
  let byMin = targetMin;
  for (let i = 0; i < 40 && hi - lo > 0.1; i++) {
    const mid = (lo + hi) / 2;
    const w = timing.minutesToMile(mid);
    if (w === null) {
      hi = mid; // past the end of the timed route
      continue;
    }
    if (w.latestMin > targetMin) {
      hi = mid;
    } else {
      lo = mid;
      targetMile = mid;
      coarse = w.precision === 'coarse';
      byMin = w.latestMin;
    }
  }
  return { targetMile, coarse, byMin };
}

/**
 * Plan EVERY required break inside a usable driving window (TP-3).
 *
 * `usableDriveMin` is the clock limit from `driveWindow` — already net of
 * every break's cost to the 14-hour window, so this function places the
 * breaks rather than re-charging for them. Break k falls due after
 * `nthBreakDueAfterMin(untilBreakMin, k)` driving minutes; one strictly
 * inside the horizon is planned, one at or past its end is not — the
 * same strict boundary the window math and the parking filter use,
 * because all three read the same primitives.
 *
 * A qualifying break resets ONLY the break timer. The schedule never
 * restores driving, window or cycle time — each entry only ADDS its
 * 30-minute dwell to the wall clock of everything after it.
 */
export function planBreakSchedule(input: {
  clocks: RemainingClocks;
  usableDriveMin: number;
  timing: RouteTiming;
  departAtMs: number;
  /** The planned via dwell (TP-4), when the plan carries one. */
  via?: PlannedViaDwell | null;
}): BreakSchedule {
  const { clocks, usableDriveMin, timing, departAtMs } = input;
  const via = effectiveViaDwell(input.via ?? null);

  if (!Number.isFinite(clocks.untilBreakMin) || clocks.untilBreakMin < 0) {
    return { breaks: [], problem: 'break clock is not a usable number of minutes.' };
  }

  /*
   * WHERE EACH BREAK FALLS DUE, in driving minutes — the same piecewise
   * arithmetic `requiredBreaksWithVia` counts with (TP-4). Without a
   * QUALIFYING via dwell the thresholds are the plain TP-3 series. With
   * one, thresholds strictly before the via keep the driver's entered
   * timer (a break already due before the via stays due before it), the
   * qualifying dwell itself satisfies whichever break would next fall due
   * at or beyond the via, and later thresholds restart 8 driving hours
   * from the via — which is exactly why no separate break event appears
   * at the via (scenario D3).
   */
  const thresholds: number[] = [];
  if (via === null || !via.qualifiesAsBreak || usableDriveMin <= via.driveMin) {
    for (let k = 1; nthBreakDueAfterMin(clocks.untilBreakMin, k) < usableDriveMin; k++) {
      thresholds.push(nthBreakDueAfterMin(clocks.untilBreakMin, k));
    }
  } else {
    for (
      let k = 1;
      nthBreakDueAfterMin(clocks.untilBreakMin, k) < Math.min(usableDriveMin, via.driveMin);
      k++
    ) {
      thresholds.push(nthBreakDueAfterMin(clocks.untilBreakMin, k));
    }
    for (let j = 1; via.driveMin + j * HOS.BREAK_AFTER_DRIVING_MIN < usableDriveMin; j++) {
      thresholds.push(via.driveMin + j * HOS.BREAK_AFTER_DRIVING_MIN);
    }
  }
  if (thresholds.length === 0) return { breaks: [], problem: null };

  if (timing.kind !== 'provider') {
    return {
      breaks: [],
      problem: 'cannot place a break safely — the route provider returned no usable travel times.',
    };
  }

  const breaks: PlannedBreak[] = [];
  for (let k = 1; k <= thresholds.length; k++) {
    const dueAfterDrivingMin = thresholds[k - 1];
    // Aim early, but never before departure.
    const targetMin = Math.max(0, dueAfterDrivingMin - BREAK_LEAD_MIN);
    const placed = mileAtDrivingMinutes(timing, targetMin);
    breaks.push({
      dueAfterDrivingMin,
      targetMin,
      targetMile: placed.targetMile === null ? null : Number(placed.targetMile.toFixed(1)),
      // Wall clock = provider driving time to the aim point, plus the
      // dwell of every break already taken before it, plus the via dwell
      // when the aim point lies beyond the via (TP-4) — each charged
      // exactly once.
      byMs:
        departAtMs +
        (placed.byMin + (k - 1) * HOS.MIN_BREAK_MIN + viaDwellWallMin(targetMin, via)) * 60_000,
      costsWindowMin: HOS.MIN_BREAK_MIN,
      coarse: placed.coarse,
    });
  }
  return { breaks, problem: null };
}

/**
 * Plan the FIRST break inside a usable driving window.
 *
 * Since TP-3 this is a thin wrapper over `planBreakSchedule` — the single
 * break-schedule truth — kept because every existing consumer (the break
 * card, the map marker, the harnesses) wants exactly the first break in
 * this shape.
 */
export function planBreak(input: {
  clocks: RemainingClocks;
  usableDriveMin: number;
  timing: RouteTiming;
  departAtMs: number;
  /** The planned via dwell (TP-4), passed through to the schedule. */
  via?: PlannedViaDwell | null;
}): BreakPlan {
  const schedule = planBreakSchedule(input);
  if (schedule.problem !== null) return { required: null, problem: schedule.problem };
  const first = schedule.breaks[0];
  if (first === undefined) {
    /*
     * NO BREAK INSIDE THIS DRIVE. Said in the engine's own terms — the
     * drive ends before the break clock does — rather than as a general
     * claim that the driver needs no break today.
     */
    return { required: false, reason: NO_BREAK_EXPECTED };
  }
  return {
    required: true,
    targetMin: first.targetMin,
    targetMile: first.targetMile,
    byMs: first.byMs,
    costsWindowMin: first.costsWindowMin,
    coarse: first.coarse,
  };
}
