'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getModReview, reviewEditInput, MODERATION_ADMIN } from '@/lib/admin/community';
import { recordHistory } from '@/lib/admin/history';
import { reviewSchema } from '@/lib/community/schemas';

/**
 * Review moderation writes. Approval is the ONLY path that makes a driver
 * review public — the public pages and JSON-LD read status = 'approved'
 * exclusively. Each approval also drops a location_history row so a
 * listing's timeline shows when public reviews appeared.
 */

function revalidateReviews(categorySlug?: string | null) {
  revalidatePath('/admin/reviews');
  revalidatePath('/directory/reviews');
  revalidatePath('/directory');
  if (categorySlug) revalidatePath(`/directory/${categorySlug}`);
}

function markReviewed(status: 'approved' | 'rejected' | 'duplicate') {
  return {
    status,
    reviewed_by: MODERATION_ADMIN,
    reviewed_at: new Date().toISOString(),
  };
}

/** Core approval, shared by the single and bulk actions. */
async function approveOne(id: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { row, error } = await getModReview(id);
  if (error || !row) return 'Review not found.';
  if (row.status !== 'pending') return `Already ${row.status}.`;

  const historyError = await recordHistory(supabase, {
    location_id: row.location_id,
    source: 'review',
    source_id: row.id,
    admin: MODERATION_ADMIN,
    changed_fields: {},
    note: `Approved ${row.rating}-star driver review "${row.title}".`,
  });
  if (historyError) return `History write failed — review left pending: ${historyError}`;

  const { error: statusError } = await supabase
    .from('location_reviews')
    .update(markReviewed('approved'))
    .eq('id', id);
  if (statusError) return `Could not approve: ${statusError.message}`;
  return null;
}

export async function approveReviewAction(id: string): Promise<void> {
  requireAdmin();
  const { row } = await getModReview(id);
  const error = await approveOne(id);
  revalidateReviews(row?.locations?.category_slug);
  redirect(
    error ? `/admin/reviews?error=${encodeURIComponent(error)}` : '/admin/reviews?ok=approved',
  );
}

export async function rejectReviewAction(id: string): Promise<void> {
  requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('location_reviews')
    .update(markReviewed('rejected'))
    .eq('id', id)
    .eq('status', 'pending');
  revalidatePath('/admin/reviews');
  redirect(error ? '/admin/reviews?error=Could not reject.' : '/admin/reviews?ok=rejected');
}

export async function markDuplicateReviewAction(id: string): Promise<void> {
  requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('location_reviews')
    .update(markReviewed('duplicate'))
    .eq('id', id);
  revalidatePath('/admin/reviews');
  redirect(error ? '/admin/reviews?error=Could not update.' : '/admin/reviews?ok=duplicate');
}

/** Hard delete — for spam/abuse. */
export async function deleteReviewAction(id: string): Promise<void> {
  requireAdmin();
  const supabase = createAdminClient();
  const { row } = await getModReview(id);
  const wasApproved = row?.status === 'approved';
  const { error } = await supabase.from('location_reviews').delete().eq('id', id);
  if (!error && wasApproved) revalidateReviews(row?.locations?.category_slug);
  else revalidatePath('/admin/reviews');
  redirect(error ? '/admin/reviews?error=Could not delete.' : '/admin/reviews?ok=deleted');
}

/** Bulk approve / reject over the checked rows. */
export async function bulkReviewsAction(formData: FormData): Promise<void> {
  requireAdmin();
  const ids = formData.getAll('ids').map(String).filter(Boolean);
  const op = formData.get('op');
  if (ids.length === 0) redirect('/admin/reviews?error=Check at least one review first.');

  let done = 0;
  let failed = 0;
  let firstError = '';
  if (op === 'approve') {
    for (const id of ids) {
      const error = await approveOne(id);
      if (error) {
        failed += 1;
        if (!firstError) firstError = error;
      } else done += 1;
    }
  } else {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('location_reviews')
      .update(markReviewed('rejected'))
      .in('id', ids)
      .eq('status', 'pending');
    if (error) {
      failed = ids.length;
      firstError = error.message;
    } else done = ids.length;
  }

  revalidateReviews();
  if (failed > 0) {
    redirect(
      `/admin/reviews?error=${encodeURIComponent(
        `${done} ${op === 'approve' ? 'approved' : 'rejected'}, ${failed} failed: ${firstError}`,
      )}`,
    );
  }
  redirect(`/admin/reviews?ok=${op === 'approve' ? 'bulk-approved' : 'bulk-rejected'}&n=${done}`);
}

/** Save edits to a review (edit-before-approve: typos, name cleanup). */
export async function saveReviewAction(id: string, formData: FormData): Promise<void> {
  requireAdmin();
  const { row, error: loadError } = await getModReview(id);
  if (loadError || !row) redirect('/admin/reviews?error=Review not found.');

  const parsed = reviewSchema.safeParse(reviewEditInput(formData, row!.location_id));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    redirect(
      `/admin/reviews/${id}?error=${encodeURIComponent(
        `${first.path.join('.') || 'form'}: ${first.message}`,
      )}`,
    );
  }
  const d = parsed.data!;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('location_reviews')
    .update({
      rating: d.rating,
      title: d.title,
      body: d.body,
      visited_on: d.visited_on ?? null,
      truck_type: d.truck_type ?? null,
      reviewer_name: d.reviewer_name ?? null,
      admin_note: String(formData.get('admin_note') ?? '').trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error)
    redirect(`/admin/reviews/${id}?error=${encodeURIComponent(`Could not save: ${error.message}`)}`);

  // An edited already-approved review changes public content.
  if (row!.status === 'approved') revalidateReviews(row!.locations?.category_slug);
  revalidatePath(`/admin/reviews/${id}`);
  revalidatePath('/admin/reviews');
  redirect(`/admin/reviews/${id}?ok=saved`);
}
