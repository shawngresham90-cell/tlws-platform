'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  capacityReached,
  nextSpotNumber,
  PRESCHOOL_ADMIN,
  recordClaimHistory,
} from '@/lib/admin/preschool';
import {
  FOUNDING_WALL_PATH,
  PRESCHOOL_ADMIN_PATH,
  PRESCHOOL_PATH,
} from '@/lib/preschool/constants';
import { isSafePublicUrl } from '@/lib/preschool/founding-students';

/**
 * Founding Student moderation actions. Every action: (1) requireAdmin(),
 * (2) audit-history write BEFORE the mutation (failed audit aborts),
 * (3) service-role mutation with server-side validation, (4) revalidate the
 * public wall + sales page, (5) redirect with ?ok/?error. The 20-spot cap is
 * enforced here AND by the DB trigger in migration 028.
 */

function finish(error?: string | null, okCode?: string): never {
  revalidatePath(PRESCHOOL_ADMIN_PATH);
  revalidatePath(FOUNDING_WALL_PATH);
  revalidatePath(PRESCHOOL_PATH);
  redirect(
    error
      ? `${PRESCHOOL_ADMIN_PATH}?error=${encodeURIComponent(error)}`
      : `${PRESCHOOL_ADMIN_PATH}?ok=${okCode ?? 'done'}`,
  );
}

const reviewedNow = () => ({
  reviewed_by: PRESCHOOL_ADMIN,
  reviewed_at: new Date().toISOString(),
});

/** Mark a pending claim's purchase as manually verified against Stan Store. */
export async function verifyPurchaseAction(id: string): Promise<void> {
  requireAdmin();
  const supabase = createAdminClient();
  const audit = await recordClaimHistory(supabase, { claim_id: id, action: 'verify-purchase' });
  if (audit) finish(audit);
  const { error } = await supabase
    .from('preschool_founding_claims')
    .update({ verified_purchase: true, ...reviewedNow() })
    .eq('id', id)
    .eq('status', 'pending');
  finish(error ? 'Could not mark the purchase verified.' : null, 'verified');
}

/** Approve a verified claim: claim → approved, wall row created (published). */
export async function approveClaimAction(id: string): Promise<void> {
  requireAdmin();
  const supabase = createAdminClient();

  const { data: claim } = await supabase
    .from('preschool_founding_claims')
    .select('id, display_name, is_anonymous, business_name, website_url, status, verified_purchase')
    .eq('id', id)
    .maybeSingle();
  if (!claim) finish('Claim not found.');
  if (claim.status !== 'pending') finish('Only pending claims can be approved.');
  if (!claim.verified_purchase) finish('Verify the purchase against Stan Store records first.');

  const { data: students, error: studentsError } = await supabase
    .from('preschool_founding_students')
    .select('id, spot_number');
  if (studentsError) finish('Could not read the wall to check capacity.');
  if (capacityReached(students?.length ?? 0)) {
    finish('All 20 Founding Student spots are taken — no further approvals are possible.');
  }

  const audit = await recordClaimHistory(supabase, {
    claim_id: id,
    action: 'approve',
    changed_fields: { status: 'approved' },
  });
  if (audit) finish(audit);

  const spot = nextSpotNumber((students ?? []).map((s) => s.spot_number));
  const { error: insertError } = await supabase.from('preschool_founding_students').insert({
    claim_id: id,
    spot_number: spot,
    display_name: claim.display_name,
    is_anonymous: claim.is_anonymous,
    business_name: claim.business_name,
    website_url: isSafePublicUrl(claim.website_url) ? claim.website_url : null,
    is_published: true,
  });
  if (insertError) finish('Could not create the wall entry (capacity trigger or DB error).');

  const { error } = await supabase
    .from('preschool_founding_claims')
    .update({ status: 'approved', ...reviewedNow() })
    .eq('id', id);
  finish(error ? 'Wall entry created but the claim status update failed — fix manually.' : null, 'approved');
}

export async function rejectClaimAction(id: string): Promise<void> {
  requireAdmin();
  const supabase = createAdminClient();
  const audit = await recordClaimHistory(supabase, {
    claim_id: id,
    action: 'reject',
    changed_fields: { status: 'rejected' },
  });
  if (audit) finish(audit);
  const { error } = await supabase
    .from('preschool_founding_claims')
    .update({ status: 'rejected', ...reviewedNow() })
    .eq('id', id)
    .eq('status', 'pending');
  finish(error ? 'Could not reject the claim.' : null, 'rejected');
}

/** Toggle a wall row's public visibility. */
export async function setPublishedAction(studentId: string, publish: boolean): Promise<void> {
  requireAdmin();
  const supabase = createAdminClient();
  const { data: student } = await supabase
    .from('preschool_founding_students')
    .select('id, claim_id')
    .eq('id', studentId)
    .maybeSingle();
  if (!student) finish('Wall entry not found.');
  if (student.claim_id) {
    const audit = await recordClaimHistory(supabase, {
      claim_id: student.claim_id,
      action: publish ? 'publish' : 'unpublish',
    });
    if (audit) finish(audit);
  }
  const { error } = await supabase
    .from('preschool_founding_students')
    .update({ is_published: publish })
    .eq('id', studentId);
  finish(error ? 'Could not update visibility.' : null, publish ? 'published' : 'unpublished');
}

/** Edit a wall row's public fields (name, anonymity, business, URL, spot #). */
export async function updateStudentAction(studentId: string, formData: FormData): Promise<void> {
  requireAdmin();
  const supabase = createAdminClient();

  const displayName = String(formData.get('display_name') ?? '').trim();
  const isAnonymous = formData.get('is_anonymous') === 'on';
  const businessName = String(formData.get('business_name') ?? '').trim();
  const websiteUrl = String(formData.get('website_url') ?? '').trim();
  const spotRaw = String(formData.get('spot_number') ?? '').trim();

  if (displayName.length < 1 || displayName.length > 80) {
    finish('Display name must be 1–80 characters.');
  }
  if (websiteUrl && !isSafePublicUrl(websiteUrl)) {
    finish('Website must be a full https:// URL.');
  }
  let spotNumber: number | null = null;
  if (spotRaw) {
    const n = Number(spotRaw);
    if (!Number.isInteger(n) || n < 1 || n > 20) finish('Spot number must be 1–20.');
    spotNumber = n;
  }

  const { data: student } = await supabase
    .from('preschool_founding_students')
    .select('id, claim_id')
    .eq('id', studentId)
    .maybeSingle();
  if (!student) finish('Wall entry not found.');
  if (student.claim_id) {
    const audit = await recordClaimHistory(supabase, {
      claim_id: student.claim_id,
      action: spotRaw ? 'assign-spot' : 'edit',
      changed_fields: {
        display_name: displayName,
        is_anonymous: isAnonymous,
        business_name: businessName || null,
        website_url: websiteUrl || null,
        spot_number: spotNumber,
      },
    });
    if (audit) finish(audit);
  }

  const { error } = await supabase
    .from('preschool_founding_students')
    .update({
      display_name: displayName,
      is_anonymous: isAnonymous,
      business_name: businessName || null,
      website_url: websiteUrl || null,
      spot_number: spotNumber,
    })
    .eq('id', studentId);
  finish(error ? 'Could not save (spot number may already be taken).' : null, 'saved');
}
