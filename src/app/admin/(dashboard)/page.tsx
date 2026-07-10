import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { getCounts } from '@/lib/admin/data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Overview', robots: { index: false, follow: false } };

export default async function AdminOverviewPage() {
  requireAdmin();
  const counts = await getCounts();

  const cards = [
    { href: '/admin/directory', label: 'Directory listings', n: counts.directory },
    { href: '/admin/applications', label: 'Applications', n: counts.applications },
    { href: '/admin/founders', label: 'Founders', n: counts.founders },
    { href: '/admin/sponsors', label: 'Sponsors', n: counts.sponsors },
  ];

  return (
    <div>
      <h1 className="display-section mb-2">Dashboard</h1>
      <p className="mb-8 text-muted">
        Trucking Life Academy — applications, founders, and sponsors.
      </p>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-card border border-line bg-asphalt-800 p-6 transition-colors hover:border-signal"
          >
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">{c.label}</p>
            <p className="mt-2 font-display text-4xl text-signal">{c.n}</p>
            <p className="mt-2 text-sm text-muted">View all →</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
