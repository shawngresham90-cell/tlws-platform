'use client';

import { useSafetyLock } from './SafetyLockProvider';

/**
 * The motion status line (milestone N4, reworded by NAV-ENTRY-1).
 *
 * WHAT IT USED TO SAY. "Moving — controls limited for safety", and beneath it
 * a countdown banner while a passenger override was running. Both described a
 * lock that no longer exists: the driver's controls are not limited by motion
 * any more, and there is no override to count down.
 *
 * WHAT IT SAYS NOW. What the app can actually see about the vehicle, in text
 * and never in colour alone, in an aria-live region. That is worth keeping on
 * its own merits — a driver glancing at the screen learns whether the app has
 * a fix, which is the thing that decides whether the map, the ETA and the
 * off-route detection mean anything. It no longer makes a claim about what
 * the driver may or may not do, because it no longer decides that.
 *
 * The parked grace earns its own sentence here. A truck that was verifiably
 * stopped and then lost its signal has not started moving, and saying
 * "motion unknown" about it reads as a warning where the honest report is
 * that the sky went quiet.
 */
export function MotionLockOverlay() {
  const { lock } = useSafetyLock();
  const label =
    lock.motion === 'STATIONARY'
      ? 'Parked'
      : lock.motion === 'MOVING'
        ? 'Moving'
        : lock.parkedGrace
          ? 'Parked — location signal lost'
          : lock.setupWindow
            ? 'Location checks begin when you start'
            : 'Location unavailable';
  return (
    <div aria-live="polite" role="status" data-motion-status="" className="text-xl text-ink">
      <p className="font-semibold">{label}</p>
    </div>
  );
}
