import { createAdminClient } from '@/lib/supabase/admin';
import type { SubmissionKind } from '@/lib/community/schemas';

/**
 * Community moderation domain (Milestone 16): admin-side reads over the
 * pending queues plus the PURE logic that turns an approved submission into a
 * listing patch and a history record. Only admin-gated server code imports
 * this. The apply rules:
 *
 *   correction      → provided fields overwrite the listing where they differ
 *   missing-info    → provided fields land only where the listing is empty
 *   amenity-change  → amenities replace, parking flags apply where stated
 *   closure         → is_published := false
 *   new             → creates an UNPUBLISHED listing (publishing stays manual)
 *
 * Every applied change is diffed first; the diff becomes the history row that
 * is written BEFORE the listing mutates (P4: never overwrite without record).
 */

/** No per-user identity yet (env-var admin gate) — history rows carry this. */
export const MODERATION_ADMIN = 'owner';

export const PAGE_SIZE = 50;

export type SubmissionRow = {
  id: string;
  kind: SubmissionKind;
  location_id: string | null;
  name: string;
  category_slug: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  amenities: string[] | null;
  free_parking: boolean | null;
  paid_parking: boolean | null;
  reserved_parking: boolean | null;
  overnight_parking: boolean | null;
  parking_spaces: number | null;
  comments: string | null;
  submitter_name: string | null;
  submitter_contact: string | null;
  status: string;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  /** Joined target listing (null for kind 'new' or if since deleted). */
  locations: TargetListing | null;
};

/** Slim join of the listing a submission/review points at. */
export type TargetListing = {
  id: string;
  name: string;
  city: string;
  state: string;
  category_slug: string | null;
};

const SUBMISSION_COLUMNS =
  'id, kind, location_id, name, category_slug, address, city, state, zip, phone, website, ' +
  'description, amenities, free_parking, paid_parking, reserved_parking, overnight_parking, ' +
  'parking_spaces, comments, submitter_name, submitter_contact, status, admin_note, ' +
  'reviewed_by, reviewed_at, created_at, locations (id, name, city, state, category_slug)';

export type ModerationFilters = {
  q?: string;
  /** submission kind ('' = all) */
  kind?: string;
  /** moderation status ('' = all, defaults to 'pending' in the pages) */
  status?: string;
};

/** Same PostgREST-or() escaping rule as the directory admin search. */
function sanitizeSearchTerm(q: string): string {
  return q.replace(/[,()"'\\%]/g, ' ').trim();
}

export async function getSubmissions(
  filters: ModerationFilters,
  page = 1,
): Promise<{ rows: SubmissionRow[]; total: number; error: string | null }> {
  try {
    const supabase = createAdminClient();
    const from = (Math.max(1, page) - 1) * PAGE_SIZE;
    let query = supabase.from('location_submissions').select(SUBMISSION_COLUMNS, {
      count: 'exact',
    });
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.kind) query = query.eq('kind', filters.kind);
    const q = sanitizeSearchTerm(filters.q ?? '');
    if (q) {
      query = query.or(
        `name.ilike.%${q}%,city.ilike.%${q}%,submitter_name.ilike.%${q}%,comments.ilike.%${q}%`,
      );
    }
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { rows: [], total: 0, error: error.message };
    return { rows: (data as unknown as SubmissionRow[]) ?? [], total: count ?? 0, error: null };
  } catch (e) {
    return { rows: [], total: 0, error: (e as Error).message };
  }
}

export async function getSubmission(
  id: string,
): Promise<{ row: SubmissionRow | null; error: string | null }> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('location_submissions')
      .select(SUBMISSION_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) return { row: null, error: error.message };
    return { row: (data as unknown as SubmissionRow) ?? null, error: null };
  } catch (e) {
    return { row: null, error: (e as Error).message };
  }
}

export type ModReviewRow = {
  id: string;
  location_id: string;
  rating: number;
  title: string;
  body: string;
  visited_on: string | null;
  truck_type: string | null;
  reviewer_name: string | null;
  reviewer_email: string | null;
  status: string;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  locations: TargetListing | null;
};

const MOD_REVIEW_COLUMNS =
  'id, location_id, rating, title, body, visited_on, truck_type, reviewer_name, reviewer_email, ' +
  'status, admin_note, reviewed_by, reviewed_at, created_at, ' +
  'locations (id, name, city, state, category_slug)';

export type ReviewFilters = {
  q?: string;
  /** exact star rating filter ('' = all) */
  rating?: string;
  status?: string;
};

export async function getModReviews(
  filters: ReviewFilters,
  page = 1,
): Promise<{ rows: ModReviewRow[]; total: number; error: string | null }> {
  try {
    const supabase = createAdminClient();
    const from = (Math.max(1, page) - 1) * PAGE_SIZE;
    let query = supabase.from('location_reviews').select(MOD_REVIEW_COLUMNS, { count: 'exact' });
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.rating && /^[1-5]$/.test(filters.rating))
      query = query.eq('rating', Number(filters.rating));
    const q = sanitizeSearchTerm(filters.q ?? '');
    if (q) {
      query = query.or(`title.ilike.%${q}%,body.ilike.%${q}%,reviewer_name.ilike.%${q}%`);
    }
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { rows: [], total: 0, error: error.message };
    return { rows: (data as unknown as ModReviewRow[]) ?? [], total: count ?? 0, error: null };
  } catch (e) {
    return { rows: [], total: 0, error: (e as Error).message };
  }
}

export async function getModReview(
  id: string,
): Promise<{ row: ModReviewRow | null; error: string | null }> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('location_reviews')
      .select(MOD_REVIEW_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) return { row: null, error: error.message };
    return { row: (data as unknown as ModReviewRow) ?? null, error: null };
  } catch (e) {
    return { row: null, error: (e as Error).message };
  }
}

/** Pending counts for the two queues (admin overview + nav badges). */
export async function getPendingCounts(): Promise<{ submissions: number; reviews: number }> {
  try {
    const supabase = createAdminClient();
    const [subs, revs] = await Promise.all([
      supabase
        .from('location_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('location_reviews')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ]);
    return { submissions: subs.count ?? 0, reviews: revs.count ?? 0 };
  } catch {
    return { submissions: 0, reviews: 0 };
  }
}

/** Every live listing as a slim option list (merge targets, pickers). */
export async function getListingOptions(): Promise<TargetListing[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('locations')
      .select('id, name, city, state, category_slug')
      .is('deleted_at', null)
      .order('state', { ascending: true })
      .order('city', { ascending: true })
      .order('name', { ascending: true })
      .limit(2000);
    if (error || !data) return [];
    return data as unknown as TargetListing[];
  } catch {
    return [];
  }
}

/* ============================================================
 * Admin edit-form parsing (edit before approve)
 * ============================================================ */

/** '' | 'yes' | 'no' select → boolean | null. */
function triState(v: FormDataEntryValue | null): boolean | null {
  return v === 'yes' ? true : v === 'no' ? false : null;
}

const str = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v : '');

/**
 * Submission edit form → the payload the PUBLIC submission schema validates
 * (same rules as drivers get; kind and target listing are not editable).
 */
export function submissionEditInput(
  formData: FormData,
  kind: SubmissionKind,
  locationId: string | null,
) {
  return {
    kind,
    location_id: locationId ?? '',
    name: str(formData.get('name')),
    category_slug: str(formData.get('category_slug')),
    address: str(formData.get('address')),
    city: str(formData.get('city')),
    state: str(formData.get('state')),
    zip: str(formData.get('zip')),
    phone: str(formData.get('phone')),
    website: str(formData.get('website')),
    description: str(formData.get('description')),
    amenities: formData.getAll('amenities').map(String),
    free_parking: triState(formData.get('free_parking')),
    paid_parking: triState(formData.get('paid_parking')),
    reserved_parking: triState(formData.get('reserved_parking')),
    overnight_parking: triState(formData.get('overnight_parking')),
    parking_spaces: str(formData.get('parking_spaces')),
    comments: str(formData.get('comments')),
    submitter_name: str(formData.get('submitter_name')),
    submitter_contact: str(formData.get('submitter_contact')),
    company_website: '',
  };
}

/** Review edit form → the payload the PUBLIC review schema validates. */
export function reviewEditInput(formData: FormData, locationId: string) {
  return {
    location_id: locationId,
    rating: str(formData.get('rating')),
    title: str(formData.get('title')),
    body: str(formData.get('body')),
    visited_on: str(formData.get('visited_on')),
    truck_type: str(formData.get('truck_type')),
    reviewer_name: str(formData.get('reviewer_name')),
    company_website: '',
  };
}

/* ============================================================
 * Pure apply/diff logic (unit-testable, no I/O)
 * ============================================================ */

/** Listing columns a submission is allowed to change. */
const TEXT_FIELDS = ['address', 'city', 'state', 'zip', 'phone', 'website', 'description'] as const;
const PARKING_FLAGS = [
  'free_parking',
  'paid_parking',
  'reserved_parking',
  'overnight_parking',
] as const;

type ListingLike = Record<string, unknown>;

export type ChangedFields = Record<string, { from: unknown; to: unknown }>;

function isEmpty(v: unknown): boolean {
  return v == null || v === '' || (Array.isArray(v) && v.length === 0);
}

function sameAmenities(a: unknown, b: string[]): boolean {
  if (!Array.isArray(a)) return b.length === 0;
  if (a.length !== b.length) return false;
  const setA = new Set(a as string[]);
  return b.every((x) => setA.has(x));
}

/**
 * The listing patch an approved submission produces, plus its field-level
 * diff. Returns an empty patch when there is nothing to change — approval
 * then records nothing and mutates nothing.
 */
export function submissionPatch(
  submission: SubmissionRow,
  current: ListingLike,
): { patch: ListingLike; changed: ChangedFields } {
  const patch: ListingLike = {};
  const changed: ChangedFields = {};
  const kind = submission.kind;

  const put = (field: string, to: unknown) => {
    patch[field] = to;
    changed[field] = { from: current[field] ?? null, to };
  };

  if (kind === 'closure') {
    if (current.is_published !== false) put('is_published', false);
    return { patch, changed };
  }

  const applyDetails = kind === 'correction' || kind === 'missing-info';
  const applyAmenities = applyDetails || kind === 'amenity-change';
  // missing-info only fills blanks; correction/amenity-change overwrite.
  const fillOnly = kind === 'missing-info';

  if (applyDetails) {
    for (const field of TEXT_FIELDS) {
      const to = submission[field];
      if (isEmpty(to)) continue;
      if (fillOnly && !isEmpty(current[field])) continue;
      if (current[field] === to) continue;
      put(field, to);
    }
  }

  if (applyAmenities) {
    const amenities = submission.amenities ?? [];
    if (amenities.length > 0) {
      if (fillOnly) {
        // Fill-only: union — never drop an amenity the listing already has.
        const union = [
          ...new Set([...((current.amenities as string[]) ?? []), ...amenities]),
        ];
        if (!sameAmenities(current.amenities, union)) put('amenities', union);
      } else if (!sameAmenities(current.amenities, amenities)) {
        put('amenities', amenities);
      }
    }
    for (const flag of PARKING_FLAGS) {
      const to = submission[flag];
      if (to == null) continue; // driver didn't say
      if (fillOnly && current[flag] === true) continue; // don't un-set on fill-only
      if (current[flag] === to) continue;
      put(flag, to);
    }
    const spaces = submission.parking_spaces;
    if (spaces != null && current.parking_spaces !== spaces) {
      if (!(fillOnly && !isEmpty(current.parking_spaces))) put('parking_spaces', spaces);
    }
  }

  return { patch, changed };
}

/** Snapshot diff for a freshly created listing (every field from null). */
export function creationChanges(row: ListingLike): ChangedFields {
  const changed: ChangedFields = {};
  for (const [field, to] of Object.entries(row)) {
    if (isEmpty(to) || to === false) continue;
    changed[field] = { from: null, to };
  }
  return changed;
}
