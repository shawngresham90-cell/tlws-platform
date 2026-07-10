import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { DIRECTORY_CATEGORIES } from '@/lib/directory/categories';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Admin — Export Directory Listings',
  robots: { index: false, follow: false },
};

const inputClasses =
  'rounded-card border border-line bg-asphalt px-3 py-2 text-sm text-ink focus:border-signal focus:outline-none';

export default function AdminDirectoryExportPage() {
  requireAdmin();
  return (
    <div>
      <p className="mb-2 text-sm text-muted">
        <Link href="/admin/directory" className="hover:text-signal">
          ← Directory
        </Link>
      </p>
      <h1 className="display-section mb-2">Bulk export</h1>
      <p className="mb-8 max-w-2xl text-muted">
        Download listings as CSV — everything, or filtered. The file uses the same columns the
        importer accepts, so an exported file re-imports cleanly.
      </p>

      {/* GET form → the gated CSV route. Leave a filter empty to include all. */}
      <form
        method="GET"
        action="/admin/directory/export/csv"
        className="grid max-w-2xl gap-4 rounded-card border border-line bg-asphalt-800 p-6 sm:grid-cols-2"
      >
        <div>
          <label htmlFor="x-category" className="mb-1 block text-xs font-semibold text-muted">
            Category
          </label>
          <select id="x-category" name="category" defaultValue="" className={`${inputClasses} w-full`}>
            <option value="">All categories</option>
            {DIRECTORY_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="x-state" className="mb-1 block text-xs font-semibold text-muted">
            State (two-letter code)
          </label>
          <input
            id="x-state"
            name="state"
            maxLength={2}
            placeholder="All states"
            className={`${inputClasses} w-full uppercase`}
          />
        </div>
        <div>
          <label htmlFor="x-published" className="mb-1 block text-xs font-semibold text-muted">
            Status
          </label>
          <select id="x-published" name="published" defaultValue="" className={`${inputClasses} w-full`}>
            <option value="">All</option>
            <option value="published">Published only</option>
            <option value="unpublished">Unpublished only</option>
          </select>
        </div>
        <div>
          <label htmlFor="x-featured" className="mb-1 block text-xs font-semibold text-muted">
            Featured
          </label>
          <select id="x-featured" name="featured" defaultValue="" className={`${inputClasses} w-full`}>
            <option value="">All</option>
            <option value="1">Featured only</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded-card bg-signal px-6 py-3 font-display text-lg uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600"
          >
            Download CSV
          </button>
        </div>
      </form>
    </div>
  );
}
