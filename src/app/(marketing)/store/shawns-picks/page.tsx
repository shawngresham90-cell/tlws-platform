import Link from 'next/link';
import type { Metadata } from 'next';
import { Section, Eyebrow } from '@/components/ui';
import { AmazonDisclosure } from '@/components/store/AmazonDisclosure';
import { StoreEvents } from '@/components/store/StoreEvents';
import { ProductImage } from '@/components/store/ProductImage';
import { AmazonCta } from '@/components/store/AmazonCta';
import { shawnsPicks } from '@/lib/store/picks';
import { productHref, priceLabel, ratingLabel, productReadiness } from '@/lib/store/products';
import { STORE_EVENTS } from '@/lib/store/analytics';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import { SITE } from '@/lib/seo/site';

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "Shawn's Picks — The Trucker Gear I Reach For First",
  description:
    "Shawn's short list of the gear that earns its spot in the cab first — dash cams, seat support, a 12V fridge, a real inverter, and the rest, with an honest reason for each.",
  path: '/store/shawns-picks',
});

export default function ShawnsPicksPage() {
  const picks = shawnsPicks();

  return (
    <>
      <StoreEvents event={STORE_EVENTS.picksView} />
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Store', path: '/store' },
            { name: "Shawn's Picks", path: '/store/shawns-picks' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: "Shawn's Picks",
            itemListElement: picks.map((p, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: p.product.name,
              url: `${SITE.url}${productHref(p.product.slug)}`,
            })),
          },
        ]}
      />

      <Section className="border-b border-line">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
          <Link href="/store" className="hover:text-signal">
            Store
          </Link>{' '}
          <span aria-hidden="true">›</span> <span className="text-ink">Shawn&apos;s Picks</span>
        </nav>
        <Eyebrow>Shawn&apos;s Picks</Eyebrow>
        <h1 className="display-hero max-w-3xl">The gear I&apos;d buy first</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          If you&apos;re outfitting the truck and don&apos;t know where to start, start here. This is
          the short list — the stuff that earns its spot before anything else, with a straight reason
          for each.
        </p>
        <div className="mt-6">
          <AmazonDisclosure />
        </div>
      </Section>

      <Section>
        <ol className="space-y-6">
          {picks.map(({ product, why }, i) => {
            const price = priceLabel(product);
            const rating = ratingLabel(product);
            const { live } = productReadiness(product);
            return (
              <li
                key={product.slug}
                className="flex flex-col gap-4 rounded-card border border-line bg-asphalt-800 p-5 sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-4 sm:w-16 sm:flex-col sm:items-start">
                  <span className="font-display text-3xl text-signal">{i + 1}</span>
                </div>
                <div className="sm:w-40 sm:shrink-0">
                  <Link href={productHref(product.slug)}>
                    <ProductImage product={product} />
                  </Link>
                </div>
                <div className="flex-1">
                  <h2 className="font-display text-lg uppercase text-ink">
                    <Link href={productHref(product.slug)} className="hover:text-signal">
                      {product.name}
                    </Link>
                  </h2>
                  <p className="mt-1 text-sm text-ink">{why}</p>
                  <p className="mt-2 text-sm text-muted">
                    {rating ? (
                      <>
                        <span aria-hidden="true" className="text-signal">
                          ★
                        </span>{' '}
                        {rating} · {' '}
                      </>
                    ) : null}
                    {price ?? 'Price at Amazon'}
                  </p>
                </div>
                <div className="sm:shrink-0">
                  {live ? (
                    <AmazonCta product={product} placement="shawns-picks" />
                  ) : (
                    <Link
                      href={productHref(product.slug)}
                      className="inline-block text-sm font-semibold text-signal underline-offset-4 hover:underline"
                    >
                      See the pick →
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Section>
    </>
  );
}
