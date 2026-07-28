import { HOS } from '@/lib/trip-planner/types';

/**
 * HOS Calculator types — property-carrying drivers, 49 CFR 395.3 +
 * 395.1(g). Everything is MINUTES (integers). No floating-point decimal
 * hours anywhere in the engine (7 h 30 min = 450, never 7.5).
 *
 * Single source of truth for the regulatory constants is the platform's
 * one verified HOS engine (`src/lib/trip-planner/types.ts` `HOS`,
 * verification record `docs/compliance/hos-verification.md`). This module
 * re-exports it; it never redefines a limit (Owner Decision 8: one engine,
 * no second arithmetic).
 *
 * Official sources (see docs/compliance/split-sleeper-rule-ledger.md):
 * - 49 CFR 395.3   https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-395/subpart-A/section-395.3
 * - 49 CFR 395.1(g) https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-395/subpart-A/section-395.1
 * - FMCSA split-sleeper FAQs:
 *   https://www.fmcsa.dot.gov/regulations/hours-service/what-rest-periods-qualify-split-sleeper-berth-provision
 *   https://www.fmcsa.dot.gov/regulations/hours-service/how-are-split-sleeper-berth-rest-periods-used-determining-compliance-14
 */
export { HOS };

/** §395.1(g)(1): the long half must be ≥7 consecutive hours IN THE SLEEPER BERTH. */
export const SPLIT_LONG_MIN = 7 * 60;
/** §395.1(g)(1): the short half must be ≥2 consecutive hours off duty / sleeper / combination. */
export const SPLIT_SHORT_MIN = 2 * 60;
/** §395.1(g)(1): the two qualifying periods must total ≥10 hours. */
export const SPLIT_PAIR_TOTAL_MIN = 10 * 60;

export type DutyStatus = 'driving' | 'on-duty' | 'sleeper' | 'off-duty';
export type RestStatus = 'sleeper' | 'off-duty';
export type CycleRule = '60/7' | '70/8';

/** One timeline event. Absolute minutes from the timeline's own zero. */
export type TimelineEvent = {
  status: DutyStatus;
  /** Inclusive start, minutes. */
  startMin: number;
  /** Exclusive end, minutes. Must be > startMin. */
  endMin: number;
};

/** A maximal run of consecutive rest (off-duty and/or sleeper) events. */
export type RestBlock = {
  startMin: number;
  endMin: number;
  /** Whole-block length (all minutes are off-duty or sleeper). */
  totalMin: number;
  /** Longest run of consecutive sleeper-berth minutes inside the block. */
  maxConsecutiveSleeperMin: number;
  /** ≥7 h consecutive sleeper — can serve as the LONG half (R11). */
  qualifiesLong: boolean;
  /** ≥2 h consecutive rest — can serve as the SHORT half. */
  qualifiesShort: boolean;
  /** ≥10 h — a full reset, not a split half. */
  isReset: boolean;
  /** ≥34 h — restarts the 60/70 cycle. */
  isRestart: boolean;
};

export type ClockSet = {
  /** Remaining minutes on the 11-hour driving clock. */
  driveMin: number;
  /** Remaining minutes in the 14-hour driving window. */
  windowMin: number;
  /** Remaining minutes on the 60/70-hour cycle. */
  cycleMin: number;
  /** Driving minutes available before a 30-minute break is required. */
  untilBreakMin: number;
};

export type LimitingClock = 'DRIVE' | '14-HR WINDOW' | 'CYCLE' | '30-MIN BREAK';

/** Why a proposed split does not qualify — every reason names the exact shortfall. */
export type SplitFailure = {
  code:
    | 'no-long-sleeper-period'
    | 'short-period-too-short'
    | 'pair-total-under-10'
    | 'long-period-not-sleeper'
    | 'not-authorized-pattern';
  message: string;
};

export type SplitEvaluation = {
  /** True only when every §395.1(g)(1) test passes. */
  qualifies: boolean;
  failures: SplitFailure[];
  /** Which period is the ≥7-h sleeper half (when qualifying). */
  longPeriod?: { minutes: number; status: 'sleeper' };
  shortPeriod?: { minutes: number; status: RestStatus | 'combination' };
  /** Combined qualifying rest, minutes. */
  pairTotalMin?: number;
};

export type QuickSplitInput = {
  /** First rest period, minutes + where it was spent. */
  firstRestMin: number;
  firstRestStatus: RestStatus;
  /** Second rest period. */
  secondRestMin: number;
  secondRestStatus: RestStatus;
  /** Between the two periods: driving minutes. */
  drivingBetweenMin: number;
  /** Between the two periods: on-duty-not-driving minutes. */
  onDutyBetweenMin: number;
  /** Between the two periods: short (non-qualifying) off-duty/sleeper minutes. */
  otherBetweenMin: number;
  cycleRule: CycleRule;
  /** Cycle minutes already used before the first rest period began. */
  cycleUsedMin: number;
  /** Driving before the first rest (since the last 10-h reset) — for the gains comparison. */
  drivingBeforeMin?: number;
  /** On-duty-not-driving before the first rest — for the gains comparison. */
  onDutyBeforeMin?: number;
};

export type SplitResult = {
  ok: boolean;
  /** Input was rejected before any calculation (fail closed). */
  inputProblems?: string[];
  /** One of the two periods was ≥10 h — full reset, not a split. */
  fullReset?: boolean;
  split: SplitEvaluation;
  /** Clocks after completing the second period (or after the reset). Null when the pair fails. */
  clocks: ClockSet | null;
  /** Violations that already occurred between the paired periods. */
  violations: string[];
  warnings: string[];
  limiting: LimitingClock | null;
  /** min of every clock — usable driving minutes right now. */
  usableDriveMin: number;
  /** No violations occurred and every clock is above zero. */
  legalToDrive: boolean;
  /** The recalculation point, as the rule defines it. */
  compliancePoint: 'end-of-first-qualifying-period' | 'end-of-reset' | null;
  /** Split vs no-split comparison (when computable). */
  gains: {
    driveMin: number;
    windowMin: number;
    baseDriveMin: number;
    baseWindowMin: number;
  } | null;
  /** Plain-language explanation lines, in display order. */
  explanation: string[];
};

export type TimelineResult = {
  ok: boolean;
  inputProblems?: string[];
  validSplit: boolean;
  /** The pairing chosen (fewest violations; see selectPairing). */
  pair: { first: RestBlock; second: RestBlock; longIsFirst: boolean; pairTotalMin: number } | null;
  clocks: ClockSet | null;
  violations: string[];
  warnings: string[];
  limiting: LimitingClock | null;
  usableDriveMin: number;
  legalToDrive: boolean;
  compliancePoint: 'end-of-first-qualifying-period' | 'end-of-reset' | 'timeline-start' | null;
  /** Absolute minute of the compliance point on the timeline. */
  anchorMin: number | null;
  gains: {
    driveMin: number;
    windowMin: number;
    baseDriveMin: number;
    baseWindowMin: number;
  } | null;
  explanation: string[];
};
