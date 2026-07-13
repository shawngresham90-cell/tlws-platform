'use client';

import { trackEvent } from '@/lib/analytics';
import {
  PRESCHOOL_EVENTS,
  PRESCHOOL_PURCHASE_REL,
  PRESCHOOL_PURCHASE_URL,
} from '@/lib/preschool/constants';
import { cn } from '@/lib/utils/cn';

/**
 * The one way to buy. Every purchase button on the site goes through this
 * component so the URL is always the exact Stan Store product, the rel is
 * always sponsored+noopener+noreferrer, and the click emits the same
 * analytics event (placement only — never any personal data). Tracking is
 * fire-and-forget; it can never delay or block the navigation.
 */
export function PurchaseCta({
  placement,
  className,
  children,
}: {
  /** Where on the site this button sits, e.g. "hero", "homepage-card". */
  placement: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={PRESCHOOL_PURCHASE_URL}
      target="_blank"
      rel={PRESCHOOL_PURCHASE_REL}
      onClick={() => trackEvent(PRESCHOOL_EVENTS.purchaseCtaClick, { placement })}
      className={cn(
        'inline-flex items-center justify-center rounded-card bg-signal px-6 py-3 text-center font-display text-lg uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt',
        className,
      )}
    >
      {children}
    </a>
  );
}
