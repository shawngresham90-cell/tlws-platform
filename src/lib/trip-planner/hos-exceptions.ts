import { HOS, type ClockState, type CycleRule } from './types';
import { cycleUsedMin } from './hos-engine';

/**
 * HOS exception architecture (30-hour-window Milestone A). Explicit, typed
 * handling for the 49 CFR 395 provisions the planning engine does NOT yet
 * implement, plus a real recap projection (which IS computable from the
 * engine's existing day buckets).
 *
 * Design rule: unsupported provisions are surfaced as data, never silence.
 * Every assessment returns a discriminated union a caller can branch on; the
 * unsupported arm carries the regulatory citation and the CONSERVATIVE
 * guidance (what the planner assumes instead, which is always at least as
 * strict as the real rule). When a provision is implemented later, only the
 * function body changes — call sites keep working.
 *
 * PLANNING MODE ONLY. This module, like the engine, is not an ELD, produces
 * no record of duty status, and must never be represented as one.
 */

/* --------------------------------------------------------------- manifest */

export type HosCapability = {
  rule: string;
  citation: string;
  status: 'implemented' | 'unsupported';
  /** For unsupported rules: what the engine conservatively assumes. */
  conservativeAssumption?: string;
};

/**
 * The engine's regulatory surface, in one auditable place. "implemented"
 * entries are enforced by `advance`/`planDrive`; "unsupported" entries are
 * modeled conservatively (never more permissive than the real regulation).
 */
export const HOS_CAPABILITIES: readonly HosCapability[] = [
  { rule: '11-hour driving limit', citation: '49 CFR 395.3(a)(3)(i)', status: 'implemented' },
  {
    rule: '14-hour driving window (wall-clock, not paused by breaks)',
    citation: '49 CFR 395.3(a)(2)',
    status: 'implemented',
  },
  {
    rule: '30-minute break after 8 cumulative driving hours (any ≥30-min non-driving period, 2020 rule)',
    citation: '49 CFR 395.3(a)(3)(ii)',
    status: 'implemented',
  },
  {
    rule: '10-hour off-duty reset of the 11/14 clocks',
    citation: '49 CFR 395.3(a)(1)',
    status: 'implemented',
  },
  {
    rule: '60-hr/7-day and 70-hr/8-day rolling on-duty cycles',
    citation: '49 CFR 395.3(b)',
    status: 'implemented',
  },
  { rule: '34-hour restart', citation: '49 CFR 395.3(c)', status: 'implemented' },
  {
    rule: 'Cycle recap projection (hours regained as days roll off)',
    citation: '49 CFR 395.3(b) (arithmetic consequence of the rolling window)',
    status: 'implemented',
  },
  {
    rule: 'Split sleeper berth pairing (7/3 and 8/2)',
    citation: '49 CFR 395.1(g)(1)',
    status: 'unsupported',
    conservativeAssumption:
      'Only a full ≥10-hour rest resets the 11/14 clocks; qualifying rest pairs are treated as ordinary off-duty time (stricter than the regulation).',
  },
  {
    rule: 'Adverse driving conditions exception (+2 driving hours)',
    citation: '49 CFR 395.1(b)(1)',
    status: 'unsupported',
    conservativeAssumption:
      'No extension is ever granted; plans always fit inside the unextended 11/14 clocks.',
  },
  {
    rule: 'Short-haul exception (150 air-mile radius)',
    citation: '49 CFR 395.1(e)(1)',
    status: 'unsupported',
    conservativeAssumption:
      'All drivers are planned under the full property-carrying rules, including the 30-minute break.',
  },
] as const;

/* ------------------------------------------------- assessment result types */

export type ExceptionAssessment<TApplied> =
  | ({ supported: true } & TApplied)
  | {
      supported: false;
      rule: string;
      citation: string;
      reason: string;
      conservativeGuidance: string;
    };

/* ---------------------------------------------------------- split sleeper */

export type SplitSleeperCandidate = {
  /** Minutes of the period spent IN the sleeper berth (must be ≥7 consecutive hours to qualify). */
  sleeperPeriodMin: number;
  /** Minutes of the paired rest period (sleeper or off-duty; ≥2h to qualify). */
  otherRestMin: number;
};

/**
 * §395.1(g) split-sleeper pairing — ARCHITECTURE STUB. Reports whether the
 * candidate pair has the qualifying SHAPE — the regulation requires the
 * ≥7-consecutive-hour period to be in the sleeper berth (NOT merely the
 * longer period), paired with ≥2 hours of rest, totalling ≥10 hours — then
 * declines: the window-recalculation semantics (excluding the qualifying
 * periods from the 14-hour window) are not implemented, and a wrong
 * implementation is worse for a driver than a conservative one.
 */
export function assessSplitSleeper(
  candidate: SplitSleeperCandidate,
): ExceptionAssessment<{ pairedWindowMin: number }> {
  const shapeQualifies =
    candidate.sleeperPeriodMin >= 7 * 60 &&
    candidate.otherRestMin >= 2 * 60 &&
    candidate.sleeperPeriodMin + candidate.otherRestMin >= 10 * 60;
  return {
    supported: false,
    rule: 'split-sleeper',
    citation: '49 CFR 395.1(g)(1)',
    reason: shapeQualifies
      ? 'pair shape qualifies (≥7h sleeper berth + ≥2h rest, ≥10h combined) but window-pause recalculation is not implemented'
      : 'pair does not meet the qualifying shape (≥7 consecutive hours in the sleeper berth paired with ≥2 hours rest, ≥10 hours combined)',
    conservativeGuidance:
      'Plan with full ≥10-hour resets only; treat both periods as ordinary off-duty time.',
  };
}

/* -------------------------------------------------------- adverse driving */

export type AdverseDrivingClaim = {
  /** Free-text description of the unforeseen condition (weather, crash…). */
  condition: string;
  /** Was the condition known (or forecastable) before dispatch? */
  knownBeforeDispatch: boolean;
};

/**
 * §395.1(b)(1) adverse driving conditions — ARCHITECTURE STUB. The exception
 * extends driving (and, since 2020, the window) by up to 2 hours ONLY for
 * conditions not known at dispatch; that judgment is inherently human, so the
 * planner never grants it automatically.
 */
export function assessAdverseDriving(
  claim: AdverseDrivingClaim,
): ExceptionAssessment<{ extraDrivingMin: number }> {
  return {
    supported: false,
    rule: 'adverse-driving',
    citation: '49 CFR 395.1(b)(1)',
    reason: claim.knownBeforeDispatch
      ? 'condition was known before dispatch — the exception cannot apply'
      : 'eligibility is a human/dispatch judgment; the planner never self-grants the +2h extension',
    conservativeGuidance: 'Plan inside the unextended 11-hour and 14-hour clocks.',
  };
}

/* ------------------------------------------------------------- short haul */

export type ShortHaulProfile = {
  /** Great-circle radius of the operation from the work-reporting location. */
  airMileRadius: number;
  /** Does the driver return to the work-reporting location each shift? */
  returnsToWorkLocation: boolean;
};

/**
 * §395.1(e)(1) short-haul (150 air-mile) exception — ARCHITECTURE STUB.
 * Exempts qualifying drivers from the 30-minute break and RODS requirements.
 * Determining eligibility needs operational facts the planner doesn't hold,
 * so it always plans under the full rules (which is stricter, never illegal).
 */
export function assessShortHaul(
  profile: ShortHaulProfile,
): ExceptionAssessment<{ breakExempt: boolean }> {
  const shapeQualifies = profile.airMileRadius <= 150 && profile.returnsToWorkLocation;
  return {
    supported: false,
    rule: 'short-haul',
    citation: '49 CFR 395.1(e)(1)',
    reason: shapeQualifies
      ? 'operation shape may qualify, but eligibility depends on records the planner does not hold'
      : 'operation exceeds the 150 air-mile radius or does not return to the work-reporting location',
    conservativeGuidance:
      'Plan under the full property-carrying rules including the 30-minute break.',
  };
}

/* ---------------------------------------------------------------- recaps */

export type RecapDay = {
  /** 1 = tomorrow (start of the next day bucket), 2 = the day after, … */
  dayOffset: number;
  /** On-duty minutes rolling OFF the cycle window at the start of that day. */
  minutesRollingOff: number;
  /** Projected cycle minutes available at the start of that day. */
  projectedAvailableMin: number;
};

/**
 * Cycle recap projection — IMPLEMENTED. Given today's day buckets, project
 * how many on-duty minutes roll off the rolling 7/8-day window at the start
 * of each of the next `days` days, assuming NO further on-duty time. This is
 * pure arithmetic over §395.3(b)'s rolling window — the classic "hours I get
 * back tomorrow" recap drivers plan around.
 */
export function recapProjection(state: ClockState, days = 7): RecapDay[] {
  const rule: CycleRule = state.cycleRule;
  const windowDays = rule === '60/7' ? 7 : 8;
  const capMin = rule === '60/7' ? HOS.CYCLE_60_MIN : HOS.CYCLE_70_MIN;

  const out: RecapDay[] = [];
  // Project day-by-day: appending a zero bucket per future day; the window is
  // always the trailing `windowDays` buckets. The minutes rolling off at day k
  // are the DEPARTING bucket itself (pre-push index len-windowDays) — NOT the
  // availability delta, which under-reports whenever usage exceeds the cap
  // (clamped availability absorbs part of the roll-off).
  const buckets = [...state.onDutyByDayMin];
  for (let k = 1; k <= Math.max(0, Math.min(days, 14)); k++) {
    const departing = buckets.length >= windowDays ? buckets[buckets.length - windowDays] : 0;
    buckets.push(0);
    const used = buckets.slice(-windowDays).reduce((s, m) => s + m, 0);
    const available = Math.max(0, capMin - used);
    out.push({
      dayOffset: k,
      minutesRollingOff: departing,
      projectedAvailableMin: available,
    });
  }
  return out;
}
