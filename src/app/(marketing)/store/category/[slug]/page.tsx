import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Section, Eyebrow } from '@/components/ui';
import { StoreBrowser } from '@/components/store/StoreBrowser';
import { AmazonDisclosure } from '@/components/store/AmazonDisclosure';
import { StoreEvents } from '@/components/store/StoreEvents';
import { STORE_CATEGORIES, storeCategory, storeCategoryHref } from '@/lib/store/categories';
import { productsInCategory } from '@/lib/store/products';
import { STORE_EVENTS } from '@/lib/store/analytics';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export function generateStaticParams() {
  return STORE_CATEGORIES.map((c) => ({ slug: c.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const cat = storeCategory(params.slug);
  if (!cat) return buildMetadata({ noindex: true });
  return buildMetadata({
    title: `${cat.title} — Trucking Life Store`,
    description: `${cat.blurb} Hand-picked ${cat.title.toLowerCase()} recommendations for truck drivers, curated by Trucking Life.`,
    path: storeCategoryHref(cat.slug),
  });
}

export default function CategoryPage({ params }: { params: { slug: string } }) {
  const cat = storeCategory(params.slug);
  if (!cat) notFound();
  const products = productsInCategory(cat.slug);

  return (
    <>
      <StoreEvents event={STORE_EVENTS.categoryView} props={{ category: cat.slug }} />
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Store', path: '/store' },
          { name: cat.title, path: storeCategoryHref(cat.slug) },
        ])}
      />

      <Section className="border-b border-line">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
          <Link href="/store" className="hover:text-signal">
            Store
          </Link>{' '}
          <span aria-hidden="true">›</span> <span className="text-ink">{cat.title}</span>
        </nav>
        <Eyebrow>
          <span aria-hidden="true">{cat.icon}</span> Store category
        </Eyebrow>
        <h1 className="display-hero max-w-3xl">{cat.title}</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">{cat.blurb}</p>
        <div className="mt-6">
          <AmazonDisclosure />
        </div>
      </Section>

      <Section className="border-b border-line bg-asphalt-800">
        {products.length === 0 ? (
          <div className="rounded-card border border-line bg-asphalt p-8 text-center">
            <p className="text-lg text-ink">Picks for this category are on the way.</p>
            <p className="mt-2 text-muted">
              We only list gear we&apos;d actually put in the cab, so this shelf fills in as we
              vet it.
            </p>
            <Link
              href="/store"
              className="mt-6 inline-block text-signal underline-offset-4 hover:underline"
            >
              Browse the full store →
            </Link>
          </div>
        ) : (
          <StoreBrowser products={products} initialCategory={cat.slug} />
        )}
      </Section>

      <Section>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/store" className="text-signal underline-offset-4 hover:underline">
            ← All categories
          </Link>
        </div>
      </Section>
    </>
  );
}
