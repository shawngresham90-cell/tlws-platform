import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Section } from '@/components/ui';
import { DirectoryHero, MultiCategoryBrowser } from '@/components/directory';
import {
  interstateBySlug,
  interstateSlug,
  exitSlug,
  exitFromSlug,
} from '@/lib/directory/interstates';
import { getEntriesByExit, getDirectoryFacets } from '@/lib/directory/data';
import { listingListSchemaWithReviews } from '@/lib/directory/seo';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * Interstate exit pages (/directory/i75/exit-201): everything a driver can
 * reach at one exit — truck stops, parking, scales, hotels, tires, washes —
 * generated purely from the data. Exits exist as pages only while they have
 * at least one published listing; an exit with no listings renders 404, so no
 * empty exit pages are ever generated or indexed.
 *
 * Exit numbers restart at each state line, so one exit page can legitimately
 * cover the same number in two states (I-75 Exit 60 exists in both Georgia
 * and Tennessee) — the browser groups results by state to keep that honest.
 */

// dynamicParams stays TRUE — see the note in ../page.tsx (Netlify purge bug).
export const revalidate = 300;

export async function generateStaticParams() {
  const facets = await getDirectoryFacets();
  const params: { category: string; exit: string }[] = [];
  for (const [designation, exits] of Object.entries(facets.exitsByInterstate)) {
    const slug = interstateSlug(designation);
    if (!slug) continue;
    for (const exit of exits) params.push({ category: slug, exit: exitSlug(exit) });
  }
  return params;
}

async function resolveExit(params: { category: string; exit: string }) {
  const interstate = /^i\d{1,3}$/i.test(params.category)
    ? interstateBySlug(params.category)
    : undefined;
  if (!interstate) return null;
  const facets = await getDirectoryFacets();
  const knownExits = facets.exitsByInterstate[interstate.designation] ?? [];
  const exit = exitFromSlug(params.exit, knownExits);
  if (!exit) return null;
  return { interstate, exit };
}

export async function generateMetadata({
  params,
}: {
  params: { category: string; exit: string };
}): Promise<Metadata> {
  const resolved = await resolveExit(params);
  if (!resolved) return {};
  const { interstate, exit } = resolved;
  return buildMetadata({
    title: `${interstate.designation} Exit ${exit} — Truck Stops, Parking & Services | Trucking Life with Shawn`,
    description:
      `What's at ${interstate.designation} Exit ${exit} for drivers: verified truck stops, ` +
      'truck parking, CAT scales, truck washes, tire repair, and hotels with truck parking.',
    path: `/directory/${interstate.slug}/${params.exit.toLowerCase()}`,
  });
}

export default async function ExitPage({
  params,
}: {
  params: { category: string; exit: string };
}) {
  const resolved = await resolveExit(params);
  if (!resolved) notFound();
  const { interstate, exit } = resolved;

  const entries = await getEntriesByExit(interstate.designation, exit);
  // An exit page only exists while it has published listings.
  if (entries.length === 0) notFound();

  const places = [...new Set(entries.map((e) => `${e.city}, ${e.state}`))];
  const path = `/directory/${interstate.slug}/${exitSlug(exit)}`;
  const listings = await listingListSchemaWithReviews(
    entries,
    `${interstate.designation} Exit ${exit} — Truck Stops & Driver Services`,
    path,
  );

  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Directory', path: '/directory' },
            { name: interstate.designation, path: `/directory/${interstate.slug}` },
            { name: `Exit ${exit}`, path },
          ]),
          ...(listings ? [listings] : []),
        ]}
      />
      <DirectoryHero
        crumbs={[
          { name: 'Home', href: '/' },
          { name: 'Directory', href: '/directory' },
          { name: interstate.designation, href: `/directory/${interstate.slug}` },
          { name: `Exit ${exit}` },
        ]}
        eyebrow={`${interstate.designation} · Exit ${exit}`}
        title={`Everything at Exit ${exit}`}
        intro={`${entries.length} verified location${entries.length === 1 ? '' : 's'} serving ${
          interstate.designation
        } Exit ${exit} — ${places.join(' · ')}.`}
      />
      <Section>
        <MultiCategoryBrowser
          entries={entries}
          scopeLabel={`${interstate.designation} Exit ${exit}`}
          groupBy="state"
          stateOrder={interstate.stateOrder}
        />
        <p className="mt-10 text-sm text-muted">
          <Link
            href={`/directory/${interstate.slug}`}
            className="text-signal underline-offset-4 hover:underline"
          >
            ← All of {interstate.designation}
          </Link>{' '}
          ·{' '}
          <Link href="/directory" className="text-signal underline-offset-4 hover:underline">
            Browse all directories
          </Link>
        </p>
      </Section>
    </>
  );
}
