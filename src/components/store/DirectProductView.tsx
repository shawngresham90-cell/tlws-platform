import Image from 'next/image';
import Link from 'next/link';
import { Section, Eyebrow } from '@/components/ui';
import { DirectCta } from './DirectCta';
import { DirectProductCard } from './DirectProductCard';
import { StoreEvents } from './StoreEvents';
import {
  DIRECT_PRODUCTS,
  SHIPPING_RETURNS_HREF,
  ctaState,
  directPriceLabel,
  fulfillmentLabel,
  shirtStockLabel,
  type DirectProduct,
} from '@/lib/store/direct';
import { STORE_EVENTS } from '@/lib/store/analytics';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';

/**
 * Detail page for a direct (Stan) product.
 *
 * Kept separate from the Amazon product view because almost nothing carries
 * over: there is no ASIN, no star rating, no review count, no "frequently
 * bought together", and no affiliate disclosure — those belong to the
 * affiliate catalog and would be meaningless or misleading here.
 *
 * No Product JSON-LD is emitted. Structured data for a product wants an
 * `offers` block, and most of these have no confirmed price; publishing a
 * Product node without one, or with an invented one, is exactly the phantom-
 * offer problem the Amazon schema builder already refuses to create. Breadcrumb
 * markup is safe and is emitted.
 */
export function DirectProductView({ product }: { product: DirectProduct }) {
  const price = directPriceLabel(product);
  const cta = ctaState(product);
  const alsoInCategory = DIRECT_PRODUCTS.filter(
    (p) => p.category === product.category && p.slug !== product.slug,
  ).slice(0, 3);

  return (
    <>
      <StoreEvents event={STORE_EVENTS.productView} props={{ product: product.slug }} />
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Store', path: '/store' },
          { name: product.name, path: `/store/products/${product.slug}` },
        ])}
      />

      <Section className="border-b border-line">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
          <Link href="/" className="hover:text-signal">
            Home
          </Link>{' '}
          <span aria-hidden="true">›</span>{' '}
          <Link href="/store" className="hover:text-signal">
            Store
          </Link>{' '}
          <span aria-hidden="true">›</span> <span className="text-ink">{product.name}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2">
          <div className="relative aspect-square w-full overflow-hidden rounded-card border border-line bg-asphalt-800">
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(min-width: 1024px) 480px, 90vw"
              className="object-cover"
              priority
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              {product.badge && (
                <span className="rounded-card border border-line px-2 py-0.5 text-xs uppercase tracking-wide text-signal">
                  {product.badge}
                </span>
              )}
              <Eyebrow>{product.category}</Eyebrow>
            </div>

            <h1 className="mt-3 font-display text-3xl uppercase leading-tight text-ink sm:text-4xl">
              {product.name}
            </h1>
            <p className="mt-4 text-lg text-muted">{product.tagline}</p>
            <p className="mt-4 text-muted">{product.description}</p>

            <p className="mt-6 text-sm text-muted">{fulfillmentLabel(product.fulfillment)}</p>

            {product.slug === 'founding-member-shirt' && (
              <p className="mt-2 text-sm text-signal">{shirtStockLabel()}</p>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-4">
              {price ? (
                <span className="font-display text-3xl uppercase text-ink">{price}</span>
              ) : (
                <span className="text-muted">Price coming soon</span>
              )}
              <DirectCta product={product} placement="detail" />
            </div>

            {cta.kind === 'details' && (
              // Say why it cannot be bought yet rather than showing a dead
              // button with no explanation.
              <p className="mt-4 rounded-card border border-line bg-asphalt-800 p-4 text-sm text-muted">
                {cta.reason}
              </p>
            )}

            <p className="mt-6 text-sm text-muted">
              Sold and delivered through Shawn&apos;s Stan page. Trucking Life does not process
              payments on this site.
            </p>

            {/* Physical products carry owner-confirmed shipping and return terms.
                Digital and coaching products are not shipped, so the link would
                point at policy that does not apply to them. */}
            {product.fulfillment === 'physical' && (
              <p className="mt-3 text-sm text-muted">
                <Link href={SHIPPING_RETURNS_HREF} className="text-signal hover:underline">
                  Shipping &amp; returns
                </Link>{' '}
                — dispatch timing, damaged or incorrect orders, returns, and size exchanges.
              </p>
            )}
          </div>
        </div>
      </Section>

      {alsoInCategory.length > 0 && (
        <Section className="border-b border-line bg-asphalt-800">
          <h2 className="display-section">More in {product.category}</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {alsoInCategory.map((p) => (
              <DirectProductCard key={p.slug} product={p} />
            ))}
          </div>
        </Section>
      )}

      <Section>
        <Link href="/store" className="text-signal hover:underline">
          ← Back to the store
        </Link>
      </Section>
    </>
  );
}
