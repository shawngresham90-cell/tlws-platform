import {
  FUNDED_HEADLINE,
  FUNDED_SUBHEAD,
  FUNDED_THANKS,
  fundedStatusLabel,
} from '@/lib/community/funded-status';

/**
 * THE public funded-status panel — one component for every public founder
 * surface (homepage Founders Wall, /founders, /academy) so the message can
 * never disagree between pages. Replaces the old CampaignThermometer on public
 * pages; that component still exists, admin-only, for private totals.
 *
 * Shows NO aggregate money: no raised, no goal, no remaining, no "to go", no
 * percentage, no progress bar, and no monetary aria-valuetext. Founder COUNT is
 * recognition, not money, so it stays.
 *
 * OUTAGE-PROOF. The headline comes from the static funded-status authority, not
 * from a query, so it renders identically when the database is unreachable.
 * `founderCount` is optional for exactly that reason — omit it and the panel
 * still says SCHOOL IS FUNDED rather than implying the school needs money.
 */
export function FundedStatusPanel({
  founderCount = null,
  className,
}: {
  founderCount?: number | null;
  className?: string;
}) {
  const count = Number(founderCount) || 0;

  return (
    <div
      className={'rounded-card border border-line bg-asphalt p-6 sm:p-8 ' + (className ?? '')}
      // A plain labelled group. Deliberately NOT role="progressbar": there is
      // no longer a campaign in progress to report, and the old progressbar
      // carried the dollar figures in aria-valuetext.
      role="group"
      aria-label={fundedStatusLabel(count)}
    >
      <p className="font-display text-4xl uppercase leading-none text-signal sm:text-5xl">
        {FUNDED_HEADLINE}
      </p>
      <p className="mt-3 font-display text-xl uppercase text-ink">{FUNDED_SUBHEAD}</p>
      <p className="mt-3 text-muted">{FUNDED_THANKS}</p>

      {count > 0 && (
        <p className="mt-4 border-t border-line pt-4 text-sm uppercase tracking-wide text-muted">
          {count} founder{count === 1 ? '' : 's'} on the wall
        </p>
      )}
    </div>
  );
}
