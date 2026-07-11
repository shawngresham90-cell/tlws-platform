import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Directory admin reads. Service-role client (bypasses RLS) so the dashboard
 * sees unpublished and incomplete rows too — only ever called from
 * admin-gated server components. Fails soft: an error renders as a message,
 * never a 500.
 */

export type ListingRow = {
  id: string;
  name: string;
  category_slug: string | null;
  address: string | null;
  city: string;
  state: string;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  free_parking: boolean;
  paid_parking: boolean;
  reserved_parking: boolean;
  overnight_parking: boolean;
  parking_spaces: number | null;
  amenities: string[] | null;
  tpc_url: string | null;
  affiliate_code: string | null;
  image_url: string | null;
  interstate: string | null;
  exit_number: string | null;
  is_published: boolean;
  is_featured: boolean;
  is_indexable: boolean;
  verified_at: string | null;
  updated_at: string;
  created_at: string;
  /** Globally unique public detail-page slug (migration 022). */
  detail_slug: string | null;
};

const COLUMNS =
  'id, name, category_slug, address, city, state, zip, lat, lng, phone, website, description, ' +
  'free_parking, paid_parking, reserved_parking, overnight_parking, parking_spaces, amenities, ' +
  'tpc_url, affiliate_code, image_url, interstate, exit_number, is_published, is_featured, ' +
  'is_indexable, verified_at, updated_at, created_at, detail_slug';

export type ListingFilters = {
  q?: string;
  category?: string;
  state?: string;
  /** 'published' | 'unpublished' | undefined (= all) */
  published?: string;
  featured?: boolean;
};

export const PAGE_SIZE = 50;

/**
 * PostgREST `or()` filters are a comma/paren-delimited mini-language, so the
 * free-text term is stripped of the characters that could alter it before
 * being embedded. Values remain parameterized by PostgREST itself.
 */
function sanitizeSearchTerm(q: string): string {
  return q.replace(/[,()"'\\%]/g, ' ').trim();
}

function applyFilters<T extends { eq: (c: string, v: unknown) => T; or: (s: string) => T }>(
  query: T,
  filters: ListingFilters,
): T {
  let out = query;
  if (filters.category) out = out.eq('category_slug', filters.category);
  if (filters.state) out = out.eq('state', filters.state.toUpperCase());
  if (filters.published === 'published') out = out.eq('is_published', true);
  if (filters.published === 'unpublished') out = out.eq('is_published', false);
  if (filters.featured) out = out.eq('is_featured', true);
  const q = sanitizeSearchTerm(filters.q ?? '');
  if (q) {
    out = out.or(
      `name.ilike.%${q}%,city.ilike.%${q}%,zip.ilike.%${q}%,interstate.ilike.%${q}%`,
    );
  }
  return out;
}

/**
 * Server-side filtered + paginated page of listings (scales to tens of
 * thousands of rows — the DB does the searching, we fetch one page).
 */
export async function getListings(
  filters: ListingFilters,
  page = 1,
): Promise<{ rows: ListingRow[]; total: number; error: string | null }> {
  try {
    const supabase = createAdminClient();
    const from = (Math.max(1, page) - 1) * PAGE_SIZE;
    let query = supabase
      .from('locations')
      .select(COLUMNS, { count: 'exact' })
      .is('deleted_at', null);
    query = applyFilters(query, filters);
    const { data, count, error } = await query
      .order('updated_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { rows: [], total: 0, error: error.message };
    return { rows: (data as unknown as ListingRow[]) ?? [], total: count ?? 0, error: null };
  } catch (e) {
    return { rows: [], total: 0, error: (e as Error).message };
  }
}

/** Fetch ALL matching rows in 1000-row chunks (PostgREST page cap). */
async function fetchAll(
  columns: string,
  filters: ListingFilters,
  maxRows = 100_000,
): Promise<{ rows: ListingRow[]; error: string | null }> {
  try {
    const supabase = createAdminClient();
    const rows: ListingRow[] = [];
    for (let from = 0; from < maxRows; from += 1000) {
      let query = supabase.from('locations').select(columns).is('deleted_at', null);
      query = applyFilters(query, filters);
      const { data, error } = await query
        .order('created_at', { ascending: true })
        .range(from, from + 999);
      if (error) return { rows: [], error: error.message };
      const chunk = (data as unknown as ListingRow[]) ?? [];
      rows.push(...chunk);
      if (chunk.length < 1000) break;
    }
    return { rows, error: null };
  } catch (e) {
    return { rows: [], error: (e as Error).message };
  }
}

/** Every matching row with full columns — feeds the CSV export. */
export function getListingsForExport(
  filters: ListingFilters,
): Promise<{ rows: ListingRow[]; error: string | null }> {
  return fetchAll(COLUMNS, filters);
}

/** Full rows for duplicate detection + merge preview across the whole table. */
export function getDuplicateCandidates(): Promise<{ rows: ListingRow[]; error: string | null }> {
  return fetchAll(COLUMNS, {});
}

/** Keys of every live row, for import-time duplicate detection. */
export async function getExistingImportKeys(): Promise<{
  keys: Set<string>;
  error: string | null;
}> {
  const { rows, error } = await fetchAll('id, name, city, state', {});
  if (error) return { keys: new Set(), error };
  const { importDupKey } = await import('@/lib/directory/import');
  return { keys: new Set(rows.map((r) => importDupKey(r.name, r.city, r.state))), error: null };
}

/** Ignored duplicate pairs as "a|b" keys (a < b). */
export async function getIgnoredPairKeys(): Promise<Set<string>> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from('location_duplicate_ignores').select('a, b').limit(5000);
    return new Set(((data as { a: string; b: string }[]) ?? []).map((r) => `${r.a}|${r.b}`));
  } catch {
    return new Set();
  }
}

export async function getListing(
  id: string,
): Promise<{ row: ListingRow | null; error: string | null }> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('locations')
      .select(COLUMNS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) return { row: null, error: error.message };
    return { row: (data as unknown as ListingRow) ?? null, error: null };
  } catch (e) {
    return { row: null, error: (e as Error).message };
  }
}

/** Distinct states present among non-deleted listings (for the filter select). */
export function statesOf(rows: ListingRow[]): string[] {
  return [...new Set(rows.map((r) => r.state))].sort();
}
