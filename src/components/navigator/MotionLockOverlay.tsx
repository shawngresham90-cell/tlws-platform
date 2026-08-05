'use client';

import { useSafetyLock } from './SafetyLockProvider';

/**
 * Always-visible lock status (milestone N4): the motion state as TEXT
 * (never color alone) in an aria-live region, plus the override countdown
 * banner the doc requires to stay visible while a grant is active.
 */
export function MotionLockOverlay() {
  const { lock } = useSafetyLock();
  const label =
    lock.motion === 'STATIONARY'
      ? 'Parked — full controls available'
      : lock.motion === 'MOVING'
        ? 'Moving — controls limited for safety'
        : 'Motion unknown — controls limited for safety';
  return (
    <div aria-live="polite" role="status" className="space-y-1 text-xl text-ink">
      <p className="font-semibold">{label}</p>
      {lock.overrideActive ? (
        <p className="text-ink/80">
          Passenger access active — {Math.ceil(lock.overrideRemainingMs / 60_000)} min remaining.
          Ends automatically, and when the vehicle stops and starts again.
        </p>
      ) : null}
    </div>
  );
}
