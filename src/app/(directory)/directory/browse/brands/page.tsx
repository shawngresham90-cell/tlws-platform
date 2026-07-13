import Link from 'next/link';
import { Section, Eyebrow } from '@/components/ui';
import { getAllPublishedEntries } from '@/lib/directory/data';
import { groupByBrand } from '@/lib/directory/brands';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 300;

export const metadata = buildMetadata({
  title: 'Truck Stop Brands — Pilot, Love’s, TA, Flying J & More | Truck Stop Directory',
  description:
    'Browse every chain in the directory — Pilot, Love’s, Flying J, TA/Petro, ONE9, Speedco, CAT Scale, Blue Beacon and more — with live location counts.',
  path: '/directory/browse/brands',
});

export default async function BrandsIndexPage() {
  const entries = await getAllPublishedEntries();
  const brands = groupByBrand(entries);

  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Directory', path: '/directory' },
          { name: 'Browse', path: '/directory/browse' },
          { name: 'Brands', path: '/directory/browse/brands' },
        ])}
      />
      <Section className="border-b border-line">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
          <Link href="/directory" className="hover:text-signal">
            Directory
          </Link>{' '}
          <span aria-hidden="true">›</span>{' '}
          <Link href="/directory/browse" className="hover:text-signal">
            Browse
          </Link>{' '}
          <span aria-hidden="true">›</span> <span className="text-ink">Brands</span>
        </nav>
        <div className="max-w-2xl">
          <Eyebrow>Directory · Brands</Eyebrow>
          <h1 className="display-section">Browse by brand</h1>
          <p className="mt-4 text-muted">
            Every chain with published locations in the directory. Brands are read straight off
            listing names — independents live under their own names in each category.
          </p>
        </div>
      </Section>
      <Section className="border-b border-line bg-asphalt-800">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map(({ brand, entries: es }) => {
            const states = [...new Set(es.map((e) => e.state))].sort();
            return (
              <Link
                key={brand.slug}
                href={`/directory/browse/brands/${brand.slug}`}
                className="flex flex-col rounded-card border border-line bg-asphalt p-6 transition-colors hover:border-signal"
              >
                <h2 className="font-display text-xl uppercase text-signal">{brand.name}</h2>
                <p className="mt-2 text-sm text-muted">
                  {es.length} location{es.length === 1 ? '' : 's'} · {states.join(', ')}
                </p>
              </Link>
            );
          })}
        </div>
      </Section>
    </>
  );
}
