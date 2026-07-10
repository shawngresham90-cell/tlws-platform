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
  is_published: boolean;
  is_featured: boolean;
  is_indexable: boolean;
  verified_at: string | null;
  updated_at: string;
  created_at: string;
};

const COLUMNS =
  'id, name, category_slug, address, city, state, zip, lat, lng, phone, website, description, ' +
  'free_parking, paid_parking, reserved_parking, overnight_parking, parking_spaces, amenities, ' +
  'tpc_url, affiliate_code, image_url, is_published, is_featured, is_indexable, verified_at, ' +
  'updated_at, created_at';

export type ListingFilters = {
  q?: string;
  category?: string;
  state?: string;
  /** 'published' | 'unpublished' | undefined (= all) */
  published?: string;
};

export async function getListings(
  filters: ListingFilters,
): Promise<{ rows: ListingRow[]; error: string | null }> {
  try {
    const supabase = createAdminClient();
    let query = supabase
      .from('locations')
      .select(COLUMNS)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(500);

    if (filters.category) query = query.eq('category_slug', filters.category);
    if (filters.state) query = query.eq('state', filters.state.toUpperCase());
    if (filters.published === 'published') query = query.eq('is_published', true);
    if (filters.published === 'unpublished') query = query.eq('is_published', false);

    const { data, error } = await query;
    if (error) return { rows: [], error: error.message };

    let rows = (data as unknown as ListingRow[]) ?? [];
    // Free-text search in memory over the (bounded) result set — avoids
    // interpolating user input into a PostgREST `or()` filter string.
    const q = filters.q?.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        `${r.name} ${r.city} ${r.state} ${r.address ?? ''}`.toLowerCase().includes(q),
      );
    }
    return { rows, error: null };
  } catch (e) {
    return { rows: [], error: (e as Error).message };
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
