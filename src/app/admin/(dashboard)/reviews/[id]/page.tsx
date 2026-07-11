import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth';
import { getModReview } from '@/lib/admin/community';
import { TRUCK_TYPES } from '@/lib/community/schemas';
import { ConfirmSubmit } from '@/components/admin/directory/ConfirmSubmit';
import {
  approveReviewAction,
  rejectReviewAction,
  markDuplicateReviewAction,
  deleteReviewAction,
  saveReviewAction,
} from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Review', robots: { index: false, follow: false } };

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const inputClasses =
  'w-full rounded-card border border-line bg-asphalt px-3 py-2 text-sm text-ink ' +
  'placeholder:text-muted/60 focus:border-signal focus:outline-none';
const labelClasses = 'mb-1 block text-xs font-semibold text-muted';
const smallBtn =
  'rounded-card border border-line px-3 py-1.5 text-xs font-semibold text-ink transition-colors ' +
  'hover:border-signal hover:text-signal';
const dangerBtn =
  'rounded-card border border-diesel px-3 py-1.5 text-xs font-semibold text-diesel ' +
  'transition-colors hover:bg-diesel hover:text-ink';

export default async function AdminReviewDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ok?: string; error?: string };
}) {
  requireAdmin();

  const { row, error } = await getModReview(params.id);
  if (error) throw new Error(error);
  if (!row) notFound();

  const pending = row.status === 'pending';

  return (
    <div className="max-w-3xl">
      <Link href="/admin/reviews" className="text-sm font-semibold text-muted hover:text-signal">
        ← Back to reviews
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="display-section">Review: {row.title}</h1>
        <span
          className={`rounded-card border px-3 py-1 text-xs font-bold uppercase ${
            pending ? 'border-signal text-signal' : 'border-line text-muted'
          }`}
        >
          {row.status}
        </span>
      </div>

      <p className="mt-2 text-sm text-muted">
        Submitted {fmtDateTime(row.created_at)} by {row.reviewer_name || 'Anonymous'}
        {row.locations
          ? ` · for ${row.locations.name} — ${row.locations.city}, ${row.locations.state}`
          : ' · listing no longer exists'}
        {row.reviewed_at
          ? ` · reviewed ${fmtDateTime(row.reviewed_at)} by ${row.reviewed_by ?? '—'}`
          : ''}
      </p>

      {searchParams.ok === 'saved' && (
        <p className="mt-4 rounded-card border border-signal/50 bg-signal/10 px-4 py-3 text-sm font-medium text-signal">
          Review saved.
        </p>
      )}
      {searchParams.error && (
        <p className="mt-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel">
          {searchParams.error}
        </p>
      )}

      {pending && (
        <div className="mt-5 flex flex-wrap gap-2">
          <form action={approveReviewAction.bind(null, row.id)}>
            <ConfirmSubmit
              message={`Approve "${row.title}"? It becomes public immediately (with a history record on the listing).`}
              className="rounded-card bg-signal px-4 py-2 font-display text-base uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600"
            >
              Approve
            </ConfirmSubmit>
          </form>
          <form action={rejectReviewAction.bind(null, row.id)}>
            <button type="submit" className={`${dangerBtn} px-4 py-2`}>
              Reject
            </button>
          </form>
          <form action={markDuplicateReviewAction.bind(null, row.id)}>
            <button type="submit" className={`${smallBtn} px-4 py-2`}>
              Mark duplicate
            </button>
          </form>
          <form action={deleteReviewAction.bind(null, row.id)}>
            <ConfirmSubmit
              message="Permanently delete this review? Use Reject for normal moderation — delete is for spam."
              className={`${dangerBtn} px-4 py-2`}
            >
              Delete
            </ConfirmSubmit>
          </form>
        </div>
      )}
      {!pending && (
        <div className="mt-5">
          <form action={deleteReviewAction.bind(null, row.id)}>
            <ConfirmSubmit
              message={
                row.status === 'approved'
                  ? 'Delete this APPROVED review? It disappears from the public site.'
                  : 'Permanently delete this review?'
              }
              className={dangerBtn}
            >
              Delete
            </ConfirmSubmit>
          </form>
        </div>
      )}

      <form action={saveReviewAction.bind(null, row.id)} className="mt-6">
        <h2 className="font-display text-xl uppercase text-ink">Edit review</h2>
        <p className="mt-1 text-sm text-muted">
          Fix typos or trim profanity before approving — what you save is what goes public.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="rating" className={labelClasses}>
              Rating
            </label>
            <select id="rating" name="rating" defaultValue={row.rating} className={inputClasses}>
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>
                  {r} star{r === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="visited_on" className={labelClasses}>
              Visited on
            </label>
            <input
              id="visited_on"
              name="visited_on"
              type="date"
              defaultValue={row.visited_on ?? ''}
              className={inputClasses}
            />
          </div>
          <div>
            <label htmlFor="truck_type" className={labelClasses}>
              Truck type
            </label>
            <select
              id="truck_type"
              name="truck_type"
              defaultValue={row.truck_type ?? ''}
              className={inputClasses}
            >
              <option value="">—</option>
              {TRUCK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="title" className={labelClasses}>
              Title
            </label>
            <input id="title" name="title" defaultValue={row.title} className={inputClasses} />
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="body" className={labelClasses}>
              Review text
            </label>
            <textarea
              id="body"
              name="body"
              rows={6}
              defaultValue={row.body}
              className={inputClasses}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="reviewer_name" className={labelClasses}>
              Reviewer name (public)
            </label>
            <input
              id="reviewer_name"
              name="reviewer_name"
              defaultValue={row.reviewer_name ?? ''}
              className={inputClasses}
            />
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="admin_note" className={labelClasses}>
              Admin note (internal)
            </label>
            <textarea
              id="admin_note"
              name="admin_note"
              rows={2}
              defaultValue={row.admin_note ?? ''}
              className={inputClasses}
            />
          </div>
        </div>

        <div className="mt-5">
          <button
            type="submit"
            className="rounded-card border border-line px-5 py-2 font-display text-base uppercase tracking-wide text-ink transition-colors hover:border-signal hover:text-signal"
          >
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
