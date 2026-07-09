import { requireAdmin } from '@/lib/admin/auth';
import { getSponsors } from '@/lib/admin/data';
import { SPONSOR_STATUSES } from '@/lib/admin/status';
import { StatusSelect } from '@/components/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Sponsors', robots: { index: false, follow: false } };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

export default async function AdminSponsorsPage() {
  requireAdmin();
  const { rows, error } = await getSponsors();

  return (
    <div>
      <h1 className="display-section mb-6">
        Sponsors <span className="text-lg text-muted">({rows.length})</span>
      </h1>

      {error && (
        <p className="mb-6 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel">
          Couldn’t load sponsors: {error}
        </p>
      )}

      {!error && rows.length === 0 && <p className="text-muted">No sponsor leads yet.</p>}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-asphalt-800 text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Business</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Package interest</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-ink">{r.company}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    {r.contact_name || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{r.phone || '—'}</td>
                  <td className="px-4 py-3 text-muted">{r.email || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    {r.tier_interest || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    {fmtDate(r.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusSelect
                      entity="sponsors"
                      id={r.id}
                      current={r.status}
                      options={SPONSOR_STATUSES}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
