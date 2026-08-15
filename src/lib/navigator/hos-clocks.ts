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

/**
 * The short form, placed directly beside the clock editor and beside the
 * driving clock display. Short on purpose: a driver glancing at a clock
 * mid-shift should be able to read the whole disclaimer without stopping.
 */
export const ELD_AUTHORITATIVE = 'ELD is authoritative.';

/**
 * How the cycle is labelled EVERYWHERE it appears, because the caveat is
 * part of what the number means.
 *
 * The balance is exact (see `cycleBalanceBuckets`); the recap is not
 * derivable from it. A driver reading "22 h left" alongside a date would
 * reasonably plan around that date, and the app has no basis for one — so
 * the label carries the limit rather than a footnote elsewhere carrying
 * it.
 */
export const CYCLE_LABEL = 'Cycle remaining — recap schedule not calculated.';

/** Said before the app will hand anyone a full clock. */
export const FRESH_SHIFT_CONFIRM =
  'Start with full clocks? Only do this if you are actually beginning a fresh shift after a full reset.';

/** Said before previously entered clocks are replaced or cleared. */
export const CLOCKS_REPLACE_CONFIRM =
  'Replace the clock values you already entered? The previous values are not kept.';

/**
 * Where the clocks on screen came from, said plainly.
 *
 * The old provenance lines were "No trip loaded — showing a fresh
 * driver's full clocks." and "clocks still assume a fresh driver (no ELD
 * linked)". Both described the assumption this milestone removed, and
 * leaving them would have been the same defect in a caption: a screen
 * telling a driver its numbers are a guess when they are the driver's
 * own, or that they are full when nothing has been entered at all.
 */
export function clocksProvenance(state: ClockEntryState, restored: boolean): string {
  if (state.kind !== 'set') return 'No clocks entered — enter yours to get clock warnings.';
  if (restored) return 'Restored from your trip in progress — not an ELD record.';
  return state.fromFreshShift
    ? 'Full clocks, as you confirmed at the start of this shift — not an ELD record.'
    : 'The clocks you entered — not an ELD record.';
}

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
    label: 'Cycle remaining',
    why: 'On-duty hours left in your 60- or 70-hour cycle. Recap schedule not calculated.',
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
  if (out.length > 0) return out;

  /*
   * CROSS-FIELD CONSISTENCY. These are not new rules — they are the
   * engine's own `validateClockState` constraints, checked at entry time
   * so the driver fixes a typo now instead of the app building a state
   * the engine would reject.
   *
   * The 14-hour window is wall-clock and does not pause, so a driver
   * cannot have driven more hours than their window has been open. In
   * USED terms: windowElapsed ≥ drivingUsed.
   */
  const used = usedMinutes(entered);
  if (used.windowElapsedMin < used.drivingUsedMin) {
    out.push(
      'Shift window left is too high for the drive time left — the 14-hour window does not pause.',
    );
  }
  // You cannot have driven more since your last break than you have
  // driven in total.
  if (used.drivingSinceBreakMin > used.drivingUsedMin) {
    out.push('Time until break is too low for the drive time left.');
  }
  return out;
}

/** The four entered REMAINING values as the engine's USED counterparts. */
function usedMinutes(entered: DriverEnteredClocks): {
  drivingUsedMin: number;
  windowElapsedMin: number;
  drivingSinceBreakMin: number;
  cycleUsedMin: number;
} {
  const caps = clockCeilings(entered.cycleRule);
  const clamp = (value: number, cap: number) => Math.min(cap, Math.max(0, value));
  return {
    drivingUsedMin: caps.drivingMin - clamp(entered.drivingMin, caps.drivingMin),
    windowElapsedMin: caps.windowMin - clamp(entered.windowMin, caps.windowMin),
    drivingSinceBreakMin: caps.untilBreakMin - clamp(entered.untilBreakMin, caps.untilBreakMin),
    cycleUsedMin: caps.cycleMin - clamp(entered.cycleMin, caps.cycleMin),
  };
}

/**
 * The cycle balance as day buckets the engine will accept — and NOT as a
 * reconstructed duty history, because that is not something a single
 * "hours remaining" number can support.
 *
 * WHAT A DRIVER TELLS US: "I have 22 hours left on my 70."
 * WHAT THAT DOES NOT TELL US: which of the past seven days those 48 used
 * hours fell on. The engine's cycle is a ROLLING window — `cycleUsedMin`
 * sums the last 7 or 8 buckets, and hours recap as their bucket rolls off
 * the back. Two drivers with an identical 22-hour balance can have
 * completely different recap schedules, and nothing in the entered number
 * distinguishes them.
 *
 * So this function does the only honest thing available: it reproduces
 * the BALANCE exactly, and places the used time in the most recent
 * buckets, which is the CONSERVATIVE arrangement — the hours recap as
 * late as possible, so the app never credits a driver with cycle time
 * they might not actually get back. It is capped at one day per bucket
 * because the engine rejects anything else (`validateClockState`:
 * "onDutyByDayMin entries must be within one day").
 *
 * THE LIMITATION THIS LEAVES, STATED PLAINLY: the bucket DISTRIBUTION is
 * an artefact of this conversion, not a record of the driver's week. The
 * current balance is exact and burns down correctly for a trip measured
 * in hours, which is what this pilot plans. Any RECAP projection built on
 * these buckets would be fiction — which is why no Navigator surface
 * computes one, and a test enforces that.
 */
export function cycleBalanceBuckets(cycleUsedMin: number): number[] {
  const used = Math.max(0, Math.round(cycleUsedMin));
  if (used === 0) return [0];
  const buckets: number[] = [];
  let left = used;
  while (left > 0) {
    const take = Math.min(HOS.DAY_MIN, left);
    // Unshift: the newest bucket is LAST, so filling from the front
    // leaves the used time in the most recent positions.
    buckets.unshift(take);
    left -= take;
  }
  return buckets;
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
 * strip — proven by a round-trip test over the whole valid range, not
 * just asserted here.
 *
 * The cycle is the one field where the inverse is not complete. See
 * `cycleBalanceBuckets`: the balance round-trips exactly, the day
 * DISTRIBUTION is a conversion artefact, and no recap may be computed
 * from it.
 */
export function toEngineClockState(entered: DriverEnteredClocks, nowMs: number): ClockState {
  const used = usedMinutes(entered);
  // The engine spells "no window open yet" as −1, which is only true when
  // NOTHING has been used. A driver who has driven at all has had a window
  // open at least that long, and claiming otherwise builds a state the
  // engine's own validator rejects ("driving time used but no 14-hour
  // window open").
  const nothingUsed = used.windowElapsedMin === 0 && used.drivingUsedMin === 0;
  return {
    atMs: nowMs,
    cycleRule: entered.cycleRule,
    drivingUsedMin: used.drivingUsedMin,
    windowElapsedMin: nothingUsed ? -1 : used.windowElapsedMin,
    drivingSinceBreakMin: used.drivingSinceBreakMin,
    restStreakMin: HOS.MIN_RESET_MIN,
    // A balance, not a history — see `cycleBalanceBuckets`.
    onDutyByDayMin: cycleBalanceBuckets(used.cycleUsedMin),
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

/**
 * The one line a collapsed setup shows for the clocks.
 *
 * WHY IT CARRIES NUMBERS AND NOT "Set". The Fast Start milestone
 * collapses the parked setup once the truck is confirmed, and the first
 * draft of that card said "Clocks: Set" — which is a claim that the
 * driver entered SOMETHING, not a statement of how much driving they
 * have left. A driver with 45 minutes of drive time remaining and a
 * driver with nine hours would read the identical word.
 *
 * So the collapsed line names the two numbers that bound the next leg:
 * drive time left and shift window left. Whichever runs out first ends
 * the day, and both are visible without opening anything.
 *
 * `unsupported` is not a formatting concern — Canada's "not calculated"
 * comes from the setup status, which is where the region lives.
 */
export function summarizeEnteredClocks(state: ClockEntryState): string {
  if (state.kind === 'unset') return CLOCKS_NOT_SET;
  return (
    `${formatEnteredClock(state.entered.drivingMin)} driving · ` +
    `${formatEnteredClock(state.entered.windowMin)} window`
  );
}
