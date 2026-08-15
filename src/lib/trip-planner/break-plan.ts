import { HOS, type RemainingClocks } from './types';
import type { RouteTiming } from './route-time-axis';

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

/**
 * Plan the break inside a usable driving window.
 *
 * `usableDriveMin` is the clock limit from `driveWindow` — already net of
 * the break's cost to the 14-hour window, so this function places the break
 * rather than re-charging for it.
 */
export function planBreak(input: {
  clocks: RemainingClocks;
  usableDriveMin: number;
  timing: RouteTiming;
  departAtMs: number;
}): BreakPlan {
  const { clocks, usableDriveMin, timing, departAtMs } = input;

  if (!Number.isFinite(clocks.untilBreakMin) || clocks.untilBreakMin < 0) {
    return { required: null, problem: 'break clock is not a usable number of minutes.' };
  }

  /*
   * NO BREAK INSIDE THIS DRIVE. Said in the engine's own terms — the drive
   * ends before the break clock does — rather than as a general claim that
   * the driver needs no break today.
   */
  if (clocks.untilBreakMin >= usableDriveMin) {
    return { required: false, reason: NO_BREAK_EXPECTED };
  }

  if (timing.kind !== 'provider') {
    return {
      required: null,
      problem: 'cannot place a break safely — the route provider returned no usable travel times.',
    };
  }

  // Aim early, but never before departure.
  const targetMin = Math.max(0, clocks.untilBreakMin - BREAK_LEAD_MIN);

  /*
   * Find the route mile at that time. The axis answers time→distance only
   * through distance→time, so this walks candidate miles rather than
   * inverting: a coarse bisection is enough for a target that is honest to
   * roughly a provider action anyway, and it never invents a speed.
   */
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

  return {
    required: true,
    targetMin,
    targetMile: targetMile === null ? null : Number(targetMile.toFixed(1)),
    byMs: departAtMs + byMin * 60_000,
    costsWindowMin: HOS.MIN_BREAK_MIN,
    coarse,
  };
}
