'use client';

import { trackEvent } from '@/lib/analytics';
import { AMAZON_REL, amazonProductUrl } from '@/lib/store/amazon';
import { productActive } from '@/lib/store/products';
import { STORE_EVENTS } from '@/lib/store/analytics';
import { cn } from '@/lib/utils/cn';
import type { StoreProduct } from '@/lib/store/types';

/**
 * The one Amazon button. It renders an ACTIVE affiliate link ONLY when the
 * product passes the activation gate (valid ASIN + verified title + licensed
 * main image); otherwise it renders a disabled "Amazon link coming soon" state.
 * This enforces the rule that a placeholder — or a half-filled product missing
 * its title or image — never produces a live/dead Amazon button.
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
  const url = productActive(product) ? amazonProductUrl(product.asin) : null;

  if (!url) {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-card border border-line px-5 py-2.5 font-display text-sm uppercase tracking-wide text-muted',
          className,
        )}
        aria-disabled="true"
      >
        Amazon link coming soon
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
