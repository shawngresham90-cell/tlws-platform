import type { DirectoryEntry } from '@/lib/directory/types';
import { haversineMiles } from './geo';
import { boundsForPoints, type LatLngBounds, type LatLng } from './bounds';

/**
 * Pure logic behind the public map explorer (/directory/map, Milestone 19):
 * filter pipeline, manual location search, and marker sizing — all
 * unit-testable with no browser or Leaflet involved. The entry pool is
 * ALWAYS the server-filtered coordinate-ready set (published, non-deleted,
 * valid lat/lng), so nothing here can surface hidden listings.
 */

export const RADIUS_OPTIONS = [10, 25, 50, 100, 250] as const;

/** Parking flags map onto the chip labels the data layer emits. */
export const PARKING_FILTERS = [
  { key: 'Free parking', label: 'Free parking' },
  { key: 'Paid parking', label: 'Paid parking' },
  { key: 'Reserved', label: 'Reserved parking' },
  { key: 'Overnight OK', label: 'Overnight parking' },
] as const;

export type ExploreFilters = {
  category: string;
  state: string;
  interstate: string;
  city: string;
  /** Parking chips + amenity names, all matched against entry.amenities. */
  amenities: string[];
  /** Miles; only applied when an origin exists. 0 = off. */
  radiusMiles: number;
};

export const EMPTY_FILTERS: ExploreFilters = {
  category: '',
  state: '',
  interstate: '',
  city: '',
  amenities: [],
  radiusMiles: 0,
};

export function hasActiveFilters(f: ExploreFilters): boolean {
  return Boolean(
    f.category || f.state || f.interstate || f.city || f.amenities.length > 0 || f.radiusMiles > 0,
  );
}

export type ExploreOrigin = LatLng & {
  /** Human label ("your location", "Valdosta, GA"). */
  label: string;
};

export type ExploreResult = DirectoryEntry & { distanceMiles?: number };

/**
 * The whole filter pipeline: facet filters → amenity AND-match → radius
 * (only with an origin) → distance decoration → sort (nearest first when an
 * origin exists, featured-then-name otherwise).
 */
export function applyExploreFilters(
  entries: DirectoryEntry[],
  filters: ExploreFilters,
  origin: ExploreOrigin | null,
): ExploreResult[] {
  let out: ExploreResult[] = entries.filter((e) => {
    if (filters.category && e.category !== filters.category) return false;
    if (filters.state && e.state.toUpperCase() !== filters.state.toUpperCase()) return false;
    if (filters.interstate && (e.interstate ?? '') !== filters.interstate) return false;
    if (filters.city && e.city.toLowerCase() !== filters.city.toLowerCase()) return false;
    if (filters.amenities.length > 0) {
      const have = new Set(e.amenities ?? []);
      if (!filters.amenities.every((a) => have.has(a))) return false;
    }
    return true;
  });

  if (origin) {
    out = out.map((e) => ({
      ...e,
      distanceMiles:
        e.lat != null && e.lng != null
          ? Math.round(haversineMiles(origin, { lat: e.lat, lng: e.lng }) * 10) / 10
          : undefined,
    }));
    if (filters.radiusMiles > 0) {
      out = out.filter(
        (e) => e.distanceMiles != null && e.distanceMiles <= filters.radiusMiles,
      );
    }
    out.sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity));
  } else {
    out.sort(
      (a, b) => Number(b.featured ?? false) - Number(a.featured ?? false) || a.name.localeCompare(b.name),
    );
  }
  return out;
}

export type LocationSearchResult =
  | { kind: 'match'; matches: DirectoryEntry[]; origin: ExploreOrigin; bounds: LatLngBounds }
  | { kind: 'none' };

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Manual location search over the coordinate-ready entries: city, state
 * (name or code), ZIP, or business name. Never invents coordinates — a match
 * centers on the matching listings' own bounds; no match returns 'none'.
 */
export function searchLocation(
  entries: DirectoryEntry[],
  query: string,
  stateNamesByCode: Record<string, string> = {},
): LocationSearchResult {
  const q = norm(query);
  if (!q) return { kind: 'none' };

  // "city, st" | "city st" | plain term
  const cityState = q.match(/^(.+?)[,\s]+([a-z]{2})$/);
  const matchers: ((e: DirectoryEntry) => boolean)[] = [];
  if (cityState) {
    matchers.push(
      (e) => norm(e.city) === norm(cityState[1]) && e.state.toLowerCase() === cityState[2],
    );
  }
  matchers.push(
    (e) => norm(e.city) === q,
    (e) => e.state.toLowerCase() === q,
    (e) => norm(stateNamesByCode[e.state.toUpperCase()] ?? '') === q,
    (e) => (e.zip ?? '') === q,
    (e) => norm(e.name).includes(q),
  );

  for (const match of matchers) {
    const matches = entries.filter(match);
    if (matches.length > 0) {
      const points = matches
        .filter((e) => e.lat != null && e.lng != null)
        .map((e) => ({ lat: e.lat as number, lng: e.lng as number }));
      const bounds = boundsForPoints(points);
      if (!bounds) return { kind: 'none' };
      return {
        kind: 'match',
        matches,
        origin: {
          lat: (bounds.north + bounds.south) / 2,
          lng: (bounds.east + bounds.west) / 2,
          label: query.trim(),
        },
        bounds,
      };
    }
  }
  return { kind: 'none' };
}

/** Cluster grid resolution by Leaflet zoom — finer grid as you zoom in. */
export function gridSizeForZoom(zoom: number): number {
  if (zoom >= 12) return 256;
  if (zoom >= 10) return 96;
  if (zoom >= 8) return 48;
  if (zoom >= 6) return 24;
  return 12;
}

/** Google Maps directions URL (no API key). Null when coords are unusable. */
export function directionsUrl(entry: Pick<DirectoryEntry, 'lat' | 'lng'>): string | null {
  if (entry.lat == null || entry.lng == null) return null;
  if (!Number.isFinite(entry.lat) || !Number.isFinite(entry.lng)) return null;
  if (entry.lat === 0 && entry.lng === 0) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${entry.lat},${entry.lng}`;
}

/** Distinct sorted cities among the pool (for the city filter). */
export function citiesIn(entries: DirectoryEntry[]): string[] {
  return [...new Set(entries.map((e) => e.city))].sort();
}
