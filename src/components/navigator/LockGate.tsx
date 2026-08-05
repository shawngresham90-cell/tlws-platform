'use client';

import { useState, type ReactNode } from 'react';
import { useSafetyLock } from './SafetyLockProvider';
import { PassengerOverrideDialog } from './PassengerOverrideDialog';

/**
 * The ONLY motion gate (milestone N4). Consults the shared permission map
 * through the SafetyLockProvider — default-deny: an action that is not
 * explicitly permitted while moving renders the locked fallback instead of
 * its children. The passenger override is offered ONLY here, only when a
 * locked action was actually attempted (doc 06 §2) — never proactively.
 */
export function LockGate({
  action,
  children,
  lockedLabel,
}: {
  action: string;
  children?: ReactNode;
  /** Accessible description of what is locked, e.g. "Destination entry". */
  lockedLabel: string;
}) {
  const { permits, grantOverride } = useSafetyLock();
  const [offering, setOffering] = useState(false);

  if (permits(action)) return <>{children}</>;

  // The gate never inspects motion itself (doc 06 §1 — the map through the
  // provider is the only authority); the copy names both lock reasons.
  return (
    <div role="status" className="rounded-card border border-line p-4 text-ink/80">
      <p className="text-xl">
        {lockedLabel} is locked while the vehicle is moving or motion is unknown.
      </p>
      {!offering ? (
        <button
          type="button"
          onClick={() => setOffering(true)}
          className="mt-3 min-h-16 w-full rounded-card border border-line px-4 text-xl text-ink"
          aria-label={`Passenger access to ${lockedLabel}`}
        >
          Passenger access
        </button>
      ) : (
        <PassengerOverrideDialog
          actionClass={action}
          onConfirm={() => {
            grantOverride(action);
            setOffering(false);
          }}
          onCancel={() => setOffering(false)}
        />
      )}
    </div>
  );
}
