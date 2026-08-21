/**
 * UIAction registry (Navigator milestone N4) — the single map LockGate
 * consults, per docs/navigator/06-safety.md §1. DEFAULT-DENY: any action
 * missing from ACTION_PERMISSIONS is treated as locked while moving, and a
 * harness asserts every UIAction has an explicit mapping so a new
 * affordance can never be silently permitted at speed. Per-component
 * `if (moving)` checks are prohibited — this map is the only authority.
 *
 * WHAT NAV-ENTRY-1 CHANGED, and why the map still exists.
 *
 * Every EDITING action below is now `true`. The owner's decision: a driver
 * may change their own destination, truck, clocks, preferences and settings
 * whenever they like, with a reminder to do it parked and nothing disabled if
 * they do not. What the old `false` bought was not safety — a determined
 * driver simply used the press-and-hold passenger override, and a PARKED
 * driver whose GPS died under a canopy was locked out of their own setup and
 * asked to declare they were a passenger. It cost the honest driver and not
 * the other one.
 *
 * What stays `false` is the CAMERA: dragging the map off the truck, the
 * whole-route overview, the basemap switch. Those are not edits. They point
 * the driver's attention at somewhere they are not, and no amount of
 * "the driver is an adult" makes a moving truck a good place to be reading a
 * map of thirty miles ahead. Camera discipline is unchanged, and follow mode
 * is unchanged with it.
 *
 * So the map is smaller in effect but not gone, and DEFAULT-DENY still holds:
 * a new affordance nobody has classified is still locked at speed.
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
  // --- editing: the driver's own trip, their own truck, their own clocks.
  // Available at every motion state (NAV-ENTRY-1, owner decision). The
  // reminder that says "only make changes when safely parked" is a sentence,
  // not a gate, and it is the whole of the mechanism now.
  'edit-destination': true,
  'edit-truck-profile': true,
  'add-stop': true,
  'submit-driver-report': true,
  'enter-text': true,
  'browse-directory': true,
  'open-deep-settings': true,
  'view-trip-summary': true,
  // --- the camera. Zoom and pan were one permission ('browse-map',
  // stationary-only) until the owner's road test split them. Zooming out for
  // road context keeps the camera on the truck, so it rides along with
  // driving; dragging the camera somewhere else does not, and stays locked.
  // Recenter (part of 'view-status') remains one touch away either way.
  // Overview and style switching are deliberate, two-handed decisions —
  // stationary only. These three are what `locked` now governs, in full.
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
 * THE SETUP-WINDOW EXEMPTION IS GONE, and its absence is the point.
 *
 * It existed to unlock exactly one action — the trip-setup surface — during a
 * cold start, because the plain matrix locked destination entry before any
 * GPS existed and a parked driver could not type where they were going. That
 * whole problem disappeared when editing stopped being motion-gated: the
 * exemption's only grant is now the ordinary rule. Keeping an empty second
 * permission map beside the real one would be a place for a future exemption
 * to hide, so it is deleted rather than emptied.
 */
