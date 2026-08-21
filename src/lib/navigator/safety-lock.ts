/**
 * SafetyLockController (Navigator milestone N4) — the motion lock state
 * machine from docs/navigator/06-safety.md §1, which governs every other
 * navigator document. Pure: position snapshots and time arrive as
 * arguments; nothing here reads a clock, the browser, or storage.
 *
 * Governing principle (doc 06): every ambiguous case resolves toward
 * locking; every unknown state is treated as the dangerous state.
 *
 *   STATIONARY → MOVING     speed ≥ 5 mph sustained 10 s
 *   MOVING → STATIONARY     speed < 3 mph sustained 30 s (longer dwell on
 *                           purpose: 4 mph in a queue is still traffic)
 *   UNKNOWN                 no permission · no fix · fix older than 10 s ·
 *                           speed unavailable and underivable
 *                           — ALWAYS treated as MOVING (locked)
 *
 * WHAT THIS CONTROLLER NO LONGER DOES (NAV-ENTRY-1). It used to gate the
 * driver's own EDITING — destination, truck, clocks, preferences — behind
 * motion, with a passenger override as the way out: a press-and-hold dialog
 * asking whoever held the phone to declare they were not driving. The owner
 * removed both. A parked driver whose GPS died under a truck-stop canopy was
 * being asked to declare something false in order to change their own
 * destination, and an app that makes a driver lie to it has already lost the
 * argument. Editing is now available at every motion state, with a reminder
 * that says so and disables nothing.
 *
 * WHAT IT STILL DOES, and why it was not deleted: the CAMERA. Dragging the
 * map away from the truck, opening the whole-route overview and switching the
 * basemap are attention sinks that leave a driver looking at somewhere they
 * are not — that is camera discipline, not editing policy, and it stands.
 * Everything downstream of `locked` is now exactly those three actions.
 *
 * There is no override of any kind. A locked camera control says what it is
 * and waits for the truck to stop; nothing anywhere can grant an exception,
 * because there is no longer a function that could.
 *
 * THE SETUP WINDOW (pilot round 3, startup simplification — doc 06 §1a):
 * `setupWindow` is true while motion has been UNKNOWN continuously since
 * this lock was created — the cold start, before any watch has produced
 * a single MOVING or STATIONARY determination. It latches shut forever the
 * moment motion is first determined: after that, UNKNOWN goes back to being
 * treated as MOVING, because once motion has been seen, absence of evidence
 * is not evidence of stopping.
 *
 * It no longer unlocks anything — the editing it used to exempt is now
 * unconditionally available. What still reads it is the driving screen, which
 * hides the redundant "Enable location" button during a cold start because
 * the one-tap Start already owns location at that point. A cold start is
 * genuinely different from a truck that has been seen moving, and the screen
 * is entitled to say so.
 */

import type { PositionState } from './types';

export type MotionState = 'STATIONARY' | 'MOVING' | 'UNKNOWN';

export const MOVING_SPEED_MPH = 5;
export const MOVING_DWELL_MS = 10_000;
export const STATIONARY_SPEED_MPH = 3;
export const STATIONARY_DWELL_MS = 30_000;
export const POSITION_FRESH_MS = 10_000;

/**
 * How long a VERIFIED-STATIONARY truck keeps its parked setup after the
 * location signal goes quiet (Fast Start milestone).
 *
 * The pilot complaint this closes: a driver parked at a truck stop gets a
 * fix, is determined STATIONARY, then loses the fix under a canopy. Motion
 * falls to UNKNOWN and UNKNOWN is treated as MOVING — so a truck that had not
 * moved was reported as one that might be. The app had merely stopped being
 * able to see it, and the status line should say that rather than imply
 * movement nobody observed.
 *
 * The existing rule — "once motion has been seen, absence of evidence is not
 * evidence of stopping" — is correct after MOVEMENT and wrong after a
 * stationary determination, because standing still is what the truck was
 * already doing. So the grace applies to exactly one prior state: STATIONARY.
 * After MOVING, GPS loss stays locked with no grace at all.
 *
 * 60 s is the documented ceiling, and it is cancelled instantly by any
 * positive movement evidence — a single sample at or above the moving
 * threshold ends it, without waiting for the 10 s dwell that a full MOVING
 * determination needs. Evidence of motion is allowed to be faster than
 * certainty of motion, because the two errors are not symmetric.
 */
export const STATIONARY_GRACE_MS = 60_000;

export type SafetyLockState = {
  motion: MotionState;
  /**
   * UNKNOWN is treated as MOVING: locked is false ONLY when STATIONARY.
   *
   * Since NAV-ENTRY-1 this governs the CAMERA actions alone — pan, route
   * overview, basemap style. No editing surface consults it, and nothing can
   * override it.
   */
  locked: boolean;
  /**
   * True while motion has been UNKNOWN since this lock was created (the
   * cold start — no watch determination has ever been made). Latches false
   * forever on the first MOVING or STATIONARY determination.
   */
  setupWindow: boolean;
  /**
   * True while a VERIFIED-STATIONARY truck has temporarily lost its
   * location signal, for up to `STATIONARY_GRACE_MS`. Cancelled immediately
   * by any positive movement evidence, and never entered from MOVING. The
   * status line reads it so a parked driver is told the signal dropped
   * rather than told they might be moving.
   */
  parkedGrace: boolean;
  /**
   * WHY the interface is locked, so a gate can say something true.
   *
   * `'moving'` means the truck was observed moving. `'location-unknown'`
   * means the app cannot see the vehicle and says exactly that, rather than
   * reporting movement nobody observed.
   */
  lockReason: 'moving' | 'location-unknown' | null;
};

export type SafetyLock = {
  /** Feed the current gated position snapshot; returns the new state. */
  sample(position: PositionState, nowMs: number): SafetyLockState;
  state(nowMs: number): SafetyLockState;
};

export function createSafetyLock(): SafetyLock {
  let motion: MotionState = 'UNKNOWN';
  // Dwell anchors: when the speed first crossed the relevant threshold.
  let aboveSinceMs: number | null = null;
  let belowSinceMs: number | null = null;
  // The setup window (doc 06 §1a): open until the FIRST motion
  // determination, then shut for the life of this lock. Deliberately
  // never re-opened — not on watch stop, not on position reset — because
  // "the app stopped getting fixes" must never hand typing back to a
  // driver who was last seen moving.
  let everDetermined = false;
  /*
   * WHICH determination was last reached. The grace below is granted only
   * after STATIONARY; a lock that follows MOVING gets none, which is the
   * established rule this milestone was told not to weaken.
   */
  let lastDetermined: 'STATIONARY' | 'MOVING' | null = null;
  /** When the signal was lost while verified stationary, else null. */
  let stationaryLostAtMs: number | null = null;

  // Same-state calls return the SAME reference (matching the gps-session
  // discipline) so the provider's setState bails out and an idle, parked
  // screen does not re-render once a second for nothing.
  let lastState: SafetyLockState | null = null;

  function currentState(nowMs: number): SafetyLockState {
    const locked = motion !== 'STATIONARY';
    /*
     * The grace is a property of TIME as well as state, so it is computed
     * here rather than latched in `sample` — a screen that stops sampling
     * cannot hold the grace open by going quiet.
     */
    const parkedGrace =
      locked &&
      motion === 'UNKNOWN' &&
      lastDetermined === 'STATIONARY' &&
      stationaryLostAtMs !== null &&
      nowMs - stationaryLostAtMs < STATIONARY_GRACE_MS;
    const next: SafetyLockState = {
      motion,
      locked,
      setupWindow: !everDetermined,
      parkedGrace,
      lockReason: !locked ? null : motion === 'MOVING' ? 'moving' : 'location-unknown',
    };
    if (
      lastState &&
      lastState.motion === next.motion &&
      lastState.locked === next.locked &&
      lastState.setupWindow === next.setupWindow &&
      lastState.parkedGrace === next.parkedGrace &&
      lastState.lockReason === next.lockReason
    ) {
      return lastState;
    }
    lastState = next;
    return next;
  }

  function sample(position: PositionState, nowMs: number): SafetyLockState {
    const fresh =
      position.fix !== null &&
      (position.health === 'good' || position.health === 'degraded') &&
      nowMs - position.lastFixMs <= POSITION_FRESH_MS;
    const speed = fresh ? position.speedMph : null;

    if (speed === null || !Number.isFinite(speed)) {
      // No permission, no fix, stale fix, or underivable speed: UNKNOWN,
      // treated as MOVING. Dwell anchors reset — certainty must be
      // re-earned.
      /*
       * The signal went quiet. If the truck was VERIFIED STATIONARY when
       * that happened, start the parked grace — it did not move, we simply
       * stopped seeing it. After MOVING, no grace is started at all.
       */
      if (motion === 'STATIONARY' && stationaryLostAtMs === null) stationaryLostAtMs = nowMs;
      motion = 'UNKNOWN';
      aboveSinceMs = null;
      belowSinceMs = null;
      return currentState(nowMs);
    }

    if (speed >= MOVING_SPEED_MPH) {
      /*
       * POSITIVE MOVEMENT EVIDENCE ENDS THE GRACE AT ONCE — one sample,
       * without waiting for the 10 s dwell a MOVING determination needs.
       * Being slow to unlock costs a driver seconds; being slow to lock
       * costs them a text field at speed.
       */
      stationaryLostAtMs = null;
      belowSinceMs = null;
      if (aboveSinceMs === null) aboveSinceMs = nowMs;
      if (motion !== 'MOVING' && nowMs - aboveSinceMs >= MOVING_DWELL_MS) {
        motion = 'MOVING';
        everDetermined = true;
        lastDetermined = 'MOVING';
      }
    } else if (speed < STATIONARY_SPEED_MPH) {
      aboveSinceMs = null;
      if (belowSinceMs === null) belowSinceMs = nowMs;
      if (motion !== 'STATIONARY' && nowMs - belowSinceMs >= STATIONARY_DWELL_MS) {
        motion = 'STATIONARY';
        everDetermined = true;
        lastDetermined = 'STATIONARY';
        // Re-established: a future signal loss earns a fresh grace.
        stationaryLostAtMs = null;
      }
    } else {
      // 3–5 mph hysteresis band: neither dwell advances; state holds (an
      // UNKNOWN state stays UNKNOWN — in-band speed is not sustained
      // evidence of either terminal state, and UNKNOWN is locked anyway).
      aboveSinceMs = null;
      belowSinceMs = null;
    }
    return currentState(nowMs);
  }

  return { sample, state: currentState };
}
