import { SITE } from '@/lib/seo/site';
import { getReviewAggregates, getApprovedReviewsForSeo } from '@/lib/community/data';
import type { ReviewAggregate, SeoReview } from '@/lib/community/data';
import { isDetailIndexable } from './detail';
import { detailHref } from './detail-slug';
import type { DirectoryEntry } from './types';

/**
 * Structured data for public directory listings. Only published entries past
 * the deterministic completeness gate (isDetailIndexable — the same gate that
 * decides detail-page noindex and sitemap membership) are emitted — thin rows
 * still render as cards but stay out of SEO surfaces. The manual
 * locations.is_indexable flag is NOT the gate here: it is false on every
 * current row (see detail.ts), so filtering on it silently emitted no
 * ItemList anywhere. APPROVED driver reviews (Milestone 16) enrich entries
 * with AggregateRating + Review objects and a dateModified timestamp;
 * pending reviews never reach this layer.
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

/**
 * Standalone LocalBusiness/Place schema for a listing's own detail page
 * (Milestone 20). AggregateRating and Review objects appear only when
 * APPROVED reviews exist; geo only with verified coordinates; dateModified
 * prefers the newest approved review, falling back to the row's updated_at.
 */
export function listingDetailSchema(
  entry: DirectoryEntry,
  path: string,
  aggregate: ReviewAggregate | null,
  reviews: SeoReview[],
): object {
  const base = listingSchema(entry, {
    aggregates: aggregate && aggregate.count > 0 ? { [entry.id]: aggregate } : {},
    reviewsByLocation: { [entry.id]: reviews },
  }) as Record<string, unknown>;
  const dateModified =
    reviews.length > 0
      ? reviews[0].createdAt.slice(0, 10)
      : entry.updatedAt
        ? entry.updatedAt.slice(0, 10)
        : undefined;
  return {
    '@context': 'https://schema.org',
    ...base,
    '@id': `${SITE.url}${path}#listing`,
    mainEntityOfPage: `${SITE.url}${path}`,
    ...(dateModified ? { dateModified } : {}),
  };
}

/**
 * How many listings are DESCRIBED IN FULL in a page's ItemList.
 *
 * The list used to carry a complete LocalBusiness object — address, phone,
 * geo, reviews — for every indexable entry on the page: 1,785 of them on
 * /directory/truck-stops, 638 kB of JSON-LD in a document that rendered
 * thirty cards. That is 45 kB Brotli spent describing listings the page does
 * not show, each of which already has its own detail page carrying its own
 * LocalBusiness schema — so the full objects here were a duplicate of the
 * authority, not the authority.
 *
 * 30 is the page's own first window: the listings a visitor and a crawler
 * both actually see rendered. Everything past it stays in the list as a
 * ListItem pointing at its detail page, which is what a ListItem is for and
 * what keeps `numberOfItems` honest.
 */
const SCHEMA_DETAILED_ITEMS = 30;

/**
 * ItemList of LocalBusiness/Place for a directory page, or null when empty.
 *
 * TWO KINDS OF ENTRY, both truthful about the page they describe. The first
 * `SCHEMA_DETAILED_ITEMS` — the window the server renders as cards — carry
 * the full object. The rest are `ListItem`s with a `url` pointing at the
 * listing's own detail page, where its full schema lives.
 *
 * `numberOfItems` still counts every indexable listing on the page, because
 * every one of them IS on the page: reachable through the same complete index
 * the browser filters, and counted in the heading the visitor reads. The list
 * is not truncated — only the depth of description varies, which is exactly
 * the distinction ItemList's `item` versus `url` draws.
 *
 * Entries without a detail slug are left out of the tail rather than given a
 * bare position: a ListItem with neither an item nor a URL asserts a rank and
 * nothing else.
 */
export function listingListSchema(
  entries: DirectoryEntry[],
  listName: string,
  path: string,
  reviewSeo?: ReviewSeo,
): object | null {
  const indexable = entries.filter(isDetailIndexable);
  if (indexable.length === 0) return null;
  const itemListElement: object[] = [];
  indexable.forEach((e, i) => {
    if (i < SCHEMA_DETAILED_ITEMS) {
      itemListElement.push({
        '@type': 'ListItem',
        position: i + 1,
        item: listingSchema(e, reviewSeo),
      });
      return;
    }
    if (!e.detailSlug) return;
    itemListElement.push({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE.url}${detailHref(e.detailSlug)}`,
    });
  });
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${listName} — ${SITE.brand}`,
    url: `${SITE.url}${path}`,
    numberOfItems: indexable.length,
    itemListElement,
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
  // listingListSchema returns null when no entry is indexable, so with zero
  // indexable entries the two review-table scans below (up to 10,000 rating
  // rows + 2,000 review rows, per page regeneration) fed a result that was
  // discarded unread. Decide null first, spend second.
  if (!entries.some(isDetailIndexable)) return null;
  const [aggregates, reviewsByLocation] = await Promise.all([
    getReviewAggregates(),
    getApprovedReviewsForSeo(),
  ]);
  return listingListSchema(entries, listName, path, { aggregates, reviewsByLocation });
}
