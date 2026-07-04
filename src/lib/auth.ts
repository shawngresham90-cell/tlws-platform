import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export type AdminRole = 'owner' | 'admin' | 'staff';

export type AdminUser = {
  userId: string;
  email: string | null;
  role: AdminRole;
  fullName: string | null;
};

/**
 * Server-side gate for admin pages. Returns the admin record or redirects.
 * This is the REAL authorization check — middleware only handles the
 * signed-in/anonymous split; role enforcement lives here and in RLS.
 */
export async function requireAdmin(minRole: AdminRole = 'staff'): Promise<AdminUser> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('role, full_name, is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!adminRow || !adminRow.is_active) {
    // Signed in but not an admin — do not reveal /admin exists.
    redirect('/login?error=not_authorized');
  }

  const rank: Record<AdminRole, number> = { staff: 1, admin: 2, owner: 3 };
  if (rank[adminRow.role as AdminRole] < rank[minRole]) {
    redirect('/admin?error=insufficient_role');
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role: adminRow.role as AdminRole,
    fullName: adminRow.full_name,
  };
}

/** Non-redirecting variant for optional checks (e.g. conditional nav). */
export async function getAdmin(): Promise<AdminUser | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('role, full_name, is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!adminRow || !adminRow.is_active) return null;
  return {
    userId: user.id,
    email: user.email ?? null,
    role: adminRow.role as AdminRole,
    fullName: adminRow.full_name,
  };
}
