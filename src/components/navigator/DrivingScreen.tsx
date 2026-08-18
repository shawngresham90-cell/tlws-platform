'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DrivingView } from '@/lib/navigator/navigation-controller';
import type { LifecycleState, MapData, PlanRequest } from '@/lib/navigator/navigation-lifecycle';
import type { DestinationInfo } from '@/lib/navigator/truck-entrance';
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
import { formatDistance, formatSpeed } from '@/lib/navigator/format-units';
import { maneuverGlyph } from '@/lib/navigator/maneuver-glyph';
import { statusSeverity, severityGlyph } from '@/lib/navigator/status-severity';
import {
  createManeuverAnnouncer,
  createStatusAnnouncer,
  createVoiceGuidance,
  rerouteVoiceRequest,
  tripVoiceRequest,
  type ManeuverAnnouncer,
  type VoiceGuidance,
} from '@/lib/navigator/voice-guidance';
import { createDriverPhraseAnnouncer } from '@/lib/navigator/driver-greeting';
import { createNavigatorPlanPort, createNavigatorReplacementPort } from './route-port';
import {
  createRestorablePlanPort,
  parseTripSnapshot,
  serializeTripSnapshot,
  withPlanCapture,
  RESTORE_REFRESH_MS,
  TRIP_RESTORE_KEY,
  type RouteMaterial,
} from '@/lib/navigator/trip-restore';
import { createBrowserSpeechPort } from './speech-port';
import { formatEta } from '@/lib/navigator/driving-hud';
import { normalizeInstruction, roadNameFromInstruction } from '@/lib/navigator/maneuver-text';
import { createScreenWake, type ScreenWake } from '@/lib/navigator/screen-wake';
import type { ClockState } from '@/lib/trip-planner/types';
import { buildRoadTestReport } from '@/lib/navigator/road-test-report';
import { resolveBuildId } from '@/lib/navigator/build-id';
import type { ProblemReport } from '@/lib/navigator/problem-report';
import { offlineNotice } from '@/lib/navigator/network-status';
import { createBrowserWakePort } from './wake-lock-port';
import { DEFAULT_MAP_STYLE, type MapStyleId } from '@/lib/navigator/map-style';
import { MapStyleControl } from './MapStyleControl';
import { useSafetyLock } from './SafetyLockProvider';
import { useGps } from './GpsProvider';
import { MotionLockOverlay } from './MotionLockOverlay';
import { HosStrip } from './HosStrip';
import { LockGate } from './LockGate';
import { DestinationSearch } from './DestinationSearch';
import { TruckProfileEditor } from './TruckProfileEditor';
import { RegionPanel } from './RegionPanel';
import {
  canadaPilotStatus,
  crossBorderSearchLabel,
  defaultUnitsFor,
  looksCrossBorder,
  searchCountryFor,
  CANADA_HOS_NOTICE,
  type Region,
  type UnitSystem,
} from '@/lib/navigator/region';
import { DEFAULT_REGION_PREFS, readRegionPrefs, writeRegionPrefs } from './region-storage';
import { clearDriverName, readDriverName, writeDriverName } from './driver-storage';
import { readTruck, writeTruck } from './truck-storage';
import { readRoutePrefs, writeRoutePrefs } from './route-prefs-storage';
import {
  DEFAULT_ROUTE_PREFERENCES,
  preferencesChanged,
  preferencesToAvoid,
  type RoutePreferences,
} from '@/lib/navigator/route-preferences';
import { RoutePreferencesPanel } from './RoutePreferencesPanel';
import { readClocks, writeClocks } from './clocks-storage';
import { useAccountSync, type SyncTransport } from './account-sync';
import { readHosVisibility, writeHosVisibility } from './hos-visibility-storage';
import {
  clocksToggleLabel,
  toggledVisibility,
  HOS_VISIBILITY_DEFAULT,
  type HosVisibility,
} from '@/lib/navigator/hos-visibility';
import { clocksProvenance } from '@/lib/navigator/hos-clocks';
import { ClockSetup } from './ClockSetup';
import { DriverNameEntry } from './DriverNameEntry';
import { engineStateFor, CLOCKS_UNSET, type ClockEntryState } from '@/lib/navigator/hos-clocks';
import { SetupStatus } from './SetupStatus';
import { SetupSummary } from './SetupSummary';
import { TruckSummary } from './TruckSummary';
import { setupStatus } from '@/lib/navigator/setup-status';
import {
  confirmProfile,
  profileGate,
  routingFingerprint,
  DEFAULT_EDITABLE_PROFILE,
  NO_CONFIRMATION,
  type ConfirmationState,
  type EditableProfile,
} from '@/lib/navigator/truck-profile';
import type { DestinationCandidate } from '@/lib/navigator-api/destination-search';
import { PilotTripControls } from './PilotTripControls';
import { TripPlanFirst } from './TripPlanFirst';
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

/*
 * The confirmed truck and the driver's name are versioned records owned
 * by `truck-storage` and `driver-storage`. They moved off this screen in
 * the pre-trip setup milestone so that a corrupt record of one kind
 * cannot cost the driver another — three keys, three parsers, no shared
 * try/catch. This screen still owns the TRIP snapshot, which is about
 * one drive and deliberately does not outlive the tab.
 */

/*
 * The provenance line is computed from the entry state now — see
 * `clocksProvenance`. The old constant claimed the screen was "showing a
 * fresh driver's full clocks", which stopped being true when the
 * fresh-driver default was removed.
 */

/*
 * The running build, resolved once at module scope: these three values are
 * inlined at build time by next.config, so they are constants for the life
 * of the bundle and re-deriving them per render would be pure waste.
 * `resolveBuildId` whitelists each one, so a mis-set variable renders as
 * 'unknown' rather than reaching the screen or a report.
 */
const buildId = resolveBuildId({
  commitRef: process.env.NEXT_PUBLIC_BUILD_COMMIT,
  context: process.env.NEXT_PUBLIC_BUILD_CONTEXT,
  builtAtIso: process.env.NEXT_PUBLIC_BUILD_TIME,
});

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
    <div className="flex h-72 w-full items-center justify-center rounded-cockpit border border-line bg-nav-surface text-lg text-muted sm:h-96">
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
  hosSourceLabel = 'No clocks entered — enter yours to get clock warnings.',
  mapSlot = null,
  focusNavigationKey = null,
  voice,
  fullScreen = false,
  roadName = null,
  etaText = null,
  overviewSlot = null,
  mapStyleSlot = null,
  offlineText = null,
  offRouteText = null,
  onVoiceMutedChange,
  showIdleStartControl = true,
  hosRestoredClocks = null,
  hosEnteredClocks = null,
  hosVisibility = HOS_VISIBILITY_DEFAULT,
  onToggleHosVisibility,
  onHosClocks,
  onBottomInset,
  mapSearchSlot = null,
  regionPanel = null,
  metric = false,
  crossBorder = false,
  hosUnavailableNotice = null,
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
  /**
   * Off-route / rerouting state, in one short line. Null when on route.
   * It never contains an instruction — see the driving screen's note.
   */
  offRouteText?: string | null;
  /** Driver turned voice on or off — see VoiceControls.onMutedChange. */
  onVoiceMutedChange?: (muted: boolean) => void;
  /**
   * Whether the idle (not-watching) slot of the bottom row offers the
   * standalone "Enable location" control. The pilot's parked page hides
   * it while the cold-start setup window is open — there the one-tap
   * Start owns location — but it MUST return whenever the setup window
   * has closed with the watch off (the way back after Stop), and it is
   * always offered on the driving surface, where trip restore relies on
   * it when the Permissions API cannot promise 'granted' (PR #302).
   */
  showIdleStartControl?: boolean;
  /** Clocks recovered from a restored trip — see HosStrip.restoredClocks. */
  hosRestoredClocks?: ClockState | null;
  /**
   * The clocks the driver entered, as engine state — or null when they
   * have entered none, which the strip renders as "Clocks not set"
   * rather than as a fresh driver.
   */
  hosEnteredClocks?: ClockState | null;
  /**
   * Whether the driving clocks are on screen. Owned by the container so
   * the choice can be persisted; the strip itself stays mounted either
   * way (declutter milestone).
   */
  hosVisibility?: HosVisibility;
  /** Flip and remember it. */
  onToggleHosVisibility?: () => void;
  /** Reports the live clocks so the owner can persist them. */
  onHosClocks?: (clocks: ClockState) => void;
  /**
   * Reports how tall the bottom overlay band is, so the OWNER can tell
   * the map how much of the screen the truck must stay above. Measured
   * here because this is the component that lays the band out.
   */
  onBottomInset?: (px: number) => void;
  /**
   * Destination search, mounted OVER the parked map (final pilot
   * milestone). Null while guidance is live — a driver in motion gets no
   * text field, and the shared lock, not this component, is what decides
   * that (the caller wraps this slot in the edit-destination LockGate).
   */
  mapSearchSlot?: ReactNode;
  /** Region + units + the Canadian pilot status, parked-only. */
  regionPanel?: ReactNode;
  /** Show distances, speeds and dimensions in metric. */
  metric?: boolean;
  /** Origin and destination look like different countries. */
  crossBorder?: boolean;
  /**
   * When set, the HOS clocks are REPLACED by this notice. Canada mode
   * uses it: the engine's US limits must never be shown as though they
   * were Canadian, and there is no Canadian calculation in this pilot.
   */
  hosUnavailableNotice?: string | null;
}) {
  // Warning-rail severity, read from the existing status — presentation
  // only, computed nowhere else so the rail can never disagree with the
  // words beside it.
  const statusSev = statusSeverity(view.status);
  const statusGlyph = severityGlyph(statusSev);

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
  // controls they just used, which sit below the fold. The scroll is
  // scoped to the SHELL (the cockpit's own scroll container), where the
  // guidance is always at the top. It must never be scrollIntoView: that
  // walks EVERY scrollable ancestor, and scrolling the document under a
  // fixed cockpit is invisible on screen but yanks the mobile URL bar —
  // measured in emulation as the whole fixed surface shifting 24 px down
  // and the bottom controls off the viewport.
  const navTopRef = useRef<HTMLElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  /*
   * The BOTTOM OVERLAY BAND's height, measured rather than assumed.
   *
   * The driving camera keeps the truck in the lower middle, and "lower"
   * has to mean "above the trip strip, the clocks and the Stop row" — a
   * band that is ~230 px on a tall phone and ~195 px at 844x390.
   * Measured in Chromium, a guessed constant put the truck UNDER the
   * trip strip at 360x740, 1280x800 and 844x390. So the layout tells the
   * map how much room it is taking, and the camera does the arithmetic.
   */
  const bottomBandRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = bottomBandRef.current;
    if (!fullScreen || el === null || typeof ResizeObserver === 'undefined') {
      onBottomInset?.(0);
      return;
    }
    let last = -1;
    const measure = () => {
      // From the band's top edge to the bottom of the VISIBLE viewport:
      // that is the strip of screen the map may draw in but must not park
      // the truck in.
      //
      // `visualViewport.height` rather than `innerHeight` where the
      // browser offers it — with the URL bar showing, the two differ by
      // exactly the chrome the driver cannot see through, and the camera
      // should reserve against the screen a driver actually has.
      /*
       * MEASURED AGAINST THE SURFACE, NOT THE VIEWPORT.
       *
       * `innerHeight - rect.top` is only the band's share of the screen
       * while the surface starts at the top of the viewport. The drive
       * shell is a scrollable `fixed inset-0` element, so anything that
       * scrolls it — a browser's own scroll-into-view, an assistive
       * technology moving focus — slides the surface up and inflates that
       * subtraction. Measured in Chromium: a 182 px band read as 426 px
       * with the shell scrolled, and the camera lifted the truck to 17%
       * of the screen with no road visible ahead of it.
       *
       * The band and the surface move together, so the distance between
       * them does not care where the shell is scrolled to. The parent IS
       * the surface — the band is a direct child of the 100dvh box.
       */
      const rect = el.getBoundingClientRect();
      const surface = el.parentElement;
      const base =
        surface !== null
          ? surface.getBoundingClientRect().bottom
          : typeof window === 'undefined'
            ? rect.bottom
            : (window.visualViewport?.height ?? window.innerHeight);
      const next = Math.max(0, Math.round(base - rect.top));
      // Only report CHANGES. The camera eases on every new inset, and a
      // resize storm that re-reports the same number would ease the map
      // repeatedly to the position it is already in.
      if (next === last) return;
      last = next;
      onBottomInset?.(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    /*
     * A ResizeObserver on the band covers the layout's own changes —
     * the clocks collapsing, the urgent band appearing, the HOS record
     * arriving from storage. It does NOT cover the viewport changing
     * underneath a band whose size stayed the same, so the events that
     * do that are listened for directly: a rotation, a window resize,
     * and the mobile browser chrome sliding in and out.
     */
    const onViewportChange = () => measure();
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);
    window.visualViewport?.addEventListener('resize', onViewportChange);
    window.visualViewport?.addEventListener('scroll', onViewportChange);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('orientationchange', onViewportChange);
      window.visualViewport?.removeEventListener('resize', onViewportChange);
      window.visualViewport?.removeEventListener('scroll', onViewportChange);
    };
    // onBottomInset is a stable setter from the owner (same shape as
    // onHosClocks); the band's own size changes drive the observer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullScreen]);
  useEffect(() => {
    if (focusNavigationKey === null) return;
    const shell = shellRef.current;
    if (shell && typeof shell.scrollTo === 'function') {
      // `html { scroll-behavior: auto }` under reduced motion does NOT
      // override an explicit `behavior: 'smooth'` passed here — the
      // argument wins. So the preference is read directly, or a driver
      // who asked for no motion gets an animated scroll anyway at the one
      // moment the screen jumps on its own.
      const reduced =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      shell.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    }
    // And anchor the BROWSER viewport: the parked page scrolls the
    // document like any page, and a document left mid-scroll keeps the
    // mobile browser-bar state that goes with it — measured as the whole
    // fixed cockpit sitting 24 px low with the bottom controls pushed off
    // screen. The cockpit covers the page completely, so collapsing the
    // leftover scroll is invisible except for putting the fixed surface
    // exactly where inset-0 says it is.
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo(0, 0);
    }
  }, [focusNavigationKey]);

  // Within 0.3 mi of the turn the banner gains a route-colored bottom glow
  // (blueprint §5): motion/emphasis signals imminence, color stays reserved
  // for danger. Pure presentation of a distance the view already carries.
  const imminent = (view.maneuvers?.distanceMi ?? Number.POSITIVE_INFINITY) < 0.3;

  // The provider's own structured action/direction pair, mapped to an arrow
  // by an omit-on-unknown whitelist — never parsed out of instruction prose.
  const glyph = m ? maneuverGlyph(m.action, m.direction) : null;

  // A maneuver card that reads over any basemap: opaque backing, road
  // name when the provider named one, and the following turn. Blueprint §5
  // hierarchy: the DISTANCE is the largest thing on the screen (numerals
  // are the product), the instruction is the largest prose beneath it.
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
      className={`max-h-[28dvh] shrink-0 overflow-hidden scroll-mt-4 rounded-cockpit border border-line bg-asphalt/95 p-2 shadow-lg [@media(max-height:600px)]:max-h-[40dvh] [@media(max-height:480px)]:max-h-[32dvh] sm:p-3${imminent ? ' nav-imminent' : ''}`}
    >
      {m ? (
        /*
         * TWO COLUMNS, not four stacked rows (declutter milestone).
         *
         * The card used to stack glyph+distance, then instruction, then
         * road name, then the following turn — so its height was the SUM
         * of four things and measured 164-168 px on every portrait phone,
         * against a viewport where the unobstructed map was already down
         * to 38% at 375x667. Drivers said the card was too big and they
         * wanted more map; the sum was the reason.
         *
         * Side by side, the height is the MAX of two columns instead. The
         * arrow and the distance keep the left rail — they are what a
         * driver checks at a glance and they stay the largest things on
         * the card — while the instruction and the road name take the
         * remaining width. Nothing was dropped to achieve it: all four
         * pieces the road test asked to keep are still here.
         */
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
          <div className="flex flex-col items-center">
            {glyph ? (
              /* Reinforcement only, never the meaning: the instruction text
                 beside it is the primary signal, so the arrow is aria-hidden
                 and simply absent when the provider's action is one the
                 whitelist does not know. */
              <div
                aria-hidden="true"
                className="font-data text-[length:clamp(28px,min(9vw,6dvh),var(--size-maneuver-compact))] leading-none text-ink"
              >
                {glyph}
              </div>
            ) : null}
            {/* Still the biggest NUMERAL on the screen (blueprint §5), now
                clamped to a rail a 320 px phone can spare. "In" stays
                visible: it is two characters and it is what makes the
                number a distance rather than a time. */}
            <p className="whitespace-nowrap font-data num-data text-[length:clamp(20px,min(6vw,4dvh),var(--size-maneuver-compact))] font-bold leading-tight tracking-tight text-ink">
              In {formatDistance(view.maneuvers?.distanceMi, metric)}
            </p>
          </div>
          <div className="min-w-0">
            {/*
              A live region, and the ONLY one on the card. A driver using a
              screen reader with voice guidance muted — and voice starts
              muted by design — was never told a turn was coming at all;
              they had to keep asking. The instruction text changes exactly
              once per maneuver, so announcing it is the accessible analogue
              of the announce-once policy voice already follows.

              The distance beside it is deliberately NOT part of it: it
              changes every second, and a live region that fires every
              second is one a driver turns off.

              Clamped rather than clipped — two lines and an ellipsis says
              "there is more"; a hard cut mid-word says nothing at all. A
              long exit name therefore ends in an ellipsis instead of
              growing the card back to the height this milestone removed.
            */}
            <p
              aria-live="polite"
              className="line-clamp-2 text-xl font-semibold leading-snug text-ink sm:text-2xl"
            >
              {normalizeInstruction(m.instruction) ?? m.instruction}
            </p>
            {/* The road name earns its place now that it costs no height of
                its own — it sits in space the left rail already occupies.
                Truncated, because a road name that wraps would start
                growing the card again. */}
            {roadName ? <p className="truncate text-base text-ink/80">on {roadName}</p> : null}
            {/* The following turn is the first thing to go when there is no
                room: it is the only piece here the road test did not name. */}
            {view.maneuvers?.following ? (
              <p className="truncate text-base text-ink/70 [@media(max-height:700px)]:hidden">
                then{' '}
                {normalizeInstruction(view.maneuvers.following.instruction) ??
                  view.maneuvers.following.instruction}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-2xl font-semibold text-ink sm:text-3xl">
          {view.status === 'arrived' ? 'You have arrived' : 'No maneuver to show'}
        </p>
      )}
    </section>
  );

  // The trip bar (blueprint §5): three real values — speed from GPS,
  // remaining from route progress, arrival from the provider's planned
  // duration. Speed gets the blueprint's speed-cluster emphasis (48px
  // ceiling); labels sit at the 16px drive-mode floor, tabular numerals so
  // nothing jitters as it counts down. No posted-limit shield: the route
  // response carries no speed-limit data, and a shield rendered from
  // nothing would be the most dangerous fake on the screen.
  const compactStrip = (
    <dl className="grid shrink-0 grid-cols-3 items-end gap-2 rounded-cockpit border border-line bg-nav-surface px-3 py-1.5 text-center text-ink [@media(max-height:480px)]:py-0.5">
      <div>
        <dt className="text-[length:var(--size-label)] leading-tight text-ink/70">Speed</dt>
        {/* One line always: a value that stacks at 58 but not at 8 would
            re-flow the whole bar as speed changes. 7.5vw fits "115 mph" in
            a third of a 320px portrait screen; 6dvh keeps the same cell
            honest in landscape, where the strip lives in the narrow left
            rail and width is not the scarce dimension. The ceiling is the
            --size-speed design size, reached on wide viewports. */}
        <dd className="whitespace-nowrap font-data num-data text-[length:clamp(24px,min(7.5vw,6dvh),var(--size-speed))] font-bold leading-none">
          {formatSpeed(view.speedMph, metric)}
        </dd>
      </div>
      <div>
        <dt className="text-[length:var(--size-label)] leading-tight text-ink/70">Remaining</dt>
        <dd className="font-data num-data text-[length:var(--size-trip)] font-semibold leading-tight">
          {formatDistance(view.remainingMi, metric)}
        </dd>
      </div>
      <div>
        <dt className="text-[length:var(--size-label)] leading-tight text-ink/70">Arrive</dt>
        <dd className="font-data num-data text-[length:var(--size-trip)] font-semibold leading-tight">
          {etaText ?? '—'}
        </dd>
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
  //
  // z-[60], not z-50: THE SAME BUG, ONE ROW LOWER AND MUCH WORSE. The
  // site's mobile bar (`MobileToolBar`, `fixed inset-x-0 bottom-0 z-50
  // sm:hidden`) is also mounted after {children}, so at equal z it won
  // the tie and painted over the bottom 72 px of this surface — which is
  // the driving control row. Measured in Chromium at 390x844:
  // `elementFromPoint` at the centre of Stop returned the toolbar's HOS
  // link, not Stop. Every portrait phone under the sm breakpoint was
  // affected (320-430 px measured); the two landscape shapes were not,
  // because `sm:hidden` removes the bar at 640 px and wider — which is
  // exactly the split the bench recorded.
  //
  // What a driver got for tapping Stop was a page about hours of
  // service. Coming back re-entered /drive and restored the trip, so the
  // symptom read as "the guidance screen moved" — the reported defect —
  // when nothing had scrolled at all.
  //
  // The fix is ownership, not suppression: the toolbar is untouched and
  // still owns bottom-0 everywhere else on the site, including the
  // PARKED /drive page, where the body's pb-16 reserves its band. While
  // guidance is live this surface is a full-screen takeover and nothing
  // may sit on it.
  // !mt-0: the parked /drive page stacks its blocks with space-y-6, and
  // Tailwind's space-y is a margin-top on every later sibling — WHICH
  // APPLIES TO FIXED ELEMENTS TOO. Left in place, the cockpit shell
  // rendered 24 px below the viewport top and 24 px short (top:0 plus
  // margin-top:24px), clipping the bottom control row off screen —
  // measured, and invisible before this item because the old surface
  // never reached the edges. The important modifier is required: the
  // space-y selector outranks a plain utility.
  const shellCls = fullScreen
    ? 'fixed inset-0 z-[60] !mt-0 overflow-y-auto overscroll-contain bg-nav-bg'
    : '';
  /*
   * FULL-SCREEN MAP (pilot round 3, item "full-screen navigation map").
   *
   * While guidance is live the MAP is the surface: an absolutely
   * positioned background filling the whole 100dvh box edge to edge, with
   * every readout and control LAYERED above it as an overlay. The
   * element order is IDENTICAL to the parked page and only classes
   * change — the rule that keeps the Leaflet instance mounted across
   * route-ready → navigating stands untouched, and the map's own
   * ResizeObserver (#301) absorbs the container's growth to the full
   * viewport.
   *
   * The overlay column is a flex stack over the map: maneuver card and
   * the honest lines at the top, then `mt-auto` pushes the trip strip,
   * HOS and the control row to the bottom edge. Everything in between is
   * open map, and taps there reach it — overlays hit-test individually,
   * empty flex space does not.
   *
   * Layering is explicit, never an accident of DOM order: the map wrap
   * is z-0, every overlay is z-10. An absolutely positioned later
   * sibling would otherwise paint OVER the in-flow card above it.
   *
   * Landscape needs no second layout system anymore: the map is already
   * everywhere, so the overlays simply cap their width to the left ~38%
   * (the same rail fraction the old grid used) and the right side stays
   * open road. Same DOM, one mechanism, nothing for grid track sizing
   * to collapse.
   *
   * Safe areas pad the OVERLAYS, not the map: the surface carries
   * env(safe-area-inset-*) padding on all four sides so no control can
   * sit under a notch or home indicator, while the map (positioned to
   * the padding box, which includes the padded area) still paints edge
   * to edge behind them. Note the site does not opt into
   * viewport-fit=cover, so on notched phones the browser already keeps
   * the page inside the safe viewport — the env() paddings are 0 there
   * today and simply stand ready.
   */
  const surfaceCls = fullScreen
    ? 'relative flex h-[100dvh] flex-col gap-2 p-2 [@media(max-height:480px)]:gap-1 ' +
      'pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] ' +
      'pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))]'
    : 'space-y-6';
  const colOne = fullScreen ? 'relative z-10 shrink-0 landscape:max-w-[38vw]' : '';
  /*
   * The BOTTOM band takes the width the screen actually has.
   *
   * The 38 vw cap belongs to the TOP overlays — the maneuver card and
   * the honest lines — so a landscape driver keeps the right of the map
   * open where they are looking ahead. Applied to the bottom band it
   * backfired: at 844x390 the three-cell trip strip and the four-cell
   * clock strip wrapped inside 320 px and grew to 86 px and 73 px, which
   * pushed the Stop row 27 px off the bottom of the viewport. Full width
   * un-wraps them (64 px and 56 px measured) and the band still sits
   * below the followed truck, which rides the middle of the screen.
   */
  const colBottom = fullScreen ? 'relative z-10 shrink-0' : '';
  // Parked, the map gets the SAME box the dynamic-import placeholder
  // promises (h-72/sm:h-96, cockpit border). It used to get no class at
  // all: a bare auto-height div, in which the map's h-full computed to
  // 0px — so the mounted map was invisible on the parked page (the Phase
  // 3 briefing framing never showed), the placeholder's 288px box
  // collapsed the moment Leaflet finished loading, and the canvas
  // Leaflet measured at creation was 0px tall — the stale size the
  // driving surface then inherited as the half-blank map. Height only
  // when a map is actually mounted: before Enable location the slot is
  // null and an empty bordered box would be a lie.
  const mapWrapCls = fullScreen
    ? 'absolute inset-0 z-0 overflow-hidden'
    : mapSlot !== null
      ? 'relative h-72 w-full overflow-hidden rounded-cockpit border border-line sm:h-96'
      : '';

  return (
    <div ref={shellRef} className={shellCls}>
      <div className={surfaceCls} data-driving-surface={fullScreen ? '' : undefined}>
        <div className={colOne}>{maneuverCard}</div>

        {/* Off route. Sits directly under the maneuver card because it is
            the reason that card may no longer apply. Deliberately a
            STATE, never an instruction: the app has no verified
            truck-turnaround data, so it never says which way to go. */}
        {/*
            Deliberately NOT a live region. The driving surface budgets
            polite regions at three (navigation-map-ui §22) precisely so
            they stay worth hearing, and this state's assistive channel is
            VOICE — "You're off route. Rerouting." is announced once per
            departure through the existing arbitration. A fourth region
            saying the same thing a beat later is the sprinkling that
            budget exists to prevent.
        */}
        {/* Blueprint §5 warning-rail treatment for the one warning this
            surface can honestly state: an amber advisory edge PAIRED with
            the words — the text alone already carries the full meaning. */}
        {offRouteText ? (
          <p
            className={
              fullScreen
                ? `${colOne} shrink-0 rounded-cockpit border border-line border-l-4 border-l-nav-warn bg-asphalt/95 px-3 py-1 text-base font-semibold text-ink`
                : 'rounded-cockpit border border-line border-l-4 border-l-nav-warn px-3 py-2 text-xl font-semibold text-ink'
            }
          >
            <span aria-hidden="true">⚠ </span>
            {offRouteText}
          </p>
        ) : null}

        {/* The map: the driving surface's primary element, and the one
            component that must survive the layout switch untouched. In
            full-screen it is the z-0 BACKGROUND filling the whole
            surface; parked it stays the bordered page box. */}
        <div className={mapWrapCls}>
          {mapSlot}
          {/* PARKED SEARCH, over the top of the map. The driver is
              looking at the map, so "where are you going?" belongs
              there — and putting it over the map instead of above it is
              what keeps the parked page from growing back into the tall
              stack the round-3 startup work removed. z-[500] clears
              Leaflet's own panes (400) and sits under its controls
              (1000); the wrapper is pointer-events-none so the map keeps
              every pixel the control itself does not occupy, and the
              inner scroll (max-h-full + overflow-y-auto) is what keeps a
              long result list REACHABLE inside the map box instead of
              clipped by its overflow-hidden — including with the phone
              keyboard up, when the page can still scroll but this box
              cannot grow. */}
          {mapSearchSlot === null ? null : mapSlot !== null ? (
            <div className="pointer-events-none absolute inset-0 z-[500] flex flex-col p-2">
              <div className="pointer-events-auto min-h-0 max-h-full overflow-y-auto">
                {mapSearchSlot}
              </div>
            </div>
          ) : (
            /* Cold start: permission not granted yet, so no map is
               mounted — there is honestly nothing to overlay. The SAME
               control renders in normal flow, in the exact spot the map
               will occupy, so the search does not jump when the map
               appears (auto-resume, or the first Start). */
            mapSearchSlot
          )}
        </div>

        {/* NO TRUCK-PROFILE OVERLAY HERE, deliberately (final pilot
            milestone). The chip repeated numbers the driver had already
            checked on the parked screen — height, weight, axles, hazmat,
            trailers — and repeating them mid-drive bought nothing except
            map. The profile is verified once, before Start, on the
            parked panel; the request that carries it is unchanged. The
            space it occupied goes to the map, not to a replacement box. */}

        {/* Status as TEXT — never color alone; live region for changes.
            Phase 2 warning rail: the SAME line, dressed by severity. While
            healthy it stays a quiet one-liner (the always-on status text
            is a pinned honesty invariant, not rail chrome); a degraded
            state earns the amber advisory edge, a state where navigation
            genuinely is not running earns the red one — each beside a
            distinct aria-hidden shape, so severity never rides on color
            alone. Purely presentational: the controller's status is read,
            never interpreted, and no voice request originates here. */}
        <p
          aria-live="polite"
          role="status"
          className={
            fullScreen
              ? `${colOne} truncate text-base font-semibold text-ink motion-safe:transition-colors motion-safe:duration-200${
                  statusSev === 'critical'
                    ? ' rounded-cockpit border border-line border-l-4 border-l-nav-danger bg-nav-surface px-3 py-1'
                    : statusSev === 'advisory'
                      ? ' rounded-cockpit border border-line border-l-4 border-l-nav-warn bg-nav-surface px-3 py-1'
                      : /* healthy: still the quiet one-liner — no rail edge,
                           no border — but over a live map it needs its own
                           backing to stay readable on any basemap. */
                        ' self-start rounded-cockpit bg-asphalt/85 px-3 py-1'
                }`
              : 'text-xl font-semibold text-ink'
          }
        >
          {statusGlyph ? <span aria-hidden="true">{statusGlyph} </span> : null}
          {statusText[view.status]}
          {view.lastKnown ? ' (last known)' : ''}
        </p>

        {/* Network, in navigation's terms. The route and its maneuvers
            were downloaded when the trip was planned and live in memory,
            and matching, off-route detection and arrival are all pure —
            so offline costs exactly one thing, and the line says which. */}
        {/* Rendering at all means the network is genuinely degraded, so
            this line always wears the advisory treatment — words first,
            shape beside them, amber never alone. */}
        {offlineText ? (
          <p
            aria-live="polite"
            role="status"
            className={
              fullScreen
                ? `${colOne} rounded-cockpit border border-line border-l-4 border-l-nav-warn bg-nav-surface px-3 py-1 text-base font-semibold text-ink`
                : 'text-xl font-semibold text-ink'
            }
          >
            <span aria-hidden="true">⚠ </span>
            {offlineText}
          </p>
        ) : null}

        {/* mt-auto: the first item of the BOTTOM overlay group. Everything
            from here down (trip strip, HOS, controls) rides the bottom
            edge of the full-screen surface; the flex gap above it is open
            map. On the ordinary page it is just the next block. */}
        {/*
          THE BOTTOM OVERLAY GROUP, AS ONE MEASURED BOX.
          
          The camera has to know how much of the screen's bottom the
          cockpit is taking, so it can park the truck above it. That
          number used to come from a ResizeObserver on the trip strip
          alone — and a ResizeObserver fires on SIZE, not position. When
          the clocks collapsed, or the HOS strip appeared after its
          record loaded from storage, the strip below simply MOVED; its
          own size never changed, no callback ran, and the camera kept
          using a reserve measured before the band was finished growing.
          Measured on main: the truck sat at 71% of the viewport — the
          unclamped fraction — with the clamp that should have stopped it
          never engaging, and the marker ended up 27 to 114 px INSIDE the
          band at 390x844, 844x390 and 932x430.
          
          One wrapper around all three, observed as a unit, so any child
          changing height is a height change of the thing being watched.
          `display: contents` off the driving screen, so the parked page's
          own spacing is untouched.
        */}
        <div
          ref={bottomBandRef}
          data-bottom-band={fullScreen ? '' : undefined}
          className={
            fullScreen
              ? 'relative z-10 mt-auto flex shrink-0 flex-col gap-2 [@media(max-height:480px)]:gap-1'
              : 'contents'
          }
        >
          <div className={fullScreen ? colBottom : ''}>
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
                <dd>{formatDistance(view.remainingMi, metric)}</dd>
                <dt>Speed</dt>
                <dd>{formatSpeed(view.speedMph, metric)}</dd>
              </dl>
            )}
          </div>

          {/* Permanent HOS strip (milestone N6) — the driver's clocks against
            the drive, in every screen state. ONE mounted instance owns the
            clock state, the 60-second advance and the HOS voice announcer;
            only the PRESENTATION changes. Parked it is the full card. In
            the cockpit (#304's full-screen map) it is the compact
            four-clock strip — DRIVE · WINDOW · CYCLE · BREAK, measured at
            54 px against the 230 px card, which is what makes a visible
            HOS display affordable again without taking the screen back
            from the map. Because the instance is never remounted, the
            clocks do not restart when guidance starts, when a reroute
            lands, or when the trip ends. */}
          <div className={fullScreen ? colBottom : ''} data-hos-region="">
            {hosUnavailableNotice !== null ? (
              /* No clocks at all — not greyed-out US clocks, which would
               still read as numbers a driver could act on. */
              <section
                aria-label="Hours of service — not calculated"
                role="status"
                className="w-full rounded-cockpit border border-line border-l-4 border-l-nav-warn bg-asphalt/90 px-3 py-2"
              >
                <p className="text-base font-semibold leading-snug text-ink">
                  {hosUnavailableNotice}
                </p>
              </section>
            ) : (
              <HosStrip
                drivingActive={
                  fullScreen || view.status === 'navigating' || view.status === 'position-degraded'
                }
                sourceLabel={hosSourceLabel}
                voice={voice}
                compact={fullScreen}
                enteredClocks={hosEnteredClocks}
                restoredClocks={hosRestoredClocks}
                onClocksChange={onHosClocks}
                /* Presentation only, and only in the cockpit: the parked
                 screen has room for the card and no reason to hide it. */
                visibility={hosVisibility}
                detailSlot={
                  fullScreen
                    ? (detail) =>
                        detail === null ? null : (
                          // The detailed clocks are a deep surface: the SAME
                          // stationary-only rail every other one uses, through
                          // the shared map. The compact strip above stays
                          // readable while moving — only opening the panel is
                          // gated, which is what doc 06 locks and why nothing
                          // new was added to the permission map.
                          <LockGate
                            action="view-trip-summary"
                            lockedLabel="Detailed clocks"
                            compact
                          >
                            {detail}
                          </LockGate>
                        )
                    : undefined
                }
              />
            )}
          </div>

          {/* Stop is the always-visible exit control — allowed while moving.
            Voice mute rides the SAME row rather than taking one of its own:
            the driving surface is height-constrained, and a second row
            would eat the map's floor on a 320 px phone. Mute is allowed
            while moving by the shared permission map, like Stop, so it
            must live here on the driving surface and not below the fold. */}
          {/* gap-3 = the blueprint's 12px minimum spacing between adjacent
            touch targets, so a glove aiming for Stop cannot land on Mute. */}
          <div className={fullScreen ? `${colBottom} flex gap-3` : ''}>
            {fullScreen ? overviewSlot : null}
            {/*
            THE CLOCKS TOGGLE LIVES HERE, not under the strip.
            
            A full-width button beneath the HOS strip was the obvious
            place and the wrong one: it took the expanded HOS area from
            71 px to 139 px, and at 320x568 the unobstructed map fell
            from 28.5% to 25%. A milestone about giving space back to the
            map had made the expanded state worse in order to make the
            collapsed state better. In this row — which already exists,
            and is already where a driver's thumb goes — it costs nothing
            in either state, and there is exactly ONE of it.

            The visible word is short so four controls fit a 320 px
            phone; the accessible name is the full plain-words sentence
            the milestone asks for, and `aria-pressed` states which way
            it is set.
          */}
            {fullScreen && hosUnavailableNotice === null && onToggleHosVisibility ? (
              <button
                type="button"
                onClick={onToggleHosVisibility}
                className="min-h-16 w-full min-w-0 truncate rounded-cockpit border border-line bg-nav-surface-2 px-3 text-xl font-semibold text-ink"
                aria-label={clocksToggleLabel(hosVisibility)}
                aria-pressed={hosVisibility === 'shown'}
              >
                Clocks
              </button>
            ) : null}
            {voice ? (
              <LockGate action="mute-voice" lockedLabel="Voice mute" compact={fullScreen}>
                <VoiceControls
                  voice={voice}
                  compact={fullScreen}
                  onMutedChange={onVoiceMutedChange}
                />
              </LockGate>
            ) : null}
            <LockGate action="stop-navigation" lockedLabel="Stop navigation" compact={fullScreen}>
              {watching ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="min-h-16 min-w-0 w-full truncate rounded-cockpit border border-line bg-nav-surface-2 px-3 text-xl font-semibold text-ink"
                  aria-label="Stop navigation and discard position"
                >
                  {fullScreen ? 'Stop' : 'Stop navigation'}
                </button>
              ) : showIdleStartControl ? (
                <button
                  type="button"
                  onClick={onStart}
                  className="min-h-16 min-w-0 w-full truncate rounded-cockpit border border-line bg-nav-surface-2 px-3 text-xl font-semibold text-ink"
                  aria-label="Enable location and start the driving preview"
                >
                  Enable location
                </button>
              ) : null}
            </LockGate>
          </div>
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

export function DrivingScreen({
  authorized = false,
  /*
   * True only when the deploy runs `account` mode. The SERVER decides it and
   * passes it down, exactly as `authorized` is: the access mode is a
   * server-only variable, and a client that inferred it would be a second
   * copy of the gate, free to disagree with the first.
   *
   * False in pilot, public and closed — and false is inert. No session is
   * read, no account row is fetched, and the screen behaves byte-for-byte as
   * it did before sync existed, which is what keeps production on `pilot`
   * unaffected by this change.
   */
  accountMode = false,
  /*
   * The network edge of account sync, injectable so a harness can render THIS
   * screen — the real one, with its real effects and its real storage — and
   * observe what it actually synchronises. Omitted everywhere in production,
   * where the hook uses the real client. Same discipline as the routing
   * adapter's injected fetcher and the voice adapter's speech sink.
   */
  syncTransport,
}: {
  authorized?: boolean;
  accountMode?: boolean;
  syncTransport?: SyncTransport;
} = {}) {
  const { position, watching, acquiring, start, stop } = useGps();
  // Motion policy comes from the ONE shared map (doc 06 §1); the map
  // component never decides for itself whether browsing is permitted.
  const { lock, permits } = useSafetyLock();

  /*
   * Pilot Mode. `authorized` is the SERVER's verdict on the pilot cookie,
   * handed down by a page that already refused to render for anyone
   * without it — the client never re-derives access, and never sees the
   * password.
   *
   * This replaced a hostname check that refused the production domain
   * outright, which is why a driver who had entered the correct password
   * on the live site still got the N5 placeholder instead of the real
   * Navigator. The hostname survives here for one purpose only: whether
   * the debug ring buffer runs. That is why the effect still exists —
   * `window` is not available during the server pass.
   */
  const [pilot, setPilot] = useState<PilotMode>(() =>
    resolvePilotMode({
      flagValue: process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED,
      authorized,
      hostname: null,
    }),
  );
  useEffect(() => {
    setPilot(
      resolvePilotMode({
        flagValue: process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED,
        authorized,
        hostname: window.location.hostname,
      }),
    );
  }, [authorized]);

  const logRef = useRef<PilotLog | null>(null);
  if (logRef.current === null) logRef.current = createPilotLog();

  /*
   * Trip restore (pilot round 3, item 4) — the refs that make a reload
   * mid-drive recoverable. All refs, no React state: nothing here draws.
   *
   * restorePayloadRef is armed with persisted route material immediately
   * before the restore's plan() call and consumed by exactly that call.
   * lastRouteRef holds the latest successful route material with the
   * request it answered — every successful plan refreshes it, fresh and
   * restored alike, via the port's onRoute seam. lastDestinationRef
   * rides the plan-capture wrapper because arrival context (facility
   * radius, entrances) travels beside the request, not inside it, and a
   * trip restored without it would silently lose arrival honesty.
   */
  const restorePayloadRef = useRef<RouteMaterial | null>(null);
  /*
   * HOS clocks across a reload. `hosClocksRef` mirrors the strip's live
   * state so the snapshot writer can include it; `restoredClocks` is what
   * came back, handed to the strip to apply once. Clocks are duty
   * counters — no position, no identity — and restoring them is the
   * difference between a reload that resumes a shift and one that quietly
   * hands a driver back eleven hours they have already used.
   */
  const hosClocksRef = useRef<ClockState | null>(null);
  const [restoredClocks, setRestoredClocks] = useState<ClockState | null>(null);
  const lastRouteRef = useRef<{ req: PlanRequest; route: RouteMaterial } | null>(null);
  const lastDestinationRef = useRef<DestinationInfo | null>(null);
  const lastSavedMsRef = useRef(0);

  const lifecycleRef = useRef<NavigationLifecycle | null>(null);
  if (lifecycleRef.current === null) {
    lifecycleRef.current = withPlanCapture(
      createNavigationLifecycle({
        planPort: createRestorablePlanPort(
          createNavigatorPlanPort(),
          () => {
            const payload = restorePayloadRef.current;
            restorePayloadRef.current = null;
            return payload;
          },
          (req, route) => {
            lastRouteRef.current = { req, route };
          },
        ),
        replacementPort: createNavigatorReplacementPort(),
        log: logRef.current,
      }),
      (_req, destination) => {
        lastDestinationRef.current = destination;
      },
    );
  }
  const lifecycle = lifecycleRef.current;
  const [, setRev] = useState(0);
  const bump = () => setRev((r) => r + 1);

  // Voice guidance (N7) — ONE instance, ONE speech owner, created MUTED:
  // nothing is ever spoken on page load; the driver enables it through
  // VoiceControls. Announcers live in refs so StrictMode double-effects
  // hit the same announce-once state and stay silent.
  //
  // The port is wrapped so FINISHING an utterance is a React event
  // (`speechTick`, a dependency of the voice effect below). Passive
  // phrases (the greeting, the route-start line) are retried by the
  // voice effect, and that effect's only cadences used to be position
  // updates and lifecycle changes — which exist once a watch is running.
  // The simplified startup made "voice on, name set, no watch yet" an
  // ordinary parked state, and there the effect simply never ran again
  // after the enable-confirmation claimed the speaker: the greeting
  // starved, and the route-start line then lost its single route-ready
  // render to the still-unspoken greeting. Speech completion IS the
  // event a passive retry is waiting for, so it re-runs the effect —
  // event-driven, no polling, and the voice module's arbitration,
  // ledger, priorities and watchdog are untouched.
  const [speechTick, setSpeechTick] = useState(0);
  const voiceRef = useRef<VoiceGuidance | null>(null);
  if (voiceRef.current === null) {
    const speechPort = createBrowserSpeechPort();
    voiceRef.current = createVoiceGuidance(
      {
        supported: speechPort.supported,
        speak: (text, onDone) =>
          speechPort.speak(text, () => {
            onDone();
            setSpeechTick((t) => t + 1);
          }),
        cancel: () => speechPort.cancel(),
      },
      { startMuted: true },
    );
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
  const driverPhraseAnnouncerRef = useRef(createDriverPhraseAnnouncer());
  const spokenRouteIdRef = useRef<string | null>(null);
  const prevLcStateRef = useRef<LifecycleState>('idle');

  /*
   * The driver's first name, restored from this device (pre-trip setup
   * milestone). It used to be ephemeral by owner decision; a driver who
   * opens Navigator every morning should not retype their own name every
   * morning, so it is now remembered — through `driver-storage`, which
   * owns the key and re-validates on the way out.
   *
   * WHAT DID NOT CHANGE: it exists to be SPOKEN, and nothing else. It is
   * never put in a provider request, a routing URL, a diagnostic payload,
   * the pilot log, or the road-test report — `buildReport` below is
   * assembled without it, so there is no path from this state to anything
   * that leaves the device.
   *
   * It starts null so the server render and the first client paint agree;
   * the effect below adopts the saved value. A driver with nothing saved
   * stays null, and a null name produces NO greeting rather than an
   * invented one.
   */
  const [firstName, setFirstName] = useState<string | null>(null);
  useEffect(() => {
    const saved = readDriverName();
    if (saved !== null) setFirstName(saved);
  }, []);
  /** Accept a name the entry form has already sanitized, and remember it. */
  const acceptFirstName = (next: string) => {
    setFirstName(next);
    writeDriverName(next);
  };
  /** Forget the name. Nothing else stored is touched. */
  const forgetFirstName = () => {
    setFirstName(null);
    clearDriverName();
  };

  /*
   * The chosen destination (final pilot milestone). The search box lives
   * at the top of the parked map — this screen — while the Start tap that
   * consumes the pick lives in PilotTripControls. ONE state, owned here,
   * handed down to both: two components that each kept their own copy
   * could disagree about where the truck is going, and the route planned
   * would be the one the driver was not looking at.
   */
  const [picked, setPicked] = useState<DestinationCandidate | null>(null);
  /** The country the search that produced `picked` was filtered to. */
  const [pickedCountry, setPickedCountry] = useState<'USA' | 'CAN' | null>(null);

  /*
   * THE TRUCK THIS SCREEN PLANS FOR, and whether the driver has confirmed
   * it (truck-route confidence milestone).
   *
   * Owned here because two surfaces need it: the parked editor that
   * changes it, and the Start attempt that sends it. It is restored from
   * sessionStorage so a driver who confirmed their truck does not
   * re-confirm on every reload — but ONLY the routing values travel: no
   * position, no route, no identity, nothing about how they drive.
   *
   * The confirmation is bound to a FINGERPRINT of the values that reach
   * the provider, so changing a routing value invalidates it
   * automatically and a display-only field cannot.
   */
  /*
   * REGION and DISPLAY UNITS (Canada milestone).
   *
   * Region decides two things and no others: which country the
   * destination search asks about, and which units the driver reads. It
   * is never inferred from GPS — a parked truck in Windsor is not
   * evidence about whose paperwork the driver carries — and it does NOT
   * select a Canadian HOS rule set, which this pilot does not implement.
   * Existing sessions stay on United States/imperial by default.
   */
  const [region, setRegion] = useState<Region>(DEFAULT_REGION_PREFS.region);
  const [units, setUnits] = useState<UnitSystem>(DEFAULT_REGION_PREFS.units);
  const metric = units === 'metric';
  useEffect(() => {
    const stored = readRegionPrefs();
    setRegion(stored.region);
    setUnits(stored.units);
  }, []);
  const persistRegion = (r: Region, u: UnitSystem) => {
    writeRegionPrefs({ region: r, units: u });
  };
  // The voice tick reads the preference through a ref: the guidance
  // effect must not re-subscribe because a driver changed units while
  // parked, and re-running it would re-arm announcers that exist to
  // speak once.
  const metricRef = useRef(metric);
  metricRef.current = metric;

  /*
   * Which country the SEARCH BOX is currently asking about. It starts at
   * the driver's region and can be flipped for one deliberate
   * cross-border search without changing the region, the units, or the
   * truck — a driver in Ontario planning a Detroit delivery is still a
   * Canadian driver reading kilometres.
   */
  const [searchRegion, setSearchRegion] = useState<Region>(DEFAULT_REGION_PREFS.region);
  useEffect(() => {
    setSearchRegion(region);
  }, [region]);

  /*
   * The confirmed truck, restored across VISITS (pre-trip setup
   * milestone) rather than just reloads. The record, its envelope and its
   * migration from the old sessionStorage home belong to `truck-storage`;
   * this screen only says when to read and when to write.
   *
   * The safety property is unchanged and lives in that module: a stored
   * confirmation is honoured only when it still matches the stored
   * values, so restoring a truck never restores permission to route for
   * a truck nobody checked.
   */
  const [truckProfile, setTruckProfile] = useState<EditableProfile>(DEFAULT_EDITABLE_PROFILE);
  const [truckConfirmation, setTruckConfirmation] = useState<ConfirmationState>(NO_CONFIRMATION);
  const [truckTouched, setTruckTouched] = useState(false);
  /** Open the full editor even though a confirmed truck exists. */
  const [editingTruck, setEditingTruck] = useState(false);
  /*
   * The driver's own answer about the long setup — `null` until they say
   * something, so the DEFAULT below can differ by who they are.
   */
  const [setupOpen, setSetupOpen] = useState<boolean | null>(null);
  /*
   * Did this visit BEGIN with a confirmed truck?
   *
   * This is the returning-driver test, and it is latched at restore
   * rather than recomputed, because "is setup complete right now?" is the
   * wrong question for choosing the default.
   *
   * A first-time driver works down the page: name, region, truck,
   * preferences, clocks. If the screen collapsed the instant they tapped
   * "This is my truck", the form would vanish under their thumb halfway
   * through — they would lose their place, and the clocks and preferences
   * they had not reached yet would disappear without ever being seen.
   * So the short screen is what a driver ARRIVES to, not something that
   * happens to them mid-setup. They leave it by tapping "Done with
   * setup", which is a decision rather than a side effect.
   */
  const [arrivedConfigured, setArrivedConfigured] = useState(false);

  /*
   * ACCOUNT SYNC (account mode only).
   *
   * Four records — the truck, the route preferences, the driver-entered
   * clocks, the briefing state — are mirrored to the driver's account so a
   * second device starts configured instead of empty. Nothing else is:
   * no position, no destination, no search, no route, no movement history.
   * That list is the whole list, and the database enforces it with a check
   * constraint rather than trusting this file to be careful.
   *
   * THE ORDER IS LOCAL FIRST, ALWAYS. Every `notifySaved` below is called
   * AFTER the local write has already completed, and it returns immediately —
   * the cloud write is debounced and happens later, off this path. So a
   * cloud failure, a dead network, or a signed-out session cannot delay a
   * save, cannot surface an error here, and cannot stand between a driver
   * and Start. There is no sync UI on this screen for the same reason:
   * status and retry live on the Account screen, where a driver can act.
   *
   * `restoreNonce` changes at most once per mount, when a download from the
   * account has been written to device storage. The three restore effects
   * below list it so they re-read their own records — which is why sync
   * never reaches into this screen's state, and why a download cannot
   * half-apply.
   */
  const { restoreNonce, notifySaved } = useAccountSync({
    enabled: accountMode,
    transport: syncTransport,
  });

  useEffect(() => {
    const saved = readTruck();
    if (saved === null) return;
    setTruckProfile(saved.profile);
    setTruckConfirmation(saved.confirmation);
    setTruckTouched(true);
    // The same fingerprint rule the gate uses: a restored confirmation
    // counts only while it still matches the restored values. A truck that
    // arrived from the account is held to it too — restoring a truck must
    // never restore permission to route for a truck nobody checked.
    setArrivedConfigured(
      saved.confirmation.confirmedFingerprint === routingFingerprint(saved.profile),
    );
  }, [restoreNonce]);
  const persistTruck = (profile: EditableProfile, confirmation: ConfirmationState) => {
    writeTruck(profile, confirmation);
    notifySaved('truck');
  };

  /*
   * THE DRIVER'S SAVED ROUTE PREFERENCES (Fast Start milestone).
   *
   * Their own record, restored on mount like the truck and the clocks —
   * and deliberately NOT part of the truck, so avoiding a toll is never a
   * truck edit that costs the driver a re-confirmation.
   *
   * An unreadable record returns "avoid nothing", which is exactly what
   * the provider does with no `avoid[features]` at all, and the summary
   * then says "Tolls allowed" in as many words rather than staying quiet.
   */
  const [routePrefs, setRoutePrefs] = useState<RoutePreferences>(DEFAULT_ROUTE_PREFERENCES);
  useEffect(() => {
    setRoutePrefs(readRoutePrefs());
  }, [restoreNonce]);
  const changeRoutePrefs = (next: RoutePreferences) => {
    const changed = preferencesChanged(routePrefs, next);
    setRoutePrefs(next);
    writeRoutePrefs(next);
    notifySaved('route_prefs');
    /*
     * A PREFERENCE CHANGE IS A ROUTE CHANGE. The provider drew the
     * existing line around a different set of restrictions, so it is
     * discarded rather than reused — the same rule a truck edit follows.
     */
    if (changed && lifecycle.state() === 'route-ready') lifecycle.discardRoute(Date.now());
    bump();
  };
  /*
   * THE DRIVER'S CLOCKS. Restored from `clocks-storage`, which returns
   * `unset` for a first-time driver AND for every failure mode — a
   * damaged record costs the clocks and nothing else, and never yields a
   * fresh eleven hours.
   */
  const [clockEntry, setClockEntry] = useState<ClockEntryState>(CLOCKS_UNSET);
  useEffect(() => {
    setClockEntry(readClocks());
  }, [restoreNonce]);
  const saveClocks = (next: ClockEntryState) => {
    setClockEntry(next);
    writeClocks(next);
    notifySaved('hos_clocks');
    bump();
  };
  /*
   * WHETHER THE DRIVING CLOCKS ARE ON SCREEN (declutter milestone).
   *
   * A display choice, and only a display choice. It lives here rather
   * than inside HosStrip because it has to be REMEMBERED, and the strip
   * is deliberately a presentation component that touches no storage.
   * The strip stays mounted in both states, so flipping this cannot
   * reset, recreate or pause a clock — it changes what is drawn and
   * nothing else.
   *
   * Read in an effect, like every other stored record: storage is never
   * touched during render, so the server's first paint and the client's
   * first paint agree on the documented default.
   */
  const [hosVisibility, setHosVisibility] = useState<HosVisibility>(HOS_VISIBILITY_DEFAULT);
  useEffect(() => {
    setHosVisibility(readHosVisibility());
  }, []);
  const toggleHosVisibility = () => {
    setHosVisibility((current) => {
      const next = toggledVisibility(current);
      writeHosVisibility(next);
      return next;
    });
  };
  /*
   * The ONE engine state everything downstream reads: the compact strip,
   * the detailed card and the voice announcer are a single HosStrip
   * instance fed from here. Memoised on the entry itself so navigating,
   * rerouting or stopping cannot rebuild it — a new object identity would
   * re-seed the strip and silently reset the driver's clocks.
   */
  const enteredEngineClocks = useMemo(() => engineStateFor(clockEntry, Date.now()), [clockEntry]);

  /** The gate the whole setup turns on, computed from the existing authority. */
  const truckGateState = profileGate(truckProfile, truckConfirmation);
  const truckConfirmed = truckGateState === 'ready';
  /**
   * Whether the developer coordinate box holds a usable destination,
   * reported upward by PilotTripControls. That box is a preview-build
   * affordance whose state lives down there, and the Start gate has to
   * count it — see the `destinationPicked` note below.
   */
  const [devDestinationReady, setDevDestinationReady] = useState(false);
  /*
   * ONE value decides three things — whether Start is disabled, the
   * sentence beneath it, and the checklist at the top — so they cannot
   * disagree with each other.
   */
  const setup = setupStatus({
    driverName: firstName,
    truckGate: truckGateState,
    // Canada's clocks are not "unset" — the engine does not model that
    // region's rules at all, and the checklist says so rather than
    // implying the driver forgot something.
    clocks: region === 'CA' ? 'unsupported' : clockEntry.kind === 'set' ? 'set' : 'unset',
    /*
     * A searched place OR a developer-entered coordinate. `picked` alone
     * was the wrong question: the coordinate box lives inside
     * PilotTripControls, `Start` has always planned to whichever
     * resolves, and gating on the search alone locked that path out of
     * its own button. The gate now asks what the planner asks.
     */
    destinationPicked: picked !== null || devDestinationReady,
  });
  /*
   * Whether a Start attempt is running right now, reported upward by
   * PilotTripControls. The search must refuse edits while an attempt is
   * live (the frozen tap-time destination is the guarantee; the disable
   * is the honest signal), and the attempt's 'locating' phase is
   * invisible to the lifecycle — its state is still 'idle' — so the
   * controls say so themselves.
   */
  const [startPending, setStartPending] = useState(false);

  /*
   * The search-bias origin: a stable object, or null before the first
   * fix. This screen re-renders on every GPS tick (1 Hz), and a fresh
   * literal each render restarted the search effect — the round-2
   * flashing. Identity changes only when the truck moves ~110 m. Null is
   * honest and expected: the parked search runs BEFORE location exists
   * (permission arrives with the Start tap), and the server's unbiased
   * mode answers with no distances rather than distances from a fake
   * center.
   */
  const fixLat = position.fix?.lat ?? null;
  const fixLng = position.fix?.lng ?? null;
  const searchOrigin = useMemo(
    () => (fixLat === null || fixLng === null ? null : { lat: fixLat, lng: fixLng }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fixLat === null ? null : fixLat.toFixed(3), fixLng === null ? null : fixLng.toFixed(3)],
  );

  /*
   * Whether the driver has voice ON, mirrored from VoiceControls.
   *
   * The mute flag itself lives in the guidance module, which is not a
   * React value — nothing re-renders when it changes. This mirror exists
   * so the voice effect below can (a) re-run at the moment voice becomes
   * usable and (b) refuse to offer a personalized line into a speaker
   * that cannot make a sound. Voice starts muted, so this starts false.
   */
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  /*
   * Off-route episodes, and whether the app is currently holding out for a
   * replacement that does not require an unverified turnaround.
   *
   * The episode number is what makes "say it once" mean once PER DEPARTURE
   * rather than once per trip: a driver who leaves the route, recovers, and
   * leaves again is told both times. It rides in the voice id, so the
   * existing announce-once ledger does the enforcing.
   */
  const offRouteEpisodeRef = useRef(0);
  const [awaitingSafeReroute, setAwaitingSafeReroute] = useState(false);

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
    void lifecycle.requestReroute(Date.now(), accuracyM).then((result) => {
      // A VALID route we refuse to drive: its first move opposed the way
      // the truck is pointed. Say so, show so, and keep going forward —
      // the current route context stands and a later attempt may find a
      // path that starts in the truck's actual direction.
      if (result.outcome === 'unsafe-reversal') setAwaitingSafeReroute(true);
      else if (result.outcome === 'replaced') setAwaitingSafeReroute(false);
      bump();
    });
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
    /*
     * The previous/current state pair for EDGE detection uses the
     * render-scoped `lcState`, never `snap.state`. The reroute effect
     * above runs first (same component, declared earlier) and
     * `requestReroute` transitions off-route → rerouting SYNCHRONOUSLY
     * before its first await — so by the time this effect snapshots the
     * machine, the off-route state it needs to observe is already gone.
     * `lcState` is the value BOTH effects were handed by the render that
     * scheduled them: on the departure render it is 'off-route' no matter
     * what the earlier effect has since done to the machine. Snapshotting
     * here instead is exactly the bug that made the road test's off-route
     * announcement unreachable (2026-08 audit, Finding 1).
     */
    const prev = prevLcStateRef.current;
    prevLcStateRef.current = lcState;

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

    /*
     * OFF ROUTE — the sentence the road test found missing.
     *
     * A new episode begins on the transition INTO off-route, never on a
     * tick while already there, so the driver is told once per departure
     * and not once a second. Recovery closes the episode, so a second
     * departure later is a new event and is announced again.
     *
     * `normal` priority: it queues behind a maneuver rather than cutting
     * one in half. A driver mid-turn needs the turn; this line is still
     * true two seconds later.
     */
    if (lcState === 'off-route' && prev !== 'off-route' && prev !== 'rerouting') {
      offRouteEpisodeRef.current += 1;
      voice.request(
        rerouteVoiceRequest({ kind: 'off-route', episode: offRouteEpisodeRef.current }),
      );
    }
    if (lcState === 'navigating' && (prev === 'off-route' || prev === 'rerouting')) {
      // Back on a route: the episode is over and any hold is released.
      setAwaitingSafeReroute(false);
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

    /*
     * A valid replacement was refused for implying a turnaround this app
     * cannot verify. The driver is told what is happening WITHOUT being
     * told to turn around — no truck-suitable turnaround has been
     * identified, and none can be with the data this app has. Same
     * episode key, so it is said once per departure, not once a second.
     */
    if (awaitingSafeReroute) {
      voice.request(
        rerouteVoiceRequest({
          kind: 'awaiting-safe-replacement',
          episode: offRouteEpisodeRef.current,
        }),
      );
    }

    // Maneuvers speak only while the trip is live AND still ours. Off
    // route, the next maneuver belongs to a route the truck has left.
    const staleGuidance = snap.state === 'off-route' || snap.state === 'rerouting';
    if (active && !staleGuidance && view.maneuvers !== null) {
      // The voice reads the driver's units too: a Canadian driver hears
      // "In 500 metres" from the SAME maneuver, at the same threshold,
      // that an American driver hears "In a quarter mile" from.
      for (const req of maneuverAnnouncerRef.current.collect(
        view.maneuvers,
        view.speedMph,
        metricRef.current,
      )) {
        voice.request(req);
      }
    }

    /*
     * The two personal lines, LAST in the tick and on purpose.
     *
     * Both are `passive`, which the guidance module drops outright when
     * anything is speaking or queued — so asking after every other
     * announcer has had its turn means a maneuver, an HOS warning, a
     * status degradation or a completion line always claims the speaker
     * first, within this tick and not merely on average. A dropped
     * greeting is dropped, never queued behind the turn it lost to.
     *
     * Nothing is offered until the driver has actually turned voice on.
     * That is not politeness — it is the mobile Safari contract: the
     * FIRST utterance of a session must come from a real user gesture,
     * and the one this app has is the Enable voice button, which speaks
     * its own confirmation from inside the click handler. Offering into a
     * muted engine produces `dropped-muted`, which the announcer
     * deliberately does not treat as settled, so the line survives until
     * the speaker genuinely exists.
     *
     * Every outcome is reported back. A phrase retires when the guidance
     * module says it reached the driver — never merely because it was
     * once offered.
     *
     * The local hour is read HERE, at the component edge, because the
     * pure core may not read a clock; `getGreetingPeriod` takes the
     * number. `getHours()` is the driver's own device zone, which is the
     * time of day they are actually living in.
     */
    if (voiceEnabled) {
      const announcer = driverPhraseAnnouncerRef.current;
      for (const req of announcer.collect({
        firstName,
        localHour: new Date(Date.now()).getHours(),
        lifecycleState: lcState,
      })) {
        announcer.note(req.id, voice.request(req));
      }
    }
    /*
     * `lcState` and `position` are the cadence, and their absence was the
     * bug this list is fixing.
     *
     * `view` is NOT a cadence before a trip starts: the lifecycle's tick
     * is inert outside an active trip and hands back the frozen
     * NO_ROUTE_VIEW constant every time, so keyed on `view` alone this
     * effect ran ONCE in the entire pre-navigation window — at the render
     * that set the driver's name, while voice was still muted. The
     * route-start phrase was never offered at all, because reaching
     * `route-ready` changes neither `view` nor any other dependency here.
     *
     * `lcState` makes reaching `route-ready` an event. `position` restores
     * the once-a-second cadence this effect's own comments already assumed
     * it had — the same cadence the stuck-utterance watchdog needs, and
     * the retry that lets a greeting land after the enable confirmation
     * finishes. `voiceEnabled` makes turning voice on an event.
     * `speechTick` makes an utterance FINISHING an event — before it, a
     * parked page with no watch had no cadence at all, and a passive
     * phrase dropped for a busy speaker was never retried (startup
     * simplification: voice now commonly turns on before any watch).
     */
  }, [
    view,
    lcState,
    position,
    voiceEnabled,
    awaitingSafeReroute,
    lifecycle,
    firstName,
    speechTick,
  ]);

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

  /*
   * PERSIST the active trip; CLEAR it when the trip genuinely ends.
   *
   * Written while guidance is live (the ACTIVE states), riding the
   * position cadence but re-saved at most once per RESTORE_REFRESH_MS so
   * a long drive's snapshot never ages toward the restore window. The
   * snapshot is the planned route and its arrival context — never the
   * driver's name, never a GPS trail, never HOS (see trip-restore.ts for
   * the full rails). sessionStorage on purpose: per-tab, dies with it.
   *
   * Cleared on the TRANSITION into arrived/completed — a reload at the
   * receiving gate must not resurrect navigation, and Stop cancels into
   * completed so a driver who ended the trip stays in charge. NEVER
   * cleared merely for being idle: the mount that precedes a restore is
   * idle too, and clearing there would delete the snapshot the restore
   * effect is about to read.
   */
  const prevPersistStateRef = useRef<LifecycleState>('idle');
  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    const prev = prevPersistStateRef.current;
    prevPersistStateRef.current = lcState;
    try {
      if (ACTIVE_LIFECYCLE_STATES.includes(lcState)) {
        const planned = lastRouteRef.current;
        const destination = lastDestinationRef.current;
        const now = Date.now();
        if (
          planned !== null &&
          destination !== null &&
          now - lastSavedMsRef.current >= RESTORE_REFRESH_MS
        ) {
          sessionStorage.setItem(
            TRIP_RESTORE_KEY,
            serializeTripSnapshot({
              route: planned.route,
              request: planned.req,
              destination,
              savedAtMs: now,
              ...(hosClocksRef.current === null ? {} : { clocks: hosClocksRef.current }),
            }),
          );
          lastSavedMsRef.current = now;
        }
      } else if ((lcState === 'arrived' || lcState === 'completed') && prev !== lcState) {
        sessionStorage.removeItem(TRIP_RESTORE_KEY);
        lastSavedMsRef.current = 0;
      }
    } catch {
      // Storage full or blocked: restore is an enhancement, never a crash.
    }
  }, [lcState, position]);

  /*
   * RESTORE (pilot round 3, item 4). The driver takes a call, the OS
   * discards the tab, the browser reloads the page mid-drive — and
   * without this the reload lands on the idle screen asking a rolling
   * driver to re-plan. If a fresh snapshot of an active trip exists,
   * this puts the trip back through the lifecycle's own front door:
   * plan() served by the armed restore payload (no network, no provider
   * spend, every transition invariant intact), then startNavigation().
   *
   * Gated on pilot.active (without it there is no route source), on the
   * lifecycle still being idle (anything the driver started wins), and
   * run once per mount (the ref also absorbs StrictMode's double
   * effect). A stale or damaged snapshot is deleted, never partially
   * trusted.
   *
   * The GPS watch restarts under the permission rail, not around it:
   * start() is called from a load ONLY when the Permissions API
   * positively answers 'granted' — the browser then resumes the watch
   * the driver already approved mid-trip, with no prompt. Where the API
   * is absent or unsure, the driving surface's own "Enable location"
   * control is the way back, from a real tap. Voice cannot be resumed by
   * code at all (mobile Safari: the first utterance must come from a
   * user gesture), so it returns muted — like every fresh load, by
   * design.
   */
  const restoreAttemptedRef = useRef(false);
  useEffect(() => {
    if (restoreAttemptedRef.current) return;
    restoreAttemptedRef.current = true;
    if (!pilot.active) return;
    if (typeof sessionStorage === 'undefined') return;
    if (lifecycle.state() !== 'idle') return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(TRIP_RESTORE_KEY);
    } catch {
      return;
    }
    const parsed = parseTripSnapshot(raw, Date.now());
    if (parsed === null) {
      if (raw !== null) {
        try {
          sessionStorage.removeItem(TRIP_RESTORE_KEY);
        } catch {
          /* already unreadable — nothing to protect */
        }
      }
      return;
    }
    restorePayloadRef.current = parsed.route;
    // Clocks first: they are applied by the strip on its next render, so
    // they are in place before the restored trip starts burning them.
    if (parsed.clocks !== undefined) setRestoredClocks(parsed.clocks);
    void lifecycle.plan(parsed.request, parsed.destination, Date.now()).then((outcome) => {
      restorePayloadRef.current = null; // consumed or refused — never lingers
      if (!outcome.ok) return;
      if (!lifecycle.startNavigation(Date.now())) return;
      logRef.current?.record(Date.now(), 'trip-restored', parsed.route.routeId);
      bump();
      const permissions = typeof navigator === 'undefined' ? undefined : navigator.permissions;
      if (permissions && typeof permissions.query === 'function') {
        void permissions
          .query({ name: 'geolocation' })
          .then((status) => {
            if (status.state === 'granted') start();
          })
          .catch(() => {
            /* unsure = no auto-start; the Enable location control remains */
          });
      }
    });
    // Mount-once by design; the ref above enforces it against re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pilot.active, lifecycle, start]);

  /*
   * RESUME THE WATCH ON LOAD — under the SAME rail trip restore
   * established (PR #302): only when the Permissions API POSITIVELY
   * answers 'granted', so no prompt is ever possible from a load. The
   * startup simplification extends that rail from "a restored trip" to
   * the pilot's parked page, because a returning driver's destination
   * search should be biased around the truck (that is what the origin
   * exists for) and their Start should not have to wait out a first
   * fix. 'prompt' and 'denied' do nothing here: the one-tap Start is
   * the user gesture that may ask. Non-pilot builds never auto-start —
   * the N5 preview keeps permission strictly behind its own button.
   */
  const watchResumeRef = useRef(false);
  useEffect(() => {
    if (watchResumeRef.current) return;
    watchResumeRef.current = true;
    if (!pilot.active) return;
    const permissions = typeof navigator === 'undefined' ? undefined : navigator.permissions;
    if (permissions && typeof permissions.query === 'function') {
      void permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          if (status.state === 'granted') start();
        })
        .catch(() => {
          /* unsure = no auto-start; Start remains the way in */
        });
    }
    // Mount-once by design; the ref above enforces it against re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pilot.active, start]);

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
  /*
   * Where to DRAW the truck.
   *
   * Raw GPS carries the platform's error, and on the road that showed as
   * a marker sitting beside Hwy 92 instead of on it. When the matcher is
   * confident and close to the line it can say where that fix corresponds
   * to on the road, and that is what gets drawn. When it cannot, the raw
   * fix is drawn — an honestly wrong position beats a confidently wrong
   * one, because the moment the truck genuinely leaves the road is the
   * moment a snapped marker would lie about it.
   */
  const truckPosition: LatLng | null =
    mapData.matchedPosition ??
    (position.fix === null ? null : { lat: position.fix.lat, lng: position.fix.lng });

  const focusNavigationKey = focusTick === 0 ? null : `trip-start-${focusTick}`;

  /*
   * Road-test report. Assembled here because this is the only place that
   * can see the whole session at once — lifecycle, trip summary, GPS
   * health, voice, screen wake, and the pilot log. The report module owns
   * every privacy rail; nothing is pre-filtered on the way in, so a new
   * field can never be added that quietly skips the scrubber.
   */
  const buildReport = (input: { note: string; problem: ProblemReport | null }): string =>
    buildRoadTestReport({
      generatedMs: Date.now(),
      build: buildId,
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
      note: input.note,
      problem: input.problem,
    });

  // Map-first surface only while guidance is genuinely live; every other
  // state keeps the ordinary page so nothing else on the site changes.
  const fullScreen = ACTIVE_LIFECYCLE_STATES.includes(lcState);
  const [styleId, setStyleId] = useState<MapStyleId>(DEFAULT_MAP_STYLE);
  /** The cockpit's bottom band height, measured by the view below. */
  const [bottomInset, setBottomInset] = useState(0);
  const [overviewToggleKey, setOverviewToggleKey] = useState(0);

  /*
   * The off-route line. Two states, and NEITHER is an instruction.
   *
   * The road test's defect was guidance that implied a U-turn the app had
   * not identified, could not verify, and would not have been able to for
   * a 70-foot combination. So this says what is happening and nothing
   * about which way to go: no turnaround is named here or anywhere else,
   * because naming one from generic geometry is the hazard itself.
   */
  const offRouteText =
    lcState === 'off-route' || lcState === 'rerouting'
      ? awaitingSafeReroute
        ? 'OFF ROUTE · Continue safely while a new route is calculated.'
        : 'OFF ROUTE · Rerouting — continue safely.'
      : null;

  /*
   * OFF ROUTE RETIRES THE OLD MANEUVER.
   *
   * Road test: the driver passed the turn at Charles Hardy, and the app
   * kept showing and speaking that turn — the controller is still tracking
   * the route the truck has left, so it happily goes on naming a maneuver
   * that is now behind them. A missed turn repeated is worse than
   * silence: it is an instruction the driver cannot follow.
   *
   * So while off route, the maneuver view is dropped. The card shows the
   * off-route state instead, and the announcer — which reads exactly this
   * value — has nothing to say until a replacement route supplies a real
   * next maneuver.
   */
  const guidanceStale = lcState === 'off-route' || lcState === 'rerouting';
  const shownView: DrivingView = guidanceStale ? { ...view, maneuvers: null } : view;

  const roadName = guidanceStale
    ? null
    : roadNameFromInstruction(view.maneuvers?.next?.instruction ?? null);
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
      view={shownView}
      watching={watching}
      focusNavigationKey={focusNavigationKey}
      fullScreen={fullScreen}
      roadName={roadName}
      etaText={etaText}
      overviewSlot={
        fullScreen ? (
          <LockGate action="route-overview" lockedLabel="Route overview" compact>
            <button
              type="button"
              onClick={() => setOverviewToggleKey((k) => k + 1)}
              className="min-h-16 min-w-0 w-full truncate rounded-cockpit border border-line bg-nav-surface-2 px-3 text-lg font-semibold text-ink"
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
            bottomInsetPx={bottomInset}
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
      onVoiceMutedChange={(muted) => setVoiceEnabled(!muted)}
      lifecycleLine={
        pilot.active && lcState !== 'idle'
          ? `Pilot trip state: ${lcState.replace(/-/g, ' ')}`
          : null
      }
      /*
       * The parked pilot page hides the standalone Enable-location button
       * while the cold-start setup window is open: there, the one-tap
       * Start owns location, and a second location button would be the
       * old extra step back under a different name. It RETURNS when the
       * window has closed with the watch off — after Stop, the honest way
       * to hand the motion lock fresh truth again — and the driving
       * surface always keeps it (trip restore's fallback, PR #302).
       */
      showIdleStartControl={!pilot.active || fullScreen || !lock.setupWindow}
      hosRestoredClocks={restoredClocks}
      hosVisibility={hosVisibility}
      onToggleHosVisibility={toggleHosVisibility}
      hosEnteredClocks={enteredEngineClocks}
      onHosClocks={(c) => {
        hosClocksRef.current = c;
      }}
      onBottomInset={setBottomInset}
      /*
       * The parked destination search, mounted at the top of the map
       * (final pilot milestone). Only while the lifecycle is idle: the
       * moment an attempt leaves 'idle' (planning, the briefing, live
       * guidance) the box is gone, exactly like the old in-controls
       * search that only rendered on the idle branch. Behind the SAME
       * edit-destination gate as the controls below — the shared
       * permission map, not this component, decides that a moving truck
       * (or unknown motion after the setup window latches — doc 06 §1a)
       * gets no text field. Typing requests nothing: location permission
       * stays tied to the Start tap, and a search with no fix runs in
       * the server's honest unbiased mode.
       */
      mapSearchSlot={
        pilot.active && !fullScreen && lcState === 'idle' ? (
          <LockGate action="edit-destination" lockedLabel="Destination search" compact>
            <div className="rounded-cockpit border border-line bg-asphalt/95 p-3">
              {/*
                Trip plan first? — and, when the driver arrives carrying one,
                the planned stop itself. Sits ABOVE the search because it is
                the earlier question: a driver who has already planned should
                not have to retype the stop they just chose.

                Behind the same edit-destination gate as the search below,
                because using a planned stop SETS A DESTINATION — a moving
                truck gets neither.

                Planning is never forced: this renders nothing at all once the
                driver has answered, and the search underneath is untouched
                either way.
              */}
              <TripPlanFirst
                onUsePlannedStop={(place) => {
                  setPicked(place);
                  // Trip Planner plans U.S. property-carrier hours only, so a
                  // stop that came from it is attested U.S. — the same
                  // recorded-at-pick discipline the search uses below.
                  setPickedCountry('USA');
                }}
              />
              <DestinationSearch
                origin={searchOrigin}
                disabled={startPending}
                onPick={(place) => {
                  setPicked(place);
                  // WHICH COUNTRY THIS RESULT CAME FROM, recorded at the
                  // moment of the pick. The provider filtered the list to
                  // one country, so this is attested rather than inferred
                  // — and it is what makes the cross-border reminder
                  // correct in the Windsor/Detroit corridor, where no
                  // coordinate rule can be.
                  setPickedCountry(searchCountryFor(searchRegion));
                }}
                onClear={() => {
                  setPicked(null);
                  setPickedCountry(null);
                }}
                country={searchCountryFor(searchRegion)}
                metric={metric}
              />
              {/* Crossing the border is DELIBERATE: one tap, clearly
                  labelled, never a side effect of typing. It swaps only
                  which country this search asks about — the region
                  setting, the units and the truck are untouched. */}
              <button
                type="button"
                onClick={() => setSearchRegion((r) => (r === 'CA' ? 'US' : 'CA'))}
                className="mt-2 min-h-16 w-full rounded-cockpit border border-line bg-nav-surface px-3 text-lg text-ink"
              >
                {crossBorderSearchLabel(searchRegion)}
              </button>
            </div>
          </LockGate>
        ) : null
      }
      destinationSlot={
        pilot.active ? (
          <PilotTripControls
            lifecycle={lifecycle}
            onOnboardingSeen={() => notifySaved('onboarding')}
            gps={{ position, watching, acquiring, start, stop }}
            debugLog={pilot.debugLogging ? logRef.current : null}
            buildReport={buildReport}
            build={buildId}
            firstName={firstName}
            onFirstName={acceptFirstName}
            onForgetFirstName={forgetFirstName}
            picked={picked}
            onPicked={setPicked}
            onAttemptActive={setStartPending}
            onDestinationReady={setDevDestinationReady}
            truckProfile={truckProfile}
            truckGate={truckGateState}
            regionPanel={
              <RegionPanel
                region={region}
                units={units}
                onRegion={(r) => {
                  setRegion(r);
                  // The region's usual units follow, from the one
                  // authority; the unit buttons still override.
                  const u = defaultUnitsFor(r);
                  setUnits(u);
                  persistRegion(r, u);
                  bump();
                }}
                onUnits={(u) => {
                  setUnits(u);
                  persistRegion(region, u);
                  bump();
                }}
              />
            }
            metric={metric}
            crossBorder={looksCrossBorder({
              region,
              destinationCountry: pickedCountry,
              origin: position.fix,
              destination: picked?.position ?? null,
            })}
            hosUnavailable={region === 'CA'}
            setupStatusSlot={<SetupStatus status={setup} />}
            startBlockedReason={setup.blockedReason}
            /*
             * THE COLLAPSE, from the one pure gate. `configured` and
             * `blockedReason` come out of the same `setupStatus` call, so
             * the short screen and the Start button cannot disagree about
             * whether setup is finished — the failure that would matter
             * here is a compact summary shown over an unconfirmed truck,
             * and it is unreachable by construction.
             *
             * An open truck editor forces the long order: the driver is
             * mid-edit, and collapsing the panel they are typing in would
             * be its own defect.
             */
            setupConfigured={setup.configured && !editingTruck}
            setupOpen={setupOpen ?? !arrivedConfigured}
            onSetupOpen={setSetupOpen}
            setupSummarySlot={
              <SetupSummary
                status={setup}
                profile={truckProfile}
                prefs={routePrefs}
                clocks={clockEntry}
                driverName={firstName}
                metric={metric}
                onEditTruck={() => setEditingTruck(true)}
                onOpenSetup={() => setSetupOpen(true)}
              />
            }
            driverSlot={
              <DriverNameEntry
                firstName={firstName}
                onAccept={acceptFirstName}
                onClear={forgetFirstName}
              />
            }
            routeAvoid={preferencesToAvoid(routePrefs)}
            prefsPanel={<RoutePreferencesPanel prefs={routePrefs} onChange={changeRoutePrefs} />}
            clocksPanel={
              <ClockSetup
                state={clockEntry}
                onSave={saveClocks}
                onClear={() => saveClocks(CLOCKS_UNSET)}
                unsupported={region === 'CA' ? CANADA_HOS_NOTICE : null}
                nowMs={Date.now()}
              />
            }
            truckSlot={
              /*
               * A returning driver whose truck was restored sees FOUR
               * NUMBERS and a way back in, not the whole form again. The
               * editor is still the only place a truck can be changed —
               * the summary is a read-only echo — so there remains
               * exactly one edit path and exactly one confirmation
               * after it.
               */
              truckConfirmed && !editingTruck ? (
                <TruckSummary
                  profile={truckProfile}
                  metric={metric}
                  onEdit={() => setEditingTruck(true)}
                />
              ) : (
                <TruckProfileEditor
                  profile={truckProfile}
                  confirmed={
                    truckConfirmation.confirmedFingerprint === routingFingerprint(truckProfile)
                  }
                  isDefault={!truckTouched}
                  metric={metric}
                  onChange={(next) => {
                    // A routing value that changed invalidates the
                    // confirmation by construction: the gate compares
                    // fingerprints, so nothing here has to remember which
                    // fields mattered. No provider request occurs.
                    setTruckProfile(next);
                    setTruckTouched(true);
                    persistTruck(next, truckConfirmation);
                    // A planned route belongs to the OLD truck. Discard it
                    // rather than let Start reuse it for a different one.
                    if (lifecycle.state() === 'route-ready') lifecycle.discardRoute(Date.now());
                    bump();
                  }}
                  onConfirm={() => {
                    setEditingTruck(false);
                    const next = confirmProfile(truckProfile);
                    setTruckConfirmation(next);
                    setTruckTouched(true);
                    persistTruck(truckProfile, next);
                    bump();
                  }}
                />
              )
            }
            onChanged={bump}
          />
        ) : null
      }
      offlineText={offlineNotice({ online, navigating: fullScreen })}
      offRouteText={offRouteText}
      hosSourceLabel={clocksProvenance(clockEntry, tripLoaded && restoredClocks !== null)}
      /*
       * THE CANADIAN HOS BOUNDARY. The shipped engine implements US
       * federal limits; Canada's rules differ in almost every dimension
       * and this milestone does not implement them. So in Canada mode
       * the clocks are not shown at all — showing 11/14/70 to a Canadian
       * driver would be the single most dangerous thing this app could
       * do — and the notice stands in their place. Navigation is
       * unaffected: guidance, the map and the route work exactly as they
       * do in US mode.
       */
      hosUnavailableNotice={region === 'CA' ? CANADA_HOS_NOTICE : null}
      metric={metric}
    />
  );
}
