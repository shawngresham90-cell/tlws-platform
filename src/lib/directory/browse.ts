import { getCategory } from './categories';

/**
 * Public directory search + sort, extracted from the browser component so it
 * is pure and testable. Search covers business name, city, state, ZIP, and
 * interstate (exit number is indexed in the haystack too — future-ready).
 *
 * ONE FILTER TRUTH, TWO ROW SHAPES (DIR-PAYLOAD-1). The state / interstate
 * pages hand these functions whole card rows; a category page hands them a
 * compact index whose searchable text was joined on the server. Both go
 * through the same predicate and the same comparators — the only difference
 * is whether `searchText` arrives ready-made or is built here from the row's
 * own fields, by the same builder the server used.
 */

/**
 * How many results a browse surface renders per window.
 *
 * It lives HERE, not in the client component, because the server slices the
 * same number of cards into the initial HTML. Exporting it from a `'use
 * client'` module looked equivalent and was not: in the server bundle every
 * export of a client module is a client-reference proxy, so `slice(0, PAGE)`
 * became `slice(0, NaN)` — an empty array, thirty pending cards in the
 * prerendered HTML, and no server-rendered detail links for a crawler. It
 * threw nothing and typechecked cleanly.
 */
export const DIRECTORY_PAGE = 30;

export type SortKey = 'featured' | 'alpha' | 'newest' | 'distance';

export type BrowseOptions = {
  query: string;
  state: string;
  city: string;
  sort: SortKey;
  /** Required for sort === 'distance'; ignored otherwise. */
  origin?: { lat: number; lng: number } | null;
};

/**
 * The minimum a row needs to be filtered and sorted. Everything past the
 * first four fields is optional, so a compact index row and a full card row
 * both satisfy it.
 */
export type BrowsableEntry = {
  id: string;
  name: string;
  city: string;
  state: string;
  featured?: boolean;
  /** ISO timestamp (card rows) or epoch milliseconds (index rows). */
  createdAt?: string | number;
  lat?: number;
  lng?: number;
  /** Structured fields the haystack is built from, when not pre-joined. */
  zip?: string;
  interstate?: string;
  exitNumber?: string;
  category?: string;
  amenities?: string[];
  description?: string;
  /** Pre-joined, already lowercased haystack tail (index rows carry this). */
  searchText?: string;
};

/** Haversine distance in miles (good enough for sorting). */
export function distanceMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Everything searchable about a listing EXCEPT its name, city and state —
 * exit/interstate, ZIP, category title, amenity labels, description.
 *
 * Split out from the haystack so a server can join it once per row into the
 * browse index instead of shipping six more columns per row. The name, city
 * and state stay separate because filters and sorts read them as values, not
 * as text.
 */
export function buildSearchText(e: BrowsableEntry): string {
  return [
    e.zip,
    e.interstate,
    e.exitNumber,
    e.exitNumber ? `exit ${e.exitNumber}` : undefined,
    e.category ? getCategory(e.category)?.title : undefined,
    ...(e.amenities ?? []),
    e.description,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Business name (which carries the brand: Pilot, Love's, TA…), location
 * fields, exit/interstate, category title, and amenity labels — one string,
 * so "showers exit 201" or "cat scale knoxville" both just work.
 */
function haystack(e: BrowsableEntry): string {
  return [e.name, e.city, e.state, e.searchText ?? buildSearchText(e)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Newest-first key. ISO strings and epoch millis both order correctly. */
function createdKey(e: BrowsableEntry): string | number {
  return e.createdAt ?? '';
}

function compareNewest(a: BrowsableEntry, b: BrowsableEntry): number {
  const ka = createdKey(a);
  const kb = createdKey(b);
  if (typeof ka === 'number' || typeof kb === 'number') {
    const na = typeof ka === 'number' ? ka : -Infinity;
    const nb = typeof kb === 'number' ? kb : -Infinity;
    return nb === na ? 0 : nb > na ? 1 : -1;
  }
  return String(kb).localeCompare(String(ka));
}

export function filterAndSortEntries<E extends BrowsableEntry>(
  entries: E[],
  opts: BrowseOptions,
): E[] {
  const q = opts.query.trim().toLowerCase();
  const filtered = entries.filter((e) => {
    if (opts.state && e.state !== opts.state) return false;
    if (opts.city && e.city !== opts.city) return false;
    if (!q) return true;
    return haystack(e).includes(q);
  });

  const byName = (a: E, b: E) => a.name.localeCompare(b.name);

  switch (opts.sort) {
    case 'alpha':
      return [...filtered].sort(byName);
    case 'newest':
      return [...filtered].sort((a, b) => compareNewest(a, b) || byName(a, b));
    case 'distance': {
      const origin = opts.origin;
      if (!origin) return [...filtered].sort(byName);
      const dist = (e: E) =>
        e.lat != null && e.lng != null
          ? distanceMiles(origin, { lat: e.lat, lng: e.lng })
          : Number.POSITIVE_INFINITY;
      return [...filtered].sort((a, b) => dist(a) - dist(b) || byName(a, b));
    }
    case 'featured':
    default:
      return [...filtered].sort(
        (a, b) => Number(b.featured ?? false) - Number(a.featured ?? false) || byName(a, b),
      );
  }
}
