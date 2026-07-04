import { requireAdmin } from '@/lib/auth';
import { signOut } from '@/app/auth/actions';
import { Container } from '@/components/ui';

/**
 * Every /admin route passes through here. requireAdmin() redirects anonymous
 * or non-admin users before any child page renders. Dashboard screens come
 * in a later milestone — this is the protected shell only.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin('staff');

  return (
    <div className="min-h-screen bg-asphalt">
      <div className="border-b border-line bg-asphalt-800">
        <Container className="flex h-14 items-center justify-between">
          <span className="font-display text-lg uppercase text-ink">
            Admin<span className="text-signal">.</span>
          </span>
          <div className="flex items-center gap-4 text-sm text-muted">
            <span>
              {admin.email} · <span className="text-signal">{admin.role}</span>
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-card border border-line px-3 py-1.5 text-ink transition-colors hover:border-signal hover:text-signal"
              >
                Sign out
              </button>
            </form>
          </div>
        </Container>
      </div>
      <Container className="py-10">{children}</Container>
    </div>
  );
}
