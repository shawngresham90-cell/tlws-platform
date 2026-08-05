/**
 * Final approach engine + arrival state machine (milestone N8f). Decides,
 * deliberately and never from a single GPS fix, that the trip is over —
 * and tells the truth about what "over" means: a trip whose destination
 * has no verified truck entrance completes as DESTINATION UNVERIFIED,
 * never as a confident arrival at a point nobody confirmed a truck can
 * reach.
 *
 * States:
 *   'en-route'               — normal navigation
 *   'final-approach'         — inside the configurable approach window;
 *                              consumers slow the experience down
 *   'arrival-candidate'      — arrival evidence accumulating
 *   'arrived'                — terminal; entrance verified or probable
 *   'destination-unverified' — terminal; physically stopped at the route
 *                              end, but truck access was never verified
 *
 * Arrival requires ALL of: destination agreement (within the facility
 * radius of the entrance target), route completion (committed mile at
 * the end of the route), sufficient match confidence, low speed, and
 * consecutive qualifying observations over a minimum elapsed time. A
 * GPS gap resets the evidence. Cancellation completes the session from
 * any non-terminal state. Pure: time arrives on the observations.
 */

import { haversineMiles } from './geo';
import type { LatLng } from '@/lib/map/bounds';
import type { MapMatch } from './map-matcher';
import type { RouteSession } from './route-session';
import {
  evaluateEntrance,
  FACILITY_ARRIVAL_RADIUS_M,
  type DestinationInfo,
  type EntranceEvaluation,
} from './truck-entrance';

export type ArrivalState =
  | 'en-route'
  | 'final-approach'
  | 'arrival-candidate'
  | 'arrived'
  | 'destination-unverified';

export type ArrivalEndReason = 'arrived' | 'destination-unverified' | 'cancelled';

export type ArrivalObservation = {
  match: MapMatch;
  position: LatLng;
  speedMph: number | null;
  tMs: number;
};

export type ArrivalSnapshot = {
  state: ArrivalState;
  /** Meters from the truck to the entrance target (last observation). */
  distanceToTargetM: number | null;
  qualifyingFixes: number;
  finalApproach: boolean;
  /** Advisory only — consumers slow the experience, never the truck. */
  approachAdviceMph: number | null;
  entrance: EntranceEvaluation;
  completed: boolean;
};

export type TripSummary = Readonly<{
  routeId: string;
  endReason: ArrivalEndReason;
  entranceKind: EntranceEvaluation['kind'];
  plannedMiles: number;
  finalRouteMile: number | null;
  startedMs: number | null;
  endedMs: number;
  observations: number;
}>;

export type ArrivalConfig = {
  /** Final-approach window, miles of remaining route. */
  finalApproachMi: number;
  /** Advisory speed inside the window, mph. */
  approachAdviceMph: number;
  /** Route-completion tolerance: committed mile within this of the end. */
  routeCompletionMi: number;
  /** Arrival speed ceiling, mph. */
  maxArrivalSpeedMph: number;
  /** Consecutive qualifying observations required. */
  confirmFixes: number;
  /** Minimum elapsed time across them, ms. */
  minElapsedMs: number;
  /** A gap longer than this resets arrival evidence. */
  staleResetMs: number;
  /** Moving this far from the target dissolves a candidate, meters. */
  abortDistanceM: number;
};

export const ARRIVAL_DEFAULTS: ArrivalConfig = {
  finalApproachMi: 0.5,
  approachAdviceMph: 25,
  routeCompletionMi: 0.25,
  maxArrivalSpeedMph: 5, // doc 05: speed < 5 mph sustained
  confirmFixes: 3,
  minElapsedMs: 10_000, // doc 05: sustained 10 s
  staleResetMs: 10_000,
  abortDistanceM: 300,
};

export type ArrivalController = {
  observe(obs: ArrivalObservation): ArrivalSnapshot;
  cancel(tMs: number): TripSummary;
  snapshot(): ArrivalSnapshot;
  summary(): TripSummary | null;
};

const M_PER_MILE = 1609.344;

export function createArrivalController(
  session: RouteSession,
  destination: DestinationInfo,
  config: Partial<ArrivalConfig> = {},
): ArrivalController {
  const cfg: ArrivalConfig = { ...ARRIVAL_DEFAULTS, ...config };
  const routeEnd = session.geometry[session.geometry.length - 1]?.position ?? session.destination;
  const entrance = evaluateEntrance(destination, routeEnd);
  const arrivalRadiusM = FACILITY_ARRIVAL_RADIUS_M[destination.facility] ?? 150;
  const totalMi = session.distanceMiles;

  let state: ArrivalState = 'en-route';
  let qualifying = 0;
  let episodeStartMs: number | null = null;
  let startedMs: number | null = null;
  let lastTms: number | null = null;
  let observations = 0;
  let lastDistanceM: number | null = null;
  let tripSummary: TripSummary | null = null;

  function snapshot(): ArrivalSnapshot {
    return {
      state,
      distanceToTargetM: lastDistanceM,
      qualifyingFixes: qualifying,
      finalApproach: state === 'final-approach' || state === 'arrival-candidate',
      approachAdviceMph:
        state === 'final-approach' || state === 'arrival-candidate' ? cfg.approachAdviceMph : null,
      entrance,
      completed: tripSummary !== null,
    };
  }

  function complete(
    reason: ArrivalEndReason,
    tMs: number,
    finalRouteMile: number | null,
  ): TripSummary {
    tripSummary = Object.freeze({
      routeId: session.routeId,
      endReason: reason,
      entranceKind: entrance.kind,
      plannedMiles: totalMi,
      finalRouteMile,
      startedMs,
      endedMs: tMs,
      observations,
    });
    return tripSummary;
  }

  /**
   * One arrival-qualifying observation: destination agreement, route
   * completion, sufficient confidence, low speed. The matcher's
   * `low-speed-pull-in` LOW is acceptable ONLY inside the facility
   * radius — at the destination, the pull-in IS the arrival; anywhere
   * else it stays disqualifying.
   */
  function qualifies(obs: ArrivalObservation, distanceM: number): boolean {
    const m = obs.match;
    if (obs.speedMph === null || obs.speedMph > cfg.maxArrivalSpeedMph) return false;
    if (distanceM > arrivalRadiusM) return false;
    const routeMile = m.routeMile;
    if (routeMile === null || totalMi - routeMile > cfg.routeCompletionMi) return false;
    const confident = m.confidence === 'high' || m.confidence === 'medium';
    const acceptedPullIn = m.confidence === 'low' && m.reasons.includes('low-speed-pull-in');
    return confident || acceptedPullIn;
  }

  function observe(obs: ArrivalObservation): ArrivalSnapshot {
    if (tripSummary !== null) return snapshot(); // terminal — inert, by design
    observations += 1;
    if (startedMs === null) startedMs = obs.tMs;

    // A gap near the destination resets arrival evidence — arrival is
    // never carried across missing time (tunnel, garage, loss).
    const gap = lastTms !== null && (obs.tMs - lastTms > cfg.staleResetMs || obs.tMs < lastTms);
    lastTms = obs.tMs;
    if (gap && state === 'arrival-candidate') {
      qualifying = 0;
      episodeStartMs = null;
      state = 'final-approach';
    }

    const distanceM = haversineMiles(obs.position, entrance.target) * M_PER_MILE;
    lastDistanceM = Number(distanceM.toFixed(1));

    const remainingMi =
      obs.match.routeMile === null ? null : Math.max(0, totalMi - obs.match.routeMile);

    switch (state) {
      case 'en-route': {
        if (
          remainingMi !== null &&
          remainingMi <= cfg.finalApproachMi &&
          (obs.match.confidence === 'high' || obs.match.confidence === 'medium')
        ) {
          state = 'final-approach';
        }
        break;
      }
      case 'final-approach': {
        if (qualifies(obs, distanceM)) {
          state = 'arrival-candidate';
          qualifying = 1;
          episodeStartMs = obs.tMs;
        } else if (remainingMi !== null && remainingMi > cfg.finalApproachMi * 2) {
          // Drove back out of the window (wrong turn, loop street).
          state = 'en-route';
        }
        break;
      }
      case 'arrival-candidate': {
        if (qualifies(obs, distanceM)) {
          qualifying += 1;
          const elapsed = episodeStartMs === null ? 0 : obs.tMs - episodeStartMs;
          if (qualifying >= cfg.confirmFixes && elapsed >= cfg.minElapsedMs) {
            state =
              entrance.verified || entrance.kind === 'probable-entrance'
                ? 'arrived'
                : 'destination-unverified';
            complete(
              state === 'arrived' ? 'arrived' : 'destination-unverified',
              obs.tMs,
              obs.match.routeMile,
            );
          }
        } else if (
          distanceM > cfg.abortDistanceM ||
          (obs.speedMph ?? 0) > cfg.maxArrivalSpeedMph * 4
        ) {
          // Arrival aborted: drove away or sped up. Back to the approach.
          qualifying = 0;
          episodeStartMs = null;
          state = 'final-approach';
        }
        // Ambiguous observations hold the candidate without growing it.
        break;
      }
      case 'arrived':
      case 'destination-unverified':
        break;
    }

    return snapshot();
  }

  function cancel(tMs: number): TripSummary {
    if (tripSummary !== null) return tripSummary; // idempotent after completion
    // Cancellation never pretends to be an arrival — the state keeps its
    // last honest name and the summary says 'cancelled'.
    return complete('cancelled', tMs, null);
  }

  return {
    observe,
    cancel,
    snapshot,
    summary: () => tripSummary,
  };
}
