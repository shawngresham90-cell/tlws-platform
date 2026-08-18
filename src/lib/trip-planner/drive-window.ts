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

/* --------------------------------------------- planned via dwell (TP-4) */

/*
 * PLANNED TIME AT THE VIA STOP. The driver tells the planner how long they
 * intend to stand still at the one optional via — a dock appointment, a
 * meal, a load check — and the plan charges that time honestly instead of
 * pretending the truck passes through instantly.
 *
 * WHAT THE DWELL DOES TO EACH CLOCK, and why:
 *
 *   DRIVING   nothing. The truck is not moving; the 11-hour clock only
 *             counts driving.
 *   WINDOW    always consumed, minute for minute. The 14-hour window
 *             never pauses for anything.
 *   CYCLE     consumed, minute for minute — THE CONSERVATIVE CHOICE,
 *             made deliberately. The planner cannot know the driver's
 *             duty status during the dwell (that is an ELD fact), and a
 *             dock stop is commonly on-duty/not-driving, which does burn
 *             the 60/70-hour cycle. Charging it may refuse a stop the
 *             driver could actually reach; crediting it could offer one
 *             they cannot. Marking the dwell as a qualifying break does
 *             NOT lift this charge, because "counts as my break" is a
 *             statement about the break rule, not about duty status.
 *   BREAK     reset ONLY when the dwell is at least 30 minutes AND the
 *             driver explicitly said it will count. Duration alone never
 *             qualifies — whether a stop satisfies §395.3(a)(3)(ii) is a
 *             fact about the driver's recorded day, so the default is
 *             always "does not satisfy".
 */
export type PlannedViaDwell = {
  /** Worst-case provider driving minutes from departure to the via. */
  driveMin: number;
  /** Driver-entered planned minutes stopped at the via. Always > 0 here. */
  dwellMin: number;
  /**
   * The driver EXPLICITLY said this dwell counts as their 30-minute
   * break, and the dwell is long enough. Normalized by
   * `effectiveViaDwell` — never trusted raw.
   */
  qualifiesAsBreak: boolean;
};

/** The planned-time presets the via section offers, in minutes. */
export const VIA_DWELL_PRESETS = [0, 15, 30, 45, 60, 90, 120] as const;

/**
 * The hard ceiling on a planned via dwell, in minutes. Twelve hours: the
 * planner models one duty period, and no dwell inside a 14-hour window
 * can meaningfully exceed this — a longer stop is a rest, which is
 * exactly what the needs-clock-update boundary exists for. Requests
 * beyond it are REJECTED, never silently clamped.
 */
export const VIA_DWELL_MAX_MIN = 720;

/**
 * The one normalization gate every consumer goes through. A dwell of zero
 * (or anything unusable) is NO dwell; a qualifying claim on a dwell under
 * 30 minutes is arithmetic nonsense and is dropped here, so no code path
 * can ever credit a break the duration cannot support (scenario D4).
 */
export function effectiveViaDwell(
  via: { driveMin: number; dwellMin: number; qualifiesAsBreak: boolean } | null | undefined,
): PlannedViaDwell | null {
  if (via === null || via === undefined) return null;
  if (!Number.isFinite(via.driveMin) || via.driveMin < 0) return null;
  if (!Number.isFinite(via.dwellMin) || via.dwellMin <= 0) return null;
  return {
    driveMin: via.driveMin,
    dwellMin: via.dwellMin,
    qualifiesAsBreak: via.qualifiesAsBreak === true && via.dwellMin >= HOS.MIN_BREAK_MIN,
  };
}

/**
 * How many 30-minute breaks a drive of `drivingMin` minutes requires,
 * with an optional via dwell in the middle (TP-4). `via` must come from
 * `effectiveViaDwell`.
 *
 * A QUALIFYING dwell resets the break timer AT the via: thresholds
 * strictly before the via follow the driver's entered timer as always
 * (a break already due before the via is still due before it — the dwell
 * never satisfies it retroactively, scenario D6), and thresholds from the
 * via onward restart at a fresh 8 driving hours. A threshold landing
 * exactly ON the via is satisfied by the qualifying dwell itself. A
 * non-qualifying dwell changes nothing here: the break timer keeps
 * running exactly as if the truck had not stopped.
 */
export function requiredBreaksWithVia(
  drivingMin: number,
  untilBreakMin: number,
  via: PlannedViaDwell | null,
): number {
  if (via === null || !via.qualifiesAsBreak || drivingMin <= via.driveMin) {
    return requiredBreaksBefore(drivingMin, untilBreakMin);
  }
  return (
    requiredBreaksBefore(via.driveMin, untilBreakMin) +
    requiredBreaksBefore(drivingMin - via.driveMin, HOS.BREAK_AFTER_DRIVING_MIN)
  );
}

/**
 * The wall-clock minutes the via dwell adds to a drive of `drivingMin`
 * minutes: the full dwell once the drive goes strictly past the via,
 * nothing before it. A day that ENDS at the via has not spent the dwell —
 * whatever happens there happens after the plan's last confirmed event.
 */
export function viaDwellWallMin(drivingMin: number, via: PlannedViaDwell | null): number {
  if (via === null || drivingMin <= via.driveMin) return 0;
  return via.dwellMin;
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

type WalkResult = {
  clockLimitMin: number;
  limitedBy: BindingRule;
  stoppedAtBreakEdge: boolean;
  requiredBreakCount: number;
  breakDueAfterMin: number | null;
  maxDrive: number;
};

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
 *
 * Since TP-4 the walk is a helper rather than the body of `driveWindow`,
 * because a plan with a via dwell runs it TWICE — once as ever, and once
 * on the subtraction-chained clocks that remain after the via — and both
 * runs must be the same arithmetic or the two halves of one day could
 * disagree about what a break costs.
 */
function walkBrackets(
  drivingMin: number,
  windowMin: number,
  untilBreakMin: number,
  cycleMin: number,
): WalkResult {
  const maxDrive = Math.min(drivingMin, cycleMin);
  let clockLimitMin = 0;
  let stoppedAtBreakEdge = false;
  for (let k = 0; ; k++) {
    const bracketStart = k === 0 ? 0 : nthBreakDueAfterMin(untilBreakMin, k);
    const cap = Math.min(maxDrive, windowMin - HOS.MIN_BREAK_MIN * k);
    if (cap < bracketStart) break; // this bracket cannot be entered; done
    const bracketEnd = nthBreakDueAfterMin(untilBreakMin, k + 1);
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
  const requiredBreakCount = requiredBreaksBefore(clockLimitMin, untilBreakMin);

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
    limitedBy = drivingMin <= cycleMin ? '11-hour' : 'cycle';
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
      ? untilBreakMin
      : null;

  return {
    clockLimitMin,
    limitedBy,
    stoppedAtBreakEdge,
    requiredBreakCount,
    breakDueAfterMin,
    maxDrive,
  };
}

/**
 * Compute the usable driving window from driver-stated remaining clocks.
 *
 * `clocks` must come from the existing clock authority — this function
 * validates rather than repairs. A non-finite or negative field yields a
 * refusal, because silently reading a corrupt clock as zero would turn a
 * broken record into a confident "you must stop now", and reading it as
 * generous would do something far worse.
 *
 * `via` (TP-4) is the planned via dwell, when the plan carries one AND
 * provider timing could place the via in driving minutes. With no via —
 * or a horizon that legally ends at or before it — the answer is
 * byte-identical to the TP-3 computation.
 */
export function driveWindow(
  clocks: RemainingClocks,
  bufferMin: number,
  via?: PlannedViaDwell | null,
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

  const v = effectiveViaDwell(via ?? null);
  const base = walkBrackets(
    clocks.drivingMin,
    clocks.windowMin,
    clocks.untilBreakMin,
    clocks.cycleMin,
  );

  /*
   * THE DWELL ONLY MATTERS IF THE DAY LEGALLY CROSSES THE VIA. A limit at
   * or before the via never spends the dwell — whatever happens at the
   * via happens after the plan's last confirmed driving minute — so the
   * TP-3 answer stands unchanged (scenario D1).
   */
  let r: WalkResult;
  if (v === null || base.clockLimitMin <= v.driveMin) {
    r = base;
  } else {
    /*
     * CHAIN THE CLOCKS ACROSS THE VIA — subtraction only, the same rule
     * the clock-update boundary enforces. At the via the driver has
     * driven `driveMin` minutes and taken every break due before it;
     * the dwell then burns the window minute-for-minute (it never
     * pauses) and the cycle minute-for-minute (the conservative duty
     * reading documented on PlannedViaDwell). Driving time is untouched.
     * The break timer either keeps its natural residual, or restarts at
     * a fresh 8 hours when the driver explicitly marked the dwell as
     * their qualifying break.
     */
    const breaksBeforeVia = requiredBreaksBefore(v.driveMin, clocks.untilBreakMin);
    const untilBreakAtVia = v.qualifiesAsBreak
      ? HOS.BREAK_AFTER_DRIVING_MIN
      : nthBreakDueAfterMin(clocks.untilBreakMin, breaksBeforeVia + 1) - v.driveMin;
    const windowAtVia =
      clocks.windowMin - v.driveMin - HOS.MIN_BREAK_MIN * breaksBeforeVia - v.dwellMin;
    const cycleAtVia = clocks.cycleMin - v.driveMin - v.dwellMin;

    if (windowAtVia < 0 || cycleAtVia < 0) {
      // The dwell itself exhausts a clock: the day cannot legally
      // continue past the via, however much driving time remains. The
      // window is named first when both die — it dies during the dwell
      // either way, and it is the one that never pauses.
      r = {
        clockLimitMin: v.driveMin,
        limitedBy: windowAtVia < 0 ? '14-hour' : 'cycle',
        stoppedAtBreakEdge: false,
        requiredBreakCount: breaksBeforeVia,
        breakDueAfterMin: breaksBeforeVia >= 1 ? clocks.untilBreakMin : null,
        maxDrive: base.maxDrive,
      };
    } else {
      const post = walkBrackets(
        clocks.drivingMin - v.driveMin,
        windowAtVia,
        untilBreakAtVia,
        cycleAtVia,
      );
      r = {
        clockLimitMin: v.driveMin + post.clockLimitMin,
        limitedBy: post.limitedBy,
        stoppedAtBreakEdge: post.stoppedAtBreakEdge,
        requiredBreakCount: breaksBeforeVia + post.requiredBreakCount,
        breakDueAfterMin:
          breaksBeforeVia >= 1
            ? clocks.untilBreakMin
            : post.breakDueAfterMin === null
              ? null
              : v.driveMin + post.breakDueAfterMin,
        maxDrive: base.maxDrive,
      };
    }
  }

  return {
    clockLimitMin: r.clockLimitMin,
    limitedBy: r.limitedBy,
    bufferMin: buffer,
    // The buffer only ever subtracts. Floored at 0 so an oversized buffer
    // means "stop now", never a negative target a caller could add back.
    stopTargetMin: Math.max(0, r.clockLimitMin - buffer),
    breakDueAfterMin: r.breakDueAfterMin,
    breakConsumesWindow: r.requiredBreakCount >= 1,
    requiredBreakCount: r.requiredBreakCount,
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
