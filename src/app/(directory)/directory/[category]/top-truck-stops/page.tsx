import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Section } from '@/components/ui';
import { DirectoryHero, EntryCard, RelatedLinks } from '@/components/directory';
import { stateBySlug, stateByCode } from '@/lib/directory/states';
import { getEntriesByState, getDirectoryFacets } from '@/lib/directory/data';
import { getReviewAggregates } from '@/lib/community/data';
import { topRanked, RANK_METHODOLOGY } from '@/lib/directory/ranking';
import { stateScopeLinks } from '@/lib/directory/scope-links';
import { listingListSchema } from '@/lib/directory/seo';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * "Top truck stops in [State]" (Milestone 25). A conservative, factual leader
 * board: truck stops in one state ordered by the disclosed ranking signals
 * (completeness, verification recency, approved reviews, parking, amenities) —
 * never by popularity. The heading says "well-documented," not "best," and the
 * methodology is printed on the page. Static segment under [category], so it
 * wins over the [exit] route; [category] resolves as the state.
 */

export const revalidate = 300;

const CATEGORY = 'truck-stops';

function resolveState(slug: string) {
  return stateBySlug(slug) ?? null;
}

export async function generateStaticParams() {
  const facets = await getDirectoryFacets();
  return facets.states
    .map((code) => stateByCode(code))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => ({ category: s.slug }));
}

export function generateMetadata({ params }: { params: { category: string } }): Metadata {
  const state = resolveState(params.category);
  if (!state) return {};
  return buildMetadata({
    title: `Top Truck Stops in ${state.name} — Most Complete Listings | Trucking Life with Shawn`,
    description:
      `The best-documented truck stops in ${state.name}, ranked by verified information ` +
      'completeness, recency, approved driver reviews, parking capacity, and amenities — not popularity.',
    path: `/directory/${state.slug}/top-truck-stops`,
  });
}

export default async function TopTruckStopsPage({ params }: { params: { category: string } }) {
  const state = resolveState(params.category);
  if (!state) notFound();

  const [entries, facets, aggregates] = await Promise.all([
    getEntriesByState(state.code),
    getDirectoryFacets(),
    getReviewAggregates(),
  ]);
  const reviewCounts = Object.fromEntries(
    Object.entries(aggregates).map(([id, a]) => [id, a.count]),
  );
  const inCategory = entries.filter((e) => e.category === CATEGORY);
  const ranked = topRanked(inCategory, { reviewCounts, limit: 25 });
  const path = `/directory/${state.slug}/top-truck-stops`;
  const listSchema = listingListSchema(
    ranked.map((r) => r.entry),
    `Top truck stops in ${state.name}`,
    path,
  );

  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Directory', path: '/directory' },
            { name: state.name, path: `/directory/${state.slug}` },
            { name: 'Top truck stops', path },
          ]),
          ...(listSchema ? [listSchema] : []),
        ]}
      />
      <DirectoryHero
        crumbs={[
          { name: 'Home', href: '/' },
          { name: 'Directory', href: '/directory' },
          { name: state.name, href: `/directory/${state.slug}` },
          { name: 'Top truck stops' },
        ]}
        eyebrow={`Directory · ${state.name}`}
        title={`Well-documented truck stops in ${state.name}`}
        intro={
          ranked.length > 0
            ? `The ${ranked.length} most thoroughly documented and recently verified truck ` +
              `stop${ranked.length === 1 ? '' : 's'} in ${state.name}. Ranked by facts on file — not clicks.`
            : `${state.name} truck stops are still being verified and documented — check back soon.`
        }
      />
      <Section>
        {ranked.length > 0 ? (
          <>
            <p className="mb-6 max-w-3xl rounded-card border border-line bg-asphalt-800 p-4 text-sm text-muted">
              <span className="font-semibold text-ink">How this list is ordered:</span>{' '}
              {RANK_METHODOLOGY}
            </p>
            <ol className="grid gap-5 sm:grid-cols-2">
              {ranked.map((r) => (
                <li key={r.entry.id}>
                  <EntryCard entry={r.entry} />
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="rounded-card border border-line bg-asphalt-800 p-6 text-muted">
            No truck stops in {state.name} have enough verified detail to rank yet. Meanwhile,{' '}
            <Link href={`/directory/${state.slug}`} className="text-signal underline-offset-4 hover:underline">
              browse everything in {state.name} →
            </Link>
          </p>
        )}
        <div className="mt-10">
          <RelatedLinks groups={stateScopeLinks(state.name, state.code, entries, facets)} />
        </div>
        <p className="mt-10 text-sm text-muted">
          <Link href={`/directory/${state.slug}`} className="text-signal underline-offset-4 hover:underline">
            All {state.name} listings →
          </Link>{' '}
          ·{' '}
          <Link href="/directory/map" className="text-signal underline-offset-4 hover:underline">
            View on map →
          </Link>
        </p>
      </Section>
    </>
  );
}
