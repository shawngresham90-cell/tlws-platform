import { requireAdmin } from '@/lib/admin/auth';
import { getLeads } from '@/lib/admin/data';
import { segmentFor, utmSummary } from '@/lib/leads/funnel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Leads', robots: { index: false, follow: false } };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

/**
 * Read-only lead funnel view. Server-gated by requireAdmin(); force-dynamic
 * + noindex so nothing private is cached or crawlable. No mutation controls,
 * no sends, no exports — a read of the existing `leads` table only. Phone is
 * intentionally omitted (not operationally necessary for the funnel list).
 */
export default async function AdminLeadsPage() {
  requireAdmin();
  const { rows, error } = await getLeads();

  // Per-segment counts for ready-made send lists (display only).
  const counts = new Map<string, { label: string; n: number }>();
  for (const r of rows) {
    const seg = segmentFor(r.source);
    const prev = counts.get(seg.key);
    counts.set(seg.key, { label: seg.label, n: (prev?.n ?? 0) + 1 });
  }

  return (
    <div>
      <h1 className="display-section mb-6">
        Leads <span className="text-lg text-muted">({rows.length})</span>
      </h1>

      {error && (
        <p className="mb-6 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300">
          Couldn’t load leads: {error}
        </p>
      )}

      {!error && rows.length === 0 && <p className="text-muted">No leads captured yet.</p>}

      {rows.length > 0 && (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {[...counts.values()].map((c) => (
              <span
                key={c.label}
                className="rounded-card border border-line bg-asphalt-800 px-3 py-1.5 text-xs font-semibold text-muted"
              >
                {c.label}: <span className="text-ink">{c.n}</span>
              </span>
            ))}
          </div>

          <div className="overflow-x-auto rounded-card border border-line">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-asphalt-800 text-left text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">First name</th>
                  <th className="px-4 py-3 font-semibold">Source</th>
                  <th className="px-4 py-3 font-semibold">Segment</th>
                  <th className="px-4 py-3 font-semibold">Campaign</th>
                  <th className="px-4 py-3 font-semibold">SMS consent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const seg = segmentFor(r.source);
                  const campaign = utmSummary(r.utm);
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">
                        {fmtDate(r.created_at)}
                      </td>
                      <td className="px-4 py-3 text-ink">{r.email}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">
                        {r.first_name || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{r.source || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{seg.label}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{campaign || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {r.sms_consent ? (
                          <span className="font-semibold text-marker">Yes</span>
                        ) : (
                          <span className="text-muted">No</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-muted">
            Read-only. This view never sends, exports, edits, or deletes. Phone numbers are omitted
            here by design.
          </p>
        </>
      )}
    </div>
  );
}
