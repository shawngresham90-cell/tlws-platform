import { SITE } from '@/lib/seo/site';
import {
  PRESCHOOL_PATH,
  PRESCHOOL_PRICE_USD,
  PRESCHOOL_PURCHASE_URL,
} from './constants';
import { PRESCHOOL_TAGLINE } from './content';

/**
 * JSON-LD for the CDL Pre-School sales page — factual fields only.
 * Deliberately absent (Phase 10 rules): AggregateRating, Review, enrollment
 * counts, and any availability claim beyond the real 20-spot limit. The
 * LimitedAvailability status is the true state of the Founding Student offer.
 */
export function preschoolCourseSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    '@id': `${SITE.url}${PRESCHOOL_PATH}#course`,
    name: 'CDL Pre-School',
    description: PRESCHOOL_TAGLINE,
    url: `${SITE.url}${PRESCHOOL_PATH}`,
    provider: { '@id': `${SITE.url}/#organization` },
    offers: {
      '@type': 'Offer',
      price: PRESCHOOL_PRICE_USD.toFixed(2),
      priceCurrency: 'USD',
      url: PRESCHOOL_PURCHASE_URL,
      availability: 'https://schema.org/LimitedAvailability',
      seller: { '@id': `${SITE.url}/#organization` },
    },
  };
}
