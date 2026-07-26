'use client';

import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';
import {
  DIRECTORY_EVENTS,
  funnelHref,
  listingEventProps,
  type ListingContext,
} from '@/lib/directory/funnel';

/**
 * Business-facing funnel on a listing detail page: claim the listing, or ask
 * about featured placement. Both deep-link into the EXISTING sponsor inquiry
 * form — nothing here submits, charges, promises, or changes a listing.
 *
 * Wording is deliberately conservative: an inquiry, reviewed by a human. It
 * never states the listing is verified, claimed, or featured, and never
 * mentions traffic, ranking, leads, results, or a price.
 *
 * Held/suppressed listings are excluded upstream — the detail page only passes
 * `promote` for a published, non-held listing.
 */
export function ListingFunnelCtas({
  listing,
  surface = 'directory-listing',
  promote = true,
  className,
}: {
  listing: ListingContext;
  surface?: string;
  /** When false, only the claim path renders (no placement promotion). */
  promote?: boolean;
  className?: string;
}) {
  const props = listingEventProps(listing, { surface });

  return (
    <aside
      aria-labelledby="listing-funnel-heading"
      className={`rounded-card border border-line bg-asphalt-800 p-6 ${className ?? ''}`}
    >
      <h2 id="listing-funnel-heading" className="font-display text-xl uppercase text-ink">
        Own or manage this business?
      </h2>
      <p className="mt-2 text-sm text-muted">
        Send an inquiry and Shawn reviews it personally. Sending this does not verify ownership,
        change the listing, or reserve placement.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          href={funnelHref('claim', listing, surface)}
          onClick={() => trackEvent(DIRECTORY_EVENTS.claimInterest, props)}
          className="inline-flex items-center justify-center rounded-card bg-signal px-5 py-3 text-center font-display text-base uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600"
        >
          Claim this listing →
        </Link>

        {promote && (
          <Link
            href={funnelHref('featured', listing, surface)}
            onClick={() => trackEvent(DIRECTORY_EVENTS.featuredInterest, props)}
            className="inline-flex items-center justify-center rounded-card border border-signal px-5 py-3 text-center font-display text-base uppercase tracking-wide text-signal transition-colors hover:bg-signal hover:text-asphalt"
          >
            Ask about featured placement →
          </Link>
        )}
      </div>

      <p className="mt-4 text-xs text-muted">
        No payment is collected and no rate is quoted here. Claims and placements are reviewed
        before anything changes.
      </p>
    </aside>
  );
}
