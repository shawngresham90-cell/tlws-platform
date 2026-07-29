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

/**
 * Narrow the raw `overnight_status` text to the three-way union. Anything
 * unrecognized (or null, on a row read before migration 047) degrades to
 * 'unknown' — never to a claim.
 */
function toOvernightStatus(value: string | null): DirectoryEntry['overnightStatus'] {
  return value === 'confirmed' || value === 'prohibited' ? value : 'unknown';
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
    mileMarker: typeof row.mile_marker === 'number' ? row.mile_marker : undefined,
    mileMarkerSource: row.mile_marker_source ?? undefined,
    overnightStatus: toOvernightStatus(row.overnight_status),
    overnightStatusSource: row.overnight_status_source ?? undefined,
    createdAt: row.created_at ?? undefined,
    detailSlug: row.detail_slug ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    verifiedAt: row.verified_at ?? undefined,
  };
}

const COLUMNS =
  'id, name, category_slug, state, city, slug, address, zip, phone, website, description, ' +
  'parking_spaces, amenities, free_parking, paid_parking, reserved_parking, overnight_parking, ' +
  'tpc_url, is_featured, is_indexable, lat, lng, interstate, exit_number, created_at, ' +
  'detail_slug, updated_at, verified_at, mile_marker, mile_marker_source, ' +
  'overnight_status, overnight_status_source';

/** Shared query base: published, not deleted, capped, featured-then-name order. */
async function selectEntries(filters: Record<string, string>): Promise<DirectoryEntry[]> {
  try {
    const supabase = createStaticClient();
    let query = supabase
      .from('locations')
      .select(COLUMNS)
      .eq('is_published', true)
      .is('deleted_at', null);
    for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
    const { data, error } = await query
      .order('is_featured', { ascending: false })
      .order('name', { ascending: true })
      .limit(1000);
    if (error || !data) return [];
    return (data as unknown as LocationRow[]).map(toEntry);
  } catch {
    return [];
  }
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

/**
 * Published listings ordered by most-recently-updated (Milestone 25). Only rows
 * with a real updated_at are returned, so "recently updated" never implies a
 * change that didn't happen. Fails soft to [].
 */
export async function getRecentlyUpdated(limit = 50): Promise<DirectoryEntry[]> {
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from('locations')
      .select(COLUMNS)
      .eq('is_published', true)
      .is('deleted_at', null)
      .not('updated_at', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 200));
    if (error || !data) return [];
    return (data as unknown as LocationRow[]).map(toEntry);
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
    const supabase = createStaticClient();
    const from = Math.max(offset, 0);
    const to = from + Math.min(Math.max(limit, 1), 100) - 1;
    const { data, error } = await supabase
      .from('locations')
      .select(COLUMNS)
      .eq('is_published', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false, nullsFirst: false })
      .range(from, to);
    if (error || !data) return [];
    return (data as unknown as LocationRow[]).map(toEntry);
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
  try {
    const supabase = createStaticClient();
    let query = supabase
      .from('locations')
      .select(COLUMNS)
      .eq('is_published', true)
      .is('deleted_at', null)
      .not('lat', 'is', null)
      .not('lng', 'is', null);
    if (filters.category) query = query.eq('category_slug', filters.category);
    if (filters.state) query = query.eq('state', filters.state.toUpperCase());
    if (filters.interstate) query = query.eq('interstate', filters.interstate);
    const { data, error } = await query.order('name', { ascending: true }).limit(2000);
    if (error || !data) return [];
    return (data as unknown as LocationRow[]).map(toEntry);
  } catch {
    return [];
  }
}

/**
 * Resolve one published listing by its public detail slug (Milestone 20).
 * Anon client + explicit published/non-deleted filters (RLS enforces the same
 * boundary), so unpublished, soft-deleted, and unknown slugs all resolve to
 * null — the detail route turns that into a 404. Fails soft to null.
 */
export async function getEntryByDetailSlug(detailSlug: string): Promise<DirectoryEntry | null> {
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from('locations')
      .select(COLUMNS)
      .eq('is_published', true)
      .is('deleted_at', null)
      .eq('detail_slug', detailSlug)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return toEntry(data as unknown as LocationRow);
  } catch {
    return null;
  }
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
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from('locations')
      .select('detail_slug, updated_at')
      .eq('is_published', true)
      .is('deleted_at', null)
      .not('detail_slug', 'is', null)
      .limit(5000);
    if (error || !data) return [];
    return (data as unknown as { detail_slug: string; updated_at: string | null }[]).map((r) => ({
      detailSlug: r.detail_slug,
      updatedAt: r.updated_at ?? undefined,
    }));
  } catch {
    return [];
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
 */
export async function getDirectoryFacets(): Promise<DirectoryFacets> {
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from('locations')
      .select('state, interstate, exit_number')
      .eq('is_published', true)
      .is('deleted_at', null)
      .limit(5000);
    if (error || !data) return EMPTY_FACETS;
    const rows = data as unknown as {
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
      const hwy = r.interstate?.trim();
      if (hwy) {
        interstates.set(hwy, (interstates.get(hwy) ?? 0) + 1);
        const exit = r.exit_number?.trim();
        if (exit) {
          if (!exits.has(hwy)) exits.set(hwy, new Set());
          exits.get(hwy)!.add(exit);
        }
      }
    }
    return {
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
    };
  } catch {
    return EMPTY_FACETS;
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
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from('locations')
      .select(COLUMNS)
      .eq('is_published', true)
      .is('deleted_at', null)
      .eq('state', stateCode.toUpperCase())
      .eq('interstate', interstate)
      .in('category_slug', categories)
      .order('name', { ascending: true })
      .limit(1000);
    if (error || !data) return [];
    return (data as unknown as LocationRow[]).map(toEntry);
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
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from('locations')
      .select('state, interstate, category_slug')
      .eq('is_published', true)
      .is('deleted_at', null)
      .in('category_slug', categories)
      .limit(5000);
    if (error || !data) return { states: [], interstatesByState: {} };
    const rows = data as unknown as { state: string; interstate: string | null }[];
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
      states: [...stateCounts.entries()]
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => a.code.localeCompare(b.code)),
      interstatesByState: Object.fromEntries(
        [...byState.entries()].map(([st, m]) => [
          st,
          [...m.entries()]
            .map(([designation, count]) => ({ designation, count }))
            .sort(
              (a, b) => parseInt(a.designation.slice(2), 10) - parseInt(b.designation.slice(2), 10),
            ),
        ]),
      ),
    };
  } catch {
    return { states: [], interstatesByState: {} };
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
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from('locations')
      .select(COLUMNS)
      .eq('is_published', true)
      .is('deleted_at', null)
      .in('category_slug', CAT_SCALE_CATEGORIES)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('name', { ascending: true })
      .limit(3000);
    if (error || !data) return [];
    return (data as unknown as LocationRow[]).map(toEntry);
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
