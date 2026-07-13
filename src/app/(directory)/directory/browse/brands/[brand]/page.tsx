import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Section, Eyebrow } from '@/components/ui';
import { DirectoryBrowser } from '@/components/directory';
import { getAllPublishedEntries } from '@/lib/directory/data';
import { brandBySlug, brandOf, DIRECTORY_BRANDS } from '@/lib/directory/brands';
import { listingListSchemaWithReviews } from '@/lib/directory/seo';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 300;

export function generateStaticParams() {
  return DIRECTORY_BRANDS.map((b) => ({ brand: b.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { brand: string };
}): Promise<Metadata> {
  const brand = brandBySlug(params.brand);
  if (!brand) return buildMetadata({ noindex: true });
  return buildMetadata({
    title: `${brand.name} Locations — Truck Stop Directory`,
    description: `Every published ${brand.name} location in the directory: cities, exits, amenities, and driver-relevant details, searchable by state and interstate.`,
    path: `/directory/browse/brands/${brand.slug}`,
  });
}

export default async function BrandPage({ params }: { params: { brand: string } }) {
  const brand = brandBySlug(params.brand);
  if (!brand) notFound();
  const all = await getAllPublishedEntries();
  const entries = all.filter((e) => brandOf(e)?.slug === brand.slug);
  if (entries.length === 0) notFound();
  const states = [...new Set(entries.map((e) => e.state))].sort();
  const listings = await listingListSchemaWithReviews(
    entries,
    `${brand.name} locations`,
    `/directory/browse/brands/${brand.slug}`,
  );

  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Directory', path: '/directory' },
            { name: 'Browse', path: '/directory/browse' },
            { name: 'Brands', path: '/directory/browse/brands' },
            { name: brand.name, path: `/directory/browse/brands/${brand.slug}` },
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
          <Link href="/directory/browse/brands" className="hover:text-signal">
            Brands
          </Link>{' '}
          <span aria-hidden="true">›</span> <span className="text-ink">{brand.name}</span>
        </nav>
        <div className="max-w-2xl">
          <Eyebrow>Directory · {brand.name}</Eyebrow>
          <h1 className="display-section">{brand.name} locations</h1>
          <p className="mt-4 text-muted">
            {entries.length} published {brand.name} location{entries.length === 1 ? '' : 's'}{' '}
            across {states.join(', ')} — search by city, exit, or interstate.
          </p>
        </div>
      </Section>
      <Section className="border-b border-line bg-asphalt-800">
        <DirectoryBrowser categoryTitle={`${brand.name} locations`} entries={entries} cardHeadingLevel="h2" />
      </Section>
    </>
  );
}
