import { SITE } from '@/lib/seo/site';
import { getReviewAggregates, getApprovedReviewsForSeo } from '@/lib/community/data';
import type { ReviewAggregate, SeoReview } from '@/lib/community/data';
import type { DirectoryEntry } from './types';

/**
 * Structured data for public directory listings. Only published AND
 * indexable (admin-marked complete) entries are emitted — thin or unverified
 * rows still render as cards but stay out of SEO surfaces, per the
 * completeness doctrine from migration 002. APPROVED driver reviews
 * (Milestone 16) enrich entries with AggregateRating + Review objects and a
 * dateModified timestamp; pending reviews never reach this layer.
 */

/** Weigh stations and rest areas are places, not businesses. */
const PLACE_CATEGORIES = new Set(['weigh-stations']);

/** Approved-review context, keyed by location id. */
export type ReviewSeo = {
  aggregates: Record<string, ReviewAggregate>;
  reviewsByLocation: Record<string, SeoReview[]>;
};

function reviewSchema(review: SeoReview) {
  return {
    '@type': 'Review',
    name: review.title,
    reviewBody: review.body,
    datePublished: review.createdAt.slice(0, 10),
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.rating,
      bestRating: 5,
      worstRating: 1,
    },
    author: { '@type': 'Person', name: review.reviewerName ?? 'Verified Driver' },
  };
}

function listingSchema(entry: DirectoryEntry, reviewSeo?: ReviewSeo) {
  // Typed per entry, so mixed lists (state/interstate/exit pages) stay correct.
  const type = PLACE_CATEGORIES.has(entry.category) ? 'Place' : 'LocalBusiness';
  const aggregate = reviewSeo?.aggregates[entry.id];
  const reviews = reviewSeo?.reviewsByLocation[entry.id] ?? [];
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
    ...(aggregate
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: aggregate.average,
            reviewCount: aggregate.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(reviews.length > 0
      ? {
          review: reviews.map(reviewSchema),
          // Approved reviews bump the listing's freshness signal.
          dateModified: reviews[0].createdAt.slice(0, 10),
        }
      : {}),
  };
}

/** ItemList of LocalBusiness/Place for a directory page, or null when empty. */
export function listingListSchema(
  entries: DirectoryEntry[],
  listName: string,
  path: string,
  reviewSeo?: ReviewSeo,
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
      item: listingSchema(e, reviewSeo),
    })),
  };
}

/**
 * listingListSchema with APPROVED driver-review enrichment. Fails soft: if
 * the review reads error out, the plain listing schema still ships.
 */
export async function listingListSchemaWithReviews(
  entries: DirectoryEntry[],
  listName: string,
  path: string,
): Promise<object | null> {
  const [aggregates, reviewsByLocation] = await Promise.all([
    getReviewAggregates(),
    getApprovedReviewsForSeo(),
  ]);
  return listingListSchema(entries, listName, path, { aggregates, reviewsByLocation });
}
