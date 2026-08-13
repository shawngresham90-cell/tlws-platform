'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { NavigationLifecycle } from '@/lib/navigator/navigation-lifecycle';
import type { PilotLog } from '@/lib/navigator/pilot-mode';
import type { DestinationFacility } from '@/lib/navigator/truck-entrance';
import type { PositionState } from '@/lib/navigator/types';
import type { DestinationCandidate } from '@/lib/navigator-api/destination-search';
import type { RouteAvoidance } from '@/lib/trip-planner/providers';
import { toTruckProfile, type EditableProfile } from '@/lib/navigator/truck-profile';
import { sentRestrictionLines } from '@/lib/trip-planner/here-truck-params';
import { CROSS_BORDER_NOTICE } from '@/lib/navigator/region';
import type { BuildId } from '@/lib/navigator/build-id';
import {
  MAX_NOTE_CHARS,
  PROBLEM_CATEGORIES,
  buildProblemReport,
  type ProblemReport,
} from '@/lib/navigator/problem-report';
import { assessRoutePlausibility } from '@/lib/navigator/route-plausibility';
import { formatEta } from '@/lib/navigator/driving-hud';
import { formatDistance } from '@/lib/navigator/format-units';
import {
  assessStartFix,
  createStartAttempt,
  GETTING_LOCATION_TEXT,
  LOCATION_DENIED_TEXT,
  LOCATION_UNAVAILABLE_TEXT,
  NO_DESTINATION_TEXT,
  PLANNING_ROUTE_TEXT,
  STARTING_NAVIGATION_TEXT,
} from '@/lib/navigator/trip-start';
import { PostTripFeedback } from './PostTripFeedback';
import { PilotOnboarding } from './PilotOnboarding';
import { RouteBriefing } from './RouteBriefing';

/**
 * Pilot Mode trip controls (milestone P1) — the destination-entry and
 * trip-control surface that renders INSIDE the 'edit-destination'
 * LockGate slot on the driving screen (stationary or the cold-start
 * setup window — doc 06 §1a). Renders only when Pilot Mode is active
 * (flag on AND non-production host), so production builds keep the N5
 * placeholder text.
 *
 * Pilot round 1: destination entry is real SEARCH — address, business,
 * truck stop, warehouse, or city — and the driver never sees a
 * coordinate. Raw latitude/longitude entry survives only as a collapsed
 * developer affordance for bench testing a specific point.
 *
 * Pilot round 3 (startup simplification): the parked flow is destination
 * → ONE Start tap. That tap is the real user gesture that requests
 * location permission (gps.start() runs inside the click handler, at the
 * browser boundary); the attempt then waits for the GPS session to
 * publish a usable fix, plans EXACTLY ONE validated truck route from it,
 * and starts navigation the moment a clean route is accepted. A route
 * that carries warnings or plausibility findings still pauses at the
 * existing flight briefing — the pause exists precisely when there is
 * something to read. Name stays optional and only feeds the spoken
 * greeting; voice stays muted until its own tap. Every failure leaves
 * the driver parked with one honest line and a working retry:
 * permission denied, no fix (the platform's own 15 s watch bound is the
 * only timeout in the flow), a refused plan, a rejected route.
 *
 * WHY startNavigation RIDES AN EFFECT, NOT THE PLAN CALLBACK: the
 * personalized route-start greeting is offered by the driving screen's
 * voice effect only on a render whose lifecycle state is 'route-ready'
 * (driver-greeting.ts pins that proof to the transition table). Calling
 * startNavigation inside the plan promise would skip that render and
 * silently kill the greeting — the exact mechanism trip restore RELIES
 * on to keep the greeting out of restores. So a clean plan sets phase
 * 'starting' and lets the next render commit: this component's effect
 * (child — runs first) starts navigation, then the driving screen's
 * voice effect (parent — runs second) still observes the route-ready
 * render it needs. One render, both jobs, no race.
 */

const FACILITIES: readonly DestinationFacility[] = [
  'warehouse',
  'distribution-center',
  'truck-terminal',
  'industrial-park',
  'customer-yard',
  'truck-stop',
  'rest-area',
  'unknown',
];

const inputClass =
  'min-h-16 w-full rounded-card border border-line bg-transparent px-4 text-xl text-ink';
const buttonClass =
  'min-h-16 w-full rounded-card border border-line px-4 text-xl font-semibold text-ink';

export function PilotTripControls({
  lifecycle,
  gps,
  debugLog,
  buildReport = null,
  build = null,
  firstName = null,
  onFirstName,
  onForgetFirstName,
  picked,
  onPicked,
  onAttemptActive,
  truckProfile,
  truckGate,
  truckSlot,
  driverSlot = null,
  setupStatusSlot = null,
  clocksPanel = null,
  startBlockedReason = null,
  regionPanel = null,
  metric = false,
  crossBorder = false,
  hosUnavailable = false,
  onChanged,
}: {
  lifecycle: NavigationLifecycle;
  /**
   * The GPS provider's surface, injected by the driving screen: the
   * gated position state plus the watch controls the one-tap Start
   * needs. start() is only ever called from inside the Start tap's click
   * handler — the browser gesture that may show the permission prompt.
   */
  gps: {
    position: PositionState;
    watching: boolean;
    acquiring: boolean;
    start: () => void;
    stop: () => void;
  };
  /** Present only when Pilot Mode debug logging is on. */
  debugLog: PilotLog | null;
  /**
   * Assembles the road-test report from live session state. Supplied by
   * the driving screen, which is the only place that can see all of it.
   * Null hides the affordance entirely.
   */
  buildReport?: ((input: { note: string; problem: ProblemReport | null }) => string) | null;
  /** The running build, shown so a driver can quote it. */
  build?: BuildId | null;
  /**
   * The driver's sanitized first name, held in memory by the driving
   * screen for the life of the mounted session. Null until they give one.
   */
  firstName?: string | null;
  /**
   * Accepts an already-sanitized first name. Optional: a caller with no
   * use for a name (static test renders) simply omits it and the field
   * does not mount.
   */
  onFirstName?: (firstName: string) => void;
  /** Forget the saved name. Absent renders the field without a clear control. */
  onForgetFirstName?: () => void;
  /**
   * The chosen destination, OWNED BY THE DRIVING SCREEN (final pilot
   * milestone). The search box moved onto the parked map, so the pick
   * and the Start attempt that consumes it now live in two different
   * components — one state, lifted, rather than two that can disagree
   * about where the driver is going.
   */
  picked: DestinationCandidate | null;
  onPicked: (place: DestinationCandidate | null) => void;
  /**
   * Reports whether a Start attempt is live. The lifted search box must
   * refuse edits while one runs — the tap-time freeze is the guarantee,
   * the disable is the honest signal — and the attempt's 'locating'
   * phase is invisible from outside (lifecycle state is still 'idle'),
   * so this component says so itself. Optional: static test renders
   * that never start a trip simply omit it.
   */
  onAttemptActive?: (active: boolean) => void;
  /**
   * The truck the driver confirmed, and whether it may be routed yet.
   * OWNED BY THE DRIVING SCREEN (truck-route confidence milestone): the
   * editor that changes it and the Start tap that sends it are different
   * surfaces, and two copies could disagree about which truck was routed.
   */
  truckProfile: EditableProfile;
  /** 'invalid' | 'unconfirmed' | 'ready' — from the pure profile gate. */
  truckGate: 'invalid' | 'unconfirmed' | 'ready';
  /** The parked profile editor, rendered by the owner. */
  /** The truck section: the editor, or the saved summary with Edit truck. */
  truckSlot: ReactNode;
  /** The driver-name field, now FIRST in the setup order. */
  driverSlot?: ReactNode;
  /** The four-line "before you start" checklist. */
  setupStatusSlot?: ReactNode;
  /** Current clocks. Wired in the clock milestone; null renders nothing. */
  clocksPanel?: ReactNode;
  /**
   * The exact missing setup item, or null when Start is available. It
   * both disables the button and prints beneath it — one value, so the
   * control and its explanation cannot disagree.
   */
  startBlockedReason?: string | null;
  /** Region + units + Canadian pilot status, rendered by the owner. */
  regionPanel?: ReactNode;
  /** Show the driver's numbers in metric. */
  metric?: boolean;
  /** Origin and destination look like different countries. */
  crossBorder?: boolean;
  /** Canada mode: the HOS calculation is not available in this pilot. */
  hosUnavailable?: boolean;
  onChanged: () => void;
}) {
  const [reportNote, setReportNote] = useState('');
  const [reportCategory, setReportCategory] = useState<string>('');
  const [reportText, setReportText] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<string | null>(null);
  const [destLat, setDestLat] = useState('');
  const [destLng, setDestLng] = useState('');
  const [facility, setFacility] = useState<DestinationFacility>('warehouse');
  const [note, setNote] = useState<string | null>(null);

  /*
   * The one-tap Start attempt. `phase` is what the driver sees (the
   * honest progress line); the ref-held attempt guard is what makes the
   * duplicate tap structurally inert — React state is asynchronous, so a
   * second tap in the same frame must be refused by something
   * synchronous. One begin() per attempt, one claimPlan() per begin().
   */
  const [phase, setPhase] = useState<'idle' | 'locating' | 'planning' | 'starting'>('idle');
  const attemptRef = useRef(createStartAttempt());
  /*
   * The destination is FROZEN at tap time. The search stays disabled
   * while an attempt runs, but freezing is the guarantee the disable
   * only suggests: whatever happens to component state mid-attempt, the
   * route that gets planned is the one the driver was looking at when
   * they tapped Start.
   */
  const startDestRef = useRef<{
    position: { lat: number; lng: number };
    facility: DestinationFacility;
  } | null>(null);

  const state = lifecycle.state();
  const summary = lifecycle.summary();
  const { position, watching, acquiring } = gps;

  /** The chosen destination: a searched place wins; the developer
   *  coordinate box is the fallback. Null = nothing valid chosen. */
  function resolveDestination(): {
    position: { lat: number; lng: number };
    facility: DestinationFacility;
  } | null {
    const usingSearch = picked !== null;
    const dLat = usingSearch ? picked.position.lat : Number(destLat);
    const dLng = usingSearch ? picked.position.lng : Number(destLng);
    if (
      !Number.isFinite(dLat) ||
      !Number.isFinite(dLng) ||
      Math.abs(dLat) > 90 ||
      Math.abs(dLng) > 180
    ) {
      return null;
    }
    return {
      position: { lat: dLat, lng: dLng },
      facility: usingSearch ? picked.facility : facility,
    };
  }

  /** End the attempt on a failure the driver must read. Parked, honest
   *  line shown, Start available again — the safe retry. */
  function failAttempt(message: string) {
    attemptRef.current.end();
    startDestRef.current = null;
    setPhase('idle');
    setNote(message);
    onChanged();
  }

  /**
   * THE Start tap. Everything that must happen inside a real user
   * gesture happens here, synchronously: claiming the single attempt
   * slot and starting (or re-arming) the one GPS watch, which is what
   * makes the browser's permission prompt attributable to this tap.
   */
  function startTrip() {
    if (!attemptRef.current.begin()) return; // duplicate tap: inert
    /*
     * The truck gate, BEFORE anything is spent. An unconfirmed or invalid
     * profile produces zero provider requests and zero GPS watches — the
     * driver is told what to do instead, and the attempt ends here.
     */
    if (truckGate !== 'ready') {
      attemptRef.current.end();
      setNote(
        truckGate === 'invalid'
          ? 'Fix the truck details above before planning a route.'
          : 'Confirm your truck above before planning a route.',
      );
      return;
    }
    const dest = resolveDestination();
    if (dest === null) {
      attemptRef.current.end();
      setNote(NO_DESTINATION_TEXT);
      return;
    }
    startDestRef.current = dest;
    setNote(null);
    setPhase('locating');
    if (!watching) {
      // Just-in-time permission: the prompt (if the browser needs one)
      // is caused by this tap. Already granted = the watch simply starts.
      gps.start();
    } else if (assessStartFix(position, acquiring, watching) === 'unusable') {
      // A watch is up but its last answer was "no usable fix". Restart
      // it inside the same gesture so the platform's own 15 s bound
      // gets a fresh run — still exactly one live watch.
      gps.stop();
      gps.start();
    }
    // A usable fix (or the wait for one) is handled by the locating
    // effect below — it fires on this same render commit.
  }

  /** Cancel a live attempt. The watch stays up on purpose: permission
   *  was granted for navigation, the fix keeps the motion lock honest,
   *  and the next Start is instant. Stop (on the driving surface) is
   *  the control that discards position. */
  function cancelStart() {
    attemptRef.current.end();
    startDestRef.current = null;
    setPhase('idle');
    setNote(null);
    if (lifecycle.state() === 'planning') lifecycle.cancel(Date.now());
    onChanged();
  }

  /*
   * LOCATING: wait for the GPS session to publish a usable origin, on
   * the session's own cadence (this component re-renders on every gated
   * position update). No timer of ours exists to clean up — 'wait' can
   * only persist while the platform still owes an answer, because the
   * browser's watch bound (15 s) converts silence into an error, the
   * session turns that into health, and health ends the attempt below.
   */
  const assessment = assessStartFix(position, acquiring, watching);
  useEffect(() => {
    if (phase !== 'locating') return;
    if (assessment === 'wait') return;
    if (assessment === 'denied') {
      failAttempt(LOCATION_DENIED_TEXT);
      return;
    }
    if (assessment === 'unusable') {
      failAttempt(LOCATION_UNAVAILABLE_TEXT);
      return;
    }
    // 'plan': claim the attempt's single plan ticket. A re-render racing
    // this effect finds the ticket gone and does nothing.
    if (!attemptRef.current.claimPlan()) return;
    const origin = position.fix;
    const dest = startDestRef.current;
    if (origin === null || dest === null) {
      // Unreachable by construction ('plan' implies a fix; begin() set
      // the destination) — but a refused attempt beats a thrown render.
      failAttempt(LOCATION_UNAVAILABLE_TEXT);
      return;
    }
    setPhase('planning');
    void planFrom(origin.lat, origin.lng, dest);
    // The effect keys on the assessment/phase pair; everything else it
    // reads is ref-held attempt state that must NOT retrigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, assessment, position]);

  /** EXACTLY ONE validated plan request per attempt — the ticket above
   *  is claimed, so this body cannot run twice for one Start tap. */
  async function planFrom(
    originLat: number,
    originLng: number,
    dest: { position: { lat: number; lng: number }; facility: DestinationFacility },
  ) {
    const now = Date.now();
    const outcome = await lifecycle.plan(
      {
        origin: { lat: originLat, lng: originLng },
        destination: dest.position,
        // The confirmed truck, not a default. `toTruckProfile` merges the
        // driver's routing values onto the shipped profile so the fields
        // the request does not carry (tank, mpg) keep their shape.
        truck: toTruckProfile(truckProfile),
        ...(truckProfile.avoid.length > 0 ? { avoid: truckProfile.avoid as RouteAvoidance[] } : {}),
        departAtMs: now,
      },
      // A searched place still carries no VERIFIED truck entrance — the
      // provider's pin is the front door, not the gate — so provenance
      // stays 'unknown' and the arrival engine keeps completing such trips
      // as destination-unverified. Only the facility class improves.
      {
        position: dest.position,
        facility: dest.facility,
        positionSource: 'unknown',
      },
      now,
    );
    if (!outcome.ok) {
      // The existing honest failure, verbatim: parked, reason shown,
      // retry available. 'superseded' means the driver cancelled while
      // the request flew — they already know; no message needed.
      if (outcome.reason === 'superseded') return;
      failAttempt(`Route refused: ${outcome.reason}`);
      return;
    }
    /*
     * Safely accepted — but "safely" is the operative word. A route the
     * validator passed with WARNINGS, or one the plausibility check has
     * findings about, pauses at the existing flight briefing: those
     * surfaces exist to be read before committing, and auto-starting
     * past them would delete exactly the pre-trip warnings this flow
     * promised to preserve. A clean route proceeds without a pause.
     */
    if (routeNeedsBriefing(lifecycle)) {
      attemptRef.current.end();
      startDestRef.current = null;
      setPhase('idle');
      onChanged(); // route-ready renders the briefing; its Start commits
      return;
    }
    /*
     * onChanged BEFORE the phase flip, deliberately. Under React's
     * automatic batching (the browser) the order is invisible — one
     * commit carries both. Under a legacy-mode renderer (the behavioral
     * harnesses) each update can commit alone, and this order guarantees
     * the driving screen re-renders while the machine is at route-ready
     * BEFORE the starting effect commits navigation — the render the
     * voice effect must observe for the route-start greeting. Flipped,
     * the greeting silently dies in exactly the environment built to
     * catch that.
     */
    onChanged();
    setPhase('starting'); // the effect below finishes on this commit
  }

  /*
   * STARTING: runs on the route-ready render itself. This effect (child)
   * fires before the driving screen's voice effect (parent), so by the
   * time the greeting logic looks at that render's route-ready state,
   * navigation is already underway — the greeting still speaks, the
   * driver is already being guided, and no render ever shows a briefing
   * that is about to vanish.
   */
  useEffect(() => {
    if (phase !== 'starting') return;
    if (lifecycle.state() === 'route-ready') {
      lifecycle.startNavigation(Date.now());
    }
    attemptRef.current.end();
    startDestRef.current = null;
    setPhase('idle');
    onChanged();
    // onChanged is a fresh closure each parent render; the phase guard
    // makes re-runs inert, so only the phase edge matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, lifecycle]);

  const attemptActive = phase !== 'idle';

  /*
   * Mirror the attempt's liveness upward for the lifted search box (it
   * sits on the map, in the driving screen, and must disable while an
   * attempt runs). An effect, not a render-time call: setting parent
   * state during a child render is the exact interleaving React forbids.
   */
  useEffect(() => {
    onAttemptActive?.(attemptActive);
  }, [attemptActive, onAttemptActive]);

  /*
   * A fresh pick retires any failure line. The pick now happens in a
   * different component, so the note cannot be cleared in the pick
   * handler the way it was when the search lived here — the prop edge
   * carries the same meaning: the driver answered the failure by
   * choosing again.
   */
  useEffect(() => {
    if (picked !== null) setNote(null);
  }, [picked]);

  const progressText =
    phase === 'locating'
      ? GETTING_LOCATION_TEXT
      : phase === 'planning'
        ? PLANNING_ROUTE_TEXT
        : phase === 'starting'
          ? STARTING_NAVIGATION_TEXT
          : null;

  function act(fn: () => unknown) {
    fn();
    setNote(null);
    onChanged();
  }

  return (
    <div className="space-y-4">
      <p className="text-lg font-semibold text-ink">
        Pilot trip controls <span className="font-normal text-ink/60">(preview builds only)</span>
      </p>

      {state === 'idle' ? (
        <div className="space-y-3">
          {/*
           * SETUP ORDER, top to bottom: Driver → Region and units →
           * Truck → Clocks → Destination → Start.
           *
           * It used to be Region → Destination → START → truck editor,
           * which put the commitment above the safety check it depends
           * on. A driver tapped Start, nothing visible happened, and the
           * reason printed below the truck editor they had not reached
           * yet. Start now comes last, after everything it requires.
           *
           * The destination SEARCH stays on the parked map (final pilot
           * milestone) — the driver looks at the map, so that is where
           * "where are you going?" belongs. What sits here at position 5
           * is the confirmation of what they picked, immediately above
           * the Start it commits to.
           */}
          {setupStatusSlot}
          {driverSlot}
          {regionPanel}
          {truckSlot}
          {clocksPanel}

          {picked !== null ? (
            <p className="text-xl text-ink">
              Destination: <span className="font-semibold">{picked.title}</span>
              {picked.address ? <span className="text-ink/70"> — {picked.address}</span> : null}
            </p>
          ) : (
            <p className="text-lg text-ink/70">
              Search for a destination on the map above, then tap Start.
            </p>
          )}

          {/* A cross-border route is the driver's to prepare for. The app
              returns road geometry; it knows nothing about customs
              status, admissibility, permits or booth hours, and says so
              here rather than implying coverage by silence. Parked, above
              Start — never a permanent live-map box. */}
          {crossBorder ? (
            <p
              role="status"
              className="rounded-cockpit border border-line border-l-4 border-l-nav-warn px-3 py-2 text-lg text-ink"
            >
              {CROSS_BORDER_NOTICE}
            </p>
          ) : null}

          {/* THE Start control — the whole simplified flow in one tap:
              just-in-time location permission, wait for a real fix, one
              validated truck route, then navigation.

              IT IS NOW GENUINELY DISABLED when setup is incomplete, and
              the reason sits directly beneath it in words. Previously the
              button looked usable, refused on tap, and explained itself
              two hundred pixels down the page. A disabled control the
              driver cannot act on is worse than useless if it does not
              say what to do instead — so `startBlockedReason` names the
              one missing item, and it is TEXT, not a colour. */}
          <button
            type="button"
            onClick={startTrip}
            disabled={attemptActive || startBlockedReason !== null}
            aria-busy={attemptActive}
            aria-describedby={startBlockedReason === null ? undefined : 'start-blocked-reason'}
            className="min-h-[4.5rem] w-full rounded-cockpit bg-nav-good px-4 text-2xl font-bold text-asphalt disabled:opacity-60"
          >
            {progressText ?? 'Start Route'}
          </button>
          {startBlockedReason !== null ? (
            <p id="start-blocked-reason" className="text-lg font-semibold text-ink">
              {startBlockedReason}
            </p>
          ) : null}

          {/* Developer-only coordinate entry. It is now gated on the
              EXISTING debug mechanism (Pilot Mode's `debugLogging`, which
              is off on the production host) rather than merely collapsed:
              a fleet manager watching a demonstration should not be shown
              a latitude box at all, and "collapsed" is still shown.
              Bench-testing an exact point still works wherever debug is
              on — which is every preview build. */}
          {debugLog !== null ? (
            <details className="text-base text-ink/60">
              <summary className="min-h-16 cursor-pointer text-lg text-ink/70">
                Developer: enter coordinates instead
              </summary>
              <div className="mt-2 space-y-3">
                <label className="block text-lg text-ink/80">
                  Destination latitude
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    value={destLat}
                    onChange={(e) => {
                      setDestLat(e.target.value);
                      onPicked(null);
                    }}
                    aria-label="Destination latitude"
                  />
                </label>
                <label className="block text-lg text-ink/80">
                  Destination longitude
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    value={destLng}
                    onChange={(e) => {
                      setDestLng(e.target.value);
                      onPicked(null);
                    }}
                    aria-label="Destination longitude"
                  />
                </label>
                <label className="block text-lg text-ink/80">
                  Facility type
                  <select
                    className={inputClass}
                    value={facility}
                    onChange={(e) => setFacility(e.target.value as DestinationFacility)}
                    aria-label="Destination facility type"
                  >
                    {FACILITIES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
          ) : null}

          {/* The truck itself: verified, adjustable, and confirmed once
              before any route is requested. It replaces the read-only
              panel — a driver who cannot change the numbers cannot
              honestly confirm them. The panel's disclosure survives
              inside the editor's "Not used for routing" section. */}
        </div>
      ) : null}

      {/* Honest progress + the way out, whatever lifecycle state the
          attempt is passing through. role=status so a screen reader
          hears the same phases the sighted driver watches. */}
      {attemptActive ? (
        <div className="space-y-3">
          {state !== 'idle' ? <p className="text-xl text-ink/80">{progressText}</p> : null}
          <p role="status" className="sr-only">
            {progressText}
          </p>
          <button type="button" className={buttonClass} onClick={cancelStart}>
            Cancel
          </button>
        </div>
      ) : null}

      {/* Route-ready is the flight briefing (design blueprint Phase 3):
          destination, the provider's numbers, the truck the plan request
          actually carried, the provider's own major roads, and only the
          warnings the app genuinely has. Presentation only — Start and
          Discard call the SAME lifecycle transitions they always did,
          and the plausibility advisory renders unchanged inside it. */}
      {state === 'route-ready' ? (
        <RouteBriefing
          destination={picked}
          sentRestrictions={sentRestrictionLines(
            toTruckProfile(truckProfile),
            truckProfile.avoid,
            metric,
          )}
          totalMi={lifecycle.view().totalMi}
          etaText={formatEta(
            lifecycle.view().remainingMi,
            lifecycle.view().totalMi,
            lifecycle.routeBrief()?.durationSeconds ?? null,
            Date.now(),
            new Date().getTimezoneOffset(),
          )}
          brief={lifecycle.routeBrief()}
          metric={metric}
          plausibilitySlot={<RouteCheck lifecycle={lifecycle} metric={metric} />}
          onStart={() => act(() => lifecycle.startNavigation(Date.now()))}
          onDiscard={() => act(() => lifecycle.discardRoute(Date.now()))}
        />
      ) : null}

      {state === 'navigating' ||
      state === 'off-route' ||
      state === 'rerouting' ||
      state === 'final-approach' ? (
        <div className="space-y-3">
          <p className="text-xl text-ink">Trip active — {state.replace(/-/g, ' ')}.</p>
          <button
            type="button"
            className={buttonClass}
            onClick={() => act(() => lifecycle.cancel(Date.now()))}
          >
            Cancel trip
          </button>
        </div>
      ) : null}

      {state === 'arrived' ? (
        <div className="space-y-3">
          <p className="text-xl text-ink">
            Trip ended: {summary?.endReason ?? 'arrived'} ({summary?.entranceKind ?? 'unknown'}),{' '}
            {formatDistance(summary?.plannedMiles ?? null, metric)} planned.
          </p>
          <button
            type="button"
            className={buttonClass}
            onClick={() => act(() => lifecycle.complete(Date.now()))}
          >
            Complete trip
          </button>
          <PostTripFeedback />
        </div>
      ) : null}

      {state === 'completed' ? (
        <div className="space-y-3">
          <p className="text-xl text-ink">
            Trip completed{summary ? ` (${summary.endReason})` : ''}. Engines released.
          </p>
          <button
            type="button"
            className={buttonClass}
            onClick={() => act(() => lifecycle.reset(Date.now()))}
          >
            New trip
          </button>
          <PostTripFeedback />
        </div>
      ) : null}

      {note ? (
        <p role="status" className="text-lg text-ink/80">
          {note}
        </p>
      ) : null}

      {/* ---- optional, below the primary flow on purpose ---------------
          The pilot driver's complaint was startup STEPS. Destination and
          Start are the flow; everything from here down is optional and
          never blocks navigation: the name only feeds the spoken
          greeting (blank name = no personalized line, never a fabricated
          one), and the pilot briefing remains one tap away. */}
      {/* THE DRIVER NAME IS NOT HERE ANY MORE. It used to render at the
          bottom of the page, below everything, on the reasoning that it
          was optional and should not compete with the flow. The pre-trip
          setup milestone put it at POSITION 1 instead — a driver reads a
          setup screen top to bottom, and "who is driving" is the first
          question, not an afterthought below the debug log. It is still
          optional and still never blocks a route; it is passed in as
          `driverSlot`, and rendering it twice would give one value two
          controls. */}

      {/* The build a driver is running, in one line they can read aloud on
          the phone or quote in a message. Every generated report carries
          the same identifier, so a screenshot and a report always agree. */}
      {build ? (
        <p className="text-base text-ink/60">
          Build: <span className="font-mono text-ink/80">{build.label}</span>
        </p>
      ) : null}

      <PilotOnboarding />

      {/*
        Road-test report. It lives inside this component, which the
        driving screen already renders inside the stationary-only
        'edit-destination' gate — so it inherits that rail rather than
        inventing a second one. Writing a note at speed is exactly what
        doc 06 locks.

        The report is always SHOWN as well as copied: the clipboard API
        is unavailable on insecure origins and refused by some mobile
        browsers outside a trusted gesture, and a button that silently
        does nothing is worse than no button. Showing it also means the
        driver can read what they are about to send before they send it.
      */}
      {buildReport ? (
        <details className="text-base text-ink/70">
          <summary className="min-h-16 cursor-pointer text-lg text-ink/80">
            Report a navigation problem
          </summary>

          {/* The category is a tap and the note is optional, in that order.
              A triager reads the category first, and a driver at the end of
              a shift will pick from a list long after they have stopped
              being willing to type. */}
          <fieldset className="mt-2">
            <legend className="text-lg text-ink/80">What kind of problem was it?</legend>
            <div className="mt-1 space-y-1">
              {PROBLEM_CATEGORIES.map((c) => (
                <label key={c.id} className="flex min-h-16 items-center gap-3 text-lg text-ink">
                  <input
                    type="radio"
                    name="problem-category"
                    value={c.id}
                    checked={reportCategory === c.id}
                    onChange={() => {
                      setReportCategory(c.id);
                      setCopyState(null);
                    }}
                    className="size-6 shrink-0"
                  />
                  <span>
                    {c.label}
                    <span className="block text-base text-ink/60">{c.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="mt-3 block text-lg text-ink/80" htmlFor="road-test-note">
            Anything to add? (optional, {MAX_NOTE_CHARS} characters)
          </label>
          <textarea
            id="road-test-note"
            value={reportNote}
            onChange={(e) => setReportNote(e.target.value)}
            maxLength={MAX_NOTE_CHARS}
            rows={3}
            className="mt-1 w-full rounded-card border border-line bg-transparent p-3 text-lg text-ink"
          />
          <button
            type="button"
            className={`${buttonClass} mt-2`}
            onClick={() => {
              const built = buildProblemReport({
                categoryId: reportCategory,
                note: reportNote,
              });
              if (!built.ok) {
                setCopyState(built.reason);
                return;
              }
              const text = buildReport({ note: '', problem: built.report });
              setReportText(text);
              const clip =
                typeof navigator !== 'undefined' && navigator.clipboard
                  ? navigator.clipboard
                  : null;
              if (clip === null) {
                setCopyState('Clipboard unavailable — select the text below and copy it.');
                return;
              }
              clip.writeText(text).then(
                () => setCopyState('Copied.'),
                () => setCopyState('Copy refused — select the text below and copy it.'),
              );
            }}
          >
            Copy problem report
          </button>
          {copyState ? (
            <p role="status" className="mt-2 text-lg text-ink/80">
              {copyState}
            </p>
          ) : null}
          {reportText ? (
            <textarea
              readOnly
              aria-label="Problem report"
              value={reportText}
              rows={12}
              className="mt-2 w-full rounded-card border border-line bg-transparent p-3 font-mono text-sm text-ink"
            />
          ) : null}
        </details>
      ) : null}

      {debugLog ? (
        <details className="text-base text-ink/60">
          <summary className="min-h-16 cursor-pointer text-lg text-ink/80">
            Pilot debug log ({debugLog.entries().length}
            {debugLog.dropped() > 0 ? `, ${debugLog.dropped()} dropped` : ''})
          </summary>
          <ul className="mt-2 space-y-1 font-mono text-sm">
            {debugLog
              .entries()
              .slice(-30)
              .map((e, i) => (
                <li key={`${e.tMs}-${i}`}>
                  {new Date(e.tMs).toISOString().slice(11, 19)} {e.event}
                  {e.detail ? ` — ${e.detail}` : ''}
                </li>
              ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/**
 * Does the just-planned route need the driver to READ something before
 * navigation starts? Two sources, both already on the briefing surface:
 * validator warnings ('valid-with-warning' routes) and plausibility
 * findings — computed from EXACTLY the inputs RouteCheck renders from,
 * so the pause decision and the briefing's content can never disagree.
 * A clean route returns false and the one-tap flow proceeds straight to
 * navigation; anything worth reading pauses at the existing briefing,
 * whose own Start button commits.
 *
 * 'repeated-segment' deliberately does NOT gate the auto-start. Its
 * metric counts geometry points per ~0.05-mile grid cell, so ordinary
 * densely-sampled provider geometry — a dead-straight road drawn at
 * 0.01-mile steps — measures as "revisits" (verified against the
 * synthetic bench courses, which are straight lines and still measure
 * 3–5). Gating on it would pause essentially every real route, which is
 * the old flow back under a new name. The plausibility RULES are
 * untouched: the advisory still renders on the briefing whenever the
 * briefing shows, exactly as before — this is only a consumer choosing
 * which findings force that surface in front of a driver who did not
 * ask for it. The four that do are the ones that measure real route
 * shape against the trip (degenerate-geometry, extreme-detour,
 * doubles-back, destination-mismatch).
 */
function routeNeedsBriefing(lifecycle: NavigationLifecycle): boolean {
  const brief = lifecycle.routeBrief();
  if (brief === null) return false;
  if (brief.warnings.length > 0) return true;
  const data = lifecycle.mapData();
  if (data.destination === null || data.geometry.length === 0) return false;
  return assessRoutePlausibility({
    geometry: data.geometry,
    destination: data.destination,
    reportedMiles: lifecycle.view().totalMi ?? null,
  }).some((f) => f.code !== 'repeated-segment');
}

/**
 * Route plausibility, shown only at route-ready — before the driver
 * commits, which is the one moment looking at it costs nothing.
 *
 * Advisory by construction. It never blocks Start navigation, because a
 * truck route is SUPPOSED to be longer than the straight line: it goes
 * around the low bridge. Blocking on length would systematically refuse
 * the correct routes.
 */
function RouteCheck({ lifecycle, metric }: { lifecycle: NavigationLifecycle; metric: boolean }) {
  const data = lifecycle.mapData();
  if (data.destination === null || data.geometry.length === 0) return null;
  const findings = assessRoutePlausibility({
    geometry: data.geometry,
    destination: data.destination,
    reportedMiles: lifecycle.view().totalMi ?? null,
    // The advisory reads in the driver's units. The MEASUREMENT is
    // unchanged — only the sentence is.
    metric,
  });
  if (findings.length === 0) return null;
  return (
    <div role="status" className="rounded-card border border-line p-4">
      <p className="text-lg font-semibold text-ink">Worth a look before you start</p>
      <ul className="mt-2 space-y-1">
        {findings.map((f) => (
          <li key={f.code} className="text-lg text-ink/80">
            {f.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
