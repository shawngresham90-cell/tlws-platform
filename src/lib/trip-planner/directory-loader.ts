import { createStaticClient } from '@/lib/supabase/static';
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
  tpc_url: string | null;
  amenities: unknown;
  fuel_brands: unknown;
  coord_verification_status: string | null;
  city: string | null;
};

const PLANNER_COLUMNS =
  'id, name, category_slug, lat, lng, state, interstate, exit_number, parking_spaces, ' +
  'overnight_parking, tpc_url, amenities, fuel_brands, coord_verification_status, city';

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
    reservationUrl: safeUrl(row.tpc_url),
    amenities: strArray(row.amenities),
    fuelBrands: strArray(row.fuel_brands),
    coordVerificationStatus: row.coord_verification_status,
  };
}

/** Published, coordinate-bearing listings for the planner. Fail-soft []. */
export async function loadPlannerListings(): Promise<DirectoryListing[]> {
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from('locations')
      .select(PLANNER_COLUMNS)
      .eq('is_published', true)
      .is('deleted_at', null)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .limit(2000);
    if (error || !data) return [];
    return (data as unknown as PlannerRow[])
      .filter((r) => r.lat != null && r.lng != null)
      .map(mapRowToListing);
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
