import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Section } from '@/components/ui';
import { GetFeaturedCta } from '@/components/directory';
import {
  DirectoryHero,
  DirectoryBrowser,
  MultiCategoryBrowser,
  FaqSection,
  NearbySections,
  RelatedLinks,
  SponsorSlot,
} from '@/components/directory';
import { buildFaqs } from '@/lib/directory/faq';
import {
  stateScopeLinks,
  interstateScopeLinks,
  categoryScopeLinks,
} from '@/lib/directory/scope-links';
import { ENGINE_CATEGORIES, getCategory } from '@/lib/directory/categories';
import type { DirectoryCategory } from '@/lib/directory/types';
import { stateBySlug, stateByCode, type DirectoryState } from '@/lib/directory/states';
import {
  interstateBySlug,
  interstateSlug,
  exitSlug,
  type DirectoryInterstate,
} from '@/lib/directory/interstates';
import {
  getEntries,
  getEntriesByState,
  getEntriesByInterstate,
  getDirectoryFacets,
} from '@/lib/directory/data';
import { listingListSchemaWithReviews } from '@/lib/directory/seo';
import { JsonLd, breadcrumbSchema, faqSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * The Directory Engine page. One dynamic segment now serves three page kinds,
 * resolved by slug — registry categories (/directory/truck-stops), state
 * landing pages (/directory/georgia), and interstate corridors
 * (/directory/i75). States and corridors come straight from the data: the
 * moment listings for a new state or highway are imported, its page, sitemap
 * entry, and hub links exist with zero code changes.
 */

// dynamicParams stays TRUE (the Next default). With it locked to false,
// Netlify's runtime refuses to re-render these paths after the admin's
// revalidatePath() purge (imports/publishes), serving 404s until the next
// deploy — reproduced twice in production. Unknown slugs still 404 via the
// resolveSlug() notFound guard below, so behavior for bad URLs is unchanged.

// Listings come from the database — refresh periodically in addition to the
// on-save revalidation the admin actions trigger.
export const revalidate = 300;

type Resolved =
  | { kind: 'category'; category: DirectoryCategory }
  | { kind: 'state'; state: DirectoryState }
  | { kind: 'interstate'; interstate: DirectoryInterstate };

function resolveSlug(slug: string): Resolved | null {
  const category = getCategory(slug);
  if (category) {
    // Categories with a hand-built page (Truck Parking) keep their literal
    // route; this dynamic segment does not claim the slug.
    return category.customHref ? null : { kind: 'category', category };
  }
  const state = stateBySlug(slug);
  if (state) return { kind: 'state', state };
  if (/^i\d{1,3}$/i.test(slug)) {
    const interstate = interstateBySlug(slug);
    if (interstate) return { kind: 'interstate', interstate };
  }
  return null;
}

export async function generateStaticParams() {
  const params = ENGINE_CATEGORIES.map((c) => ({ category: c.slug }));
  // States/corridors present in the data prerender at build; new ones render
  // on demand (dynamicParams) until the next build picks them up.
  const facets = await getDirectoryFacets();
  for (const code of facets.states) {
    const state = stateByCode(code);
    if (state) params.push({ category: state.slug });
  }
  for (const designation of facets.interstates) {
    const slug = interstateSlug(designation);
    if (slug) params.push({ category: slug });
  }
  return params;
}

export function generateMetadata({ params }: { params: { category: string } }): Metadata {
  const resolved = resolveSlug(params.category);
  if (!resolved) return {};
  if (resolved.kind === 'category') {
    return buildMetadata({
      title: resolved.category.seoTitle,
      description: resolved.category.seoDescription,
      path: `/directory/${resolved.category.slug}`,
    });
  }
  if (resolved.kind === 'state') {
    const { name, slug } = resolved.state;
    return buildMetadata({
      title: `${name} Truck Stops, Parking & Driver Services | Trucking Life with Shawn`,
      description:
        `Verified ${name} directory for drivers: truck stops, truck parking, CAT scales, ` +
        'truck washes, tire repair, hotels with truck parking, roadside service, and weigh stations.',
      path: `/directory/${slug}`,
    });
  }
  const { designation, slug } = resolved.interstate;
  return buildMetadata({
    title: `${designation} Truck Stops & Services by State and Exit | Trucking Life with Shawn`,
    description:
      `The ${designation} corridor for drivers: verified truck stops, parking, CAT scales, ` +
      'washes, tire repair, hotels, and weigh stations, organized by state and exit.',
    path: `/directory/${slug}`,
  });
}

export default async function DirectoryEnginePage({ params }: { params: { category: string } }) {
  const resolved = resolveSlug(params.category);
  if (!resolved) notFound();

  if (resolved.kind === 'category') {
    const category = resolved.category;
    const [entries, facets] = await Promise.all([getEntries(category.slug), getDirectoryFacets()]);
    const listings = await listingListSchemaWithReviews(
      entries,
      category.title,
      `/directory/${category.slug}`,
    );
    return (
      <>
        <JsonLd
          schema={[
            breadcrumbSchema([
              { name: 'Home', path: '/' },
              { name: 'Directory', path: '/directory' },
              { name: category.title, path: `/directory/${category.slug}` },
            ]),
            ...(listings ? [listings] : []),
          ]}
        />
        <DirectoryHero
          crumbs={[
            { name: 'Home', href: '/' },
            { name: 'Directory', href: '/directory' },
            { name: category.title },
          ]}
          eyebrow={`Directory · ${category.title}`}
          title={category.heroTitle}
          intro={category.heroIntro}
        />
        <Section>
          <DirectoryBrowser categoryTitle={category.title} entries={entries} />
          <RelatedLinks groups={categoryScopeLinks(facets)} />
          <p className="mt-10 text-sm text-muted">
            <Link href="/directory/map" className="text-signal underline-offset-4 hover:underline">
              View on map →
            </Link>{' '}
            · Looking for something else?{' '}
            <Link href="/directory" className="text-signal underline-offset-4 hover:underline">
              Browse all directories →
            </Link>
          </p>
        </Section>
      </>
    );
  }

  if (resolved.kind === 'state') {
    const state = resolved.state;
    const [entries, facets] = await Promise.all([
      getEntriesByState(state.code),
      getDirectoryFacets(),
    ]);
    const cities = new Set(entries.map((e) => e.city));
    const faqs = buildFaqs(entries, { kind: 'state', label: state.name });
    const listings = await listingListSchemaWithReviews(
      entries,
      `${state.name} Truck Stops & Driver Services`,
      `/directory/${state.slug}`,
    );
    return (
      <>
        <JsonLd
          schema={[
            breadcrumbSchema([
              { name: 'Home', path: '/' },
              { name: 'Directory', path: '/directory' },
              { name: state.name, path: `/directory/${state.slug}` },
            ]),
            ...(listings ? [listings] : []),
            ...(faqSchema(faqs) ? [faqSchema(faqs)!] : []),
          ]}
        />
        <DirectoryHero
          crumbs={[
            { name: 'Home', href: '/' },
            { name: 'Directory', href: '/directory' },
            { name: state.name },
          ]}
          eyebrow={`Directory · ${state.name}`}
          title={`${state.name}, stop by stop`}
          intro={
            entries.length > 0
              ? `${entries.length} verified location${entries.length === 1 ? '' : 's'} across ` +
                `${cities.size} ${state.name} ${cities.size === 1 ? 'city' : 'cities'} — truck ` +
                'stops, parking, scales, washes, tires, hotels, roadside help, and weigh stations.'
              : `${state.name} locations are being verified and loaded — no filler, no scraped junk.`
          }
        />
        <Section>
          <SponsorSlot placement="state" state={state.code} className="mb-8" />
          {entries.some((e) => e.category === 'truck-stops') && (
            <p className="mb-6 text-sm">
              <Link
                href={`/directory/${state.slug}/top-truck-stops`}
                className="font-semibold text-signal underline-offset-4 hover:underline"
              >
                🏆 Top truck stops in {state.name} →
              </Link>
            </p>
          )}
          <MultiCategoryBrowser entries={entries} scopeLabel={state.name} groupBy="category" />
          <NearbySections entries={entries} scopeLabel={state.name} />
          <FaqSection faqs={faqs} heading={`${state.name} driver FAQ`} />
          <RelatedLinks groups={stateScopeLinks(state.name, state.code, entries, facets)} />
          <p className="mt-10 text-sm text-muted">
            <Link href="/directory/map" className="text-signal underline-offset-4 hover:underline">
              View on map →
            </Link>{' '}
            · Looking for something else?{' '}
            <Link href="/directory" className="text-signal underline-offset-4 hover:underline">
              Browse all directories →
            </Link>
          </p>
        </Section>
      </>
    );
  }

  const interstate = resolved.interstate;
  const [entries, facets] = await Promise.all([
    getEntriesByInterstate(interstate.designation),
    getDirectoryFacets(),
  ]);
  const exits = facets.exitsByInterstate[interstate.designation] ?? [];
  const stateCodes = new Set(entries.map((e) => e.state));
  const faqs = buildFaqs(entries, { kind: 'interstate', label: interstate.designation });
  const listings = await listingListSchemaWithReviews(
    entries,
    `${interstate.designation} Truck Stops & Driver Services`,
    `/directory/${interstate.slug}`,
  );
  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Directory', path: '/directory' },
            { name: interstate.designation, path: `/directory/${interstate.slug}` },
          ]),
          ...(listings ? [listings] : []),
          ...(faqSchema(faqs) ? [faqSchema(faqs)!] : []),
        ]}
      />
      <DirectoryHero
        crumbs={[
          { name: 'Home', href: '/' },
          { name: 'Directory', href: '/directory' },
          { name: interstate.designation },
        ]}
        eyebrow={`Directory · ${interstate.designation}`}
        title={`${interstate.designation}, end to end`}
        intro={
          entries.length > 0
            ? `${entries.length} verified location${entries.length === 1 ? '' : 's'} across ` +
              `${stateCodes.size} state${stateCodes.size === 1 ? '' : 's'}. ${interstate.intro}`
            : interstate.intro
        }
      />
      <Section>
        <SponsorSlot placement="interstate" interstate={interstate.designation} className="mb-8" />
        <p className="mb-6 text-sm">
          <Link
            href={`/directory/${interstate.slug}/truck-parking`}
            className="font-semibold text-signal underline-offset-4 hover:underline"
          >
            🅿️ Truck parking on {interstate.designation}, state by state →
          </Link>
        </p>
        {exits.length > 0 && (
          <nav aria-label={`${interstate.designation} exits with coverage`} className="mb-8">
            <h2 className="font-display text-xl uppercase text-ink">Jump to an exit</h2>
            <p className="mt-1 text-sm text-muted">
              Exit numbers repeat state to state — each exit page is grouped by state.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {exits.map((exit) => (
                <Link
                  key={exit}
                  href={`/directory/${interstate.slug}/${exitSlug(exit)}`}
                  className="rounded-card border border-line px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-signal hover:text-signal"
                >
                  Exit {exit}
                </Link>
              ))}
            </div>
          </nav>
        )}
        <MultiCategoryBrowser
          entries={entries}
          scopeLabel={interstate.designation}
          groupBy="state"
          stateOrder={interstate.stateOrder}
        />
        <NearbySections entries={entries} scopeLabel={interstate.designation} />
        <FaqSection faqs={faqs} heading={`${interstate.designation} driver FAQ`} />
        <RelatedLinks
          groups={interstateScopeLinks(
            interstate.designation,
            interstate.stateOrder,
            entries,
            facets,
          )}
        />
        <p className="mt-10 text-sm text-muted">
          <Link href="/directory/map" className="text-signal underline-offset-4 hover:underline">
            View on map →
          </Link>{' '}
          · Looking for something else?{' '}
          <Link href="/directory" className="text-signal underline-offset-4 hover:underline">
            Browse all directories →
          </Link>
        </p>
        <GetFeaturedCta surface={params.category} className="mt-8 border-t border-line pt-8" />
      </Section>
    </>
  );
}
