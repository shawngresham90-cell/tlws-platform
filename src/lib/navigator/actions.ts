/**
 * UIAction registry (Navigator milestone N4) — the single map LockGate
 * consults, per docs/navigator/06-safety.md §1. DEFAULT-DENY: any action
 * missing from ACTION_PERMISSIONS is treated as locked while moving, and a
 * harness asserts every UIAction has an explicit mapping so a new
 * affordance can never be silently permitted at speed. Per-component
 * `if (moving)` checks are prohibited — this map is the only authority.
 *
 * Values come straight from the doc's capability matrix. Actions whose
 * surfaces ship in later milestones are mapped now so the matrix is
 * complete on day one.
 */

export type UIAction =
  | 'stop-navigation' // the always-visible exit control
  | 'start-position-preview' // explicit user start of the GPS watch
  | 'view-status' // map, maneuver card, status strip class
  | 'open-emergency' // never locked (surface ships with N9 data)
  | 'mute-voice' // one-touch mute/unmute, always available (N7)
  | 'edit-destination'
  | 'edit-truck-profile'
  | 'add-stop'
  | 'submit-driver-report'
  | 'enter-text'
  | 'browse-directory'
  | 'open-deep-settings'
  | 'view-trip-summary'
  // --- driving-map affordances (map-first milestone) ------------------
  /** Free pan/zoom browsing of the map away from the truck. */
  | 'browse-map'
  /** Whole-route overview: takes the camera off the truck. */
  | 'route-overview'
  /** Switching basemap style (standard/satellite). */
  | 'change-map-style';

/** True = allowed while MOVING (or UNKNOWN). False = stationary only. */
export const ACTION_PERMISSIONS: Record<UIAction, boolean> = {
  'stop-navigation': true,
  'start-position-preview': true,
  'view-status': true,
  'open-emergency': true,
  'mute-voice': true,
  'edit-destination': false,
  'edit-truck-profile': false,
  'add-stop': false,
  'submit-driver-report': false,
  'enter-text': false,
  'browse-directory': false,
  'open-deep-settings': false,
  'view-trip-summary': false,
  // Map browsing is exactly the kind of attention sink doc 06 locks: the
  // camera follows the truck while moving, and Recenter (part of
  // 'view-status') stays one touch away. Overview and style switching are
  // deliberate, two-handed decisions — stationary only.
  'browse-map': false,
  'route-overview': false,
  'change-map-style': false,
};

/** Default-deny lookup: unknown or unmapped actions are locked. */
export function allowedWhileMoving(action: string): boolean {
  return ACTION_PERMISSIONS[action as UIAction] === true;
}
