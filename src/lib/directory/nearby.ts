import { createStaticClient } from '@/lib/supabase/static';
import { coordinateIssues } from '@/lib/map/geo';

/**
 * "Near Me" data foundation (Milestone 17). Server-side only — there is no
 * public UI and no browser geolocation prompt yet. Calls the
 * nearby_locations() RPC (migration 021) with the ANON key, so RLS keeps the
 * result set to published, non-deleted rows; the RPC itself re-filters and
 * hard-caps radius (500 mi) and limit (100) as defense in depth.
 */

export const NEARBY_MAX_LIMIT = 100;
export const NEARBY_MAX_RADIUS_MILES = 500;

export type NearbyListing = {
  id: string;
  name: string;
  category: string;
  state: string;
  city: string;
  slug: string;
  address?: string;
  zip?: string;
  phone?: string;
  website?: string;
  lat: number;
  lng: number;
  interstate?: string;
  exitNumber?: string;
  distanceMiles: number;
};

type NearbyRow = {
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
  lat: number;
  lng: number;
  interstate: string | null;
  exit_number: string | null;
  distance_miles: number;
};

export type NearbyQuery = {
  lat: number;
  lng: number;
  /** Optional category slug filter. */
  category?: string;
  /** Search radius in miles (default 100, capped at 500). */
  radiusMiles?: number;
  /** Max results (default 25, capped at 100). */
  limit?: number;
};

/**
 * Published, non-deleted, coordinate-bearing listings nearest to a point,
 * sorted nearest first. Invalid origins (0/0, out of range, outside the US)
 * return [] — never an error and never an unfiltered dump.
 */
export async function getNearbyListings(query: NearbyQuery): Promise<NearbyListing[]> {
  if (coordinateIssues(query.lat, query.lng).length > 0) return [];
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase.rpc('nearby_locations', {
      in_lat: query.lat,
      in_lng: query.lng,
      in_radius_miles: Math.min(Math.max(query.radiusMiles ?? 100, 1), NEARBY_MAX_RADIUS_MILES),
      in_category: query.category ?? null,
      in_limit: Math.min(Math.max(query.limit ?? 25, 1), NEARBY_MAX_LIMIT),
    });
    if (error || !data) return [];
    return (data as unknown as NearbyRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category_slug ?? 'other',
      state: r.state,
      city: r.city,
      slug: r.slug,
      address: r.address ?? undefined,
      zip: r.zip ?? undefined,
      phone: r.phone ?? undefined,
      website: r.website ?? undefined,
      lat: r.lat,
      lng: r.lng,
      interstate: r.interstate ?? undefined,
      exitNumber: r.exit_number ?? undefined,
      distanceMiles: r.distance_miles,
    }));
  } catch {
    return [];
  }
}
