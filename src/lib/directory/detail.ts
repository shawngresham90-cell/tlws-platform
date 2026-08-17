import type { DirectoryEntry } from './types';
import { getCategory } from './categories';
import { canonicalDesignation } from './interstates';
import { haversineMiles } from '@/lib/map/geo';
import { directionsUrl } from '@/lib/map/explore';

/**
 * Pure domain logic for per-listing detail pages (Milestone 20):
 * nearby-listing ranking, the completeness gate that decides indexability,
 * unique meta copy, and the directions link. All unit-testable — no data
 * layer, no React.
 */

/** Every category surfaced as a "Nearby X" section on detail pages. */
export const DETAIL_NEARBY_CATEGORIES = [
  { slug: 'truck-stops', heading: 'Nearby Truck Stops' },
  { slug: 'parking', heading: 'Nearby Truck Parking' },
  { slug: 'cat-scales', heading: 'Nearby CAT Scales' },
  { slug: 'truck-washes', heading: 'Nearby Truck Washes' },
  { slug: 'tire-repair', heading: 'Nearby Tire Repair' },
  { slug: 'hotels-truck-parking', heading: 'Nearby Hotels with Truck Parking' },
  { slug: 'roadside-service', heading: 'Nearby Roadside Service' },
] as const;

/** Max cards per nearby section — small and useful, not exhaustive. */
export const NEARBY_SECTION_CAP = 4;
/** Coordinate-based "nearby" cutoff, in road-trip-sane miles. */
export const NEARBY_MAX_MILES = 75;
/** Exit-number window (miles — interstate exits are mile-based). */
export const NEARBY_EXIT_WINDOW = 50;

export type NearbyItem = {
  entry: DirectoryEntry;
  /** Set only when both sides have verified coordinates. */
  distanceMiles?: number;
};

export type NearbySection = {
  slug: string;
  heading: string;
  items: NearbyItem[];
};

const exitNumberOf = (e: DirectoryEntry): number | null => {
  const n = parseFloat((e.exitNumber ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/**
 * Rank one candidate against the current listing. Lower group = better;
 * `key` orders within a group. Returns null when the candidate has no
 * meaningful relation (wrong region entirely).
 */
function rankCandidate(
  current: DirectoryEntry,
  candidate: DirectoryEntry,
): { group: number; key: number; distanceMiles?: number } | null {
  // Group 0: true distance, when both sides have coordinates.
  if (
    current.lat != null &&
    current.lng != null &&
    candidate.lat != null &&
    candidate.lng != null
  ) {
    const miles =
      Math.round(
        haversineMiles(
          { lat: current.lat, lng: current.lng },
          { lat: candidate.lat, lng: candidate.lng },
        ) * 10,
      ) / 10;
    if (miles > NEARBY_MAX_MILES) return null;
    return { group: 0, key: miles, distanceMiles: miles };
  }

  // Group 1: same corridor, exit numbers within the window. When both exits
  // are known and far apart, the candidate is demonstrably distant — it must
  // not fall through to the looser same-corridor fallback below.
  const currentExit = exitNumberOf(current);
  const candidateExit = exitNumberOf(candidate);
  if (
    current.interstate &&
    candidate.interstate === current.interstate &&
    currentExit != null &&
    candidateExit != null
  ) {
    const diff = Math.abs(currentExit - candidateExit);
    return diff <= NEARBY_EXIT_WINDOW ? { group: 1, key: diff } : null;
  }

  // Group 2: same city + state.
  if (
    candidate.state.toUpperCase() === current.state.toUpperCase() &&
    candidate.city.toLowerCase() === current.city.toLowerCase()
  ) {
    return { group: 2, key: 0 };
  }

  // Group 3: same corridor + state (no usable exit numbers).
  if (
    current.interstate &&
    candidate.interstate === current.interstate &&
    candidate.state.toUpperCase() === current.state.toUpperCase()
  ) {
    return { group: 3, key: 0 };
  }

  return null;
}

/**
 * Build the "Nearby X" sections for a detail page from a candidate pool
 * (published entries in the listing's state and/or corridor). Excludes the
 * listing itself, dedupes by id, caps each section, and drops empty sections.
 */
export function nearbySections(current: DirectoryEntry, pool: DirectoryEntry[]): NearbySection[] {
  const seen = new Set<string>([current.id]);
  const byCategory = new Map<string, { item: NearbyItem; group: number; key: number }[]>();

  for (const candidate of pool) {
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    const rank = rankCandidate(current, candidate);
    if (!rank) continue;
    const list = byCategory.get(candidate.category) ?? [];
    list.push({
      item: { entry: candidate, distanceMiles: rank.distanceMiles },
      group: rank.group,
      key: rank.key,
    });
    byCategory.set(candidate.category, list);
  }

  return DETAIL_NEARBY_CATEGORIES.map((c) => {
    const ranked = (byCategory.get(c.slug) ?? []).sort(
      (a, b) =>
        a.group - b.group || a.key - b.key || a.item.entry.name.localeCompare(b.item.entry.name),
    );
    return {
      slug: c.slug,
      heading: c.heading,
      items: ranked.slice(0, NEARBY_SECTION_CAP).map((r) => r.item),
    };
  }).filter((s) => s.items.length > 0);
}

/**
 * Verified stored coordinates: both halves present, finite, inside
 * real-world ranges, and not the 0,0 null-island placeholder. Reads only
 * what the row already stores — never a guessed or freshly geocoded value.
 */
export function hasVerifiedCoordinates(entry: DirectoryEntry): boolean {
  return (
    entry.lat != null &&
    entry.lng != null &&
    Number.isFinite(entry.lat) &&
    Number.isFinite(entry.lng) &&
    Math.abs(entry.lat) <= 90 &&
    Math.abs(entry.lng) <= 180 &&
    !(entry.lat === 0 && entry.lng === 0)
  );
}

/**
 * The indexability gate (redesigned per the 2026-08-17 crawl/indexing audit,
 * PR-B). A page earns a place in search results when it can say WHERE the
 * facility is and at least two substantive things ABOUT it.
 *
 * Location identity — one of:
 *   - a street address;
 *   - a legitimate stored corridor designation (canonicalDesignation accepts
 *     only real "I-nnn" values, never free text — rest areas, welcome
 *     centers, and mobile roadside services are located by corridor, not by
 *     street address; owner decision 2026-08-17, no exit number or mile
 *     marker required when a corridor is present);
 *   - verified stored coordinates.
 * plus city + state + a known category, always.
 *
 * Quality signals — at least two of: phone, website, a meaningful
 * description, at least one STORED amenity, verified coordinates, a
 * truck-space count. `entry.amenities` is the rendered chip array and always
 * contains a synthetic overnight-status chip, so it must never be counted as
 * evidence — `storedAmenities` carries only what the row actually stores.
 *
 * Thin pages still render — they just carry noindex (follow) until the data
 * fills in. (locations.is_indexable stays an unused manual override upstream
 * of this: it is false on every current row, so the deterministic gate below
 * is what decides.)
 */
export function isDetailIndexable(entry: DirectoryEntry): boolean {
  if (!entry.city || !entry.state) return false;
  if (!getCategory(entry.category)) return false;
  const hasLocationIdentity =
    Boolean(entry.address) ||
    canonicalDesignation(entry.interstate) !== null ||
    hasVerifiedCoordinates(entry);
  if (!hasLocationIdentity) return false;
  let signals = 0;
  if (entry.phone) signals += 1;
  if (entry.website) signals += 1;
  if ((entry.description ?? '').trim().length >= 30) signals += 1;
  if ((entry.storedAmenities ?? []).length >= 1) signals += 1;
  if (hasVerifiedCoordinates(entry)) signals += 1;
  if (entry.parkingSpaces != null) signals += 1;
  return signals >= 2;
}

/** Unique <title> for a detail page. */
export function detailTitle(entry: DirectoryEntry): string {
  const category = getCategory(entry.category);
  const kind = category ? category.title.replace(/s$/, '') : 'Location';
  return `${entry.name} — ${kind} in ${entry.city}, ${entry.state} | Trucking Life with Shawn`;
}

/** Unique meta description composed from the listing's own facts (≤ ~160 chars). */
export function detailDescription(entry: DirectoryEntry): string {
  const category = getCategory(entry.category);
  const parts: string[] = [];
  parts.push(
    `${entry.name}${category ? `, ${category.title.replace(/s$/, '').toLowerCase()}` : ''} in ${entry.city}, ${entry.state}`,
  );
  if (entry.interstate) {
    parts.push(
      entry.exitNumber ? `${entry.interstate} Exit ${entry.exitNumber}` : entry.interstate,
    );
  }
  if (entry.parkingSpaces != null) parts.push(`${entry.parkingSpaces} truck spaces`);
  const amenities = (entry.amenities ?? []).slice(0, 3);
  if (amenities.length > 0) parts.push(amenities.join(', '));
  let out = `${parts.join(' · ')}. Address, phone, directions & driver reviews.`;
  if (out.length > 160)
    out = `${parts
      .join(' · ')
      .slice(0, 120)
      .replace(/\s+\S*$/, '')} — address, phone & directions.`;
  return out;
}

/**
 * Directions link: verified coordinates when we have them, otherwise the
 * street address (never an invented coordinate). Null only when there is
 * nothing safe to point a mapping app at.
 */
export function detailDirectionsUrl(entry: DirectoryEntry): string | null {
  const byCoords = directionsUrl(entry);
  if (byCoords) return byCoords;
  if (!entry.address) return null;
  const destination = [entry.address, entry.city, entry.state, entry.zip]
    .filter(Boolean)
    .join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
