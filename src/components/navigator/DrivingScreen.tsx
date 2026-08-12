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
import { formatDriverDistanceMi, formatTruckHeightFtIn } from '@/lib/navigator/format-units';
import { maneuverGlyph } from '@/lib/navigator/maneuver-glyph';
import { statusSeverity, severityGlyph } from '@/lib/navigator/status-severity';
import { DEFAULT_TRUCK_PROFILE } from '@/lib/trip-planner/types';
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
 * The truck chip (blueprint §5): the profile the route was actually planned
 * with, pinned over the map — always visible = always trusted. It shows the
 * REAL planning input (`DEFAULT_TRUCK_PROFILE`, the same object the plan
 * request sends) and says it is the pilot default, because implying a
 * custom truck would be a lie. Display-only: no tap target, no pointer
 * events, so it can never intercept a map gesture. Exported for the design
 * harness.
 */
export function TruckChip() {
  return (
    <div
      aria-label="Truck profile used for this route"
      className="pointer-events-none absolute right-3 top-3 z-[1000] rounded-cockpit border border-line bg-nav-surface px-3 py-2 text-right shadow-lg"
    >
      <div className="font-data num-data text-[length:var(--size-street)] font-bold leading-tight text-ink">
        {formatTruckHeightFtIn(DEFAULT_TRUCK_PROFILE.heightFt)} ·{' '}
        {DEFAULT_TRUCK_PROFILE.grossWeightLbs.toLocaleString('en-US')} lb
      </div>
      <div className="text-[length:var(--size-label)] leading-tight text-ink/70">
        Pilot default profile
      </div>
    </div>
  );
}

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
  offRouteText = null,
  onVoiceMutedChange,
  showIdleStartControl = true,
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
      className={`max-h-[28dvh] shrink-0 overflow-hidden scroll-mt-4 rounded-cockpit border border-line bg-asphalt/95 p-3 shadow-lg [@media(max-height:600px)]:max-h-[40dvh] sm:p-6${imminent ? ' nav-imminent' : ''}`}
    >
      {m ? (
        <>
          <div className="flex items-center gap-3">
            {glyph ? (
              /* Reinforcement only, never the meaning: the instruction text
                 below is the primary signal, so the arrow is aria-hidden
                 and simply absent when the provider's action is one the
                 whitelist does not know. */
              <div
                aria-hidden="true"
                className="font-data text-[length:clamp(40px,min(12vw,8dvh),var(--size-maneuver))] leading-none text-ink"
              >
                {glyph}
              </div>
            ) : null}
            {/* The blueprint's huge numeral. Clamped by viewport so a 320px
               phone still fits "In 127.5 mi" on one line; the ceiling is
               the --size-maneuver design size (60px). */}
            <p className="font-data num-data text-[length:clamp(40px,min(15vw,9dvh),var(--size-maneuver))] font-bold leading-none tracking-tight text-ink">
              In {formatDriverDistanceMi(view.maneuvers?.distanceMi)}
            </p>
          </div>
          {/* The largest PROSE on the screen (the distance numeral above is
              the only thing bigger — blueprint §5), sized so the map still
              owns a 320 px phone. Clamped rather than clipped — two lines
              and an ellipsis says "there is more"; a hard cut mid-word says
              nothing at all. */}
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

  // The trip bar (blueprint §5): three real values — speed from GPS,
  // remaining from route progress, arrival from the provider's planned
  // duration. Speed gets the blueprint's speed-cluster emphasis (48px
  // ceiling); labels sit at the 16px drive-mode floor, tabular numerals so
  // nothing jitters as it counts down. No posted-limit shield: the route
  // response carries no speed-limit data, and a shield rendered from
  // nothing would be the most dangerous fake on the screen.
  const compactStrip = (
    <dl className="grid shrink-0 grid-cols-3 items-end gap-2 rounded-cockpit border border-line bg-nav-surface px-3 py-1.5 text-center text-ink">
      <div>
        <dt className="text-[length:var(--size-label)] leading-tight text-ink/70">Speed</dt>
        {/* One line always: a value that stacks at 58 but not at 8 would
            re-flow the whole bar as speed changes. 7.5vw fits "115 mph" in
            a third of a 320px portrait screen; 6dvh keeps the same cell
            honest in landscape, where the strip lives in the narrow left
            rail and width is not the scarce dimension. The ceiling is the
            --size-speed design size, reached on wide viewports. */}
        <dd className="whitespace-nowrap font-data num-data text-[length:clamp(24px,min(7.5vw,6dvh),var(--size-speed))] font-bold leading-none">
          {view.speedMph !== null ? `${Math.round(view.speedMph)} mph` : '—'}
        </dd>
      </div>
      <div>
        <dt className="text-[length:var(--size-label)] leading-tight text-ink/70">Remaining</dt>
        <dd className="font-data num-data text-[length:var(--size-trip)] font-semibold leading-tight">
          {formatDriverDistanceMi(view.remainingMi)}
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
  const shellCls = fullScreen
    ? 'fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-nav-bg'
    : '';
  // Portrait stacks card → map → readouts. Landscape becomes a two-column
  // grid — readouts left, map spanning the right — WITHOUT reordering the
  // DOM, so the map still never remounts.
  // Landscape rows are IMPLICIT, one per left-column item (every item
  // carries col-start-1), so each honest line — status, off-route,
  // offline — sizes to its own content. The template-plus-spanning-map
  // arrangement this replaces let Chromium's track sizing collapse
  // conditional rows to 0px, painting the warning rail's lines over each
  // other exactly when more than one thing was wrong.
  const surfaceCls = fullScreen
    ? 'flex h-[100dvh] flex-col gap-2 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] ' +
      'landscape:grid landscape:grid-cols-[minmax(0,38%)_minmax(0,1fr)] ' +
      'landscape:auto-rows-min landscape:items-start'
    : 'space-y-6';
  const colOne = fullScreen ? 'shrink-0 landscape:col-start-1' : '';
  // The map is pinned to the VIEWPORT in landscape, not to the grid — the
  // road-test finding that produced this rule stands: on a 320 px-tall
  // phone on its side the left column can need 500 px, and a map sized by
  // the grid followed it below the fold, taking its own Recenter and zoom
  // controls with it. The pinning is now absolute positioning against the
  // fixed shell (same 0.5rem margins the grid padding gave it) instead of
  // an explicit height on a row-spanning grid item: a fixed-height span
  // let Chromium collapse the left column's conditional rows to 0px, and
  // an absolutely-positioned map cannot influence row sizing at all. The
  // left offset mirrors the grid's minmax(0,38%) first column plus the
  // gap. (landscape:col-start-2 is inert on an absolute item and kept for
  // the structural pins that read it.)
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
    ? 'relative min-h-[38dvh] flex-1 overflow-hidden rounded-cockpit border border-line ' +
      'landscape:absolute landscape:inset-y-2 landscape:right-2 ' +
      'landscape:left-[calc(0.38*(100vw-1rem)+1rem)] landscape:col-start-2 landscape:min-h-0'
    : mapSlot !== null
      ? 'relative h-72 w-full overflow-hidden rounded-cockpit border border-line sm:h-96'
      : '';

  return (
    <div className={shellCls}>
      <div className={surfaceCls}>
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
            component that must survive the layout switch untouched. */}
        <div className={mapWrapCls}>{mapSlot}</div>

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
                      : ''
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
        {/* gap-3 = the blueprint's 12px minimum spacing between adjacent
            touch targets, so a glove aiming for Stop cannot land on Mute. */}
        <div className={fullScreen ? `${colOne} flex gap-3` : ''}>
          {fullScreen ? overviewSlot : null}
          {voice ? (
            <LockGate action="mute-voice" lockedLabel="Voice mute">
              <VoiceControls
                voice={voice}
                compact={fullScreen}
                onMutedChange={onVoiceMutedChange}
              />
            </LockGate>
          ) : null}
          <LockGate action="stop-navigation" lockedLabel="Stop navigation">
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

export function DrivingScreen({ authorized = false }: { authorized?: boolean } = {}) {
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
   * The driver's first name. Ephemeral by owner decision: React state on
   * the mounted screen, and nothing else — no localStorage, no
   * sessionStorage, no cookie, no profile, no database row. A full reload
   * loses it and the driver types it again.
   *
   * It exists to be SPOKEN. It is never put in a provider request, a
   * routing URL, a diagnostic payload, the pilot log, or the road-test
   * report — `buildReport` below is assembled without it, so there is no
   * path from this state to anything that leaves the device.
   */
  const [firstName, setFirstName] = useState<string | null>(null);

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
      for (const req of maneuverAnnouncerRef.current.collect(view.maneuvers, view.speedMph)) {
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
          <LockGate action="route-overview" lockedLabel="Route overview">
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
          <>
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
            {/* Map-anchored, display-only, present only while the surface
                is the driving cockpit — the parked page already states the
                full profile in the trip controls. */}
            {fullScreen ? <TruckChip /> : null}
          </>
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
      destinationSlot={
        pilot.active ? (
          <PilotTripControls
            lifecycle={lifecycle}
            gps={{ position, watching, acquiring, start, stop }}
            debugLog={pilot.debugLogging ? logRef.current : null}
            buildReport={buildReport}
            build={buildId}
            firstName={firstName}
            onFirstName={setFirstName}
            onChanged={bump}
          />
        ) : null
      }
      offlineText={offlineNotice({ online, navigating: fullScreen })}
      offRouteText={offRouteText}
      hosSourceLabel={
        tripLoaded
          ? 'Pilot trip loaded — clocks still assume a fresh driver (no ELD linked).'
          : DEFAULT_HOS_LABEL
      }
    />
  );
}
