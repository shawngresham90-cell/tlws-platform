'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  createSafetyLock,
  type SafetyLock,
  type SafetyLockState,
} from '@/lib/navigator/safety-lock';
import { allowedDuringSetupWindow, allowedWhileMoving } from '@/lib/navigator/actions';
import { useGps } from './GpsProvider';

/**
 * Global safety-lock enforcement (milestone N4). ONE provider evaluates
 * the motion state at 1 Hz from the gated GPS position; every gate below
 * consults the shared ACTION_PERMISSIONS map through this context.
 * Per-component motion checks are prohibited (doc 06 §1) — they drift.
 *
 * Privacy: the pure controller's override log carries no position, no
 * identity, no speed, and lives only in this component's memory. Nothing
 * here persists, transmits, or logs anything.
 */

const EVALUATE_MS = 1000;

type SafetyContextValue = {
  lock: SafetyLockState;
  /** Explicit passenger acknowledgment path — see PassengerOverrideDialog. */
  grantOverride: (actionClass: string) => void;
  permits: (action: string) => boolean;
};

const SafetyContext = createContext<SafetyContextValue | null>(null);

export function useSafetyLock(): SafetyContextValue {
  const value = useContext(SafetyContext);
  if (!value) throw new Error('useSafetyLock must be used inside <SafetyLockProvider>');
  return value;
}

function ephemeralSessionId(): string {
  try {
    return globalThis.crypto?.randomUUID?.() ?? `s-${Date.now().toString(36)}`;
  } catch {
    return `s-${Date.now().toString(36)}`;
  }
}

export function SafetyLockProvider({ children }: { children: ReactNode }) {
  const { position } = useGps();
  const lockRef = useRef<SafetyLock | null>(null);
  if (lockRef.current === null) lockRef.current = createSafetyLock(ephemeralSessionId());
  const controller = lockRef.current;

  const [lock, setLock] = useState<SafetyLockState>(() => controller.sample(position, Date.now()));

  // 1 Hz evaluation (doc 06 §1) — dwell timers advance even without new
  // fixes, and a stale fix decays to UNKNOWN (locked) on its own.
  const positionRef = useRef(position);
  positionRef.current = position;
  useEffect(() => {
    setLock(controller.sample(positionRef.current, Date.now()));
    const tick = setInterval(
      () => setLock(controller.sample(positionRef.current, Date.now())),
      EVALUATE_MS,
    );
    return () => clearInterval(tick);
  }, [controller]);

  const grantOverride = useCallback(
    (actionClass: string) => setLock(controller.grantOverride(Date.now(), actionClass)),
    [controller],
  );

  // Three ways an action can be usable, all decided by shared maps and
  // shared lock state — never per-component: the lock is open
  // (STATIONARY or an active override), the action is explicitly
  // permitted while moving, or the cold-start SETUP WINDOW is open and
  // the action is one the setup map explicitly names (doc 06 §1a).
  /*
   * FOUR ways an action can be usable, all decided by shared maps and
   * shared lock state — never per-component: the lock is open (STATIONARY
   * or an active override), the action is explicitly permitted while
   * moving, the cold-start SETUP WINDOW is open, or the PARKED GRACE is
   * running — a verified-stationary truck whose signal went quiet.
   *
   * The grace deliberately permits exactly the setup-window set and
   * nothing more: "keep only the parked setup actions that were already
   * available". It never widens the surface, it only stops withdrawing
   * one from a driver who has not moved.
   */
  const permits = useCallback(
    (action: string) =>
      !lock.locked ||
      allowedWhileMoving(action) ||
      ((lock.setupWindow || lock.parkedGrace) && allowedDuringSetupWindow(action)),
    [lock.locked, lock.setupWindow, lock.parkedGrace],
  );

  const value = useMemo(() => ({ lock, grantOverride, permits }), [lock, grantOverride, permits]);
  return <SafetyContext.Provider value={value}>{children}</SafetyContext.Provider>;
}
