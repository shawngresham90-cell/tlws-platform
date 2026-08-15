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
 * The passenger override (doc 06 §2) is deliberately high-friction and
 * lives here as pure state: offered only on a locked-action attempt while
 * MOVING, granted for 15 minutes, revoked by a stop/start cycle, never
 * persisted (this module cannot persist anything — it has no I/O). The
 * override log carries NO position, NO identity, NO speed.
 *
 * THE SETUP WINDOW (pilot round 3, startup simplification — doc 06 §1a):
 * `setupWindow` is true while motion has been UNKNOWN continuously since
 * this lock was created — the cold start, before any watch has produced
 * a single MOVING or STATIONARY determination. In that window the app has
 * ZERO motion evidence either way, and the owner's decision for the pilot
 * is that a parked driver must be able to choose a destination and tap
 * Start BEFORE granting location. The window latches shut forever the
 * moment motion is first determined: after that, UNKNOWN goes back to
 * being treated as MOVING, because once motion has been seen, absence of
 * evidence is not evidence of stopping. What the window may unlock is not
 * decided here — that stays in the shared ACTION_PERMISSIONS authority
 * (actions.ts), which grants it to the trip-setup surface only.
 */

import type { PositionState } from './types';

export type MotionState = 'STATIONARY' | 'MOVING' | 'UNKNOWN';

export const MOVING_SPEED_MPH = 5;
export const MOVING_DWELL_MS = 10_000;
export const STATIONARY_SPEED_MPH = 3;
export const STATIONARY_DWELL_MS = 30_000;
export const POSITION_FRESH_MS = 10_000;
export const OVERRIDE_DURATION_MS = 15 * 60_000;

/**
 * How long a VERIFIED-STATIONARY truck keeps its parked setup after the
 * location signal goes quiet (Fast Start milestone).
 *
 * The pilot complaint this closes: a driver parked at a truck stop gets a
 * fix, is determined STATIONARY, then loses the fix under a canopy. Motion
 * falls to UNKNOWN, UNKNOWN is treated as MOVING, and the parked driver was
 * offered a PASSENGER DECLARATION to edit their own setup. The truck had not
 * moved; the app had merely stopped being able to see it.
 *
 * The existing rule — "once motion has been seen, absence of evidence is not
 * evidence of stopping" — is correct after MOVEMENT and wrong after a
 * stationary determination, because standing still is what the truck was
 * already doing. So the grace applies to exactly one prior state: STATIONARY.
 * After MOVING, GPS loss stays locked with no grace at all.
 *
 * 60 s is the documented ceiling. It is deliberately shorter than the
 * 15-minute passenger override and is cancelled instantly by any positive
 * movement evidence — a single sample at or above the moving threshold ends
 * it, without waiting for the 10 s dwell that a full MOVING determination
 * needs. Evidence of motion is allowed to be faster than certainty of motion,
 * because the two errors are not symmetric.
 */
export const STATIONARY_GRACE_MS = 60_000;

export type OverrideLogEntry = {
  /** When the override was granted (epoch ms). */
  tMs: number;
  /** Ephemeral session id — never a user identity. */
  sessionId: string;
  durationMs: number;
  /** The class of locked action that triggered the offer. */
  actionClass: string;
};

export type SafetyLockState = {
  motion: MotionState;
  /** UNKNOWN is treated as MOVING: locked is false ONLY when STATIONARY. */
  locked: boolean;
  /** Milliseconds remaining on an active passenger override, else 0. */
  overrideRemainingMs: number;
  /** True when the interface is usable despite motion (active override). */
  overrideActive: boolean;
  /**
   * True while motion has been UNKNOWN since this lock was created (the
   * cold start — no watch determination has ever been made). Latches
   * false forever on the first MOVING or STATIONARY determination. Only
   * actions the shared map explicitly marks setup-window-permitted may
   * read anything into it.
   */
  setupWindow: boolean;
  /**
   * True while a VERIFIED-STATIONARY truck has temporarily lost its
   * location signal, for up to `STATIONARY_GRACE_MS`. The parked setup
   * actions stay available and no passenger declaration is offered.
   * Cancelled immediately by any positive movement evidence, and never
   * entered from MOVING.
   */
  parkedGrace: boolean;
  /**
   * WHY the interface is locked, so a gate can say something true.
   *
   * `'moving'` is the only reason that may offer a passenger override —
   * the override exists for a real passenger in a moving vehicle, and
   * offering it to a parked driver asks them to declare something false.
   * `'location-unknown'` means the app cannot see the vehicle and says so.
   */
  lockReason: 'moving' | 'location-unknown' | null;
};

export type SafetyLock = {
  /** Feed the current gated position snapshot; returns the new state. */
  sample(position: PositionState, nowMs: number): SafetyLockState;
  /**
   * Grant the passenger override. Callers must only invoke this from the
   * explicit press-and-hold acknowledgment (doc 06 §2). No-op unless the
   * lock is currently engaged for motion (MOVING or UNKNOWN).
   */
  grantOverride(nowMs: number, actionClass: string): SafetyLockState;
  state(nowMs: number): SafetyLockState;
  /** In-memory override log — position-free by construction. */
  overrideLog(): readonly OverrideLogEntry[];
};

export function createSafetyLock(sessionId: string): SafetyLock {
  let motion: MotionState = 'UNKNOWN';
  // Dwell anchors: when the speed first crossed the relevant threshold.
  let aboveSinceMs: number | null = null;
  let belowSinceMs: number | null = null;
  let overrideUntilMs = 0;
  // Stop/start revocation: one full MOVING → STATIONARY → MOVING cycle
  // clears the grant, so track whether we stopped while an override ran.
  let stoppedDuringOverride = false;
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
  const log: OverrideLogEntry[] = [];

  // Same-state calls return the SAME reference (matching the gps-session
  // discipline) so the provider's setState bails out and an idle, parked
  // screen does not re-render once a second for nothing.
  let lastState: SafetyLockState | null = null;

  function currentState(nowMs: number): SafetyLockState {
    const overrideActive = overrideUntilMs > nowMs;
    const locked = motion !== 'STATIONARY' && !overrideActive;
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
      overrideRemainingMs: overrideActive ? overrideUntilMs - nowMs : 0,
      overrideActive,
      setupWindow: !everDetermined,
      parkedGrace,
      /*
       * MOVING is the only honest reason to offer a passenger override.
       * An unknown location is reported as exactly that — the app cannot
       * see the vehicle — rather than as movement nobody observed.
       */
      lockReason: !locked ? null : motion === 'MOVING' ? 'moving' : 'location-unknown',
    };
    if (
      lastState &&
      lastState.motion === next.motion &&
      lastState.locked === next.locked &&
      lastState.overrideRemainingMs === next.overrideRemainingMs &&
      lastState.overrideActive === next.overrideActive &&
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
      // re-earned. An active override keeps counting down: motion did not
      // verifiably STOP, so the grant is not revoked.
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
        if (stoppedDuringOverride && overrideUntilMs > nowMs) {
          // MOVING → STATIONARY → MOVING: the grant is revoked immediately.
          overrideUntilMs = 0;
        }
        stoppedDuringOverride = false;
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
        if (overrideUntilMs > nowMs) stoppedDuringOverride = true;
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

  function grantOverride(nowMs: number, actionClass: string): SafetyLockState {
    const now = currentState(nowMs);
    if (!now.locked) return now; // nothing to override when already usable
    overrideUntilMs = nowMs + OVERRIDE_DURATION_MS;
    stoppedDuringOverride = false;
    log.push({
      tMs: nowMs,
      sessionId,
      durationMs: OVERRIDE_DURATION_MS,
      actionClass,
    });
    return currentState(nowMs);
  }

  return {
    sample,
    grantOverride,
    state: currentState,
    overrideLog: () => log,
  };
}
