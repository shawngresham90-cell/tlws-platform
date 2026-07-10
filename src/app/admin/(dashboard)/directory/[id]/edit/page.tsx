import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth';
import { getListing } from '@/lib/admin/directory';
import { ListingForm } from '@/components/admin/directory/ListingForm';
import { ConfirmSubmit } from '@/components/admin/directory/ConfirmSubmit';
import { saveListingAction, setPublishedAction, softDeleteAction } from '../../actions';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Admin — Edit Directory Listing',
  robots: { index: false, follow: false },
};

export default async function AdminDirectoryEditPage({ params }: { params: { id: string } }) {
  requireAdmin();

  const { row, error } = await getListing(params.id);
  if (error) {
    return (
      <p className="rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel">
        Couldn’t load the listing: {error}
      </p>
    );
  }
  if (!row) notFound();

  const editAction = saveListingAction.bind(null, row.id);

  return (
    <div>
      <p className="mb-2 text-sm text-muted">
        <Link href="/admin/directory" className="hover:text-signal">
          ← Directory
        </Link>
      </p>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="display-section">Edit listing</h1>
        <div className="flex flex-wrap gap-2">
          <form action={setPublishedAction.bind(null, row.id, row.category_slug, !row.is_published)}>
            <button
              type="submit"
              className="rounded-card border border-line px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-signal hover:text-signal"
            >
              {row.is_published ? 'Unpublish' : 'Publish'}
            </button>
          </form>
          <form action={softDeleteAction.bind(null, row.id, row.category_slug)}>
            <ConfirmSubmit
              message={`Delete "${row.name}"? It will disappear from the admin list and the public directory. (Soft delete — the row is kept.)`}
              className="rounded-card border border-diesel px-4 py-2 text-sm font-semibold text-diesel transition-colors hover:bg-diesel hover:text-ink"
            >
              Delete
            </ConfirmSubmit>
          </form>
        </div>
      </div>

      <p className="mb-6 text-sm text-muted">
        {row.is_published ? (
          <span className="font-semibold text-signal">Published</span>
        ) : (
          <span>Unpublished — not visible on the public directory.</span>
        )}
      </p>

      <ListingForm action={editAction} listing={row} submitLabel="Save changes" />
    </div>
  );
}
