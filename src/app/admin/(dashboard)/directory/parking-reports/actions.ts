'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Triage a driver parking report. This updates the SUBMISSION row only.
 *
 * It cannot reach `public.locations`: the update is scoped to
 * `location_submissions` by id, and the status vocabulary contains no value
 * that means "apply to the listing". Publishing or correcting authoritative
 * data remains a separate, evidenced action outside this queue.
 */
const ALLOWED = new Set(['pending', 'rejected', 'duplicate']);

export async function setReportStatus(formData: FormData): Promise<void> {
  requireAdmin();
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');

  // Fail closed on anything unexpected rather than guessing.
  if (!/^[0-9a-f-]{36}$/i.test(id) || !ALLOWED.has(status)) return;

  const supabase = createAdminClient();
  await supabase
    .from('location_submissions')
    .update({
      status,
      reviewed_by: 'admin',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id);

  revalidatePath('/admin/directory/parking-reports');
}
