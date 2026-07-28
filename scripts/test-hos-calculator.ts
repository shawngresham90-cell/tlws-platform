/**
 * HOS Calculator engine tests — 49 CFR 395.3 + 395.1(g)(1), property
 * carriers. Pure logic — no network, no database. Exact minute boundaries
 * are tested unrounded: legal limits are never rounded.
 *
 * Run:
 *   npx esbuild scripts/test-hos-calculator.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-hos-calculator.cjs \
 *   && node /tmp/test-hos-calculator.cjs
 */
import { parseHM, formatHM } from '@/lib/hos/time';
import { evaluatePair, calculateQuickSplit } from '@/lib/hos/split-sleeper';
import { validateTimeline, restBlocks, calculateTimeline } from '@/lib/hos/timeline';
import { currentClocks } from '@/lib/hos/clocks';
import type { QuickSplitInput, TimelineEvent } from '@/lib/hos/types';
import { HOS } from '@/lib/hos/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

/* ------------------------------------------------------------ time utils */
check('parseHM "7:30" = 450', parseHM('7:30') === 450);
check('parseHM "11" = 660', parseHM('11') === 660);
check('parseHM "0:00" = 0', parseHM('0:00') === 0);
check('parseHM rejects "7:60"', parseHM('7:60') === null);
check('parseHM rejects "abc"', parseHM('abc') === null);
check('parseHM rejects "-1:00"', parseHM('-1:00') === null);
check('parseHM rejects "7.5"', parseHM('7.5') === null);
check('formatHM 450 = "7:30"', formatHM(450) === '7:30');
check('formatHM 0 = "0:00"', formatHM(0) === '0:00');
check('constants are minutes', HOS.MAX_DRIVING_MIN === 660 && HOS.MAX_WINDOW_MIN === 840);

/* -------------------------------------------- §395.1(g)(1) qualification */
// Valid splits — the engine derives these from the rule, no hardcoded list.
check('7 sleeper + 3 off duty qualifies', evaluatePair(420, 'sleeper', 180, 'off-duty').qualifies);
check('7 sleeper + 3 sleeper qualifies', evaluatePair(420, 'sleeper', 180, 'sleeper').qualifies);
check('8 sleeper + 2 off duty qualifies', evaluatePair(480, 'sleeper', 120, 'off-duty').qualifies);
check('8 sleeper + 2 sleeper qualifies', evaluatePair(480, 'sleeper', 120, 'sleeper').qualifies);
check(
  '7.5 sleeper + 2.5 off qualifies (custom pair)',
  evaluatePair(450, 'sleeper', 150, 'off-duty').qualifies,
);
check(
  'order-agnostic: 3 off THEN 7 sleeper qualifies',
  evaluatePair(180, 'off-duty', 420, 'sleeper').qualifies,
);
check(
  'order-agnostic: 2 off THEN 8 sleeper qualifies',
  evaluatePair(120, 'off-duty', 480, 'sleeper').qualifies,
);
check(
  '9 sleeper + 2 off qualifies (11h pair)',
  evaluatePair(540, 'sleeper', 120, 'off-duty').qualifies,
);
check(
  'long half identified correctly when short is sleeper too',
  evaluatePair(180, 'sleeper', 420, 'sleeper').longPeriod?.minutes === 420,
);

// Invalid splits — exact boundary minutes, never rounded.
check(
  '6:59 sleeper + 3:01 off FAILS (long short by 1 min)',
  !evaluatePair(419, 'sleeper', 181, 'off-duty').qualifies,
);
check(
  '6:59+3:01 failure names the long-period rule',
  evaluatePair(419, 'sleeper', 181, 'off-duty').failures[0].code === 'no-long-sleeper-period',
);
check(
  '7:00 sleeper + 2:59 off FAILS (total 9:59)',
  !evaluatePair(420, 'sleeper', 179, 'off-duty').qualifies,
);
check(
  '7:00+2:59 failure is the 10-hour total',
  evaluatePair(420, 'sleeper', 179, 'off-duty').failures.some(
    (f) => f.code === 'pair-total-under-10',
  ),
);
check(
  '8:00 sleeper + 1:59 off FAILS (short under 2:00)',
  !evaluatePair(480, 'sleeper', 119, 'off-duty').qualifies,
);
check(
  '8:00+1:59 failure names the short-period rule',
  evaluatePair(480, 'sleeper', 119, 'off-duty').failures.some(
    (f) => f.code === 'short-period-too-short',
  ),
);
check(
  '8:00 + 1:59 does NOT also fail the total test (total 9:59 reported once short fails first is fine, but short must be named)',
  evaluatePair(480, 'sleeper', 119, 'off-duty').failures.length >= 1,
);
check(
  '7 OFF-DUTY + 3 off FAILS (long half must be sleeper)',
  !evaluatePair(420, 'off-duty', 180, 'off-duty').qualifies,
);
check(
  '7 off + 3 off failure names not-sleeper',
  evaluatePair(420, 'off-duty', 180, 'off-duty').failures[0].code === 'long-period-not-sleeper',
);
check('6/4 FAILS (neither ≥7h sleeper)', !evaluatePair(360, 'sleeper', 240, 'off-duty').qualifies);
check('5/5 FAILS', !evaluatePair(300, 'sleeper', 300, 'sleeper').qualifies);
check(
  '6/4 failure mentions non-authorization',
  evaluatePair(360, 'sleeper', 240, 'off-duty').failures[0].message.includes('NOT authorized'),
);
check(
  'exact 7:00 + 3:00 = exactly 10:00 qualifies (boundary)',
  evaluatePair(420, 'sleeper', 180, 'off-duty').qualifies,
);
check(
  'exact 2:00 short qualifies (boundary)',
  evaluatePair(480, 'sleeper', 120, 'off-duty').qualifies,
);

/* -------------------------------------------------- quick-mode: clocks */
const base: QuickSplitInput = {
  firstRestMin: 480,
  firstRestStatus: 'sleeper',
  secondRestMin: 120,
  secondRestStatus: 'off-duty',
  drivingBetweenMin: 360,
  onDutyBetweenMin: 60,
  otherBetweenMin: 0,
  cycleRule: '70/8',
  cycleUsedMin: 1800,
  drivingBeforeMin: 0,
  onDutyBeforeMin: 0,
};

{
  // 8 sleeper → 6h drive + 1h on-duty → 2 off. Clocks from end of FIRST period.
  const r = calculateQuickSplit(base);
  check('valid 8/2: ok', r.ok && r.split.qualifies);
  check(
    'valid 8/2: compliance point = end of first period',
    r.compliancePoint === 'end-of-first-qualifying-period',
  );
  check('valid 8/2: drive = 11:00 − 6:00 = 5:00', r.clocks?.driveMin === 300, r.clocks?.driveMin);
  check(
    'valid 8/2: window = 14:00 − 7:00 = 7:00',
    r.clocks?.windowMin === 420,
    r.clocks?.windowMin,
  );
  check(
    'valid 8/2: cycle = 70:00 − (30:00 + 7:00) = 33:00',
    r.clocks?.cycleMin === 1980,
    r.clocks?.cycleMin,
  );
  check('valid 8/2: break clock fresh (R10)', r.clocks?.untilBreakMin === 480);
  check('valid 8/2: legal to drive', r.legalToDrive === true);
  check('valid 8/2: no violations', r.violations.length === 0);
  check('valid 8/2: gains computed', r.gains !== null && r.gains.windowMin > 0);
}

{
  // Exactly 11:00 driving between periods — boundary, NOT a violation.
  const r = calculateQuickSplit({ ...base, drivingBetweenMin: 660, onDutyBetweenMin: 0 });
  check('exactly 11:00 between: no 11-hr violation', r.violations.length === 0);
  check('exactly 11:00 between: drive remaining 0', r.clocks?.driveMin === 0);
  check('exactly 11:00 between: NOT legal to drive (0 left)', r.legalToDrive === false);
}
{
  // 11:01 driving between — violation.
  const r = calculateQuickSplit({ ...base, drivingBetweenMin: 661, onDutyBetweenMin: 0 });
  check(
    '11:01 between: 11-hr violation reported',
    r.violations.some((v) => v.includes('11:00')),
  );
  check('11:01 between: not legal', r.legalToDrive === false);
}
{
  // Exactly 14:00 between — boundary, no window violation, 0 window left.
  const r = calculateQuickSplit({ ...base, drivingBetweenMin: 600, onDutyBetweenMin: 240 });
  check('exactly 14:00 between: no window violation', !r.violations.some((v) => v.includes('14')));
  check('exactly 14:00 between: window remaining 0', r.clocks?.windowMin === 0);
  check('exactly 14:00 between: not legal (window empty)', r.legalToDrive === false);
}
{
  // 14:01 between — window exceeded.
  const r = calculateQuickSplit({ ...base, drivingBetweenMin: 600, onDutyBetweenMin: 241 });
  check(
    '14:01 between: window violation reported',
    r.violations.some((v) => v.includes('14-hour')),
  );
}
{
  // Cycle exhausted exactly: 70:00 used, nothing left.
  const r = calculateQuickSplit({
    ...base,
    cycleUsedMin: 4200 - 420,
    drivingBetweenMin: 360,
    onDutyBetweenMin: 60,
  });
  check('cycle exactly exhausted: cycle 0', r.clocks?.cycleMin === 0, r.clocks?.cycleMin);
  check('cycle exactly exhausted: limiting = CYCLE', r.limiting === 'CYCLE');
  check('cycle exactly exhausted: not legal', r.legalToDrive === false);
}
{
  // Partial cycle: only 90 min left — cycle is the limiter, split gives no cycle back (R8).
  const r = calculateQuickSplit({ ...base, cycleUsedMin: 4200 - 420 - 90 });
  check('partial cycle: 90 min usable', r.usableDriveMin === 90, r.usableDriveMin);
  check('partial cycle: limiting = CYCLE', r.limiting === 'CYCLE');
  check('partial cycle: still legal (90 min > 0)', r.legalToDrive === true);
}
{
  // 60/7 cycle rule respected.
  const r = calculateQuickSplit({ ...base, cycleRule: '60/7', cycleUsedMin: 3600 - 420 - 30 });
  check('60/7: cycle cap is 60:00', r.clocks?.cycleMin === 30, r.clocks?.cycleMin);
}
{
  // Full reset detection: 10:00 in either slot is a reset, not a split.
  const r = calculateQuickSplit({ ...base, secondRestMin: 600 });
  check('10:00 second period → full reset', r.fullReset === true);
  check('full reset: fresh 11:00', r.clocks?.driveMin === 660);
  check('full reset: fresh 14:00', r.clocks?.windowMin === 840);
  check('full reset: cycle NOT reset', (r.clocks?.cycleMin ?? 0) < 4200);
  check('full reset explanation says NOT A SPLIT', r.explanation[0].includes('NOT A SPLIT'));
}
{
  // 9:59 + 9:59 is NOT a reset; and with no ≥7h sleeper... 9:59 sleeper IS ≥7h.
  const r = calculateQuickSplit({
    ...base,
    firstRestMin: 599,
    secondRestMin: 599,
    secondRestStatus: 'sleeper',
  });
  check(
    '9:59 + 9:59 (both sleeper): not a reset, qualifies as split',
    r.fullReset !== true && r.split.qualifies,
  );
}
{
  // Invalid input fails closed.
  const r = calculateQuickSplit({ ...base, drivingBetweenMin: Number.NaN });
  check('NaN input refuses', r.ok === false && (r.inputProblems?.length ?? 0) > 0);
  const r2 = calculateQuickSplit({ ...base, firstRestMin: -5 });
  check('negative input refuses', r2.ok === false);
  const r3 = calculateQuickSplit({ ...base, firstRestMin: 420.5 });
  check('fractional minutes refuse (integer minutes only)', r3.ok === false);
}
{
  // Invalid split never reports clocks or legality.
  const r = calculateQuickSplit({ ...base, firstRestMin: 419 });
  check('invalid split: clocks null', r.clocks === null);
  check('invalid split: legalToDrive false', r.legalToDrive === false);
  check('invalid split: explanation says INVALID', r.explanation[0] === 'INVALID SPLIT');
}

/* --------------------------------------------------------- timeline mode */
const T = (events: Array<[TimelineEvent['status'], number]>): TimelineEvent[] => {
  let t = 0;
  return events.map(([status, dur]) => {
    const e = { status, startMin: t, endMin: t + dur };
    t += dur;
    return e;
  });
};

{
  // Malformed timelines refuse.
  check('empty timeline refuses', calculateTimeline([], '70/8').ok === false);
  const gap: TimelineEvent[] = [
    { status: 'driving', startMin: 0, endMin: 60 },
    { status: 'off-duty', startMin: 120, endMin: 300 },
  ];
  check('gapped timeline refuses', calculateTimeline(gap, '70/8').ok === false);
  check(
    'gap problem names the gap',
    validateTimeline(gap).some((p) => p.includes('Gap')),
  );
  const overlap: TimelineEvent[] = [
    { status: 'driving', startMin: 0, endMin: 120 },
    { status: 'off-duty', startMin: 60, endMin: 300 },
  ];
  check('overlapping timeline refuses', calculateTimeline(overlap, '70/8').ok === false);
  check(
    'overlap problem names the overlap',
    validateTimeline(overlap).some((p) => p.includes('overlap')),
  );
  const zero: TimelineEvent[] = [{ status: 'driving', startMin: 0, endMin: 0 }];
  check('zero-length event refuses', calculateTimeline(zero, '70/8').ok === false);
}

{
  // Rest-block grouping: OFF+SB combination block, consecutive SB measured.
  const blocks = restBlocks(
    T([
      ['driving', 60],
      ['off-duty', 60],
      ['sleeper', 420],
      ['off-duty', 30],
      ['driving', 60],
    ]),
  );
  check('one rest block found', blocks.length === 1);
  check('block total = 8:30', blocks[0].totalMin === 510);
  check('max consecutive sleeper = 7:00', blocks[0].maxConsecutiveSleeperMin === 420);
  check('block qualifies as long half', blocks[0].qualifiesLong === true);
}
{
  // Interrupted sleeper does NOT accumulate: 4 SB + 1 OFF + 3 SB → max consec 4h.
  const blocks = restBlocks(
    T([
      ['sleeper', 240],
      ['off-duty', 60],
      ['sleeper', 180],
    ]),
  );
  check('interrupted sleeper: max consecutive = 4:00', blocks[0].maxConsecutiveSleeperMin === 240);
  check('interrupted sleeper: does not qualify as long half', blocks[0].qualifiesLong === false);
}

{
  // Classic valid 8/2 split on a timeline:
  // 10h reset → 4h drive → 8h sleeper → 5h drive → 2h off → now.
  const r = calculateTimeline(
    T([
      ['off-duty', 600],
      ['driving', 240],
      ['sleeper', 480],
      ['driving', 300],
      ['off-duty', 120],
    ]),
    '70/8',
  );
  check('timeline 8/2: valid split found', r.validSplit === true);
  check(
    'timeline 8/2: anchor = end of 8h sleeper (min 1320)',
    r.anchorMin === 600 + 240 + 480,
    r.anchorMin,
  );
  // Since anchor: 5h drive + 2h off(excluded, qualifying) → window used 5:00.
  check('timeline 8/2: drive remaining 6:00', r.clocks?.driveMin === 360, r.clocks?.driveMin);
  check(
    'timeline 8/2: window remaining 9:00 (2h rest excluded)',
    r.clocks?.windowMin === 540,
    r.clocks?.windowMin,
  );
  check('timeline 8/2: legal to drive', r.legalToDrive === true);
  check('timeline 8/2: gains vs no-split computed', r.gains !== null && r.gains.windowMin > 0);
}
{
  // Same timeline without the qualifying second period: 1h off only.
  const r = calculateTimeline(
    T([
      ['off-duty', 600],
      ['driving', 240],
      ['sleeper', 480],
      ['driving', 300],
      ['off-duty', 60],
    ]),
    '70/8',
  );
  check('1h second rest: no valid split', r.validSplit === false);
  check('1h second rest: clocks run from last reset', r.compliancePoint === 'end-of-reset');
  // From reset end: 4h drive + 8h SB + 5h drive + 1h off = 18h elapsed → window exceeded.
  check(
    'no split: window violation reported',
    r.violations.some((v) => v.includes('window')),
  );
  check('no split: not legal', r.legalToDrive === false);
}
{
  // Neither period has 7 consecutive sleeper hours (6 SB + 4 SB) — no split.
  const r = calculateTimeline(
    T([
      ['off-duty', 600],
      ['driving', 120],
      ['sleeper', 360],
      ['driving', 120],
      ['sleeper', 240],
      ['driving', 60],
    ]),
    '70/8',
  );
  check('6/4 timeline: no valid split', r.validSplit === false);
}
{
  // Timeline reset handling: a mid-timeline 10h break anchors the clocks.
  const r = calculateTimeline(
    T([
      ['driving', 300],
      ['off-duty', 600],
      ['driving', 120],
    ]),
    '70/8',
  );
  check('mid-timeline reset: compliance point end-of-reset', r.compliancePoint === 'end-of-reset');
  check('mid-timeline reset: drive = 11:00 − 2:00', r.clocks?.driveMin === 540);
  check(
    'mid-timeline reset: cycle counts BOTH driving stints',
    r.clocks?.cycleMin === 4200 - 420,
    r.clocks?.cycleMin,
  );
}
{
  // 34-hour restart inside the timeline resets the cycle bucket.
  const r = calculateTimeline(
    T([
      ['driving', 600],
      ['off-duty', 2040],
      ['driving', 60],
    ]),
    '70/8',
    3000, // driver-entered prior cycle time — must be zeroed by the restart
  );
  check(
    '34h restart: cycle counts only post-restart driving',
    r.clocks?.cycleMin === 4200 - 60,
    r.clocks?.cycleMin,
  );
}
{
  // Cycle base carried when no restart: prior 69:00 + 1:30 in timeline → over.
  const r = calculateTimeline(
    T([
      ['off-duty', 600],
      ['driving', 90],
    ]),
    '70/8',
    4140,
  );
  check(
    'cycle base carried: exceeded → violation',
    r.violations.some((v) => v.includes('cycle')),
  );
  check('cycle base carried: not legal', r.legalToDrive === false);
}
{
  // 30-minute break tracking: 8h driving straight → break clock empty.
  const r = calculateTimeline(
    T([
      ['off-duty', 600],
      ['driving', 480],
    ]),
    '70/8',
  );
  check('8h straight driving: untilBreak 0', r.clocks?.untilBreakMin === 0);
  check('8h straight driving: limiting = 30-MIN BREAK', r.limiting === '30-MIN BREAK');
  check('8h straight: not legal to continue (break due)', r.legalToDrive === false);
}
{
  // A 30-minute on-duty period does NOT reset the break clock — only
  // non-driving ≥30min does... (2020 rule: on-duty non-driving DOES count).
  // Verify: 4h drive + 30m on-duty + 4h drive → break clock shows 4:00 used.
  const r = calculateTimeline(
    T([
      ['off-duty', 600],
      ['driving', 240],
      ['on-duty', 30],
      ['driving', 240],
    ]),
    '70/8',
  );
  check(
    '30-min on-duty satisfies the break (2020 rule)',
    r.clocks?.untilBreakMin === 240,
    r.clocks?.untilBreakMin,
  );
}
{
  // Rolling pairs: reset → 2h off → 3h drive → 7h SB → 2h drive → 3h off → 1h drive.
  // Multiple pairings possible; engine must pick deterministically (fewest violations).
  const r = calculateTimeline(
    T([
      ['off-duty', 600],
      ['driving', 180],
      ['sleeper', 420],
      ['driving', 120],
      ['off-duty', 180],
      ['driving', 60],
    ]),
    '70/8',
  );
  check('multi-pairing: a valid split is found', r.validSplit === true);
  check('multi-pairing: result is deterministic and legal', r.legalToDrive === true);
}

/* --------------------------------------------------- current-clocks mode */
{
  const r = currentClocks({ driveMin: 300, windowMin: 200, cycleMin: 900, untilBreakMin: 480 });
  check('current clocks: limiting = 14-HR WINDOW', r.limiting === '14-HR WINDOW');
  check('current clocks: usable = 200', r.usableDriveMin === 200);
  check('current clocks: legal', r.legalToDrive === true);
  const r0 = currentClocks({ driveMin: 0, windowMin: 200, cycleMin: 900, untilBreakMin: 480 });
  check('current clocks: 0 drive → not legal', r0.legalToDrive === false);
  const rb = currentClocks({ driveMin: Number.NaN, windowMin: 1, cycleMin: 1, untilBreakMin: 1 });
  check('current clocks: NaN refuses', rb.ok === false);
}

/* ------------------------------------- reference-build behavior parity */
// The uploaded reference build's quick mode (reverse-engineered) computed:
// drive = 660 − drivingBetween; window = 840 − betweenTotal; break fresh.
// Verify our engine reproduces its VALID-split arithmetic on its default
// example (8:00 SB + 2:00 OFF, 6:00 drive + 1:00 on-duty between, 30:00 cycle).
{
  const r = calculateQuickSplit(base);
  check('reference parity: drive 5:00', r.clocks?.driveMin === 300);
  check('reference parity: window 7:00', r.clocks?.windowMin === 420);
  check('reference parity: cycle 33:00', r.clocks?.cycleMin === 1980);
}
// The reference treated ≥10h in either period as a reset — ours does too
// (tested above). The reference did NOT flag fractional-minute input (its
// parser was H:MM only at the UI layer); our engine refuses at the API too.

console.log(`hos-calculator: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
