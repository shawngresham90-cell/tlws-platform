/**
 * Navigation session composition (milestone N8f) — the one object that
 * wires the whole N8 stack together for a single trip: route session
 * (N8b) → map matcher (N8c) → off-route detector (N8d) → controlled
 * rerouting (N8e) → final approach & arrival (N8f).
 *
 * Completion discipline: the moment arrival (or cancellation) completes,
 * rerouting is refused, off-route detection stops, matching stops, the
 * IMMUTABLE trip summary is preserved, and every engine reference is
 * released — a completed session holds nothing but its frozen summary.
 * No timers exist here at all (the component layer owns cadence), so
 * "stop navigation timers" is structural: after completion there is
 * nothing left that could consume a tick.
 *
 * Pure: ports injected, time arrives on the fixes. No I/O, no clock.
 */

import type { LatLng } from '@/lib/map/bounds';
import type { RouteSession } from './route-session';
import { createMapMatcher, type MapMatcher, type MatchFix, type MapMatch } from './map-matcher';
import {
  createOffRouteDetector,
  type OffRouteDetector,
  type DetectorSnapshot,
} from './off-route-detector';
import {
  createRerouteController,
  type ReplacementPort,
  type RerouteController,
  type RerouteResult,
  type RerouteConfig,
} from './reroute-controller';
import {
  createArrivalController,
  type ArrivalController,
  type ArrivalSnapshot,
  type ArrivalConfig,
  type TripSummary,
} from './arrival-controller';
import type { DestinationInfo } from './truck-entrance';
import type { DetectorConfig } from './off-route-detector';

export type NavigationFix = MatchFix & {
  nearestPlannedStopM?: number | null;
};

export type NavigationSnapshot = {
  active: boolean;
  match: MapMatch | null;
  detector: DetectorSnapshot | null;
  arrival: ArrivalSnapshot | null;
  routeId: string;
  summary: TripSummary | null;
};

export type NavigationSession = {
  ingest(fix: NavigationFix): NavigationSnapshot;
  /**
   * Ask for a replacement route if — and only if — the detector has
   * CONFIRMED off-route, the trip is still en-route (never during final
   * approach or arrival), and the session is active.
   */
  maybeReroute(
    tMs: number,
    accuracyM: number | null,
  ): Promise<RerouteResult | { outcome: 'not-eligible' }>;
  cancel(tMs: number): TripSummary;
  snapshot(): NavigationSnapshot;
  /** Frozen after completion; null while the trip is live. */
  summary(): TripSummary | null;
  isActive(): boolean;
  /**
   * The route currently being navigated — the REPLACEMENT after a reroute,
   * not the route the session was built with. Read-only; null once the
   * trip completes and the engines are released. (Pilot round 1: the
   * navigation map must redraw on reroute.)
   */
  currentSession(): RouteSession | null;
};

export type NavigationSessionConfig = {
  detector?: Partial<DetectorConfig>;
  reroute?: Partial<RerouteConfig>;
  arrival?: Partial<ArrivalConfig>;
};

export function createNavigationSession(
  initialSession: RouteSession,
  destination: DestinationInfo,
  replacementPort: ReplacementPort,
  config: NavigationSessionConfig = {},
): NavigationSession {
  // Engine references are nulled on completion — cleanup is real, not
  // cosmetic. `active` derives from summary presence.
  let matcher: MapMatcher | null = createMapMatcher(initialSession.geometry);
  let detector: OffRouteDetector | null = createOffRouteDetector(config.detector);
  let reroute: RerouteController | null = createRerouteController(
    initialSession,
    replacementPort,
    config.reroute,
  );
  let arrival: ArrivalController | null = createArrivalController(
    initialSession,
    destination,
    config.arrival,
  );
  let routeId = initialSession.routeId;
  let lastMatch: MapMatch | null = null;
  let tripSummary: TripSummary | null = null;

  function finalize(summary: TripSummary): void {
    tripSummary = summary;
    // Release everything: dispose watchers/engines; leave no active
    // navigation state. The summary is the only survivor.
    matcher = null;
    detector = null;
    reroute = null;
    arrival = null;
    lastMatch = null;
  }

  function snapshot(): NavigationSnapshot {
    return {
      active: tripSummary === null,
      match: lastMatch,
      detector: detector?.state() ?? null,
      arrival: arrival?.snapshot() ?? null,
      routeId,
      summary: tripSummary,
    };
  }

  function ingest(fix: NavigationFix): NavigationSnapshot {
    if (tripSummary !== null || matcher === null || detector === null || arrival === null) {
      return snapshot(); // completed — structurally inert
    }
    const match = matcher.match(fix);
    lastMatch = match;

    const arrivalView = arrival.snapshot();
    // Off-route detection stops mattering once arrival evidence is being
    // gathered — a truck creeping through a yard is not "off route".
    if (arrivalView.state === 'en-route' || arrivalView.state === 'final-approach') {
      const currentSession = reroute?.currentSession();
      const remainingMi =
        match.routeMile === null || currentSession === undefined
          ? null
          : Math.max(0, currentSession.distanceMiles - match.routeMile);
      detector.observe({
        match,
        tMs: fix.tMs,
        speedMph: fix.speedMph,
        nearestPlannedStopM: fix.nearestPlannedStopM,
        remainingMi,
        // Pilot round 1: a loose fix is drift, never departure evidence.
        accuracyM: fix.accuracyM,
      });
    }

    const after = arrival.observe({
      match,
      position: fix.position,
      speedMph: fix.speedMph,
      tMs: fix.tMs,
    });
    if (after.completed) {
      const summary = arrival.summary();
      if (summary !== null) finalize(summary);
    }
    return snapshot();
  }

  async function maybeReroute(
    tMs: number,
    accuracyM: number | null,
  ): Promise<RerouteResult | { outcome: 'not-eligible' }> {
    if (tripSummary !== null || reroute === null || detector === null || arrival === null) {
      return { outcome: 'not-eligible' }; // completed sessions never spend
    }
    const arrivalState = arrival.snapshot().state;
    if (arrivalState !== 'en-route') {
      // Never replace the route during final approach or arrival.
      return { outcome: 'not-eligible' };
    }
    // A request whose promise never settles would otherwise hold the
    // controller's single-flight slot forever and silently block every
    // later reroute. Retire it once past its own timeout (pilot round 1).
    reroute.expireInFlight(tMs);
    const detectorState = detector.state().state;
    const position = lastMatch === null ? null : lastMatchPosition();
    if (position === null) return { outcome: 'not-eligible' };

    const result = await reroute.requestReroute({
      detectorState,
      currentPosition: position,
      accuracyM,
      tMs,
    });
    if (result.outcome === 'replaced') {
      // Rebuild the full engine stack on the replacement route. The trip
      // summary lineage keeps the ORIGINAL start via the arrival rebuild
      // being a fresh controller (documented limitation: per-leg summary).
      const next = result.session;
      routeId = next.routeId;
      matcher = createMapMatcher(next.geometry);
      detector = createOffRouteDetector(config.detector);
      arrival = createArrivalController(next, destination, config.arrival);
      lastMatch = null;
    }
    return result;
  }

  // The matcher does not echo the fix position; the session keeps the
  // last ingested position for reroute origins.
  let lastPosition: LatLng | null = null;
  const origIngest = ingest;
  function ingestTracked(fix: NavigationFix): NavigationSnapshot {
    lastPosition = { ...fix.position };
    return origIngest(fix);
  }
  function lastMatchPosition(): LatLng | null {
    return lastPosition;
  }

  function cancel(tMs: number): TripSummary {
    if (tripSummary !== null) return tripSummary;
    const summary = arrival!.cancel(tMs);
    finalize(summary);
    return summary;
  }

  return {
    ingest: ingestTracked,
    maybeReroute,
    cancel,
    snapshot,
    summary: () => tripSummary,
    isActive: () => tripSummary === null,
    currentSession: () => reroute?.currentSession() ?? null,
  };
}
