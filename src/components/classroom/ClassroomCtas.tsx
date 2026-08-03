'use client';

import { trackEvent } from '@/lib/analytics';
import { CLASSROOM_EVENTS } from '@/lib/classroom/analytics';
import { AMAZON_WISHLIST_URL, CASH_APP_URL } from '@/lib/classroom/campaign';
import { cn } from '@/lib/utils/cn';

/**
 * The two campaign actions. Client components purely because they report a
 * click — the destinations are plain anchors, so both work with JavaScript
 * disabled and analytics failing is never allowed to block the navigation
 * (`trackEvent` swallows everything it throws).
 *
 * Every external link carries target="_blank" + rel="noopener noreferrer",
 * and its accessible name says where it goes and that it opens a new tab.
 */

const baseCta =
  'inline-flex min-h-[48px] items-center justify-center rounded-card px-6 py-3 text-center ' +
  'font-display uppercase tracking-wide transition-transform ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-signal ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt ' +
  'motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.99]';

export function AmazonListCta({
  placement,
  className,
  children = 'View the Amazon List',
}: {
  placement: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={AMAZON_WISHLIST_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="View the Amazon supply list for the Trucking Life Academy classroom (opens in a new tab)"
      onClick={() => trackEvent(CLASSROOM_EVENTS.amazonClick, { placement })}
      className={cn(baseCta, 'bg-signal text-asphalt text-lg', className)}
    >
      {children}
    </a>
  );
}

export function CashAppCta({
  placement,
  className,
  children = 'Send Supply Money',
}: {
  placement: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={CASH_APP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Send money toward classroom supplies through Cash App (opens in a new tab)"
      onClick={() => trackEvent(CLASSROOM_EVENTS.cashAppClick, { placement })}
      // Road Flare orange — the approved SECONDARY accent, deliberately
      // distinct from the amber primary so the two actions never read as
      // equal weight.
      className={cn(
        baseCta,
        'border-2 border-flare text-flare-300 hover:bg-flare/10 focus-visible:ring-flare',
        className,
      )}
    >
      {children}
    </a>
  );
}
