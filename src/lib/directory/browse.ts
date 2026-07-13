import type { DirectoryEntry } from './types';
import { rankEntries } from './search';

/**
 * Public directory search + sort, extracted from the browser component so it
 * is pure and testable. Matching lives in lib/directory/search.ts (alias
 * normalization, fuzzy tokens, field-weighted relevance); this module keeps
 * the state/city filters and the four sort modes. With a query present the
 * default "featured" sort becomes relevance order; explicit A–Z / newest /
 * distance sorts keep their order and use the matcher only as a filter.
 */

export type SortKey = 'featured' | 'alpha' | 'newest' | 'distance';

export type BrowseOptions = {
  query: string;
  state: string;
  city: string;
  sort: SortKey;
  /** Required for sort === 'distance'; ignored otherwise. */
  origin?: { lat: number; lng: number } | null;
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

export function filterAndSortEntries(
  entries: DirectoryEntry[],
  opts: BrowseOptions,
): DirectoryEntry[] {
  const scoped = entries.filter((e) => {
    if (opts.state && e.state !== opts.state) return false;
    if (opts.city && e.city !== opts.city) return false;
    return true;
  });

  const q = opts.query.trim();
  const ranked = rankEntries(scoped, q);
  const filtered = ranked.map((r) => r.entry);

  const byName = (a: DirectoryEntry, b: DirectoryEntry) => a.name.localeCompare(b.name);

  switch (opts.sort) {
    case 'alpha':
      return [...filtered].sort(byName);
    case 'newest':
      return [...filtered].sort(
        (a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || byName(a, b),
      );
    case 'distance': {
      const origin = opts.origin;
      if (!origin) return [...filtered].sort(byName);
      const dist = (e: DirectoryEntry) =>
        e.lat != null && e.lng != null
          ? distanceMiles(origin, { lat: e.lat, lng: e.lng })
          : Number.POSITIVE_INFINITY;
      return [...filtered].sort((a, b) => dist(a) - dist(b) || byName(a, b));
    }
    case 'featured':
    default:
      // With a query, ranked relevance order (featured already boosted);
      // without one, the original featured-first A–Z.
      if (q) return filtered;
      return [...filtered].sort(
        (a, b) => Number(b.featured ?? false) - Number(a.featured ?? false) || byName(a, b),
      );
  }
}
