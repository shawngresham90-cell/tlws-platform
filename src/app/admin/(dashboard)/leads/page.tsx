import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { getLeads, getLeadTally } from '@/lib/admin/data';
import {
  LEAD_SOURCES,
  leadFilterParam,
  parseLeadFilter,
  segmentFor,
  utmSummary,
} from '@/lib/leads/funnel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Leads', robots: { index: false, follow: false } };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

/**
 * Read-only lead funnel view. Server-gated by requireAdmin(); force-dynamic
 * + noindex so nothing private is cached or crawlable. No mutation controls,
 * no sends, no exports — a read of the existing `leads` table only. Phone is
 * not fetched at all (see lib/admin/data.ts).
 *
 * COUNTS COME FROM THE DATABASE, NOT FROM `rows`. Every number on this page
 * used to be a `.length` over the fetched array, which is the same thing only
 * while the whole table fits in one fetch. Past that the heading and the
 * segment chips would have described one page of leads while presenting
 * themselves as the list — under-reporting with no visible sign. The tally is
 * now separate count queries over the whole table, and the list says plainly
 * when it is showing a prefix of it.
 *
 * Chips are labelled by segment because that is how the owner plans a send, and
 * each canonical source maps to its own segment — a fact the funnel tests
 * assert, since two sources sharing a label would render two identical chips
 * that filter differently.
 */
export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  requireAdmin();

  const filter = parseLeadFilter(searchParams?.source);
  const [{ rows, error, total, truncated }, tally] = await Promise.all([
    getLeads(filter),
    getLeadTally(),
  ]);

  const href = (param: string) => (param ? `/admin/leads?source=${param}` : '/admin/leads');
  const active = leadFilterParam(filter);
  const chips = [
    { param: '', label: 'All', n: tally.total },
    ...LEAD_SOURCES.map((s) => ({ param: s, label: segmentFor(s).label, n: tally.bySource[s] })),
    { param: 'other', label: segmentFor(null).label, n: tally.other },
  ];

  const loadError = error ?? tally.error;

  return (
    <div>
      <h1 className="display-section mb-6">
        Leads <span className="text-lg text-muted">({tally.total})</span>
      </h1>

      {loadError && (
        <p className="mb-6 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300">
          Couldn’t load leads: {loadError}
        </p>
      )}

      {!loadError && tally.total === 0 && <p className="text-muted">No leads captured yet.</p>}

      {tally.total > 0 && (
        <>
          {/* A chip with zero behind it stays visible and clickable: "no
              founder leads yet" is information, and hiding the chip would make
              an empty segment indistinguishable from one that does not exist. */}
          <nav aria-label="Filter leads by source" className="mb-6 flex flex-wrap gap-2">
            {chips.map((c) => (
              <Link
                key={c.param || 'all'}
                href={href(c.param)}
                aria-current={active === c.param ? 'page' : undefined}
                className={`rounded-card border px-3 py-1.5 text-sm ${
                  active === c.param
                    ? 'border-signal bg-signal font-semibold text-asphalt'
                    : 'border-line text-muted hover:text-ink'
                }`}
              >
                {c.label} ({c.n})
              </Link>
            ))}
          </nav>

          <p className="mb-4 text-sm text-muted">
            {truncated ? (
              <>
                Showing the {rows.length} most recent of <span className="text-ink">{total}</span> in
                this view. Older leads are in the table but not on this page.
              </>
            ) : (
              <>
                Showing all <span className="text-ink">{total}</span> in this view.
              </>
            )}
          </p>

          {!error && rows.length === 0 && <p className="text-muted">No leads from this source.</p>}

          {rows.length > 0 && (
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
                        <td className="whitespace-nowrap px-4 py-3 text-muted">
                          {r.source || '—'}
                        </td>
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
          )}

          <p className="mt-4 text-xs text-muted">
            Read-only. This view never sends, exports, edits, or deletes. Phone numbers are not
            loaded here by design.
          </p>
        </>
      )}
    </div>
  );
}
