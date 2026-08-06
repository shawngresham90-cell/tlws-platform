'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DrivingView } from '@/lib/navigator/navigation-controller';
import type { MapData } from '@/lib/navigator/navigation-lifecycle';
import type { LatLng } from '@/lib/map/bounds';
import {
  createNavigationLifecycle,
  type NavigationLifecycle,
} from '@/lib/navigator/navigation-lifecycle';
import {
  createPilotLog,
  resolvePilotMode,
  type PilotLog,
  type PilotMode,
} from '@/lib/navigator/pilot-mode';
import { formatDriverDistanceMi } from '@/lib/navigator/format-units';
import { createNavigatorPlanPort, createNavigatorReplacementPort } from './route-port';
import { useGps } from './GpsProvider';
import { MotionLockOverlay } from './MotionLockOverlay';
import { HosStrip } from './HosStrip';
import { LockGate } from './LockGate';
import { PilotTripControls } from './PilotTripControls';

/**
 * Driving screen (milestone N5 visuals; milestone P1 wires the completed
 * navigation engine behind Pilot Mode). Maneuver card first and largest,
 * status as text, every target ≥ 64 px.
 *
 * P1 integration: ONE NavigationLifecycle instance connects destination
 * entry → the flag-gated route API → the immutable route session → the
 * composed navigation session (matcher → detector → caged rerouter →
 * arrival) → this screen. The component layer owns cadence and the clock;
 * every engine stays pure. Without Pilot Mode (production, or flag off)
 * this screen renders exactly the N5 preview: no route source, honest
 * "route unavailable", no provider spend possible (the endpoint 404s).
 */

const DEFAULT_HOS_LABEL = "No trip loaded — showing a fresh driver's full clocks.";

// Leaflet is browser-only and must never run during SSR; it also must not
// weigh on the first paint of a screen whose job is guidance.
const NavigationMap = dynamic(() => import('./NavigationMap').then((m) => m.NavigationMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 w-full items-center justify-center rounded-card border border-line text-lg text-muted sm:h-96">
      Loading map…
    </div>
  ),
});

export function DrivingScreenView({
  view,
  watching,
  onStart,
  onStop,
  lifecycleLine = null,
  destinationSlot = null,
  hosSourceLabel = DEFAULT_HOS_LABEL,
  mapSlot = null,
}: {
  view: DrivingView;
  watching: boolean;
  onStart: () => void;
  onStop: () => void;
  /** Pilot Mode line under the status text, e.g. the lifecycle state. */
  lifecycleLine?: string | null;
  /** Pilot Mode replaces the placeholder in the stationary-only gate. */
  destinationSlot?: ReactNode;
  hosSourceLabel?: string;
  /** The live navigation map, mounted under the maneuver card. */
  mapSlot?: ReactNode;
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
              In {formatDriverDistanceMi(view.maneuvers?.distanceMi)}
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

      {/* The map answers "where am I, what road is this, where am I going" —
          it sits directly under the maneuver card and never above it: the
          instruction is still the largest thing on the screen. */}
      {mapSlot}

      {/* Status as TEXT — never color alone; live region for changes. */}
      <p aria-live="polite" role="status" className="text-xl font-semibold text-ink">
        {statusText[view.status]}
        {view.lastKnown ? ' (last known)' : ''}
      </p>
      {lifecycleLine ? <p className="text-lg text-ink/70">{lifecycleLine}</p> : null}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xl text-ink/90">
        <dt>Route progress</dt>
        <dd>
          {view.routeMile !== null && view.totalMi !== null
            ? `mile ${view.routeMile.toFixed(1)} of ${view.totalMi.toFixed(1)}`
            : '—'}
        </dd>
        <dt>Distance remaining</dt>
        <dd>{formatDriverDistanceMi(view.remainingMi)}</dd>
        <dt>Speed</dt>
        <dd>{view.speedMph !== null ? `${Math.round(view.speedMph)} mph` : '—'}</dd>
      </dl>

      {/* Permanent HOS strip (milestone N6) — the driver's clocks against
          the drive, in every screen state. Clocks only count down while
          guidance is genuinely active; the label says exactly where its
          numbers come from. */}
      <HosStrip
        drivingActive={view.status === 'navigating' || view.status === 'position-degraded'}
        sourceLabel={hosSourceLabel}
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

      {/* Stationary-only affordance — gated by the shared map,
          demonstrating default-deny end to end. Pilot Mode mounts the
          trip controls here; otherwise the honest placeholder stands. */}
      <LockGate action="edit-destination" lockedLabel="Destination entry">
        {destinationSlot ?? (
          <p className="text-xl text-ink/80">
            Destination entry unlocks here when routing ships (a later milestone).
          </p>
        )}
      </LockGate>
    </div>
  );
}

export function DrivingScreen() {
  const { position, watching, start, stop } = useGps();

  // Pilot Mode resolves default-deny: the server pass has no hostname, so
  // it renders inactive; the client re-resolves once after mount.
  const [pilot, setPilot] = useState<PilotMode>(() =>
    resolvePilotMode({ flagValue: process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED, hostname: null }),
  );
  useEffect(() => {
    setPilot(
      resolvePilotMode({
        flagValue: process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED,
        hostname: window.location.hostname,
      }),
    );
  }, []);

  const logRef = useRef<PilotLog | null>(null);
  if (logRef.current === null) logRef.current = createPilotLog();
  const lifecycleRef = useRef<NavigationLifecycle | null>(null);
  if (lifecycleRef.current === null) {
    lifecycleRef.current = createNavigationLifecycle({
      planPort: createNavigatorPlanPort(),
      replacementPort: createNavigatorReplacementPort(),
      log: logRef.current,
    });
  }
  const lifecycle = lifecycleRef.current;
  const [, setRev] = useState(0);
  const bump = () => setRev((r) => r + 1);

  // One lifecycle tick per gated position update. GpsProvider re-renders
  // every second while a watch is active, so cadence rides that tick; the
  // lifecycle is reference-idempotent against double renders.
  const view = useMemo(() => lifecycle.tick(position, Date.now()).view, [position, lifecycle]);
  const lcState = lifecycle.state();

  // Off-route → ask the caged N8e rerouter. Re-entry is structurally
  // impossible: once requested the state is 'rerouting', not 'off-route',
  // and every budget/cooldown decision belongs to the controller.
  useEffect(() => {
    if (lcState !== 'off-route') return;
    const accuracyM =
      position.fix !== null && Number.isFinite(position.accuracyM) ? position.accuracyM : null;
    void lifecycle.requestReroute(Date.now(), accuracyM).then(bump);
  }, [lcState, position, lifecycle]);

  // Unmount = leaving the screen: cancel any live trip so no engine
  // outlives its owner (GpsProvider tears the watch down the same way).
  useEffect(() => () => void lifecycle.cancel(Date.now()), [lifecycle]);

  const tripLoaded = lcState !== 'idle' && lcState !== 'planning' && lcState !== 'completed';

  // Map data is a read-only projection of the live session; it is recomputed
  // with the view so a replacement route redraws the moment it lands.
  const mapData: MapData = useMemo(
    () => lifecycle.mapData(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lifecycle, view, lcState],
  );
  const truckPosition: LatLng | null =
    position.fix === null ? null : { lat: position.fix.lat, lng: position.fix.lng };

  return (
    <DrivingScreenView
      view={view}
      watching={watching}
      mapSlot={
        watching || mapData.geometry.length > 0 ? (
          <NavigationMap
            geometry={mapData.geometry}
            position={truckPosition}
            headingDeg={position.headingDeg}
            speedMph={view.speedMph}
            destination={mapData.destination}
            nextManeuver={mapData.nextManeuver}
            routeId={mapData.routeId}
          />
        ) : null
      }
      onStart={() => {
        start();
        bump();
      }}
      onStop={() => {
        // Stopping the preview also cancels any live pilot trip — the
        // summary stays honest ('cancelled'), the engines are released.
        lifecycle.cancel(Date.now());
        stop();
        bump();
      }}
      lifecycleLine={
        pilot.active && lcState !== 'idle'
          ? `Pilot trip state: ${lcState.replace(/-/g, ' ')}`
          : null
      }
      destinationSlot={
        pilot.active ? (
          <PilotTripControls
            lifecycle={lifecycle}
            fix={position.fix}
            debugLog={pilot.debugLogging ? logRef.current : null}
            onChanged={bump}
          />
        ) : null
      }
      hosSourceLabel={
        tripLoaded
          ? 'Pilot trip loaded — clocks still assume a fresh driver (no ELD linked).'
          : DEFAULT_HOS_LABEL
      }
    />
  );
}
