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
import { allowedWhileMoving } from '@/lib/navigator/actions';
import { useGps } from './GpsProvider';

/**
 * Global safety-lock enforcement (milestone N4). ONE provider evaluates
 * the motion state at 1 Hz from the gated GPS position; every gate below
 * consults the shared ACTION_PERMISSIONS map through this context.
 * Per-component motion checks are prohibited (doc 06 §1) — they drift.
 *
 * Since NAV-ENTRY-1 there is no override to grant, so this context offers no
 * way to grant one. The three camera actions are the only things `locked`
 * still governs; every editing surface is permitted outright by the map.
 *
 * Privacy: nothing here persists, transmits, or logs anything, and the state
 * it holds carries no position, no identity and no speed.
 */

const EVALUATE_MS = 1000;

type SafetyContextValue = {
  lock: SafetyLockState;
  permits: (action: string) => boolean;
};

const SafetyContext = createContext<SafetyContextValue | null>(null);

export function useSafetyLock(): SafetyContextValue {
  const value = useContext(SafetyContext);
  if (!value) throw new Error('useSafetyLock must be used inside <SafetyLockProvider>');
  return value;
}

export function SafetyLockProvider({ children }: { children: ReactNode }) {
  const { position } = useGps();
  const lockRef = useRef<SafetyLock | null>(null);
  if (lockRef.current === null) lockRef.current = createSafetyLock();
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

  /*
   * TWO ways an action can be usable, both decided by the shared map and the
   * shared lock state — never per-component: the truck is verifiably
   * STATIONARY, or the action is one the map permits while moving.
   *
   * There is no third way any more. The setup-window and parked-grace
   * exemptions both existed to hand editing back to a parked driver the lock
   * could not see; editing is no longer taken away, so there is nothing left
   * to hand back.
   */
  const permits = useCallback(
    (action: string) => !lock.locked || allowedWhileMoving(action),
    [lock.locked],
  );

  const value = useMemo(() => ({ lock, permits }), [lock, permits]);
  return <SafetyContext.Provider value={value}>{children}</SafetyContext.Provider>;
}
