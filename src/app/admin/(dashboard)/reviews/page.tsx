import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { getModReviews, PAGE_SIZE } from '@/lib/admin/community';
import { ConfirmSubmit } from '@/components/admin/directory/ConfirmSubmit';
import { approveReviewAction, rejectReviewAction, bulkReviewsAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Reviews', robots: { index: false, follow: false } };

const STATUS_STYLES: Record<string, string> = {
  pending: 'text-signal',
  approved: 'text-signal',
  rejected: 'text-diesel-300',
  duplicate: 'text-muted',
};

const OK_MESSAGES: Record<string, string> = {
  approved: 'Review approved — it is now public.',
  rejected: 'Review rejected.',
  duplicate: 'Review marked as duplicate.',
  deleted: 'Review deleted.',
  saved: 'Review saved.',
  'bulk-approved': 'Selected reviews approved.',
  'bulk-rejected': 'Selected reviews rejected.',
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
  rating?: string;
  status?: string;
  page?: string;
  ok?: string;
  error?: string;
  n?: string;
};

function pageHref(searchParams: Search, page: number): string {
  const params = new URLSearchParams();
  for (const k of ['q', 'rating', 'status'] as const) {
    if (searchParams[k]) params.set(k, searchParams[k]!);
  }
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return `/admin/reviews${qs ? `?${qs}` : ''}`;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5`} className="whitespace-nowrap text-signal">
      {'★'.repeat(rating)}
      <span className="text-line">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

export default async function AdminReviewsPage({ searchParams }: { searchParams: Search }) {
  requireAdmin();

  const status = searchParams.status ?? 'pending';
  const filters = {
    q: searchParams.q,
    rating: searchParams.rating,
    status: status === 'all' ? '' : status,
  };
  const page = Math.max(1, Number(searchParams.page) || 1);
  const { rows, total, error } = await getModReviews(filters, page);
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
          Reviews <span className="text-lg text-muted">({total})</span>
        </h1>
        <Link
          href="/directory/reviews"
          className="text-sm font-semibold text-muted hover:text-signal"
        >
          View public page →
        </Link>
      </div>

      {ok && (
        <p className="mb-4 rounded-card border border-signal/50 bg-signal/10 px-4 py-3 text-sm font-medium text-signal">
          {ok}
        </p>
      )}
      {(err || error) && (
        <p className="mb-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300">
          {err ?? `Couldn’t load reviews: ${error}`}
        </p>
      )}

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
            placeholder="Title, text, reviewer…"
            className={`${inputClasses} w-60`}
          />
        </div>
        <div>
          <label htmlFor="rating" className="mb-1 block text-xs font-semibold text-muted">
            Rating
          </label>
          <select
            id="rating"
            name="rating"
            defaultValue={searchParams.rating ?? ''}
            className={inputClasses}
          >
            <option value="">All ratings</option>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {r} star{r === 1 ? '' : 's'}
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
            <option value="all">All</option>
          </select>
        </div>
        <button type="submit" className={`${smallBtn} py-2`}>
          Apply
        </button>
      </form>

      {showBulk && (
        <form
          id="bulk-reviews"
          action={bulkReviewsAction}
          className="mb-4 flex flex-wrap items-center gap-2"
        >
          <span className="text-xs font-semibold text-muted">With checked:</span>
          <ConfirmSubmit
            name="op"
            value="approve"
            message="Approve all checked reviews? They become public immediately."
            className={smallBtn}
          >
            Bulk approve
          </ConfirmSubmit>
          <ConfirmSubmit
            name="op"
            value="reject"
            message="Reject all checked reviews?"
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
            No {status === 'all' ? '' : `${status} `}reviews
            {searchParams.q || searchParams.rating ? ' match these filters' : ''}. Driver reviews
            from /directory/reviews land here for approval.
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
                  <th className="px-4 py-3 font-semibold">Rating</th>
                  <th className="px-4 py-3 font-semibold">Review</th>
                  <th className="px-4 py-3 font-semibold">Listing</th>
                  <th className="px-4 py-3 font-semibold">Reviewer</th>
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
                          form="bulk-reviews"
                          aria-label={`Select review "${r.title}"`}
                          className="h-4 w-4 rounded border-line bg-asphalt text-signal focus:ring-signal"
                        />
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {fmtDate(r.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Stars rating={r.rating} />
                    </td>
                    <td className="max-w-72 px-4 py-3">
                      <Link
                        href={`/admin/reviews/${r.id}`}
                        className="font-semibold text-ink hover:text-signal"
                      >
                        {r.title}
                      </Link>
                      <span className="block truncate text-xs text-muted">{r.body}</span>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {r.locations ? (
                        <>
                          {r.locations.name}
                          <span className="block text-xs">
                            {r.locations.city}, {r.locations.state}
                          </span>
                        </>
                      ) : (
                        <span className="text-diesel-300">listing gone</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {r.reviewer_name || 'Anonymous'}
                      {r.truck_type && <span className="block text-xs">{r.truck_type}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`font-semibold ${STATUS_STYLES[r.status] ?? 'text-muted'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/reviews/${r.id}`} className={smallBtn}>
                          Review
                        </Link>
                        {r.status === 'pending' && (
                          <>
                            <form action={approveReviewAction.bind(null, r.id)}>
                              <ConfirmSubmit
                                message={`Approve "${r.title}"? It becomes public immediately.`}
                                className={smallBtn}
                              >
                                Approve
                              </ConfirmSubmit>
                            </form>
                            <form action={rejectReviewAction.bind(null, r.id)}>
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
