/**
 * N4 SafetyLockController — the motion state machine from doc 06 §1,
 * exercised branch by branch through the REAL controller. Every unknown
 * state must resolve to locked; dwell must be sustained, not instant;
 * the override must expire, revoke on a stop/start cycle, and log
 * without position, identity, or speed.
 *
 * Run:
 *   npx esbuild scripts/test-safety-lock.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-safety-lock.cjs \
 *   && node /tmp/test-safety-lock.cjs
 */
import {
  createSafetyLock,
  MOVING_DWELL_MS,
  STATIONARY_DWELL_MS,
  OVERRIDE_DURATION_MS,
} from '@/lib/navigator/safety-lock';
import type { PositionState } from '@/lib/navigator/types';

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
function pos(over: Partial<PositionState>, tMs: number): PositionState {
  return {
    fix: { lat: 35, lng: -85, accuracyM: 8, tMs, speedMph: 0, headingDeg: 0 },
    health: 'good',
    lastFixMs: tMs,
    accuracyM: 8,
    speedMph: 0,
    headingDeg: 0,
    deadReckoning: false,
    ...over,
  };
}
const moving = (t: number, mph = 60) => pos({ speedMph: mph }, t);
const parked = (t: number) => pos({ speedMph: 0 }, t);

// ---------------------------------------------- every UNKNOWN path locks
{
  const lock = createSafetyLock('s1');
  check(
    'initial state is UNKNOWN and locked',
    lock.state(T0).motion === 'UNKNOWN' && lock.state(T0).locked,
  );
  const noFix = lock.sample(pos({ fix: null, health: 'unavailable', speedMph: null }, T0), T0);
  check('no fix → UNKNOWN, locked', noFix.motion === 'UNKNOWN' && noFix.locked);
  const denied = lock.sample(pos({ fix: null, health: 'denied', speedMph: null }, T0), T0);
  check(
    'permission denied → UNKNOWN, locked (denial gets the LOCKED interface)',
    denied.motion === 'UNKNOWN' && denied.locked,
  );
  const stale = lock.sample(pos({ speedMph: 40 }, T0), T0 + 11_000);
  check('fix older than 10 s → UNKNOWN, locked', stale.motion === 'UNKNOWN' && stale.locked);
  const lost = lock.sample(pos({ health: 'lost', speedMph: 40 }, T0), T0);
  check('health lost → UNKNOWN, locked', lost.motion === 'UNKNOWN' && lost.locked);
  const noSpeed = lock.sample(pos({ speedMph: null }, T0), T0);
  check(
    'speed unavailable/underivable → UNKNOWN, locked',
    noSpeed.motion === 'UNKNOWN' && noSpeed.locked,
  );
}

// ------------------------------------------- dwell: sustained, not instant
{
  const lock = createSafetyLock('s2');
  const first = lock.sample(moving(T0), T0);
  check('one fast fix is NOT moving yet (10 s dwell)', first.motion !== 'MOVING');
  const mid = lock.sample(moving(T0 + 5_000), T0 + 5_000);
  check('5 s of speed still not MOVING', mid.motion !== 'MOVING');
  const done = lock.sample(moving(T0 + MOVING_DWELL_MS), T0 + MOVING_DWELL_MS);
  check('≥5 mph sustained 10 s → MOVING', done.motion === 'MOVING' && done.locked);

  // Slowing: 30 s dwell to STATIONARY (a 4 mph queue is still traffic).
  const slow1 = lock.sample(parked(T0 + 20_000), T0 + 20_000);
  check('first slow fix still MOVING (30 s dwell)', slow1.motion === 'MOVING');
  const slow2 = lock.sample(parked(T0 + 20_000 + 15_000), T0 + 35_000);
  check('15 s slow still MOVING', slow2.motion === 'MOVING');
  const stopped = lock.sample(
    parked(T0 + 20_000 + STATIONARY_DWELL_MS),
    T0 + 20_000 + STATIONARY_DWELL_MS,
  );
  check(
    '<3 mph sustained 30 s → STATIONARY, unlocked',
    stopped.motion === 'STATIONARY' && !stopped.locked,
  );

  // Hysteresis band: 4 mph advances neither dwell.
  const band = lock.sample(moving(T0 + 60_000, 4), T0 + 60_000);
  check('3–5 mph band holds the current state', band.motion === 'STATIONARY');
  // Stop-and-go: brief spike then slow again never flickers to MOVING.
  lock.sample(moving(T0 + 61_000, 6), T0 + 61_000);
  const backSlow = lock.sample(parked(T0 + 63_000), T0 + 63_000);
  check('a 2 s speed spike does not unlock… lock MOVING', backSlow.motion === 'STATIONARY');
}

// ------------------------------------------------------- override lifecycle
{
  const lock = createSafetyLock('s3');
  for (let t = 0; t <= MOVING_DWELL_MS; t += 1000) lock.sample(moving(T0 + t), T0 + t);
  check('setup: MOVING', lock.state(T0 + MOVING_DWELL_MS).motion === 'MOVING');
  const t1 = T0 + MOVING_DWELL_MS + 1000;
  const granted = lock.grantOverride(t1, 'edit-destination');
  check('override grants 15 min while MOVING', granted.overrideActive && !granted.locked);
  check('countdown exposed', granted.overrideRemainingMs === OVERRIDE_DURATION_MS);
  const nearEnd = lock.state(t1 + OVERRIDE_DURATION_MS - 1);
  check('still active at 14:59.999', nearEnd.overrideActive);
  const expired = lock.state(t1 + OVERRIDE_DURATION_MS);
  check('EXPIRES at exactly 15 min → locked again', !expired.overrideActive && expired.locked);

  // Stop/start revocation on a fresh grant.
  const lock2 = createSafetyLock('s4');
  for (let t = 0; t <= MOVING_DWELL_MS; t += 1000) lock2.sample(moving(T0 + t), T0 + t);
  const g = lock2.grantOverride(T0 + 11_000, 'add-stop');
  check('grant active', g.overrideActive);
  let t = T0 + 12_000;
  for (let i = 0; i <= STATIONARY_DWELL_MS; i += 1000) lock2.sample(parked(t + i), t + i);
  check(
    'stopped with override still ticking',
    lock2.state(t + STATIONARY_DWELL_MS).motion === 'STATIONARY',
  );
  t = t + STATIONARY_DWELL_MS + 1000;
  let after = lock2.state(t);
  for (let i = 0; i <= MOVING_DWELL_MS; i += 1000) after = lock2.sample(moving(t + i), t + i);
  check(
    'MOVING → STATIONARY → MOVING revokes the grant immediately',
    after.motion === 'MOVING' && !after.overrideActive && after.locked,
  );

  // UNKNOWN mid-grant does not revoke (motion did not verifiably stop).
  const lock3 = createSafetyLock('s5');
  for (let i = 0; i <= MOVING_DWELL_MS; i += 1000) lock3.sample(moving(T0 + i), T0 + i);
  lock3.grantOverride(T0 + 11_000, 'enter-text');
  const unk = lock3.sample(pos({ speedMph: null }, T0 + 12_000), T0 + 12_000);
  check('UNKNOWN mid-grant keeps the countdown', unk.motion === 'UNKNOWN' && unk.overrideActive);

  // No-op when already usable.
  const lock4 = createSafetyLock('s6');
  for (let i = 0; i <= STATIONARY_DWELL_MS; i += 1000) lock4.sample(parked(T0 + i), T0 + i);
  const noop = lock4.grantOverride(T0 + 40_000, 'edit-destination');
  check('override is a no-op when STATIONARY (nothing to override)', !noop.overrideActive);
  check('no log entry for the no-op', lock4.overrideLog().length === 0);
}

// ------------------------------------------------------- override log shape
{
  const lock = createSafetyLock('session-x');
  for (let i = 0; i <= MOVING_DWELL_MS; i += 1000) lock.sample(moving(T0 + i), T0 + i);
  lock.grantOverride(T0 + 11_000, 'edit-destination');
  const log = lock.overrideLog();
  check('override logged once', log.length === 1);
  const entry = log[0] as Record<string, unknown>;
  check(
    'log carries ONLY {tMs, sessionId, durationMs, actionClass}',
    Object.keys(entry).sort().join(',') === 'actionClass,durationMs,sessionId,tMs',
    Object.keys(entry),
  );
  check(
    'log has NO position, identity, or speed',
    !('lat' in entry) && !('lng' in entry) && !('speedMph' in entry),
  );
}

// ---------------------------------------- same-state reference bailout
{
  const lock = createSafetyLock('s7');
  for (let t = 0; t <= STATIONARY_DWELL_MS; t += 1000) lock.sample(parked(T0 + t), T0 + t);
  const a = lock.sample(parked(T0 + 40_000), T0 + 40_000);
  const b = lock.sample(parked(T0 + 41_000), T0 + 41_000);
  check('idle STATIONARY ticks return the SAME reference (no render churn)', a === b);
  const c = lock.state(T0 + 42_000);
  check('state() reuses the reference too', c === b);
}

console.log(`safety-lock: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
