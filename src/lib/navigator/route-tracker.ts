/**
 * RouteTracker (Navigator milestone N3): project gated fixes onto a route
 * and keep the route-mile MONOTONIC. Pure — wraps the existing
 * `projectOntoRoute` from the Trip Planner's directory layer and adds
 * statefulness for exactly one reason (docs/navigator 05 §2):
 *
 *   candidateMile < lastMile − 0.15 mi is a back-projection. Two causes:
 *     (a) self-intersecting geometry (a cloverleaf ramp passing under the
 *         mainline snaps the nearest-point projection miles backwards) —
 *         reject, hold the last mile;
 *     (b) a genuine reversal (driver backed up, U-turn) — accept, but only
 *         after 3 consecutive CONSISTENT backward fixes, where consistent
 *         means each new backward candidate sits within a plausible hop of
 *         the previous one (a vehicle moving continuously, not a projection
 *         flickering between crossing roadways).
 *
 * Without the hold, a cloverleaf under-pass re-fires maneuver announcements
 * — the failure mode every driver notices. Without the reversal escape, a
 * real U-turn strands the tracker at a stale mile forever.
 */

import type { RoutePoint } from '@/lib/trip-planner/directory-layer';
import { projectOntoRoute } from '@/lib/trip-planner/directory-layer';
import type { TrackerState } from './types';
import type { GeoPoint } from './geo';

/** Backward moves smaller than this are projection noise, absorbed silently. */
export const BACKWARD_TOLERANCE_MI = 0.15;
/** Consecutive consistent backward fixes that confirm a genuine reversal. */
export const REVERSAL_CONFIRM_FIXES = 3;
/** Two successive backward candidates farther apart than this are not one vehicle reversing. */
export const REVERSAL_CONSISTENCY_MI = 0.35;
/** Fixes farther than this from every sampled route point are unprojectable. */
export const MAX_PROJECTION_MILES = 2;

export type RouteTracker = {
  /** Advance with one gated position; returns the new snapshot. */
  update(position: GeoPoint): TrackerState;
  state(): TrackerState;
};

export function createRouteTracker(routePoints: RoutePoint[]): RouteTracker {
  if (routePoints.length < 2) {
    throw new Error('RouteTracker needs at least two route points');
  }
  const totalMi = routePoints[routePoints.length - 1].routeMile;

  let routeMile = 0;
  let offRouteMiles: number | null = null;
  let confidence: 'high' | 'low' = 'low';
  let heldBackwardFixes = 0;
  let lastBackwardCandidate: number | null = null;

  function snapshot(): TrackerState {
    return {
      routeMile,
      remainingMi: Math.max(0, totalMi - routeMile),
      offRouteMiles,
      confidence,
      heldBackwardFixes,
    };
  }

  function update(position: GeoPoint): TrackerState {
    const projected = projectOntoRoute(position, routePoints, MAX_PROJECTION_MILES);

    if (projected === null) {
      // Too far from every sampled point: keep the mile, admit low confidence.
      offRouteMiles = null;
      confidence = 'low';
      heldBackwardFixes = 0;
      lastBackwardCandidate = null;
      return snapshot();
    }

    offRouteMiles = projected.offRouteMiles;
    const candidate = projected.routeMile;

    if (candidate < routeMile - BACKWARD_TOLERANCE_MI) {
      const consistent =
        lastBackwardCandidate === null ||
        Math.abs(candidate - lastBackwardCandidate) <= REVERSAL_CONSISTENCY_MI;
      heldBackwardFixes = consistent ? heldBackwardFixes + 1 : 1;
      lastBackwardCandidate = candidate;

      if (heldBackwardFixes >= REVERSAL_CONFIRM_FIXES) {
        // Genuine reversal confirmed: adopt the backward position.
        routeMile = candidate;
        confidence = 'high';
        heldBackwardFixes = 0;
        lastBackwardCandidate = null;
      } else {
        // Back-projection (cloverleaf class) until proven otherwise: hold.
        confidence = 'low';
      }
      return snapshot();
    }

    // Normal progress. Within-tolerance backward jitter never lowers the mile.
    routeMile = Math.max(routeMile, candidate);
    confidence = 'high';
    heldBackwardFixes = 0;
    lastBackwardCandidate = null;
    return snapshot();
  }

  return { update, state: snapshot };
}
