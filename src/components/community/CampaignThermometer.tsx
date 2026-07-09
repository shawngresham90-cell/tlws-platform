import type { CampaignProgress } from '@/lib/community/founders';

const dollars = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-US')}`;

/**
 * Presentational fundraising thermometer. Pure props (no data fetching) so it
 * renders identically on the homepage teaser and the full Founders Wall page.
 */
export function CampaignThermometer({ progress }: { progress: CampaignProgress }) {
  const { raised_cents, goal_cents, pct_to_goal, founder_count } = progress;
  const width = Math.min(Math.max(pct_to_goal, 0), 100);

  return (
    <div className="rounded-card border border-line bg-asphalt p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-display text-4xl text-signal sm:text-5xl">{dollars(raised_cents)}</p>
          <p className="mt-1 text-sm text-muted">
            raised of {dollars(goal_cents)} · {founder_count} founder
            {founder_count === 1 ? '' : 's'}
          </p>
        </div>
        <p className="font-display text-3xl text-ink">{pct_to_goal}%</p>
      </div>
      <div
        className="mt-4 h-4 w-full overflow-hidden rounded-full bg-asphalt-700"
        role="progressbar"
        aria-valuenow={Math.round(width)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Fundraising progress toward the goal"
      >
        <div
          className="h-full rounded-full bg-signal transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
