import {
  HOS,
  type ClockState,
  type CycleRule,
  type DutySegment,
  type DutyStatus,
  type HosViolation,
  type RemainingClocks,
} from './types';

/**
 * Hours-of-Service engine (Phase 3) — 49 CFR 395.3, property-carrying,
 * planning-mode. Pure and deterministic: a ClockState in, a ClockState out;
 * no wall clock, no I/O. This simulates the clocks for PLANNING — it is not
 * an ELD and produces no record of duty status.
 *
 * Rules implemented:
 * - 11-hour driving limit          §395.3(a)(3)(i)
 * - 14-hour driving window         §395.3(a)(2) — never paused by breaks
 * - 30-minute break                §395.3(a)(3)(ii) — after 8h cumulative
 *   driving; any ≥30-min non-driving period satisfies it (2020 rule)
 * - 10-hour reset                  §395.3(a)(1) — ≥10h consecutive
 *   off-duty/sleeper resets the 11 and 14 clocks
 * - 60-hr/7-day and 70-hr/8-day    §395.3(b) — rolling on-duty cap
 * - 34-hour restart                §395.3(c) — resets the cycle
 *
 * Split-sleeper pairing (§395.1(g)) is deliberately Phase 4+ scope.
 */

const cycleDays = (rule: CycleRule): number => (rule === '60/7' ? 7 : 8);
const cycleCapMin = (rule: CycleRule): number =>
  rule === '60/7' ? HOS.CYCLE_60_MIN : HOS.CYCLE_70_MIN;

/** A fresh driver: full reset taken, no cycle time used. */
export function freshClockState(atMs: number, cycleRule: CycleRule = '70/8'): ClockState {
  return {
    atMs,
    cycleRule,
    drivingUsedMin: 0,
    windowElapsedMin: -1,
    drivingSinceBreakMin: 0,
    restStreakMin: HOS.MIN_RESET_MIN,
    onDutyByDayMin: [0],
    dayBucketStartMs: atMs,
  };
}

/** Total on-duty minutes counted against the rolling cycle. */
export function cycleUsedMin(state: ClockState): number {
  const days = cycleDays(state.cycleRule);
  const buckets = state.onDutyByDayMin.slice(-days);
  return buckets.reduce((s, m) => s + m, 0);
}

/** Roll day buckets forward so the last bucket covers `atMs`. */
function rollDayBuckets(state: ClockState, toMs: number): ClockState {
  let { dayBucketStartMs } = state;
  const onDutyByDayMin = [...state.onDutyByDayMin];
  while (toMs >= dayBucketStartMs + HOS.DAY_MIN * 60_000) {
    dayBucketStartMs += HOS.DAY_MIN * 60_000;
    onDutyByDayMin.push(0);
    // Keep a bounded history: one bucket per day of the longest cycle + 1.
    while (onDutyByDayMin.length > 9) onDutyByDayMin.shift();
  }
  return { ...state, dayBucketStartMs, onDutyByDayMin };
}

/**
 * Advance the clock state through one duty segment. Returns the new state
 * and any violations the segment INCURRED (planning callers should treat a
 * violation as "this plan is illegal", not as something to record).
 */
export function advance(
  state: ClockState,
  status: DutyStatus,
  minutes: number,
): { state: ClockState; violations: HosViolation[] } {
  if (minutes < 0 || !Number.isFinite(minutes)) {
    throw new Error(`invalid segment minutes: ${minutes}`);
  }
  const violations: HosViolation[] = [];
  let s = rollDayBuckets(state, state.atMs);
  const startMs = s.atMs;
  const endMs = startMs + minutes * 60_000;

  if (status === 'off-duty' || status === 'sleeper') {
    const restStreakMin = s.restStreakMin + minutes;
    // The 14-hour window is WALL-CLOCK — off-duty time inside an open window
    // keeps consuming it (§395.3(a)(2)); only a full reset closes it.
    const windowElapsedMin =
      s.windowElapsedMin < 0 ? -1 : Math.min(HOS.MAX_WINDOW_MIN, s.windowElapsedMin + minutes);
    let next: ClockState = { ...s, atMs: endMs, restStreakMin, windowElapsedMin };
    // ≥30-min non-driving interruption clears the break clock.
    if (minutes >= HOS.MIN_BREAK_MIN) next = { ...next, drivingSinceBreakMin: 0 };
    // ≥10-hr consecutive rest resets the 11 & 14 clocks.
    if (restStreakMin >= HOS.MIN_RESET_MIN) {
      next = { ...next, drivingUsedMin: 0, windowElapsedMin: -1, drivingSinceBreakMin: 0 };
    }
    // ≥34-hr consecutive rest restarts the cycle.
    if (restStreakMin >= HOS.RESTART_MIN) {
      next = { ...next, onDutyByDayMin: [0], dayBucketStartMs: endMs };
    }
    return { state: rollDayBuckets(next, endMs), violations };
  }

  // Driving or on-duty: rest streak ends, window opens/advances.
  const windowElapsedBefore = s.windowElapsedMin < 0 ? 0 : s.windowElapsedMin;
  const windowElapsedAfter = windowElapsedBefore + minutes;

  if (status === 'driving') {
    // Driving past the 14th hour of the window is a violation.
    if (windowElapsedAfter > HOS.MAX_WINDOW_MIN) {
      violations.push({
        rule: '14-hour',
        atMs: startMs + Math.max(0, HOS.MAX_WINDOW_MIN - windowElapsedBefore) * 60_000,
        detail: `driving extends ${windowElapsedAfter - HOS.MAX_WINDOW_MIN} min past the 14-hour window`,
      });
    }
    if (s.drivingUsedMin + minutes > HOS.MAX_DRIVING_MIN) {
      violations.push({
        rule: '11-hour',
        atMs: startMs + Math.max(0, HOS.MAX_DRIVING_MIN - s.drivingUsedMin) * 60_000,
        detail: `driving exceeds the 11-hour limit by ${s.drivingUsedMin + minutes - HOS.MAX_DRIVING_MIN} min`,
      });
    }
    if (s.drivingSinceBreakMin + minutes > HOS.BREAK_AFTER_DRIVING_MIN) {
      violations.push({
        rule: '30-minute-break',
        atMs: startMs + Math.max(0, HOS.BREAK_AFTER_DRIVING_MIN - s.drivingSinceBreakMin) * 60_000,
        detail: 'drove past 8 cumulative hours without a 30-minute break',
      });
    }
  }

  // Cycle accounting: on-duty time accrues into day buckets as it happens.
  let cur: ClockState = { ...s };
  let remaining = minutes;
  let cursorMs = startMs;
  while (remaining > 0) {
    cur = rollDayBuckets(cur, cursorMs);
    const bucketEndMs = cur.dayBucketStartMs + HOS.DAY_MIN * 60_000;
    const chunk = Math.min(remaining, Math.max(1, Math.round((bucketEndMs - cursorMs) / 60_000)));
    const onDutyByDayMin = [...cur.onDutyByDayMin];
    onDutyByDayMin[onDutyByDayMin.length - 1] += chunk;
    cur = { ...cur, onDutyByDayMin };
    cursorMs += chunk * 60_000;
    remaining -= chunk;
  }

  const cycleAfter = cycleUsedMin(cur);
  if (status === 'driving' && cycleAfter > cycleCapMin(s.cycleRule)) {
    violations.push({
      rule: s.cycleRule === '60/7' ? '60-hour' : '70-hour',
      atMs: endMs,
      detail: `driving with ${cycleAfter - cycleCapMin(s.cycleRule)} min over the ${s.cycleRule} cycle`,
    });
  }

  const next: ClockState = {
    ...cur,
    atMs: endMs,
    restStreakMin: 0,
    windowElapsedMin: Math.min(HOS.MAX_WINDOW_MIN, windowElapsedAfter),
    drivingUsedMin: status === 'driving' ? s.drivingUsedMin + minutes : s.drivingUsedMin,
    drivingSinceBreakMin:
      status === 'driving' ? s.drivingSinceBreakMin + minutes : s.drivingSinceBreakMin,
  };
  return { state: next, violations };
}

/** Remaining-clock calculations for the state as it stands. */
export function remainingClocks(state: ClockState): RemainingClocks {
  const drivingMin = Math.max(0, HOS.MAX_DRIVING_MIN - state.drivingUsedMin);
  const windowMin =
    state.windowElapsedMin < 0
      ? HOS.MAX_WINDOW_MIN
      : Math.max(0, HOS.MAX_WINDOW_MIN - state.windowElapsedMin);
  const untilBreakMin = Math.max(0, HOS.BREAK_AFTER_DRIVING_MIN - state.drivingSinceBreakMin);
  const cycleMin = Math.max(0, cycleCapMin(state.cycleRule) - cycleUsedMin(state));

  const entries: [RemainingClocks['limitedBy'], number][] = [
    ['11-hour', drivingMin],
    ['14-hour', windowMin],
    ['30-minute-break', untilBreakMin],
    ['cycle', cycleMin],
  ];
  entries.sort((a, b) => a[1] - b[1]);
  return {
    drivingMin,
    windowMin,
    untilBreakMin,
    cycleMin,
    limitedBy: entries[0][0],
    legalDrivingMin: entries[0][1],
  };
}

/** Minutes the driver can legally drive right now. */
export function legalDrivingMin(state: ClockState): number {
  return remainingClocks(state).legalDrivingMin;
}

export type DrivePlanRest = {
  kind: '30-minute-break' | '10-hour-reset';
  /** Offset minutes from plan start when the rest begins. */
  startOffsetMin: number;
  minutes: number;
};

export type DrivePlan = {
  /** Total elapsed minutes from start to arrival (driving + rests). */
  totalMinutes: number;
  driveMinutes: number;
  rests: DrivePlanRest[];
  /** Clock state on arrival. */
  arrivalState: ClockState;
  segments: DutySegment[];
};

/**
 * Arrival-time calculation: schedule `driveMinutes` of driving from `state`,
 * automatically inserting 30-minute breaks and 10-hour resets whenever a
 * clock runs dry. Deterministic and violation-free by construction.
 * `breakMinutes`/`resetMinutes` let planners model longer dwell.
 */
export function planDrive(
  state: ClockState,
  driveMinutes: number,
  opts: { breakMinutes?: number; resetMinutes?: number } = {},
): DrivePlan {
  const breakMinutes = Math.max(HOS.MIN_BREAK_MIN, opts.breakMinutes ?? HOS.MIN_BREAK_MIN);
  const resetMinutes = Math.max(HOS.MIN_RESET_MIN, opts.resetMinutes ?? HOS.MIN_RESET_MIN);
  if (driveMinutes < 0 || !Number.isFinite(driveMinutes)) {
    throw new Error(`invalid driveMinutes: ${driveMinutes}`);
  }

  const startMs = state.atMs;
  let cur = state;
  let remaining = Math.round(driveMinutes);
  let driven = 0;
  const rests: DrivePlanRest[] = [];
  const segments: DutySegment[] = [];
  // Hard ceiling far above any legal plan; guards against a logic bug looping.
  let guard = 1000;

  while (remaining > 0 && guard-- > 0) {
    const rc = remainingClocks(cur);
    if (rc.legalDrivingMin <= 0) {
      // Which rest clears the binding constraint?
      if (rc.limitedBy === '30-minute-break' && rc.drivingMin > 0 && rc.windowMin > breakMinutes) {
        const offset = Math.round((cur.atMs - startMs) / 60_000);
        rests.push({ kind: '30-minute-break', startOffsetMin: offset, minutes: breakMinutes });
        segments.push({
          status: 'off-duty',
          startMs: cur.atMs,
          minutes: breakMinutes,
          note: '30-minute break',
        });
        cur = advance(cur, 'off-duty', breakMinutes).state;
      } else {
        const offset = Math.round((cur.atMs - startMs) / 60_000);
        rests.push({ kind: '10-hour-reset', startOffsetMin: offset, minutes: resetMinutes });
        segments.push({
          status: 'sleeper',
          startMs: cur.atMs,
          minutes: resetMinutes,
          note: '10-hour reset',
        });
        cur = advance(cur, 'sleeper', resetMinutes).state;
      }
      continue;
    }
    const chunk = Math.min(remaining, rc.legalDrivingMin);
    segments.push({ status: 'driving', startMs: cur.atMs, minutes: chunk });
    const step = advance(cur, 'driving', chunk);
    if (step.violations.length > 0) {
      // Impossible by construction; fail loudly rather than emit a bad plan.
      throw new Error(`planDrive produced a violation: ${step.violations[0].detail}`);
    }
    cur = step.state;
    driven += chunk;
    remaining -= chunk;
  }
  if (remaining > 0) throw new Error('planDrive guard exhausted — logic error');

  return {
    totalMinutes: Math.round((cur.atMs - startMs) / 60_000),
    driveMinutes: driven,
    rests,
    arrivalState: cur,
    segments,
  };
}

/**
 * Earliest legal arrival (epoch ms) for a drive of `driveMinutes` starting
 * from `state` — the arrival-time calculation the trip planner quotes.
 */
export function earliestArrivalMs(
  state: ClockState,
  driveMinutes: number,
  opts?: { breakMinutes?: number; resetMinutes?: number },
): number {
  return state.atMs + planDrive(state, driveMinutes, opts).totalMinutes * 60_000;
}

/**
 * Validate a caller-supplied clock state (API boundary guard). Returns
 * human-readable problems; empty = valid.
 */
export function validateClockState(state: ClockState): string[] {
  const problems: string[] = [];
  if (!Number.isFinite(state.atMs) || state.atMs <= 0)
    problems.push('atMs must be a positive epoch ms');
  if (state.cycleRule !== '60/7' && state.cycleRule !== '70/8')
    problems.push('cycleRule must be 60/7 or 70/8');
  if (state.drivingUsedMin < 0 || state.drivingUsedMin > HOS.MAX_DRIVING_MIN)
    problems.push(`drivingUsedMin out of range 0..${HOS.MAX_DRIVING_MIN}`);
  if (state.windowElapsedMin < -1 || state.windowElapsedMin > HOS.MAX_WINDOW_MIN)
    problems.push(`windowElapsedMin out of range -1..${HOS.MAX_WINDOW_MIN}`);
  if (state.drivingSinceBreakMin < 0 || state.drivingSinceBreakMin > HOS.BREAK_AFTER_DRIVING_MIN)
    problems.push(`drivingSinceBreakMin out of range 0..${HOS.BREAK_AFTER_DRIVING_MIN}`);
  if (state.restStreakMin < 0) problems.push('restStreakMin must be ≥ 0');
  if (!Array.isArray(state.onDutyByDayMin) || state.onDutyByDayMin.length === 0)
    problems.push('onDutyByDayMin must be a non-empty array');
  else if (state.onDutyByDayMin.some((m) => m < 0 || m > HOS.DAY_MIN))
    problems.push('onDutyByDayMin entries must be within one day');
  if (state.drivingUsedMin > 0 && state.windowElapsedMin < 0)
    problems.push('driving time used but no 14-hour window open');
  if (state.windowElapsedMin >= 0 && state.windowElapsedMin < state.drivingUsedMin)
    problems.push('windowElapsedMin cannot be less than drivingUsedMin');
  if (state.drivingSinceBreakMin > state.drivingUsedMin)
    problems.push('drivingSinceBreakMin cannot exceed drivingUsedMin');
  return problems;
}
