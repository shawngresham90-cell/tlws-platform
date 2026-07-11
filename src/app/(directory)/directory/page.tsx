import Link from 'next/link';
import { Section, Eyebrow } from '@/components/ui';
import { CategoryCardGrid } from '@/components/directory';
import { DIRECTORY_CATEGORIES, categoryHref } from '@/lib/directory/categories';
import { getDirectoryFacets } from '@/lib/directory/data';
import { stateByCode } from '@/lib/directory/states';
import { interstateSlug } from '@/lib/directory/interstates';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import { SITE } from '@/lib/seo/site';

export const metadata = buildMetadata({
  title:
    'Driver Directory — Parking, Truck Stops, Scales, Repair & More | Trucking Life with Shawn',
  description:
    'The driver-built directory: truck parking, truck stops, CAT scales, truck washes, tire repair, weigh stations, hotels with truck parking, CDL schools, and roadside service.',
  path: '/directory',
});

/**
 * The /directory hub — every category card comes from the shared registry
 * (lib/directory/categories), so adding a directory there adds it here, to the
 * engine's static pages, and to the sitemap in one move. All nine categories
 * link to real pages now: Truck Parking to its foundation page, the rest to
 * the shared Directory Engine page.
 */
// Refresh the browse-by-state / browse-by-interstate blocks as data grows.
export const revalidate = 300;

const browseChip =
  'rounded-card border border-line bg-asphalt-800 px-4 py-2 text-sm font-semibold text-ink ' +
  'transition-colors hover:border-signal hover:text-signal';

export default async function DirectoryPage() {
  // States and corridors listed here come straight from the published data —
  // importing a new state's batch adds its links automatically.
  const facets = await getDirectoryFacets();
  const states = facets.states
    .map((code) => ({ state: stateByCode(code), count: facets.countsByState[code] ?? 0 }))
    .filter((s): s is { state: NonNullable<typeof s.state>; count: number } => Boolean(s.state));
  const interstates = facets.interstates
    .map((designation) => ({
      designation,
      slug: interstateSlug(designation),
      count: facets.countsByInterstate[designation] ?? 0,
    }))
    .filter((i): i is { designation: string; slug: string; count: number } => Boolean(i.slug));

  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Directory', path: '/directory' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Driver Directory',
            description: 'Directory categories for truck drivers.',
            itemListElement: DIRECTORY_CATEGORIES.map((c, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: c.title,
              url: `${SITE.url}${categoryHref(c)}`,
            })),
          },
        ]}
      />

      <Section className="border-b border-line">
        <div className="max-w-2xl">
          <Eyebrow>The Driver Directory</Eyebrow>
          <h1 className="display-section">Know your stop before the exit</h1>
          <p className="mt-4 text-muted">
            Parking, fuel, washes, tires, scales, schools, and breakdown help — the stuff you
            actually need on the road, built by drivers, for drivers. Every directory below is open;
            verified locations are being loaded state by state.
          </p>
        </div>
        <div className="mt-10">
          <CategoryCardGrid categories={DIRECTORY_CATEGORIES} />
        </div>

        {/* Driver community (Milestone 16): drivers feed the directory. */}
        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          <Link
            href="/directory/submit"
            className="rounded-card border border-line bg-asphalt-800 p-6 transition-colors hover:border-signal"
          >
            <span className="text-2xl" aria-hidden="true">
              📍
            </span>
            <h2 className="mt-2 font-display text-xl uppercase text-ink">Submit a location</h2>
            <p className="mt-1 text-sm text-muted">
              Add a spot we don’t list, or report corrections, closures, and amenity changes.
              Every report is human-reviewed before it goes live.
            </p>
          </Link>
          <Link
            href="/directory/reviews"
            className="rounded-card border border-line bg-asphalt-800 p-6 transition-colors hover:border-signal"
          >
            <span className="text-2xl" aria-hidden="true">
              ⭐
            </span>
            <h2 className="mt-2 font-display text-xl uppercase text-ink">Driver reviews</h2>
            <p className="mt-1 text-sm text-muted">
              Rate the stops in the directory so the next driver knows what’s really at the exit —
              moderated, driver-only reviews.
            </p>
          </Link>
        </div>

        {(states.length > 0 || interstates.length > 0) && (
          <div className="mt-14 grid gap-10 lg:grid-cols-2">
            {states.length > 0 && (
              <div>
                <h2 className="font-display text-2xl uppercase text-ink">Browse by state</h2>
                <p className="mt-1 text-sm text-muted">
                  Every state with verified locations — more loading state by state.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {states.map(({ state, count }) => (
                    <Link key={state.code} href={`/directory/${state.slug}`} className={browseChip}>
                      {state.name} ({count})
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {interstates.length > 0 && (
              <div>
                <h2 className="font-display text-2xl uppercase text-ink">Browse by interstate</h2>
                <p className="mt-1 text-sm text-muted">
                  Whole corridors, organized by state and exit.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {interstates.map(({ designation, slug, count }) => (
                    <Link key={slug} href={`/directory/${slug}`} className={browseChip}>
                      {designation} ({count})
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>
    </>
  );
}
