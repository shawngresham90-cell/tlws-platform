import { Section, Button } from '@/components/ui';
import { SectionHeading } from './SectionHeading';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60; // re-fetch the thermometer at most once a minute

/**
 * Founders Wall teaser with a LIVE thermometer reading from campaign_progress.
 * Server component — real number at request time, no client JS. A hard 3s
 * timeout guarantees the homepage never hangs on a slow/unreachable DB; it
 * falls back to zeros and renders instantly. Full wall + join is a later milestone.
 */
async function getProgress() {
  const fallback = { raised: 0, goal: 1200000, pct: 0, count: 0 };
  try {
    const supabase = createClient();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const { data } = await supabase
      .from('campaign_progress')
      .select('raised_cents, goal_cents, pct_to_goal, founder_count')
      .abortSignal(controller.signal)
      .single();

    clearTimeout(timer);
    if (!data) return fallback;
    return {
      raised: Number(data.raised_cents) || 0,
      goal: Number(data.goal_cents) || 1200000,
      pct: Number(data.pct_to_goal) || 0,
      count: Number(data.founder_count) || 0,
    };
  } catch {
    return fallback;
  }
}

export async function FoundersWall() {
  const { raised, goal, pct, count } = await getProgress();
  const dollars = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-US')}`;

  return (
    <Section id="founders" className="border-b border-line bg-asphalt-800">
      <SectionHeading
        eyebrow="Founders Wall"
        title="Help build the school"
        intro="Every founder who backs Trucking Life Academy gets their name on the wall. This funds real drivers getting a real shot behind the wheel."
      />
      <div className="rounded-card border border-line bg-asphalt p-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-display text-3xl text-signal sm:text-4xl">{dollars(raised)}</p>
            <p className="text-sm text-muted">
              raised of {dollars(goal)} · {count} founder{count === 1 ? '' : 's'}
            </p>
          </div>
          <p className="font-display text-2xl text-ink">{pct}%</p>
        </div>
        <div
          className="mt-4 h-4 w-full overflow-hidden rounded-full bg-asphalt-700"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Fundraising progress"
        >
          <div
            className="h-full rounded-full bg-signal transition-all"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <div className="mt-6">
          <Button href="/founders">Become a founder</Button>
        </div>
      </div>
    </Section>
  );
}
