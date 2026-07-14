import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Section, Eyebrow } from '@/components/ui';
import { AmazonDisclosure } from '@/components/store/AmazonDisclosure';
import { StoreEvents } from '@/components/store/StoreEvents';
import { ComparisonTable } from '@/components/store/ComparisonTable';
import { ProductCard } from '@/components/store/ProductCard';
import { STORE_GUIDES, storeGuide, guideHref, productTypeMeta } from '@/lib/store/product-types';
import { productsOfType } from '@/lib/store/products';
import { storeCategoryHref } from '@/lib/store/categories';
import { STORE_EVENTS } from '@/lib/store/analytics';
import { JsonLd, breadcrumbSchema, faqSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import { SITE } from '@/lib/seo/site';

export const revalidate = 3600;

export function generateStaticParams() {
  return STORE_GUIDES.map((g) => ({ slug: g.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const guide = storeGuide(params.slug);
  if (!guide) return buildMetadata({ noindex: true });
  return buildMetadata({
    title: `${guide.title} (2026) — Trucking Life Store`,
    description: guide.intro.slice(0, 155),
    path: guideHref(guide.slug),
  });
}

/** Featured picks lead the list, then the rest alphabetically — stable + honest. */
function orderedPicks(type: Parameters<typeof productsOfType>[0]) {
  return [...productsOfType(type)].sort((a, b) => {
    if (Boolean(b.featured) !== Boolean(a.featured)) return b.featured ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

export default function GuidePage({ params }: { params: { slug: string } }) {
  const guide = storeGuide(params.slug);
  if (!guide) notFound();
  const meta = productTypeMeta(guide.productType);
  const picks = orderedPicks(guide.productType);

  return (
    <>
      <StoreEvents event={STORE_EVENTS.guideView} props={{ guide: guide.slug }} />
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Store', path: '/store' },
            { name: 'Buying Guides', path: '/store/guides' },
            { name: guide.title, path: guideHref(guide.slug) },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: guide.title,
            description: guide.intro,
            itemListElement: picks.map((p, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: p.name,
              url: `${SITE.url}/store/products/${p.slug}`,
            })),
          },
          ...(faqSchema(guide.faq) ? [faqSchema(guide.faq) as object] : []),
        ]}
      />

      <Section className="border-b border-line">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
          <Link href="/store" className="hover:text-signal">
            Store
          </Link>{' '}
          <span aria-hidden="true">›</span>{' '}
          <Link href="/store/guides" className="hover:text-signal">
            Guides
          </Link>{' '}
          <span aria-hidden="true">›</span> <span className="text-ink">{guide.title}</span>
        </nav>
        <Eyebrow>{guide.eyebrow}</Eyebrow>
        <h1 className="display-hero max-w-3xl">{guide.title}</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">{guide.intro}</p>
        <div className="mt-6">
          <AmazonDisclosure />
        </div>
      </Section>

      <Section className="border-b border-line bg-asphalt-800">
        <Eyebrow>What to weigh</Eyebrow>
        <h2 className="display-section mb-6">Before you buy</h2>
        <ul className="max-w-3xl space-y-3">
          {guide.considerations.map((c) => (
            <li key={c} className="flex items-start gap-3 text-ink">
              <span aria-hidden="true" className="mt-0.5 text-signal">
                ✓
              </span>
              {c}
            </li>
          ))}
        </ul>
      </Section>

      <Section className="border-b border-line">
        <Eyebrow>Compare</Eyebrow>
        <h2 className="display-section mb-6">The picks side by side</h2>
        <ComparisonTable products={picks} />
        <p className="mt-3 text-xs text-muted">
          Ratings and prices show only once verified from the live Amazon listing — never estimated.
        </p>
      </Section>

      <Section className="border-b border-line bg-asphalt-800">
        <Eyebrow>The picks</Eyebrow>
        <h2 className="display-section mb-6">{meta.label} worth a look</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {picks.map((p) => (
            <ProductCard key={p.slug} product={p} headingLevel="h3" />
          ))}
        </div>
      </Section>

      {guide.faq.length > 0 && (
        <Section className="border-b border-line">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="display-section mb-6">Common questions</h2>
          <div className="max-w-3xl space-y-3">
            {guide.faq.map((f) => (
              <details key={f.question} className="group rounded-card border border-line bg-asphalt-800">
                <summary className="cursor-pointer list-none px-5 py-4 font-display text-lg uppercase tracking-wide text-ink transition-colors hover:text-signal [&::-webkit-details-marker]:hidden">
                  <span
                    aria-hidden="true"
                    className="mr-2 inline-block text-signal transition-transform group-open:rotate-90"
                  >
                    ›
                  </span>
                  {f.question}
                </summary>
                <p className="border-t border-line px-5 py-4 text-sm text-muted">{f.answer}</p>
              </details>
            ))}
          </div>
        </Section>
      )}

      <Section>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/store/guides" className="text-signal underline-offset-4 hover:underline">
            ← All buying guides
          </Link>
          <Link
            href={storeCategoryHref(meta.category)}
            className="text-signal underline-offset-4 hover:underline"
          >
            Shop all {meta.label.toLowerCase()} →
          </Link>
          <Link href="/store/shawns-picks" className="text-signal underline-offset-4 hover:underline">
            Shawn&apos;s Picks →
          </Link>
        </div>
      </Section>
    </>
  );
}
