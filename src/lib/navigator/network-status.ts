/**
 * What a driver is told about the network (Block 2, priority G).
 *
 * Being offline does not stop guidance: the route, its geometry and its
 * maneuvers were downloaded when the trip was planned and live entirely
 * in memory, and map matching, off-route detection and arrival are all
 * pure. Exactly one thing stops working — asking the provider for a
 * REPLACEMENT route. So the notice says that, and only that.
 *
 * The site-wide offline banner says something different and, mid-trip,
 * wrong: that "live parking, routes, weather and Hours of Service data
 * is unavailable". A driver reading it at 65 mph would reasonably
 * conclude the turn-by-turn they are following has stopped being
 * trustworthy. It has not.
 *
 * Pure: booleans in, a string or null out.
 */

/** The one capability an offline truck actually loses. */
export const OFFLINE_NAVIGATING =
  'Offline — guidance continues on the route you have. Rerouting is unavailable until you reconnect.';

/** Offline before a trip: the route cannot be fetched at all. */
export const OFFLINE_IDLE = 'Offline — a new route cannot be planned until you reconnect.';

/**
 * `navigator.onLine` is optimistic: `false` is reliable, `true` only
 * means a network interface exists. So a `true` reading is never turned
 * into a claim — nothing is said at all — and only `false` produces a
 * notice.
 */
export function offlineNotice(input: {
  online: boolean | null;
  /** Guidance is live (the map-first surface is up). */
  navigating: boolean;
}): string | null {
  if (input.online !== false) return null;
  return input.navigating ? OFFLINE_NAVIGATING : OFFLINE_IDLE;
}
