'use client';

import type { ReactNode } from 'react';
import { useSafetyLock } from './SafetyLockProvider';

/**
 * The ONLY motion gate (milestone N4). Consults the shared permission map
 * through the SafetyLockProvider — default-deny: an action that is not
 * explicitly permitted while moving renders the locked fallback instead of
 * its children.
 *
 * WHAT IT GATES NOW (NAV-ENTRY-1): the camera, and nothing else. Panning off
 * the truck, the whole-route overview, the basemap switch. Every editing
 * action is permitted outright by the map, so wrapping one in this component
 * is a no-op that documents the policy rather than a gate that fires.
 *
 * THERE IS NO PASSENGER ACCESS. The locked state used to offer a
 * press-and-hold dialog asking the person holding the phone to declare they
 * were not driving, granting fifteen minutes of unrestricted use. It is gone
 * — the dialog, the timer, the countdown, the grant, the log. What is left is
 * a control that says it is unavailable and comes back on its own when the
 * truck stops. That is the whole mechanism, and there is deliberately no way
 * around it, because the things still gated are the ones where "I'm the
 * passenger" was always the least likely explanation.
 *
 * The gate never inspects motion itself (doc 06 §1 — the map through the
 * provider is the only authority).
 */
export function LockGate({
  action,
  children,
  lockedLabel,
  compact = false,
}: {
  action: string;
  children?: ReactNode;
  /** Accessible description of what is unavailable, e.g. "Route overview". */
  lockedLabel: string;
  /**
   * Cockpit-row variant (full-screen map): the locked state renders as ONE
   * row-sized button instead of an explanatory box. The full box measured
   * 306 px tall in the driving surface's bottom band, and at that size it was
   * the single biggest thing between the driver and the map. The POLICY is
   * identical either way — children never render while locked, and the shared
   * map stays the only authority.
   */
  compact?: boolean;
}) {
  const { permits, lock } = useSafetyLock();

  if (permits(action)) return <>{children}</>;

  /*
   * TWO REASONS, TWO SENTENCES, and neither of them asks the driver anything.
   *
   * `location-unknown` means the app cannot see the vehicle; it says that and
   * says nothing about who is driving. `moving` means the truck was observed
   * moving. Both end the same way — it returns on its own — because both are
   * temporary states the driver does not need to act on.
   */
  const unknown = lock.lockReason === 'location-unknown';
  const reason = unknown
    ? `We can’t confirm this vehicle’s location right now, so this control is paused. It returns on its own once the signal comes back.`
    : `This view moves the map away from your truck, so it waits until you’re stopped. It returns on its own.`;

  if (compact) {
    /*
     * STILL A BUTTON, and deliberately. The cockpit row is a row of controls;
     * a bare <div> in one slot leaves a driver looking at a gap where the
     * control they want used to be, and a screen reader with nothing to land
     * on. So the slot keeps a real control that announces why it is
     * unavailable and does nothing when pressed — `aria-disabled` rather than
     * `disabled`, so it stays focusable and can still say what it is.
     */
    return (
      <button
        type="button"
        aria-disabled="true"
        data-lock-reason={unknown ? 'location-unknown' : 'moving'}
        className="min-h-16 min-w-0 w-full truncate rounded-cockpit border border-line bg-nav-surface px-3 text-lg text-ink/80"
        aria-label={`${lockedLabel} is paused — ${reason}`}
      >
        <span aria-hidden="true">{unknown ? '📡 ' : '⏸ '}</span>
        {lockedLabel} paused
      </button>
    );
  }

  return (
    <div
      role="status"
      data-lock-reason={unknown ? 'location-unknown' : 'moving'}
      className="rounded-card border border-line p-4 text-ink/80"
    >
      <p className="text-lg font-semibold text-ink">{lockedLabel} is paused</p>
      <p className="mt-1 text-base">{reason}</p>
    </div>
  );
}
