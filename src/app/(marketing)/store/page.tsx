import Link from 'next/link';
import { Section, Eyebrow } from '@/components/ui';
import { StoreBrowser } from '@/components/store/StoreBrowser';
import { AmazonDisclosure } from '@/components/store/AmazonDisclosure';
import { StoreEvents } from '@/components/store/StoreEvents';
import { STORE_PRODUCTS } from '@/lib/store/products';
import { STORE_CATEGORIES, storeCategoryHref } from '@/lib/store/categories';
import { STORE_GUIDES, guideHref } from '@/lib/store/product-types';
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
          No sponsored fluff — 100+ picks of gear a 17-year driver actually reaches for, with an
          honest reason for each. Every buy link goes to Amazon.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/store/shawns-picks"
            className="rounded-card bg-signal px-5 py-2.5 font-display text-sm uppercase text-asphalt transition-colors hover:bg-signal-600"
          >
            Shawn&apos;s Picks
          </Link>
          <Link
            href="/store/guides"
            className="rounded-card border border-line px-5 py-2.5 font-display text-sm uppercase text-ink transition-colors hover:border-signal"
          >
            Buying guides
          </Link>
        </div>
        <div className="mt-6">
          <AmazonDisclosure />
        </div>
      </Section>

      {/* Buying guides */}
      <Section className="border-b border-line">
        <Eyebrow>Buying guides</Eyebrow>
        <h2 className="display-section">Best-of guides, no fake five-star roundups</h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STORE_GUIDES.map((g) => (
            <Link
              key={g.slug}
              href={guideHref(g.slug)}
              className="flex items-center justify-between gap-3 rounded-card border border-line bg-asphalt-800 px-4 py-3 transition-colors hover:border-signal"
            >
              <span className="font-display text-sm uppercase text-ink">{g.title}</span>
              <span aria-hidden="true" className="text-signal">
                →
              </span>
            </Link>
          ))}
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
