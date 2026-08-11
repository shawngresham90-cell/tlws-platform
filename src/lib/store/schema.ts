import { SITE } from '@/lib/seo/site';
import type { StoreProduct } from './types';
import type { DirectProduct } from './direct';
import { productHref, productReadiness, displayName } from './products';
import { amazonProductUrl } from './amazon';

/**
 * Product JSON-LD — factual only. An `offers` block (with price + Amazon URL)
 * is emitted ONLY for a live product (real ASIN + confirmed price), and an
 * `aggregateRating` ONLY when the owner has supplied a verified rating AND
 * review count. Placeholder products get a bare Product node with no price, no
 * offer, no availability, and NEVER a fabricated AggregateRating or Review.
 * This keeps structured data truthful and avoids Google penalties for phantom
 * offers or invented ratings.
 */
export function productSchema(p: StoreProduct): object {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${SITE.url}${productHref(p.slug)}#product`,
    name: displayName(p),
    description: p.description,
    category: p.category,
    url: `${SITE.url}${productHref(p.slug)}`,
  };
  if (p.imageUrl) base.image = p.imageUrl;

  // Offer requires an ACTIVE product (valid ASIN + verified title + image) AND a
  // verified price — never an offer without both.
  const { live, hasRating, hasReviewCount } = productReadiness(p);
  const url = amazonProductUrl(p.asin);
  if (live && url && typeof p.priceUsd === 'number' && p.priceUsd > 0) {
    base.offers = {
      '@type': 'Offer',
      price: p.priceUsd.toFixed(2),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url,
      seller: { '@type': 'Organization', name: 'Amazon' },
    };
  }
  // Only ever emit a rating the owner has actually verified from the listing.
  if (
    hasRating &&
    hasReviewCount &&
    typeof p.rating === 'number' &&
    typeof p.reviewCount === 'number'
  ) {
    base.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: p.rating.toFixed(1),
      reviewCount: p.reviewCount,
      bestRating: '5',
      worstRating: '1',
    };
  }
  return base;
}

/**
 * Product JSON-LD for a direct (Stan) product — the same phantom-offer
 * doctrine as above, applied per product: the node exists ONLY when the owner
 * has confirmed a price (`priceUsd` non-null; 0 is a real, confirmed free
 * offer) and no policy gate blocks purchase. Everything else returns null and
 * the page ships breadcrumb-only, exactly as the whole catalog did before.
 * No availability and no AggregateRating are ever asserted — neither is
 * tracked for direct products.
 */
export function directProductSchema(p: DirectProduct): object | null {
  if (p.priceUsd === null || p.purchaseBlockedReason) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${SITE.url}/store/products/${p.slug}#product`,
    name: p.name,
    description: p.description,
    category: p.category,
    url: `${SITE.url}/store/products/${p.slug}`,
    image: `${SITE.url}${p.image}`,
    brand: { '@type': 'Brand', name: SITE.brand },
    offers: {
      '@type': 'Offer',
      price: p.priceUsd.toFixed(2),
      priceCurrency: 'USD',
      url: p.stanUrl,
      seller: { '@type': 'Organization', name: SITE.brand },
    },
  };
}
