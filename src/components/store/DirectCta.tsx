'use client';

import { trackEvent } from '@/lib/analytics';
import { STORE_EVENTS } from '@/lib/store/analytics';
import { ctaState, type DirectProduct } from '@/lib/store/direct';
import { cn } from '@/lib/utils/cn';

/**
 * The one CTA for a direct (Stan) product. It renders an actionable link ONLY
 * for a state that `ctaState()` has cleared — a free download, or a confirmed
 * price with no outstanding policy blocker. Everything else is inert text, so
 * a product whose price nobody has approved can be listed and read about
 * without ever offering a way to pay for it.
 *
 * Outbound links carry rel="noopener noreferrer" and open a new tab. They are
 * NOT marked `sponsored`: these are Trucking Life's own products sold through
 * its own Stan account, not paid third-party endorsements.
 */
const base =
  'inline-flex items-center justify-center rounded-card px-5 py-2.5 font-display text-sm uppercase tracking-wide transition-colors';

export function DirectCta({
  product,
  placement,
  className,
}: {
  product: DirectProduct;
  placement: string;
  className?: string;
}) {
  const cta = ctaState(product);

  if (cta.kind === 'details') {
    return (
      <span
        className={cn(base, 'border border-line text-muted', className)}
        aria-disabled="true"
        title={cta.reason}
      >
        {cta.label}
      </span>
    );
  }

  const event =
    cta.kind === 'get-free'
      ? STORE_EVENTS.freeGuideClick
      : cta.kind === 'book'
        ? STORE_EVENTS.coachingClick
        : STORE_EVENTS.stanClick;

  return (
    <a
      href={cta.href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent(event, { product: product.slug, placement })}
      className={cn(
        base,
        'bg-signal text-asphalt hover:bg-signal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt',
        className,
      )}
    >
      {cta.label}
    </a>
  );
}
