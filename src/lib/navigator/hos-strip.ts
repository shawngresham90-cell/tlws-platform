/**
 * HOS strip core (Navigator milestone N6) — the permanent clock countdown
 * on the driving screen, doc 01 §4 / doc 05 §9. Pure: this module reuses
 * the trip-planner `hos-engine` UNCHANGED (the milestone's whole point)
 * and adds only display shaping and the 60-second advance wrapper; time
 * arrives as arguments, never from a clock read.
 *
 * Voice escalation on threshold crossings is N7 — here escalation is
 * visual state only, exposed as ordered severity levels the warning line
 * renders as text.
 */

import { advance, remainingClocks } from '@/lib/trip-planner/hos-engine';
import type { ClockState, DutyStatus, RemainingClocks } from '@/lib/trip-planner/types';

/** Doc 05 §9: the HOS advance loop runs every 60 seconds. */
export const HOS_TICK_MS = 60_000;

export type HosSeverity = 'none' | 'notice' | 'warning' | 'critical';

export type HosWarning = {
  severity: HosSeverity;
  /** Plain-language line, e.g. "Break required in 1:48". Null when calm. */
  text: string | null;
  /** Which clock is binding: 'break' | 'driving' | 'window' | 'cycle'. */
  clock: 'break' | 'driving' | 'window' | 'cycle' | null;
};

export type HosStripView = {
  driveText: string; // "6:42"
  windowText: string; // "9:15"
  /** 0..1 fraction of the driving clock remaining, for the text-labeled bar. */
  driveFraction: number;
  windowFraction: number;
  warning: HosWarning;
  remaining: RemainingClocks;
};

export const NOTICE_MIN = 60;
export const WARNING_MIN = 30;
export const CRITICAL_MIN = 15;

/** Minutes → "h:mm" (never negative; 90 → "1:30", 45 → "0:45"). */
export function formatHM(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * The shipped escalation thresholds, as one function. Exported so the
 * compact driving strip (hos-compact.ts) can dress its cells with the
 * SAME severity the warning line and the voice announcer already use —
 * a second copy of these numbers is exactly how a strip ends up
 * disagreeing with the voice that warned about it.
 */
export function clockSeverity(minutes: number): HosSeverity {
  if (minutes <= CRITICAL_MIN) return 'critical';
  if (minutes <= WARNING_MIN) return 'warning';
  if (minutes <= NOTICE_MIN) return 'notice';
  return 'none';
}

const severityFor = clockSeverity;

/**
 * The single binding warning: whichever clock runs out FIRST decides the
 * line, and the line escalates as that clock shrinks. Overdue states say
 * so plainly instead of showing negative time.
 */
export function hosWarning(remaining: RemainingClocks): HosWarning {
  const candidates: {
    clock: HosWarning['clock'];
    minutes: number;
    label: string;
    overdue: string;
  }[] = [
    {
      clock: 'break',
      minutes: remaining.untilBreakMin,
      label: 'Break required in',
      overdue: 'Break required now',
    },
    {
      clock: 'driving',
      minutes: remaining.drivingMin,
      label: 'Driving limit in',
      overdue: 'Driving limit reached',
    },
    {
      clock: 'window',
      minutes: remaining.windowMin,
      label: 'On-duty window ends in',
      overdue: 'On-duty window ended',
    },
    {
      clock: 'cycle',
      minutes: remaining.cycleMin,
      label: 'Cycle limit in',
      overdue: 'Cycle limit reached',
    },
  ];
  candidates.sort((a, b) => a.minutes - b.minutes);
  const binding = candidates[0];
  const severity = severityFor(binding.minutes);
  if (severity === 'none') return { severity, text: null, clock: null };
  const text =
    binding.minutes <= 0 ? binding.overdue : `${binding.label} ${formatHM(binding.minutes)}`;
  return { severity, text, clock: binding.clock };
}

/** Shape one ClockState into everything the strip renders. */
export function hosStripView(state: ClockState): HosStripView {
  const remaining = remainingClocks(state);
  return {
    driveText: formatHM(remaining.drivingMin),
    windowText: formatHM(remaining.windowMin),
    driveFraction: Math.min(1, Math.max(0, remaining.drivingMin / 660)),
    windowFraction: Math.min(1, Math.max(0, remaining.windowMin / 840)),
    warning: hosWarning(remaining),
    remaining,
  };
}

/**
 * One 60-second tick of the doc 05 §9 loop:
 *   clockState = advance(clockState, dutyStatus, elapsedMin)
 * Violations returned by the engine are advisory here (the strip's overdue
 * text is the display); nothing is recorded or transmitted.
 */
export function tickClocks(
  state: ClockState,
  elapsedMin: number,
  dutyStatus: DutyStatus,
): ClockState {
  if (elapsedMin <= 0 || !Number.isFinite(elapsedMin)) return state;
  return advance(state, dutyStatus, elapsedMin).state;
}
