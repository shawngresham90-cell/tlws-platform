import { HOS, type ClockState, type CycleRule } from '@/lib/trip-planner/types';
import { freshClockState, remainingClocks } from '@/lib/trip-planner/hos-engine';

/**
 * Driver-entered hours-of-service clocks (pre-trip setup milestone).
 *
 * THE DEFECT THIS EXISTS TO END. Until now the driving screen mounted its
 * clock state as `freshClockState(Date.now())` — eleven hours of driving,
 * a fourteen-hour window, seventy hours of cycle — for every driver, every
 * session, with no way to say otherwise. A driver six hours into their day
 * opened Navigator and was shown a full clock. That is not a missing
 * feature; it is the app asserting something false about the one subject
 * where being wrong is a violation.
 *
 * So there are now three states, and the middle one is the point:
 *
 *   'unset'  — nothing has been entered. The app says CLOCKS NOT SET and
 *              declines to guide by them. Silence is honest; a fresh
 *              eleven hours is not.
 *   'set'    — the driver typed what their ELD says is left.
 *   fresh    — available, but ONLY by an explicit, confirmed choice
 *              (`freshShiftClocks`), never as a default and never as a
 *              side effect of navigating, rerouting or reloading.
 *
 * THIS IS NOT A SECOND HOS ENGINE. It adds no rule, no exemption and no
 * interpretation. It is a two-way conversion between the numbers a driver
 * reads off an ELD (time REMAINING) and the shape the shipped engine
 * advances (time USED), plus range validation whose bounds are the
 * engine's own `HOS` constants. Every limit here is imported, never
 * restated — so a rule change in the engine cannot leave this file
 * asserting the old one.
 *
 * Pure: values in, values out. No clock, no storage, no I/O — `nowMs` is
 * a parameter, per AD-2.
 */

/* ------------------------------------------------------------- the shape */

/**
 * What the driver types, in the units their ELD shows: minutes REMAINING
 * on each clock. Not what the engine stores — see `toEngineClockState`.
 */
export type DriverEnteredClocks = {
  /** Minutes left under the 11-hour driving limit. */
  drivingMin: number;
  /** Minutes left in the 14-hour window. */
  windowMin: number;
  /** Minutes of driving left before a 30-minute break is required. */
  untilBreakMin: number;
  /** On-duty minutes left in the 60- or 70-hour cycle. */
  cycleMin: number;
  /** Which cycle the driver runs. The engine already supports both. */
  cycleRule: CycleRule;
};

/**
 * Whether this driver has told us anything. `'unset'` is a real answer
 * and the default one — a returning driver is never silently handed a
 * full clock.
 */
export type ClockEntryState =
  | { kind: 'unset' }
  | {
      kind: 'set';
      entered: DriverEnteredClocks;
      /** When the driver entered it, so the screen can say how stale it is. */
      enteredAtMs: number;
      /** True only when this came from the explicit fresh-shift choice. */
      fromFreshShift: boolean;
    };

export const CLOCKS_UNSET: ClockEntryState = Object.freeze({ kind: 'unset' });

/* ------------------------------------------------------------ the wording */

/** Shown wherever a clock would be, when none has been entered. */
export const CLOCKS_NOT_SET = 'Clocks not set';

/** Why that is not a bug, said where the driver sees the blank. */
export const CLOCKS_NOT_SET_DETAIL =
  'Navigator does not know what you have already driven today. Enter your remaining hours to get clock warnings, or leave this blank and use your ELD.';

/** The honesty line that travels with every driver-entered clock. */
export const DRIVER_ENTERED_NOTICE =
  'Driver-entered planning estimate — not an ELD record. Your certified ELD remains the record.';

/** Said before the app will hand anyone a full clock. */
export const FRESH_SHIFT_CONFIRM =
  'Start with full clocks? Only do this if you are actually beginning a fresh shift after a full reset.';

/** Said before previously entered clocks are replaced or cleared. */
export const CLOCKS_REPLACE_CONFIRM =
  'Replace the clock values you already entered? The previous values are not kept.';

/** What the driver gives up by leaving the clocks blank. */
export const CLOCKS_UNSET_WARNING =
  'HOS guidance is unavailable until you enter your clocks. Navigation still works.';

/* ------------------------------------------------------------ the limits */

/**
 * The maximum a driver may enter for each clock — which is exactly the
 * regulation's cap, taken from the engine's constants rather than
 * restated here. A driver cannot have more time left than the rule
 * allows, and entering more would silently invent headroom.
 */
export function clockCeilings(cycleRule: CycleRule): {
  drivingMin: number;
  windowMin: number;
  untilBreakMin: number;
  cycleMin: number;
} {
  return {
    drivingMin: HOS.MAX_DRIVING_MIN,
    windowMin: HOS.MAX_WINDOW_MIN,
    untilBreakMin: HOS.BREAK_AFTER_DRIVING_MIN,
    cycleMin: cycleRule === '60/7' ? HOS.CYCLE_60_MIN : HOS.CYCLE_70_MIN,
  };
}

/** The four clocks, in the order the driver reads them off an ELD. */
export type ClockFieldKey = 'drivingMin' | 'windowMin' | 'untilBreakMin' | 'cycleMin';

export type ClockField = {
  key: ClockFieldKey;
  label: string;
  /** What this clock actually stops, in one line. */
  why: string;
};

export const CLOCK_FIELDS: readonly ClockField[] = Object.freeze([
  {
    key: 'drivingMin',
    label: 'Drive time left',
    why: 'The 11-hour driving limit.',
  },
  {
    key: 'windowMin',
    label: 'Shift window left',
    why: 'The 14-hour window. It does not pause for breaks.',
  },
  {
    key: 'untilBreakMin',
    label: 'Until 30-minute break',
    why: 'Driving time left before a break is required.',
  },
  {
    key: 'cycleMin',
    label: 'Cycle left',
    why: 'On-duty hours left in your 60- or 70-hour cycle.',
  },
]);

/* --------------------------------------------------------- validation */

/**
 * Range and shape errors, as sentences a driver can act on. An empty
 * array means the entry is usable.
 *
 * REPORTED, NEVER CLAMPED — the same rule the truck profile follows. A
 * quietly corrected clock is a clock the driver believes and the app
 * made up.
 */
export function validateEnteredClocks(entered: DriverEnteredClocks): string[] {
  const out: string[] = [];
  const caps = clockCeilings(entered.cycleRule);
  for (const field of CLOCK_FIELDS) {
    const value = entered[field.key];
    const cap = caps[field.key];
    if (!Number.isFinite(value)) {
      out.push(`${field.label}: enter hours and minutes.`);
      continue;
    }
    if (value < 0) {
      out.push(`${field.label}: cannot be negative.`);
      continue;
    }
    if (value > cap) {
      out.push(`${field.label}: cannot be more than ${formatHours(cap)}.`);
    }
  }
  // A driver cannot have more driving left than window left: the window
  // is wall-clock and does not pause. This is not a new rule — it is the
  // 14-hour rule the engine already enforces, stated at entry time so the
  // driver fixes a typo now rather than trusting a clock that cannot
  // happen.
  if (
    out.length === 0 &&
    Number.isFinite(entered.drivingMin) &&
    Number.isFinite(entered.windowMin) &&
    entered.drivingMin > entered.windowMin
  ) {
    out.push('Drive time left cannot be more than shift window left.');
  }
  return out;
}

/** "11h 00m" — for a ceiling named inside an error sentence. */
function formatHours(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/* ------------------------------------------------- remaining ⇄ engine */

/**
 * Driver-entered REMAINING minutes → the engine's USED-minute state.
 *
 * Every line is the inverse of what `remainingClocks` computes, using the
 * same constants, so a value entered here reads back identically on the
 * strip. The cycle is expressed as a single day bucket carrying all the
 * used time: the engine sums `onDutyByDayMin`, and this app has no
 * per-day history to distribute it across — one bucket is the honest
 * representation of "this much is gone, I don't know which day it was".
 */
export function toEngineClockState(entered: DriverEnteredClocks, nowMs: number): ClockState {
  const caps = clockCeilings(entered.cycleRule);
  const clamp = (value: number, cap: number) => Math.min(cap, Math.max(0, value));
  const drivingLeft = clamp(entered.drivingMin, caps.drivingMin);
  const windowLeft = clamp(entered.windowMin, caps.windowMin);
  const breakLeft = clamp(entered.untilBreakMin, caps.untilBreakMin);
  const cycleLeft = clamp(entered.cycleMin, caps.cycleMin);
  return {
    atMs: nowMs,
    cycleRule: entered.cycleRule,
    drivingUsedMin: caps.drivingMin - drivingLeft,
    // A full window means no window is open yet, which the engine spells
    // −1 rather than 840 — the distinction between "not started" and
    // "started and none of it spent".
    windowElapsedMin: windowLeft >= caps.windowMin ? -1 : caps.windowMin - windowLeft,
    drivingSinceBreakMin: caps.untilBreakMin - breakLeft,
    restStreakMin: HOS.MIN_RESET_MIN,
    onDutyByDayMin: [caps.cycleMin - cycleLeft],
    dayBucketStartMs: nowMs,
  };
}

/**
 * The engine's state → the numbers a driver would re-type. Used to seed
 * the editor from clocks that have already burned some time, so opening
 * the editor mid-trip shows what is actually left rather than what was
 * originally entered.
 *
 * It reads `remainingClocks` — the engine's own function — rather than
 * recomputing, which is what keeps this file from becoming a second
 * source of truth about what "remaining" means.
 */
export function fromEngineClockState(state: ClockState): DriverEnteredClocks {
  const remaining = remainingClocks(state);
  return {
    drivingMin: remaining.drivingMin,
    windowMin: remaining.windowMin,
    untilBreakMin: remaining.untilBreakMin,
    cycleMin: remaining.cycleMin,
    cycleRule: state.cycleRule,
  };
}

/**
 * A driver genuinely starting a fresh shift.
 *
 * Reachable ONLY through a confirmed choice. It is the engine's own
 * `freshClockState` read back as remaining minutes, so "full clocks" here
 * means exactly what the engine means by it — this function invents
 * nothing, it just makes the old silent default into a deliberate one.
 */
export function freshShiftClocks(cycleRule: CycleRule = '70/8'): DriverEnteredClocks {
  return fromEngineClockState(freshClockState(0, cycleRule));
}

/* ------------------------------------------------------ state helpers */

/** Has this driver told us anything? */
export function clocksAreSet(
  state: ClockEntryState,
): state is Extract<ClockEntryState, { kind: 'set' }> {
  return state.kind === 'set';
}

/**
 * The engine state to start from, or null when nothing has been entered.
 *
 * NULL IS THE IMPORTANT RETURN. A caller that cannot handle "no clocks"
 * must show `CLOCKS_NOT_SET`, not substitute a fresh driver — which is
 * precisely the substitution this whole module exists to remove.
 */
export function engineStateFor(state: ClockEntryState, nowMs: number): ClockState | null {
  return state.kind === 'set' ? toEngineClockState(state.entered, nowMs) : null;
}

/* ------------------------------------------------------ hours + minutes */

/** Minutes → the two boxes a driver types into. */
export function splitHoursMinutes(totalMin: number): { hours: number; minutes: number } {
  if (!Number.isFinite(totalMin) || totalMin < 0) return { hours: 0, minutes: 0 };
  return { hours: Math.floor(totalMin / 60), minutes: Math.round(totalMin % 60) };
}

/** The two boxes → minutes. Non-numeric input yields NaN, which validation reports. */
export function joinHoursMinutes(hours: number, minutes: number): number {
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.NaN;
  return hours * 60 + minutes;
}

/** "6h 30m" / "0h 00m" — how an entered clock reads back on the summary. */
export function formatEnteredClock(totalMin: number): string {
  if (!Number.isFinite(totalMin) || totalMin < 0) return '—';
  const { hours, minutes } = splitHoursMinutes(totalMin);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}
