/**
 * Pure geometry helpers for the navigation map (pilot round 1). The map
 * component owns Leaflet and the DOM; every decision it makes — where the
 * next-maneuver marker sits, how close to zoom, whether the view has
 * drifted enough to recenter — is computed here so it can be tested
 * offline without a browser.
 *
 * Pure: values in, values out. No I/O, no clock, no DOM.
 */

import type { LatLng } from '@/lib/map/bounds';
import type { GeometryPoint } from './route-geometry';

/**
 * Interpolate the position at a cumulative route mile. Returns null for an
 * empty route; clamps to the endpoints outside the route's own range, so a
 * maneuver mile can never produce a marker off in the ocean.
 */
export function positionAtRouteMile(
  geometry: readonly GeometryPoint[],
  mile: number,
): LatLng | null {
  if (geometry.length === 0) return null;
  if (!Number.isFinite(mile)) return null;
  if (mile <= geometry[0].routeMile) return { ...geometry[0].position };
  const last = geometry[geometry.length - 1];
  if (mile >= last.routeMile) return { ...last.position };
  // Binary search, not a scan: route miles are non-decreasing by
  // construction (normalizeGeometry guarantees it), the driving screen
  // calls this on every accepted fix, and at full provider resolution a
  // long haul carries tens of thousands of points. Find the first index
  // whose mile is at or past the target; the endpoint cases above mean
  // it always exists and is never zero.
  let lo = 1;
  let hi = geometry.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (geometry[mid].routeMile < mile) lo = mid + 1;
    else hi = mid;
  }
  const b = geometry[lo];
  const a = geometry[lo - 1];
  const span = b.routeMile - a.routeMile;
  const t = span <= 0 ? 0 : (mile - a.routeMile) / span;
  return {
    lat: a.position.lat + (b.position.lat - a.position.lat) * t,
    lng: a.position.lng + (b.position.lng - a.position.lng) * t,
  };
}

/**
 * Navigation zoom by speed: parked in a yard you need the lot, at highway
 * speed you need the next mile. Deliberately coarse — a zoom that changes
 * on every fix is unreadable from the driver's seat.
 */
export function navigationZoom(speedMph: number | null): number {
  if (speedMph === null || !Number.isFinite(speedMph) || speedMph < 5) return 17;
  if (speedMph < 25) return 16;
  if (speedMph < 50) return 15;
  return 14;
}

/**
 * Recenter only when the truck has actually moved — otherwise GPS jitter
 * drags the map around while parked. Threshold in meters.
 */
export function shouldRecenter(
  current: LatLng,
  lastCentered: LatLng | null,
  thresholdM = 12,
): boolean {
  if (lastCentered === null) return true;
  const mPerDegLat = 111_320;
  const mPerDegLng = mPerDegLat * Math.cos((current.lat * Math.PI) / 180);
  const dLat = (current.lat - lastCentered.lat) * mPerDegLat;
  const dLng = (current.lng - lastCentered.lng) * mPerDegLng;
  return Math.sqrt(dLat * dLat + dLng * dLng) >= thresholdM;
}
