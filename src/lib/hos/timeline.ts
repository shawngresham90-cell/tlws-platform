import {
  HOS,
  SPLIT_LONG_MIN,
  SPLIT_SHORT_MIN,
  SPLIT_PAIR_TOTAL_MIN,
  type ClockSet,
  type CycleRule,
  type LimitingClock,
  type RestBlock,
  type TimelineEvent,
  type TimelineResult,
} from './types';
import { formatHM } from './time';

/**
 * Timeline-mode HOS calculation — 49 CFR 395.3 + 395.1(g)(1). Pure,
 * deterministic, integer minutes, fail-closed (gaps and overlaps refuse:
 * the engine never guesses a missing duty status).
 *
 * Pairing selection follows FMCSA guidance (ledger R15): when more than one
 * pairing of rest periods is possible, use the pairing producing no
 * violations or the fewest violations. Documented deterministic tie-break:
 * (1) fewest violations, (2) most usable driving time remaining,
 * (3) latest anchor (most recent first-qualifying-period end).
 */

/** Validate the event list: contiguous, ordered, positive, no overlaps. */
export function validateTimeline(events: TimelineEvent[]): string[] {
  const problems: string[] = [];
  if (!Array.isArray(events) || events.length === 0) {
    return ['No duty events entered.'];
  }
  for (const [i, e] of events.entries()) {
    if (
      !Number.isFinite(e.startMin) ||
      !Number.isFinite(e.endMin) ||
      !Number.isInteger(e.startMin) ||
      !Number.isInteger(e.endMin)
    ) {
      problems.push(`Event ${i + 1}: start and end must be whole minutes.`);
      continue;
    }
    if (e.endMin <= e.startMin) {
      problems.push(`Event ${i + 1}: duration must be greater than zero.`);
    }
    if (i > 0) {
      const prev = events[i - 1];
      if (e.startMin < prev.endMin) {
        problems.push(
          `Events ${i} and ${i + 1} overlap — a timeline can't be in two duty statuses at once.`,
        );
      } else if (e.startMin > prev.endMin) {
        problems.push(
          `Gap between events ${i} and ${i + 1} — the engine will not guess a missing duty status. Enter the missing period.`,
        );
      }
    }
  }
  return problems;
}

/** Group consecutive off-duty/sleeper events into rest blocks. */
export function restBlocks(events: TimelineEvent[]): RestBlock[] {
  const blocks: RestBlock[] = [];
  let run: TimelineEvent[] = [];
  const flush = () => {
    if (run.length === 0) return;
    const startMin = run[0].startMin;
    const endMin = run[run.length - 1].endMin;
    let maxSB = 0;
    let curSB = 0;
    for (const e of run) {
      if (e.status === 'sleeper') {
        curSB += e.endMin - e.startMin;
        maxSB = Math.max(maxSB, curSB);
      } else {
        curSB = 0;
      }
    }
    const totalMin = endMin - startMin;
    blocks.push({
      startMin,
      endMin,
      totalMin,
      maxConsecutiveSleeperMin: maxSB,
      qualifiesLong: maxSB >= SPLIT_LONG_MIN,
      qualifiesShort: totalMin >= SPLIT_SHORT_MIN,
      isReset: totalMin >= HOS.MIN_RESET_MIN,
      isRestart: totalMin >= HOS.RESTART_MIN,
    });
    run = [];
  };
  for (const e of events) {
    if (e.status === 'off-duty' || e.status === 'sleeper') run.push(e);
    else flush();
  }
  flush();
  return blocks;
}

/** Sum minutes of the given statuses inside [fromMin, toMin). */
function minutesOf(
  events: TimelineEvent[],
  fromMin: number,
  toMin: number,
  statuses: TimelineEvent['status'][],
): number {
  let total = 0;
  for (const e of events) {
    if (!statuses.includes(e.status)) continue;
    const s = Math.max(e.startMin, fromMin);
    const t = Math.min(e.endMin, toMin);
    if (t > s) total += t - s;
  }
  return total;
}

type CandidatePairing = {
  first: RestBlock;
  second: RestBlock;
  longIsFirst: boolean;
  pairTotalMin: number;
  anchorMin: number;
  /** Qualifying-rest minutes excluded from the window after the anchor. */
  excludedMin: number;
};

/**
 * §395.1(g)(1) pairing test for two rest blocks in timeline order.
 * The long half is the ≥7-h consecutive-sleeper run; the short half is the
 * other block's full length (its minutes are all rest: off, sleeper, or a
 * contiguous combination — all allowed for the short half).
 */
function pairingsOf(a: RestBlock, b: RestBlock): CandidatePairing[] {
  const out: CandidatePairing[] = [];
  if (
    a.qualifiesLong &&
    b.qualifiesShort &&
    a.maxConsecutiveSleeperMin + b.totalMin >= SPLIT_PAIR_TOTAL_MIN
  ) {
    out.push({
      first: a,
      second: b,
      longIsFirst: true,
      pairTotalMin: a.maxConsecutiveSleeperMin + b.totalMin,
      anchorMin: a.endMin,
      excludedMin: b.totalMin,
    });
  }
  if (
    b.qualifiesLong &&
    a.qualifiesShort &&
    b.maxConsecutiveSleeperMin + a.totalMin >= SPLIT_PAIR_TOTAL_MIN
  ) {
    out.push({
      first: a,
      second: b,
      longIsFirst: false,
      pairTotalMin: b.maxConsecutiveSleeperMin + a.totalMin,
      anchorMin: a.endMin,
      excludedMin: b.totalMin,
    });
  }
  return out;
}

function clocksFrom(
  events: TimelineEvent[],
  anchorMin: number,
  endMin: number,
  excludedRestMin: number,
  cycleRule: CycleRule,
  cycleUsedBeforeMin: number,
): { clocks: ClockSet; drivingSinceAnchor: number; windowUsed: number; violations: string[] } {
  const cap = cycleRule === '60/7' ? HOS.CYCLE_60_MIN : HOS.CYCLE_70_MIN;
  const drivingSinceAnchor = minutesOf(events, anchorMin, endMin, ['driving']);
  const windowUsed = Math.max(0, endMin - anchorMin - excludedRestMin);

  // Break clock: driving since the end of the last ≥30-min non-driving run.
  let lastBreakEnd = events[0].startMin;
  let runStart: number | null = null;
  for (const e of events) {
    if (e.status === 'driving') {
      runStart = null;
    } else {
      if (runStart === null) runStart = e.startMin;
      if (e.endMin - runStart >= HOS.MIN_BREAK_MIN) lastBreakEnd = e.endMin;
    }
  }
  const drivingSinceBreak = minutesOf(events, lastBreakEnd, endMin, ['driving']);

  // Cycle: driver-entered base + all on-duty/driving in the timeline
  // (restart handling: a ≥34-h rest block zeroes what came before it).
  const restart = [...restBlocks(events)].reverse().find((b) => b.isRestart);
  const cycleFrom = restart ? restart.endMin : events[0].startMin;
  const cycleInTimeline = minutesOf(events, cycleFrom, endMin, ['driving', 'on-duty']);
  const cycleUsed = (restart ? 0 : cycleUsedBeforeMin) + cycleInTimeline;

  const violations: string[] = [];
  if (drivingSinceAnchor > HOS.MAX_DRIVING_MIN) {
    violations.push(
      `Driving since the compliance point is ${formatHM(drivingSinceAnchor)} — over the 11:00 limit. That violation already occurred.`,
    );
  }
  if (windowUsed > HOS.MAX_WINDOW_MIN) {
    violations.push(
      `The 14-hour window shows ${formatHM(windowUsed)} used — the window was exceeded.`,
    );
  }
  if (cycleUsed > cap) {
    violations.push(
      `Cycle shows ${formatHM(cycleUsed)} of ${formatHM(cap)} — the ${cycleRule} cycle is exceeded.`,
    );
  }

  return {
    clocks: {
      driveMin: Math.max(0, HOS.MAX_DRIVING_MIN - drivingSinceAnchor),
      windowMin: Math.max(0, HOS.MAX_WINDOW_MIN - windowUsed),
      cycleMin: Math.max(0, cap - cycleUsed),
      untilBreakMin: Math.max(0, HOS.BREAK_AFTER_DRIVING_MIN - drivingSinceBreak),
    },
    drivingSinceAnchor,
    windowUsed,
    violations,
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
 * Evaluate a duty timeline. `cycleUsedBeforeMin` is the driver-entered
 * cycle time already used before the timeline begins (0 when the timeline
 * covers the whole lookback).
 */
export function calculateTimeline(
  events: TimelineEvent[],
  cycleRule: CycleRule,
  cycleUsedBeforeMin = 0,
): TimelineResult {
  const problems = validateTimeline(events);
  if (problems.length === 0 && (!Number.isFinite(cycleUsedBeforeMin) || cycleUsedBeforeMin < 0)) {
    problems.push('Cycle time already used must be a number of minutes ≥ 0.');
  }
  if (problems.length > 0) {
    return {
      ok: false,
      inputProblems: problems,
      validSplit: false,
      pair: null,
      clocks: null,
      violations: [],
      warnings: [],
      limiting: null,
      usableDriveMin: 0,
      legalToDrive: false,
      compliancePoint: null,
      anchorMin: null,
      gains: null,
      explanation: ['NOT ENOUGH INFORMATION', ...problems],
    };
  }

  const endMin = events[events.length - 1].endMin;
  const blocks = restBlocks(events);
  const lastReset = [...blocks].reverse().find((b) => b.isReset && b.endMin <= endMin);
  const baselineAnchor = lastReset ? lastReset.endMin : events[0].startMin;
  const baselinePoint: TimelineResult['compliancePoint'] = lastReset
    ? 'end-of-reset'
    : 'timeline-start';

  // Candidate split pairings: rest blocks after the last reset, in order.
  const usable = blocks.filter((b) => !b.isReset && b.endMin > (lastReset?.endMin ?? -1));
  const candidates: CandidatePairing[] = [];
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      candidates.push(...pairingsOf(usable[i], usable[j]));
    }
  }

  // Baseline (no split): clocks from the last reset / timeline start.
  const baseline = clocksFrom(events, baselineAnchor, endMin, 0, cycleRule, cycleUsedBeforeMin);

  // R15: choose the pairing with fewest violations; tie-break by most
  // usable driving, then latest anchor. Deterministic.
  let best: { c: CandidatePairing; r: ReturnType<typeof clocksFrom> } | null = null;
  for (const c of candidates) {
    const r = clocksFrom(events, c.anchorMin, endMin, c.excludedMin, cycleRule, cycleUsedBeforeMin);
    if (!best) {
      best = { c, r };
      continue;
    }
    const a = { v: r.violations.length, u: limitingOf(r.clocks).usable, m: c.anchorMin };
    const b = {
      v: best.r.violations.length,
      u: limitingOf(best.r.clocks).usable,
      m: best.c.anchorMin,
    };
    if (a.v < b.v || (a.v === b.v && (a.u > b.u || (a.u === b.u && a.m > b.m)))) {
      best = { c, r };
    }
  }

  const warnings: string[] = [];
  const lookbackMin = (cycleRule === '60/7' ? 7 : 8) * HOS.DAY_MIN;
  const hasRestart = blocks.some((b) => b.isRestart);
  if (!hasRestart && endMin - events[0].startMin < lookbackMin && cycleUsedBeforeMin === 0) {
    warnings.push(
      `The timeline doesn't cover the full ${cycleRule} lookback and shows no 34-hour restart — the cycle assumes 0 prior on-duty hours unless you enter cycle time already used.`,
    );
  }

  const chosen = best;
  const result = chosen ? chosen.r : baseline;
  const { limiting, usable: usableDrive } = limitingOf(result.clocks);

  const gains = chosen
    ? {
        driveMin: Math.max(0, result.clocks.driveMin - baseline.clocks.driveMin),
        windowMin: Math.max(0, result.clocks.windowMin - baseline.clocks.windowMin),
        baseDriveMin: baseline.clocks.driveMin,
        baseWindowMin: baseline.clocks.windowMin,
      }
    : null;

  const explanation: string[] = [];
  if (chosen) {
    const longM = chosen.c.longIsFirst
      ? chosen.c.first.maxConsecutiveSleeperMin
      : chosen.c.second.maxConsecutiveSleeperMin;
    const shortM = chosen.c.longIsFirst ? chosen.c.second.totalMin : chosen.c.first.totalMin;
    explanation.push(
      'VALID SPLIT',
      `${formatHM(chosen.c.longIsFirst ? longM : shortM)} ${chosen.c.longIsFirst ? 'SLEEPER' : 'REST'}  +  ${formatHM(chosen.c.longIsFirst ? shortM : longM)} ${chosen.c.longIsFirst ? 'REST' : 'SLEEPER'}  =  ${formatHM(chosen.c.pairTotalMin)} qualifying rest (49 CFR 395.1(g)(1)).`,
      'Compliance point: END of the FIRST qualifying period.',
      `Qualifying rest of ${formatHM(chosen.c.excludedMin)} after that point is excluded from the 14-hour window.`,
    );
    if (candidates.length > 1) {
      explanation.push(
        `${candidates.length} possible pairings were evaluated; this one produces the fewest violations (FMCSA pairing guidance).`,
      );
    }
  } else {
    explanation.push(
      baselinePoint === 'end-of-reset'
        ? 'NO ACTIVE SPLIT — clocks run from the end of your last 10+ hour reset.'
        : 'NO VALID SPLIT FOUND — clocks run from the start of the timeline.',
    );
  }
  explanation.push(
    `Driving used since the compliance point: ${formatHM(result.drivingSinceAnchor)} of 11:00.`,
    `14-hour window used: ${formatHM(result.windowUsed)} of 14:00.`,
    `Driving since your last 30-minute break: ${formatHM(HOS.BREAK_AFTER_DRIVING_MIN - result.clocks.untilBreakMin)} of 8:00.`,
  );
  if (gains && chosen) {
    explanation.push(
      `TIME YOU GOT BACK: +${formatHM(gains.driveMin)} drive and +${formatHM(gains.windowMin)} window versus running without the split (you'd be at ${formatHM(gains.baseDriveMin)} drive / ${formatHM(gains.baseWindowMin)} window).`,
    );
  }
  explanation.push(
    'A 10-hour consecutive rest gives a fresh 11/14 but does NOT reset the cycle; only a 34-hour restart does (49 CFR 395.3(c)).',
  );

  return {
    ok: true,
    validSplit: !!chosen,
    pair: chosen
      ? {
          first: chosen.c.first,
          second: chosen.c.second,
          longIsFirst: chosen.c.longIsFirst,
          pairTotalMin: chosen.c.pairTotalMin,
        }
      : null,
    clocks: result.clocks,
    violations: result.violations,
    warnings,
    limiting,
    usableDriveMin: usableDrive,
    legalToDrive: result.violations.length === 0 && usableDrive > 0,
    compliancePoint: chosen ? 'end-of-first-qualifying-period' : baselinePoint,
    anchorMin: chosen ? chosen.c.anchorMin : baselineAnchor,
    gains,
    explanation,
  };
}
