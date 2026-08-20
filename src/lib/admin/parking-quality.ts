import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  classifyParkingRow,
  summarize,
  type ParkingRow,
  type ParkingContext,
  type ParkingQualityResult,
  type ParkingQualitySummary,
} from '@/lib/directory/parking-quality';

/**
 * Server-only read behind the parking-quality queue.
 *
 * SELECT only. There is deliberately no update, insert, upsert, delete or
 * RPC in this module, and `scripts/test-parking-quality.ts` asserts that by
 * reading the source — the admin queue's whole value is that it cannot
 * change what it is judging.
 *
 * It uses the admin client because the rows it reads are UNPUBLISHED, which
 * anon RLS correctly hides. That is the one thing the anon client cannot do
 * here, and it is why this module is `server-only` and the page behind
 * `requireAdmin()`.
 *
 * `ListingRow` in lib/admin/directory.ts is the shared editor/export shape
 * and does not carry provenance (`source`, `geocode_source`,
 * `coord_verification_status`, `manually_verified_at`). Widening it would
 * push those columns through the CSV export and the listing editor for one
 * page's benefit, so this read stays separate and narrow.
 */

const COLUMNS =
  'id, name, state, city, address, zip, category_slug, detail_slug, is_published, ' +
  'interstate, exit_number, lat, lng, parking_spaces, amenities, hours, ' +
  'free_parking, paid_parking, reserved_parking, overnight_parking, ' +
  'overnight_status, overnight_status_source, overnight_status_verified_at, ' +
  'website, phone, tpc_url, description, source, geocode_source, geocode_confidence, ' +
  'coord_verification_status, manually_verified_at, verified_at, created_at, updated_at';

/** Context columns — the minimum a duplicate/proximity check needs. */
const CONTEXT_COLUMNS = 'id, name, state, city, detail_slug, lat, lng, category_slug';

type DbRow = Record<string, unknown>;

function toParkingRow(r: DbRow): ParkingRow {
  const s = (k: string) => (r[k] == null ? null : String(r[k]));
  const n = (k: string) => (typeof r[k] === 'number' ? (r[k] as number) : null);
  const b = (k: string) => (typeof r[k] === 'boolean' ? (r[k] as boolean) : null);
  return {
    id: String(r.id),
    name: s('name'),
    state: s('state'),
    city: s('city'),
    address: s('address'),
    zip: s('zip'),
    categorySlug: s('category_slug'),
    detailSlug: s('detail_slug'),
    isPublished: r.is_published === true,
    interstate: s('interstate'),
    exitNumber: s('exit_number'),
    lat: n('lat'),
    lng: n('lng'),
    parkingSpaces: n('parking_spaces'),
    amenities: Array.isArray(r.amenities) ? (r.amenities as string[]) : null,
    hours: r.hours ?? null,
    freeParking: b('free_parking'),
    paidParking: b('paid_parking'),
    reservedParking: b('reserved_parking'),
    overnightParking: b('overnight_parking'),
    overnightStatus: s('overnight_status'),
    overnightStatusSource: s('overnight_status_source'),
    overnightStatusVerifiedAt: s('overnight_status_verified_at'),
    website: s('website'),
    phone: s('phone'),
    tpcUrl: s('tpc_url'),
    description: s('description'),
    source: s('source'),
    geocodeSource: s('geocode_source'),
    geocodeConfidence: s('geocode_confidence'),
    coordVerificationStatus: s('coord_verification_status'),
    manuallyVerifiedAt: s('manually_verified_at'),
    verifiedAt: s('verified_at'),
    createdAt: s('created_at'),
    updatedAt: s('updated_at'),
  };
}

/**
 * A non-empty code for any failed read. Supabase fills `code` for database
 * errors but leaves it empty for transport failures, and an empty string is
 * falsy — which is how a failed read once rendered as an empty queue.
 */
function errorCode(err: { code?: string | null; message?: string | null }): string {
  const code = (err.code ?? '').trim();
  if (code) return code;
  return /fetch failed|ECONNREFUSED|ENOTFOUND|timeout/i.test(err.message ?? '')
    ? 'unreachable'
    : 'read_failed';
}

export type ParkingQualityQueue = {
  results: ParkingQualityResult[];
  summary: ParkingQualitySummary;
  publishedParkingCount: number;
  /** Set when a read failed — the page says so rather than showing an empty queue. */
  error: string | null;
};

/**
 * Read + classify. Fails LOUD rather than soft: an empty queue and a broken
 * queue look identical on screen, and here they mean opposite things ("no
 * rows are waiting" vs "we cannot see the rows that are"). The page renders
 * the error instead of a reassuring zero.
 */
export async function getParkingQualityQueue(): Promise<ParkingQualityQueue> {
  const empty = {
    results: [],
    summary: summarize([]),
    publishedParkingCount: 0,
  };
  try {
    const supabase = createAdminClient();

    const [unpublished, context, publishedParking] = await Promise.all([
      supabase
        .from('locations')
        .select(COLUMNS)
        .eq('category_slug', 'parking')
        .eq('is_published', false)
        .is('deleted_at', null)
        .order('state', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('locations')
        .select(CONTEXT_COLUMNS)
        .eq('is_published', true)
        .is('deleted_at', null)
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .order('id', { ascending: true }),
      supabase
        .from('locations')
        .select('id', { count: 'exact', head: true })
        .eq('category_slug', 'parking')
        .eq('is_published', true)
        .is('deleted_at', null),
    ]);

    // `?? 'read_failed'` was a bug, and exactly the one this page exists to
    // prevent. PostgREST returns `code: ''` for a transport failure
    // (TypeError: fetch failed), and `'' ?? x` is `''` — falsy — so the page
    // took the SUCCESS branch and rendered a confident empty queue over a
    // read that had failed outright. Coalesce on FALSINESS, not nullishness.
    if (unpublished.error) return { ...empty, error: errorCode(unpublished.error) };
    if (context.error) return { ...empty, error: errorCode(context.error) };

    const rows = (unpublished.data ?? []).map((r) => toParkingRow(r as unknown as DbRow));
    const published = (context.data ?? []).map((r) => {
      const row = r as unknown as DbRow;
      return {
        id: String(row.id),
        name: row.name == null ? null : String(row.name),
        state: row.state == null ? null : String(row.state),
        city: row.city == null ? null : String(row.city),
        detailSlug: row.detail_slug == null ? null : String(row.detail_slug),
        lat: typeof row.lat === 'number' ? row.lat : null,
        lng: typeof row.lng === 'number' ? row.lng : null,
        categorySlug: row.category_slug == null ? null : String(row.category_slug),
      };
    });

    // Pending driver reports are an ATTENTION signal only. They are counted
    // here and displayed, and they reach no verdict — ten identical reports
    // with no official source still change nothing, which the harness
    // asserts directly.
    // Same table and kinds the existing parking-reports queue reads, so the
    // two surfaces cannot disagree about how many reports a listing has.
    const reportCountsByLocation: Record<string, number> = {};
    const reports = await supabase
      .from('location_submissions')
      .select('location_id')
      .in('kind', ['correction', 'closure', 'missing-info'])
      .eq('status', 'pending');
    for (const r of reports.data ?? []) {
      const id = String((r as unknown as DbRow).location_id ?? '');
      if (id) reportCountsByLocation[id] = (reportCountsByLocation[id] ?? 0) + 1;
    }

    const ctx: ParkingContext = {
      published,
      batch: rows,
      reportCountsByLocation,
      // No evidence records exist yet: the schema has no parking-evidence
      // column and every agency host is blocked at egress. Rows are
      // therefore blocked, never assumed. See QUALITY-GATE.md.
      evidenceByLocation: {},
    };

    const results = rows.map((row) => classifyParkingRow(row, ctx));
    return {
      results,
      summary: summarize(results),
      publishedParkingCount: publishedParking.count ?? 0,
      error: null,
    };
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.name : 'unavailable' };
  }
}
