import { createStaticClient } from '@/lib/supabase/static';
import { createAdminClient } from '@/lib/supabase/admin';
import { collectAllRows, failureCode, type DirectoryReadResult } from '@/lib/directory/data';

/**
 * Driver community data layer (Milestone 16) — server-only reads.
 *
 * Listing refs come through the cookieless ANON client, so RLS guarantees only
 * published rows feed the public pickers, and they are read COMPLETELY — every
 * published listing, not a capped prefix (DIR-COMPLETE-2). Approved reviews
 * live behind RLS with no anon policy, so they are read with the service-role
 * client inside server components ONLY, always filtered to status =
 * 'approved' — pending content never has a path to the browser.
 *
 * The review reads fail soft to empty: a missing review renders as one fewer
 * card. The listing read does NOT, because an empty picker is not a harmless
 * absence — it is a claim that a driver's truck stop is not in the directory.
 * getListingRefsResult() states failure; getListingRefs() keeps the fail-soft
 * shape for callers that cannot act on it.
 */

/**
 * Slim published listing shape for the submit/review pickers.
 *
 * `category` was here and is GONE (DIR-COMPLETE-2). It was read by nothing —
 * not the picker, not either form, not either page, not the intake APIs — so
 * every browser was paying for it: 27,645 bytes of values plus 34,356 of
 * repeated keys across the live pool. The field is dropped because no
 * consumer reads it, not to make a payload number smaller; `detailSlug` is
 * larger still and stays, because the deep links need it.
 */
export type ListingRef = {
  id: string;
  name: string;
  city: string;
  state: string;
  /** Public detail-page slug — lets ?listing= deep links avoid internal ids. */
  detailSlug?: string;
};

type ListingRefRow = {
  id: string;
  name: string;
  city: string;
  state: string;
  detail_slug: string | null;
};

/** Exactly the columns a ListingRef is built from — nothing else leaves the DB. */
const LISTING_REF_COLUMNS = 'id, name, city, state, detail_slug';

/**
 * PRESENTATION ORDER, restored in JS because the scan pages by id.
 *
 * `localeCompare` is not a stylistic choice: the database this replaces
 * ordered under ICU `en_US.UTF-8` (pg_database.datlocprovider = 'i'), and on
 * the punctuation/case cases in the live pool — "ACME Truck & Trailer" vs
 * "acme truck and trailer", the U+2019 apostrophe in "Love’s" — localeCompare
 * reproduces that order exactly while code-unit `<` does not. So the visible
 * order is preserved rather than merely approximated.
 *
 * `id` is the final tie-breaker, and it is deliberately NOT redundant even
 * though today it looks it. Three live-shaped rows can share state, city AND
 * name. The scan happens to hand this sort an id-ascending array, and
 * Array.prototype.sort happens to be stable, so ties would currently come out
 * id-ordered anyway — which means removing this clause changes no observable
 * output. That is exactly the trap: the visible order would then rest on two
 * incidental facts (the scan's cursor column, and a language guarantee about
 * ties) instead of on a stated rule. Stating the rule is what keeps a future
 * change to either one from silently reshuffling the picker.
 *
 * Exported so that rule can be tested on shuffled input directly, rather than
 * only through a pipeline that hides it.
 */
export function compareListingRefs(a: ListingRef, b: ListingRef): number {
  return (
    a.state.localeCompare(b.state) ||
    a.city.localeCompare(b.city) ||
    a.name.localeCompare(b.name) ||
    a.id.localeCompare(b.id)
  );
}

/**
 * EVERY published listing, for the submit/review pickers — success or failure
 * stated, never a partial pool dressed as a complete one.
 *
 * WHAT WAS WRONG. This read asked for `.limit(2000)` and returned whatever
 * came back. Production holds 2,454 published rows, so 454 of them were
 * simply not in the array — and because the query ordered by state first, the
 * missing 454 were not a random sample but the alphabetical tail: every
 * published listing in TX, UT, VA, WA, WI, WV, WY and 72 of TN. A driver at a
 * Texas truck stop searching the picker was told "No published listing
 * matches" about a listing that exists. No error was raised; the read looked
 * successful.
 *
 * The same keyset scan the directory reads use fixes it, and fixes the latent
 * half too: a PostgREST instance capping responses server-side would have
 * truncated this read below 2,000 without changing anything observable in the
 * response body. `collectAllRows` treats a short page as evidence of nothing
 * — see its contract — so a cap cannot end the scan early.
 *
 * Failure is REPORTED, not flattened to `[]`. "The lookup is down" and "there
 * are no listings" render as the same sentence to a driver otherwise, and the
 * first one is a lie.
 */
export async function getListingRefsResult(): Promise<DirectoryReadResult<ListingRef[]>> {
  try {
    const supabase = createStaticClient();
    const result = await collectAllRows<ListingRefRow>(async (afterId, pageSize) => {
      // COUNT/PAGE FILTER PARITY, structurally: the exact count rides on the
      // first page's own query, so no second query's filters can drift from
      // it. With a cursor applied it would count the remainder, not the set.
      let q = supabase
        .from('locations')
        .select(LISTING_REF_COLUMNS, afterId === null ? { count: 'exact' } : undefined)
        .eq('is_published', true)
        .is('deleted_at', null);
      if (afterId !== null) q = q.gt('id', afterId);
      const { data, error, count } = await q.order('id', { ascending: true }).limit(pageSize);
      if (error) return { rows: [], error };
      return {
        rows: (data ?? []) as unknown as ListingRefRow[],
        total: typeof count === 'number' ? count : undefined,
      };
    }, null);
    if (!result.ok) return result;

    const refs = result.data.map((r) => ({
      id: r.id,
      name: r.name,
      city: r.city,
      state: r.state,
      detailSlug: r.detail_slug ?? undefined,
    }));
    refs.sort(compareListingRefs);
    return { ok: true, data: refs };
  } catch (error) {
    return { ok: false, reason: 'unavailable', code: failureCode(error) };
  }
}

/**
 * Fail-soft view, unchanged in shape for callers that only render. Callers
 * that must tell "unavailable" apart from "genuinely empty" — both community
 * pages do — should use getListingRefsResult() instead.
 */
export async function getListingRefs(): Promise<ListingRef[]> {
  const result = await getListingRefsResult();
  return result.ok ? result.data : [];
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
    return (data as unknown as ReviewRow[])
      .map(toApproved)
      .filter((r): r is ApprovedReview => Boolean(r));
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
    return (data as unknown as ReviewRow[])
      .map(toApproved)
      .filter((r): r is ApprovedReview => Boolean(r));
  } catch {
    return [];
  }
}
