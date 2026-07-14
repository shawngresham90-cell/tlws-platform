import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Section, Eyebrow } from '@/components/ui';
import { AmazonCta } from '@/components/store/AmazonCta';
import { StickyAmazonCta } from '@/components/store/StickyAmazonCta';
import { AmazonDisclosure } from '@/components/store/AmazonDisclosure';
import { ProductImage } from '@/components/store/ProductImage';
import { ProductCard } from '@/components/store/ProductCard';
import { StoreEvents } from '@/components/store/StoreEvents';
import {
  STORE_PRODUCTS,
  priceLabel,
  productReadiness,
  productsInCategory,
  storeProduct,
} from '@/lib/store/products';
import { storeCategory, storeCategoryHref } from '@/lib/store/categories';
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
    title: `${p.name} — Trucking Life Store`,
    description: `${p.tagline} ${p.description}`.slice(0, 155),
    path: `/store/products/${p.slug}`,
    image: p.imageUrl ?? undefined,
  });
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = storeProduct(params.slug);
  if (!product) notFound();
  const cat = storeCategory(product.category);
  const price = priceLabel(product);
  const { live } = productReadiness(product);
  const related = productsInCategory(product.category)
    .filter((p) => p.slug !== product.slug)
    .slice(0, 3);

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
            <h1 className="display-section">{product.name}</h1>
            <p className="mt-4 text-lg text-muted">{product.tagline}</p>
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
                We&apos;re finalizing this pick. Check back soon — the Amazon link goes live once
                it&apos;s confirmed.
              </p>
            )}
            <div className="mt-6">
              <AmazonDisclosure />
            </div>
          </div>
        </div>
      </Section>

      {related.length > 0 && (
        <Section className="border-b border-line bg-asphalt-800">
          <h2 className="display-section">More {cat?.title ?? 'gear'}</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <ProductCard key={p.slug} product={p} headingLevel="h3" />
            ))}
          </div>
        </Section>
      )}

      {/* Reserve room so the mobile sticky bar never covers the last content. */}
      <div aria-hidden="true" className="h-24 sm:hidden" />
    </>
  );
}
