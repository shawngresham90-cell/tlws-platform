import { createStaticClient } from '@/lib/supabase/static';
import { normalizeOvernightStatus } from '@/lib/directory/overnight';
import { log } from '@/lib/api/logger';
import type { DirectoryListing } from './directory-layer';

/**
 * Server-side directory loader (Phase 4). Maps verified directory records
 * into the planner's DirectoryListing shape. Read-only through the anon
 * client (RLS-bound, published-only) and FAIL-SOFT: any error returns [] so
 * an incomplete or unreachable directory degrades a plan (virtual stops +
 * warnings) instead of failing it.
 *
 * "Verified coordinates" here = rows whose lat/lng are non-null. Every
 * coordinate in this platform reached the database through the human-review
 * apply flow (batch console / Stage backfills), and the provenance column
 * (coord_verification_status) further boosts manually-verified rows in
 * planner scoring.
 *
 * SCALABILITY (2026-07-30). This loader previously fetched the candidate pool
 * with a single `.limit(2000)`. That number was an arbitrary ceiling, not a
 * capacity statement: once the published + geocoded pool crossed 2,000 rows
 * PostgREST would return the first 2,000 in an unspecified order with NO
 * error, and the fail-soft contract would have hidden the truncation
 * completely — the planner would have quietly stopped seeing part of the
 * directory. The pool was at 1,940 of 2,000 when this was found.
 *
 * The fix is deterministic keyset pagination over the whole eligible pool:
 *
 *   - ORDER BY id ASC (primary key: unique, immutable, total order). Offset
 *     paging would be enough for a static table, but keyset paging is also
 *     immune to concurrent inserts shifting a row across a page boundary, so
 *     a page can neither duplicate nor skip a row.
 *   - Each page asks for `after id > lastSeenId`, so pages cannot overlap.
 *   - A short page (fewer rows than requested) is the last page.
 *   - The expected row count is measured BEFORE paging starts and the result
 *     is checked against it, so a page that comes back short for any reason
 *     other than "end of data" is caught rather than mistaken for completion.
 *
 * Nothing about eligibility changed. Which rows the planner may consider is
 * still decided downstream — `hasConfirmedTruckParking`, the parking-category
 * sets, overnight status and scoring all live in ./directory-layer.ts and are
 * untouched. This module only decides how many rows it is honest about
 * loading.
 */

type PlannerRow = {
  id: string;
  name: string;
  category_slug: string | null;
  lat: number | null;
  lng: number | null;
  state: string | null;
  interstate: string | null;
  exit_number: string | null;
  parking_spaces: number | null;
  overnight_parking: boolean | null;
  overnight_status: string | null;
  free_parking: boolean | null;
  paid_parking: boolean | null;
  tpc_url: string | null;
  amenities: unknown;
  fuel_brands: unknown;
  coord_verification_status: string | null;
  city: string | null;
};

const PLANNER_COLUMNS =
  'id, name, category_slug, lat, lng, state, interstate, exit_number, parking_spaces, ' +
  'overnight_parking, overnight_status, free_parking, paid_parking, tpc_url, amenities, fuel_brands, ' +
  'coord_verification_status, city';

/**
 * Rows per page. Deliberately well under PostgREST's conventional 1,000-row
 * server-side maximum so a server cap can never masquerade as a last page:
 * at 500 a capped response would still be a FULL page and paging continues.
 */
export const PLANNER_PAGE_SIZE = 500;

/**
 * Runaway guard, not a capacity limit. 60 × 500 = 30,000 rows — an order of
 * magnitude beyond any plausible directory size. Exhausting it is treated as
 * a FAILURE, never as a quiet stop, so this can never become the next silent
 * ceiling.
 */
export const PLANNER_MAX_PAGES = 60;

const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** http(s)-only URL guard (defense in depth before anything reaches a page). */
function safeUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

/** Pure row → DirectoryListing mapping (exported for offline tests). */
export function mapRowToListing(row: PlannerRow): DirectoryListing {
  return {
    id: row.id,
    name: row.name,
    categorySlug: row.category_slug,
    lat: row.lat,
    lng: row.lng,
    city: row.city,
    state: row.state,
    interstate: row.interstate,
    exitNumber: row.exit_number,
    parkingSpaces: row.parking_spaces,
    overnightParking: row.overnight_parking,
    overnightStatus: normalizeOvernightStatus(row.overnight_status),
    freeParking: row.free_parking,
    paidParking: row.paid_parking,
    reservationUrl: safeUrl(row.tpc_url),
    amenities: strArray(row.amenities),
    fuelBrands: strArray(row.fuel_brands),
    coordVerificationStatus: row.coord_verification_status,
  };
}

/* --------------------------------------------------------------- paging */

/**
 * One page of the keyset scan. `afterId` is null for the first page and the
 * last id of the previous page thereafter. Implementations must return rows
 * ordered by id ascending, at most `pageSize` of them, all with id > afterId.
 */
export type PlannerPageFetcher = (
  afterId: string | null,
  pageSize: number,
) => Promise<{ rows: PlannerRow[]; error?: unknown }>;

export type CollectResult =
  | { ok: true; rows: PlannerRow[]; pages: number }
  | { ok: false; reason: CollectFailure; loaded: number; expected: number | null; pages: number };

export type CollectFailure = 'page_error' | 'no_progress' | 'page_cap' | 'short_pool';

/**
 * Walk every page of the eligible pool. Returns ok:false rather than a
 * partial list — a truncated candidate pool that looks complete is the exact
 * failure this function exists to prevent, so the caller decides what a
 * failure means (here: the existing fail-soft [] contract).
 *
 * `expected` is the row count measured before paging began. It is a floor
 * check, not an equality check: rows published DURING the scan legitimately
 * push the total above it, while a total BELOW it means the scan lost rows
 * and must not be trusted.
 */
export async function collectPlannerRows(
  fetchPage: PlannerPageFetcher,
  expected: number | null,
  opts: { pageSize?: number; maxPages?: number } = {},
): Promise<CollectResult> {
  const pageSize = Math.max(1, opts.pageSize ?? PLANNER_PAGE_SIZE);
  const maxPages = Math.max(1, opts.maxPages ?? PLANNER_MAX_PAGES);

  const rows: PlannerRow[] = [];
  let afterId: string | null = null;
  let pages = 0;

  while (pages < maxPages) {
    const page = await fetchPage(afterId, pageSize);
    pages++;
    if (page.error) {
      return { ok: false, reason: 'page_error', loaded: rows.length, expected, pages };
    }

    const batch = page.rows ?? [];
    if (batch.length === 0) break; // clean end of data on a page boundary

    const lastId = batch[batch.length - 1]?.id ?? null;
    // Defensive: a fetcher that ignores `afterId` would loop forever and
    // duplicate every row. Refuse to advance instead of spinning.
    if (lastId === null || lastId === afterId) {
      return { ok: false, reason: 'no_progress', loaded: rows.length, expected, pages };
    }

    rows.push(...batch);
    afterId = lastId;

    // A short page is the last page — and only a short page ends the scan,
    // so a full page always earns another request.
    if (batch.length < pageSize) {
      if (expected !== null && rows.length < expected) {
        return { ok: false, reason: 'short_pool', loaded: rows.length, expected, pages };
      }
      return { ok: true, rows, pages };
    }
  }

  if (pages >= maxPages) {
    return { ok: false, reason: 'page_cap', loaded: rows.length, expected, pages };
  }
  // Fell out via an empty page: the previous page filled exactly to a
  // boundary. Same completeness check as the short-page exit.
  if (expected !== null && rows.length < expected) {
    return { ok: false, reason: 'short_pool', loaded: rows.length, expected, pages };
  }
  return { ok: true, rows, pages };
}

/* ---------------------------------------------------------------- loader */

/**
 * Published, coordinate-bearing listings for the planner — the COMPLETE
 * eligible pool, paginated. Fail-soft [] on any error, including a scan that
 * could not prove it was complete.
 */
export async function loadPlannerListings(): Promise<DirectoryListing[]> {
  try {
    const supabase = createStaticClient();

    // Same filters as the page scan, head-only: a COUNT with no rows, so the
    // completeness check costs one cheap query rather than a second pass.
    const { count, error: countError } = await supabase
      .from('locations')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true)
      .is('deleted_at', null)
      .not('lat', 'is', null)
      .not('lng', 'is', null);

    // A failed count is not fatal — paging is still correct without it, we
    // just lose the independent completeness check. Say so in the log.
    const expected = countError || typeof count !== 'number' ? null : count;
    if (expected === null) log.warn('planner_pool_count_unavailable');

    const fetchPage: PlannerPageFetcher = async (afterId, pageSize) => {
      let query = supabase
        .from('locations')
        .select(PLANNER_COLUMNS)
        .eq('is_published', true)
        .is('deleted_at', null)
        .not('lat', 'is', null)
        .not('lng', 'is', null);
      if (afterId !== null) query = query.gt('id', afterId);
      const { data, error } = await query.order('id', { ascending: true }).limit(pageSize);
      if (error) return { rows: [], error };
      return { rows: (data ?? []) as unknown as PlannerRow[] };
    };

    const result = await collectPlannerRows(fetchPage, expected);
    if (!result.ok) {
      // No secrets, no row contents — counts and a reason code only.
      log.error('planner_pool_load_incomplete', {
        reason: result.reason,
        loaded: result.loaded,
        expected: result.expected,
        pages: result.pages,
      });
      return [];
    }

    return result.rows.filter((r) => r.lat != null && r.lng != null).map(mapRowToListing);
  } catch {
    return [];
  }
}

/** "Name (City, ST · I-75)" — as much locality as the row can support. */
export function buildAnchorLabel(l: DirectoryListing): string {
  const place = [l.city, l.state].filter(Boolean).join(', ');
  const detail = [place, l.interstate].filter(Boolean).join(' · ');
  return detail ? `${l.name} (${detail})` : l.name;
}

export type PlannerAnchor = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  state: string;
};

/**
 * Origin/destination picker options: geocoded listings labeled by name and
 * city/state. Fail-soft []. (Until HERE geocoding arrives, drivers anchor
 * trips to known directory locations.)
 */
export async function loadPlannerAnchors(): Promise<PlannerAnchor[]> {
  const listings = await loadPlannerListings();
  return listings
    .filter((l) => l.lat != null && l.lng != null)
    .map((l) => ({
      id: l.id,
      label: buildAnchorLabel(l),
      lat: l.lat as number,
      lng: l.lng as number,
      state: l.state ?? '',
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
