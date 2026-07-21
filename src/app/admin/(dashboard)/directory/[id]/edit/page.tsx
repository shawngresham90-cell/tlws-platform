import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth';
import { getListing } from '@/lib/admin/directory';
import { detailSlugBase, detailHref } from '@/lib/directory/detail-slug';
import { ListingForm } from '@/components/admin/directory/ListingForm';
import { ConfirmSubmit } from '@/components/admin/directory/ConfirmSubmit';
import {
  saveListingAction,
  setPublishedAction,
  softDeleteAction,
  regenerateDetailSlugAction,
} from '../../actions';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Admin — Edit Directory Listing',
  robots: { index: false, follow: false },
};

const SLUG_MESSAGES: Record<string, string> = {
  'slug-updated':
    'Public URL regenerated. The previous URL now permanently redirects to the new one.',
  'slug-current':
    'The public URL already matches the listing’s name, city, and state — nothing to change.',
};

export default async function AdminDirectoryEditPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ok?: string; error?: string };
}) {
  requireAdmin();

  const { row, error } = await getListing(params.id);
  if (error) {
    return (
      <p className="rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel-300">
        Couldn’t load the listing: {error}
      </p>
    );
  }
  if (!row) notFound();

  const editAction = saveListingAction.bind(null, row.id);
  const slugMessage = searchParams.ok ? SLUG_MESSAGES[searchParams.ok] : null;
  const slugError =
    searchParams.error === 'slug'
      ? 'Could not regenerate the public URL — try again.'
      : searchParams.error === 'slug-redirects-missing'
        ? 'Regeneration is blocked: the slug-redirect table (migration 023) is not provisioned, ' +
          'so the old URL could not be preserved. Apply the migration first.'
        : null;
  const expectedBase = detailSlugBase(row.name, row.city, row.state);
  const slugInSync =
    row.detail_slug != null &&
    (row.detail_slug === expectedBase ||
      new RegExp(`^${expectedBase}-\\d+$`).test(row.detail_slug));

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
          <form
            action={setPublishedAction.bind(null, row.id, row.category_slug, !row.is_published)}
          >
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
              className="rounded-card border border-diesel px-4 py-2 text-sm font-semibold text-diesel-300 transition-colors hover:bg-diesel hover:text-ink"
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

      {(slugMessage || slugError) && (
        <p
          className={`mb-4 rounded-card border px-4 py-3 text-sm font-medium ${
            slugError
              ? 'border-diesel bg-diesel/10 text-diesel-300'
              : 'border-signal/50 bg-signal/10 text-signal'
          }`}
        >
          {slugError ?? slugMessage}
        </p>
      )}

      {/* Public detail URL (Milestone 20). Slugs are generated, never
          free-edited; regeneration only appears when a rename has left the
          URL out of sync, and it warns before breaking existing links. */}
      {row.detail_slug && (
        <div className="mb-6 rounded-card border border-line bg-asphalt-800 p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Public page</p>
          <p className="mt-1 break-all font-mono text-xs text-ink">
            /directory/location/{row.detail_slug}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {row.is_published ? (
              <a
                href={detailHref(row.detail_slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-signal underline-offset-4 hover:underline"
              >
                View public page ↗
              </a>
            ) : (
              <span className="text-muted">
                Unpublished — the public page returns 404 until this listing is published.
              </span>
            )}
            {!slugInSync && (
              <form action={regenerateDetailSlugAction.bind(null, row.id)}>
                <ConfirmSubmit
                  message={
                    `Regenerate the public URL from the current name/city/state?\n\n` +
                    `New URL: /directory/location/${expectedBase} (or a -2/-3 variant if taken)\n\n` +
                    `The current URL (/directory/location/${row.detail_slug}) will permanently ` +
                    `redirect (301) to the new one, so bookmarks keep working — but search ` +
                    `engines still need time to pick up the change, and the canonical URL you ` +
                    `share going forward changes. Only do this after a rename that made the old ` +
                    `URL misleading.`
                  }
                  className="rounded-card border border-line px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:border-signal hover:text-signal"
                >
                  Regenerate from name/city/state
                </ConfirmSubmit>
              </form>
            )}
          </div>
        </div>
      )}

      <ListingForm action={editAction} listing={row} submitLabel="Save changes" />
    </div>
  );
}
