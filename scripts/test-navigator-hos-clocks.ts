/**
 * Driver-entered HOS clocks — the conversion, exhaustively.
 *
 * This harness exists because the conversion between "what my ELD says is
 * left" and "what the engine advances" is the single place this milestone
 * could silently lie to a driver about their legal standing. Three things
 * are proven rather than asserted:
 *
 *   1. ROUND TRIP. Every value a driver can enter comes back unchanged
 *      through the engine's own `remainingClocks`. Not a sample — a sweep
 *      across the whole valid range, plus the boundaries.
 *   2. THE ENGINE ACCEPTS IT. Every state the conversion builds passes
 *      the engine's own `validateClockState`. The first version of this
 *      module failed that on two counts; the sweep below is what catches
 *      a third.
 *   3. NO FABRICATED HISTORY. A single "cycle remaining" number cannot
 *      say which day its used hours fell on, so the day buckets are a
 *      balance and never a recap input. That boundary is pinned here and
 *      structurally, by proving no Navigator surface imports the recap
 *      projection.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-hos-clocks.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --outfile=/tmp/test-navigator-hos-clocks.cjs && node /tmp/test-navigator-hos-clocks.cjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  clockCeilings,
  cycleBalanceBuckets,
  engineStateFor,
  formatEnteredClock,
  freshShiftClocks,
  fromEngineClockState,
  joinHoursMinutes,
  splitHoursMinutes,
  toEngineClockState,
  validateEnteredClocks,
  CLOCKS_NOT_SET,
  CLOCKS_UNSET,
  CLOCK_FIELDS,
  type DriverEnteredClocks,
} from '@/lib/navigator/hos-clocks';
import { remainingClocks, validateClockState } from '@/lib/trip-planner/hos-engine';
import { HOS, type CycleRule } from '@/lib/trip-planner/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

const NOW = 1_754_000_000_000;
const RULES: CycleRule[] = ['60/7', '70/8'];

/** A consistent entry: window elapsed ≥ drive used, break used ≤ drive used. */
function entry(
  drivingMin: number,
  windowMin: number,
  untilBreakMin: number,
  cycleMin: number,
  cycleRule: CycleRule = '70/8',
): DriverEnteredClocks {
  return { drivingMin, windowMin, untilBreakMin, cycleMin, cycleRule };
}

/* ===================================================================== */
/* 1. ROUND TRIP — entered values return unchanged                        */
/* ===================================================================== */
{
  let cases = 0;
  let exact = 0;
  const mismatches: unknown[] = [];
  for (const rule of RULES) {
    const caps = clockCeilings(rule);
    // Sweep the whole valid space on a coarse grid, then the boundaries.
    for (let driving = 0; driving <= caps.drivingMin; driving += 15) {
      for (let window = 0; window <= caps.windowMin; window += 30) {
        for (let brk = 0; brk <= caps.untilBreakMin; brk += 60) {
          for (let cycle = 0; cycle <= caps.cycleMin; cycle += 300) {
            const entered = entry(driving, window, brk, cycle, rule);
            if (validateEnteredClocks(entered).length > 0) continue;
            cases += 1;
            const back = fromEngineClockState(toEngineClockState(entered, NOW));
            const same =
              back.drivingMin === entered.drivingMin &&
              back.windowMin === entered.windowMin &&
              back.untilBreakMin === entered.untilBreakMin &&
              back.cycleMin === entered.cycleMin &&
              back.cycleRule === entered.cycleRule;
            if (same) exact += 1;
            else if (mismatches.length < 4) mismatches.push({ entered, back });
          }
        }
      }
    }
  }
  check('round trip: the sweep actually covered a real range', cases > 5_000, cases);
  check(
    `round trip: all ${cases} valid entries return UNCHANGED through the engine`,
    exact === cases,
    mismatches,
  );
}

// The boundaries, named individually so a failure says which edge broke.
{
  const edges: [string, DriverEnteredClocks][] = [
    ['everything full (a genuine fresh shift)', entry(660, 840, 480, 4200)],
    ['everything spent', entry(0, 0, 0, 0)],
    ['mid-shift, the case the road test hit', entry(300, 480, 180, 1320)],
    ['drive spent, window left', entry(0, 120, 0, 600)],
    ['one minute of each', entry(1, 1, 1, 1)],
    ['60/7 full', entry(660, 840, 480, 3600, '60/7')],
    ['60/7 nearly spent', entry(30, 60, 30, 60, '60/7')],
    ['cycle exactly one day used', entry(660, 840, 480, 4200 - HOS.DAY_MIN)],
  ];
  for (const [name, entered] of edges) {
    check(
      `round trip edge (${name}): entry is valid`,
      validateEnteredClocks(entered).length === 0,
      {
        entered,
        errors: validateEnteredClocks(entered),
      },
    );
    const back = fromEngineClockState(toEngineClockState(entered, NOW));
    check(
      `round trip edge (${name}): returns unchanged`,
      JSON.stringify(back) === JSON.stringify(entered),
      {
        entered,
        back,
      },
    );
  }
}

/* ===================================================================== */
/* 2. THE ENGINE'S OWN VALIDATOR ACCEPTS EVERY STATE WE BUILD             */
/* ===================================================================== */
{
  let built = 0;
  let accepted = 0;
  const rejected: unknown[] = [];
  for (const rule of RULES) {
    const caps = clockCeilings(rule);
    for (let driving = 0; driving <= caps.drivingMin; driving += 20) {
      for (let window = 0; window <= caps.windowMin; window += 40) {
        for (let brk = 0; brk <= caps.untilBreakMin; brk += 80) {
          for (let cycle = 0; cycle <= caps.cycleMin; cycle += 420) {
            const entered = entry(driving, window, brk, cycle, rule);
            if (validateEnteredClocks(entered).length > 0) continue;
            built += 1;
            const problems = validateClockState(toEngineClockState(entered, NOW));
            if (problems.length === 0) accepted += 1;
            else if (rejected.length < 4) rejected.push({ entered, problems });
          }
        }
      }
    }
  }
  check('engine validator: the sweep built a real range of states', built > 2_000, built);
  check(
    `engine validator: all ${built} built states pass validateClockState`,
    accepted === built,
    rejected,
  );
}

// The three specific shapes that were wrong in the first version of the
// conversion. Named, so a regression says exactly which one came back.
{
  const overADay = toEngineClockState(entry(660, 840, 480, 0), NOW);
  check(
    'regression: a spent cycle no longer packs 70 hours into one day bucket',
    overADay.onDutyByDayMin.every((m) => m <= HOS.DAY_MIN),
    overADay.onDutyByDayMin,
  );
  check(
    'regression: and the engine accepts it',
    validateClockState(overADay).length === 0,
    validateClockState(overADay),
  );
  const droveButFullWindow = entry(600, 840, 420, 0);
  check(
    'regression: "drove an hour but window still full" is REFUSED at entry',
    validateEnteredClocks(droveButFullWindow).length > 0,
    validateEnteredClocks(droveButFullWindow),
  );
  const brokeMoreThanDrove = entry(660, 840, 0, 4200);
  check(
    'regression: "used more since break than driven in total" is REFUSED at entry',
    validateEnteredClocks(brokeMoreThanDrove).length > 0,
    validateEnteredClocks(brokeMoreThanDrove),
  );
  const fresh = toEngineClockState(entry(660, 840, 480, 4200), NOW);
  check(
    'a genuinely fresh entry still uses the engine’s −1 "no window open" sentinel',
    fresh.windowElapsedMin === -1 && fresh.drivingUsedMin === 0,
    fresh,
  );
}

/* ===================================================================== */
/* 3. THE CYCLE IS A BALANCE, NOT A HISTORY                               */
/* ===================================================================== */
{
  /*
   * A single "hours remaining" number cannot say which day its used hours
   * fell on. The balance is exact; the distribution is an artefact. These
   * pin both halves of that sentence so nobody later reads the buckets as
   * a duty record.
   */
  check(
    'balance: nothing used is a single empty bucket',
    JSON.stringify(cycleBalanceBuckets(0)) === '[0]',
  );
  check(
    'balance: under a day stays in one bucket',
    JSON.stringify(cycleBalanceBuckets(600)) === '[600]',
  );
  check(
    'balance: over a day splits at the engine’s own per-day cap',
    JSON.stringify(cycleBalanceBuckets(HOS.DAY_MIN + 60)) === `[60,${HOS.DAY_MIN}]`,
    cycleBalanceBuckets(HOS.DAY_MIN + 60),
  );
  check(
    'balance: a fully spent 70-hour cycle splits into whole days plus a remainder',
    cycleBalanceBuckets(4200).reduce((a, b) => a + b, 0) === 4200 &&
      cycleBalanceBuckets(4200).every((m) => m <= HOS.DAY_MIN),
    cycleBalanceBuckets(4200),
  );
  check(
    'balance: the used time sits in the MOST RECENT buckets (recap as late as possible)',
    // Newest is last. Filling from the front means the partial day is
    // oldest and the full days are nearest — the conservative reading,
    // which never credits a driver with hours they may not get back.
    cycleBalanceBuckets(HOS.DAY_MIN * 2 + 30)[0] === 30,
    cycleBalanceBuckets(HOS.DAY_MIN * 2 + 30),
  );
  for (let used = 0; used <= 4200; used += 37) {
    const sum = cycleBalanceBuckets(used).reduce((a, b) => a + b, 0);
    if (sum !== used) {
      check(`balance: sums exactly at ${used} min`, false, cycleBalanceBuckets(used));
      break;
    }
  }
  check('balance: sums exactly across the whole range', true);

  /*
   * THE STRUCTURAL HALF. `recapProjection` is a real, implemented engine
   * function — and it reads exactly the buckets this conversion
   * fabricates. Running it on driver-entered clocks would produce
   * confident, wrong "hours back on Tuesday" answers. No Navigator
   * surface may import it while the cycle is entered as a balance.
   */
  const navFiles = [
    ...readdirSync('src/lib/navigator').map((f) => join('src/lib/navigator', f)),
    ...readdirSync('src/components/navigator').map((f) => join('src/components/navigator', f)),
  ].filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
  const importsRecap = navFiles.filter((f) =>
    /recapProjection|hos-exceptions/.test(readFileSync(f, 'utf8')),
  );
  check(
    'no Navigator surface computes a recap from driver-entered day buckets',
    importsRecap.length === 0,
    importsRecap,
  );
}

/* ===================================================================== */
/* 4. UNSET IS A REAL ANSWER                                              */
/* ===================================================================== */
{
  check('unset is the default shape', CLOCKS_UNSET.kind === 'unset');
  check(
    'unset yields NO engine state — never a fresh driver',
    engineStateFor(CLOCKS_UNSET, NOW) === null,
  );
  check('unset has a driver-facing name', CLOCKS_NOT_SET === 'Clocks not set');
  const set = engineStateFor(
    { kind: 'set', entered: entry(300, 480, 180, 1320), enteredAtMs: NOW, fromFreshShift: false },
    NOW,
  );
  check('a set state yields an engine state', set !== null && set.drivingUsedMin === 360, set);
}

/* ===================================================================== */
/* 5. FRESH SHIFT IS THE ENGINE'S OWN DEFINITION                          */
/* ===================================================================== */
{
  for (const rule of RULES) {
    const fresh = freshShiftClocks(rule);
    const caps = clockCeilings(rule);
    check(
      `fresh shift (${rule}): every clock is full, by the engine's own reckoning`,
      fresh.drivingMin === caps.drivingMin &&
        fresh.windowMin === caps.windowMin &&
        fresh.untilBreakMin === caps.untilBreakMin &&
        fresh.cycleMin === caps.cycleMin,
      fresh,
    );
    check(
      `fresh shift (${rule}): is itself a valid entry`,
      validateEnteredClocks(fresh).length === 0,
    );
    check(
      `fresh shift (${rule}): round-trips like any other entry`,
      JSON.stringify(fromEngineClockState(toEngineClockState(fresh, NOW))) ===
        JSON.stringify(fresh),
    );
  }
  // The engine and this module must agree about what "full" means.
  const engineFull = remainingClocks(toEngineClockState(freshShiftClocks('70/8'), NOW));
  check(
    'fresh shift matches the engine’s remainingClocks exactly',
    engineFull.drivingMin === HOS.MAX_DRIVING_MIN &&
      engineFull.windowMin === HOS.MAX_WINDOW_MIN &&
      engineFull.untilBreakMin === HOS.BREAK_AFTER_DRIVING_MIN &&
      engineFull.cycleMin === HOS.CYCLE_70_MIN,
    engineFull,
  );
}

/* ===================================================================== */
/* 6. VALIDATION REPORTS, NEVER CLAMPS                                    */
/* ===================================================================== */
{
  check(
    'over the 11-hour cap is refused',
    validateEnteredClocks(entry(661, 840, 480, 4200)).length > 0,
  );
  check(
    'over the 14-hour cap is refused',
    validateEnteredClocks(entry(660, 841, 480, 4200)).length > 0,
  );
  check(
    'over the 8-hour break cap is refused',
    validateEnteredClocks(entry(660, 840, 481, 4200)).length > 0,
  );
  check(
    'over the 70-hour cycle is refused',
    validateEnteredClocks(entry(660, 840, 480, 4201)).length > 0,
  );
  check(
    '70 hours on a 60/7 cycle is refused',
    validateEnteredClocks(entry(660, 840, 480, 4200, '60/7')).length > 0,
  );
  check('negative is refused', validateEnteredClocks(entry(-1, 840, 480, 4200)).length > 0);
  check('NaN is refused', validateEnteredClocks(entry(Number.NaN, 840, 480, 4200)).length > 0);
  check(
    'the error names the field and the ceiling a driver can act on',
    /Drive time left/.test(validateEnteredClocks(entry(700, 840, 480, 4200))[0] ?? '') &&
      /11h/.test(validateEnteredClocks(entry(700, 840, 480, 4200))[0] ?? ''),
    validateEnteredClocks(entry(700, 840, 480, 4200)),
  );
  check('the four clocks are named for a driver, not for the engine', CLOCK_FIELDS.length === 4);
}

/* ===================================================================== */
/* 7. HOURS AND MINUTES                                                   */
/* ===================================================================== */
{
  check(
    'split: 6h30 from 390',
    JSON.stringify(splitHoursMinutes(390)) === '{"hours":6,"minutes":30}',
  );
  check(
    'split: refuses nonsense to zero',
    JSON.stringify(splitHoursMinutes(Number.NaN)) === '{"hours":0,"minutes":0}',
  );
  check('join: 6 and 30 make 390', joinHoursMinutes(6, 30) === 390);
  check(
    'join: nonsense stays NaN so validation can report it',
    Number.isNaN(joinHoursMinutes(Number.NaN, 30)),
  );
  for (let m = 0; m <= 4200; m += 13) {
    const { hours, minutes } = splitHoursMinutes(m);
    if (joinHoursMinutes(hours, minutes) !== m) {
      check(`hours+minutes round-trip at ${m}`, false);
      break;
    }
  }
  check('hours+minutes round-trip across the whole range', true);
  check('formatted for the summary line', formatEnteredClock(390) === '6h 30m');
  check('formatted: zero is not an em dash', formatEnteredClock(0) === '0h 00m');
  check('formatted: unknown IS an em dash', formatEnteredClock(Number.NaN) === '—');
}

console.log(`navigator-hos-clocks: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
