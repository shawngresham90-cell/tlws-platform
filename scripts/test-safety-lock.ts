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
} from '@/lib/navigator/safety-lock';
import { allowedWhileMoving } from '@/lib/navigator/actions';
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
  const lock = createSafetyLock();
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
  const lock = createSafetyLock();
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

// ------------------------------------------------- the override is GONE
/*
 * NAV-ENTRY-1 removed the passenger override outright. These used to be the
 * grant/expiry/revocation tests; they are now ABSENCE tests, because the
 * failure this file has to catch changed shape. Nobody is going to
 * accidentally re-implement a fifteen-minute countdown — what could happen is
 * a well-meaning "let the driver unlock the camera for a second", and that is
 * exactly what an absent API prevents.
 */
{
  const lock = createSafetyLock();
  const surface = Object.keys(lock).sort().join(',');
  check('the controller exposes ONLY sample and state', surface === 'sample,state', surface);
  check(
    'there is no way to grant an override',
    !('grantOverride' in lock) && !('overrideLog' in lock),
  );

  for (let t = 0; t <= MOVING_DWELL_MS; t += 1000) lock.sample(moving(T0 + t), T0 + t);
  const movingState = lock.state(T0 + MOVING_DWELL_MS) as Record<string, unknown>;
  check('setup: MOVING', movingState.motion === 'MOVING');
  check(
    'a moving truck is locked, with no exception available',
    movingState.locked === true && movingState.lockReason === 'moving',
  );
  check(
    'the state carries no override fields at all',
    !('overrideActive' in movingState) && !('overrideRemainingMs' in movingState),
  );
  check(
    'the state is exactly the five facts the UI is allowed to read',
    Object.keys(movingState).sort().join(',') ===
      'lockReason,locked,motion,parkedGrace,setupWindow',
    Object.keys(movingState),
  );
}

// ---------------------------- what `locked` may still govern: the CAMERA
{
  /*
   * The permission map is the authority, so this asserts against it rather
   * than against a list retyped here. Editing must be permitted at speed;
   * the three camera actions must not be.
   */
  const editing = [
    'edit-destination',
    'edit-truck-profile',
    'add-stop',
    'enter-text',
    'open-deep-settings',
    'view-trip-summary',
  ];
  for (const action of editing) {
    check(`editing stays available while moving: ${action}`, allowedWhileMoving(action));
  }
  for (const action of ['pan-map', 'route-overview', 'change-map-style']) {
    check(`camera stays stationary-only: ${action}`, !allowedWhileMoving(action));
  }
  check('an unmapped action is still default-denied', !allowedWhileMoving('invented-action'));
}

// ---------------------------------------- same-state reference bailout
{
  const lock = createSafetyLock();
  for (let t = 0; t <= STATIONARY_DWELL_MS; t += 1000) lock.sample(parked(T0 + t), T0 + t);
  const a = lock.sample(parked(T0 + 40_000), T0 + 40_000);
  const b = lock.sample(parked(T0 + 41_000), T0 + 41_000);
  check('idle STATIONARY ticks return the SAME reference (no render churn)', a === b);
  const c = lock.state(T0 + 42_000);
  check('state() reuses the reference too', c === b);
}

console.log(`safety-lock: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
