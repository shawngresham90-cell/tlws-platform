'use client';

import { cn } from '@/lib/utils/cn';
import type { CampaignProgress } from '@/lib/community/founders';
import {
  FUNDED_HEADLINE,
  FUNDED_SUBHEAD,
  FUNDED_THANKS,
  fundedStatusLabel,
} from '@/lib/community/funded-status';
import styles from './road-ahead.module.css';

/**
 * The founding payoff — shown at the very bottom of the Founder Wall, after
 * every name has been carved.
 *
 * The owner has declared the school funded, so this is recognition, not a
 * fundraising readout. It previously showed RAISED as the dominant figure with
 * TO GO, GOAL, a filling progress bar and a "help finish the build" ask; all of
 * that money is gone from the public site and now lives admin-only.
 *
 * What remains carries no monetary value at all: the funded headline (a static
 * constant, so a database outage cannot turn it into "$0 raised"), the founder
 * COUNT as recognition, and a thank-you. No progressbar role and no monetary
 * aria-valuetext. Nothing animates a number any more, so the reduced-motion and
 * animated renderings are identical and equally readable.
 */
export function FundraisingTotals({
  campaign,
  reduced,
}: {
  campaign: CampaignProgress;
  /** Kept for API compatibility with the wall; nothing here animates. */
  reduced?: boolean;
}) {
  void reduced;
  const count = Number(campaign.founder_count) || 0;

  return (
    <div
      className="mx-auto mt-16 max-w-3xl text-center"
      role="group"
      aria-label={fundedStatusLabel(count)}
    >
      <p className="eyebrow text-signal">The founding total</p>

      <p
        className={cn('mt-3 font-display uppercase leading-none text-signal', styles.founderNumber)}
        style={{ fontSize: 'clamp(2.25rem, 8vw, 4.5rem)' }}
      >
        {FUNDED_HEADLINE}
      </p>
      <p className="mt-3 font-display text-xl uppercase tracking-[0.3em] text-ink sm:text-2xl">
        {FUNDED_SUBHEAD}
      </p>

      {count > 0 && (
        <div className="mt-8">
          <p className={cn('font-display text-4xl text-ink sm:text-5xl', styles.founderNumber)}>
            {count}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-muted">
            Founders on the wall
          </p>
        </div>
      )}

      <p className="mx-auto mt-8 max-w-xl text-lg text-muted">{FUNDED_THANKS}</p>
    </div>
  );
}
