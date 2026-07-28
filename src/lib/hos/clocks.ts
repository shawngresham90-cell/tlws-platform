import type { ClockSet, LimitingClock } from './types';
import { isValidMinutes } from './time';

/**
 * Current-clocks mode: the driver enters remaining time on each clock
 * (straight off the ELD) and the calculator names the limiting clock and
 * the usable driving time. No arithmetic against limits happens here — the
 * driver's ELD numbers are the truth; this only takes the minimum.
 */
export function currentClocks(remaining: ClockSet): {
  ok: boolean;
  inputProblems?: string[];
  limiting: LimitingClock | null;
  usableDriveMin: number;
  legalToDrive: boolean;
} {
  const problems: string[] = [];
  const fields: Array<[string, number]> = [
    ['11-hour drive clock', remaining.driveMin],
    ['14-hour window', remaining.windowMin],
    ['cycle', remaining.cycleMin],
    ['time until break required', remaining.untilBreakMin],
  ];
  for (const [label, v] of fields) {
    if (!isValidMinutes(v)) problems.push(`"${label}" must be a whole number of minutes ≥ 0`);
  }
  if (problems.length > 0) {
    return {
      ok: false,
      inputProblems: problems,
      limiting: null,
      usableDriveMin: 0,
      legalToDrive: false,
    };
  }
  const entries: [LimitingClock, number][] = [
    ['DRIVE', remaining.driveMin],
    ['14-HR WINDOW', remaining.windowMin],
    ['CYCLE', remaining.cycleMin],
    ['30-MIN BREAK', remaining.untilBreakMin],
  ];
  entries.sort((a, b) => a[1] - b[1]);
  const usable = Math.max(0, entries[0][1]);
  return {
    ok: true,
    limiting: entries[0][0],
    usableDriveMin: usable,
    legalToDrive: usable > 0,
  };
}
