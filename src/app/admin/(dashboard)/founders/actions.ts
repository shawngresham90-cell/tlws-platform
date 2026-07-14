'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  dollarsToCents,
  FOUNDER_TIER_VALUES,
  isValidBusinessUrl,
} from '@/lib/admin/founders';

/**
 * Academy Founders Wall admin actions. Every action: requireAdmin() →
 * server-side validation → service-role mutation → revalidate every surface
 * that shows campaign numbers (/, /founders, /academy, admin) → redirect with
 * ?ok/?error. Totals are never written by these actions — the public numbers
 * come from the campaign_progress view, so publishing/unpublishing/deleting a
 * founder updates every thermometer automatically on the next revalidation.
 *
 * NEVER touches CDL Pre-School tables.
 */

function finish(error?: string | null, okCode?: string): never {
  revalidatePath('/admin/founders');
  revalidatePath('/founders');
  revalidatePath('/academy');
  revalidatePath('/');
  redirect(
    error
      ? `/admin/founders?error=${encodeURIComponent(error)}`
      : `/admin/founders?ok=${okCode ?? 'done'}`,
  );
}

/** Shared form → row mapping with validation. Returns row or an error string. */
function founderInput(formData: FormData): { row?: Record<string, unknown>; error?: string } {
  const anonymous = formData.get('is_anonymous') === 'on';
  const rawName = String(formData.get('display_name') ?? '').trim();
  // Anonymous follows the wall's existing naming convention — the public name
  // IS "Anonymous Founder"; keep the donor's identity in your own records.
  const displayName = anonymous ? 'Anonymous Founder' : rawName;
  if (displayName.length < 2 || displayName.length > 80) {
    return { error: 'Display name must be 2–80 characters (or check Anonymous).' };
  }
  const tier = String(formData.get('tier') ?? '');
  if (!(FOUNDER_TIER_VALUES as readonly string[]).includes(tier)) {
    return { error: 'Pick a valid founder tier.' };
  }
  const businessName = String(formData.get('business_name') ?? '').trim();
  const businessUrl = String(formData.get('business_url') ?? '').trim();
  if (businessUrl && !isValidBusinessUrl(businessUrl)) {
    return { error: 'Business URL must be a full https:// address.' };
  }
  const amountRaw = String(formData.get('amount') ?? '').trim();
  const amountCents = amountRaw === '' ? null : dollarsToCents(amountRaw);
  if (amountRaw !== '' && amountCents === null) {
    return { error: 'Amount must be a non-negative dollar figure (e.g. 500).' };
  }
  const positionRaw = String(formData.get('position') ?? '').trim();
  let position: number | null = null;
  if (positionRaw !== '') {
    const n = Number(positionRaw);
    if (!Number.isInteger(n) || n < 1 || n > 999) return { error: 'Position must be 1–999.' };
    position = n;
  }
  const message = String(formData.get('message') ?? '').trim();
  return {
    row: {
      display_name: anonymous ? 'Anonymous Founder' : displayName,
      business_name: anonymous ? null : businessName || null,
      business_url: anonymous ? null : businessUrl || null,
      tier,
      amount_cents: amountCents,
      position,
      message: message || null,
      is_public: formData.get('is_public') === 'on',
    },
  };
}

export async function addFounderAction(formData: FormData): Promise<void> {
  requireAdmin();
  const { row, error: vErr } = founderInput(formData);
  if (vErr || !row) finish(vErr);
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('founders')
    .insert({ ...row, status: 'approved', paid_at: new Date().toISOString() });
  finish(error ? `Could not add the founder: ${error.message}` : null, 'added');
}

export async function updateFounderAction(id: string, formData: FormData): Promise<void> {
  requireAdmin();
  const { row, error: vErr } = founderInput(formData);
  if (vErr || !row) finish(vErr);
  const supabase = createAdminClient();
  const { error } = await supabase.from('founders').update(row).eq('id', id);
  finish(error ? `Could not save the founder: ${error.message}` : null, 'saved');
}

export async function deleteFounderAction(id: string): Promise<void> {
  requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from('founders').delete().eq('id', id);
  finish(error ? `Could not delete the founder: ${error.message}` : null, 'deleted');
}

export async function setFounderPublishedAction(id: string, publish: boolean): Promise<void> {
  requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from('founders').update({ is_public: publish }).eq('id', id);
  finish(
    error ? 'Could not update visibility.' : null,
    publish ? 'published' : 'unpublished',
  );
}

/** Change the campaign goal (singleton row) — guarded by an explicit confirm in the UI. */
export async function updateGoalAction(formData: FormData): Promise<void> {
  requireAdmin();
  const cents = dollarsToCents(String(formData.get('goal') ?? ''));
  if (cents === null || cents <= 0) finish('Goal must be a positive dollar amount.');
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('campaign_settings')
    .update({ goal_cents: cents })
    .eq('id', true);
  finish(error ? `Could not update the goal: ${error.message}` : null, 'goal');
}

/**
 * Set or clear the aggregate raised override. While set, it IS the public
 * total (today: $7,100). Clearing it switches the public total to the live
 * sum of published founders' amounts — only do that once every founder row
 * carries its real amount, or the wall will show the (lower) partial sum.
 */
export async function setRaisedOverrideAction(formData: FormData): Promise<void> {
  requireAdmin();
  const supabase = createAdminClient();
  if (formData.get('clear_override') === 'on') {
    const { error } = await supabase
      .from('campaign_settings')
      .update({ raised_cents_override: null })
      .eq('id', true);
    finish(error ? `Could not switch to live sum: ${error.message}` : null, 'live-sum');
  }
  const cents = dollarsToCents(String(formData.get('raised') ?? ''));
  if (cents === null) finish('Raised override must be a non-negative dollar amount.');
  const { error } = await supabase
    .from('campaign_settings')
    .update({ raised_cents_override: cents })
    .eq('id', true);
  finish(error ? `Could not update the raised total: ${error.message}` : null, 'raised');
}
