import type { Metadata } from 'next';
import Link from 'next/link';
import { Section } from '@/components/ui';
import { DirectoryHero, EntryCard } from '@/components/directory';
import { getRecentlyUpdated } from '@/lib/directory/data';
import { listingListSchema } from '@/lib/directory/seo';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * "Recently updated" (Milestone 25). Published, non-deleted listings ordered by
 * their stored updated_at. The copy is careful: it says the DIRECTORY RECORD
 * was updated, not that the business itself changed — we only know our data
 * changed. No fabricated timestamps: rows without an updated_at never appear
 * (the query filters them out).
 */

export const revalidate = 300;
const PATH = '/directory/recently-updated';

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: 'Recently Updated Truck Stop Listings | Trucking Life with Shawn',
    description:
      'Truck stops, parking, and driver-service listings whose directory information was most ' +
      'recently updated and verified — the freshest records in the directory.',
    path: PATH,
  });
}

function fmt(iso?: string): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(
    new Date(t),
  );
}

export default async function RecentlyUpdatedPage() {
  const entries = await getRecentlyUpdated(60);
  const listSchema = listingListSchema(entries, 'Recently updated listings', PATH);

  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Directory', path: '/directory' },
            { name: 'Recently updated', path: PATH },
          ]),
          ...(listSchema ? [listSchema] : []),
        ]}
      />
      <DirectoryHero
        crumbs={[
          { name: 'Home', href: '/' },
          { name: 'Directory', href: '/directory' },
          { name: 'Recently updated' },
        ]}
        eyebrow="Directory"
        title="Recently updated listings"
        intro="Listings whose directory information we most recently updated or re-verified. These dates reflect changes to our records — not necessarily a change at the business itself."
      />
      <Section>
        {entries.length > 0 ? (
          <ul className="grid gap-5 sm:grid-cols-2">
            {entries.map((e) => {
              const when = fmt(e.updatedAt);
              return (
                <li key={e.id}>
                  {when && (
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                      Directory info updated {when}
                    </p>
                  )}
                  <EntryCard entry={e} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-card border border-line bg-asphalt-800 p-6 text-muted">
            No recently updated listings to show yet. <Link href="/directory" className="text-signal underline-offset-4 hover:underline">Browse the directory →</Link>
          </p>
        )}
        <p className="mt-10 text-sm text-muted">
          <Link href="/directory/new-locations" className="text-signal underline-offset-4 hover:underline">
            Newest listings →
          </Link>{' '}
          ·{' '}
          <Link href="/directory" className="text-signal underline-offset-4 hover:underline">
            Browse all directories →
          </Link>
        </p>
      </Section>
    </>
  );
}
