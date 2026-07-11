'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getSubmission,
  submissionPatch,
  creationChanges,
  submissionEditInput,
  MODERATION_ADMIN,
  type SubmissionRow,
} from '@/lib/admin/community';
import { recordHistory } from '@/lib/admin/history';
import { submissionSchema } from '@/lib/community/schemas';
import { dbTypeFor, slugify } from '@/lib/directory/admin';

/**
 * Submission moderation writes. Every action: admin gate → service-role
 * write. Approval is the ONLY path from a driver submission into
 * public.locations, and each applied change writes a location_history row
 * BEFORE the listing mutates (a failed history write aborts the change).
 * Approving a 'new' submission creates the listing UNPUBLISHED — publishing
 * stays a separate, deliberate admin step.
 */

function revalidateDirectory(categorySlug?: string | null) {
  revalidatePath('/admin/submissions');
  revalidatePath('/admin/directory');
  revalidatePath('/directory');
  if (categorySlug) revalidatePath(`/directory/${categorySlug}`);
}

function markReviewed(status: 'approved' | 'rejected' | 'duplicate' | 'merged') {
  return {
    status,
    reviewed_by: MODERATION_ADMIN,
    reviewed_at: new Date().toISOString(),
  };
}

/** Core approval, shared by the single and bulk actions. */
async function approveOne(id: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { row: sub, error } = await getSubmission(id);
  if (error || !sub) return 'Submission not found.';
  if (sub.status !== 'pending') return `Already ${sub.status}.`;

  if (sub.kind === 'new') {
    if (!sub.category_slug) return 'Add a category before approving (Edit).';
    if (!sub.city || !sub.state) return 'Add city and state before approving (Edit).';

    const row = {
      name: sub.name,
      category_slug: sub.category_slug,
      type: dbTypeFor(sub.category_slug),
      slug: slugify(sub.name),
      address: sub.address,
      city: sub.city,
      state: sub.state.toUpperCase(),
      zip: sub.zip,
      phone: sub.phone,
      website: sub.website,
      description: sub.description,
      amenities: sub.amenities ?? [],
      free_parking: sub.free_parking ?? false,
      paid_parking: sub.paid_parking ?? false,
      reserved_parking: sub.reserved_parking ?? false,
      overnight_parking: sub.overnight_parking ?? false,
      parking_spaces: sub.parking_spaces,
      is_published: false, // publishing is a separate, deliberate step
      is_featured: false,
      is_indexable: false,
      source: 'community',
    };
    const { data: created, error: insertError } = await supabase
      .from('locations')
      .insert(row)
      .select('id')
      .single();
    if (insertError || !created) {
      return insertError?.code === '23505'
        ? 'A listing with this name already exists in that city — edit the name or merge instead.'
        : `Could not create the listing: ${insertError?.message ?? 'unknown error'}`;
    }
    const historyError = await recordHistory(supabase, {
      location_id: created.id,
      source: 'submission',
      source_id: sub.id,
      admin: MODERATION_ADMIN,
      changed_fields: creationChanges(row),
      note: `Driver submission approved — created unpublished listing "${sub.name}".`,
    });
    if (historyError) return `Listing created but history failed: ${historyError}`;
  } else {
    if (!sub.location_id) return 'This report has no target listing.';
    const { data: loc, error: locError } = await supabase
      .from('locations')
      .select('*')
      .eq('id', sub.location_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (locError || !loc) return 'The target listing no longer exists.';

    const { patch, changed } = submissionPatch(sub, loc as Record<string, unknown>);
    if (Object.keys(patch).length > 0) {
      // History FIRST — the listing is never overwritten without a record.
      const historyError = await recordHistory(supabase, {
        location_id: sub.location_id,
        source: sub.kind === 'closure' ? 'closure' : 'submission',
        source_id: sub.id,
        admin: MODERATION_ADMIN,
        changed_fields: changed,
        note:
          sub.kind === 'closure'
            ? `Closure report approved — unpublished "${sub.name}".`
            : `Driver ${sub.kind} approved for "${sub.name}".`,
      });
      if (historyError) return `History write failed — listing left untouched: ${historyError}`;

      const { error: updateError } = await supabase
        .from('locations')
        .update(patch)
        .eq('id', sub.location_id);
      if (updateError) return `Could not update the listing: ${updateError.message}`;
    }
  }

  const { error: statusError } = await supabase
    .from('location_submissions')
    .update(markReviewed('approved'))
    .eq('id', id);
  if (statusError) return `Change applied but status update failed: ${statusError.message}`;
  return null;
}

export async function approveSubmissionAction(id: string): Promise<void> {
  requireAdmin();
  const error = await approveOne(id);
  const { row } = await getSubmission(id);
  revalidateDirectory(row?.locations?.category_slug ?? row?.category_slug);
  redirect(error ? `/admin/submissions?error=${encodeURIComponent(error)}` : '/admin/submissions?ok=approved');
}

export async function rejectSubmissionAction(id: string): Promise<void> {
  requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('location_submissions')
    .update(markReviewed('rejected'))
    .eq('id', id)
    .eq('status', 'pending');
  revalidatePath('/admin/submissions');
  redirect(error ? '/admin/submissions?error=Could not reject.' : '/admin/submissions?ok=rejected');
}

export async function markDuplicateSubmissionAction(id: string): Promise<void> {
  requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('location_submissions')
    .update(markReviewed('duplicate'))
    .eq('id', id);
  revalidatePath('/admin/submissions');
  redirect(
    error ? '/admin/submissions?error=Could not update.' : '/admin/submissions?ok=duplicate',
  );
}

/** Hard delete — for spam. Moderation decisions should use reject instead. */
export async function deleteSubmissionAction(id: string): Promise<void> {
  requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from('location_submissions').delete().eq('id', id);
  revalidatePath('/admin/submissions');
  redirect(error ? '/admin/submissions?error=Could not delete.' : '/admin/submissions?ok=deleted');
}

/** Bulk approve / reject over the checked rows. */
export async function bulkSubmissionsAction(formData: FormData): Promise<void> {
  requireAdmin();
  const ids = formData.getAll('ids').map(String).filter(Boolean);
  const op = formData.get('op');
  if (ids.length === 0) redirect('/admin/submissions?error=Check at least one submission first.');

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
      .from('location_submissions')
      .update(markReviewed('rejected'))
      .in('id', ids)
      .eq('status', 'pending');
    if (error) {
      failed = ids.length;
      firstError = error.message;
    } else done = ids.length;
  }

  revalidateDirectory();
  if (failed > 0) {
    redirect(
      `/admin/submissions?error=${encodeURIComponent(
        `${done} ${op === 'approve' ? 'approved' : 'rejected'}, ${failed} failed: ${firstError}`,
      )}`,
    );
  }
  redirect(`/admin/submissions?ok=${op === 'approve' ? 'bulk-approved' : 'bulk-rejected'}&n=${done}`);
}

/** Save edits to a pending submission (edit-before-approve). */
export async function saveSubmissionAction(id: string, formData: FormData): Promise<void> {
  requireAdmin();
  const { row: sub, error: loadError } = await getSubmission(id);
  if (loadError || !sub) redirect('/admin/submissions?error=Submission not found.');

  const parsed = submissionSchema.safeParse(
    submissionEditInput(formData, sub!.kind, sub!.location_id),
  );
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    redirect(
      `/admin/submissions/${id}?error=${encodeURIComponent(
        `${first.path.join('.') || 'form'}: ${first.message}`,
      )}`,
    );
  }
  const d = parsed.data!;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('location_submissions')
    .update({
      name: d.name,
      category_slug: d.category_slug ?? null,
      address: d.address ?? null,
      city: d.city ?? null,
      state: d.state ?? null,
      zip: d.zip ?? null,
      phone: d.phone ?? null,
      website: d.website ?? null,
      description: d.description ?? null,
      amenities: d.amenities,
      free_parking: d.free_parking,
      paid_parking: d.paid_parking,
      reserved_parking: d.reserved_parking,
      overnight_parking: d.overnight_parking,
      parking_spaces: d.parking_spaces ?? null,
      comments: d.comments ?? null,
      submitter_name: d.submitter_name ?? null,
      submitter_contact: d.submitter_contact ?? null,
      admin_note: String(formData.get('admin_note') ?? '').trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error)
    redirect(
      `/admin/submissions/${id}?error=${encodeURIComponent(`Could not save: ${error.message}`)}`,
    );

  revalidatePath(`/admin/submissions/${id}`);
  revalidatePath('/admin/submissions');
  redirect(`/admin/submissions/${id}?ok=saved`);
}

/**
 * Merge a 'new' submission into an existing listing: provided fields fill the
 * target's blanks (missing-info semantics — nothing kept is overwritten),
 * history records the fill, and the submission is marked 'merged'.
 */
export async function mergeSubmissionAction(id: string, formData: FormData): Promise<void> {
  requireAdmin();
  const targetId = String(formData.get('target_id') ?? '');
  if (!targetId) redirect(`/admin/submissions/${id}?error=Pick a listing to merge into.`);

  const supabase = createAdminClient();
  const { row: sub } = await getSubmission(id);
  if (!sub) redirect('/admin/submissions?error=Submission not found.');
  const subRow = sub as SubmissionRow;

  const { data: loc, error: locError } = await supabase
    .from('locations')
    .select('*')
    .eq('id', targetId)
    .is('deleted_at', null)
    .maybeSingle();
  if (locError || !loc) redirect(`/admin/submissions/${id}?error=Target listing not found.`);

  // Fill-only patch regardless of the submission's kind.
  const { patch, changed } = submissionPatch(
    { ...subRow, kind: 'missing-info' },
    loc as Record<string, unknown>,
  );
  if (Object.keys(patch).length > 0) {
    const historyError = await recordHistory(supabase, {
      location_id: targetId,
      source: 'merge',
      source_id: subRow.id,
      admin: MODERATION_ADMIN,
      changed_fields: changed,
      note: `Driver submission "${subRow.name}" merged into this listing.`,
    });
    if (historyError)
      redirect(`/admin/submissions/${id}?error=${encodeURIComponent(historyError)}`);
    const { error: updateError } = await supabase.from('locations').update(patch).eq('id', targetId);
    if (updateError)
      redirect(`/admin/submissions/${id}?error=${encodeURIComponent(updateError.message)}`);
  }

  const { error: statusError } = await supabase
    .from('location_submissions')
    .update({ ...markReviewed('merged'), location_id: targetId })
    .eq('id', id);
  if (statusError)
    redirect(`/admin/submissions/${id}?error=${encodeURIComponent(statusError.message)}`);

  const category = (loc as { category_slug?: string | null }).category_slug;
  revalidateDirectory(category);
  redirect('/admin/submissions?ok=merged');
}
