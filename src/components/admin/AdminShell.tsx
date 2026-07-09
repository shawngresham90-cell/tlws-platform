import { Container } from '@/components/ui';
import { logoutAction } from '@/app/admin/actions';
import { AdminNav } from './AdminNav';

/**
 * Admin chrome: brand, section nav, and sign-out. Rendered inside the gated
 * dashboard layout, so it only ever shows to an authenticated admin.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-asphalt">
      <div className="border-b border-line bg-asphalt-800">
        <Container className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="font-display text-lg uppercase text-ink">
              Admin<span className="text-signal">.</span>
            </span>
            <AdminNav />
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-card border border-line px-3 py-1.5 text-sm text-ink transition-colors hover:border-signal hover:text-signal"
            >
              Sign out
            </button>
          </form>
        </Container>
      </div>
      <Container className="py-8">{children}</Container>
    </div>
  );
}
