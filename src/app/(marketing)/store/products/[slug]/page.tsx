import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Section, Eyebrow } from '@/components/ui';
import { AmazonCta } from '@/components/store/AmazonCta';
import { StickyAmazonCta } from '@/components/store/StickyAmazonCta';
import { AmazonDisclosure } from '@/components/store/AmazonDisclosure';
import { ProductImage } from '@/components/store/ProductImage';
import { ProductRail } from '@/components/store/ProductRail';
import { StoreEvents } from '@/components/store/StoreEvents';
import {
  STORE_PRODUCTS,
  priceLabel,
  ratingLabel,
  productReadiness,
  storeProduct,
  displayName,
} from '@/lib/store/products';
import { relatedProducts, frequentlyBoughtTogether } from '@/lib/store/related';
import { storeCategory, storeCategoryHref } from '@/lib/store/categories';
import { STORE_GUIDES, guideHref, productTypeMeta } from '@/lib/store/product-types';
import { STORE_EVENTS } from '@/lib/store/analytics';
import { productSchema } from '@/lib/store/schema';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export function generateStaticParams() {
  return STORE_PRODUCTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const p = storeProduct(params.slug);
  if (!p) return buildMetadata({ noindex: true });
  return buildMetadata({
    title: `${displayName(p)} — Trucking Life Store`,
    description: `${p.tagline} ${p.description}`.slice(0, 155),
    path: `/store/products/${p.slug}`,
    image: p.imageUrl ?? undefined,
  });
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = storeProduct(params.slug);
  if (!product) notFound();
  const cat = storeCategory(product.category);
  const typeMeta = productTypeMeta(product.productType);
  const guide = STORE_GUIDES.find((g) => g.productType === product.productType);
  const price = priceLabel(product);
  const rating = ratingLabel(product);
  const { live } = productReadiness(product);
  const related = relatedProducts(product, 3);
  const fbt = frequentlyBoughtTogether(product, 3);

  return (
    <>
      <StoreEvents event={STORE_EVENTS.productView} props={{ product: product.slug }} />
      <StickyAmazonCta product={product} />
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Store', path: '/store' },
            ...(cat ? [{ name: cat.title, path: storeCategoryHref(product.category) }] : []),
            { name: product.name, path: `/store/products/${product.slug}` },
          ]),
          productSchema(product),
        ]}
      />

      <Section className="border-b border-line">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
          <Link href="/store" className="hover:text-signal">
            Store
          </Link>{' '}
          {cat && (
            <>
              <span aria-hidden="true">›</span>{' '}
              <Link href={storeCategoryHref(product.category)} className="hover:text-signal">
                {cat.title}
              </Link>{' '}
            </>
          )}
          <span aria-hidden="true">›</span> <span className="text-ink">{product.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2">
          <ProductImage product={product} className="max-w-md" />
          <div>
            {cat && <Eyebrow>{cat.title}</Eyebrow>}
            <h1 className="display-section">{displayName(product)}</h1>
            <p className="mt-4 text-lg text-muted">{product.tagline}</p>
            {rating && (
              <p className="mt-3 text-sm text-muted">
                <span aria-hidden="true" className="text-signal">
                  ★
                </span>{' '}
                {rating} verified on Amazon
              </p>
            )}
            <p className="mt-4 text-muted">{product.description}</p>

            <ul className="mt-6 space-y-2">
              {product.benefits.map((b) => (
                <li key={b} className="flex items-start gap-3 text-ink">
                  <span aria-hidden="true" className="mt-0.5 text-signal">
                    ✓
                  </span>
                  {b}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              {price ? (
                <span className="font-display text-2xl text-ink">{price}</span>
              ) : (
                <span className="text-sm text-muted">Price shown on Amazon</span>
              )}
              <AmazonCta product={product} placement="detail" />
            </div>
            {!live && (
              <p className="mt-3 text-sm text-muted">
                We&apos;re finalizing this pick. The Amazon link goes live once the product is
                confirmed — until then, no active link.
              </p>
            )}
            <div className="mt-6">
              <AmazonDisclosure />
            </div>
          </div>
        </div>
      </Section>

      {/* Pros / cons — honest, type-level, not tied to any unverified listing. */}
      <Section className="border-b border-line bg-asphalt-800">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-card border border-line bg-asphalt p-6">
            <h2 className="font-display text-lg uppercase text-ink">What we like</h2>
            <ul className="mt-4 space-y-2">
              {product.pros.map((p) => (
                <li key={p} className="flex items-start gap-3 text-ink">
                  <span aria-hidden="true" className="mt-0.5 text-signal">
                    +
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-card border border-line bg-asphalt p-6">
            <h2 className="font-display text-lg uppercase text-ink">Worth weighing</h2>
            <ul className="mt-4 space-y-2">
              {product.cons.map((c) => (
                <li key={c} className="flex items-start gap-3 text-muted">
                  <span aria-hidden="true" className="mt-0.5 text-diesel-300">
                    –
                  </span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 rounded-card border border-signal/40 bg-asphalt p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-signal">
            Shawn&apos;s take
          </p>
          <p className="mt-2 text-ink">{product.recommendation}</p>
        </div>

        {guide && (
          <p className="mt-6 text-sm text-muted">
            Comparing options?{' '}
            <Link
              href={guideHref(guide.slug)}
              className="font-semibold text-signal hover:underline"
            >
              {guide.title}
            </Link>{' '}
            puts the {typeMeta.label.toLowerCase()} side by side.
          </p>
        )}
      </Section>

      {fbt.length > 0 && (
        <Section className="border-b border-line">
          <ProductRail
            headingId="fbt"
            title="Frequently Bought Together"
            caption="Shawn's suggested pairings for a complete setup — not Amazon purchase data."
            products={fbt}
          />
        </Section>
      )}

      {related.length > 0 && (
        <Section className="border-b border-line bg-asphalt-800">
          <ProductRail
            headingId="related"
            title={`More ${typeMeta.label.toLowerCase()}`}
            products={related}
          />
        </Section>
      )}

      <Section>
        <div className="flex flex-wrap gap-4 text-sm">
          {cat && (
            <Link
              href={storeCategoryHref(product.category)}
              className="text-signal underline-offset-4 hover:underline"
            >
              All {cat.title.toLowerCase()} →
            </Link>
          )}
          <Link
            href="/store/shawns-picks"
            className="text-signal underline-offset-4 hover:underline"
          >
            Shawn&apos;s Picks →
          </Link>
          <Link href="/store" className="text-signal underline-offset-4 hover:underline">
            Back to the store →
          </Link>
        </div>
      </Section>

      {/* Reserve room so the mobile sticky bar never covers the last content. */}
      <div aria-hidden="true" className="h-24 sm:hidden" />
    </>
  );
}
