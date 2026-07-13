/**
 * Geographic bounds for the future directory map (Milestone: map foundation).
 * Pure constants + math — no map provider, no API keys. State and corridor
 * bounds are coarse framing rectangles (what a map zooms to first), not legal
 * boundaries; listing positions always come from per-listing lat/lng.
 */

export type LatLngBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type LatLng = { lat: number; lng: number };

/** Contiguous US framing bounds. */
export const US_BOUNDS: LatLngBounds = { north: 49.4, south: 24.4, east: -66.9, west: -125.0 };

/** Coarse framing bounds per state (extend as new states get data). */
export const STATE_BOUNDS: Record<string, LatLngBounds> = {
  GA: { north: 35.0, south: 30.36, east: -80.84, west: -85.61 },
  TN: { north: 36.68, south: 34.98, east: -81.65, west: -90.31 },
  FL: { north: 31.0, south: 24.4, east: -80.03, west: -87.63 },
  KY: { north: 39.15, south: 36.5, east: -81.96, west: -89.57 },
  OH: { north: 42.0, south: 38.4, east: -80.52, west: -84.82 },
  MI: { north: 48.3, south: 41.7, east: -82.12, west: -90.42 },
  AL: { north: 35.01, south: 30.14, east: -84.89, west: -88.48 },
  IN: { north: 41.77, south: 37.77, east: -84.78, west: -88.1 },
  IL: { north: 42.51, south: 36.97, east: -87.02, west: -91.52 },
};

/** Coarse corridor framing bounds per interstate (extend per corridor). */
export const INTERSTATE_BOUNDS: Record<string, LatLngBounds> = {
  // Miami → Sault Ste. Marie.
  'I-75': { north: 46.5, south: 25.7, east: -80.1, west: -88.0 },
  // Mobile → Gary.
  'I-65': { north: 41.8, south: 30.4, east: -85.4, west: -88.2 },
  // Pulley's Mill (I-57) → Chattanooga.
  'I-24': { north: 37.8, south: 34.8, east: -84.9, west: -89.2 },
};

export function boundsCenter(b: LatLngBounds): LatLng {
  return { lat: (b.north + b.south) / 2, lng: (b.east + b.west) / 2 };
}

export function boundsContain(b: LatLngBounds, p: LatLng): boolean {
  return p.lat <= b.north && p.lat >= b.south && p.lng <= b.east && p.lng >= b.west;
}

/** Grow bounds by a fraction of their size (margin around markers). */
export function padBounds(b: LatLngBounds, fraction = 0.1): LatLngBounds {
  const latPad = (b.north - b.south) * fraction;
  const lngPad = (b.east - b.west) * fraction;
  return {
    north: b.north + latPad,
    south: b.south - latPad,
    east: b.east + lngPad,
    west: b.west - lngPad,
  };
}

/** Smallest bounds containing every point, or null when there are none. */
export function boundsForPoints(points: LatLng[]): LatLngBounds | null {
  if (points.length === 0) return null;
  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;
  for (const p of points) {
    north = Math.max(north, p.lat);
    south = Math.min(south, p.lat);
    east = Math.max(east, p.lng);
    west = Math.min(west, p.lng);
  }
  return padBounds({ north, south, east, west }, 0.1);
}

/**
 * Project a point into a unit square (0..1 x/y, y down) within bounds using an
 * equirectangular projection — accurate enough for state/corridor framing and
 * completely dependency-free.
 */
export function projectToUnit(b: LatLngBounds, p: LatLng): { x: number; y: number } {
  const width = b.east - b.west || 1;
  const height = b.north - b.south || 1;
  return { x: (p.lng - b.west) / width, y: (b.north - p.lat) / height };
}
