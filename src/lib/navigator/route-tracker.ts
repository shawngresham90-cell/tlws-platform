/**
 * RouteTracker (Navigator milestone N3): project gated fixes onto a route
 * and keep the route-mile MONOTONIC. Pure — wraps the existing
 * `projectOntoRoute` from the Trip Planner's directory layer and adds
 * statefulness for exactly one reason (docs/navigator 05 §2): candidates
 * behind the current mile are back-projections until proven to be a
 * genuine reversal.
 *
 * Two structural facts drive the design (both proven in adversarial audit
 * of the first draft):
 *
 * 1. `projectOntoRoute` snaps to the nearest SAMPLED point, and the
 *    planner's own `toRoutePoints` samples at up to `total/400 ≥ 2` miles.
 *    At that spacing every threshold below is meaningless, so the tracker
 *    DENSIFIES its route to ≤ 0.1-mile spacing at construction (bounded by
 *    a hard point cap) instead of trusting the caller's sampling.
 *
 * 2. Candidate CONSISTENCY is not motion evidence. A truck parked over a
 *    crossing segment, or driving forward past an adjacent anti-parallel
 *    leg, produces perfectly consistent backward candidates forever.
 *    Confirmation of a reversal therefore requires all three of:
 *      - at least REVERSAL_CONFIRM_FIXES consecutive backward candidates,
 *      - positive motion evidence (fix speed when known, raw displacement
 *        from the hold anchor otherwise), and
 *      - net BACKWARD PROGRESSION of the candidates across the held window
 *        (≥ REVERSAL_PROGRESS_MI) — identical repeats prove nothing.
 *
 * Known limitation (documented, deliberate): anti-parallel adjacent
 * corridors longer than about a mile (some divided highways) remain
 * ambiguous to position-only nearest-point tracking — the N5 engine's
 * heading-aware matching is the real resolution. Until then the monotonic
 * hold guarantees the mile never runs backwards on ambiguity alone.
 */

import type { RoutePoint } from '@/lib/trip-planner/directory-layer';
import { projectOntoRoute } from '@/lib/trip-planner/directory-layer';
import type { TrackerState } from './types';
import { haversineMiles, type GeoPoint } from './geo';

/** Backward moves smaller than this are projection noise, absorbed silently. */
export const BACKWARD_TOLERANCE_MI = 0.15;
/** Minimum consecutive backward fixes before a reversal can confirm. */
export const REVERSAL_CONFIRM_FIXES = 3;
/** A backward candidate jumping more than this from the previous one is projection flicker. */
export const REVERSAL_CONSISTENCY_MI = 0.35;
/** Net backward candidate progression required across the held window. */
export const REVERSAL_PROGRESS_MI = 0.15;
/** Reversal motion evidence: fix speed above this (mph), when speed is known. */
export const REVERSAL_MIN_SPEED_MPH = 2;
/** Reversal motion evidence fallback: raw displacement from the hold anchor (miles). */
export const REVERSAL_MIN_DISPLACEMENT_MI = 0.02;
/** Fixes farther than this from every sampled route point are unprojectable. */
export const MAX_PROJECTION_MILES = 2;
/** Internal densification target spacing (miles) and hard point cap. */
export const DENSIFY_SPACING_MI = 0.1;
export const DENSIFY_MAX_POINTS = 20_000;

/** A gated position sample; speed rides along when the session knows it. */
export type TrackerFix = GeoPoint & { speedMph?: number | null };

export type RouteTracker = {
  /** Advance with one gated position; returns the new snapshot. */
  update(fix: TrackerFix): TrackerState;
  state(): TrackerState;
};

/**
 * Linear densification between consecutive samples. Chord interpolation is
 * an approximation of the road, but relative geometry at tracking
 * thresholds only needs sampling error well under the thresholds — which
 * 0.1-mile spacing provides and the planner's ≥2-mile spacing does not.
 */
export function densifyRoutePoints(routePoints: RoutePoint[]): RoutePoint[] {
  const total = routePoints[routePoints.length - 1].routeMile;
  const spacing = Math.max(DENSIFY_SPACING_MI, total / DENSIFY_MAX_POINTS);
  const out: RoutePoint[] = [];
  for (let i = 0; i < routePoints.length - 1; i++) {
    const a = routePoints[i];
    const b = routePoints[i + 1];
    out.push(a);
    const gap = b.routeMile - a.routeMile;
    if (gap <= spacing) continue;
    const steps = Math.min(Math.ceil(gap / spacing), 400);
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      out.push({
        position: {
          lat: a.position.lat + (b.position.lat - a.position.lat) * t,
          lng: a.position.lng + (b.position.lng - a.position.lng) * t,
        },
        routeMile: a.routeMile + gap * t,
      });
    }
  }
  out.push(routePoints[routePoints.length - 1]);
  return out;
}

export function createRouteTracker(routePoints: RoutePoint[]): RouteTracker {
  if (routePoints.length < 2) {
    throw new Error('RouteTracker needs at least two route points');
  }
  for (let i = 1; i < routePoints.length; i++) {
    if (routePoints[i].routeMile < routePoints[i - 1].routeMile) {
      throw new Error('RouteTracker needs non-decreasing routeMile input');
    }
  }
  const points = densifyRoutePoints(routePoints);
  const totalMi = points[points.length - 1].routeMile;

  let routeMile = 0;
  let offRouteMiles: number | null = null;
  let confidence: 'high' | 'low' = 'low';
  let heldBackwardFixes = 0;
  let lastBackwardCandidate: number | null = null;
  let anchorCandidate: number | null = null;
  let anchorPosition: GeoPoint | null = null;

  function clearHold(): void {
    heldBackwardFixes = 0;
    lastBackwardCandidate = null;
    anchorCandidate = null;
    anchorPosition = null;
  }

  function snapshot(): TrackerState {
    return {
      routeMile,
      remainingMi: Math.max(0, totalMi - routeMile),
      offRouteMiles,
      confidence,
      heldBackwardFixes,
    };
  }

  function update(fix: TrackerFix): TrackerState {
    const projected = projectOntoRoute(fix, points, MAX_PROJECTION_MILES);

    if (projected === null) {
      // Too far from every sampled point: keep the mile, admit low confidence.
      offRouteMiles = null;
      confidence = 'low';
      clearHold();
      return snapshot();
    }

    offRouteMiles = projected.offRouteMiles;
    const candidate = projected.routeMile;

    if (candidate < routeMile - BACKWARD_TOLERANCE_MI) {
      const consistent =
        lastBackwardCandidate === null ||
        Math.abs(candidate - lastBackwardCandidate) <= REVERSAL_CONSISTENCY_MI;
      if (!consistent) {
        // Projection flicker between crossing roadways: restart the window.
        heldBackwardFixes = 1;
        anchorCandidate = candidate;
        anchorPosition = { lat: fix.lat, lng: fix.lng };
      } else {
        heldBackwardFixes += 1;
        if (anchorCandidate === null || anchorPosition === null) {
          anchorCandidate = candidate;
          anchorPosition = { lat: fix.lat, lng: fix.lng };
        }
      }
      lastBackwardCandidate = candidate;

      // A reversal needs count + motion evidence + net backward progression.
      // Identical quantized candidates (parked over a crossing, forward
      // transit past an adjacent leg) fail the progression test forever.
      const moving =
        fix.speedMph !== undefined && fix.speedMph !== null
          ? fix.speedMph > REVERSAL_MIN_SPEED_MPH
          : anchorPosition !== null &&
            haversineMiles(anchorPosition, fix) >= REVERSAL_MIN_DISPLACEMENT_MI;
      const progressed =
        anchorCandidate !== null && anchorCandidate - candidate >= REVERSAL_PROGRESS_MI;

      if (heldBackwardFixes >= REVERSAL_CONFIRM_FIXES && moving && progressed) {
        routeMile = candidate;
        confidence = 'high';
        clearHold();
      } else {
        confidence = 'low';
      }
      return snapshot();
    }

    // Normal progress. Within-tolerance backward jitter never lowers the mile.
    routeMile = Math.max(routeMile, candidate);
    confidence = 'high';
    clearHold();
    return snapshot();
  }

  return { update, state: snapshot };
}
