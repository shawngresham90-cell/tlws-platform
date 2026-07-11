import { US_BOUNDS, boundsContain, type LatLng } from './bounds';

/**
 * Geodesy + coordinate-validation primitives (Milestone 17). Pure functions —
 * shared by the admin geocoding tool, the near-me data layer, and the future
 * public map. No provider SDKs, no API keys.
 */

const EARTH_RADIUS_MILES = 3958.7613;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in miles between two WGS84 points (Haversine). */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type CoordinateIssue =
  | 'not-finite'
  | 'lat-out-of-range'
  | 'lng-out-of-range'
  | 'zero-zero'
  | 'outside-us';

/**
 * Validate a coordinate pair for directory use. Returns every problem found
 * (empty array = valid). 0/0 ("null island") and points outside the
 * continental-US bounding box are rejected — a US truck directory has no
 * business putting markers in the Gulf of Guinea.
 */
export function coordinateIssues(lat: number, lng: number): CoordinateIssue[] {
  const issues: CoordinateIssue[] = [];
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return ['not-finite'];
  if (lat < -90 || lat > 90) issues.push('lat-out-of-range');
  if (lng < -180 || lng > 180) issues.push('lng-out-of-range');
  if (lat === 0 && lng === 0) issues.push('zero-zero');
  if (issues.length === 0 && !boundsContain(US_BOUNDS, { lat, lng })) issues.push('outside-us');
  return issues;
}

export function isValidUsCoordinate(lat: number, lng: number): boolean {
  return coordinateIssues(lat, lng).length === 0;
}

/** Attach distance-from-origin (miles) to anything carrying coordinates. */
export function withDistance<T extends { lat?: number; lng?: number }>(
  items: T[],
  origin: LatLng,
): (T & { distanceMiles: number })[] {
  return items
    .filter((i): i is T & { lat: number; lng: number } => i.lat != null && i.lng != null)
    .map((i) => ({ ...i, distanceMiles: haversineMiles(origin, { lat: i.lat, lng: i.lng }) }));
}

/** Nearest-first sort (stable for equal distances). */
export function sortByDistance<T extends { distanceMiles: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.distanceMiles - b.distanceMiles);
}

/** Keep items within a radius (miles) of the origin. */
export function withinRadius<T extends { distanceMiles: number }>(
  items: T[],
  radiusMiles: number,
): T[] {
  return items.filter((i) => i.distanceMiles <= radiusMiles);
}
