import { SITE } from '@/lib/seo/site';
import type { StoreProduct } from './types';
import { productHref, productReadiness } from './products';
import { amazonProductUrl } from './amazon';

/**
 * Product JSON-LD — factual only. An `offers` block (with price + Amazon URL)
 * is emitted ONLY for a live product (real ASIN + confirmed price). Placeholder
 * products get a bare Product node with no price, no offer, no availability,
 * and never a fabricated AggregateRating or Review. This keeps structured data
 * truthful and avoids Google penalties for phantom offers.
 */
export function productSchema(p: StoreProduct): object {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${SITE.url}${productHref(p.slug)}#product`,
    name: p.name,
    description: p.description,
    category: p.category,
    url: `${SITE.url}${productHref(p.slug)}`,
  };
  if (p.imageUrl) base.image = p.imageUrl;

  const { live } = productReadiness(p);
  const url = amazonProductUrl(p.asin);
  if (live && url && typeof p.priceUsd === 'number') {
    base.offers = {
      '@type': 'Offer',
      price: p.priceUsd.toFixed(2),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url,
      seller: { '@type': 'Organization', name: 'Amazon' },
    };
  }
  return base;
}
