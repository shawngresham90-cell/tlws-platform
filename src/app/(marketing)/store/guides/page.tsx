import Link from 'next/link';
import type { Metadata } from 'next';
import { Section, Eyebrow } from '@/components/ui';
import { AmazonDisclosure } from '@/components/store/AmazonDisclosure';
import { STORE_GUIDES, guideHref, productTypeMeta } from '@/lib/store/product-types';
import { productsOfType } from '@/lib/store/products';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import { SITE } from '@/lib/seo/site';

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: 'Trucker Buying Guides — Best Dash Cams, GPS, Fridges & More',
  description:
    'Honest, driver-first buying guides: the best dash cams, Bluetooth headsets, truck GPS, trucking fridges, seat cushions, flashlights, power inverters, CB radios, and DOT gear.',
  path: '/store/guides',
});

export default function GuidesIndexPage() {
  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Store', path: '/store' },
            { name: 'Buying Guides', path: '/store/guides' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Trucker Buying Guides',
            itemListElement: STORE_GUIDES.map((g, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: g.title,
              url: `${SITE.url}${guideHref(g.slug)}`,
            })),
          },
        ]}
      />

      <Section className="border-b border-line">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
          <Link href="/store" className="hover:text-signal">
            Store
          </Link>{' '}
          <span aria-hidden="true">›</span> <span className="text-ink">Buying Guides</span>
        </nav>
        <Eyebrow>Buying guides</Eyebrow>
        <h1 className="display-hero max-w-3xl">Straight talk on the gear that matters</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          No fluff, no fake five-star roundups — just how a driver sorts the field and what to weigh
          before you spend. Pick a guide and get to the point.
        </p>
        <div className="mt-6">
          <AmazonDisclosure />
        </div>
      </Section>

      <Section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STORE_GUIDES.map((g) => {
            const meta = productTypeMeta(g.productType);
            const count = productsOfType(g.productType).length;
            return (
              <Link
                key={g.slug}
                href={guideHref(g.slug)}
                className="flex flex-col rounded-card border border-line bg-asphalt-800 p-6 transition-colors hover:border-signal"
              >
                <span aria-hidden="true" className="text-3xl">
                  {meta.blurb ? '🧭' : '🧭'}
                </span>
                <h2 className="mt-3 font-display text-xl uppercase text-ink">{g.title}</h2>
                <p className="mt-2 flex-1 text-sm text-muted">{meta.blurb}</p>
                <span className="mt-4 text-sm font-semibold text-signal">
                  {count} picks compared →
                </span>
              </Link>
            );
          })}
        </div>
      </Section>
    </>
  );
}
