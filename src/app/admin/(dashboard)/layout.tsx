import { requireAdmin } from '@/lib/admin/auth';
import { AdminShell } from '@/components/admin';

/**
 * Gated dashboard shell. requireAdmin() redirects to /admin/login before any
 * child page renders or fetches, so no data leaks to an unauthenticated request.
 * The sibling /admin/login route is outside this group and stays public.
 */
export const dynamic = 'force-dynamic';

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
