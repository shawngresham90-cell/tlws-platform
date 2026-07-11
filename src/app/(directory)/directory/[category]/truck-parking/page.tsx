import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Section } from '@/components/ui';
import { DirectoryHero, EntryCard, RelatedLinks } from '@/components/directory';
import { interstateBySlug } from '@/lib/directory/interstates';
import { stateByCode } from '@/lib/directory/states';
import { getEntriesByInterstate, getDirectoryFacets } from '@/lib/directory/data';
import { interstateScopeLinks } from '@/lib/directory/scope-links';
import { listingListSchema } from '@/lib/directory/seo';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import type { DirectoryEntry } from '@/lib/directory/types';

/**
 * "Truck parking on [Interstate]" (Milestone 25) — e.g. /directory/i75/truck-parking.
 * A corridor parking guide grouped by state: which stops offer free, paid,
 * reserved, and overnight parking, with verified truck-space counts where we
 * have them and reservation links where a listing carries one. No parking
 * availability is invented — only stored flags and counts are shown. Static
 * segment under [category]; [category] resolves as the interstate.
 */

export const revalidate = 300;

const PARKING_CHIPS = ['Free parking', 'Paid parking', 'Reserved', 'Overnight OK'] as const;
const PARKING_CATEGORIES = new Set(['parking', 'truck-stops', 'hotels-truck-parking']);

function resolveInterstate(slug: string) {
  return /^i\d{1,3}$/i.test(slug) ? (interstateBySlug(slug) ?? null) : null;
}

function hasParking(e: DirectoryEntry): boolean {
  if (PARKING_CATEGORIES.has(e.category)) return true;
  return (e.amenities ?? []).some((a) => (PARKING_CHIPS as readonly string[]).includes(a));
}

export async function generateStaticParams() {
  const facets = await getDirectoryFacets();
  return facets.interstates
    .map((d) => interstateBySlug(d.replace(/^I-?/i, 'i')))
    .filter((i): i is NonNullable<typeof i> => Boolean(i))
    .map((i) => ({ category: i.slug }));
}

export function generateMetadata({ params }: { params: { category: string } }): Metadata {
  const interstate = resolveInterstate(params.category);
  if (!interstate) return {};
  return buildMetadata({
    title: `${interstate.designation} Truck Parking by State — Free, Paid & Overnight | Trucking Life with Shawn`,
    description:
      `Where to park a truck along ${interstate.designation}: free, paid, reserved, and overnight ` +
      'parking by state, with verified truck-space counts and reservation links where available.',
    path: `/directory/${interstate.slug}/truck-parking`,
  });
}

export default async function InterstateParkingPage({ params }: { params: { category: string } }) {
  const interstate = resolveInterstate(params.category);
  if (!interstate) notFound();

  const [entries, facets] = await Promise.all([
    getEntriesByInterstate(interstate.designation),
    getDirectoryFacets(),
  ]);
  const parking = entries.filter(hasParking);
  const path = `/directory/${interstate.slug}/truck-parking`;

  // Group by state in geographic order, then alphabetical for the rest.
  const byState = new Map<string, DirectoryEntry[]>();
  for (const e of parking) {
    (byState.get(e.state) ?? byState.set(e.state, []).get(e.state)!).push(e);
  }
  const orderedCodes = [
    ...interstate.stateOrder.filter((c) => byState.has(c)),
    ...[...byState.keys()].filter((c) => !interstate.stateOrder.includes(c)).sort(),
  ];

  // Corridor-wide counts of each parking TYPE — stored flags only, never invented.
  const typeCounts = PARKING_CHIPS.map((chip) => ({
    chip,
    n: parking.filter((e) => (e.amenities ?? []).includes(chip)).length,
  })).filter((t) => t.n > 0);
  const withSpaces = parking.filter((e) => e.parkingSpaces != null).length;

  const listSchema = listingListSchema(parking, `${interstate.designation} truck parking`, path);

  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Directory', path: '/directory' },
            { name: interstate.designation, path: `/directory/${interstate.slug}` },
            { name: 'Truck parking', path },
          ]),
          ...(listSchema ? [listSchema] : []),
        ]}
      />
      <DirectoryHero
        crumbs={[
          { name: 'Home', href: '/' },
          { name: 'Directory', href: '/directory' },
          { name: interstate.designation, href: `/directory/${interstate.slug}` },
          { name: 'Truck parking' },
        ]}
        eyebrow={`Directory · ${interstate.designation}`}
        title={`Truck parking on ${interstate.designation}`}
        intro={
          parking.length > 0
            ? `${parking.length} verified parking option${parking.length === 1 ? '' : 's'} along ` +
              `${interstate.designation} across ${orderedCodes.length} state${orderedCodes.length === 1 ? '' : 's'} — ` +
              'free, paid, reserved, and overnight, in the order you drive them.'
            : `${interstate.designation} parking is still being verified and loaded.`
        }
      />
      <Section>
        {parking.length > 0 ? (
          <>
            {(typeCounts.length > 0 || withSpaces > 0) && (
              <div className="mb-8 flex flex-wrap gap-2">
                {typeCounts.map((t) => (
                  <span
                    key={t.chip}
                    className="rounded-card border border-signal/40 bg-signal/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-signal"
                  >
                    {t.chip}: {t.n}
                  </span>
                ))}
                {withSpaces > 0 && (
                  <span className="rounded-card border border-line px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
                    {withSpaces} with verified space counts
                  </span>
                )}
              </div>
            )}
            {orderedCodes.map((code) => {
              const state = stateByCode(code);
              const list = byState.get(code)!;
              return (
                <section key={code} className="mb-12">
                  <div className="mb-4 flex items-baseline justify-between">
                    <h2 className="font-display text-2xl uppercase text-ink">
                      {state?.name ?? code}
                    </h2>
                    {state && (
                      <Link
                        href={`/directory/${state.slug}`}
                        className="text-sm text-signal underline-offset-4 hover:underline"
                      >
                        All {state.name} →
                      </Link>
                    )}
                  </div>
                  <ul className="grid gap-5 sm:grid-cols-2">
                    {list.map((e) => (
                      <li key={e.id}>
                        <EntryCard entry={e} />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </>
        ) : (
          <p className="rounded-card border border-line bg-asphalt-800 p-6 text-muted">
            No verified {interstate.designation} parking yet. Browse{' '}
            <Link href={`/directory/${interstate.slug}`} className="text-signal underline-offset-4 hover:underline">
              the whole {interstate.designation} corridor →
            </Link>
          </p>
        )}
        <div className="mt-6">
          <RelatedLinks
            groups={interstateScopeLinks(interstate.designation, interstate.stateOrder, entries, facets)}
          />
        </div>
        <p className="mt-10 text-sm text-muted">
          <Link href="/directory/map" className="text-signal underline-offset-4 hover:underline">
            View parking on the map →
          </Link>{' '}
          ·{' '}
          <Link href="/directory/parking" className="text-signal underline-offset-4 hover:underline">
            Reservable paid parking →
          </Link>
        </p>
      </Section>
    </>
  );
}
