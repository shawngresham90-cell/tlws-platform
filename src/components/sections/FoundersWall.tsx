import { Section, Button } from '@/components/ui';
import { SectionHeading } from './SectionHeading';
import { createClient } from '@/lib/supabase/server';
import { CampaignThermometer } from '@/components/community/CampaignThermometer';
import type { CampaignProgress } from '@/lib/community/founders';

export const revalidate = 60; // re-fetch the thermometer at most once a minute

/**
 * Founders Wall teaser with a LIVE thermometer reading from campaign_progress.
 * Server component — real numbers at request time, no client JS. A hard 3s
 * timeout guarantees the homepage never hangs on a slow/unreachable DB; it
 * falls back to zeros and renders instantly. Renders the SAME
 * CampaignThermometer as the Founders Wall page and the admin preview, so the
 * homepage total can never disagree with the wall.
 */
async function getProgress(): Promise<CampaignProgress> {
  const fallback: CampaignProgress = {
    raised_cents: 0,
    goal_cents: 1_200_000,
    remaining_cents: 1_200_000,
    pct_to_goal: 0,
    founder_count: 0,
  };
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
      raised_cents: Number(data.raised_cents) || 0,
      goal_cents: Number(data.goal_cents) || fallback.goal_cents,
      remaining_cents: 0, // derived inside the thermometer from raised + goal
      pct_to_goal: 0, // derived inside the thermometer from raised + goal
      founder_count: Number(data.founder_count) || 0,
    };
  } catch {
    return fallback;
  }
}

export async function FoundersWall() {
  const progress = await getProgress();

  return (
    <Section id="founders" className="border-b border-line bg-asphalt-800">
      <SectionHeading
        eyebrow="Founders Wall"
        title="Help build the school"
        intro="Every founder who backs Trucking Life Academy gets their name on the wall. This funds real drivers getting a real shot behind the wheel."
      />
      <div className="mx-auto max-w-2xl">
        <CampaignThermometer progress={progress} />
        <div className="mt-6">
          <Button href="/founders">Become a founder</Button>
        </div>
      </div>
    </Section>
  );
}
