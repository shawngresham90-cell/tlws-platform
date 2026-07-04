import { requireAdmin } from '@/lib/auth';

export const metadata = { title: 'Admin' };

/**
 * Protected placeholder. Proves the auth gate works end to end.
 * Real dashboard screens (applications, founders, sponsors) land in Milestone 10.
 */
export default async function AdminHome() {
  const admin = await requireAdmin('staff');

  return (
    <div>
      <p className="eyebrow mb-3">Signed in</p>
      <h1 className="display-section mb-4">Admin access confirmed</h1>
      <p className="max-w-xl text-muted">
        Welcome{admin.fullName ? `, ${admin.fullName}` : ''}. Your role is{' '}
        <span className="font-semibold text-signal">{admin.role}</span>. Dashboard screens are built
        in a later milestone — this page only confirms the route is protected.
      </p>
    </div>
  );
}
