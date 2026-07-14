import Link from 'next/link';
import { Section, Eyebrow } from '@/components/ui';
import { StoreBrowser } from '@/components/store/StoreBrowser';
import { AmazonDisclosure } from '@/components/store/AmazonDisclosure';
import { StoreEvents } from '@/components/store/StoreEvents';
import { STORE_PRODUCTS } from '@/lib/store/products';
import { STORE_CATEGORIES, storeCategoryHref } from '@/lib/store/categories';
import { STORE_EVENTS } from '@/lib/store/analytics';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export const metadata = buildMetadata({
  title: 'Trucking Life Store — Gear a 17-Year Driver Actually Recommends',
  description:
    'Dash cams, 12V fridges, bunk upgrades, and road-tested trucker gear, hand-picked by Trucking Life. Curated Amazon recommendations for drivers who want gear that holds up.',
  path: '/store',
});

export default function StorePage() {
  return (
    <>
      <StoreEvents event={STORE_EVENTS.storeView} />
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Store', path: '/store' },
        ])}
      />

      <Section className="border-b border-line">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
          <Link href="/" className="hover:text-signal">
            Home
          </Link>{' '}
          <span aria-hidden="true">›</span> <span className="text-ink">Store</span>
        </nav>
        <Eyebrow>Trucking Life Store · Curated gear</Eyebrow>
        <h1 className="display-hero max-w-3xl">
          Gear that earns its spot in the cab<span className="text-signal">.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          No sponsored fluff — just the categories of gear a 17-year driver actually reaches for,
          with an honest reason for each pick. Every buy link goes to Amazon.
        </p>
        <div className="mt-6">
          <AmazonDisclosure />
        </div>
      </Section>

      {/* Categories */}
      <Section className="border-b border-line bg-asphalt-800">
        <h2 className="display-section">Shop by category</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STORE_CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={storeCategoryHref(c.slug)}
              className="flex flex-col rounded-card border border-line bg-asphalt p-5 transition-colors hover:border-signal"
            >
              <span aria-hidden="true" className="text-3xl">
                {c.icon}
              </span>
              <span className="mt-3 font-display text-lg uppercase text-ink">{c.title}</span>
              <span className="mt-1 text-sm text-muted">{c.blurb}</span>
            </Link>
          ))}
        </div>
      </Section>

      {/* All products with search/filter/sort */}
      <Section className="border-b border-line">
        <h2 className="display-section">All the picks</h2>
        <p className="mt-3 max-w-2xl text-muted">
          Search, filter, and sort. Product links go live as each pick is confirmed on Amazon.
        </p>
        <div className="mt-8">
          <StoreBrowser products={STORE_PRODUCTS} />
        </div>
      </Section>

      <Section className="bg-asphalt-800">
        <div className="mx-auto max-w-2xl text-center">
          <AmazonDisclosure />
          <p className="mt-4 text-sm text-muted">
            Prices and availability are shown on Amazon and can change. Trucking Life earns a small
            commission on qualifying purchases at no extra cost to you.
          </p>
        </div>
      </Section>
    </>
  );
}
