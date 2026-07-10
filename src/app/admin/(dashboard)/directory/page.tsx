import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { getListings, statesOf } from '@/lib/admin/directory';
import { DIRECTORY_CATEGORIES, getCategory } from '@/lib/directory/categories';
import { ConfirmSubmit } from '@/components/admin/directory/ConfirmSubmit';
import { setPublishedAction, setFeaturedAction, softDeleteAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Directory', robots: { index: false, follow: false } };

const OK_MESSAGES: Record<string, string> = {
  created: 'Listing created.',
  saved: 'Listing saved.',
  published: 'Listing published — it is now live on the public directory.',
  unpublished: 'Listing unpublished — it is no longer publicly visible.',
  featured: 'Listing featured.',
  unfeatured: 'Listing unfeatured.',
  deleted: 'Listing deleted.',
};
const ERROR_MESSAGES: Record<string, string> = {
  update: 'Could not update the listing — try again.',
  delete: 'Could not delete the listing — try again.',
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const inputClasses =
  'rounded-card border border-line bg-asphalt px-3 py-2 text-sm text-ink placeholder:text-muted/60 ' +
  'focus:border-signal focus:outline-none';
const smallBtn =
  'rounded-card border border-line px-2.5 py-1 text-xs font-semibold text-ink transition-colors ' +
  'hover:border-signal hover:text-signal';

export default async function AdminDirectoryPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; state?: string; published?: string; ok?: string; error?: string };
}) {
  requireAdmin();

  const filters = {
    q: searchParams.q,
    category: searchParams.category,
    state: searchParams.state,
    published: searchParams.published,
  };
  const { rows, error } = await getListings(filters);
  const { rows: allRows } = await getListings({});
  const states = statesOf(allRows);
  const hasFilters = Boolean(filters.q || filters.category || filters.state || filters.published);

  const ok = searchParams.ok ? OK_MESSAGES[searchParams.ok] : null;
  const err = searchParams.error ? ERROR_MESSAGES[searchParams.error] : null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="display-section">
          Directory <span className="text-lg text-muted">({allRows.length})</span>
        </h1>
        <Link
          href="/admin/directory/new"
          className="rounded-card bg-signal px-4 py-2 font-display text-base uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600"
        >
          + Add listing
        </Link>
      </div>

      {ok && (
        <p className="mb-4 rounded-card border border-signal/50 bg-signal/10 px-4 py-3 text-sm font-medium text-signal">
          {ok}
        </p>
      )}
      {(err || error) && (
        <p className="mb-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel">
          {err ?? `Couldn’t load listings: ${error}`}
        </p>
      )}

      {/* Search + filters (GET form — shareable URLs, no JS needed) */}
      <form method="GET" className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="q" className="mb-1 block text-xs font-semibold text-muted">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q ?? ''}
            placeholder="Name, city, address…"
            className={`${inputClasses} w-56`}
          />
        </div>
        <div>
          <label htmlFor="category" className="mb-1 block text-xs font-semibold text-muted">
            Category
          </label>
          <select id="category" name="category" defaultValue={filters.category ?? ''} className={inputClasses}>
            <option value="">All categories</option>
            {DIRECTORY_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="state" className="mb-1 block text-xs font-semibold text-muted">
            State
          </label>
          <select id="state" name="state" defaultValue={filters.state ?? ''} className={inputClasses}>
            <option value="">All states</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="published" className="mb-1 block text-xs font-semibold text-muted">
            Status
          </label>
          <select id="published" name="published" defaultValue={filters.published ?? ''} className={inputClasses}>
            <option value="">All</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
          </select>
        </div>
        <button type="submit" className={`${smallBtn} py-2`}>
          Apply
        </button>
        {hasFilters && (
          <Link href="/admin/directory" className="py-2 text-xs font-semibold text-muted hover:text-signal">
            Clear filters
          </Link>
        )}
      </form>

      {/* Empty states */}
      {!error && allRows.length === 0 && (
        <div className="rounded-card border border-line bg-asphalt-800 p-10 text-center">
          <p className="font-display text-2xl uppercase text-ink">No listings yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            The directory database is empty. Add the first listing and publish it to see it live on
            the public directory.
          </p>
          <Link
            href="/admin/directory/new"
            className="mt-5 inline-block rounded-card bg-signal px-5 py-2.5 font-display text-base uppercase text-asphalt hover:bg-signal-600"
          >
            + Add the first listing
          </Link>
        </div>
      )}
      {!error && allRows.length > 0 && rows.length === 0 && (
        <div className="rounded-card border border-line bg-asphalt-800 p-10 text-center">
          <p className="font-display text-2xl uppercase text-ink">No matches</p>
          <p className="mt-2 text-sm text-muted">No listings match these filters.</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-asphalt-800 text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Location</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-ink">{r.name}</span>
                    {r.is_featured && (
                      <span className="ml-2 rounded-card bg-signal px-1.5 py-0.5 text-[10px] font-bold uppercase text-asphalt">
                        Featured
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    {r.category_slug ? (getCategory(r.category_slug)?.title ?? r.category_slug) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    {r.city}, {r.state}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {r.is_published ? (
                      <span className="font-semibold text-signal">Published</span>
                    ) : (
                      <span className="text-muted">Unpublished</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{fmtDate(r.updated_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/directory/${r.id}/edit`} className={smallBtn}>
                        Edit
                      </Link>
                      <form
                        action={setPublishedAction.bind(null, r.id, r.category_slug, !r.is_published)}
                      >
                        <button type="submit" className={smallBtn}>
                          {r.is_published ? 'Unpublish' : 'Publish'}
                        </button>
                      </form>
                      <form
                        action={setFeaturedAction.bind(null, r.id, r.category_slug, !r.is_featured)}
                      >
                        <button type="submit" className={smallBtn}>
                          {r.is_featured ? 'Unfeature' : 'Feature'}
                        </button>
                      </form>
                      <form action={softDeleteAction.bind(null, r.id, r.category_slug)}>
                        <ConfirmSubmit
                          message={`Delete "${r.name}"? It will disappear from the admin list and the public directory. (Soft delete — the row is kept.)`}
                          className="rounded-card border border-diesel px-2.5 py-1 text-xs font-semibold text-diesel transition-colors hover:bg-diesel hover:text-ink"
                        >
                          Delete
                        </ConfirmSubmit>
                      </form>
                    </div>
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
