import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Section } from '@/components/ui';
import {
  DirectoryHero,
  MultiCategoryBrowser,
  FaqSection,
  NearbySections,
  RelatedLinks,
} from '@/components/directory';
import { buildFaqs } from '@/lib/directory/faq';
import { entriesNearExit } from '@/lib/directory/related';
import { exitScopeLinks } from '@/lib/directory/scope-links';
import {
  interstateBySlug,
  interstateSlug,
  exitSlug,
  exitFromSlug,
} from '@/lib/directory/interstates';
import {
  getDirectoryFacets,
  throwDirectoryUnavailable,
  unwrapDirectoryRead,
  type DirectoryReadFailure,
} from '@/lib/directory/data';
import {
  cachedDirectoryFacetsResult,
  cachedEntriesByExitResult,
  cachedEntriesByInterstateResult,
} from '@/lib/directory/request-cache';
import { listingListSchemaWithReviews } from '@/lib/directory/seo';
import { JsonLd, breadcrumbSchema, faqSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import { toCardEntry } from '@/lib/directory/dto';

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
  // Fail-soft ON PURPOSE: a build that cannot reach the database should
  // prerender nothing and let pages render on demand (dynamicParams stays
  // true), never fail the build — and never bake a 404 for a real exit.
  const facets = await getDirectoryFacets();
  const params: { category: string; exit: string }[] = [];
  for (const [designation, exits] of Object.entries(facets.exitsByInterstate)) {
    const slug = interstateSlug(designation);
    if (!slug) continue;
    for (const exit of exits) params.push({ category: slug, exit: exitSlug(exit) });
  }
  return params;
}

/**
 * Three outcomes, never two. "The facet read failed" is not "this exit does
 * not exist" — collapsing them is what served a cached 404 on
 * /directory/i75/exit-369 while 11 published rows existed.
 */
type ExitResolution =
  | { status: 'ok'; interstate: NonNullable<ReturnType<typeof interstateBySlug>>; exit: string }
  | { status: 'not-found' }
  | { status: 'unavailable'; reason: DirectoryReadFailure; code?: string };

async function resolveExit(params: { category: string; exit: string }): Promise<ExitResolution> {
  const interstate = /^i\d{1,3}$/i.test(params.category)
    ? interstateBySlug(params.category)
    : undefined;
  // Pure check against the corridor registry — no database involved, so an
  // unknown slug is a genuine 404 regardless of database health.
  if (!interstate) return { status: 'not-found' };

  const facetsResult = await cachedDirectoryFacetsResult();
  if (!facetsResult.ok) {
    return { status: 'unavailable', reason: facetsResult.reason, code: facetsResult.code };
  }

  const knownExits = facetsResult.data.exitsByInterstate[interstate.designation] ?? [];
  const exit = exitFromSlug(params.exit, knownExits);
  // The facet read SUCCEEDED and this exit is not in it: genuinely no such exit.
  if (!exit) return { status: 'not-found' };
  return { status: 'ok', interstate, exit };
}

export async function generateMetadata({
  params,
}: {
  params: { category: string; exit: string };
}): Promise<Metadata> {
  const resolved = await resolveExit(params);
  // Metadata never throws and never decides the response status — the page
  // component below is what distinguishes 404 from 500.
  if (resolved.status !== 'ok') return {};
  const { interstate, exit } = resolved;
  const entriesResult = await cachedEntriesByExitResult(interstate.designation, exit);
  const entries = entriesResult.ok ? entriesResult.data : [];
  const places = [...new Set(entries.map((e) => `${e.city}, ${e.state}`))];
  return buildMetadata({
    title: `${interstate.designation} Exit ${exit} — Truck Stops, Parking & Services | Trucking Life with Shawn`,
    description:
      entries.length > 0
        ? `${entries.length} verified driver service${entries.length === 1 ? '' : 's'} at ` +
          `${interstate.designation} Exit ${exit} (${places.join('; ')}): truck stops, parking, ` +
          'CAT scales, washes, tires, and hotels — checked by a 17-year driver.'
        : `What's at ${interstate.designation} Exit ${exit} for drivers: verified truck stops, ` +
          'truck parking, CAT scales, truck washes, tire repair, and hotels with truck parking.',
    path: `/directory/${interstate.slug}/${params.exit.toLowerCase()}`,
  });
}

export default async function ExitPage({ params }: { params: { category: string; exit: string } }) {
  const route = `/directory/${params.category}/${params.exit}`;
  const resolved = await resolveExit(params);
  // A failed facet read is NOT "no such exit". Surface it as a server error —
  // which is transient and never cached as a truth — instead of a 404 that
  // outlives the outage that caused it.
  if (resolved.status === 'unavailable') {
    throwDirectoryUnavailable('exit_page.facets', route, resolved);
  }
  if (resolved.status === 'not-found') notFound();
  const { interstate, exit } = resolved;

  const [entriesResult, corridorResult, facetsResult] = await Promise.all([
    cachedEntriesByExitResult(interstate.designation, exit),
    cachedEntriesByInterstateResult(interstate.designation),
    cachedDirectoryFacetsResult(),
  ]);
  // All three feed the rendered page (listings, nearby exits, related links),
  // and all three hit the same database in the same request. If any failed we
  // cannot render this page faithfully, so fail loudly rather than publish a
  // page that silently omits sections — and never fabricate a 404 from it.
  const entries = unwrapDirectoryRead(entriesResult, 'exit_page.entries', route);
  const corridorEntries = unwrapDirectoryRead(corridorResult, 'exit_page.corridor', route);
  const facets = unwrapDirectoryRead(facetsResult, 'exit_page.facets', route);

  // The reads SUCCEEDED and returned nothing: an exit page only exists while
  // it has published listings, so this is a legitimate 404.
  if (entries.length === 0) notFound();

  const places = [...new Set(entries.map((e) => `${e.city}, ${e.state}`))];
  const statesAtExit = [...new Set(entries.map((e) => e.state))];
  const scopeLabel = `${interstate.designation} Exit ${exit}`;
  const faqs = buildFaqs(entries, { kind: 'exit', label: scopeLabel });
  const nearby = entriesNearExit(corridorEntries, exit, statesAtExit);
  const allExits = facets.exitsByInterstate[interstate.designation] ?? [];
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
          ...(faqSchema(faqs) ? [faqSchema(faqs)!] : []),
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
        title={`${interstate.designation} Exit ${exit}, truck stop to scale`}
        intro={`${entries.length} verified location${entries.length === 1 ? '' : 's'} serving ${
          interstate.designation
        } Exit ${exit} — ${places.join(' · ')}.`}
      />
      <Section>
        <MultiCategoryBrowser
          entries={entries.map(toCardEntry)}
          scopeLabel={`${interstate.designation} Exit ${exit}`}
          groupBy="state"
          stateOrder={interstate.stateOrder}
        />
        <NearbySections
          entries={nearby}
          scopeLabel={scopeLabel}
          excludeIds={new Set(entries.map((e) => e.id))}
        />
        <FaqSection faqs={faqs} heading={`Exit ${exit} driver FAQ`} />
        <RelatedLinks
          groups={exitScopeLinks(
            interstate.designation,
            interstate.slug,
            exit,
            allExits,
            statesAtExit,
            facets,
          )}
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
