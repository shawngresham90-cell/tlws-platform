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
 */

import type { PositionState } from './types';

export type MotionState = 'STATIONARY' | 'MOVING' | 'UNKNOWN';

export const MOVING_SPEED_MPH = 5;
export const MOVING_DWELL_MS = 10_000;
export const STATIONARY_SPEED_MPH = 3;
export const STATIONARY_DWELL_MS = 30_000;
export const POSITION_FRESH_MS = 10_000;
export const OVERRIDE_DURATION_MS = 15 * 60_000;

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
  const log: OverrideLogEntry[] = [];

  function currentState(nowMs: number): SafetyLockState {
    const overrideActive = overrideUntilMs > nowMs;
    return {
      motion,
      locked: motion !== 'STATIONARY' && !overrideActive,
      overrideRemainingMs: overrideActive ? overrideUntilMs - nowMs : 0,
      overrideActive,
    };
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
      motion = 'UNKNOWN';
      aboveSinceMs = null;
      belowSinceMs = null;
      return currentState(nowMs);
    }

    if (speed >= MOVING_SPEED_MPH) {
      belowSinceMs = null;
      if (aboveSinceMs === null) aboveSinceMs = nowMs;
      if (motion !== 'MOVING' && nowMs - aboveSinceMs >= MOVING_DWELL_MS) {
        motion = 'MOVING';
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
