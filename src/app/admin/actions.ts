'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  ADMIN_COOKIE_NAME,
  ADMIN_COOKIE_MAX_AGE,
  adminConfigured,
  issuedSessionToken,
  requireAdmin,
  verifyPassword,
} from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidStatus, type AdminEntity } from '@/lib/admin/status';

/** Sign in with the shared admin password → set the signed session cookie. */
export async function loginAction(formData: FormData): Promise<void> {
  const password = String(formData.get('password') ?? '');
  if (!adminConfigured()) redirect('/admin/login?error=notconfigured');
  if (!verifyPassword(password)) redirect('/admin/login?error=1');

  cookies().set(ADMIN_COOKIE_NAME, issuedSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });
  redirect('/admin');
}

export async function logoutAction(): Promise<void> {
  cookies().delete(ADMIN_COOKIE_NAME);
  redirect('/admin/login');
}

const TABLE: Record<AdminEntity, string> = {
  applications: 'applications',
  founders: 'founders',
  sponsors: 'sponsors',
};

/** Update a row's status. Admin-gated + validated against the allowed set. */
export async function updateStatusAction(
  entity: AdminEntity,
  id: string,
  status: string,
): Promise<void> {
  requireAdmin(); // redirects if the session isn't valid

  const table = TABLE[entity];
  if (!table) throw new Error('Unknown entity');
  if (!isValidStatus(entity, status)) throw new Error('Invalid status');

  const supabase = createAdminClient();
  const { error } = await supabase
    .from(table)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error('Could not update status');

  revalidatePath(`/admin/${entity}`);
  revalidatePath('/admin');
}
