'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  CLAIM_CHECKLIST,
  CLAIM_DECISION_STAGE,
  reviewBlockers,
  reviewNoteLine,
  reviewTouchSummary,
  type ClaimDecision,
  type ClaimReview,
} from '@/lib/admin/claim-review';

/**
 * Claim review writes. Admin-gated, and deliberately narrow: recording a
 * decision moves the CRM row's stage, appends one labelled line to its notes,
 * and adds one append-only touch. That is the whole effect.
 *
 * It does NOT touch `locations`. Verifying a claim means "we believe this
 * person represents this business" — it never transfers ownership, edits
 * content, or promotes anything. Any correction the business asked for is a
 * separate listing edit a human makes afterwards, against the same evidence bar
 * as every other edit.
 */

const PATH = '/admin/sponsors';

function back(params: Record<string, string>): never {
  redirect(`${PATH}?${new URLSearchParams(params).toString()}`);
}

export async function recordClaimReviewAction(formData: FormData): Promise<void> {
  requireAdmin();

  const sponsorId = String(formData.get('sponsor_id') ?? '').trim();
  const raw = String(formData.get('decision') ?? '');
  const decision: ClaimDecision | null =
    raw === 'verified' ? 'verified' : raw === 'rejected' ? 'rejected' : null;

  if (!sponsorId || !decision) back({ view: 'directory', err: 'Nothing was recorded.' });

  const review: ClaimReview = {
    decision,
    reviewer: String(formData.get('reviewer') ?? ''),
    confirmed: CLAIM_CHECKLIST.map((c) => c.id).filter((id) => formData.get(`check:${id}`) != null),
    reason: String(formData.get('reason') ?? ''),
  };

  const blockers = reviewBlockers(review);
  if (blockers.length) back({ view: 'directory', err: blockers.join(' ').slice(0, 400) });

  const supabase = createAdminClient();
  const { data, error: readErr } = await supabase
    .from('sponsors')
    .select('notes, tier_interest')
    .eq('id', sponsorId)
    .single();
  if (readErr || !data) back({ view: 'directory', err: 'That inquiry could not be loaded.' });

  const row = data as { notes: string | null; tier_interest: string | null };
  // Only a claim can be claim-reviewed. A paid placement inquiry is a different
  // conversation and is handled on the placements console.
  if ((row.tier_interest ?? '').trim() !== 'listing-claim')
    back({
      view: 'directory',
      err: 'That inquiry is not a listing claim. Paid placements are handled on the placements console.',
    });

  const at = new Date().toISOString();
  const line = reviewNoteLine(review, at);
  const notes = (row.notes ?? '').trim();

  const { error } = await supabase
    .from('sponsors')
    .update({
      stage: CLAIM_DECISION_STAGE[review.decision],
      notes: notes ? `${notes}\n\n${line}` : line,
    })
    .eq('id', sponsorId);
  if (error) back({ view: 'directory', err: 'The update failed. Nothing was recorded.' });

  // Append-only audit entry. Best effort: the decision itself already stands.
  try {
    await supabase.from('sponsor_touches').insert({
      sponsor_id: sponsorId,
      touch_type: 'other',
      direction: 'outbound',
      summary: reviewTouchSummary(review),
    });
  } catch {
    /* ignore */
  }

  revalidatePath(PATH);
  back({
    view: 'directory',
    ok: `Claim ${review.decision}. The listing itself was not changed.`,
  });
}
