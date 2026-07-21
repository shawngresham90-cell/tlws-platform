import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { getSubmissions, PAGE_SIZE } from '@/lib/admin/community';
import { SUBMISSION_KINDS } from '@/lib/community/schemas';
import { ConfirmSubmit } from '@/components/admin/directory/ConfirmSubmit';
import { approveSubmissionAction, rejectSubmissionAction, bulkSubmissionsAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Submissions', robots: { index: false, follow: false } };

const KIND_LABELS: Record<string, string> = {
  new: 'New location',
  correction: 'Correction',
  closure: 'Closure',
  'missing-info': 'Missing info',
  'amenity-change': 'Amenity change',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'text-signal',
  approved: 'text-signal',
  rejected: 'text-diesel-300',
  duplicate: 'text-muted',
  merged: 'text-muted',
};

const OK_MESSAGES: Record<string, string> = {
  approved: 'Submission approved and applied.',
  rejected: 'Submission rejected.',
  duplicate: 'Submission marked as duplicate.',
  deleted: 'Submission deleted.',
  merged: 'Submission merged into the listing.',
  saved: 'Submission saved.',
  'bulk-approved': 'Selected submissions approved.',
  'bulk-rejected': 'Selected submissions rejected.',
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const inputClasses =
  'rounded-card border border-line bg-asphalt px-3 py-2 text-sm text-ink placeholder:text-muted/60 ' +
  'focus:border-signal focus:outline-none';
const smallBtn =
  'rounded-card border border-line px-2.5 py-1 text-xs font-semibold text-ink transition-colors ' +
  'hover:border-signal hover:text-signal';

type Search = {
  q?: string;
  kind?: string;
  status?: string;
  page?: string;
  ok?: string;
  error?: string;
  n?: string;
};

function pageHref(searchParams: Search, page: number): string {
  const params = new URLSearchParams();
  for (const k of ['q', 'kind', 'status'] as const) {
    if (searchParams[k]) params.set(k, searchParams[k]!);
  }
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return `/admin/submissions${qs ? `?${qs}` : ''}`;
}

export default async function AdminSubmissionsPage({ searchParams }: { searchParams: Search }) {
  requireAdmin();

  // The queue defaults to pending — 'all' shows everything.
  const status = searchParams.status ?? 'pending';
  const filters = {
    q: searchParams.q,
    kind: searchParams.kind,
    status: status === 'all' ? '' : status,
  };
  const page = Math.max(1, Number(searchParams.page) || 1);
  const { rows, total, error } = await getSubmissions(filters, page);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const ok = searchParams.ok
    ? `${OK_MESSAGES[searchParams.ok] ?? 'Done.'}${searchParams.n ? ` (${searchParams.n})` : ''}`
    : null;
  const err = searchParams.error ?? null;
  const showBulk = rows.some((r) => r.status === 'pending');

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="display-section">
          Submissions <span className="text-lg text-muted">({total})</span>
        </h1>
        <Link
          href="/directory/submit"
          className="text-sm font-semibold text-muted hover:text-signal"
        >
          View public form →
        </Link>
      </div>

      {ok && (
        <p className="mb-4 rounded-card border border-signal/50 bg-signal/10 px-4 py-3 text-sm font-medium text-signal">
          {ok}
        </p>
      )}
      {(err || error) && (
        <p className="mb-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300">
          {err ?? `Couldn’t load submissions: ${error}`}
        </p>
      )}

      {/* Search + filters (GET form — shareable URLs, server-side filtering) */}
      <form method="GET" className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="q" className="mb-1 block text-xs font-semibold text-muted">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={searchParams.q ?? ''}
            placeholder="Name, city, submitter…"
            className={`${inputClasses} w-60`}
          />
        </div>
        <div>
          <label htmlFor="kind" className="mb-1 block text-xs font-semibold text-muted">
            Kind
          </label>
          <select
            id="kind"
            name="kind"
            defaultValue={searchParams.kind ?? ''}
            className={inputClasses}
          >
            <option value="">All kinds</option>
            {SUBMISSION_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-xs font-semibold text-muted">
            Status
          </label>
          <select id="status" name="status" defaultValue={status} className={inputClasses}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="duplicate">Duplicate</option>
            <option value="merged">Merged</option>
            <option value="all">All</option>
          </select>
        </div>
        <button type="submit" className={`${smallBtn} py-2`}>
          Apply
        </button>
      </form>

      {/* Bulk toolbar — checkboxes in the table post into this form. */}
      {showBulk && (
        <form
          id="bulk-submissions"
          action={bulkSubmissionsAction}
          className="mb-4 flex flex-wrap items-center gap-2"
        >
          <span className="text-xs font-semibold text-muted">With checked:</span>
          <ConfirmSubmit
            name="op"
            value="approve"
            message="Approve all checked submissions? Corrections and closures apply to listings immediately (new locations are created unpublished)."
            className={smallBtn}
          >
            Bulk approve
          </ConfirmSubmit>
          <ConfirmSubmit
            name="op"
            value="reject"
            message="Reject all checked submissions?"
            className="rounded-card border border-diesel px-2.5 py-1 text-xs font-semibold text-diesel-300 transition-colors hover:bg-diesel hover:text-ink"
          >
            Bulk reject
          </ConfirmSubmit>
        </form>
      )}

      {!error && total === 0 && (
        <div className="rounded-card border border-line bg-asphalt-800 p-10 text-center">
          <p className="font-display text-2xl uppercase text-ink">Queue is clear</p>
          <p className="mt-2 text-sm text-muted">
            No {status === 'all' ? '' : `${status} `}submissions
            {searchParams.q || searchParams.kind ? ' match these filters' : ''}. Driver reports from
            /directory/submit land here for review.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-card border border-line">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-asphalt-800 text-left text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                  <th className="px-4 py-3 font-semibold">Kind</th>
                  <th className="px-4 py-3 font-semibold">Business</th>
                  <th className="px-4 py-3 font-semibold">Target listing</th>
                  <th className="px-4 py-3 font-semibold">Submitter</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      {r.status === 'pending' && (
                        <input
                          type="checkbox"
                          name="ids"
                          value={r.id}
                          form="bulk-submissions"
                          aria-label={`Select ${r.name}`}
                          className="h-4 w-4 rounded border-line bg-asphalt text-signal focus:ring-signal"
                        />
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {fmtDate(r.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {KIND_LABELS[r.kind] ?? r.kind}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/submissions/${r.id}`}
                        className="font-semibold text-ink hover:text-signal"
                      >
                        {r.name}
                      </Link>
                      {(r.city || r.state) && (
                        <span className="block text-xs text-muted">
                          {[r.city, r.state].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {r.locations ? (
                        <>
                          {r.locations.name}
                          <span className="block text-xs">
                            {r.locations.city}, {r.locations.state}
                          </span>
                        </>
                      ) : r.kind === 'new' ? (
                        '— (new)'
                      ) : (
                        <span className="text-diesel-300">missing</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {r.submitter_name || 'Anonymous'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`font-semibold ${STATUS_STYLES[r.status] ?? 'text-muted'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/submissions/${r.id}`} className={smallBtn}>
                          Review
                        </Link>
                        {r.status === 'pending' && (
                          <>
                            <form action={approveSubmissionAction.bind(null, r.id)}>
                              <ConfirmSubmit
                                message={
                                  r.kind === 'new'
                                    ? `Approve "${r.name}"? A new UNPUBLISHED listing will be created.`
                                    : r.kind === 'closure'
                                      ? `Approve closure of "${r.name}"? The listing will be unpublished.`
                                      : `Approve and apply this ${KIND_LABELS[r.kind]?.toLowerCase()} to "${r.name}"?`
                                }
                                className={smallBtn}
                              >
                                Approve
                              </ConfirmSubmit>
                            </form>
                            <form action={rejectSubmissionAction.bind(null, r.id)}>
                              <button
                                type="submit"
                                className="rounded-card border border-diesel px-2.5 py-1 text-xs font-semibold text-diesel-300 transition-colors hover:bg-diesel hover:text-ink"
                              >
                                Reject
                              </button>
                            </form>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
            <span>
              Page {page} of {totalPages} · showing {rows.length} of {total}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={pageHref(searchParams, page - 1)} className={smallBtn}>
                  ← Previous
                </Link>
              )}
              {page < totalPages && (
                <Link href={pageHref(searchParams, page + 1)} className={smallBtn}>
                  Next →
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
