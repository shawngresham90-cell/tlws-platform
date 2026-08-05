'use client';

import { useMemo, useRef, useState } from 'react';
import {
  createNavigationController,
  type DrivingView,
  type NavigationController,
} from '@/lib/navigator/navigation-controller';
import { useGps } from './GpsProvider';
import { useSafetyLock } from './SafetyLockProvider';
import { MotionLockOverlay } from './MotionLockOverlay';
import { HosStrip } from './HosStrip';
import { LockGate } from './LockGate';

/**
 * Basic driving screen (milestone N5, visual only — Phase 2A scope).
 * Maneuver card first and largest, status as text, no text input on this
 * screen at all, every target ≥ 64 px. Phase 2A ships NO route source:
 * the on-demand route endpoint is milestone N8 and paid HERE calls are
 * out of scope, so the default state is the honest "route unavailable"
 * (AD-8: guidance never starts without a real route). The controller
 * accepts an injected route in tests.
 *
 * Deferred deliberately: map tiles (N12), HOS strip (N6), one-touch
 * panels (N9), voice (N7), rerouting (N8), emergency mode data (N9).
 */

export function DrivingScreenView({
  view,
  watching,
  onStart,
  onStop,
}: {
  view: DrivingView;
  watching: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  const statusText: Record<DrivingView['status'], string> = {
    'no-route':
      'Route unavailable — no route is loaded. Plan a trip first; turn-by-turn routes arrive in a later milestone.',
    acquiring: 'Waiting for location permission and first fix…',
    navigating: 'Navigating',
    'position-degraded': 'Position approximate — guidance continues',
    'position-lost': 'Position unknown — showing last known position',
    'position-unavailable': 'Location unavailable from this device',
    denied: 'Location permission denied — navigation cannot run',
    arrived: 'Arrived — you are at the end of the route',
  };

  const m = view.maneuvers?.next ?? null;
  return (
    <div className="space-y-6">
      {/* Maneuver card — the largest element, ≥32px text, never scrolls away. */}
      <section aria-label="Next maneuver" className="rounded-card border border-line p-6">
        {m ? (
          <>
            <p className="text-2xl text-ink/80">
              In {view.maneuvers?.distanceMi?.toFixed(1) ?? '—'} mi
            </p>
            <p className="text-4xl font-semibold text-ink">{m.instruction}</p>
            {view.maneuvers?.following ? (
              <p className="mt-2 text-xl text-ink/70">
                then {view.maneuvers.following.instruction}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-3xl font-semibold text-ink">
            {view.status === 'arrived' ? 'You have arrived' : 'No maneuver to show'}
          </p>
        )}
      </section>

      {/* Status as TEXT — never color alone; live region for changes. */}
      <p aria-live="polite" role="status" className="text-xl font-semibold text-ink">
        {statusText[view.status]}
        {view.lastKnown ? ' (last known)' : ''}
      </p>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xl text-ink/90">
        <dt>Route progress</dt>
        <dd>
          {view.routeMile !== null && view.totalMi !== null
            ? `mile ${view.routeMile.toFixed(1)} of ${view.totalMi.toFixed(1)}`
            : '—'}
        </dd>
        <dt>Distance remaining</dt>
        <dd>{view.remainingMi !== null ? `${view.remainingMi.toFixed(1)} mi` : '—'}</dd>
        <dt>Speed</dt>
        <dd>{view.speedMph !== null ? `${Math.round(view.speedMph)} mph` : '—'}</dd>
      </dl>

      {/* Permanent HOS strip (milestone N6) — the driver's clocks against
          the drive, in every screen state. Clocks only count down while
          guidance is genuinely active; the 2A preview has no trip source,
          so the strip says exactly where its numbers come from. */}
      <HosStrip
        drivingActive={view.status === 'navigating' || view.status === 'position-degraded'}
        sourceLabel="No trip loaded — showing a fresh driver's full clocks."
      />

      <MotionLockOverlay />

      {/* Stop is the always-visible exit control — allowed while moving. */}
      <LockGate action="stop-navigation" lockedLabel="Stop navigation">
        {watching ? (
          <button
            type="button"
            onClick={onStop}
            className="min-h-16 w-full rounded-card border border-line px-4 text-xl font-semibold text-ink"
            aria-label="Stop navigation and discard position"
          >
            Stop navigation
          </button>
        ) : (
          <button
            type="button"
            onClick={onStart}
            className="min-h-16 w-full rounded-card border border-line px-4 text-xl font-semibold text-ink"
            aria-label="Enable location and start the driving preview"
          >
            Enable location
          </button>
        )}
      </LockGate>

      {/* Stationary-only affordance (destination entry ships with N8) —
          gated by the shared map, demonstrating default-deny end to end. */}
      <LockGate action="edit-destination" lockedLabel="Destination entry">
        <p className="text-xl text-ink/80">
          Destination entry unlocks here when routing ships (a later milestone).
        </p>
      </LockGate>
    </div>
  );
}

export function DrivingScreen() {
  const { position, watching, start, stop } = useGps();
  const controllerRef = useRef<NavigationController | null>(null);
  // Phase 2A has no route source (see header): the controller starts with
  // route = null and renders the route-unavailable state.
  if (controllerRef.current === null) controllerRef.current = createNavigationController(null);
  const [, setTick] = useState(0);
  const view = useMemo(() => {
    void watching;
    return controllerRef.current!.update(position);
  }, [position, watching]);

  return (
    <DrivingScreenView
      view={view}
      watching={watching}
      onStart={() => {
        start();
        setTick((t) => t + 1);
      }}
      onStop={() => {
        stop();
        setTick((t) => t + 1);
      }}
    />
  );
}
