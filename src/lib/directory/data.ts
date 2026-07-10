import { createStaticClient } from '@/lib/supabase/static';
import type { DirectoryEntry } from './types';

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
  is_indexable: boolean | null;
  lat: number | null;
  lng: number | null;
  interstate: string | null;
  exit_number: string | null;
  created_at: string | null;
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

function toEntry(row: LocationRow): DirectoryEntry {
  // Parking attributes render as chips alongside stored amenities.
  const chips: string[] = [];
  if (row.free_parking) chips.push('Free parking');
  if (row.paid_parking) chips.push('Paid parking');
  if (row.reserved_parking) chips.push('Reserved');
  if (row.overnight_parking) chips.push('Overnight OK');
  if (Array.isArray(row.amenities)) {
    for (const a of row.amenities) if (typeof a === 'string') chips.push(a);
  }

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
    parkingSpaces: row.parking_spaces ?? undefined,
    description: row.description ?? undefined,
    tpcUrl: safeUrl(row.tpc_url),
    featured: row.is_featured ?? false,
    indexable: row.is_indexable ?? false,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    interstate: row.interstate ?? undefined,
    exitNumber: row.exit_number ?? undefined,
    createdAt: row.created_at ?? undefined,
  };
}

const COLUMNS =
  'id, name, category_slug, state, city, slug, address, zip, phone, website, description, ' +
  'parking_spaces, amenities, free_parking, paid_parking, reserved_parking, overnight_parking, ' +
  'tpc_url, is_featured, is_indexable, lat, lng, interstate, exit_number, created_at';

export async function getEntries(categorySlug: string): Promise<DirectoryEntry[]> {
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from('locations')
      .select(COLUMNS)
      .eq('category_slug', categorySlug)
      .eq('is_published', true)
      .is('deleted_at', null)
      .order('is_featured', { ascending: false })
      .order('name', { ascending: true })
      .limit(1000);
    if (error || !data) return [];
    return (data as unknown as LocationRow[]).map(toEntry);
  } catch {
    return [];
  }
}

/** Distinct two-letter states present in a set of entries, sorted. */
export function statesIn(entries: DirectoryEntry[]): string[] {
  return [...new Set(entries.map((e) => e.state))].sort();
}
