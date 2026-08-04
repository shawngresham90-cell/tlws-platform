/**
 * Trip Planner clock-input reversal: the driver enters hours REMAINING, the
 * wire/engine keep used-minutes, and lib/trip-planner/clock-input.ts is the
 * ONE place they meet (used = limit − remaining, limits from HOS).
 *
 * Behavioral, not just arithmetic: every valid conversion is round-tripped
 * through the REAL engine (clockStateFromSimple → validateClockState →
 * remainingClocks) and the engine's own remaining figures must equal what
 * the driver entered — the proof this is a semantic reversal, not a relabel.
 *
 * Run:
 *   npx esbuild scripts/test-clock-input.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-clock-input.cjs && node /tmp/test-clock-input.cjs
 */
import { readFileSync } from 'node:fs';
import {
  CLOCK_INPUT_LIMITS_H,
  clampRemainingHours,
  freshRemainingClocks,
  remainingToSimpleClocks,
  type RemainingClocksInput,
} from '@/lib/trip-planner/clock-input';
import { clockStateFromSimple } from '@/lib/trip-planner/compose-quote';
import { remainingClocks, validateClockState } from '@/lib/trip-planner/hos-engine';
import { HOS } from '@/lib/trip-planner/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

const T0 = 1_754_000_000_000;

/** Convert, then run the REAL engine and read back its remaining clocks. */
function throughEngine(input: RemainingClocksInput) {
  const simple = remainingToSimpleClocks(input);
  const state = clockStateFromSimple(simple, T0);
  const problems = validateClockState(state);
  const remaining = remainingClocks(state);
  return { simple, state, problems, remaining };
}

// ------------------------------------------------------ limits derive from HOS
check('limits: driving 11 h from HOS', CLOCK_INPUT_LIMITS_H.driving === HOS.MAX_DRIVING_MIN / 60);
check('limits: window 14 h from HOS', CLOCK_INPUT_LIMITS_H.window === HOS.MAX_WINDOW_MIN / 60);
check(
  'limits: break 8 h from HOS',
  CLOCK_INPUT_LIMITS_H.untilBreak === HOS.BREAK_AFTER_DRIVING_MIN / 60,
);
check('limits: cycle 70 h from HOS', CLOCK_INPUT_LIMITS_H.cycle === HOS.CYCLE_70_MIN / 60);

// -------------------------------------------------------------- fresh driver
{
  const fresh = freshRemainingClocks();
  check(
    'fresh: defaults are FULL limits, not zero',
    fresh.drivingLeftH === 11 &&
      fresh.windowLeftH === 14 &&
      fresh.untilBreakLeftH === 8 &&
      fresh.cycleLeftH === 70,
  );
  const { simple, problems, remaining } = throughEngine(fresh);
  check(
    'fresh: wire used values all zero',
    simple.drivingUsedMin === 0 && simple.drivingSinceBreakMin === 0 && simple.cycleUsedMin === 0,
  );
  check('fresh: full window remaining → no-window sentinel −1', simple.windowElapsedMin === -1);
  check('fresh: engine accepts the state', problems.length === 0, problems);
  check(
    'fresh: engine reports full remaining (11h/14h/8h/70h)',
    remaining.drivingMin === 660 &&
      remaining.windowMin === 840 &&
      remaining.untilBreakMin === 480 &&
      remaining.cycleMin === 4200,
    remaining,
  );
}

// ---------------------------------------------------- partial remaining values
{
  const { simple, problems, remaining } = throughEngine({
    drivingLeftH: 5,
    windowLeftH: 6,
    untilBreakLeftH: 2,
    cycleLeftH: 42,
  });
  check(
    'partial: used = limit − remaining on the wire',
    simple.drivingUsedMin === 360 &&
      simple.windowElapsedMin === 480 &&
      simple.drivingSinceBreakMin === 360 &&
      simple.cycleUsedMin === 1680,
  );
  check('partial: engine accepts', problems.length === 0, problems);
  check(
    'partial: engine hands back exactly what the driver entered',
    remaining.drivingMin === 300 &&
      remaining.windowMin === 360 &&
      remaining.untilBreakMin === 120 &&
      remaining.cycleMin === 2520,
    remaining,
  );
}

// --------------------------------------------------------------- zero driving
{
  const { remaining, problems } = throughEngine({
    drivingLeftH: 0,
    windowLeftH: 3,
    untilBreakLeftH: 0,
    cycleLeftH: 59,
  });
  check('zero driving: engine remaining drivingMin 0', remaining.drivingMin === 0);
  check('zero driving: engine accepts', problems.length === 0, problems);
}

// -------------------------------------------------------------- zero on-duty
{
  const { remaining } = throughEngine({
    drivingLeftH: 4,
    windowLeftH: 0,
    untilBreakLeftH: 4,
    cycleLeftH: 40,
  });
  check('zero window: engine remaining windowMin 0', remaining.windowMin === 0);
  check('zero window: legal driving now 0 (window caps it)', remaining.legalDrivingMin === 0);
}

// ------------------------------------------------------ break due immediately
{
  // Physically consistent: 8 h driven (3 left of 11) with 0 h until break.
  const { simple, remaining, problems } = throughEngine({
    drivingLeftH: 3,
    windowLeftH: 5,
    untilBreakLeftH: 0,
    cycleLeftH: 62,
  });
  check('break-now: sinceBreak on the wire is the full 8 h', simple.drivingSinceBreakMin === 480);
  check('break-now: engine says 0 min until break', remaining.untilBreakMin === 0);
  check('break-now: engine accepts', problems.length === 0, problems);
}
{
  // Physically IMPOSSIBLE combo (break due now but almost no driving done):
  // the centralized guard caps since-break at driving used, same as the old
  // submit path always did.
  const { simple } = throughEngine({
    drivingLeftH: 10,
    windowLeftH: 10,
    untilBreakLeftH: 0,
    cycleLeftH: 60,
  });
  check(
    'break-now guard: since-break capped at driving used (60 min)',
    simple.drivingSinceBreakMin === 60,
    simple,
  );
}

// ----------------------------------------------------------------- zero cycle
{
  const { remaining } = throughEngine({
    drivingLeftH: 11,
    windowLeftH: 14,
    untilBreakLeftH: 8,
    cycleLeftH: 0,
  });
  check('zero cycle: engine remaining cycleMin 0', remaining.cycleMin === 0);
  check('zero cycle: legal driving now 0 (cycle caps it)', remaining.legalDrivingMin === 0);
}

// -------------------------------------------------- cycle ≥ driving consistency
{
  const { simple } = throughEngine({
    drivingLeftH: 1, // 10 h driven today
    windowLeftH: 2,
    untilBreakLeftH: 1,
    cycleLeftH: 69, // claims only 1 h of cycle used — impossible
  });
  check('cycle guard: cycle used floored at driving used', simple.cycleUsedMin === 600, simple);
}

// -------------------------------------------------------------------- decimals
{
  const { simple, remaining } = throughEngine({
    drivingLeftH: 5.5,
    windowLeftH: 7.5,
    untilBreakLeftH: 2.5,
    cycleLeftH: 41.5,
  });
  check(
    'decimals: half-hours preserved on the wire',
    simple.drivingUsedMin === 330 &&
      simple.windowElapsedMin === 390 &&
      simple.drivingSinceBreakMin === 330 &&
      simple.cycleUsedMin === 1710,
  );
  check(
    'decimals: engine returns the half-hours',
    remaining.drivingMin === 330 && remaining.untilBreakMin === 150,
  );
}

// ----------------------------------------------------- clamping and rejection
{
  check('clamp: negative remaining → 0 (never negative)', clampRemainingHours(-3, 11) === 0);
  check('clamp: above limit → limit', clampRemainingHours(99, 11) === 11);
  check('clamp: NaN → full limit (fresh), never zero', clampRemainingHours(Number.NaN, 14) === 14);
  check('clamp: non-number → full limit', clampRemainingHours('7' as unknown, 8) === 8);
  check('clamp: undefined → full limit', clampRemainingHours(undefined, 70) === 70);
  check('clamp: Infinity → full limit', clampRemainingHours(Infinity, 11) === 11);
  check('clamp: valid decimal untouched', clampRemainingHours(6.5, 11) === 6.5);

  const { simple } = throughEngine({
    drivingLeftH: -5, // → 0 left → 11 h used
    windowLeftH: 99, // → 14 left → sentinel −1
    untilBreakLeftH: Number.NaN, // → 8 left → 0 used
    cycleLeftH: 200, // → 70 left → 0 used… floored to driving used
  });
  check(
    'malformed inputs converted safely end-to-end',
    simple.drivingUsedMin === 660 && simple.windowElapsedMin === -1 && simple.cycleUsedMin === 660,
    simple,
  );
}

// ------------------------------------------------------------ wire-shape guard
{
  const simple = remainingToSimpleClocks(freshRemainingClocks());
  check(
    'wire shape: unchanged SimpleClocks keys',
    Object.keys(simple).sort().join(',') ===
      'cycleRule,cycleUsedMin,drivingSinceBreakMin,drivingUsedMin,windowElapsedMin',
  );
  check('wire shape: cycle rule default 70/8 (as before)', simple.cycleRule === '70/8');
}

// ------------------------------------- persisted state: none exists, by proof
{
  // The planner has never persisted clock values: saved trips, recent places
  // and presets carry no clock fields, so old "used" data cannot exist and no
  // migration is required. This check keeps that conclusion executable.
  const stores =
    readFileSync('src/lib/trip-planner/saved-trips-store.ts', 'utf8') +
    readFileSync('src/components/trip-planner/useSavedTrips.ts', 'utf8');
  check(
    'no persisted clock semantics anywhere (no migration needed)',
    !/drivingUsed|windowElapsed|sinceBreak|cycleUsed|drivingLeft|windowLeft|breakLeft|cycleLeft|clocks/.test(
      stores,
    ),
  );
}

// -------------------------------------------------- UI wiring (source-pinned)
{
  const app = readFileSync('src/components/trip-planner/TripPlannerApp.tsx', 'utf8');
  check('ui: legend says hours remaining', app.includes('Your clocks right now (hours remaining)'));
  check('ui: old hours-used legend gone', !app.includes('(hours used)'));
  check('ui: helper text present', app.includes('Enter how much time you have available now'));
  for (const lbl of [
    'Driving time remaining (of 11h)',
    'On-duty time remaining (of 14h)',
    'Time remaining until required break (of 8h)',
    '70-hour cycle time remaining (of 70h)',
  ]) {
    check(`ui: label "${lbl}"`, app.includes(lbl));
  }
  check('ui: slider value labeled as left', app.includes('h left'));
  check(
    'ui: defaults are the full limits from the shared module',
    (app.match(/useState<number>\(CLOCK_INPUT_LIMITS_H\./g) ?? []).length === 4,
  );
  check(
    'ui: exactly ONE conversion callsite (centralized, not scattered)',
    (app.match(/remainingToSimpleClocks\(/g) ?? []).length === 1,
  );
  check('ui: no leftover clock used-minute math in the component', !/UsedMin:\s/.test(app));
  check(
    'ui: slider max values come from the shared module',
    (app.match(/CLOCK_INPUT_LIMITS_H\.(driving|window|untilBreak|cycle)/g) ?? []).length >= 8,
  );
}

console.log(`clock-input: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
