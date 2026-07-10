import { requireAdmin } from '@/lib/admin/auth';
import { getApplications } from '@/lib/admin/data';
import { APPLICATION_STATUSES } from '@/lib/admin/status';
import { StatusSelect } from '@/components/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Applications', robots: { index: false, follow: false } };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

export default async function AdminApplicationsPage() {
  requireAdmin();
  const { rows, error } = await getApplications();

  return (
    <div>
      <h1 className="display-section mb-6">
        Applications <span className="text-lg text-muted">({rows.length})</span>
      </h1>

      {error && (
        <p className="mb-6 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel">
          Couldn’t load applications: {error}
        </p>
      )}

      {!error && rows.length === 0 && <p className="text-muted">No applications yet.</p>}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-asphalt-800 text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-ink">
                    {r.first_name} {r.last_name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{r.phone || '—'}</td>
                  <td className="px-4 py-3 text-muted">{r.email}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    {fmtDate(r.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusSelect
                      entity="applications"
                      id={r.id}
                      current={r.status}
                      options={APPLICATION_STATUSES}
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
