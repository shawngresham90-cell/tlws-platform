/**
 * Driver-facing clock INPUT semantics: the planner asks the driver for time
 * REMAINING — the numbers an ELD's "remaining" clocks actually show — while
 * the wire contract (`SimpleClocks`) and the engine keep their historical
 * used-minutes shape. This module is the ONE place the two meet:
 *
 *     used = limit − remaining
 *
 * Every limit derives from the legal constants in `types.ts` (`HOS`,
 * 49 CFR 395.3); nothing is redefined here, and no other file may perform
 * this subtraction. Pure: no I/O, no clock reads.
 */

import { HOS } from './types';
import type { SimpleClocks } from './compose-quote';

/** Input limits in HOURS, derived from the legal minute constants. */
export const CLOCK_INPUT_LIMITS_H = {
  /** 11-hour driving rule. */
  driving: HOS.MAX_DRIVING_MIN / 60,
  /** 14-hour on-duty window. */
  window: HOS.MAX_WINDOW_MIN / 60,
  /** Driving allowed before the 30-minute break (8 h). */
  untilBreak: HOS.BREAK_AFTER_DRIVING_MIN / 60,
  /** 70-hour/8-day cycle (the planner's UI offers 70/8 only, as before). */
  cycle: HOS.CYCLE_70_MIN / 60,
} as const;

/** What the driver enters: hours they have LEFT on each clock. */
export type RemainingClocksInput = {
  /** Driving time remaining (0..11 h). */
  drivingLeftH: number;
  /** On-duty window time remaining (0..14 h). */
  windowLeftH: number;
  /** Time remaining until the 30-minute break is required (0..8 h). */
  untilBreakLeftH: number;
  /** 70-hour cycle time remaining (0..70 h). */
  cycleLeftH: number;
};

/**
 * Clamp one remaining-hours value into [0, limit]. Malformed input (NaN,
 * non-number, Infinity) falls back to the FULL limit — the fresh-driver
 * default — rather than to zero, which would silently plan a trip for a
 * driver with no hours. Decimals are preserved (the sliders step by 0.5 h).
 */
export function clampRemainingHours(value: unknown, limitH: number): number {
  const n = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(n)) return limitH;
  return Math.min(Math.max(n, 0), limitH);
}

/** A fresh driver: every clock at its full legal limit. */
export function freshRemainingClocks(): RemainingClocksInput {
  return {
    drivingLeftH: CLOCK_INPUT_LIMITS_H.driving,
    windowLeftH: CLOCK_INPUT_LIMITS_H.window,
    untilBreakLeftH: CLOCK_INPUT_LIMITS_H.untilBreak,
    cycleLeftH: CLOCK_INPUT_LIMITS_H.cycle,
  };
}

/**
 * Convert driver-entered REMAINING hours into the wire/engine's used-minutes
 * `SimpleClocks`. Carries over the exact physical-consistency guards the
 * submit path has always applied:
 *   - a full remaining window means no 14-hour window is open → sentinel −1;
 *   - driving-since-break can never exceed driving used;
 *   - cycle used can never be less than driving used.
 * Out-of-range and malformed inputs are clamped per `clampRemainingHours`.
 */
export function remainingToSimpleClocks(
  input: RemainingClocksInput,
  cycleRule: SimpleClocks['cycleRule'] = '70/8',
): SimpleClocks {
  const L = CLOCK_INPUT_LIMITS_H;
  const drivingLeftH = clampRemainingHours(input.drivingLeftH, L.driving);
  const windowLeftH = clampRemainingHours(input.windowLeftH, L.window);
  const untilBreakLeftH = clampRemainingHours(input.untilBreakLeftH, L.untilBreak);
  const cycleLeftH = clampRemainingHours(input.cycleLeftH, L.cycle);

  const drivingUsedMin = Math.round((L.driving - drivingLeftH) * 60);
  const windowUsedMin = Math.round((L.window - windowLeftH) * 60);
  const untilBreakUsedMin = Math.round((L.untilBreak - untilBreakLeftH) * 60);
  const cycleUsedMin = Math.round((L.cycle - cycleLeftH) * 60);

  return {
    cycleRule,
    drivingUsedMin,
    windowElapsedMin: windowUsedMin > 0 ? windowUsedMin : -1,
    drivingSinceBreakMin: Math.min(untilBreakUsedMin, drivingUsedMin),
    cycleUsedMin: Math.max(cycleUsedMin, drivingUsedMin),
  };
}
