/**
 * HOS engine hardening tests (30-hour-window Milestone A). Regulatory
 * boundary exactness, timezone/DST invariance, invalid-sequence and
 * clock-skew handling, stale-state behavior, seeded property-style
 * invariants, the exception architecture (typed unsupported-case handling
 * with citations), and the recap projection.
 *
 * Citations exercised: 49 CFR 395.3(a)(1) (10-hour reset), 395.3(a)(2)
 * (14-hour window), 395.3(a)(3)(i) (11-hour driving), 395.3(a)(3)(ii)
 * (30-minute break), 395.3(b) (60/70-hour cycles + recap arithmetic),
 * 395.3(c) (34-hour restart), 395.1(g)(1) (split sleeper — unsupported),
 * 395.1(b)(1) (adverse driving — unsupported), 395.1(e)(1) (short haul —
 * unsupported). Planning mode only — not an ELD, no RODS.
 *
 * Run:
 *   npx esbuild scripts/test-hos-hardening.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-hos-hardening.cjs \
 *   && node /tmp/test-hos-hardening.cjs
 */
import {
  advance,
  earliestArrivalMs,
  freshClockState,
  cycleUsedMin,
  legalDrivingMin,
  planDrive,
  remainingClocks,
  validateClockState,
} from '@/lib/trip-planner/hos-engine';
import {
  HOS_CAPABILITIES,
  assessAdverseDriving,
  assessShortHaul,
  assessSplitSleeper,
  recapProjection,
} from '@/lib/trip-planner/hos-exceptions';
import { HOS, type ClockState, type DutyStatus } from '@/lib/trip-planner/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

// Pin the process to a DST-observing zone so any future local-time leak in
// the engine actually changes behavior here (a UTC runner observes no DST and
// would mask such a bug). Set before any Date use.
process.env.TZ = 'America/New_York';

const T0 = 1_750_000_000_000;
// US Eastern spring-forward 2026: Mar 8, 2:00 EST → 3:00 EDT (07:00:00Z).
const DST_SPRING_UTC = Date.UTC(2026, 2, 8, 5, 0, 0); // midnight EST, DST at 07:00Z
// US Eastern fall-back 2026: Nov 1, 2:00 EDT → 1:00 EST (06:00:00Z).
const DST_FALL_UTC = Date.UTC(2026, 10, 1, 4, 0, 0);

function main() {
  /* ------------------------------------------ exact regulatory boundaries */
  {
    // 11-hour limit: exactly 660 min legal; 661st minute violates. §395.3(a)(3)(i)
    let s = freshClockState(T0);
    // Break every 8h so only the 11-hour clock binds.
    let r = advance(s, 'driving', 8 * 60);
    r = advance(r.state, 'off-duty', 30);
    const exact11 = advance(r.state, 'driving', 3 * 60);
    check('11h: exactly 660 min driving is legal', exact11.violations.length === 0);
    const over11 = advance(r.state, 'driving', 3 * 60 + 1);
    check(
      '11h: minute 661 violates',
      over11.violations.some((v) => v.rule === '11-hour'),
    );

    // 14-hour window: driving that ENDS exactly at minute 840 is legal;
    // one more minute violates. §395.3(a)(2)
    let w = advance(freshClockState(T0), 'driving', 300); // 5h drive
    w = advance(w.state, 'off-duty', 480); // 8h off (window keeps running)
    const withinWindow = advance(w.state, 'driving', 60); // ends at exactly 840
    check(
      '14h: driving ending exactly at minute 840 is legal',
      withinWindow.violations.length === 0,
    );
    const pastWindow = advance(w.state, 'driving', 61);
    check(
      '14h: minute 841 violates',
      pastWindow.violations.some((v) => v.rule === '14-hour'),
    );

    // 30-minute break: exactly 480 driving minutes OK; 481st violates.
    const b0 = advance(freshClockState(T0), 'driving', HOS.BREAK_AFTER_DRIVING_MIN);
    check('break: 480 cumulative driving minutes legal', b0.violations.length === 0);
    const b1 = advance(b0.state, 'driving', 1);
    check(
      'break: 481st minute violates',
      b1.violations.some((v) => v.rule === '30-minute-break'),
    );
    // A 29-minute interruption does NOT clear the break clock; 30 does.
    const b29 = advance(b0.state, 'off-duty', 29);
    check('break: 29-min interruption insufficient', b29.state.drivingSinceBreakMin === 480);
    const b30 = advance(b0.state, 'off-duty', 30);
    check('break: 30-min interruption clears the clock', b30.state.drivingSinceBreakMin === 0);
    // 2020 rule: ON-DUTY non-driving ≥30 min ALSO satisfies the break
    // (fueling/loading count) — §395.3(a)(3)(ii) as amended.
    const od30 = advance(b0.state, 'on-duty', 30);
    check(
      'break: 30-min ON-DUTY period satisfies the break (2020 rule)',
      od30.state.drivingSinceBreakMin === 0,
    );
    const od29 = advance(b0.state, 'on-duty', 29);
    check('break: 29-min on-duty period does not', od29.state.drivingSinceBreakMin === 480);
    // …and the on-duty break still consumes the 14-hour window (never pauses it).
    check('break: on-duty break consumes the window', od30.state.windowElapsedMin === 480 + 30);

    // 10-hour reset boundary: 599 min rest does not reset; 600 does. §395.3(a)(1)
    const tired = advance(freshClockState(T0), 'driving', 480);
    const rest599 = advance(tired.state, 'sleeper', 599);
    check('reset: 599 min rest keeps the clocks', rest599.state.drivingUsedMin === 480);
    const rest600 = advance(tired.state, 'sleeper', 600);
    check(
      'reset: 600 min rest clears 11/14 clocks',
      rest600.state.drivingUsedMin === 0 && rest600.state.windowElapsedMin === -1,
    );

    // 34-hour restart boundary: 2039 min keeps the cycle; 2040 restarts it. §395.3(c)
    let heavyState: ClockState = freshClockState(T0);
    for (let d = 0; d < 4; d++) {
      heavyState = advance(heavyState, 'on-duty', 600).state;
      heavyState = advance(heavyState, 'off-duty', 840).state;
    }
    // Zero the rest streak so the 34h measurement below starts from 0.
    heavyState = advance(heavyState, 'on-duty', 60).state;
    const usedBefore = cycleUsedMin(heavyState);
    check('restart: setup accrued cycle time', usedBefore >= 2400);
    const r2039 = advance(heavyState, 'sleeper', HOS.RESTART_MIN - 1);
    check('restart: 2039 min rest keeps cycle time', cycleUsedMin(r2039.state) === usedBefore);
    const r2040 = advance(heavyState, 'sleeper', HOS.RESTART_MIN);
    check('restart: 2040 min rest zeroes the cycle', cycleUsedMin(r2040.state) === 0);
  }

  /* --------------------------------------- timezone & DST invariance */
  {
    // The regulation counts ELAPSED hours; the engine is epoch-ms based, so
    // duty math must be IDENTICAL across DST transitions and midnights.
    const sequence: [DutyStatus, number][] = [
      ['on-duty', 45],
      ['driving', 300],
      ['off-duty', 30],
      ['driving', 300],
      ['sleeper', 600],
      ['driving', 240],
    ];
    const run = (startMs: number) => {
      let st = freshClockState(startMs);
      let viol = 0;
      for (const [status, min] of sequence) {
        const step = advance(st, status, min);
        st = step.state;
        viol += step.violations.length;
      }
      return { rc: remainingClocks(st), viol, elapsedMin: (st.atMs - startMs) / 60_000 };
    };
    const plain = run(T0);
    const spring = run(DST_SPRING_UTC); // sequence spans the spring-forward hour
    const fall = run(DST_FALL_UTC); // spans the fall-back hour
    check(
      'dst: spring-forward span gives identical clocks',
      JSON.stringify(plain.rc) === JSON.stringify(spring.rc) && plain.viol === spring.viol,
    );
    check(
      'dst: fall-back span gives identical clocks',
      JSON.stringify(plain.rc) === JSON.stringify(fall.rc) && plain.viol === fall.viol,
    );
    check(
      'dst: elapsed time is wall-clock-independent',
      plain.elapsedMin === spring.elapsedMin && plain.elapsedMin === fall.elapsedMin,
    );

    // Midnight/day-bucket rollover: an on-duty block spanning the bucket
    // boundary accrues the same cycle total as one inside a single day.
    const nearMidnight = advance(freshClockState(T0), 'off-duty', 1380).state; // 23h in
    const spanning = advance(nearMidnight, 'on-duty', 120); // crosses the bucket edge
    check(
      'midnight: cycle accrual preserved across bucket rollover',
      cycleUsedMin(spanning.state) === 120,
    );
    check(
      'midnight: accrual split across two buckets',
      spanning.state.onDutyByDayMin.length >= 2 &&
        spanning.state.onDutyByDayMin.slice(-2).reduce((a, b) => a + b, 0) === 120,
    );
  }

  /* --------------------------------- invalid sequences, skew, stale data */
  {
    let threw = 0;
    for (const bad of [-1, NaN, Infinity, -Infinity]) {
      try {
        advance(freshClockState(T0), 'driving', bad);
      } catch {
        threw++;
      }
    }
    check('invalid: negative/NaN/Inf segment minutes throw', threw === 4);
    try {
      planDrive(freshClockState(T0), -5);
      check('invalid: negative driveMinutes throws', false);
    } catch {
      check('invalid: negative driveMinutes throws', true);
    }

    // Clock-skew-shaped states are rejected at the validation boundary.
    const base = freshClockState(T0);
    check(
      'skew: window < driving rejected',
      validateClockState({ ...base, drivingUsedMin: 300, windowElapsedMin: 200 }).length > 0,
    );
    check(
      'skew: break-clock > driving rejected',
      validateClockState({
        ...base,
        drivingUsedMin: 60,
        windowElapsedMin: 60,
        drivingSinceBreakMin: 120,
      }).length > 0,
    );
    check(
      'skew: non-positive atMs rejected',
      validateClockState({ ...base, atMs: 0 }).length > 0 &&
        validateClockState({ ...base, atMs: -5 }).length > 0,
    );
    check(
      'skew: driving without an open window rejected',
      validateClockState({ ...base, drivingUsedMin: 60, windowElapsedMin: -1 }).length > 0,
    );

    // Stale activity: advancing over a multi-day gap applies reset + restart.
    const before = advance(freshClockState(T0), 'driving', 600).state;
    const after = advance(before, 'off-duty', 3 * 1440); // 3 days off
    check(
      'stale: 3-day gap resets clocks and cycle',
      after.state.drivingUsedMin === 0 &&
        after.state.windowElapsedMin === -1 &&
        cycleUsedMin(after.state) === 0,
    );
    // Partial shift resumes correctly after validation.
    const partial = advance(freshClockState(T0), 'driving', 200).state;
    check('partial: mid-shift state validates', validateClockState(partial).length === 0);
    check('partial: remaining reflects use', remainingClocks(partial).drivingMin === 460);
  }

  /* ----------------------------------------- seeded property invariants */
  {
    // Deterministic LCG so failures are reproducible.
    let seed = 0xc0ffee;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    const statuses: DutyStatus[] = ['driving', 'on-duty', 'off-duty', 'sleeper'];
    let violationsOfInvariants = 0;

    for (let trial = 0; trial < 300; trial++) {
      let st = freshClockState(T0 + Math.floor(rnd() * 1e9));
      for (let step = 0; step < 12; step++) {
        const status = statuses[Math.floor(rnd() * statuses.length)];
        const minutes = Math.floor(rnd() * 700);
        const prevAt = st.atMs;
        st = advance(st, status, minutes).state;
        const rc = remainingClocks(st);
        const ok =
          st.atMs === prevAt + minutes * 60_000 && // time only moves forward, exactly
          rc.drivingMin >= 0 &&
          rc.drivingMin <= HOS.MAX_DRIVING_MIN &&
          rc.windowMin >= 0 &&
          rc.windowMin <= HOS.MAX_WINDOW_MIN &&
          rc.untilBreakMin >= 0 &&
          rc.untilBreakMin <= HOS.BREAK_AFTER_DRIVING_MIN &&
          rc.cycleMin >= 0 &&
          rc.legalDrivingMin ===
            Math.min(rc.drivingMin, rc.windowMin, rc.untilBreakMin, rc.cycleMin) &&
          st.onDutyByDayMin.every((m) => m >= 0 && m <= HOS.DAY_MIN);
        if (!ok) violationsOfInvariants++;
        // A ≥10h rest ALWAYS leaves the 11/14 clocks fully reset.
        if ((status === 'off-duty' || status === 'sleeper') && minutes >= HOS.MIN_RESET_MIN) {
          if (st.drivingUsedMin !== 0 || st.windowElapsedMin !== -1) violationsOfInvariants++;
        }
      }
    }
    check(
      'property: 300 random duty sequences hold all clock invariants',
      violationsOfInvariants === 0,
      {
        violationsOfInvariants,
      },
    );

    // planDrive is violation-free by construction and monotone in distance.
    let planFailures = 0;
    let lastArrival = -1;
    let monotone = true;
    for (let i = 0; i < 40; i++) {
      const drive = i * 60; // 0..39 hours of driving
      try {
        const p = planDrive(freshClockState(T0), drive);
        if (p.driveMinutes !== drive) planFailures++;
        if (p.totalMinutes < drive) planFailures++;
        const arrival = earliestArrivalMs(freshClockState(T0), drive);
        if (arrival < lastArrival) monotone = false;
        lastArrival = arrival;
      } catch {
        planFailures++;
      }
    }
    check('property: planDrive completes 0–39h drives violation-free', planFailures === 0);
    check('property: earliestArrival is monotone in drive time', monotone);
  }

  /* ------------------------------------------------ exception architecture */
  {
    check(
      'capabilities: every entry carries a citation',
      HOS_CAPABILITIES.every((c) => /49 CFR 395/.test(c.citation)),
    );
    check(
      'capabilities: unsupported rules state a conservative assumption',
      HOS_CAPABILITIES.filter((c) => c.status === 'unsupported').every(
        (c) => !!c.conservativeAssumption,
      ),
    );
    check(
      'capabilities: split-sleeper/adverse/short-haul are declared unsupported',
      ['395.1(g)', '395.1(b)', '395.1(e)'].every((cite) =>
        HOS_CAPABILITIES.some((c) => c.status === 'unsupported' && c.citation.includes(cite)),
      ),
    );

    const split = assessSplitSleeper({ sleeperPeriodMin: 8 * 60, otherRestMin: 2 * 60 });
    check(
      'split-sleeper: qualifying shape still declines with citation',
      !split.supported && split.citation === '49 CFR 395.1(g)(1)',
    );
    check(
      'split-sleeper: shape recognized in reason',
      !split.supported && split.reason.includes('qualifies'),
    );
    // The ≥7h period must be IN THE SLEEPER; a 7h sleeper period paired with
    // a LONGER off-duty period still shape-qualifies under §395.1(g)(1).
    const splitShortSleeper = assessSplitSleeper({
      sleeperPeriodMin: 7 * 60,
      otherRestMin: 8 * 60,
    });
    check(
      'split-sleeper: 7h sleeper + longer off-duty still shape-qualifies',
      !splitShortSleeper.supported && splitShortSleeper.reason.includes('qualifies'),
    );
    const splitBad = assessSplitSleeper({ sleeperPeriodMin: 5 * 60, otherRestMin: 5 * 60 });
    check(
      'split-sleeper: <7h sleeper period identified as non-qualifying',
      !splitBad.supported && splitBad.reason.includes('does not meet'),
    );

    const adverse = assessAdverseDriving({
      condition: 'sudden ice storm',
      knownBeforeDispatch: false,
    });
    check(
      'adverse: never self-granted, cites 395.1(b)(1)',
      !adverse.supported && adverse.citation === '49 CFR 395.1(b)(1)',
    );
    const adverseKnown = assessAdverseDriving({
      condition: 'forecast blizzard',
      knownBeforeDispatch: true,
    });
    check(
      'adverse: known-before-dispatch explicitly ineligible',
      !adverseKnown.supported && adverseKnown.reason.includes('known before dispatch'),
    );

    const shortHaul = assessShortHaul({ airMileRadius: 100, returnsToWorkLocation: true });
    check(
      'short-haul: declines with citation and guidance',
      !shortHaul.supported &&
        shortHaul.citation === '49 CFR 395.1(e)(1)' &&
        shortHaul.conservativeGuidance.includes('30-minute'),
    );
  }

  /* --------------------------------------------------------------- recaps */
  {
    // Hand-built: 70/8 driver with 600 on-duty min on each of the last 8 days.
    const st: ClockState = {
      ...freshClockState(T0),
      onDutyByDayMin: [600, 600, 600, 600, 600, 600, 600, 600],
    };
    check('recap: current cycle used is 4800', cycleUsedMin(st) === 4800);
    const proj = recapProjection(st, 8);
    check('recap: 8 projection days returned', proj.length === 8);
    // Day 1: the oldest 600-min bucket ROLLS OFF (that is the field's
    // meaning), but availability stays clamped at 0 (used 4800 → 4200 vs cap
    // 4200). The clamp must not hide the roll-off.
    check(
      'recap: day 1 reports the departing 600 min even while clamped at 0 available',
      proj[0].minutesRollingOff === 600 && proj[0].projectedAvailableMin === 0,
    );
    check(
      'recap: day 2 rolls 600 more off and frees 600 available',
      proj[1].minutesRollingOff === 600 && proj[1].projectedAvailableMin === 600,
    );
    check(
      'recap: availability is nondecreasing with no new on-duty time',
      proj.every((d, i) => i === 0 || d.projectedAvailableMin >= proj[i - 1].projectedAvailableMin),
    );
    check(
      'recap: fully recovered after the window clears',
      proj[7].projectedAvailableMin === HOS.CYCLE_70_MIN,
    );

    // Fresh driver: nothing to regain, full availability throughout.
    const freshProj = recapProjection(freshClockState(T0), 3);
    check(
      'recap: fresh driver stays at full cycle',
      freshProj.every(
        (d) => d.projectedAvailableMin === HOS.CYCLE_70_MIN && d.minutesRollingOff === 0,
      ),
    );

    // 60/7 uses the 7-day window and 3600 cap.
    const st60: ClockState = {
      ...freshClockState(T0, '60/7'),
      onDutyByDayMin: [500, 500, 500, 500, 500, 500, 500],
    };
    const proj60 = recapProjection(st60, 7);
    check('recap: 60/7 window honored', proj60[0].projectedAvailableMin === 3600 - 3000);

    // Engine agreement: projection day-1 equals actually advancing 24h off.
    const busy = advance(advance(freshClockState(T0), 'on-duty', 600).state, 'off-duty', 300).state;
    const projected = recapProjection(busy, 1)[0].projectedAvailableMin;
    // A 24h-off advance would trigger the 10h reset but NOT the 34h restart,
    // leaving the cycle window arithmetic identical to the projection.
    const advanced = advance(busy, 'off-duty', 1440 - 300).state;
    const actual = Math.max(0, HOS.CYCLE_70_MIN - cycleUsedMin(advanced));
    check('recap: projection matches engine after a real 24h roll', projected === actual, {
      projected,
      actual,
    });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
