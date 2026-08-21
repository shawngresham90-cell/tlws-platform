import { createStaticClient } from '@/lib/supabase/static';
import { canonicalDesignation, canonicalExitNumber } from '@/lib/directory/interstates';
import { log } from '@/lib/api/logger';
import { normalizeOvernightStatus, overnightChipFor } from './overnight';
import type { DirectoryEntry } from './types';
import { isFeaturedActive, type FeaturedSchema } from './featured-window';

/**
 * Directory data layer — Milestone 12: real reads from `public.locations`.
 *
 * Uses the cookieless anon client, so RLS is the enforcement boundary: anon
 * can only SELECT rows with is_published = true and deleted_at is null (the
 * query filters match the policy, but the policy is what guarantees it).
 * Fails soft to an empty list — a missing env var or a DB hiccup renders the
 * directory's honest empty state, never a 500.
 */

type LocationRow = {
  id: string;
  name: string;
  category_slug: string | null;
  state: string;
  city: string;
  slug: string;
  address: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  parking_spaces: number | null;
  amenities: unknown;
  free_parking: boolean | null;
  paid_parking: boolean | null;
  reserved_parking: boolean | null;
  overnight_parking: boolean | null;
  tpc_url: string | null;
  is_featured: boolean | null;
  /** Absent when migration 057 has not been applied yet. */
  featured_until?: string | null;
  is_indexable: boolean | null;
  lat: number | null;
  lng: number | null;
  interstate: string | null;
  exit_number: string | null;
  mile_marker: number | null;
  mile_marker_source: string | null;
  overnight_status: string | null;
  overnight_status_source: string | null;
  created_at: string | null;
  detail_slug: string | null;
  updated_at: string | null;
  verified_at: string | null;
};

/** Only ever emit http(s) URLs to the page (defense in depth after zod). */
function safeUrl(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:' ? value : undefined;
  } catch {
    return undefined;
  }
}

function toEntry(row: LocationRow, ctx: EntryContext): DirectoryEntry {
  // What the row actually stores — the ONLY amenities that may count as
  // indexability evidence (PR-B). The chips below add synthetic presentation
  // values on top and must never be mistaken for stored data.
  const storedAmenities: string[] = [];
  if (Array.isArray(row.amenities)) {
    for (const a of row.amenities) if (typeof a === 'string') storedAmenities.push(a);
  }
  // Parking attributes render as chips alongside stored amenities.
  const chips: string[] = [];
  if (row.free_parking) chips.push('Free parking');
  if (row.paid_parking) chips.push('Paid parking');
  if (row.reserved_parking) chips.push('Reserved');
  // M3: the overnight chip comes from `overnight_status`, NOT the legacy
  // `overnight_parking` boolean. All three states are stated explicitly —
  // an unreviewed row reads "Overnight unknown" rather than going silent.
  chips.push(overnightChipFor(row.overnight_status));
  chips.push(...storedAmenities);

  return {
    id: row.id,
    category: row.category_slug ?? 'other',
    name: row.name,
    state: row.state,
    city: row.city,
    slug: row.slug,
    address: row.address ?? undefined,
    zip: row.zip ?? undefined,
    phone: row.phone ?? undefined,
    website: safeUrl(row.website),
    amenities: chips.length ? chips : undefined,
    storedAmenities: storedAmenities.length ? storedAmenities : undefined,
    parkingSpaces: row.parking_spaces ?? undefined,
    description: row.description ?? undefined,
    tpcUrl: safeUrl(row.tpc_url),
    // Paid featured treatment is a WINDOW, not a boolean. One authority
    // decides it (featured-window.ts) so the badge, the sort, the map and the
    // capacity count can never disagree about whether a term is still running.
    // Before migration 057 is applied the column is not there to read, and the
    // authority falls back to the pre-057 rule.
    featured: isFeaturedActive(
      {
        isFeatured: row.is_featured ?? false,
        isPublished: true,
        deletedAt: null,
        name: row.name,
        featuredUntil: row.featured_until,
      },
      ctx.now,
      ctx.schema,
    ),
    indexable: row.is_indexable ?? false,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    interstate: row.interstate ?? undefined,
    exitNumber: row.exit_number ?? undefined,
    mileMarker: typeof row.mile_marker === 'number' ? row.mile_marker : undefined,
    mileMarkerSource: row.mile_marker_source ?? undefined,
    overnightStatus: normalizeOvernightStatus(row.overnight_status),
    overnightStatusSource: row.overnight_status_source ?? undefined,
    createdAt: row.created_at ?? undefined,
    detailSlug: row.detail_slug ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    verifiedAt: row.verified_at ?? undefined,
  };
}

const BASE_COLUMNS =
  'id, name, category_slug, state, city, slug, address, zip, phone, website, description, ' +
  'parking_spaces, amenities, free_parking, paid_parking, reserved_parking, overnight_parking, ' +
  'tpc_url, is_featured, is_indexable, lat, lng, interstate, exit_number, created_at, ' +
  'detail_slug, updated_at, verified_at, mile_marker, mile_marker_source, ' +
  'overnight_status, overnight_status_source';

/* ------------------------------------------- featured-term schema bridge */

/**
 * Netlify deploys the application on merge; the Supabase migration is applied
 * separately afterwards. So there is a real window during which this code
 * knows about `locations.featured_until` and the database does not, and asking
 * for a column that is not there fails EVERY directory read — the whole public
 * Directory, not just the badge.
 *
 * The bridge is one probe, memoized per process. Reads then ask for the column
 * only when it exists.
 *
 * WHICH WAY THIS FAILS, AND WHY
 *
 * An indeterminate probe (a timeout, a network blip — anything that is not a
 * definite "no such column") resolves to `unavailable` for that attempt and is
 * NOT memoized, so the next read probes again. That direction is deliberate:
 *
 *   * failing to `unavailable` means an expired placement may stay visible
 *     until the next successful probe — we give away a little placement, and
 *     it corrects itself;
 *   * failing to `ready` would put a non-existent column into every query and
 *     take the entire public Directory down.
 *
 * The first is a bounded commercial cost. The second is an outage. The
 * limitation is stated in docs/operations/revenue-2-featured-expiry.md rather
 * than hidden here.
 */
export type EntryContext = { schema: FeaturedSchema; now: Date };

const FEATURED_COLUMN = 'featured_until';

/**
 * Is this error specifically "that column does not exist"?
 *
 * Deliberately narrow. `42703` is the PostgreSQL undefined-column SQLSTATE and
 * `PGRST204` is PostgREST's schema-cache miss; the message check additionally
 * requires the column to be named, so an undefined-column error about some
 * OTHER column is not silently read as "057 is unapplied". Every other failure
 * keeps the existing honest empty-vs-error handling.
 */
function isMissingFeaturedColumn(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown } | null;
  const code = typeof e?.code === 'string' ? e.code : '';
  const message = typeof e?.message === 'string' ? e.message : '';
  if (code !== '42703' && code !== 'PGRST204') return false;
  return message.includes(FEATURED_COLUMN);
}

let featuredSchemaMemo: Promise<FeaturedSchema> | null = null;

/** Test seam: forget the probe so a fixture can change the answer. */
export function __resetFeaturedSchemaMemo(): void {
  featuredSchemaMemo = null;
}

async function probeFeaturedSchema(): Promise<FeaturedSchema> {
  const supabase = createStaticClient();
  const { error } = await supabase.from('locations').select(FEATURED_COLUMN).limit(1);
  if (!error) return 'ready';
  if (isMissingFeaturedColumn(error)) return 'unavailable';
  // Indeterminate. Throw so the caller declines to memoize and re-probes.
  throw error;
}

export async function featuredSchema(): Promise<FeaturedSchema> {
  if (featuredSchemaMemo) return featuredSchemaMemo;
  const attempt = probeFeaturedSchema();
  // Memoize only a DEFINITE answer. An indeterminate probe must not pin the
  // process to a guess for its whole lifetime.
  featuredSchemaMemo = attempt.catch(() => {
    featuredSchemaMemo = null;
    return 'unavailable' as const;
  });
  return featuredSchemaMemo;
}

/** The projection for the current schema state. */
function columnsFor(schema: FeaturedSchema): string {
  return schema === 'ready' ? `${BASE_COLUMNS}, ${FEATURED_COLUMN}` : BASE_COLUMNS;
}

/**
 * One clock and one schema answer per read, so every row in a page is judged
 * against the same instant rather than each against its own.
 */
async function entryContext(): Promise<EntryContext> {
  return { schema: await featuredSchema(), now: new Date() };
}

/* ------------------------------------------------- read result contract */

/**
 * Empty vs. error (2026-07-30). Every read here used to collapse a failed
 * query into `[]`, making "this exit has no listings" and "the database did
 * not answer" the same value. A page that turns `[]` into `notFound()` then
 * manufactures a 404 out of an infrastructure blip — and on an ISR route that
 * 404 is cached, so a transient failure becomes a durable lie.
 * `/directory/i75/exit-369` served a 404 for hours while 11 published rows sat
 * in the table, which is what prompted this contract. Note the contract did
 * NOT resolve that page: it shipped and the 404 persisted. Exit 369 remains an
 * open defect with an unidentified cause; this is a class of bug it rules out,
 * not a diagnosis of that one.
 *
 * The `*Result` functions below are the single implementation of each query
 * and report which of the three outcomes happened. The original fail-soft
 * functions still exist and still return `[]`, delegating to these — so every
 * caller that legitimately wants "render nothing rather than explode" is
 * unchanged. Only callers that decide 404 vs. 500 need the strict variant.
 */
/**
 * `query_error` / `unavailable` describe a read that failed outright.
 * `short_pool` / `no_progress` / `page_cap` describe a read that returned
 * data but could NOT be proven complete — the caller must treat them exactly
 * as harshly, because a partial set presented as whole is the defect this
 * layer exists to prevent.
 */
export type DirectoryReadFailure =
  | 'query_error'
  | 'unavailable'
  | 'short_pool'
  | 'no_progress'
  | 'page_cap';

export type DirectoryReadResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: DirectoryReadFailure; code?: string };

/** Thrown by pages when a read fails, so Next serves the normal error page. */
export class DirectoryUnavailableError extends Error {
  readonly operation: string;
  constructor(operation: string) {
    super(`Directory read failed: ${operation}`);
    this.name = 'DirectoryUnavailableError';
    this.operation = operation;
  }
}

/**
 * A Postgres SQLSTATE (e.g. "57014" statement_timeout) is short, fixed-shape
 * and diagnostic — it carries no credentials, no environment values, no query
 * text and no row data. Only that code is ever surfaced; the driver's message
 * and details are deliberately dropped.
 */
export function failureCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code.length <= 12 ? code : undefined;
}

/**
 * Log a read failure and throw. Returns `never`, so a caller that guards on
 * failure narrows correctly afterwards. Safe fields only: what we were doing,
 * where, and which failure class — never keys, env values, query text, driver
 * messages or row contents.
 */
export function throwDirectoryUnavailable(
  operation: string,
  route: string,
  failure: { reason: DirectoryReadFailure; code?: string },
): never {
  log.error('directory_read_failed', {
    operation,
    route,
    reason: failure.reason,
    code: failure.code,
  });
  throw new DirectoryUnavailableError(operation);
}

/**
 * Turn a read result into data, or log and throw. Shared so every 404-gating
 * page fails the same way and logs the same safe fields.
 */
export function unwrapDirectoryRead<T>(
  result: DirectoryReadResult<T>,
  operation: string,
  route: string,
): T {
  if (result.ok) return result.data;
  return throwDirectoryUnavailable(operation, route, result);
}

/* --------------------------------------------- complete-read pagination */

/**
 * Completeness (2026-07-30, corrected 2026-07-31). Several directory reads
 * asked for a fixed `.limit(...)` with NO deterministic ordering and then
 * treated the answer as the whole dataset. A LIMIT without an ORDER BY lets
 * Postgres return ANY subset, so such a read is silently a *sample*.
 *
 * Measured against 2,454 published rows, only ONE of these caps is binding
 * today — and the distinction matters, so it is recorded honestly:
 *
 *   - selectEntries `.limit(1000)` IS truncating right now. The truck-stops
 *     category holds 1,882 published rows (882 dropped) and the unfiltered
 *     sitemap read covers 2,454, of which 2,439 pass the indexability gate
 *     (~1,439 detail URLs missing from the sitemap).
 *   - getDirectoryFacets `.limit(5000)`, the map `.limit(2000)` and the
 *     detail-slug read were NOT binding at this row count. They are latent:
 *     unordered, so the day the set crosses the cap the loss is arbitrary and
 *     silent. They are fixed here for that reason — NOT because they explain
 *     the /directory/i75/exit-369 incident. The facet cap does not fit the
 *     numbers, and no replacement theory is asserted here either: the
 *     empty-vs-error contract below shipped and the 404 persisted, so THE
 *     CAUSE IS STILL UNIDENTIFIED. Nothing in this file should be read as
 *     fixing it.
 *
 * A truncated read is not an error and not an empty result, so the empty-vs-
 * error contract above cannot see it. The fix is to stop capping: page the
 * whole set with a deterministic keyset cursor on the primary key, exactly as
 * the Trip Planner candidate pool does.
 *
 * Presentation limits (a "top 20" list, a paged UI) are NOT this — they are
 * deliberate and stay.
 */
export const DIRECTORY_PAGE_SIZE = 500;

/**
 * Runaway guard, not a capacity limit: 60 x 500 = 30,000 rows, an order of
 * magnitude beyond the directory. Exhausting it is a FAILURE, never a quiet
 * stop, so it cannot become the next silent ceiling.
 */
export const DIRECTORY_MAX_PAGES = 60;

/**
 * One page of a keyset scan: rows with id > afterId, ordered by id ascending.
 *
 * `total` is the exact number of rows matching the filters, computed by the
 * DATABASE over the whole filtered set and returned alongside the first page
 * (PostgREST `count=exact`, delivered in Content-Range). It is not derived
 * from the rows in the response, so it remains an independent measurement —
 * it simply no longer costs its own round trip.
 */
type PageFetcher<R> = (
  afterId: string | null,
  pageSize: number,
) => Promise<{ rows: R[]; error?: unknown; total?: number }>;

/**
 * Walk every page of a result set. Returns a failure rather than a partial
 * list — a truncated set that looks complete is the whole point of this
 * helper.
 *
 * TERMINAL CONDITION, deliberately never `batch.length < pageSize` on its own.
 * A backend that caps rows server-side returns a short page while more data
 * exists, so "short page" is evidence of nothing. A scan therefore ends in
 * exactly one of two ways:
 *
 *   1. a request positioned AFTER the last row seen comes back EMPTY — a
 *      statement about the data, not about the size of a response; or
 *   2. a short page CORROBORATED by the independent exact count: we hold at
 *      least `expected` distinct rows in strict key order.
 *
 * (2) is not the inference (1) exists to reject. It requires a count computed
 * by the database over the entire filtered set — never derived from the rows
 * in hand — and a server-side cap can never satisfy it: capped pages stay
 * short while the row total never reaches the count, so the scan continues to
 * (1) or fails. With no count available, (2) cannot fire and (1) is the only
 * exit.
 *
 * WHERE THE COUNT COMES FROM. Preferably from the FIRST PAGE ITSELF: asking
 * PostgREST for `count=exact` returns the full filtered total in the response
 * alongside the page. That has two consequences worth stating plainly:
 *
 *   - count/page filter parity stops being something to audit and assert. It
 *     is ONE query, so the count cannot drift from the page it validates.
 *   - it costs no extra round trip. A separate head-count query is a second
 *     request per read, and a build performs ~1,400 of them.
 *
 * `expected` remains as a fallback for callers (and tests) that supply a
 * separately measured count; a total reported by the first page wins.
 *
 * Either way it is a FLOOR on the way out: rows published during the scan
 * legitimately push the total above it, but a total below it means the scan
 * lost rows and the result is refused.
 */
export async function collectAllRows<R extends { id: string }>(
  fetchPage: PageFetcher<R>,
  expected: number | null | PromiseLike<number | null>,
  opts: { pageSize?: number; maxPages?: number } = {},
): Promise<DirectoryReadResult<R[]>> {
  const pageSize = Math.max(1, opts.pageSize ?? DIRECTORY_PAGE_SIZE);
  const maxPages = Math.max(1, opts.maxPages ?? DIRECTORY_MAX_PAGES);
  const rows: R[] = [];
  let afterId: string | null = null;
  let pages = 0;

  // Resolved at most once, and only when a decision needs it. A total the
  // first page reported wins over the `expected` fallback: it is the same
  // database COUNT, over the same filters, in the same query.
  let reported: number | null = null;
  let settled: number | null | undefined;
  const expectedCount = async (): Promise<number | null> => {
    if (reported !== null) return reported;
    if (settled === undefined) settled = await expected;
    return settled;
  };

  while (pages < maxPages) {
    const page = await fetchPage(afterId, pageSize);
    pages++;
    if (page.error) return { ok: false, reason: 'query_error', code: failureCode(page.error) };
    if (pages === 1 && typeof page.total === 'number') reported = page.total;

    const batch = page.rows ?? [];

    if (batch.length === 0) {
      // The ONLY way this scan completes without corroboration: a request
      // after the last row we saw returned nothing. Verified emptiness, not
      // an inferred boundary.
      const floor = await expectedCount();
      if (floor !== null && rows.length < floor) {
        return { ok: false, reason: 'short_pool' };
      }
      return { ok: true, data: rows };
    }

    const lastId = batch[batch.length - 1]?.id ?? null;
    // Defensive: a fetcher ignoring the cursor would loop forever and
    // duplicate every row. Refuse to advance rather than spin.
    if (lastId === null || lastId === afterId) return { ok: false, reason: 'no_progress' };

    rows.push(...batch);
    afterId = lastId;

    // CORROBORATED STOP. A short batch alone still ends nothing — that is the
    // whole point of the terminal condition above. But a short batch TOGETHER
    // WITH the independent exact count is proof, not inference: we have paged
    // at least as many distinct rows, in strict key order, as a separate query
    // measured under the identical filters. A server-side row cap cannot fake
    // this — capped pages stay short while `rows.length` never reaches
    // `expected`, so the scan keeps going and ends on a verified empty page or
    // fails `short_pool`. When no count is available this cannot fire at all
    // and the strict empty-page rule is the only way out.
    //
    // Worth one confirming request each? No: this fires once per scan, and the
    // build performs ~1,700 scans, most of them a single short page (an exit
    // holds a handful of rows). That confirming round trip was pure cost.
    if (batch.length < pageSize) {
      const floor = await expectedCount();
      if (floor !== null && rows.length >= floor) return { ok: true, data: rows };
    }
  }

  return { ok: false, reason: 'page_cap' };
}

/* ------------------------------------------------- build-phase memoization */

/**
 * Reading the COMPLETE set costs more round trips than reading a capped
 * sample, and static generation renders ~1,300 directory pages that each ask
 * for the same facet data. Measured cost of that amplification: preview build
 * time went from ~130-150s to 306s.
 *
 * This memo collapses identical complete reads within ONE build. It is gated
 * on NEXT_PHASE === 'phase-production-build', which Next 14 assigns in exactly
 * one place — next/dist/build/index.js, the build command. Nothing in the
 * server start path assigns it (next-server.js only READS it to detect that it
 * is running inside a build). So this cache:
 *
 *   - is active only while `next build` runs, in that process
 *   - is completely inert at runtime, so ISR, `revalidate = 300` and the
 *     admin's revalidatePath() behave exactly as before — a newly published
 *     location appears on precisely the same schedule as today
 *   - holds no state across builds or across requests
 *
 * It memoizes the PROMISE so concurrent renderers share one in-flight scan,
 * and evicts on failure so one transient blip cannot poison a whole build.
 */
const BUILD_PHASE = 'phase-production-build';

const buildReadMemo = new Map<string, Promise<unknown>>();

/**
 * Read-amplification counters. Two in-process integers, never logged and never
 * emitted — the harness reads them to measure how many complete reads a build
 * *asks for* versus how many actually hit the database, so measuring the memo
 * does not require shipping build-time logging.
 */
let buildReadCalls = 0;
let buildReadScans = 0;

/** Test seam: lets the harness prove build-phase vs runtime behavior. */
export function __resetBuildReadMemo(): void {
  buildReadMemo.clear();
  buildReadCalls = 0;
  buildReadScans = 0;
}
export function __buildReadMemoSize(): number {
  return buildReadMemo.size;
}
export function __buildReadStats(): { calls: number; scans: number } {
  return { calls: buildReadCalls, scans: buildReadScans };
}
/** Test seam: drives the real memo with a counted stand-in for a live read. */
export function __memoizeDuringBuildForTest<T>(key: string, run: () => Promise<T>): Promise<T> {
  return memoizeDuringBuild(key, run);
}
export function isDirectoryBuildPhase(): boolean {
  return process.env.NEXT_PHASE === BUILD_PHASE;
}

function memoizeDuringBuild<T>(key: string, run: () => Promise<T>): Promise<T> {
  buildReadCalls++;
  if (!isDirectoryBuildPhase()) {
    buildReadScans++;
    return run();
  }
  const hit = buildReadMemo.get(key) as Promise<T> | undefined;
  if (hit) return hit;
  buildReadScans++;
  const pending = run().then(
    (value) => {
      // Never memoize a failed read for the rest of the build.
      if ((value as { ok?: boolean } | null)?.ok === false) buildReadMemo.delete(key);
      return value;
    },
    (error) => {
      buildReadMemo.delete(key);
      throw error;
    },
  );
  buildReadMemo.set(key, pending);
  return pending;
}

/**
 * Stable memo key from a filter object — order-independent. Only ABSENT
 * values (undefined/null) are dropped: an empty string is still a filter the
 * query applies (`.eq(col, '')` matches nothing `.eq`-less would match), so
 * folding it into the unfiltered key would let two different queries share
 * one memo slot. Values are encoded so a value containing '&' or '=' cannot
 * masquerade as extra key/value pairs.
 */
function memoKey(scope: string, filters: Record<string, unknown> = {}): string {
  const parts = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .sort();
  return parts.length ? `${scope}?${parts.join('&')}` : scope;
}

/* ------------------------------------------------------------ entry reads */

/**
 * Shared query base: published, not deleted, capped, featured-then-name order.
 * Filters, ordering and the cap are byte-for-byte what they were — this
 * function reports failure instead of hiding it, and returns no extra rows.
 */
async function selectEntriesResult(
  filters: Record<string, string>,
): Promise<DirectoryReadResult<DirectoryEntry[]>> {
  return memoizeDuringBuild(memoKey('entries', filters), () => selectEntriesUncached(filters));
}

/**
 * COUNT/PAGE FILTER PARITY, structurally: the exact count is requested ON the
 * first page query, so there is no second query whose filters could drift
 * from this one. `count=exact` is only asked for when no cursor is applied —
 * with a cursor it would count the remainder, not the set.
 */
async function selectEntriesUncached(
  filters: Record<string, string>,
): Promise<DirectoryReadResult<DirectoryEntry[]>> {
  try {
    const ctx = await entryContext();
    const supabase = createStaticClient();

    // Interstate/exit filters match CANONICALLY, exactly like the facet
    // builder that decides which corridor and exit pages exist. An exact
    // `.eq` here while facets trim/canonicalize is how a cosmetically dirty
    // row ("369 ", "i-75") once made facets/sitemap advertise an exit whose
    // page query then found nothing — a false 404 (/directory/i75/exit-369).
    // The database cannot canonicalize inside a PostgREST filter, so the
    // server narrows to a small superset (digits of the corridor) and the
    // canonical comparison happens here, on the same values facets saw.
    const canonicalHwy = filters.interstate ? canonicalDesignation(filters.interstate) : null;
    const canonicalExit = filters.exit_number ? canonicalExitNumber(filters.exit_number) : null;
    const serverFilters = Object.entries(filters).filter(
      ([column]) =>
        !(column === 'interstate' && canonicalHwy) && !(column === 'exit_number' && canonicalExit),
    );

    const result = await collectAllRows<LocationRow>(async (afterId, pageSize) => {
      let q = supabase
        .from('locations')
        .select(columnsFor(ctx.schema), afterId === null ? { count: 'exact' } : undefined)
        .eq('is_published', true)
        .is('deleted_at', null);
      for (const [column, value] of serverFilters) q = q.eq(column, value);
      if (canonicalHwy) {
        // Superset by corridor number: catches "I-75", " i-75", "I 75"…
        // (also I-175/I-275, removed canonically below). Bounded like every
        // directory read by the shared pagination cap.
        q = q.ilike('interstate', `%${canonicalHwy.slice(2)}%`);
      }
      if (afterId !== null) q = q.gt('id', afterId);
      const { data, error, count } = await q.order('id', { ascending: true }).limit(pageSize);
      if (error) return { rows: [], error };
      return {
        rows: (data ?? []) as unknown as LocationRow[],
        total: typeof count === 'number' ? count : undefined,
      };
    }, null);
    if (!result.ok) return result;
    const rows =
      canonicalHwy || canonicalExit
        ? result.data.filter(
            (row) =>
              (!canonicalHwy || canonicalDesignation(row.interstate) === canonicalHwy) &&
              (!canonicalExit || canonicalExitNumber(row.exit_number) === canonicalExit),
          )
        : result.data;

    // Paging order is by id (unique, stable). The PRESENTATION order is
    // restored here — the same featured-then-name order the old query asked
    // the database for, now applied to the COMPLETE set instead of to an
    // arbitrary first 1,000 rows.
    const entries = rows.map((r) => toEntry(r, ctx));
    entries.sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));
    return { ok: true, data: entries };
  } catch (error) {
    return { ok: false, reason: 'unavailable', code: failureCode(error) };
  }
}

/** Fail-soft view of the same query, for callers that only render. */
async function selectEntries(filters: Record<string, string>): Promise<DirectoryEntry[]> {
  const result = await selectEntriesResult(filters);
  return result.ok ? result.data : [];
}

export function getEntries(categorySlug: string): Promise<DirectoryEntry[]> {
  return selectEntries({ category_slug: categorySlug });
}

/** Every published listing — sitemap + completeness checks (capped like all reads). */
export function getAllPublishedEntries(): Promise<DirectoryEntry[]> {
  return selectEntries({});
}

/** All published listings in a state (two-letter code), for state pages. */
export function getEntriesByState(stateCode: string): Promise<DirectoryEntry[]> {
  return selectEntries({ state: stateCode.toUpperCase() });
}

/** All published listings on an interstate ("I-75"), for corridor pages. */
export function getEntriesByInterstate(designation: string): Promise<DirectoryEntry[]> {
  return selectEntries({ interstate: designation });
}

/** Published listings at one interstate exit, for exit pages. */
export function getEntriesByExit(
  designation: string,
  exitNumber: string,
): Promise<DirectoryEntry[]> {
  return selectEntries({ interstate: designation, exit_number: exitNumber });
}

/* Strict variants — identical queries, failure reported rather than hidden. */

export function getEntriesResult(
  categorySlug: string,
): Promise<DirectoryReadResult<DirectoryEntry[]>> {
  return selectEntriesResult({ category_slug: categorySlug });
}

export function getEntriesByStateResult(
  stateCode: string,
): Promise<DirectoryReadResult<DirectoryEntry[]>> {
  return selectEntriesResult({ state: stateCode.toUpperCase() });
}

export function getEntriesByInterstateResult(
  designation: string,
): Promise<DirectoryReadResult<DirectoryEntry[]>> {
  return selectEntriesResult({ interstate: designation });
}

export function getEntriesByExitResult(
  designation: string,
  exitNumber: string,
): Promise<DirectoryReadResult<DirectoryEntry[]>> {
  return selectEntriesResult({ interstate: designation, exit_number: exitNumber });
}

/**
 * Hard cap on one card lookup (DIR-PAYLOAD-1). Two "Load more" pages worth.
 * The endpoint rejects a longer list rather than truncating it — a truncated
 * answer to "give me these ids" is the same class of quiet lie this codebase
 * spent two milestones removing from the read layer.
 */
export const CARD_LOOKUP_MAX_IDS = 60;

/**
 * Published listings BY ID, for the browse index's card window.
 *
 * The category pages ship a compact index of every listing and fetch card
 * fields only for the rows about to be rendered. This is that read. It is a
 * lookup, not a search: it takes ids the page already holds and answers with
 * rows, so there is no query text, no ordering to get wrong, and nothing for
 * a caller to page through.
 *
 * Eligibility is re-checked HERE rather than trusted from the caller. A
 * client can ask for any id it likes; `is_published` / `deleted_at` and the
 * anon client's RLS decide what comes back, so an id that was unpublished
 * since the page was generated simply is not in the answer.
 *
 * Returns a Result: a failed lookup must not read as "those listings do not
 * exist". Ids not present in the answer were not eligible.
 */
export async function getEntriesByIdsResult(
  ids: string[],
): Promise<DirectoryReadResult<DirectoryEntry[]>> {
  const wanted = [...new Set(ids)].slice(0, CARD_LOOKUP_MAX_IDS);
  if (wanted.length === 0) return { ok: true, data: [] };
  try {
    const ctx = await entryContext();
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from('locations')
      .select(columnsFor(ctx.schema))
      .eq('is_published', true)
      .is('deleted_at', null)
      .in('id', wanted);
    if (error) return { ok: false, reason: 'query_error', code: failureCode(error) };
    if (!data) return { ok: false, reason: 'query_error' };
    return { ok: true, data: (data as unknown as LocationRow[]).map((r) => toEntry(r, ctx)) };
  } catch (error) {
    return { ok: false, reason: 'unavailable', code: failureCode(error) };
  }
}

/**
 * Published listings ordered by most-recently-updated (Milestone 25). Only rows
 * with a real updated_at are returned, so "recently updated" never implies a
 * change that didn't happen. Fails soft to [].
 */
export async function getRecentlyUpdated(limit = 50): Promise<DirectoryEntry[]> {
  try {
    const ctx = await entryContext();
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from('locations')
      .select(columnsFor(ctx.schema))
      .eq('is_published', true)
      .is('deleted_at', null)
      .not('updated_at', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 200));
    if (error || !data) return [];
    return (data as unknown as LocationRow[]).map((r) => toEntry(r, ctx));
  } catch {
    return [];
  }
}

/**
 * Published listings ordered newest-first by creation date (Milestone 25), with
 * a bounded window for pagination. Rows without a created_at sort last. Fails
 * soft to [].
 */
export async function getNewestListings(limit = 24, offset = 0): Promise<DirectoryEntry[]> {
  try {
    const ctx = await entryContext();
    const supabase = createStaticClient();
    const from = Math.max(offset, 0);
    const to = from + Math.min(Math.max(limit, 1), 100) - 1;
    const { data, error } = await supabase
      .from('locations')
      .select(columnsFor(ctx.schema))
      .eq('is_published', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false, nullsFirst: false })
      .range(from, to);
    if (error || !data) return [];
    return (data as unknown as LocationRow[]).map((r) => toEntry(r, ctx));
  } catch {
    return [];
  }
}

/**
 * Published listings that carry coordinates — the map/near-me data source
 * (Milestone 17). Optional exact-match filters mirror selectEntries. Fails
 * soft to [] like every other public read.
 */
export async function getEntriesWithCoordinates(
  filters: { category?: string; state?: string; interstate?: string } = {},
): Promise<DirectoryEntry[]> {
  // The memoized layer carries the Result SHAPE even though callers are
  // fail-soft: memoizeDuringBuild's eviction fires on `ok === false`, so a
  // failed scan must still LOOK failed when the memo inspects it. Swallowing
  // the failure into [] inside the memoized function would cache one
  // transient blip as an empty map for the entire build (the exact defect
  // the eviction exists to prevent). Fail-soft happens HERE, outside.
  const result = await memoizeDuringBuild(memoKey('coords', filters), () =>
    getEntriesWithCoordinatesUncached(filters),
  );
  return result.ok ? result.data : [];
}

async function getEntriesWithCoordinatesUncached(
  filters: { category?: string; state?: string; interstate?: string } = {},
): Promise<DirectoryReadResult<DirectoryEntry[]>> {
  try {
    const ctx = await entryContext();
    const supabase = createStaticClient();
    // COUNT/PAGE FILTER PARITY, structurally: one query carries both the page
    // and the exact count, so eligibility — published, not deleted, lat AND
    // lng present, plus the same optional category / state / interstate
    // filters — cannot differ between them.
    // Same canonical-corridor matching as selectEntriesUncached, so the map
    // and the corridor pages agree about which rows belong to "I-75".
    const canonicalHwy = filters.interstate ? canonicalDesignation(filters.interstate) : null;
    const scan = await collectAllRows<LocationRow>(async (afterId, pageSize) => {
      let q = supabase
        .from('locations')
        .select(columnsFor(ctx.schema), afterId === null ? { count: 'exact' } : undefined)
        .eq('is_published', true)
        .is('deleted_at', null)
        .not('lat', 'is', null)
        .not('lng', 'is', null);
      if (filters.category) q = q.eq('category_slug', filters.category);
      if (filters.state) q = q.eq('state', filters.state.toUpperCase());
      if (filters.interstate) {
        q = canonicalHwy
          ? q.ilike('interstate', `%${canonicalHwy.slice(2)}%`)
          : q.eq('interstate', filters.interstate);
      }
      if (afterId !== null) q = q.gt('id', afterId);
      const { data, error, count } = await q.order('id', { ascending: true }).limit(pageSize);
      if (error) return { rows: [], error };
      return {
        rows: (data ?? []) as unknown as LocationRow[],
        total: typeof count === 'number' ? count : undefined,
      };
    }, null);
    if (!scan.ok) return scan;
    const rows = canonicalHwy
      ? scan.data.filter((row) => canonicalDesignation(row.interstate) === canonicalHwy)
      : scan.data;
    // Presentation order restored over the COMPLETE set (was .limit(2000)
    // against 1,940 published geocoded rows - 60 rows of headroom).
    return {
      ok: true,
      data: rows.map((r) => toEntry(r, ctx)).sort((a, b) => a.name.localeCompare(b.name)),
    };
  } catch (error) {
    return { ok: false, reason: 'unavailable', code: failureCode(error) };
  }
}

/**
 * Resolve one published listing by its public detail slug (Milestone 20).
 * Anon client + explicit published/non-deleted filters (RLS enforces the same
 * boundary), so unpublished, soft-deleted, and unknown slugs all resolve to a
 * SUCCESSFUL null — the detail route turns that, and only that, into a 404.
 *
 * EMPTY VS. ERROR, on the largest 404-gating surface there is (2026-08-20).
 * This read used to collapse a failed query into the same `null` an unknown
 * slug produces, and `/directory/location/[slug]` turned `null` into
 * `notFound()`. That is the exact defect the contract above was written for
 * after `/directory/i75/exit-369` served a cached 404 over 11 published rows;
 * #215 fixed the exit page and the 2026-08-04 audit recorded this one as a
 * surviving instance of the same class. It is the bigger surface: every
 * published listing has a detail page (2,454 of them, all in the sitemap),
 * the route is ISR at `revalidate = 300`, and the anon role carries a 3 s
 * `statement_timeout` — so one slow regeneration bakes a 404 over a real,
 * indexed page and serves it until something purges it.
 *
 * `getEntryByDetailSlugResult` is the single implementation and reports which
 * of the three outcomes happened. The fail-soft wrapper below still returns
 * `null` for both "no such listing" and "the read failed", so callers that
 * legitimately want "render nothing rather than explode" are unchanged.
 */
export async function getEntryByDetailSlugResult(
  detailSlug: string,
): Promise<DirectoryReadResult<DirectoryEntry | null>> {
  try {
    const ctx = await entryContext();
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from('locations')
      .select(columnsFor(ctx.schema))
      .eq('is_published', true)
      .is('deleted_at', null)
      .eq('detail_slug', detailSlug)
      .limit(1)
      .maybeSingle();
    if (error) return { ok: false, reason: 'query_error', code: failureCode(error) };
    // The read SUCCEEDED and matched nothing: no such published listing.
    if (!data) return { ok: true, data: null };
    return { ok: true, data: toEntry(data as unknown as LocationRow, ctx) };
  } catch (error) {
    return { ok: false, reason: 'unavailable', code: failureCode(error) };
  }
}

/**
 * Fail-soft variant: `null` for a missing listing AND for a failed read. Only
 * safe where the answer does not decide a response status (the sitemap gate
 * asks "is this one indexable?", and a failed read simply omits the URL).
 */
export async function getEntryByDetailSlug(detailSlug: string): Promise<DirectoryEntry | null> {
  const result = await getEntryByDetailSlugResult(detailSlug);
  return result.ok ? result.data : null;
}

export type DetailSlugRef = {
  detailSlug: string;
  updatedAt?: string;
};

/**
 * Every published listing's detail slug — drives generateStaticParams and the
 * sitemap without pulling full rows. Fails soft to [].
 */
export async function getPublishedDetailSlugs(): Promise<DetailSlugRef[]> {
  // Result shape through the memo, fail-soft outside — see the coords read
  // above for why (memo eviction must be able to SEE a failed scan).
  const result = await memoizeDuringBuild(memoKey('detail-slugs'), getPublishedDetailSlugsUncached);
  return result.ok ? result.data : [];
}

async function getPublishedDetailSlugsUncached(): Promise<DirectoryReadResult<DetailSlugRef[]>> {
  try {
    const supabase = createStaticClient();
    // COUNT/PAGE FILTER PARITY, structurally: published, not deleted,
    // detail_slug present — one query carries both the page and the count.
    const scan = await collectAllRows<{
      id: string;
      detail_slug: string;
      updated_at: string | null;
    }>(async (afterId, pageSize) => {
      let q = supabase
        .from('locations')
        .select('id, detail_slug, updated_at', afterId === null ? { count: 'exact' } : undefined)
        .eq('is_published', true)
        .is('deleted_at', null)
        .not('detail_slug', 'is', null);
      if (afterId !== null) q = q.gt('id', afterId);
      const { data, error, count } = await q.order('id', { ascending: true }).limit(pageSize);
      if (error) return { rows: [], error };
      return {
        rows: (data ?? []) as unknown as {
          id: string;
          detail_slug: string;
          updated_at: string | null;
        }[],
        total: typeof count === 'number' ? count : undefined,
      };
    }, null);
    if (!scan.ok) return scan;
    return {
      ok: true,
      data: (scan.data as unknown as { detail_slug: string; updated_at: string | null }[]).map(
        (r) => ({
          detailSlug: r.detail_slug,
          updatedAt: r.updated_at ?? undefined,
        }),
      ),
    };
  } catch (error) {
    return { ok: false, reason: 'unavailable', code: failureCode(error) };
  }
}

export type DirectoryFacets = {
  /** Two-letter codes of states that have at least one published listing. */
  states: string[];
  /** Interstate designations ("I-75") with at least one published listing. */
  interstates: string[];
  /** exit_number values per interstate that have at least one published listing. */
  exitsByInterstate: Record<string, string[]>;
  /** Published-listing counts per state code. */
  countsByState: Record<string, number>;
  /** Published-listing counts per interstate designation. */
  countsByInterstate: Record<string, number>;
};

const EMPTY_FACETS: DirectoryFacets = {
  states: [],
  interstates: [],
  exitsByInterstate: {},
  countsByState: {},
  countsByInterstate: {},
};

/**
 * Distinct states / interstates / exits present among published listings —
 * drives generateStaticParams, the sitemap, and the hub's browse blocks, so
 * new states and corridors appear everywhere the moment their data lands.
 * Fails soft to empty facets (pages then render on demand instead).
 *
 * Kept fail-soft ON PURPOSE for generateStaticParams and the sitemap: a build
 * that cannot reach the database should prerender nothing and let pages render
 * on demand, not fail the build. Callers that decide 404 vs. 500 use
 * getDirectoryFacetsResult() instead.
 */
export async function getDirectoryFacets(): Promise<DirectoryFacets> {
  const result = await getDirectoryFacetsResult();
  return result.ok ? result.data : EMPTY_FACETS;
}

/** Same query as getDirectoryFacets, reporting failure instead of hiding it. */
export async function getDirectoryFacetsResult(): Promise<DirectoryReadResult<DirectoryFacets>> {
  return memoizeDuringBuild(memoKey('facets'), getDirectoryFacetsUncached);
}

/** COUNT/PAGE FILTER PARITY, structurally: is_published + deleted_at, one query. */
async function getDirectoryFacetsUncached(): Promise<DirectoryReadResult<DirectoryFacets>> {
  try {
    const supabase = createStaticClient();
    const scan = await collectAllRows<{
      id: string;
      state: string;
      interstate: string | null;
      exit_number: string | null;
    }>(async (afterId, pageSize) => {
      let q = supabase
        .from('locations')
        .select(
          'id, state, interstate, exit_number',
          afterId === null ? { count: 'exact' } : undefined,
        )
        .eq('is_published', true)
        .is('deleted_at', null);
      if (afterId !== null) q = q.gt('id', afterId);
      const { data, error, count } = await q.order('id', { ascending: true }).limit(pageSize);
      if (error) return { rows: [], error };
      return {
        rows: (data ?? []) as unknown as {
          id: string;
          state: string;
          interstate: string | null;
          exit_number: string | null;
        }[],
        total: typeof count === 'number' ? count : undefined,
      };
    }, null);
    if (!scan.ok) return scan;
    const rows = scan.data as unknown as {
      state: string;
      interstate: string | null;
      exit_number: string | null;
    }[];
    const states = new Map<string, number>();
    const interstates = new Map<string, number>();
    const exits = new Map<string, Set<string>>();
    for (const r of rows) {
      const state = r.state?.trim().toUpperCase();
      if (state) states.set(state, (states.get(state) ?? 0) + 1);
      // Interstates bucket under the SAME canonical spelling the entry
      // queries match on ("i-75" and "I-75" are one corridor, one facet key,
      // one sitemap URL set); non-interstate designations keep their trimmed
      // stored value as before. Exits canonicalize the same way, so a facet
      // can never advertise an exit page whose entry lookup sees zero rows.
      const hwy = canonicalDesignation(r.interstate) ?? r.interstate?.trim();
      if (hwy) {
        interstates.set(hwy, (interstates.get(hwy) ?? 0) + 1);
        const exit = canonicalExitNumber(r.exit_number);
        if (exit) {
          if (!exits.has(hwy)) exits.set(hwy, new Set());
          exits.get(hwy)!.add(exit);
        }
      }
    }
    return {
      ok: true,
      data: {
        states: [...states.keys()].sort(),
        interstates: [...interstates.keys()].sort(),
        exitsByInterstate: Object.fromEntries(
          [...exits.entries()].map(([hwy, set]) => [
            hwy,
            [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
          ]),
        ),
        countsByState: Object.fromEntries(states),
        countsByInterstate: Object.fromEntries(interstates),
      },
    };
  } catch (error) {
    return { ok: false, reason: 'unavailable', code: failureCode(error) };
  }
}

/** Distinct two-letter states present in a set of entries, sorted. */
export function statesIn(entries: DirectoryEntry[]): string[] {
  return [...new Set(entries.map((e) => e.state))].sort();
}

/* ------------------------------------------------------------------------
 * Parking corridor flow (driver-first navigation, 2026-07-28):
 * Parking → State → Interstate → Direction → ordered list.
 * ---------------------------------------------------------------------- */

/** Parking-capable categories (mirrors corridor.ts PARKING_CATEGORIES). */
const PARKING_FLOW_CATEGORIES = ['parking', 'truck-stops', 'rest-areas', 'hotels-truck-parking'];

/**
 * Published listings from the given categories on one interstate in one
 * state — the generic corridor-list data source (parking flow, CAT Scale
 * browse-route flow). Published-only by query AND by RLS. Fails soft to [].
 */
export async function getCorridorEntriesForCategories(
  categories: string[],
  stateCode: string,
  interstate: string,
): Promise<DirectoryEntry[]> {
  try {
    const ctx = await entryContext();
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from('locations')
      .select(columnsFor(ctx.schema))
      .eq('is_published', true)
      .is('deleted_at', null)
      .eq('state', stateCode.toUpperCase())
      .eq('interstate', interstate)
      .in('category_slug', categories)
      .order('name', { ascending: true })
      .limit(1000);
    if (error || !data) return [];
    return (data as unknown as LocationRow[]).map((r) => toEntry(r, ctx));
  } catch {
    return [];
  }
}

/**
 * Published parking-capable listings on one interstate in one state — the
 * corridor list's data source. Fails soft to [].
 */
export async function getParkingCorridorEntries(
  stateCode: string,
  interstate: string,
): Promise<DirectoryEntry[]> {
  return getCorridorEntriesForCategories(PARKING_FLOW_CATEGORIES, stateCode, interstate);
}

/** Row shape for the parking / CAT Scale route facet scan. */
type RouteFacetRow = {
  id: string;
  state: string;
  interstate: string | null;
  category_slug: string | null;
};

export type ParkingFacets = {
  /** State codes with ≥1 published listing in scope, with counts. */
  states: { code: string; count: number }[];
  /** Interstates per state (designation + listing count), corridor-worthy only. */
  interstatesByState: Record<string, { designation: string; count: number }[]>;
};

/**
 * States and per-state interstates that actually have published listings in
 * the given categories — drives State and Interstate picker pages so a step
 * never dead-ends. Fails soft to empty facets.
 */
export async function getRouteFacetsForCategories(categories: string[]): Promise<ParkingFacets> {
  // Result shape through the memo, fail-soft outside — see the coords read
  // above for why (memo eviction must be able to SEE a failed scan).
  const result = await memoizeDuringBuild(
    memoKey('route-facets', { categories: [...categories].sort().join('|') }),
    () => getRouteFacetsUncached(categories),
  );
  return result.ok ? result.data : { states: [], interstatesByState: {} };
}

/**
 * COUNT/PAGE FILTER PARITY, structurally: is_published + deleted_at + the
 * SAME category set, on the one query that carries both page and count.
 */
async function getRouteFacetsUncached(
  categories: string[],
): Promise<DirectoryReadResult<ParkingFacets>> {
  try {
    const supabase = createStaticClient();
    // Same completeness rule as getDirectoryFacets: these facets drive the
    // Parking and CAT Scale State -> Interstate -> Direction flows, so a
    // capped sample would silently hide corridors from drivers.
    const scan = await collectAllRows<RouteFacetRow>(async (afterId, pageSize) => {
      let q = supabase
        .from('locations')
        .select(
          'id, state, interstate, category_slug',
          afterId === null ? { count: 'exact' } : undefined,
        )
        .eq('is_published', true)
        .is('deleted_at', null)
        .in('category_slug', categories);
      if (afterId !== null) q = q.gt('id', afterId);
      const { data, error, count } = await q.order('id', { ascending: true }).limit(pageSize);
      if (error) return { rows: [], error };
      return {
        rows: (data ?? []) as unknown as RouteFacetRow[],
        total: typeof count === 'number' ? count : undefined,
      };
    }, null);
    if (!scan.ok) return scan;
    const rows = scan.data as unknown as { state: string; interstate: string | null }[];
    const stateCounts = new Map<string, number>();
    const byState = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const st = r.state?.trim().toUpperCase();
      if (!st) continue;
      stateCounts.set(st, (stateCounts.get(st) ?? 0) + 1);
      const hwy = r.interstate?.trim();
      if (!hwy || !/^I-\d{1,3}$/.test(hwy)) continue;
      if (!byState.has(st)) byState.set(st, new Map());
      const m = byState.get(st)!;
      m.set(hwy, (m.get(hwy) ?? 0) + 1);
    }
    return {
      ok: true,
      data: {
        states: [...stateCounts.entries()]
          .map(([code, count]) => ({ code, count }))
          .sort((a, b) => a.code.localeCompare(b.code)),
        interstatesByState: Object.fromEntries(
          [...byState.entries()].map(([st, m]) => [
            st,
            [...m.entries()]
              .map(([designation, count]) => ({ designation, count }))
              .sort(
                (a, b) =>
                  parseInt(a.designation.slice(2), 10) - parseInt(b.designation.slice(2), 10),
              ),
          ]),
        ),
      },
    };
  } catch (error) {
    return { ok: false, reason: 'unavailable', code: failureCode(error) };
  }
}

export async function getParkingFacets(): Promise<ParkingFacets> {
  return getRouteFacetsForCategories(PARKING_FLOW_CATEGORIES);
}

/* ----------------------------------------------------------------------
 * CAT Scale browse-route + near-me (2026-07-29 milestone). Published-only
 * by query and by RLS; only rows already reviewed and published can ever
 * appear — unreviewed source rows are structurally invisible here.
 * ---------------------------------------------------------------------- */

const CAT_SCALE_CATEGORIES = ['cat-scales'];

export async function getCatScaleFacets(): Promise<ParkingFacets> {
  return getRouteFacetsForCategories(CAT_SCALE_CATEGORIES);
}

export async function getCatScaleCorridorEntries(
  stateCode: string,
  interstate: string,
): Promise<DirectoryEntry[]> {
  return getCorridorEntriesForCategories(CAT_SCALE_CATEGORIES, stateCode, interstate);
}

/** Published CAT Scale listings with verified coordinates — Near Me pool. */
export async function getCatScaleMapEntries(): Promise<DirectoryEntry[]> {
  try {
    const ctx = await entryContext();
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from('locations')
      .select(columnsFor(ctx.schema))
      .eq('is_published', true)
      .is('deleted_at', null)
      .in('category_slug', CAT_SCALE_CATEGORIES)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('name', { ascending: true })
      .limit(3000);
    if (error || !data) return [];
    return (data as unknown as LocationRow[]).map((r) => toEntry(r, ctx));
  } catch {
    return [];
  }
}

/** Total published CAT Scale listings (with or without coordinates). */
export async function getCatScalePublishedCount(): Promise<number> {
  try {
    const supabase = createStaticClient();
    const { count, error } = await supabase
      .from('locations')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true)
      .is('deleted_at', null)
      .in('category_slug', CAT_SCALE_CATEGORIES);
    if (error || count == null) return 0;
    return count;
  } catch {
    return 0;
  }
}
