import { HOS, type RemainingClocks } from './types';

/**
 * How much driving time is actually usable, and where the driver asked to
 * stop before it runs out.
 *
 * Pure. No clock, no I/O, no React. Minutes in, minutes out.
 *
 * THE TWO NUMBERS THIS PRODUCES ARE DIFFERENT THINGS, and the whole
 * module exists so a screen cannot blur them:
 *
 *   CLOCK LIMIT      the last minute the supported HOS rules allow. It is
 *                    the engine's answer and the driver does not choose it.
 *   STOP TARGET      earlier, by however much buffer the driver asked for.
 *                    It is a preference, not a regulation.
 *
 * A buffer can only ever move the stop target EARLIER. It cannot extend
 * the clock limit by a single minute, and `bufferMin` is clamped so no
 * caller can pass a negative value and quietly buy time with it. That
 * clamp is the reason this is a module and not four lines in a component.
 *
 * WHAT IS AND IS NOT MODELLED. The 11-hour driving limit, the 14-hour
 * window, the 60/70-hour cycle and the 30-minute break are all here,
 * because the existing engine supports them. Split sleeper berth, the
 * adverse-driving exception and personal conveyance are NOT, and a caller
 * gets no answer that pretends otherwise. Nothing here projects a recap.
 */

/** The buffer presets a driver may choose, in minutes. */
export const SAFETY_BUFFER_PRESETS = [15, 30, 45, 60, 90] as const;
export type SafetyBufferMin = (typeof SAFETY_BUFFER_PRESETS)[number];

/*
 * TWO DEFAULTS, EACH NAMED FOR THE SCREEN THAT OWNS IT.
 *
 * The bug this replaced was NOT "two different numbers" — it was two
 * constants sharing the name `DEFAULT_SAFETY_BUFFER_MIN` while holding
 * different values, so every file read "the default" and got whichever
 * one it happened to import. The ambiguity was the name.
 *
 * Collapsing them to a single number fixed the ambiguity and broke
 * something else: the classic cost planner had always planned against 30
 * minutes, and silently moving it to 45 is a behaviour change to a screen
 * that was supposed to be preserved untouched.
 *
 * So the VALIDATION is shared — one preset list, one type guard, one
 * clamping rule inside `driveWindow`, one explanation string — and the
 * DEFAULTS are two explicitly named constants. Neither is called "the"
 * default, so no future caller can pick one up by accident: naming the
 * surface is now mandatory to get a number at all.
 */

/** Plan My Day's recommendation — room to find a second option if the first is full. */
export const PLAN_MY_DAY_DEFAULT_BUFFER_MIN: SafetyBufferMin = 45;

/**
 * The classic cost planner's long-standing default.
 *
 * Preserved deliberately, not inherited. Drivers have been reading its
 * stop recommendations against 30 minutes since it shipped, and this
 * milestone's job was to leave that screen alone.
 */
export const CLASSIC_PLANNER_DEFAULT_BUFFER_MIN: SafetyBufferMin = 30;

/** What the buffer is for, in the driver's words. Never "extra legal time". */
export const SAFETY_BUFFER_EXPLANATION =
  'Your buffer keeps the plan from ending exactly on zero. It does not add legal driving time.';

/** Said whenever a plan is shown. The ELD is the record; this is not. */
export const PLANNING_AID_ONLY = 'Planning aid only. Verify against your ELD.';

export function isSafetyBufferPreset(v: unknown): v is SafetyBufferMin {
  return typeof v === 'number' && (SAFETY_BUFFER_PRESETS as readonly number[]).includes(v);
}

/** Which rule ran out first. Mirrors RemainingClocks['limitedBy']. */
export type BindingRule = RemainingClocks['limitedBy'];

export type DriveWindow = {
  /**
   * Minutes of driving the supported rules allow from now, BEFORE any
   * buffer. Already accounts for a required break consuming the window.
   */
  clockLimitMin: number;
  /** Which rule produced `clockLimitMin`. */
  limitedBy: BindingRule;
  /** The driver's chosen buffer, clamped to >= 0. */
  bufferMin: number;
  /** clockLimitMin − bufferMin, floored at 0. Never greater. */
  stopTargetMin: number;
  /**
   * Minutes of driving until a 30-minute break becomes required, or null
   * when no break falls inside `clockLimitMin`.
   */
  breakDueAfterMin: number | null;
  /**
   * True when a required break sits inside the drive AND its 30 minutes
   * were charged against the 14-hour window. The trap new drivers miss:
   * the window never pauses, so the break costs window time whether the
   * truck is moving or not.
   */
  breakConsumesWindow: boolean;
};

/**
 * Compute the usable driving window from driver-stated remaining clocks.
 *
 * `clocks` must come from the existing clock authority — this function
 * validates rather than repairs. A non-finite or negative field yields a
 * refusal, because silently reading a corrupt clock as zero would turn a
 * broken record into a confident "you must stop now", and reading it as
 * generous would do something far worse.
 */
export function driveWindow(
  clocks: RemainingClocks,
  bufferMin: number,
): DriveWindow | { ok: false; problem: string } {
  const fields: [string, number][] = [
    ['drivingMin', clocks.drivingMin],
    ['windowMin', clocks.windowMin],
    ['untilBreakMin', clocks.untilBreakMin],
    ['cycleMin', clocks.cycleMin],
  ];
  for (const [name, value] of fields) {
    if (!Number.isFinite(value) || value < 0) {
      return { ok: false, problem: `${name} is not a usable number of minutes.` };
    }
  }

  const buffer = Number.isFinite(bufferMin) ? Math.max(0, bufferMin) : 0;

  /*
   * THE BREAK BURNS THE WINDOW. If the driver can still drive
   * `untilBreakMin` before a 30-minute break is required, and there is
   * driving left afterwards, those 30 minutes come out of the 14-hour
   * window — which never pauses. So the window available for DRIVING is
   * reduced by the break before the limits are compared.
   */
  const breakFallsInsideDrive =
    clocks.untilBreakMin < clocks.drivingMin && clocks.untilBreakMin < clocks.windowMin;
  const windowForDriving = breakFallsInsideDrive
    ? Math.max(0, clocks.windowMin - HOS.MIN_BREAK_MIN)
    : clocks.windowMin;

  // The binding rule is whichever runs out first. Cycle is on-duty time,
  // and driving is on-duty, so it caps driving too.
  const candidates: [BindingRule, number][] = [
    ['11-hour', clocks.drivingMin],
    ['14-hour', windowForDriving],
    ['cycle', clocks.cycleMin],
  ];
  let limitedBy: BindingRule = candidates[0][0];
  let clockLimitMin = candidates[0][1];
  for (const [rule, minutes] of candidates) {
    if (minutes < clockLimitMin) {
      clockLimitMin = minutes;
      limitedBy = rule;
    }
  }

  /*
   * When the break is what stands between the driver and more driving,
   * SAY SO rather than reporting the 14-hour rule. The driver's next
   * action is different: a break resumes the trip, a window expiry ends
   * the day.
   */
  if (breakFallsInsideDrive && clocks.untilBreakMin >= clockLimitMin) {
    limitedBy = '30-minute-break';
  }

  return {
    clockLimitMin,
    limitedBy,
    bufferMin: buffer,
    // The buffer only ever subtracts. Floored at 0 so an oversized buffer
    // means "stop now", never a negative target a caller could add back.
    stopTargetMin: Math.max(0, clockLimitMin - buffer),
    breakDueAfterMin: breakFallsInsideDrive ? clocks.untilBreakMin : null,
    breakConsumesWindow: breakFallsInsideDrive,
  };
}

/**
 * Conservative rounding for anything a driver reads.
 *
 * Always DOWN for available time and DOWN for a stop target: an estimate
 * that rounds up hands the driver minutes the clock does not have. The
 * direction is fixed here, once, so no surface can round the other way.
 */
export function roundDownMinutes(minutes: number, toNearest = 5): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.floor(minutes / toNearest) * toNearest;
}
