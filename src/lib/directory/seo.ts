import { SITE } from '@/lib/seo/site';
import type { DirectoryEntry } from './types';

/**
 * Structured data for public directory listings. Only published AND
 * indexable (admin-marked complete) entries are emitted — thin or unverified
 * rows still render as cards but stay out of SEO surfaces, per the
 * completeness doctrine from migration 002.
 */

/** Weigh stations and rest areas are places, not businesses. */
const PLACE_CATEGORIES = new Set(['weigh-stations']);

function listingSchema(entry: DirectoryEntry) {
  // Typed per entry, so mixed lists (state/interstate/exit pages) stay correct.
  const type = PLACE_CATEGORIES.has(entry.category) ? 'Place' : 'LocalBusiness';
  return {
    '@type': type,
    name: entry.name,
    address: {
      '@type': 'PostalAddress',
      ...(entry.address ? { streetAddress: entry.address } : {}),
      addressLocality: entry.city,
      addressRegion: entry.state,
      ...(entry.zip ? { postalCode: entry.zip } : {}),
      addressCountry: 'US',
    },
    ...(entry.phone ? { telephone: entry.phone } : {}),
    ...(entry.website ? { url: entry.website } : {}),
    ...(entry.lat != null && entry.lng != null
      ? { geo: { '@type': 'GeoCoordinates', latitude: entry.lat, longitude: entry.lng } }
      : {}),
  };
}

/** ItemList of LocalBusiness/Place for a directory page, or null when empty. */
export function listingListSchema(
  entries: DirectoryEntry[],
  listName: string,
  path: string,
): object | null {
  const indexable = entries.filter((e) => e.indexable);
  if (indexable.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${listName} — ${SITE.brand}`,
    url: `${SITE.url}${path}`,
    numberOfItems: indexable.length,
    itemListElement: indexable.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: listingSchema(e),
    })),
  };
}
