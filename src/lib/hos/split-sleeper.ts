import {
  HOS,
  SPLIT_LONG_MIN,
  SPLIT_SHORT_MIN,
  SPLIT_PAIR_TOTAL_MIN,
  type ClockSet,
  type LimitingClock,
  type QuickSplitInput,
  type RestStatus,
  type SplitEvaluation,
  type SplitFailure,
  type SplitResult,
} from './types';
import { formatHM, isValidMinutes } from './time';

/**
 * Split sleeper berth engine — 49 CFR 395.1(g)(1), property-carrying.
 * Pure, deterministic, integer minutes. NOT an ELD; planning and education
 * only. Fail-closed: invalid input refuses, it never guesses.
 *
 * The rule, as implemented (ledger `docs/compliance/split-sleeper-rule-ledger.md`):
 * - R5/R11: the required 10 hours off duty may be split into one period of
 *   at least 7 CONSECUTIVE hours IN THE SLEEPER BERTH plus a second period
 *   of at least 2 consecutive hours off duty, sleeper, or combination,
 *   totaling at least 10 hours. Neither qualifying period counts against
 *   the 14-hour driving window when properly paired.
 *   Sources: eCFR §395.1(g)(1); FMCSA "What rest periods qualify for the
 *   split sleeper berth provision?"
 * - R7: order does not matter (7/3, 3/7, 8/2, 2/8, 7.5/2.5 …). The engine
 *   derives qualification from the tests, never from a hard-coded list.
 * - R6: on qualification, the 11-hour and 14-hour calculations restart from
 *   the END OF THE FIRST of the two qualifying periods. Implemented under
 *   the owner's 2026-07-28 authorization; human eCFR click-through row
 *   remains open in the ledger.
 * - R8: pairing NEVER adds 60/70-cycle time.
 * - R10: a completed qualifying period (≥2 h) also satisfies the 30-minute
 *   break requirement (§395.3(a)(3)(ii), 2020 rule).
 * - R13: 6/4 and 5/5 are refused — not authorized for ordinary
 *   property-carrying drivers (FMCSA pilot enrollment ≠ general authority).
 */

const cycleCap = (rule: '60/7' | '70/8'): number =>
  rule === '60/7' ? HOS.CYCLE_60_MIN : HOS.CYCLE_70_MIN;

/**
 * §395.1(g)(1) qualification tests for two single-status rest periods.
 * Order-agnostic: which period came first never affects qualification.
 */
export function evaluatePair(
  firstMin: number,
  firstStatus: RestStatus,
  secondMin: number,
  secondStatus: RestStatus,
): SplitEvaluation {
  const failures: SplitFailure[] = [];

  const firstIsLong = firstStatus === 'sleeper' && firstMin >= SPLIT_LONG_MIN;
  const secondIsLong = secondStatus === 'sleeper' && secondMin >= SPLIT_LONG_MIN;

  if (!firstIsLong && !secondIsLong) {
    // Say exactly why: long-enough but wrong status, or simply too short.
    const longer = Math.max(firstMin, secondMin);
    const longerStatus = firstMin >= secondMin ? firstStatus : secondStatus;
    if (longer >= SPLIT_LONG_MIN && longerStatus !== 'sleeper') {
      failures.push({
        code: 'long-period-not-sleeper',
        message: `Your ${formatHM(longer)} period is off duty, not sleeper berth. The long half of a split must be at least 7 consecutive hours IN THE SLEEPER BERTH — off-duty time does not qualify as the long half.`,
      });
    } else {
      failures.push({
        code: 'no-long-sleeper-period',
        message: `Your longer period is ${formatHM(longer)}. The long half of a split must be at least 7:00 consecutive hours in the sleeper berth. 6/4 and 5/5 splits are NOT authorized for property-carrying drivers under the current federal rule.`,
      });
    }
    return { qualifies: false, failures };
  }

  // Exactly which period is the long sleeper half; the other must pass the short test.
  const longMin = firstIsLong ? firstMin : secondMin;
  const shortMin = firstIsLong ? secondMin : firstMin;
  const shortStatus = firstIsLong ? secondStatus : firstStatus;

  if (shortMin < SPLIT_SHORT_MIN) {
    failures.push({
      code: 'short-period-too-short',
      message: `Your shorter period is only ${formatHM(shortMin)}. The short half must be at least 2:00 consecutive hours off duty, in the sleeper berth, or a combination of the two.`,
    });
  }
  if (longMin + shortMin < SPLIT_PAIR_TOTAL_MIN) {
    failures.push({
      code: 'pair-total-under-10',
      message: `These two periods total ${formatHM(longMin + shortMin)}. A qualifying split needs at least 10:00 combined — you're ${formatHM(SPLIT_PAIR_TOTAL_MIN - longMin - shortMin)} short.`,
    });
  }

  if (failures.length > 0) return { qualifies: false, failures };
  return {
    qualifies: true,
    failures: [],
    longPeriod: { minutes: longMin, status: 'sleeper' },
    shortPeriod: { minutes: shortMin, status: shortStatus },
    pairTotalMin: longMin + shortMin,
  };
}

function limitingOf(clocks: ClockSet): { limiting: LimitingClock; usable: number } {
  const entries: [LimitingClock, number][] = [
    ['DRIVE', clocks.driveMin],
    ['14-HR WINDOW', clocks.windowMin],
    ['CYCLE', clocks.cycleMin],
    ['30-MIN BREAK', clocks.untilBreakMin],
  ];
  entries.sort((a, b) => a[1] - b[1]);
  return { limiting: entries[0][0], usable: Math.max(0, entries[0][1]) };
}

/**
 * Quick-mode calculation: first rest → work between → second rest.
 * Returns the clocks as they stand at the END of the second rest period.
 */
export function calculateQuickSplit(input: QuickSplitInput): SplitResult {
  const problems: string[] = [];
  const fields: Array<[string, number]> = [
    ['first rest', input.firstRestMin],
    ['second rest', input.secondRestMin],
    ['driving between', input.drivingBetweenMin],
    ['on duty between', input.onDutyBetweenMin],
    ['other time between', input.otherBetweenMin],
    ['cycle used', input.cycleUsedMin],
    ['driving before', input.drivingBeforeMin ?? 0],
    ['on duty before', input.onDutyBeforeMin ?? 0],
  ];
  for (const [label, v] of fields) {
    if (!isValidMinutes(v)) problems.push(`"${label}" must be a whole number of minutes ≥ 0`);
  }
  if (input.cycleRule !== '60/7' && input.cycleRule !== '70/8') {
    problems.push('cycle rule must be 60/7 or 70/8');
  }
  if (problems.length > 0) {
    return {
      ok: false,
      inputProblems: problems,
      split: { qualifies: false, failures: [] },
      clocks: null,
      violations: [],
      warnings: [],
      limiting: null,
      usableDriveMin: 0,
      legalToDrive: false,
      compliancePoint: null,
      gains: null,
      explanation: ['NOT ENOUGH INFORMATION', ...problems],
    };
  }

  const cap = cycleCap(input.cycleRule);
  const betweenOnDutyMin = input.drivingBetweenMin + input.onDutyBetweenMin;
  const betweenTotalMin = betweenOnDutyMin + input.otherBetweenMin;

  // ≥10 h in EITHER period → that is a full daily reset, not a split.
  if (input.firstRestMin >= HOS.MIN_RESET_MIN || input.secondRestMin >= HOS.MIN_RESET_MIN) {
    // Clocks are fresh from the end of the ≥10-h period. Cycle is NOT reset.
    const cycleMin = Math.max(0, cap - (input.cycleUsedMin + betweenOnDutyMin));
    const clocks: ClockSet = {
      driveMin: HOS.MAX_DRIVING_MIN,
      windowMin: HOS.MAX_WINDOW_MIN,
      cycleMin,
      untilBreakMin: HOS.BREAK_AFTER_DRIVING_MIN,
    };
    // If the SECOND period is the reset, everything between is behind the
    // reset and the clocks are simply fresh. If only the FIRST is the reset,
    // work after it has consumed clock time.
    const secondIsReset = input.secondRestMin >= HOS.MIN_RESET_MIN;
    if (!secondIsReset) {
      clocks.driveMin = Math.max(0, HOS.MAX_DRIVING_MIN - input.drivingBetweenMin);
      // The second rest is < 10 h here, so the window keeps running through it.
      clocks.windowMin = Math.max(0, HOS.MAX_WINDOW_MIN - (betweenTotalMin + input.secondRestMin));
      clocks.untilBreakMin =
        input.secondRestMin >= HOS.MIN_BREAK_MIN
          ? HOS.BREAK_AFTER_DRIVING_MIN
          : Math.max(0, HOS.BREAK_AFTER_DRIVING_MIN - input.drivingBetweenMin);
    }
    const { limiting, usable } = limitingOf(clocks);
    const violations: string[] = [];
    if (!secondIsReset && input.drivingBetweenMin > HOS.MAX_DRIVING_MIN) {
      violations.push(
        `You drove ${formatHM(input.drivingBetweenMin)} after the reset — over the 11:00 limit. That violation already occurred.`,
      );
    }
    return {
      ok: true,
      fullReset: true,
      split: { qualifies: false, failures: [] },
      clocks,
      violations,
      warnings: [],
      limiting,
      usableDriveMin: usable,
      legalToDrive: violations.length === 0 && usable > 0,
      compliancePoint: 'end-of-reset',
      gains: null,
      explanation: [
        'FULL 10-HOUR RESET — NOT A SPLIT',
        `A period of ${formatHM(Math.max(input.firstRestMin, input.secondRestMin))} is 10+ consecutive hours off duty / sleeper. You get a fresh 11:00 drive clock and 14:00 window from the end of that period (49 CFR 395.3(a)).`,
        'The 60/70-hour cycle is NOT reset by 10 hours off — only 34 consecutive hours off duty restarts the cycle (49 CFR 395.3(c)).',
      ],
    };
  }

  // §395.1(g)(1) qualification.
  const split = evaluatePair(
    input.firstRestMin,
    input.firstRestStatus,
    input.secondRestMin,
    input.secondRestStatus,
  );
  if (!split.qualifies) {
    return {
      ok: true,
      split,
      clocks: null,
      violations: [],
      warnings: [],
      limiting: null,
      usableDriveMin: 0,
      legalToDrive: false,
      compliancePoint: null,
      gains: null,
      explanation: ['INVALID SPLIT', ...split.failures.map((f) => f.message)],
    };
  }

  // R6: clocks recalculate from the END of the FIRST qualifying period.
  // Both qualifying periods are excluded from the 14-hour window; everything
  // between them counts against it, and the driving counts against the 11.
  const violations: string[] = [];
  if (input.drivingBetweenMin > HOS.MAX_DRIVING_MIN) {
    violations.push(
      `You drove ${formatHM(input.drivingBetweenMin)} between the two periods — over the 11:00 driving limit. That violation already occurred; a split cannot repair it.`,
    );
  }
  if (betweenTotalMin > HOS.MAX_WINDOW_MIN) {
    violations.push(
      `The time between the two periods (${formatHM(betweenTotalMin)}) exceeds the 14-hour window. Driving at the end of that stretch was a violation; a split cannot repair it.`,
    );
  }

  const clocks: ClockSet = {
    driveMin: Math.max(0, HOS.MAX_DRIVING_MIN - input.drivingBetweenMin),
    windowMin: Math.max(0, HOS.MAX_WINDOW_MIN - betweenTotalMin),
    // R8: the split adds no cycle time; driving + on-duty between the
    // periods accrue against the cycle as normal on-duty time.
    cycleMin: Math.max(0, cap - (input.cycleUsedMin + betweenOnDutyMin)),
    // R10: the completed second period (≥2 h) satisfies the 30-minute break.
    untilBreakMin: HOS.BREAK_AFTER_DRIVING_MIN,
  };
  const { limiting, usable } = limitingOf(clocks);

  // Comparison vs NOT pairing: both rests and all pre-first work count
  // against a window that started at the last reset.
  const preDrive = input.drivingBeforeMin ?? 0;
  const preOnDuty = input.onDutyBeforeMin ?? 0;
  const baseDriveMin = Math.max(0, HOS.MAX_DRIVING_MIN - (preDrive + input.drivingBetweenMin));
  const baseWindowMin = Math.max(
    0,
    HOS.MAX_WINDOW_MIN -
      (preDrive + preOnDuty + input.firstRestMin + betweenTotalMin + input.secondRestMin),
  );
  const gains = {
    driveMin: Math.max(0, clocks.driveMin - baseDriveMin),
    windowMin: Math.max(0, clocks.windowMin - baseWindowMin),
    baseDriveMin,
    baseWindowMin,
  };

  const longLabel = `${formatHM(split.longPeriod!.minutes)} SLEEPER`;
  const shortLabel = `${formatHM(split.shortPeriod!.minutes)} ${
    split.shortPeriod!.status === 'sleeper' ? 'SLEEPER' : 'OFF DUTY'
  }`;
  const firstIsLong = input.firstRestStatus === 'sleeper' && input.firstRestMin >= SPLIT_LONG_MIN;

  return {
    ok: true,
    split,
    clocks,
    violations,
    warnings: [],
    limiting,
    usableDriveMin: usable,
    legalToDrive: violations.length === 0 && usable > 0,
    compliancePoint: 'end-of-first-qualifying-period',
    gains,
    explanation: [
      'VALID SPLIT',
      `${firstIsLong ? longLabel : shortLabel}  +  ${firstIsLong ? shortLabel : longLabel}  =  ${formatHM(split.pairTotalMin!)} qualifying rest (49 CFR 395.1(g)(1)).`,
      'Compliance point: END of the FIRST qualifying period — not the second.',
      `Between the two halves you drove ${formatHM(input.drivingBetweenMin)} and worked ${formatHM(input.onDutyBetweenMin)} on duty${input.otherBetweenMin ? ` plus ${formatHM(input.otherBetweenMin)} other non-qualifying time` : ''}. That ${formatHM(betweenTotalMin)} counts against your 14-hour window, and the driving counts against your 11.`,
      'Both qualifying rest periods are excluded from the 14-hour window calculation.',
      'Your 2+ hour rest also satisfied the 30-minute break requirement — 8:00 of driving available before the next break (49 CFR 395.3(a)(3)(ii)).',
      `TIME YOU GOT BACK: +${formatHM(gains.driveMin)} drive and +${formatHM(gains.windowMin)} window versus not pairing. Without the split you would have ${formatHM(gains.baseDriveMin)} drive / ${formatHM(gains.baseWindowMin)} window right now.`,
      'Completing the second period does NOT hand you a fresh 11 hours — the clocks recalculate from the end of the first qualifying period. The 60/70 cycle gains nothing from a split.',
    ],
  };
}
