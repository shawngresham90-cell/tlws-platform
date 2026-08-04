'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The high-friction passenger acknowledgment (doc 06 §2). The wording is
 * the architecture document's, verbatim — not invented here. Requires a
 * PRESS AND HOLD of 2 full seconds (pointer or keyboard: hold Enter or
 * Space), not a tap; grants 15 minutes; the countdown banner and the
 * stop/start revocation live in the pure controller. Nothing about the
 * grant is ever persisted — reload always clears it by construction.
 */

export const HOLD_MS = 2000;

export function PassengerOverrideDialog({
  actionClass,
  onConfirm,
  onCancel,
}: {
  actionClass: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [holdStart, setHoldStart] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);

  function beginHold() {
    if (doneRef.current) return;
    const start = Date.now();
    setHoldStart(start);
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(1, elapsed / HOLD_MS));
      if (elapsed >= HOLD_MS && !doneRef.current) {
        doneRef.current = true;
        endHold();
        onConfirm();
      }
    }, 100);
  }

  function endHold() {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setHoldStart(null);
    setProgress(0);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div
      role="alertdialog"
      aria-label="Passenger confirmation"
      className="mt-3 space-y-4 rounded-card border border-line p-4"
    >
      <p className="text-xl font-semibold text-ink">
        Only a passenger may use this. I am not the driver of this vehicle.
      </p>
      <button
        type="button"
        onPointerDown={beginHold}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && holdStart === null) {
            e.preventDefault();
            beginHold();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === 'Enter' || e.key === ' ') endHold();
        }}
        className="min-h-16 w-full rounded-card border border-line px-4 text-xl text-ink"
        aria-label="Press and hold for two seconds to confirm you are a passenger"
        data-action-class={actionClass}
      >
        {holdStart === null
          ? 'Press and hold (2 seconds)'
          : `Keep holding — ${Math.ceil(((1 - progress) * HOLD_MS) / 1000)}s`}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="min-h-16 w-full rounded-card px-4 text-xl text-ink/80"
        aria-label="Cancel passenger access"
      >
        Cancel
      </button>
    </div>
  );
}
