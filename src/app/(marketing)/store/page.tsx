import Link from 'next/link';
import { Section, Eyebrow } from '@/components/ui';
import { DirectStoreBrowser } from '@/components/store/DirectStoreBrowser';
import { StoreBrowser } from '@/components/store/StoreBrowser';
import { AmazonDisclosure } from '@/components/store/AmazonDisclosure';
import { StoreEvents } from '@/components/store/StoreEvents';
import { STORE_PRODUCTS } from '@/lib/store/products';
import { DIRECT_PRODUCTS, directCategories } from '@/lib/store/direct';
import { STORE_CATEGORIES, storeCategoryHref } from '@/lib/store/categories';
import { STORE_GUIDES, guideHref } from '@/lib/store/product-types';
import { STORE_EVENTS } from '@/lib/store/analytics';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export const metadata = buildMetadata({
  title: 'Trucking Life Store — Guides, Coaching & Gear from Shawn',
  description:
    'Driver guides, CDL protection material, Hours of Service reference, 1:1 coaching, and Founding Member merch from Trucking Life with Shawn. Free guides included.',
  path: '/store',
});

export default function StorePage() {
  // The storefront is Trucking Life's OWN products. The Amazon catalog is
  // preserved but hidden (lib/store/visibility.ts), so its sections render only
  // if that flag is turned back on — this page works either way and never
  // depends on Amazon being present.
  const amazonProducts = STORE_PRODUCTS;
  const hasAmazon = amazonProducts.length > 0;

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
        <Eyebrow>Trucking Life Store</Eyebrow>
        <h1 className="display-hero max-w-3xl">
          Guides, coaching, and gear from the driver&apos;s seat
          <span className="text-signal">.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          Written by a 17-year driver with a clean record — DOT inspection material, CDL protection,
          Hours of Service reference, and 1:1 coaching. Several guides are free. Checkout and
          delivery happen on Shawn&apos;s Stan page.
        </p>
      </Section>

      <Section className="border-b border-line">
        <h2 className="display-section">Everything in the store</h2>
        <p className="mt-3 max-w-2xl text-muted">
          Search or filter by category. Free guides download straight away; paid products open their
          Stan checkout page.
        </p>
        <div className="mt-8">
          <DirectStoreBrowser products={DIRECT_PRODUCTS} categories={directCategories()} />
        </div>
      </Section>

      {/* Amazon gear — renders only while the affiliate catalog is visible. */}
      {hasAmazon && (
        <>
          <Section className="border-b border-line bg-asphalt-800">
            <Eyebrow>Buying guides</Eyebrow>
            <h2 className="display-section">Best-of guides, no fake five-star roundups</h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {STORE_GUIDES.map((g) => (
                <Link
                  key={g.slug}
                  href={guideHref(g.slug)}
                  className="flex items-center justify-between gap-3 rounded-card border border-line bg-asphalt px-4 py-3 transition-colors hover:border-signal"
                >
                  <span className="font-display text-sm uppercase text-ink">{g.title}</span>
                  <span aria-hidden="true" className="text-signal">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </Section>

          <Section className="border-b border-line">
            <h2 className="display-section">Shop gear by category</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {STORE_CATEGORIES.map((c) => (
                <Link
                  key={c.slug}
                  href={storeCategoryHref(c.slug)}
                  className="flex flex-col rounded-card border border-line bg-asphalt-800 p-5 transition-colors hover:border-signal"
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

          <Section className="border-b border-line">
            <h2 className="display-section">Gear picks</h2>
            <div className="mt-6">
              <AmazonDisclosure />
            </div>
            <div className="mt-8">
              <StoreBrowser products={amazonProducts} />
            </div>
          </Section>
        </>
      )}
    </>
  );
}
