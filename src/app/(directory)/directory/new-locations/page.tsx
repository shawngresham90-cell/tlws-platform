import type { Metadata } from 'next';
import Link from 'next/link';
import { Section } from '@/components/ui';
import { DirectoryHero, EntryCard } from '@/components/directory';
import { getNewestListings } from '@/lib/directory/data';
import { listingListSchema } from '@/lib/directory/seo';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * "Newest listings" (Milestone 25). Published, non-deleted listings ordered by
 * their stored created_at, with real pagination and a hard page cap so a huge
 * catalog can't be walked into an unbounded query. No fabricated dates.
 */

export const revalidate = 300;
const PATH = '/directory/new-locations';
const PAGE_SIZE = 24;
const MAX_PAGE = 50; // hard cap: newest is a discovery surface, not a full crawl

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: 'Newest Truck Stop & Parking Listings | Trucking Life with Shawn',
    description:
      'The newest truck stops, parking, scales, and driver-service listings added to the ' +
      'directory — freshly verified locations, newest first.',
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

export default async function NewLocationsPage({
  searchParams,
}: {
  searchParams?: { page?: string };
}) {
  const raw = Number.parseInt(searchParams?.page ?? '1', 10);
  const page = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), MAX_PAGE) : 1;
  const offset = (page - 1) * PAGE_SIZE;

  // Fetch one extra to know whether a next page exists, without a count query.
  const fetched = await getNewestListings(PAGE_SIZE + 1, offset);
  const hasNext = fetched.length > PAGE_SIZE && page < MAX_PAGE;
  const entries = fetched.slice(0, PAGE_SIZE);
  const listSchema = listingListSchema(entries, 'Newest listings', PATH);

  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Directory', path: '/directory' },
            { name: 'Newest listings', path: PATH },
          ]),
          ...(listSchema ? [listSchema] : []),
        ]}
      />
      <DirectoryHero
        crumbs={[
          { name: 'Home', href: '/' },
          { name: 'Directory', href: '/directory' },
          { name: 'Newest listings' },
        ]}
        eyebrow="Directory"
        title="Newest listings"
        intro="The most recently added locations in the directory — freshly researched and verified, newest first."
      />
      <Section>
        {entries.length > 0 ? (
          <>
            <ul className="grid gap-5 sm:grid-cols-2">
              {entries.map((e) => {
                const when = fmt(e.createdAt);
                return (
                  <li key={e.id}>
                    {when && (
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                        Added {when}
                      </p>
                    )}
                    <EntryCard entry={e} />
                  </li>
                );
              })}
            </ul>
            <nav className="mt-10 flex items-center justify-between text-sm" aria-label="Pagination">
              {page > 1 ? (
                <Link
                  href={page - 1 === 1 ? PATH : `${PATH}?page=${page - 1}`}
                  className="text-signal underline-offset-4 hover:underline"
                  rel="prev"
                >
                  ← Newer
                </Link>
              ) : (
                <span />
              )}
              <span className="text-muted">Page {page}</span>
              {hasNext ? (
                <Link
                  href={`${PATH}?page=${page + 1}`}
                  className="text-signal underline-offset-4 hover:underline"
                  rel="next"
                >
                  Older →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          </>
        ) : (
          <p className="rounded-card border border-line bg-asphalt-800 p-6 text-muted">
            {page > 1 ? 'No more listings on this page.' : 'No listings to show yet.'}{' '}
            <Link href="/directory" className="text-signal underline-offset-4 hover:underline">
              Browse the directory →
            </Link>
          </p>
        )}
        <p className="mt-10 text-sm text-muted">
          <Link href="/directory/recently-updated" className="text-signal underline-offset-4 hover:underline">
            Recently updated →
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
