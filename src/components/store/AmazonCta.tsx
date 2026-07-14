'use client';

import { trackEvent } from '@/lib/analytics';
import { AMAZON_REL, amazonProductUrl } from '@/lib/store/amazon';
import { STORE_EVENTS } from '@/lib/store/analytics';
import { cn } from '@/lib/utils/cn';
import type { StoreProduct } from '@/lib/store/types';

/**
 * The one Amazon button. It renders an ACTIVE affiliate link ONLY when the
 * product has a real ASIN (amazonProductUrl returns non-null); otherwise it
 * renders a disabled "Link coming soon" state. This is what enforces the rule
 * that placeholder ASINs never produce a live/dead Amazon button.
 *
 * Active links always carry rel="sponsored noopener noreferrer" and open a new
 * tab, and fire a placement-tagged analytics event (no personal data).
 */
export function AmazonCta({
  product,
  placement,
  className,
}: {
  product: StoreProduct;
  placement: string;
  className?: string;
}) {
  const url = amazonProductUrl(product.asin);

  if (!url) {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-card border border-line px-5 py-2.5 font-display text-sm uppercase tracking-wide text-muted',
          className,
        )}
        aria-disabled="true"
      >
        Link coming soon
      </span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel={AMAZON_REL}
      onClick={() =>
        trackEvent(STORE_EVENTS.amazonCtaClick, { product: product.slug, placement })
      }
      className={cn(
        'inline-flex items-center justify-center rounded-card bg-signal px-5 py-2.5 font-display text-sm uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt',
        className,
      )}
    >
      View on Amazon
    </a>
  );
}
