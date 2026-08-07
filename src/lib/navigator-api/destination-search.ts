/**
 * Navigator destination search (pilot round 1) — the driver types where
 * they are going and picks a real place; coordinates never appear in the
 * driving UI. Uses HERE's `discover` endpoint rather than plain geocoding
 * because a driver searches for BUSINESSES ("Pilot Travel Center",
 * "Costco DC"), not just addresses, and discover answers both while
 * biasing results around the truck's current position.
 *
 * Pure: URL in, parsed candidates out. No I/O, no clock — the endpoint
 * owns fetching, the limiter, and the key.
 */

import type { LatLng } from '@/lib/map/bounds';
import type { DestinationFacility } from '@/lib/navigator/truck-entrance';

const DISCOVER_BASE = 'https://discover.search.hereapi.com/v1/discover';

/** Shortest query worth a provider transaction. */
export const MIN_SEARCH_LENGTH = 3;
export const MAX_SEARCH_LENGTH = 120;
export const MAX_SEARCH_RESULTS = 8;

export type DestinationCandidate = {
  /** Stable id for list keys and selection. */
  id: string;
  /** Primary line: the place's name ("Pilot Travel Center"). */
  title: string;
  /** Secondary line: the postal address, or '' when HERE has none. */
  address: string;
  /** Where it is. Used to plan; NEVER rendered to the driver. */
  position: LatLng;
  /** Facility class inferred from HERE's categories (arrival guidance). */
  facility: DestinationFacility;
  /** Straight-line miles from the search origin, when HERE returns it. */
  distanceMi: number | null;
};

/**
 * HERE place-category ids → the Navigator's facility classes. Only
 * categories that genuinely change arrival handling are mapped; anything
 * else stays 'unknown', which the arrival engine already treats as
 * entrance-unverified.
 */
const CATEGORY_FACILITY: Record<string, DestinationFacility> = {
  '700-7600-0116': 'truck-stop', // truck stop / plaza
  '700-7600-0000': 'truck-stop', // fuel/petrol as a truck-serving stop
  '400-4300-0000': 'rest-area', // rest area
  '400-4300-0207': 'rest-area',
  '700-7000-0107': 'truck-terminal', // freight/trucking terminal
  '800-8600-0197': 'distribution-center', // warehouse / distribution
  '700-7400-0287': 'industrial-park',
};

/** Keyword fallback when HERE gives no mapped category id. */
function facilityFromText(text: string): DestinationFacility {
  const t = text.toLowerCase();
  if (/\btruck stop|travel center|travel plaza|flying j|pilot |love's|ta travel/.test(t)) {
    return 'truck-stop';
  }
  if (/\brest area|welcome center\b/.test(t)) return 'rest-area';
  if (/\bdistribution|fulfillment|\bdc\b/.test(t)) return 'distribution-center';
  if (/\bwarehouse\b/.test(t)) return 'warehouse';
  if (/\bterminal\b/.test(t)) return 'truck-terminal';
  if (/\bindustrial park\b/.test(t)) return 'industrial-park';
  return 'unknown';
}

/** Classify one HERE item (pure, exported for tests). */
export function classifyFacility(
  categoryIds: readonly string[],
  title: string,
  address: string,
): DestinationFacility {
  for (const id of categoryIds) {
    const mapped = CATEGORY_FACILITY[id];
    if (mapped) return mapped;
  }
  return facilityFromText(`${title} ${address}`);
}

/**
 * Build the discover URL. `at` biases results to the truck's position —
 * a driver searching "Pilot" means the one down the road, not in Ohio.
 */
export function buildDiscoverUrl(
  query: string,
  at: LatLng,
  apiKey: string,
  limit = MAX_SEARCH_RESULTS,
): string {
  const p = new URLSearchParams();
  p.set('q', query);
  p.set('at', `${at.lat.toFixed(6)},${at.lng.toFixed(6)}`);
  p.set('in', 'countryCode:USA');
  p.set('limit', String(Math.min(Math.max(limit, 1), 20)));
  p.set('apiKey', apiKey);
  return `${DISCOVER_BASE}?${p.toString()}`;
}

type HereDiscoverItem = {
  id?: string;
  title?: string;
  position?: { lat?: number; lng?: number };
  address?: { label?: string };
  distance?: number;
  categories?: { id?: string }[];
};

const METERS_PER_MILE = 1609.344;
const validLat = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 90;
const validLng = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 180;

/**
 * Parse a discover response into validated candidates. An item without a
 * real coordinate is DROPPED — a destination the router cannot use must
 * never reach the driver's list. Never throws.
 */
export function parseDiscoverResponse(
  json: unknown,
  max = MAX_SEARCH_RESULTS,
): DestinationCandidate[] {
  const items = (json as { items?: HereDiscoverItem[] } | null)?.items;
  if (!Array.isArray(items)) return [];
  const out: DestinationCandidate[] = [];
  for (let i = 0; i < items.length && out.length < max; i++) {
    const it = items[i];
    const lat = it?.position?.lat;
    const lng = it?.position?.lng;
    if (!validLat(lat) || !validLng(lng)) continue;
    const address = typeof it.address?.label === 'string' ? it.address.label : '';
    const title = typeof it.title === 'string' && it.title ? it.title : address;
    if (!title) continue;
    const categoryIds = Array.isArray(it.categories)
      ? it.categories.map((c) => (typeof c?.id === 'string' ? c.id : '')).filter(Boolean)
      : [];
    const distance = it.distance;
    out.push({
      id: typeof it.id === 'string' && it.id ? it.id : `here-${i}-${title}`,
      title,
      address,
      position: { lat, lng },
      facility: classifyFacility(categoryIds, title, address),
      distanceMi:
        typeof distance === 'number' && Number.isFinite(distance) && distance >= 0
          ? Number((distance / METERS_PER_MILE).toFixed(1))
          : null,
    });
  }
  return out;
}
