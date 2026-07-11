import { createStaticClient } from '@/lib/supabase/static';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Driver community data layer (Milestone 16) — server-only reads.
 *
 * Listing refs come through the cookieless ANON client, so RLS guarantees only
 * published rows feed the public pickers. Approved reviews live behind RLS
 * with no anon policy, so they are read with the service-role client inside
 * server components ONLY, always filtered to status = 'approved' — pending
 * content never has a path to the browser. Everything fails soft to empty.
 */

/** Slim published listing shape for the submit/review pickers. */
export type ListingRef = {
  id: string;
  name: string;
  city: string;
  state: string;
  category: string;
  /** Public detail-page slug — lets ?listing= deep links avoid internal ids. */
  detailSlug?: string;
};

export async function getListingRefs(): Promise<ListingRef[]> {
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from('locations')
      .select('id, name, city, state, category_slug, detail_slug')
      .eq('is_published', true)
      .is('deleted_at', null)
      .order('state', { ascending: true })
      .order('city', { ascending: true })
      .order('name', { ascending: true })
      .limit(2000);
    if (error || !data) return [];
    return (
      data as unknown as {
        id: string;
        name: string;
        city: string;
        state: string;
        category_slug: string | null;
        detail_slug: string | null;
      }[]
    ).map((r) => ({
      id: r.id,
      name: r.name,
      city: r.city,
      state: r.state,
      category: r.category_slug ?? 'other',
      detailSlug: r.detail_slug ?? undefined,
    }));
  } catch {
    return [];
  }
}

export type ApprovedReview = {
  id: string;
  rating: number;
  title: string;
  body: string;
  visitedOn?: string;
  truckType?: string;
  reviewerName?: string;
  createdAt: string;
  location: { id: string; name: string; city: string; state: string };
};

type ReviewRow = {
  id: string;
  rating: number;
  title: string;
  body: string;
  visited_on: string | null;
  truck_type: string | null;
  reviewer_name: string | null;
  created_at: string;
  locations: { id: string; name: string; city: string; state: string } | null;
};

function toApproved(row: ReviewRow): ApprovedReview | null {
  if (!row.locations) return null;
  return {
    id: row.id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    visitedOn: row.visited_on ?? undefined,
    truckType: row.truck_type ?? undefined,
    reviewerName: row.reviewer_name ?? undefined,
    createdAt: row.created_at,
    location: row.locations,
  };
}

const REVIEW_COLUMNS =
  'id, rating, title, body, visited_on, truck_type, reviewer_name, created_at, ' +
  'locations!inner (id, name, city, state)';

/** Most recent APPROVED reviews across the directory (public reviews page). */
export async function getRecentApprovedReviews(limit = 20): Promise<ApprovedReview[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('location_reviews')
      .select(REVIEW_COLUMNS)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as unknown as ReviewRow[]).map(toApproved).filter((r): r is ApprovedReview =>
      Boolean(r),
    );
  } catch {
    return [];
  }
}

/** Per-location approved-review aggregates, for AggregateRating schema. */
export type ReviewAggregate = {
  count: number;
  average: number;
};

/**
 * Approved-review aggregates keyed by location id. One query for a whole
 * page's entries; ids not present have no approved reviews.
 */
export async function getReviewAggregates(): Promise<Record<string, ReviewAggregate>> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('location_reviews')
      .select('location_id, rating')
      .eq('status', 'approved')
      .limit(10000);
    if (error || !data) return {};
    const sums = new Map<string, { count: number; total: number }>();
    for (const row of data as unknown as { location_id: string; rating: number }[]) {
      const s = sums.get(row.location_id) ?? { count: 0, total: 0 };
      s.count += 1;
      s.total += row.rating;
      sums.set(row.location_id, s);
    }
    return Object.fromEntries(
      [...sums.entries()].map(([id, s]) => [
        id,
        { count: s.count, average: Math.round((s.total / s.count) * 10) / 10 },
      ]),
    );
  } catch {
    return {};
  }
}

/** Slim approved review used in JSON-LD Review objects. */
export type SeoReview = {
  rating: number;
  title: string;
  body: string;
  reviewerName?: string;
  createdAt: string;
};

const SEO_REVIEWS_PER_LOCATION = 3;

/**
 * Recent APPROVED reviews grouped by location (max 3 each, newest first) —
 * feeds per-listing Review schema without bloating page JSON-LD.
 */
export async function getApprovedReviewsForSeo(): Promise<Record<string, SeoReview[]>> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('location_reviews')
      .select('location_id, rating, title, body, reviewer_name, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(2000);
    if (error || !data) return {};
    const grouped: Record<string, SeoReview[]> = {};
    for (const row of data as unknown as {
      location_id: string;
      rating: number;
      title: string;
      body: string;
      reviewer_name: string | null;
      created_at: string;
    }[]) {
      const list = (grouped[row.location_id] ??= []);
      if (list.length >= SEO_REVIEWS_PER_LOCATION) continue;
      list.push({
        rating: row.rating,
        title: row.title,
        body: row.body,
        reviewerName: row.reviewer_name ?? undefined,
        createdAt: row.created_at,
      });
    }
    return grouped;
  } catch {
    return {};
  }
}

/**
 * Approved-review count + average for ONE listing — the detail page's
 * AggregateRating source. Server-side filtered, ratings only, so the query
 * stays tiny however large the review table grows. Null = no approved reviews.
 */
export async function getReviewStatsForLocation(
  locationId: string,
): Promise<ReviewAggregate | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('location_reviews')
      .select('rating')
      .eq('status', 'approved')
      .eq('location_id', locationId)
      .limit(10000);
    if (error || !data || data.length === 0) return null;
    const ratings = (data as unknown as { rating: number }[]).map((r) => r.rating);
    const total = ratings.reduce((sum, r) => sum + r, 0);
    return {
      count: ratings.length,
      average: Math.round((total / ratings.length) * 10) / 10,
    };
  } catch {
    return null;
  }
}

/** Approved reviews for one listing (detail surfaces + Review schema). */
export async function getApprovedReviewsForLocation(
  locationId: string,
  limit = 50,
): Promise<ApprovedReview[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('location_reviews')
      .select(REVIEW_COLUMNS)
      .eq('status', 'approved')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as unknown as ReviewRow[]).map(toApproved).filter((r): r is ApprovedReview =>
      Boolean(r),
    );
  } catch {
    return [];
  }
}
