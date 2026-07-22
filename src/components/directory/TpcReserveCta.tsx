'use client';

import {
  TPC_DISCLOSURE,
  TPC_HOME_URL,
  TPC_PARTNER_NAME,
  TPC_PROMO_CODE,
  TPC_REL,
} from '@/lib/directory/tpc';
import { trackEvent } from '@/lib/analytics';
import { TPC_EVENTS } from '@/lib/trip-planner/tpc-analytics';

/**
 * Directory-surface Truck Parking Club CTA (Phase 1): tracked outbound link
 * + promo code + real disclosure. Replaces the old untracked hero link and
 * its "Affiliate link coming soon." placeholder.
 */
export function TpcReserveCta({ placement }: { placement: string }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={TPC_HOME_URL}
          target="_blank"
          rel={TPC_REL}
          onClick={() =>
            trackEvent(TPC_EVENTS.reserveClicked, {
              slot: 'directory-cta',
              position: 0,
              placement,
            })
          }
          className="inline-flex items-center justify-center rounded-card bg-signal px-6 py-3 font-display text-lg uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
        >
          Reserve paid parking through {TPC_PARTNER_NAME}
          <span className="sr-only"> (opens in new tab)</span>
          <span aria-hidden="true">&nbsp;→</span>
        </a>
        <span className="inline-flex items-center rounded-card border border-signal/60 px-2 py-1 text-xs font-bold uppercase tracking-wider text-signal">
          Use code {TPC_PROMO_CODE}
        </span>
      </div>
      <p className="mt-3 text-xs text-muted">{TPC_DISCLOSURE}</p>
    </div>
  );
}
