import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { getSponsors } from '@/lib/admin/data';
import { SPONSOR_STATUSES } from '@/lib/admin/status';
import { StatusSelect } from '@/components/admin';
import { isDirectoryInquiry, parseDirectoryInquiry } from '@/lib/admin/directory-inquiry';
import { CLAIM_CHECKLIST, parseReview } from '@/lib/admin/claim-review';
import { recordClaimReviewAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Sponsors', robots: { index: false, follow: false } };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

// `next_action_date` is a bare `date`; parsing it as UTC midnight and then
// formatting locally can shift it a day, so pin it to local time first.
const fmtDay = (d: string) => fmtDate(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : d);

const VIEWS = ['all', 'directory', 'other'] as const;
type View = (typeof VIEWS)[number];

/**
 * Sponsor inbox.
 *
 * Directory claim / featured / corridor inquiries arrive through the same
 * `sponsors` pipeline as every other lead — the funnel deliberately added no
 * table and no column. What it *did* do is write the listing and the billing
 * preference as two labelled lines in `notes`, and the offer id in
 * `tier_interest`, so this view can pull them back apart into real columns
 * (see `lib/admin/directory-inquiry.ts`).
 *
 * Everything shown here is derived at read time. Nothing on this page approves
 * a claim, transfers a listing, or changes a directory record — claims stay
 * manual, and the verification checklist lives in
 * `docs/directory/claim-verification.md`.
 */
export default async function AdminSponsorsPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  requireAdmin();
  const { rows, error } = await getSponsors();

  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : (v ?? ''));
  const requested = one(searchParams?.view);
  const view: View = VIEWS.includes(requested as View) ? (requested as View) : 'all';
  const err = one(searchParams?.err);
  const ok = one(searchParams?.ok);

  const enriched = rows.map((r) => {
    const dir = parseDirectoryInquiry(r.tier_interest, r.notes);
    return { row: r, dir, isDirectory: isDirectoryInquiry(dir) };
  });

  const counts = {
    all: enriched.length,
    directory: enriched.filter((e) => e.isDirectory).length,
    other: enriched.filter((e) => !e.isDirectory).length,
  };
  const byType = {
    claim: enriched.filter((e) => e.dir.type === 'listing-claim').length,
    featured: enriched.filter((e) => e.dir.type === 'featured-listing').length,
    corridor: enriched.filter((e) => e.dir.type === 'corridor-sponsor').length,
  };

  const visible = enriched.filter((e) =>
    view === 'directory' ? e.isDirectory : view === 'other' ? !e.isDirectory : true,
  );

  return (
    <div>
      <h1 className="display-section mb-6">
        Sponsors <span className="text-lg text-muted">({rows.length})</span>
      </h1>

      {error && (
        <p className="mb-6 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300">
          Couldn’t load sponsors: {error}
        </p>
      )}

      {err && (
        <p className="mb-6 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm text-diesel-300">
          <span className="font-semibold">Refused.</span> {err}
        </p>
      )}
      {ok && (
        <p className="mb-6 rounded-card border border-signal bg-signal/10 px-4 py-3 text-sm text-ink">
          {ok}
        </p>
      )}

      {!error && rows.length === 0 && <p className="text-muted">No sponsor leads yet.</p>}

      {rows.length > 0 && (
        <>
          <nav aria-label="Filter leads" className="mb-4 flex flex-wrap gap-2">
            {VIEWS.map((v) => (
              <Link
                key={v}
                href={v === 'all' ? '/admin/sponsors' : `/admin/sponsors?view=${v}`}
                aria-current={view === v ? 'page' : undefined}
                className={`rounded-card border px-3 py-1.5 text-sm ${
                  view === v
                    ? 'border-signal bg-signal text-asphalt'
                    : 'border-line text-muted hover:text-ink'
                }`}
              >
                {v === 'all' ? 'All' : v === 'directory' ? 'Directory' : 'Other'} ({counts[v]})
              </Link>
            ))}
          </nav>

          {counts.directory > 0 && (
            <p className="mb-6 text-sm text-muted">
              Directory inquiries: {byType.claim} claim, {byType.featured} featured,{' '}
              {byType.corridor} corridor. A claim is a request to review — it never changes a
              listing on its own.
            </p>
          )}

          {visible.length === 0 && <p className="text-muted">Nothing in this view.</p>}

          {visible.length > 0 && (
            <div className="overflow-x-auto rounded-card border border-line">
              <table className="w-full min-w-[1120px] text-sm">
                <thead className="bg-asphalt-800 text-left text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Business</th>
                    <th className="px-4 py-3 font-semibold">Contact</th>
                    <th className="px-4 py-3 font-semibold">Inquiry</th>
                    <th className="px-4 py-3 font-semibold">Listing</th>
                    <th className="px-4 py-3 font-semibold">Message</th>
                    <th className="px-4 py-3 font-semibold">Pipeline</th>
                    <th className="px-4 py-3 font-semibold">Last touch</th>
                    <th className="px-4 py-3 font-semibold">Claim review</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map(({ row: r, dir, isDirectory }) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 align-top">
                        <div className="whitespace-nowrap text-ink">{r.company}</div>
                        <div className="whitespace-nowrap text-xs text-muted">
                          {r.contact_name || '—'}
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="break-all text-muted">{r.email || '—'}</div>
                        <div className="whitespace-nowrap text-xs text-muted">{r.phone || '—'}</div>
                      </td>

                      <td className="px-4 py-3 align-top">
                        {isDirectory && dir.typeLabel ? (
                          <span className="inline-block whitespace-nowrap rounded-card border border-signal px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-signal">
                            {dir.typeLabel}
                          </span>
                        ) : (
                          <span className="whitespace-nowrap text-muted">
                            {r.tier_interest || '—'}
                          </span>
                        )}
                        <div className="mt-1 whitespace-nowrap text-xs text-muted">
                          {dir.billing
                            ? `${dir.billing === 'annual' ? 'Annual' : 'Monthly'} preferred`
                            : 'No billing preference'}
                        </div>
                        <div className="mt-1 whitespace-nowrap text-xs text-muted">
                          {dir.source ? `Source: ${dir.source}` : 'Source: unknown'}
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top">
                        {dir.listingPath ? (
                          <>
                            <Link
                              href={dir.listingPath}
                              className="break-words text-signal underline"
                            >
                              {dir.listingName || dir.listingSlug}
                            </Link>
                            <div className="mt-1 whitespace-nowrap text-xs text-muted">
                              {[dir.category, dir.state, dir.corridor]
                                .filter(Boolean)
                                .join(' · ') || '—'}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      <td className="max-w-xs whitespace-pre-wrap break-words px-4 py-3 align-top text-muted">
                        {dir.message || '—'}
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="whitespace-nowrap text-muted">{r.stage || '—'}</div>
                        <div className="mt-1 text-xs text-muted">
                          {r.next_action
                            ? `Next: ${r.next_action}${
                                r.next_action_date ? ` (${fmtDay(r.next_action_date)})` : ''
                              }`
                            : 'No next action set'}
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="whitespace-nowrap text-muted">
                          {r.last_touch_at ? fmtDate(r.last_touch_at) : '—'}
                        </div>
                        <div className="mt-1 text-xs text-muted">
                          {r.last_touch_summary || `Submitted ${fmtDate(r.created_at)}`}
                        </div>
                      </td>

                      {/* Claim review. Only a free listing claim can be reviewed
                          here; a paid inquiry belongs on the placements console,
                          and the action refuses it server-side too. */}
                      <td className="px-4 py-3 align-top">
                        {dir.type !== 'listing-claim' ? (
                          <span className="text-xs text-muted">—</span>
                        ) : (
                          (() => {
                            const decided = parseReview(r.notes);
                            if (decided)
                              return (
                                <span className="whitespace-nowrap text-xs text-muted">
                                  {decided.decision === 'verified' ? 'Verified' : 'Rejected'} by{' '}
                                  {decided.reviewer} · {decided.date}
                                </span>
                              );
                            return (
                              <details className="min-w-[260px]">
                                <summary className="cursor-pointer text-xs text-signal">
                                  Review claim
                                </summary>
                                <form
                                  action={recordClaimReviewAction}
                                  className="mt-2 space-y-2 rounded-card border border-line bg-asphalt p-3"
                                >
                                  <input type="hidden" name="sponsor_id" value={r.id} />
                                  <p className="text-[11px] text-muted">
                                    Recording a decision does not change the listing. It records who
                                    decided, when, and why.
                                  </p>
                                  <ul className="space-y-1">
                                    {CLAIM_CHECKLIST.map((c) => (
                                      <li key={c.id}>
                                        <label className="flex items-start gap-2 text-[11px] text-muted">
                                          <input
                                            type="checkbox"
                                            name={`check:${c.id}`}
                                            className="mt-0.5"
                                          />
                                          <span>{c.label}</span>
                                        </label>
                                      </li>
                                    ))}
                                  </ul>
                                  <label className="block text-[11px] text-muted">
                                    Reviewer
                                    <input
                                      name="reviewer"
                                      placeholder="Shawn"
                                      className="mt-0.5 w-full rounded-card border border-line bg-asphalt-800 px-2 py-1 text-xs text-ink"
                                    />
                                  </label>
                                  <label className="block text-[11px] text-muted">
                                    Reason / notes
                                    <textarea
                                      name="reason"
                                      rows={2}
                                      className="mt-0.5 w-full rounded-card border border-line bg-asphalt-800 px-2 py-1 text-xs text-ink"
                                    />
                                  </label>
                                  <div className="flex gap-2">
                                    <button
                                      name="decision"
                                      value="verified"
                                      className="rounded-card bg-signal px-3 py-1 text-xs font-semibold uppercase text-asphalt"
                                    >
                                      Verify
                                    </button>
                                    <button
                                      name="decision"
                                      value="rejected"
                                      className="rounded-card border border-line px-3 py-1 text-xs text-ink"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </form>
                              </details>
                            );
                          })()
                        )}
                      </td>

                      <td className="px-4 py-3 align-top">
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
        </>
      )}
    </div>
  );
}
