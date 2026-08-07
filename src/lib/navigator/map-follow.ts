/**
 * Follow-mode state machine for the driving map (map-first milestone).
 *
 * The rule this exists to enforce: the map must never remain SILENTLY
 * detached from the truck. A driver may pan or zoom to look ahead, but the
 * moment they do, a Recenter control appears, and if they simply stop
 * touching the screen the map returns to following on its own. Overview
 * (whole route) is the same deal — deliberate, visible, and temporary.
 *
 * Pure: state + event in, state out. No timers, no DOM, no clock — the
 * component supplies elapsed time so this is fully testable offline.
 */

export type FollowMode =
  /** Camera glued to the truck; heading-up. The normal driving state. */
  | 'following'
  /** The driver panned/zoomed away. Recenter is showing. */
  | 'detached'
  /** Whole-route view. Deliberate, and also shows Recenter. */
  | 'overview';

export type FollowState = {
  mode: FollowMode;
  /** When the map left following, for the auto-return timer. */
  detachedAtMs: number | null;
};

export type FollowEvent =
  | { kind: 'user-panned'; tMs: number }
  | { kind: 'recenter' }
  | { kind: 'overview'; tMs: number }
  | { kind: 'route-replaced' }
  | { kind: 'navigation-started' };

/**
 * How long a hands-off detached map waits before snapping back to the
 * truck. Long enough to read the road ahead at a light, short enough that
 * a driver never drives on with a stale view.
 */
export const AUTO_RECENTER_MS = 12_000;

export const INITIAL_FOLLOW_STATE: FollowState = Object.freeze({
  mode: 'following',
  detachedAtMs: null,
});

export function followReducer(state: FollowState, event: FollowEvent): FollowState {
  switch (event.kind) {
    case 'user-panned':
      // Panning out of overview keeps it detached, not overview: the
      // driver is now steering the camera by hand either way.
      return { mode: 'detached', detachedAtMs: event.tMs };
    case 'recenter':
    case 'navigation-started':
      return { mode: 'following', detachedAtMs: null };
    case 'route-replaced':
      // A replacement route is new guidance — never leave the driver
      // looking at the old view of a route that no longer exists.
      return { mode: 'following', detachedAtMs: null };
    case 'overview':
      // Toggle: a second press returns to the truck.
      return state.mode === 'overview'
        ? { mode: 'following', detachedAtMs: null }
        : { mode: 'overview', detachedAtMs: event.tMs };
    default:
      return state;
  }
}

/** Recenter is visible exactly when the camera is not on the truck. */
export function recenterVisible(state: FollowState): boolean {
  return state.mode !== 'following';
}

/** Should the camera track the truck on this position update? */
export function shouldTrackPosition(state: FollowState): boolean {
  return state.mode === 'following';
}

/**
 * Hands-off return. Only fires in the detached mode — an explicit overview is
 * the driver's decision and is left alone until they press Recenter or
 * overview again, or the route is replaced.
 */
export function shouldAutoRecenter(state: FollowState, nowMs: number): boolean {
  if (state.mode !== 'detached' || state.detachedAtMs === null) return false;
  return nowMs - state.detachedAtMs >= AUTO_RECENTER_MS;
}
