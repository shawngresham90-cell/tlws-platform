import type { CampaignProgress } from '@/lib/community/founders';
import { dollars, pctToGoal, remainingCents } from '@/lib/community/campaign';

/**
 * THE fundraising thermometer — one component for every surface (Founders Wall
 * page, homepage teaser, Academy fundraising section, admin preview) so the
 * numbers can never disagree. Pure props, no data fetching; remaining and
 * percentage are recomputed here from raised + goal via the shared clamped
 * math (remaining ≥ 0, percentage ≤ 100), so a stale or uncapped view value
 * can never render wrong. Shows the AGGREGATE campaign total only — never any
 * individual founder's contribution.
 *
 * Accessibility: role="progressbar" with numeric values AND a full
 * aria-valuetext sentence; the percentage and dollar figures are visible text,
 * so meaning never relies on the bar color alone.
 */
export function CampaignThermometer({
  progress,
  showFounderCount = true,
}: {
  progress: CampaignProgress;
  showFounderCount?: boolean;
}) {
  const raised = Number(progress.raised_cents) || 0;
  const goal = Number(progress.goal_cents) || 0;
  const remaining = remainingCents(goal, raised);
  const pct = pctToGoal(goal, raised);
  const goalReached = goal > 0 && remaining === 0;

  return (
    <div className="rounded-card border border-line bg-asphalt p-6 sm:p-8">
      <p className="font-display text-4xl uppercase text-signal sm:text-5xl">
        {dollars(raised)} raised
      </p>
      <p className="mt-1 text-sm uppercase tracking-wide text-muted">of {dollars(goal)} goal</p>

      {goalReached ? (
        <p className="mt-3 font-display text-xl uppercase text-signal">
          Goal reached — thank you, drivers
        </p>
      ) : (
        <p className="mt-3 font-display text-xl uppercase text-ink">
          {dollars(remaining)} left to open the school
        </p>
      )}

      <div
        className="mt-4 h-4 w-full overflow-hidden rounded-full border border-line bg-asphalt-700"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${dollars(raised)} raised of ${dollars(goal)} goal — ${pct}% funded, ${dollars(remaining)} remaining`}
        aria-label="Fundraising progress toward opening the school"
      >
        <div
          className="h-full rounded-full bg-signal transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-ink">{pct}% funded</p>
        {showFounderCount && (
          <p className="text-sm text-muted">
            {progress.founder_count} founder{progress.founder_count === 1 ? '' : 's'} on the wall
          </p>
        )}
      </div>
    </div>
  );
}
