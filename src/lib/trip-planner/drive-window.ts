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

/**
 * Plan My Day's recommendation — room to find a second option if the first is
 * full, and then a third if that one is too.
 *
 * SIXTY, SET BY THE OWNER. An earlier revision of this branch carried 45; the
 * settled product decision is 60 and this is the single place it lives.
 *
 * The number is a judgement about what happens when a plan meets a real yard.
 * A driver arriving at their chosen stop can find it full, and the buffer is
 * the time they have left to reach the next one without touching the legal
 * limit. Forty-five minutes covers one such failure on a good corridor; sixty
 * covers one on a bad one, and the cost of being generous here is a stop
 * recommended slightly earlier than strictly necessary — which is the cheap
 * direction to be wrong in.
 *
 * It is NOT extra legal time and must never be described as any. `driveWindow`
 * subtracts it from `clockLimitMin` to produce `stopTargetMin`; the legal limit
 * itself is untouched by the buffer, which is what lets a driver widen or
 * narrow it without ever changing what the law allows them.
 */
export const PLAN_MY_DAY_DEFAULT_BUFFER_MIN: SafetyBufferMin = 60;

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

/* ------------------------------------------------ the break schedule */

/*
 * ONE BREAK-ARITHMETIC TRUTH (TP-3). The 30-minute break rule repeats:
 * after each qualifying break, another becomes required after a further
 * 8 cumulative driving hours. These two primitives are the ONLY place
 * that arithmetic lives — the drive window, parking reachability and the
 * break planner all derive from them, so they cannot disagree about when
 * break k falls.
 *
 * A qualifying break resets ONLY the break timer. It never pauses the
 * 14-hour window, never restores driving or cycle time, and never
 * creates a new duty period — those facts are enforced where each clock
 * is subtracted, and pinned by the TP-3 harness.
 */

/**
 * Driving minutes from now until the n-th required break (n >= 1). The
 * first is the driver's own entered timer; each later one follows a
 * further 8 driving hours (§395.3(a)(3)(ii), repeated).
 */
export function nthBreakDueAfterMin(untilBreakMin: number, n: number): number {
  return untilBreakMin + (n - 1) * HOS.BREAK_AFTER_DRIVING_MIN;
}

/**
 * How many 30-minute breaks become REQUIRED strictly before `drivingMin`
 * minutes of driving complete. Strict on purpose, at every boundary: a
 * drive that ends exactly when a break falls due needs no break — the
 * rule forbids driving PAST the mark, not reaching it.
 */
export function requiredBreaksBefore(drivingMin: number, untilBreakMin: number): number {
  if (!Number.isFinite(drivingMin) || !Number.isFinite(untilBreakMin)) return 0;
  if (drivingMin <= untilBreakMin) return 0;
  return Math.ceil((drivingMin - untilBreakMin) / HOS.BREAK_AFTER_DRIVING_MIN);
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
   * Minutes of driving until the FIRST 30-minute break the plan must
   * contain, or null when none falls inside `clockLimitMin`. Preserved
   * from the single-break era; the full schedule is derived from
   * `requiredBreakCount` and the primitives above.
   */
  breakDueAfterMin: number | null;
  /**
   * True when at least one required break was charged against the
   * 14-hour window. The trap new drivers miss: the window never pauses,
   * so each break costs window time whether the truck is moving or not.
   */
  breakConsumesWindow: boolean;
  /**
   * How many 30-minute breaks the limit already accounts for (TP-3).
   * Each consumed 30 minutes of the 14-hour window and nothing else —
   * no break ever restores driving, window or cycle time.
   */
  requiredBreakCount: number;
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
   * EVERY REQUIRED BREAK BURNS THE WINDOW (TP-3). The 14-hour window
   * never pauses, so each 30-minute break inside the drive costs 30
   * window minutes. The old model charged AT MOST ONE break; a horizon
   * long enough for a second break (untilBreak + 8h of further driving)
   * was silently undercharged — a stop could look reachable when the
   * second break's window cost made it not.
   *
   * THE BRACKET WALK. Between break k and break k+1 the drive has paid
   * for exactly k breaks, so the window supports `windowMin − 30k`
   * driving minutes there. Walk the brackets upward: in each, the
   * feasible driving is capped by driving/cycle, by the break-adjusted
   * window, and by the bracket's own end (driving past it needs the next
   * break). The walk stops the first time a bracket cannot be entered —
   * caps only shrink and bracket floors only grow, so nothing later can
   * beat what is already in hand. This finds the exact legal maximum:
   * subtraction only, and a break never buys driving beyond the
   * driving/cycle/window caps.
   */
  const maxDrive = Math.min(clocks.drivingMin, clocks.cycleMin);
  let clockLimitMin = 0;
  let stoppedAtBreakEdge = false;
  for (let k = 0; ; k++) {
    const bracketStart = k === 0 ? 0 : nthBreakDueAfterMin(clocks.untilBreakMin, k);
    const cap = Math.min(maxDrive, clocks.windowMin - HOS.MIN_BREAK_MIN * k);
    if (cap < bracketStart) break; // this bracket cannot be entered; done
    const bracketEnd = nthBreakDueAfterMin(clocks.untilBreakMin, k + 1);
    if (cap <= bracketEnd) {
      // Capped inside this bracket by driving, cycle or the window.
      clockLimitMin = Math.max(0, cap);
      stoppedAtBreakEdge = false;
      break;
    }
    // The bracket ends before any cap: the driver reaches the next break
    // threshold with room to spare, takes the break, and continues in
    // the next bracket — unless that bracket turns out infeasible, in
    // which case THIS edge is the honest limit.
    clockLimitMin = Math.max(0, bracketEnd);
    stoppedAtBreakEdge = true;
  }
  const requiredBreakCount = requiredBreaksBefore(clockLimitMin, clocks.untilBreakMin);

  /*
   * WHICH RULE PRODUCED THE LIMIT. Driving/cycle caps keep their names
   * (driving first on a tie, as before). A window cap mid-bracket is the
   * 14-hour rule genuinely expiring. A limit sitting exactly ON a break
   * threshold — where driving/cycle would allow more but the window
   * cannot fund the break plus further driving — is reported as
   * '30-minute-break', because the break requirement is what actually
   * ends the day and the driver's next action (break vs. stop) differs.
   */
  let limitedBy: BindingRule;
  if (clockLimitMin >= maxDrive) {
    limitedBy = clocks.drivingMin <= clocks.cycleMin ? '11-hour' : 'cycle';
  } else if (stoppedAtBreakEdge) {
    limitedBy = '30-minute-break';
  } else {
    limitedBy = '14-hour';
  }

  /*
   * The first break the plan must contain: one strictly inside the limit
   * (it will be taken), or the one sitting exactly at a break-edge limit
   * (it is why the day ends). Otherwise none is claimed.
   */
  const breakDueAfterMin =
    requiredBreakCount >= 1 || (stoppedAtBreakEdge && clockLimitMin < maxDrive)
      ? clocks.untilBreakMin
      : null;

  return {
    clockLimitMin,
    limitedBy,
    bufferMin: buffer,
    // The buffer only ever subtracts. Floored at 0 so an oversized buffer
    // means "stop now", never a negative target a caller could add back.
    stopTargetMin: Math.max(0, clockLimitMin - buffer),
    breakDueAfterMin,
    breakConsumesWindow: requiredBreakCount >= 1,
    requiredBreakCount,
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
