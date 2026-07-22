import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSubmission, getListingOptions, submissionPatch } from '@/lib/admin/community';
import { getHistoryForLocation, type HistoryRow } from '@/lib/admin/history';
import { AMENITIES } from '@/lib/directory/amenities';
import { DIRECTORY_CATEGORIES } from '@/lib/directory/categories';
import { DIRECTORY_STATES } from '@/lib/directory/states';
import { ConfirmSubmit } from '@/components/admin/directory/ConfirmSubmit';
import {
  approveSubmissionAction,
  rejectSubmissionAction,
  markDuplicateSubmissionAction,
  deleteSubmissionAction,
  saveSubmissionAction,
  mergeSubmissionAction,
} from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Submission', robots: { index: false, follow: false } };

const KIND_LABELS: Record<string, string> = {
  new: 'New location',
  correction: 'Correction',
  closure: 'Closure report',
  'missing-info': 'Missing information',
  'amenity-change': 'Amenity change',
};

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
  'rounded-card border border-diesel px-3 py-1.5 text-xs font-semibold text-diesel-300 ' +
  'transition-colors hover:bg-diesel hover:text-ink';

function TriSelect({ name, label, value }: { name: string; label: string; value: boolean | null }) {
  return (
    <div>
      <label htmlFor={name} className={labelClasses}>
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={value === null ? '' : value ? 'yes' : 'no'}
        className={inputClasses}
      >
        <option value="">Didn’t say</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </div>
  );
}

function fmtValue(v: unknown): string {
  if (v == null || v === '') return '—';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v);
}

function HistoryList({ rows }: { rows: HistoryRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">No recorded changes yet for this listing.</p>;
  }
  return (
    <ul className="grid gap-3">
      {rows.map((h) => (
        <li key={h.id} className="rounded-card border border-line bg-asphalt p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-ink">
              {h.source} · {h.admin}
            </span>
            <span className="text-xs text-muted">{fmtDateTime(h.created_at)}</span>
          </div>
          {h.note && <p className="mt-1 text-muted">{h.note}</p>}
          {Object.keys(h.changed_fields).length > 0 && (
            <ul className="mt-2 grid gap-1 text-xs text-muted">
              {Object.entries(h.changed_fields).map(([field, d]) => (
                <li key={field}>
                  <span className="font-semibold text-ink">{field}</span>: {fmtValue(d.from)} →{' '}
                  <span className="text-signal">{fmtValue(d.to)}</span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function AdminSubmissionDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ok?: string; error?: string };
}) {
  requireAdmin();

  const { row: sub, error } = await getSubmission(params.id);
  if (error) throw new Error(error);
  if (!sub) notFound();

  const pending = sub.status === 'pending';

  // Diff preview + history for the target listing (non-new kinds).
  let preview: ReturnType<typeof submissionPatch> | null = null;
  let history: HistoryRow[] = [];
  if (sub.location_id) {
    const supabase = createAdminClient();
    const { data: loc } = await supabase
      .from('locations')
      .select('*')
      .eq('id', sub.location_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (loc) preview = submissionPatch(sub, loc as Record<string, unknown>);
    history = await getHistoryForLocation(sub.location_id);
  }

  const mergeOptions = sub.kind === 'new' && pending ? await getListingOptions() : [];

  return (
    <div className="max-w-4xl">
      <Link
        href="/admin/submissions"
        className="text-sm font-semibold text-muted hover:text-signal"
      >
        ← Back to submissions
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="display-section">
          {KIND_LABELS[sub.kind] ?? sub.kind}: {sub.name}
        </h1>
        <span
          className={`rounded-card border px-3 py-1 text-xs font-bold uppercase ${
            pending ? 'border-signal text-signal' : 'border-line text-muted'
          }`}
        >
          {sub.status}
        </span>
      </div>

      <p className="mt-2 text-sm text-muted">
        Submitted {fmtDateTime(sub.created_at)} by {sub.submitter_name || 'Anonymous'}
        {sub.submitter_contact ? ` (${sub.submitter_contact})` : ''}
        {sub.reviewed_at
          ? ` · reviewed ${fmtDateTime(sub.reviewed_at)} by ${sub.reviewed_by ?? '—'}`
          : ''}
      </p>

      {searchParams.ok === 'saved' && (
        <p className="mt-4 rounded-card border border-signal/50 bg-signal/10 px-4 py-3 text-sm font-medium text-signal">
          Submission saved.
        </p>
      )}
      {searchParams.error && (
        <p className="mt-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300">
          {searchParams.error}
        </p>
      )}

      {/* Moderation actions */}
      {pending && (
        <div className="mt-5 flex flex-wrap gap-2">
          <form action={approveSubmissionAction.bind(null, sub.id)}>
            <ConfirmSubmit
              message={
                sub.kind === 'new'
                  ? `Approve "${sub.name}"? A new UNPUBLISHED listing will be created — you publish it separately from the Directory tab.`
                  : sub.kind === 'closure'
                    ? `Approve closure of "${sub.name}"? The listing will be unpublished (with a history record).`
                    : `Approve and apply the changes below to the live listing? A history record is written first.`
              }
              className="rounded-card bg-signal px-4 py-2 font-display text-base uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600"
            >
              Approve
            </ConfirmSubmit>
          </form>
          <form action={rejectSubmissionAction.bind(null, sub.id)}>
            <button type="submit" className={`${dangerBtn} px-4 py-2`}>
              Reject
            </button>
          </form>
          <form action={markDuplicateSubmissionAction.bind(null, sub.id)}>
            <button type="submit" className={`${smallBtn} px-4 py-2`}>
              Mark duplicate
            </button>
          </form>
          <form action={deleteSubmissionAction.bind(null, sub.id)}>
            <ConfirmSubmit
              message={`Permanently delete this submission? Use Reject for normal moderation — delete is for spam.`}
              className={`${dangerBtn} px-4 py-2`}
            >
              Delete
            </ConfirmSubmit>
          </form>
        </div>
      )}

      {/* Target listing + what approval would change */}
      {sub.locations && (
        <div className="mt-6 rounded-card border border-line bg-asphalt-800 p-5">
          <h2 className="font-display text-xl uppercase text-ink">Target listing</h2>
          <p className="mt-1 text-sm text-muted">
            {sub.locations.name} — {sub.locations.city}, {sub.locations.state}
            <Link
              href={`/admin/directory/${sub.locations.id}/edit`}
              className="ml-2 font-semibold text-signal hover:underline"
            >
              Open in Directory →
            </Link>
          </p>
          {pending && preview && (
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-ink">Approving will change:</h3>
              {Object.keys(preview.changed).length === 0 ? (
                <p className="mt-1 text-sm text-muted">
                  Nothing — the listing already matches this report. Approving just closes it out.
                </p>
              ) : (
                <ul className="mt-2 grid gap-1 text-sm text-muted">
                  {Object.entries(preview.changed).map(([field, d]) => (
                    <li key={field}>
                      <span className="font-semibold text-ink">{field}</span>: {fmtValue(d.from)} →{' '}
                      <span className="text-signal">{fmtValue(d.to)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
      {!sub.locations && sub.kind !== 'new' && (
        <p className="mt-6 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300">
          The listing this report referred to no longer exists. Reject the submission, or merge it
          into another listing below.
        </p>
      )}

      {/* Merge into an existing listing (new submissions that already exist) */}
      {mergeOptions.length > 0 && (
        <div className="mt-6 rounded-card border border-line bg-asphalt-800 p-5">
          <h2 className="font-display text-xl uppercase text-ink">
            Merge into an existing listing
          </h2>
          <p className="mt-1 text-sm text-muted">
            Already in the directory? Merge fills the existing listing’s blank fields from this
            submission (kept values are never overwritten) and marks the submission merged.
          </p>
          <form
            action={mergeSubmissionAction.bind(null, sub.id)}
            className="mt-3 flex flex-wrap items-end gap-3"
          >
            <div className="min-w-72">
              <label htmlFor="target_id" className={labelClasses}>
                Existing listing
              </label>
              <select id="target_id" name="target_id" defaultValue="" className={inputClasses}>
                <option value="" disabled>
                  Pick a listing…
                </option>
                {mergeOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} — {l.city}, {l.state}
                  </option>
                ))}
              </select>
            </div>
            <ConfirmSubmit
              message="Merge this submission into the selected listing? Blank fields fill in; a history record is written first."
              className={`${smallBtn} py-2`}
            >
              Merge
            </ConfirmSubmit>
          </form>
        </div>
      )}

      {/* Edit before approve */}
      <form action={saveSubmissionAction.bind(null, sub.id)} className="mt-6">
        <h2 className="font-display text-xl uppercase text-ink">Submission details</h2>
        <p className="mt-1 text-sm text-muted">
          Clean up the driver’s report before approving — what you save here is exactly what
          approval applies.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className={labelClasses}>
              Business name
            </label>
            <input id="name" name="name" defaultValue={sub.name} className={inputClasses} />
          </div>
          <div>
            <label htmlFor="category_slug" className={labelClasses}>
              Category
            </label>
            <select
              id="category_slug"
              name="category_slug"
              defaultValue={sub.category_slug ?? ''}
              className={inputClasses}
            >
              <option value="">—</option>
              {DIRECTORY_CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="address" className={labelClasses}>
              Street address
            </label>
            <input
              id="address"
              name="address"
              defaultValue={sub.address ?? ''}
              className={inputClasses}
            />
          </div>
          <div>
            <label htmlFor="city" className={labelClasses}>
              City
            </label>
            <input id="city" name="city" defaultValue={sub.city ?? ''} className={inputClasses} />
          </div>
          <div>
            <label htmlFor="state" className={labelClasses}>
              State
            </label>
            <select id="state" name="state" defaultValue={sub.state ?? ''} className={inputClasses}>
              <option value="">—</option>
              {DIRECTORY_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="zip" className={labelClasses}>
              ZIP
            </label>
            <input id="zip" name="zip" defaultValue={sub.zip ?? ''} className={inputClasses} />
          </div>
          <div>
            <label htmlFor="phone" className={labelClasses}>
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              defaultValue={sub.phone ?? ''}
              className={inputClasses}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="website" className={labelClasses}>
              Website
            </label>
            <input
              id="website"
              name="website"
              defaultValue={sub.website ?? ''}
              className={inputClasses}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="description" className={labelClasses}>
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={sub.description ?? ''}
              className={inputClasses}
            />
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className="mb-2 text-xs font-semibold text-muted">Amenities</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {AMENITIES.map((a) => (
              <label key={a} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  name="amenities"
                  value={a}
                  defaultChecked={(sub.amenities ?? []).includes(a)}
                  className="h-4 w-4 rounded border-line bg-asphalt text-signal focus:ring-signal"
                />
                {a}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <TriSelect name="free_parking" label="Free parking" value={sub.free_parking} />
          <TriSelect name="paid_parking" label="Paid parking" value={sub.paid_parking} />
          <TriSelect name="reserved_parking" label="Reserved" value={sub.reserved_parking} />
          <TriSelect name="overnight_parking" label="Overnight" value={sub.overnight_parking} />
          <div>
            <label htmlFor="parking_spaces" className={labelClasses}>
              Spaces
            </label>
            <input
              id="parking_spaces"
              name="parking_spaces"
              inputMode="numeric"
              defaultValue={sub.parking_spaces ?? ''}
              className={inputClasses}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <div>
            <label htmlFor="comments" className={labelClasses}>
              Driver comments
            </label>
            <textarea
              id="comments"
              name="comments"
              rows={3}
              defaultValue={sub.comments ?? ''}
              className={inputClasses}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="submitter_name" className={labelClasses}>
                Submitter name
              </label>
              <input
                id="submitter_name"
                name="submitter_name"
                defaultValue={sub.submitter_name ?? ''}
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="submitter_contact" className={labelClasses}>
                Submitter contact
              </label>
              <input
                id="submitter_contact"
                name="submitter_contact"
                defaultValue={sub.submitter_contact ?? ''}
                className={inputClasses}
              />
            </div>
          </div>
          <div>
            <label htmlFor="admin_note" className={labelClasses}>
              Admin note (internal)
            </label>
            <textarea
              id="admin_note"
              name="admin_note"
              rows={2}
              defaultValue={sub.admin_note ?? ''}
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

      {/* Change history for the target listing */}
      {sub.location_id && (
        <div className="mt-8">
          <h2 className="font-display text-xl uppercase text-ink">Listing change history</h2>
          <div className="mt-3">
            <HistoryList rows={history} />
          </div>
        </div>
      )}
    </div>
  );
}
