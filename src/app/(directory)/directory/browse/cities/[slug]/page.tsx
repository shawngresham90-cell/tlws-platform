import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Section, Eyebrow } from '@/components/ui';
import { DirectoryBrowser } from '@/components/directory';
import { getAllPublishedEntries } from '@/lib/directory/data';
import { groupByCity } from '@/lib/directory/brands';
import { stateByCode } from '@/lib/directory/states';
import { interstateSlug } from '@/lib/directory/interstates';
import { listingListSchemaWithReviews } from '@/lib/directory/seo';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 300;

async function cityGroup(slug: string) {
  const entries = await getAllPublishedEntries();
  return groupByCity(entries).find((c) => c.slug === slug.toLowerCase()) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const group = await cityGroup(params.slug);
  if (!group) return buildMetadata({ noindex: true });
  const st = stateByCode(group.state);
  return buildMetadata({
    title: `Truck Stops & Services in ${group.city}, ${group.state} | Truck Stop Directory`,
    description: `${group.entries.length} published truck-driver locations in ${group.city}, ${st?.name ?? group.state}: truck stops, parking, CAT scales, washes, tire and repair shops, and hotels with truck parking.`,
    path: `/directory/browse/cities/${group.slug}`,
  });
}

export default async function CityPage({ params }: { params: { slug: string } }) {
  const group = await cityGroup(params.slug);
  if (!group) notFound();
  const st = stateByCode(group.state);
  const interstates = [...new Set(group.entries.map((e) => e.interstate).filter(Boolean))].sort();
  const listings = await listingListSchemaWithReviews(
    group.entries,
    `Truck services in ${group.city}, ${group.state}`,
    `/directory/browse/cities/${group.slug}`,
  );

  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Directory', path: '/directory' },
            { name: 'Browse', path: '/directory/browse' },
            { name: 'Cities', path: '/directory/browse/cities' },
            { name: `${group.city}, ${group.state}`, path: `/directory/browse/cities/${group.slug}` },
          ]),
          ...(listings ? [listings] : []),
        ]}
      />
      <Section className="border-b border-line">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
          <Link href="/directory" className="hover:text-signal">
            Directory
          </Link>{' '}
          <span aria-hidden="true">›</span>{' '}
          <Link href="/directory/browse/cities" className="hover:text-signal">
            Cities
          </Link>{' '}
          <span aria-hidden="true">›</span>{' '}
          <span className="text-ink">
            {group.city}, {group.state}
          </span>
        </nav>
        <div className="max-w-2xl">
          <Eyebrow>Directory · {group.city}</Eyebrow>
          <h1 className="display-section">
            {group.city}, {group.state}
          </h1>
          <p className="mt-4 text-muted">
            {group.entries.length} published location{group.entries.length === 1 ? '' : 's'} in{' '}
            {group.city}
            {st ? `, ${st.name}` : ''}
            {interstates.length > 0 && <> — on {interstates.join(', ')}</>}.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {st && (
              <Link
                href={`/directory/${st.slug}`}
                className="text-signal underline-offset-4 hover:underline"
              >
                All of {st.name} →
              </Link>
            )}
            {interstates.map((hw) => {
              const slug = hw ? interstateSlug(hw) : null;
              return slug ? (
                <Link
                  key={hw}
                  href={`/directory/${slug}`}
                  className="text-signal underline-offset-4 hover:underline"
                >
                  {hw} corridor →
                </Link>
              ) : null;
            })}
          </div>
        </div>
      </Section>
      <Section className="border-b border-line bg-asphalt-800">
        <DirectoryBrowser
          categoryTitle={`Locations in ${group.city}, ${group.state}`}
          entries={group.entries}
        />
      </Section>
    </>
  );
}
