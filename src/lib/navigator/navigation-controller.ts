/**
 * NavigationController (Navigator milestone N5, visual only) — composes
 * the gated position, the RouteTracker, and the ManeuverEngine into ONE
 * driving-screen state. Pure: inputs arrive as arguments; the component
 * layer owns timers and the GPS watch. No voice, no rerouting, no
 * provider calls (all later milestones).
 *
 * Screen states are exhaustive and honest: a real failure never renders
 * as progress, an estimate is never presented as a measurement, and with
 * no route loaded the screen says so instead of pretending (AD-8:
 * guidance never starts without a real route).
 */

import type { PositionState } from './types';
import type { RouteTracker } from './route-tracker';
import type { ManeuverEngine, ManeuverView } from './maneuver-engine';

export type DrivingScreenStatus =
  | 'no-route' // nothing loaded — guidance cannot start (AD-8)
  | 'acquiring' // route ready, waiting on the first fix
  | 'navigating'
  | 'position-degraded' // accuracy-gated fixes; guidance continues
  | 'position-lost' // >10 s without an accepted fix; last known shown
  | 'position-unavailable' // platform says it cannot provide position
  | 'denied' // permission denied — navigation cannot run
  | 'arrived';

export const ARRIVAL_TOLERANCE_MI = 0.05;

export type DrivingView = {
  status: DrivingScreenStatus;
  /** Route progress (miles along / total), when a route is loaded. */
  routeMile: number | null;
  totalMi: number | null;
  remainingMi: number | null;
  maneuvers: ManeuverView | null;
  /** True when the shown position is held, not current. */
  lastKnown: boolean;
  speedMph: number | null;
};

export type NavigationController = {
  /** Feed the latest gated position; advances the tracker when possible. */
  update(position: PositionState): DrivingView;
  view(): DrivingView;
};

export function createNavigationController(
  route: { tracker: RouteTracker; engine: ManeuverEngine; totalMi: number } | null,
): NavigationController {
  let last: DrivingView = emptyView(route);
  // Idempotency on the same input REFERENCE: React can evaluate a render
  // twice (StrictMode) with the identical PositionState object; without
  // this guard the tracker would ingest the same fix twice and its
  // reversal-hold counter would double-count.
  let lastInput: PositionState | null = null;

  function emptyView(
    r: { tracker: RouteTracker; engine: ManeuverEngine; totalMi: number } | null,
  ): DrivingView {
    return {
      status: r === null ? 'no-route' : 'acquiring',
      routeMile: r === null ? null : 0,
      totalMi: r === null ? null : r.totalMi,
      remainingMi: r === null ? null : r.totalMi,
      maneuvers: null,
      lastKnown: false,
      speedMph: null,
    };
  }

  function update(position: PositionState): DrivingView {
    if (position === lastInput) return last;
    lastInput = position;
    if (route === null) {
      last = { ...emptyView(null), speedMph: position.speedMph };
      return last;
    }

    // Health decides the status class; the tracker only advances on a
    // usable fix so a lost/denied period can never move the route mile.
    let status: DrivingScreenStatus;
    let lastKnown = false;
    if (position.health === 'denied') {
      status = 'denied';
      lastKnown = position.fix !== null;
    } else if (position.health === 'unavailable') {
      status = position.fix === null ? 'position-unavailable' : 'position-lost';
      lastKnown = position.fix !== null;
    } else if (position.health === 'lost') {
      status = 'position-lost';
      lastKnown = true;
    } else if (position.fix === null) {
      status = 'acquiring';
    } else {
      status = position.health === 'degraded' ? 'position-degraded' : 'navigating';
    }

    let tracked = last.routeMile ?? 0;
    if (position.fix !== null && (position.health === 'good' || position.health === 'degraded')) {
      const snap = route.tracker.update({
        lat: position.fix.lat,
        lng: position.fix.lng,
        speedMph: position.speedMph,
      });
      tracked = snap.routeMile;
    }
    const remaining = Math.max(0, route.totalMi - tracked);
    if (
      remaining <= ARRIVAL_TOLERANCE_MI &&
      (status === 'navigating' || status === 'position-degraded')
    ) {
      status = 'arrived';
    }

    last = {
      status,
      routeMile: tracked,
      totalMi: route.totalMi,
      remainingMi: remaining,
      maneuvers: route.engine.view(tracked),
      lastKnown,
      speedMph: position.speedMph,
    };
    return last;
  }

  return { update, view: () => last };
}
