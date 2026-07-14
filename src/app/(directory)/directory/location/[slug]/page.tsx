import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { cache } from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import { Section } from '@/components/ui';
import { DirectoryHero, DetailNearbySections, SponsorSlot, ViewBeacon } from '@/components/directory';
import { MapPreview } from '@/components/map/MapPreview';
import { ReviewList, Stars } from '@/components/community/ReviewList';
import { getCategory, categoryHref } from '@/lib/directory/categories';
import {
  getEntryByDetailSlug,
  getPublishedDetailSlugs,
  getEntriesByState,
  getEntriesByInterstate,
} from '@/lib/directory/data';
import {
  nearbySections,
  isDetailIndexable,
  detailTitle,
  detailDescription,
  detailDirectionsUrl,
} from '@/lib/directory/detail';
import { isValidDetailSlug, detailHref } from '@/lib/directory/detail-slug';
import { resolveSlugRedirect } from '@/lib/directory/redirects';
import { interstateSlug, exitSlug } from '@/lib/directory/interstates';
import { stateByCode } from '@/lib/directory/states';
import {
  getApprovedReviewsForLocation,
  getReviewStatsForLocation,
} from '@/lib/community/data';
import { listingDetailSchema } from '@/lib/directory/seo';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import type { DirectoryEntry } from '@/lib/directory/types';

/**
 * Per-listing detail page (Milestone 20): /directory/location/[slug].
 * Resolution goes through the anon client with published/non-deleted filters
 * (RLS enforces the same boundary), so unpublished, soft-deleted, and unknown
 * slugs all 404. Slugs are the only public identifier — internal ids never
 * appear in URLs.
 */

// dynamicParams stays TRUE (see [category]/page.tsx): Netlify's runtime
// refuses to re-render locked paths after revalidatePath() purges. Unknown
// slugs still 404 via the resolver below.
export const revalidate = 300;

const getEntry = cache((slug: string) => getEntryByDetailSlug(slug));

/** Cap the reviews rendered on the page; the count still shows the total. */
const REVIEWS_SHOWN = 10;

export async function generateStaticParams() {
  const refs = await getPublishedDetailSlugs();
  return refs.map((r) => ({ slug: r.detailSlug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  if (!isValidDetailSlug(params.slug)) return {};
  const entry = await getEntry(params.slug);
  if (!entry) return {};
  return buildMetadata({
    title: detailTitle(entry),
    description: detailDescription(entry),
    path: detailHref(params.slug),
    noindex: !isDetailIndexable(entry),
  });
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return '';
  }
}

/** The most specific existing page that covers this listing's exit. */
function exitPageHref(entry: DirectoryEntry): string | null {
  if (!entry.interstate || !entry.exitNumber) return null;
  const slug = interstateSlug(entry.interstate);
  return slug ? `/directory/${slug}/${exitSlug(entry.exitNumber)}` : null;
}

const actionClasses =
  'inline-flex items-center justify-center rounded-card border border-line px-5 py-2.5 ' +
  'font-display text-base uppercase tracking-wide text-ink transition-colors hover:border-signal hover:text-signal';

export default async function ListingDetailPage({ params }: { params: { slug: string } }) {
  if (!isValidDetailSlug(params.slug)) notFound();
  const entry = await getEntry(params.slug);
  if (!entry) {
    // A retired slug 301s to the CURRENT canonical slug (Milestone 21); the
    // lookup fails soft when the redirect table isn't provisioned, so unknown
    // slugs still 404 and unpublished/deleted destinations never redirect.
    const redirect = await resolveSlugRedirect(params.slug);
    if (redirect) permanentRedirect(detailHref(redirect.currentSlug));
    notFound();
  }

  const category = getCategory(entry.category);
  const path = detailHref(params.slug);
  const hasCoords = entry.lat != null && entry.lng != null;
  const directions = detailDirectionsUrl(entry);
  const exitHref = exitPageHref(entry);
  const state = stateByCode(entry.state);

  const [statePool, corridorPool, reviews, stats] = await Promise.all([
    getEntriesByState(entry.state),
    entry.interstate ? getEntriesByInterstate(entry.interstate) : Promise.resolve([]),
    getApprovedReviewsForLocation(entry.id, REVIEWS_SHOWN),
    getReviewStatsForLocation(entry.id),
  ]);
  const pool = [...statePool, ...corridorPool.filter((c) => !statePool.some((s) => s.id === c.id))];
  const nearby = nearbySections(entry, pool);

  const facts: { label: string; value: ReactNode }[] = [];
  if (category) {
    facts.push({
      label: 'Category',
      value: (
        <Link href={categoryHref(category)} className="text-signal hover:underline">
          {category.icon} {category.title}
        </Link>
      ),
    });
  }
  if (entry.address) facts.push({ label: 'Address', value: entry.address });
  facts.push({
    label: 'City / State',
    value: state ? (
      <>
        {entry.city},{' '}
        <Link href={`/directory/${state.slug}`} className="text-signal hover:underline">
          {state.name}
        </Link>
        {entry.zip ? ` ${entry.zip}` : ''}
      </>
    ) : (
      `${entry.city}, ${entry.state}${entry.zip ? ` ${entry.zip}` : ''}`
    ),
  });
  if (entry.interstate) {
    facts.push({
      label: 'Interstate',
      value: interstateSlug(entry.interstate) ? (
        <Link href={`/directory/${interstateSlug(entry.interstate)}`} className="text-signal hover:underline">
          {entry.interstate}
        </Link>
      ) : (
        entry.interstate
      ),
    });
  }
  if (entry.exitNumber) {
    facts.push({
      label: 'Exit',
      value: exitHref ? (
        <Link href={exitHref} className="text-signal hover:underline">
          Exit {entry.exitNumber}
        </Link>
      ) : (
        `Exit ${entry.exitNumber}`
      ),
    });
  }
  if (entry.phone) {
    facts.push({
      label: 'Phone',
      value: (
        <a href={`tel:${entry.phone}`} className="text-signal hover:underline">
          {entry.phone}
        </a>
      ),
    });
  }
  if (entry.website) {
    facts.push({
      label: 'Website',
      value: (
        <a href={entry.website} target="_blank" rel="noopener noreferrer" className="text-signal hover:underline">
          Visit website ↗
        </a>
      ),
    });
  }
  if (entry.parkingSpaces != null) {
    facts.push({ label: 'Truck spaces', value: `${entry.parkingSpaces}` });
  }
  if (entry.verifiedAt)
    facts.push({ label: 'Information last verified', value: fmtDate(entry.verifiedAt) });
  if (entry.updatedAt) facts.push({ label: 'Last updated', value: fmtDate(entry.updatedAt) });

  const seoReviews = reviews.slice(0, 3).map((r) => ({
    rating: r.rating,
    title: r.title,
    body: r.body,
    reviewerName: r.reviewerName,
    createdAt: r.createdAt,
  }));

  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Directory', path: '/directory' },
            ...(category
              ? [{ name: category.title, path: categoryHref(category) }]
              : []),
            { name: entry.name, path },
          ]),
          listingDetailSchema(entry, path, stats, seoReviews),
        ]}
      />

      <DirectoryHero
        crumbs={[
          { name: 'Home', href: '/' },
          { name: 'Directory', href: '/directory' },
          ...(category
            ? [{ name: category.title, href: categoryHref(category) }]
            : []),
          { name: entry.name },
        ]}
        eyebrow={`Directory · ${category ? category.title : 'Listing'}`}
        title={entry.name}
        intro={
          <>
            {entry.featured && (
              <span className="mr-2 inline-block rounded-card bg-signal px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-asphalt">
                Featured
              </span>
            )}
            {entry.address ? `${entry.address} · ` : ''}
            {entry.city}, {entry.state}
            {entry.interstate ? ` · ${entry.interstate}` : ''}
            {entry.exitNumber ? ` Exit ${entry.exitNumber}` : ''}
          </>
        }
      >
        {directions && (
          <a
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Get directions to ${entry.name} (opens in new tab)`}
            className="inline-flex items-center justify-center rounded-card bg-signal px-5 py-2.5 font-display text-base uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600"
          >
            Get directions →
          </a>
        )}
        <Link
          href={hasCoords ? `/directory/map?listing=${params.slug}` : '/directory/map'}
          className={actionClasses}
        >
          🗺️ View on full map
        </Link>
        {entry.tpcUrl && (
          <a
            href={entry.tpcUrl}
            target="_blank"
            rel="sponsored noopener noreferrer"
            className="inline-flex items-center justify-center rounded-card border border-signal px-5 py-2.5 font-display text-base uppercase tracking-wide text-signal transition-colors hover:bg-signal hover:text-asphalt"
          >
            Reserve a spot →
          </a>
        )}
      </DirectoryHero>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div>
            <h2 className="font-display text-2xl uppercase text-ink">At a glance</h2>
            <dl className="mt-4 grid gap-x-8 gap-y-3 rounded-card border border-line bg-asphalt-800 p-6 sm:grid-cols-2">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {f.label}
                  </dt>
                  <dd className="mt-0.5 text-sm text-ink">{f.value}</dd>
                </div>
              ))}
            </dl>

            {entry.description && (
              <>
                <h2 className="mt-8 font-display text-2xl uppercase text-ink">
                  What drivers should know
                </h2>
                <p className="mt-3 whitespace-pre-line text-sm text-muted">{entry.description}</p>
              </>
            )}

            {entry.amenities && entry.amenities.length > 0 && (
              <>
                <h2 className="mt-8 font-display text-2xl uppercase text-ink">
                  Parking &amp; amenities
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {entry.amenities.map((a) => (
                    <li
                      key={a}
                      className="rounded-card border border-signal/40 bg-signal/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-signal"
                    >
                      {a}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="mt-8 rounded-card border border-line bg-asphalt-800 p-5 text-sm text-muted">
              Something wrong here — moved, closed, new phone number?{' '}
              <Link
                href={`/directory/submit?listing=${params.slug}&kind=correction`}
                className="font-semibold text-signal underline-offset-4 hover:underline"
              >
                Report incorrect information →
              </Link>{' '}
              Every report is reviewed by a human before the directory changes.
            </div>
          </div>

          <div>
            <h2 className="font-display text-2xl uppercase text-ink">Where it sits</h2>
            <div className="mt-4">
              {hasCoords ? (
                <MapPreview lat={entry.lat!} lng={entry.lng!} name={entry.name} />
              ) : (
                <div className="rounded-card border border-line bg-asphalt-800 p-6 text-sm text-muted">
                  <p>
                    Verified map coordinates for this listing are still being confirmed — no
                    guesses, no pin until it&rsquo;s right.
                  </p>
                  {directions && (
                    <p className="mt-3">
                      <a
                        href={directions}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-signal underline-offset-4 hover:underline"
                      >
                        Get directions by address →
                      </a>
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-2xl uppercase text-ink">Driver reviews</h2>
                {stats && (
                  <p className="text-sm text-muted">
                    <Stars rating={Math.round(stats.average)} />{' '}
                    <span className="font-semibold text-ink">{stats.average}</span> ·{' '}
                    {stats.count} review{stats.count === 1 ? '' : 's'}
                  </p>
                )}
              </div>
              <div className="mt-4">
                <ReviewList reviews={reviews} showLocation={false} />
              </div>
              <p className="mt-4 text-sm">
                <Link
                  href={`/directory/reviews?listing=${params.slug}`}
                  className="font-semibold text-signal underline-offset-4 hover:underline"
                >
                  Leave a review of {entry.name} →
                </Link>
              </p>
            </div>
          </div>
        </div>

        <SponsorSlot
          placement="detail"
          state={entry.state}
          interstate={entry.interstate}
          category={entry.category}
          className="mt-10"
        />

        <DetailNearbySections sections={nearby} scopeLabel={entry.name} />

        <ViewBeacon id={entry.id} />

        <p className="mt-10 text-sm text-muted">
          {category && (
            <>
              <Link
                href={categoryHref(category)}
                className="text-signal underline-offset-4 hover:underline"
              >
                All {category.title.toLowerCase()} →
              </Link>{' '}
              ·{' '}
            </>
          )}
          <Link href="/directory/map" className="text-signal underline-offset-4 hover:underline">
            View on map →
          </Link>{' '}
          ·{' '}
          <Link href="/directory" className="text-signal underline-offset-4 hover:underline">
            Browse all directories →
          </Link>{' '}
          ·{' '}
          <Link href="/store" className="text-signal underline-offset-4 hover:underline">
            Gear for the road →
          </Link>
        </p>
      </Section>
    </>
  );
}
