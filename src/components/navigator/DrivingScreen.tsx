'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DrivingView } from '@/lib/navigator/navigation-controller';
import type { LifecycleState, MapData } from '@/lib/navigator/navigation-lifecycle';
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
import {
  createManeuverAnnouncer,
  createStatusAnnouncer,
  createVoiceGuidance,
  tripVoiceRequest,
  type ManeuverAnnouncer,
  type VoiceGuidance,
} from '@/lib/navigator/voice-guidance';
import { createNavigatorPlanPort, createNavigatorReplacementPort } from './route-port';
import { createBrowserSpeechPort } from './speech-port';
import { formatEta } from '@/lib/navigator/driving-hud';
import { normalizeInstruction, roadNameFromInstruction } from '@/lib/navigator/maneuver-text';
import { createScreenWake, type ScreenWake } from '@/lib/navigator/screen-wake';
import { buildRoadTestReport } from '@/lib/navigator/road-test-report';
import { offlineNotice } from '@/lib/navigator/network-status';
import { createBrowserWakePort } from './wake-lock-port';
import { DEFAULT_MAP_STYLE, type MapStyleId } from '@/lib/navigator/map-style';
import { MapStyleControl } from './MapStyleControl';
import { useSafetyLock } from './SafetyLockProvider';
import { useGps } from './GpsProvider';
import { MotionLockOverlay } from './MotionLockOverlay';
import { HosStrip } from './HosStrip';
import { LockGate } from './LockGate';
import { PilotTripControls } from './PilotTripControls';
import { VoiceControls } from './VoiceControls';

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

/**
 * States where guidance is genuinely live, and the screen becomes the
 * map-first driving surface instead of a page. 'route-ready' is NOT here:
 * the driver has not started yet and still needs the ordinary controls.
 */
const ACTIVE_LIFECYCLE_STATES: readonly string[] = [
  'navigating',
  'off-route',
  'rerouting',
  'final-approach',
];

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
  focusNavigationKey = null,
  voice,
  fullScreen = false,
  roadName = null,
  etaText = null,
  overviewSlot = null,
  mapStyleSlot = null,
  offlineText = null,
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
  /**
   * Changes when a trip STARTS. The start control lives at the bottom of
   * the page (inside the stationary-only gate), so without this the driver
   * is left looking at the trip controls while the maneuver card and map
   * are off-screen above — the round-2 road test's exact complaint.
   */
  focusNavigationKey?: string | null;
  /** N7 voice guidance; static test renders may omit it. */
  voice?: VoiceGuidance;
  /** Active guidance: render the viewport-filling, map-first surface. */
  fullScreen?: boolean;
  /** Road the next maneuver puts the truck on, when the provider named it. */
  roadName?: string | null;
  /** Clock-time arrival estimate, e.g. "3:45 PM". */
  etaText?: string | null;
  /** Route-overview control, already wrapped in its own LockGate. */
  overviewSlot?: ReactNode;
  /** Map-style picker, already wrapped in its own LockGate. */
  mapStyleSlot?: ReactNode;
  /** Offline notice in navigation's terms; null when online or unknown. */
  offlineText?: string | null;
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

  // When a trip starts, put the driver on the guidance — not on the
  // controls they just used, which sit below the fold.
  const navTopRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (focusNavigationKey === null) return;
    const el = navTopRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      // `html { scroll-behavior: auto }` under reduced motion does NOT
      // override an explicit `behavior: 'smooth'` passed here — the
      // argument wins. So the preference is read directly, or a driver
      // who asked for no motion gets an animated scroll anyway at the one
      // moment the screen jumps on its own.
      const reduced =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
    }
  }, [focusNavigationKey]);

  // A maneuver card that reads over any basemap: opaque backing, road
  // name when the provider named one, and the following turn.
  const maneuverCard = (
    <section
      ref={navTopRef}
      aria-label="Next maneuver"
      // The cap keeps the map owning the screen. It used to be a flat
      // 28dvh with overflow-hidden, which on a short screen cut the card
      // mid-glyph and gave no sign anything had been cut: measured at
      // 568x320 during navigation, 248 px of content in a 90 px box, and
      // what got cut was the INSTRUCTION — "Turn right onto Old Mill Road
      // towa". Losing the road name is a nuisance; losing the turn is the
      // whole point of the screen. On a short viewport the cap rises so
      // the distance and two lines of instruction always fit. The 600 px
      // threshold is measured, not guessed: a 568 px-tall phone in
      // portrait still overflowed at 480.
      className="max-h-[28dvh] shrink-0 overflow-hidden scroll-mt-4 rounded-card border border-line bg-asphalt/95 p-3 shadow-lg [@media(max-height:600px)]:max-h-[40dvh] sm:p-6"
    >
      {m ? (
        <>
          <p className="text-xl text-ink/80 sm:text-2xl">
            In {formatDriverDistanceMi(view.maneuvers?.distanceMi)}
          </p>
          {/* Sized so the map still owns the screen on a 320 px phone: the
              instruction is the largest text, but it may not eat the map.
              Clamped rather than clipped — two lines and an ellipsis says
              "there is more"; a hard cut mid-word says nothing at all. */}
          {/*
            A live region, and the ONLY one on the card. A driver using a
            screen reader with voice guidance muted — and voice starts
            muted by design — was never told a turn was coming at all;
            they had to keep asking. The instruction text changes exactly
            once per maneuver, so announcing it is the accessible analogue
            of the announce-once policy voice already follows.

            The distance line above is deliberately NOT part of it: it
            changes every second, and a live region that fires every
            second is one a driver turns off.
          */}
          <p
            aria-live="polite"
            className="line-clamp-2 text-2xl font-semibold leading-tight text-ink sm:text-4xl"
          >
            {normalizeInstruction(m.instruction) ?? m.instruction}
          </p>
          {/* The two supporting lines are the ones that go when there is
              no room. Dropped deliberately on a short screen rather than
              left to be sliced by the cap — and the road name costs least
              of all, since the provider's instruction already names the
              road ("Turn right onto Old Mill Road" / "on Old Mill Road"). */}
          {roadName ? (
            <p className="text-base text-ink/80 [@media(max-height:600px)]:hidden sm:text-xl">
              on {roadName}
            </p>
          ) : null}
          {view.maneuvers?.following ? (
            <p className="mt-1 truncate text-base text-ink/70 [@media(max-height:600px)]:hidden sm:text-xl">
              then{' '}
              {normalizeInstruction(view.maneuvers.following.instruction) ??
                view.maneuvers.following.instruction}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-3xl font-semibold text-ink">
          {view.status === 'arrived' ? 'You have arrived' : 'No maneuver to show'}
        </p>
      )}
    </section>
  );

  // Compact bottom readout for the driving surface.
  const compactStrip = (
    <dl className="grid shrink-0 grid-cols-3 gap-2 rounded-card border border-line bg-asphalt/95 px-3 py-1 text-center text-ink">
      <div>
        <dt className="text-xs text-ink/70">Speed</dt>
        <dd className="text-xl font-semibold sm:text-2xl">
          {view.speedMph !== null ? `${Math.round(view.speedMph)} mph` : '—'}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-ink/70">Remaining</dt>
        <dd className="text-xl font-semibold sm:text-2xl">
          {formatDriverDistanceMi(view.remainingMi)}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-ink/70">Arrive</dt>
        <dd className="text-xl font-semibold sm:text-2xl">{etaText ?? '—'}</dd>
      </div>
    </dl>
  );

  // ---- ONE tree for both modes -------------------------------------------
  // Active navigation is a viewport-filling application surface (no browser
  // fullscreen API); every other state is the ordinary page. Critically the
  // ELEMENT ORDER is identical in both, and only classes change: React
  // therefore keeps the map component MOUNTED across the
  // route-ready → navigating transition. Two separate trees would unmount
  // it, tearing down and rebuilding the Leaflet instance mid-trip — a
  // visible reload exactly when the driver starts moving.
  // z-50, not z-40: the site-wide offline banner is `fixed top-16 z-40`
  // and is mounted AFTER {children} in the root layout, so at equal z it
  // painted over this surface — 64 px down, which is the maneuver card.
  // A site banner about parking and weather may not cover a turn. Above
  // it, the driving surface owns the whole viewport and says its own,
  // navigation-specific thing about being offline.
  const shellCls = fullScreen
    ? 'fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-asphalt'
    : '';
  // Portrait stacks card → map → readouts. Landscape becomes a two-column
  // grid — readouts left, map spanning the right — WITHOUT reordering the
  // DOM, so the map still never remounts.
  const surfaceCls = fullScreen
    ? 'flex h-[100dvh] flex-col gap-2 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] ' +
      'landscape:grid landscape:grid-cols-[minmax(0,38%)_minmax(0,1fr)] ' +
      'landscape:grid-rows-[auto_auto_auto_1fr] landscape:items-start'
    : 'space-y-6';
  const colOne = fullScreen ? 'shrink-0 landscape:col-start-1' : '';
  // The map is pinned to the VIEWPORT in landscape, not to the grid. It
  // used to be `h-full`, which is 100% of the grid — and the grid's three
  // auto rows are the left column's content, which on a 320 px-tall phone
  // on its side needs about 500 px. Measured in Chromium at 568x320: the
  // grid ran to 510 px, the map with it, and 190 px of the map — the edge
  // its own Recenter and zoom controls sit on — was below the fold before
  // the driver touched anything. Sizing off the viewport makes the map
  // exactly as tall as the screen no matter what the left column does.
  // (`p-2` is 0.5rem top and bottom, hence the 1rem.)
  const mapWrapCls = fullScreen
    ? 'relative min-h-[38dvh] flex-1 overflow-hidden rounded-card border border-line ' +
      'landscape:col-start-2 landscape:row-start-1 landscape:row-span-4 ' +
      'landscape:h-[calc(100dvh-1rem)] landscape:min-h-0'
    : '';

  return (
    <div className={shellCls}>
      <div className={surfaceCls}>
        <div className={colOne}>{maneuverCard}</div>

        {/* The map: the driving surface's primary element, and the one
            component that must survive the layout switch untouched. */}
        <div className={mapWrapCls}>{mapSlot}</div>

        {/* Status as TEXT — never color alone; live region for changes. */}
        <p
          aria-live="polite"
          role="status"
          className={
            fullScreen
              ? `${colOne} truncate text-sm font-semibold text-ink`
              : 'text-xl font-semibold text-ink'
          }
        >
          {statusText[view.status]}
          {view.lastKnown ? ' (last known)' : ''}
        </p>

        {/* Network, in navigation's terms. The route and its maneuvers
            were downloaded when the trip was planned and live in memory,
            and matching, off-route detection and arrival are all pure —
            so offline costs exactly one thing, and the line says which. */}
        {offlineText ? (
          <p
            aria-live="polite"
            role="status"
            className={
              fullScreen
                ? `${colOne} text-sm font-semibold text-ink`
                : 'text-xl font-semibold text-ink'
            }
          >
            {offlineText}
          </p>
        ) : null}

        <div className={colOne}>
          {fullScreen ? (
            compactStrip
          ) : (
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
          )}
        </div>

        {/* Permanent HOS strip (milestone N6) — the driver's clocks against
            the drive, in every screen state. In landscape the map needs the
            height more than the clocks need the space. */}
        <div className={fullScreen ? `${colOne} landscape:hidden` : ''}>
          <HosStrip
            drivingActive={
              fullScreen || view.status === 'navigating' || view.status === 'position-degraded'
            }
            sourceLabel={hosSourceLabel}
            voice={voice}
          />
        </div>

        {/* Stop is the always-visible exit control — allowed while moving.
            Voice mute rides the SAME row rather than taking one of its own:
            the driving surface is height-constrained, and a second row
            would eat the map's floor on a 320 px phone. Mute is allowed
            while moving by the shared permission map, like Stop, so it
            must live here on the driving surface and not below the fold. */}
        <div className={fullScreen ? `${colOne} flex gap-2` : ''}>
          {fullScreen ? overviewSlot : null}
          {voice ? (
            <LockGate action="mute-voice" lockedLabel="Voice mute">
              <VoiceControls voice={voice} compact={fullScreen} />
            </LockGate>
          ) : null}
          <LockGate action="stop-navigation" lockedLabel="Stop navigation">
            {watching ? (
              <button
                type="button"
                onClick={onStop}
                className="min-h-16 w-full rounded-card border border-line px-4 text-xl font-semibold text-ink"
                aria-label="Stop navigation and discard position"
              >
                {fullScreen ? 'Stop' : 'Stop navigation'}
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
        </div>
      </div>

      {/* Below the driving surface: everything that must not compete with
          guidance. In full-screen this sits past the fold; on the ordinary
          page it simply continues. */}
      <div className={fullScreen ? 'space-y-4 p-4' : 'mt-6 space-y-6'}>
        <MotionLockOverlay />
        {lifecycleLine ? <p className="text-lg text-ink/70">{lifecycleLine}</p> : null}
        {mapStyleSlot}

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
    </div>
  );
}

export function DrivingScreen() {
  const { position, watching, start, stop } = useGps();
  // Motion policy comes from the ONE shared map (doc 06 §1); the map
  // component never decides for itself whether browsing is permitted.
  const { permits } = useSafetyLock();

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

  // Voice guidance (N7) — ONE instance, ONE speech owner, created MUTED:
  // nothing is ever spoken on page load; the driver enables it through
  // VoiceControls. Announcers live in refs so StrictMode double-effects
  // hit the same announce-once state and stay silent.
  const voiceRef = useRef<VoiceGuidance | null>(null);
  if (voiceRef.current === null) {
    voiceRef.current = createVoiceGuidance(createBrowserSpeechPort(), { startMuted: true });
  }
  // Screen wake (Block 2 / priority I). A phone sleeps its screen in
  // thirty seconds; on the driving surface that means the next maneuver
  // is on a dark screen and the only way to see it is to touch the
  // phone. The controller owns the policy; this is just its single
  // instance, alive for as long as the screen is.
  const wakeRef = useRef<ScreenWake | null>(null);
  if (wakeRef.current === null) {
    wakeRef.current = createScreenWake(createBrowserWakePort());
  }
  const maneuverAnnouncerRef = useRef<ManeuverAnnouncer>(createManeuverAnnouncer());
  const statusAnnouncerRef = useRef(createStatusAnnouncer());
  const spokenRouteIdRef = useRef<string | null>(null);
  const prevLcStateRef = useRef<LifecycleState>('idle');

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

  // Voice reacts to the lifecycle, in a fixed order per tick:
  // route replacement → fresh maneuver announcer + "Route updated." once;
  // trip end → stale speech dies, then ONE honest completion sentence
  // (cancellation stays silent); GPS degradations via the status
  // announcer; maneuvers only while a trip is actually active. Every
  // request carries an announce-once id, so re-renders and StrictMode
  // double-effects are silent drops, never double-speak.
  useEffect(() => {
    const voice = voiceRef.current!;
    const snap = lifecycle.snapshot();
    const prev = prevLcStateRef.current;
    prevLcStateRef.current = snap.state;

    // Speech watchdog. A browser speech engine can accept an utterance
    // and then never report it finished — backgrounded tab, an OS
    // interruption, a known iOS behavior. The queue would jam and the
    // driver would silently stop being told about turns for the rest of
    // the trip. This effect runs on every position update, which is the
    // cadence the watchdog needs; it does nothing unless an utterance
    // has genuinely been outstanding far too long.
    voice.tick(Date.now());

    const active =
      snap.state === 'navigating' ||
      snap.state === 'off-route' ||
      snap.state === 'rerouting' ||
      snap.state === 'final-approach';

    // Route replacement: kill stale guidance instantly, restart maneuver
    // announcements for the new geometry, say so exactly once.
    if (active && snap.routeId !== null) {
      if (spokenRouteIdRef.current === null) {
        spokenRouteIdRef.current = snap.routeId; // trip start, not a swap
      } else if (spokenRouteIdRef.current !== snap.routeId) {
        spokenRouteIdRef.current = snap.routeId;
        maneuverAnnouncerRef.current = createManeuverAnnouncer();
        voice.clearPending();
        const req = tripVoiceRequest({ kind: 'route-replaced', routeId: snap.routeId });
        if (req) voice.request(req);
      }
    }

    // Trip end: no old maneuver speech after arrival — clear first, then
    // the one honest completion announcement (silence for cancellation).
    if (snap.state === 'arrived' && prev !== 'arrived' && snap.summary !== null) {
      voice.clearPending();
      const req = tripVoiceRequest({
        kind: 'trip-ended',
        routeId: snap.summary.routeId,
        endReason: snap.summary.endReason,
      });
      if (req) voice.request(req);
    }
    if (snap.state === 'completed' && prev !== 'completed') {
      voice.clearPending();
      spokenRouteIdRef.current = null;
      maneuverAnnouncerRef.current = createManeuverAnnouncer();
    }

    // GPS truth is spoken whether or not a trip is loaded (denied /
    // unavailable / degraded / lost) — never silently stale.
    for (const req of statusAnnouncerRef.current.collect(view.status)) voice.request(req);

    // Maneuvers speak only while the trip is live.
    if (active && view.maneuvers !== null) {
      for (const req of maneuverAnnouncerRef.current.collect(view.maneuvers, view.speedMph)) {
        voice.request(req);
      }
    }
  }, [view, lifecycle]);

  /*
   * Network. `navigator.onLine` is optimistic — false is reliable, true
   * only means an interface exists — so the state starts null (say
   * nothing) and only a definite false produces a notice.
   */
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return;
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  /*
   * Screen wake, driven by the two facts the controller needs.
   *
   * The visibility listener is not optional politeness: the browser
   * RELEASES a wake lock whenever the page hides, and returning does not
   * restore it. Without this, a driver who takes a call loses the screen
   * for the rest of the trip. Releasing on cleanup matters just as much
   * — a lock held over an idle page is a battery bug in a cab where the
   * phone may sit for hours.
   */
  useEffect(() => {
    const wake = wakeRef.current;
    if (wake === null) return;
    wake.setActive(ACTIVE_LIFECYCLE_STATES.includes(lcState));
    if (typeof document === 'undefined') return;
    const onVisibility = () => wake.setVisible(!document.hidden);
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [lcState]);

  useEffect(
    () => () => {
      wakeRef.current?.setActive(false);
    },
    [],
  );

  // Unmount = leaving the screen: stale speech dies with the surface and
  // any live trip is cancelled so no engine outlives its owner
  // (GpsProvider tears the watch down the same way).
  useEffect(
    () => () => {
      voiceRef.current?.clearPending();
      void lifecycle.cancel(Date.now());
    },
    [lifecycle],
  );

  // Bring the driver to the guidance exactly ONCE per trip, on the
  // route-ready → navigating transition. Later states (off-route,
  // rerouting, final-approach) must not re-scroll: a driver who has
  // deliberately scrolled to their HOS clocks should stay there.
  const prevStateRef = useRef<string | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = lcState;
    if (lcState === 'navigating' && prev === 'route-ready') setFocusTick((t) => t + 1);
  }, [lcState]);

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

  const focusNavigationKey = focusTick === 0 ? null : `trip-start-${focusTick}`;

  /*
   * Road-test report. Assembled here because this is the only place that
   * can see the whole session at once — lifecycle, trip summary, GPS
   * health, voice, screen wake, and the pilot log. The report module owns
   * every privacy rail; nothing is pre-filtered on the way in, so a new
   * field can never be added that quietly skips the scrubber.
   */
  const buildReport = (note: string): string =>
    buildRoadTestReport({
      generatedMs: Date.now(),
      pilot,
      lifecycleState: lcState,
      trip: lifecycle.summary(),
      log: logRef.current?.entries() ?? [],
      logDropped: logRef.current?.dropped() ?? 0,
      gps: {
        health: position.health,
        accuracyM: Number.isFinite(position.accuracyM) ? position.accuracyM : null,
        speedMph: position.speedMph,
      },
      voice: voiceRef.current?.snapshot() ?? null,
      wake: wakeRef.current?.snapshot() ?? null,
      device: {
        userAgent: typeof navigator === 'undefined' ? null : navigator.userAgent,
        viewport:
          typeof window === 'undefined'
            ? null
            : { width: window.innerWidth, height: window.innerHeight },
        online: typeof navigator === 'undefined' ? null : navigator.onLine,
      },
      note,
    });

  // Map-first surface only while guidance is genuinely live; every other
  // state keeps the ordinary page so nothing else on the site changes.
  const fullScreen = ACTIVE_LIFECYCLE_STATES.includes(lcState);
  const [styleId, setStyleId] = useState<MapStyleId>(DEFAULT_MAP_STYLE);
  const [overviewToggleKey, setOverviewToggleKey] = useState(0);

  const roadName = roadNameFromInstruction(view.maneuvers?.next?.instruction ?? null);
  // The core stays clock-free: the component supplies both "now" and the
  // device's zone offset.
  const nowMs = Date.now();
  const etaText = formatEta(
    view.remainingMi,
    view.totalMi,
    mapData.durationSeconds,
    nowMs,
    new Date(nowMs).getTimezoneOffset(),
  );

  return (
    <DrivingScreenView
      view={view}
      watching={watching}
      focusNavigationKey={focusNavigationKey}
      fullScreen={fullScreen}
      roadName={roadName}
      etaText={etaText}
      overviewSlot={
        fullScreen ? (
          <LockGate action="route-overview" lockedLabel="Route overview">
            <button
              type="button"
              onClick={() => setOverviewToggleKey((k) => k + 1)}
              className="min-h-16 w-full rounded-card border border-line px-4 text-lg font-semibold text-ink"
              aria-label="Show the whole route, then return to your truck"
            >
              Overview
            </button>
          </LockGate>
        ) : null
      }
      mapStyleSlot={
        <LockGate action="change-map-style" lockedLabel="Map style">
          <MapStyleControl styleId={styleId} onChange={setStyleId} />
        </LockGate>
      }
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
            styleId={styleId}
            canZoom={permits('zoom-map')}
            canPan={permits('pan-map')}
            navigating={fullScreen}
            overviewToggleKey={overviewToggleKey}
          />
        ) : null
      }
      onStart={() => {
        start();
        bump();
      }}
      onStop={() => {
        // Stopping the preview also cancels any live pilot trip — the
        // summary stays honest ('cancelled'), the engines are released,
        // and any speech dies with it (stop is silent by design).
        voiceRef.current?.clearPending();
        lifecycle.cancel(Date.now());
        stop();
        bump();
      }}
      voice={voiceRef.current}
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
            buildReport={buildReport}
            onChanged={bump}
          />
        ) : null
      }
      offlineText={offlineNotice({ online, navigating: fullScreen })}
      hosSourceLabel={
        tripLoaded
          ? 'Pilot trip loaded — clocks still assume a fresh driver (no ELD linked).'
          : DEFAULT_HOS_LABEL
      }
    />
  );
}
