import { requireAdmin } from '@/lib/admin/auth';
import { getFounders } from '@/lib/admin/data';
import { FOUNDER_STATUSES } from '@/lib/admin/status';
import { StatusSelect } from '@/components/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Founders', robots: { index: false, follow: false } };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const fmtAmount = (cents: number) => `$${Math.round((cents ?? 0) / 100).toLocaleString('en-US')}`;

export default async function AdminFoundersPage() {
  requireAdmin();
  const { rows, error } = await getFounders();

  return (
    <div>
      <h1 className="display-section mb-6">
        Founders <span className="text-lg text-muted">({rows.length})</span>
      </h1>

      {error && (
        <p className="mb-6 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel">
          Couldn’t load founders: {error}
        </p>
      )}

      {!error && rows.length === 0 && <p className="text-muted">No founders yet.</p>}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-asphalt-800 text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Message</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-ink">{r.display_name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink">
                    {fmtAmount(r.amount_cents)}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-muted">{r.message || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    {fmtDate(r.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusSelect
                      entity="founders"
                      id={r.id}
                      current={r.status}
                      options={FOUNDER_STATUSES}
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
