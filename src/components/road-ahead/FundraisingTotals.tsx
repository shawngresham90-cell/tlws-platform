'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils/cn';
import { dollars } from '@/lib/community/campaign';
import type { CampaignProgress } from '@/lib/community/founders';
import { useInView } from '@/lib/road-ahead/hooks';
import styles from './road-ahead.module.css';

/**
 * The fundraising payoff — shown at the very bottom of the Founder Wall, after
 * every name has been carved. RAISED is the dominant figure; TO GO and GOAL sit
 * beneath it, and the bar fills to the funded percentage as it scrolls into view.
 * All values come from the authoritative campaign (summed contributions), so
 * every surface reads the same numbers. Fully readable + static under reduced
 * motion; the bar carries an accessible progressbar role with the live percent.
 */
export function FundraisingTotals({
  campaign,
  reduced,
}: {
  campaign: CampaignProgress;
  reduced: boolean;
}) {
  const pct = campaign.pct_to_goal;
  const { ref, inView } = useInView<HTMLDivElement>(!reduced);
  const [fill, setFill] = useState(reduced ? pct : 0);

  useEffect(() => {
    if (reduced) {
      setFill(pct);
      return;
    }
    if (inView) {
      const id = requestAnimationFrame(() => setFill(pct));
      return () => cancelAnimationFrame(id);
    }
  }, [reduced, inView, pct]);

  const pctLabel = `${pct}%`;

  return (
    <div ref={ref} className="mx-auto mt-16 max-w-3xl text-center">
      <p className="eyebrow text-signal">The founding total</p>

      <p
        className={cn('mt-3 font-display leading-none text-signal', styles.founderNumber)}
        style={{ fontSize: 'clamp(3.5rem, 12vw, 7rem)' }}
      >
        {dollars(campaign.raised_cents)}
      </p>
      <p className="mt-1 font-display text-xl uppercase tracking-[0.3em] text-ink sm:text-2xl">
        Raised
      </p>

      <div
        className="mx-auto mt-8 h-4 max-w-2xl overflow-hidden rounded-full border border-line bg-asphalt-800"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${pctLabel} funded`}
        aria-label="Founders Wall fundraising progress"
      >
        <div
          className={cn('h-full rounded-full bg-signal', !reduced && styles.fundBar)}
          style={{ width: `${fill}%` } as CSSProperties}
        />
      </div>
      <p className="mt-2 text-sm font-semibold uppercase tracking-widest text-muted">
        {pctLabel} funded
      </p>

      <div className="mt-8 flex items-center justify-center gap-10 sm:gap-16">
        <div>
          <p className={cn('font-display text-3xl text-ink sm:text-4xl', styles.founderNumber)}>
            {dollars(campaign.remaining_cents)}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-muted">To go</p>
        </div>
        <div className="h-10 w-px bg-line" aria-hidden="true" />
        <div>
          <p className={cn('font-display text-3xl text-ink sm:text-4xl', styles.founderNumber)}>
            {dollars(campaign.goal_cents)}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-muted">Goal</p>
        </div>
      </div>

      <p className="mx-auto mt-8 max-w-xl text-lg text-muted">
        Every dollar on this wall came from drivers who believed first. Add yours and help finish
        the build.
      </p>
    </div>
  );
}
