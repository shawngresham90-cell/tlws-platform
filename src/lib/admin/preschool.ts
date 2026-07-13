import { createAdminClient } from '@/lib/supabase/admin';
import { FOUNDING_STUDENT_CAPACITY } from '@/lib/preschool/constants';

/**
 * Admin-side data layer for CDL Pre-School Founding Student moderation.
 * Server-only (service role). Every mutation writes an audit row into
 * preschool_claim_history BEFORE touching its target — a failed audit write
 * aborts the change (same doctrine as lib/admin/history.ts).
 *
 * Until migration 028 is applied the tables don't exist; readers return the
 * `tablesMissing` flag so the admin page can say so instead of erroring.
 */

export const PRESCHOOL_ADMIN = 'owner';

export type ClaimRow = {
  id: string;
  purchaser_email: string;
  display_name: string;
  is_anonymous: boolean;
  business_name: string | null;
  website_url: string | null;
  confirmed_checkout: boolean;
  consent_public_display: boolean;
  status: 'pending' | 'approved' | 'rejected';
  verified_purchase: boolean;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type StudentRow = {
  id: string;
  claim_id: string | null;
  spot_number: number | null;
  display_name: string;
  is_anonymous: boolean;
  business_name: string | null;
  website_url: string | null;
  is_published: boolean;
  created_at: string;
};

const CLAIM_COLUMNS =
  'id, purchaser_email, display_name, is_anonymous, business_name, website_url, confirmed_checkout, consent_public_display, status, verified_purchase, admin_notes, reviewed_by, reviewed_at, created_at';

export async function getModerationState(): Promise<{
  claims: ClaimRow[];
  students: StudentRow[];
  tablesMissing: boolean;
}> {
  const supabase = createAdminClient();
  const [claimsRes, studentsRes] = await Promise.all([
    supabase
      .from('preschool_founding_claims')
      .select(CLAIM_COLUMNS)
      .order('created_at', { ascending: true }),
    supabase
      .from('preschool_founding_students')
      .select('id, claim_id, spot_number, display_name, is_anonymous, business_name, website_url, is_published, created_at')
      .order('spot_number', { ascending: true, nullsFirst: false }),
  ]);
  const missing = claimsRes.error?.code === '42P01' || studentsRes.error?.code === '42P01';
  return {
    claims: (claimsRes.data as ClaimRow[] | null) ?? [],
    students: (studentsRes.data as StudentRow[] | null) ?? [],
    tablesMissing: Boolean(missing),
  };
}

type HistoryEntry = {
  claim_id: string;
  action: 'approve' | 'reject' | 'publish' | 'unpublish' | 'edit' | 'assign-spot' | 'verify-purchase';
  changed_fields?: Record<string, unknown>;
  note?: string;
};

/** Audit first; a failed audit write aborts the mutation. Returns error text or null. */
export async function recordClaimHistory(
  supabase: ReturnType<typeof createAdminClient>,
  entry: HistoryEntry,
): Promise<string | null> {
  const { error } = await supabase.from('preschool_claim_history').insert({
    claim_id: entry.claim_id,
    action: entry.action,
    admin: PRESCHOOL_ADMIN,
    changed_fields: entry.changed_fields ?? {},
    note: entry.note ?? null,
  });
  return error ? `Audit history write failed (${error.code}) — change aborted.` : null;
}

/** Smallest unused founding spot number, or null when all 20 are taken. */
export function nextSpotNumber(taken: Array<number | null>): number | null {
  const used = new Set(taken.filter((n): n is number => n != null));
  for (let n = 1; n <= FOUNDING_STUDENT_CAPACITY; n++) {
    if (!used.has(n)) return n;
  }
  return null;
}

/** Approved wall rows count against the 20-spot cap regardless of publish state. */
export function capacityReached(studentCount: number): boolean {
  return studentCount >= FOUNDING_STUDENT_CAPACITY;
}
