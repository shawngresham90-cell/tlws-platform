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
  /**
   * Changing the map's zoom level — pinch, or the +/- buttons. Owner
   * decision (road test): allowed WHILE MOVING. Zooming out to see what is
   * coming is reading the road, and it does not take the camera off the
   * truck — follow mode survives it.
   */
  | 'zoom-map'
  /**
   * Dragging the camera away from the truck. Stationary only: this is the
   * attention sink doc 06 locks, because the driver ends up looking at
   * somewhere they are not.
   */
  | 'pan-map'
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
  // Zoom and pan were one permission ('browse-map', stationary-only) until
  // the owner's road test split them. Zooming out for road context keeps
  // the camera on the truck, so it rides along with driving; dragging the
  // camera somewhere else does not, and stays locked. Recenter (part of
  // 'view-status') remains one touch away either way. Overview and style
  // switching are deliberate, two-handed decisions — stationary only.
  'zoom-map': true,
  'pan-map': false,
  'route-overview': false,
  'change-map-style': false,
};

/** Default-deny lookup: unknown or unmapped actions are locked. */
export function allowedWhileMoving(action: string): boolean {
  return ACTION_PERMISSIONS[action as UIAction] === true;
}

/**
 * The SETUP WINDOW exemption (doc 06 §1a, pilot round 3 startup
 * simplification): actions additionally permitted while the safety lock's
 * cold-start window is open — motion UNKNOWN continuously since the lock
 * was created, before any watch has ever produced a MOVING or STATIONARY
 * determination.
 *
 * Why it exists: the simplified startup is destination → Start, with
 * location permission requested BY the Start tap. Before that tap there
 * is no GPS at all, so motion is UNKNOWN — and under the plain matrix the
 * destination surface would be locked, which forced the old enable-
 * location-then-wait-out-the-dwell flow the pilot driver reported as too
 * many steps. In the window the app has zero motion evidence either way;
 * the owner's decision is that trip setup is available then, exactly the
 * way any parked phone app is.
 *
 * Why it is narrow: ONE action, the trip-setup surface. The window
 * latches shut on the first motion determination and never re-opens
 * (safety-lock.ts), so a driver who has ever been seen moving gets the
 * full unknown-is-locked treatment for the rest of the session. Every
 * other action keeps the plain matrix. Default-deny is preserved: an
 * action absent from BOTH maps is locked, and the harness asserts this
 * map stays this small.
 */
export const SETUP_WINDOW_PERMISSIONS: Partial<Record<UIAction, boolean>> = {
  'edit-destination': true,
};

/** Default-deny lookup for the setup window. */
export function allowedDuringSetupWindow(action: string): boolean {
  return SETUP_WINDOW_PERMISSIONS[action as UIAction] === true;
}
