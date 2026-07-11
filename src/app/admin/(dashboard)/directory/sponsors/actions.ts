'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSafeSponsorUrl, SPONSOR_PLACEMENTS, type SponsorPlacement } from '@/lib/directory/sponsors';

/**
 * Sponsor management writes (Milestone 25). Admin-gated. Every write goes
 * through the service role and validates the outbound URL server-side
 * (isSafeSponsorUrl) so an unsafe or fabricated URL is never stored. Fails soft
 * when migration 024 is unapplied — the insert/update simply no-ops and the
 * page keeps working. No sponsor records are created by the milestone itself.
 */

const PATH = '/admin/directory/sponsors';

function list(formData: FormData, key: string): string[] {
  return String(formData.get(key) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createSponsorAction(formData: FormData): Promise<void> {
  requireAdmin();
  const name = String(formData.get('name') ?? '').trim();
  const url = String(formData.get('url') ?? '').trim();
  // Reject empty names and any URL that isn't a safe http(s) link.
  if (!name || !isSafeSponsorUrl(url)) {
    revalidatePath(PATH);
    return;
  }
  const placements = SPONSOR_PLACEMENTS.map((p) => p.value).filter(
    (v) => formData.get(`placement:${v}`) != null,
  ) as SponsorPlacement[];
  try {
    const supabase = createAdminClient();
    await supabase.from('directory_sponsors').insert({
      name,
      url,
      tagline: String(formData.get('tagline') ?? '').trim() || null,
      logo: String(formData.get('logo') ?? '').trim() || null,
      placements,
      states: list(formData, 'states').map((s) => s.toUpperCase()),
      interstates: list(formData, 'interstates'),
      categories: list(formData, 'categories'),
      active: true,
    });
  } catch {
    // Migration 024 unapplied or DB hiccup — no-op.
  }
  revalidatePath(PATH);
}

export async function setSponsorActiveAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '');
  const active = String(formData.get('active') ?? '') === 'true';
  if (!id) return;
  try {
    const supabase = createAdminClient();
    await supabase
      .from('directory_sponsors')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', id);
  } catch {
    /* no-op */
  }
  revalidatePath(PATH);
}

export async function deleteSponsorAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  try {
    const supabase = createAdminClient();
    await supabase.from('directory_sponsors').delete().eq('id', id);
  } catch {
    /* no-op */
  }
  revalidatePath(PATH);
}
