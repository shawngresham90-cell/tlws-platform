import { createStaticClient } from '@/lib/supabase/static';
import { pctToGoal, remainingCents } from './campaign';

/**
 * Founders Wall data access (Milestone 9). Read-only, public rows only — RLS
 * policy `anon_read_founders` limits SELECT to `is_public = true`, and the
 * `campaign_progress` view is `security_invoker` so it aggregates the same set.
 *
 * Uses the cookieless static client so the /founders page can render as ISR
 * (revalidate) instead of per-request SSR. Every fetch fails soft: a slow or
 * unreachable DB returns an empty wall / zeroed thermometer rather than a 500,
 * so the page always ships.
 *
 * PRIVACY: `raised_cents` is an AGGREGATE campaign total stored independently
 * of any per-founder amount (see supabase/migrations/026). This reader never
 * selects `amount_cents`, so individual contribution amounts never leave the DB.
 * `founder_count` is derived from the number of published founder records.
 */

export type FounderTier = 'equipment_sponsor' | 'student_sponsor' | 'iron' | 'steel' | 'brick';

export type PublicFounder = {
  id: string;
  display_name: string;
  business_name: string | null;
  business_url: string | null;
  tier: FounderTier;
  /** 1-based recognition order within a tier, as shown on the wall. Null sorts last. */
  position: number | null;
  message: string | null;
  logo_url: string | null;
  paid_at: string;
};

export type CampaignProgress = {
  raised_cents: number;
  goal_cents: number;
  remaining_cents: number;
  pct_to_goal: number;
  founder_count: number;
};

const PROGRESS_FALLBACK: CampaignProgress = {
  raised_cents: 0,
  goal_cents: 1_200_000,
  remaining_cents: 1_200_000,
  pct_to_goal: 0,
  founder_count: 0,
};

export async function getCampaignProgress(): Promise<CampaignProgress> {
  try {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from('campaign_progress')
      .select('raised_cents, goal_cents, pct_to_goal, founder_count')
      .single();
    if (!data) return PROGRESS_FALLBACK;
    const raised = Number(data.raised_cents) || 0;
    const goal = Number(data.goal_cents) || PROGRESS_FALLBACK.goal_cents;
    // Remaining and percentage are derived here from raised + goal (floored
    // at 0 / capped at 100) rather than trusted from the view, so every
    // surface shows the same clamped numbers regardless of view version.
    const remaining = remainingCents(goal, raised);
    return {
      raised_cents: raised,
      goal_cents: goal,
      remaining_cents: remaining,
      pct_to_goal: pctToGoal(goal, raised),
      founder_count: Number(data.founder_count) || 0,
    };
  } catch {
    return PROGRESS_FALLBACK;
  }
}

export async function getPublicFounders(): Promise<PublicFounder[]> {
  try {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from('founders')
      .select(
        'id, display_name, business_name, business_url, tier, position, message, logo_url, paid_at',
      )
      .eq('is_public', true)
      // Recognition order within each tier (the wall regroups by tier). Nulls
      // sort last, ties fall back to newest-first. `amount_cents` is never
      // selected, so individual contribution amounts never leave the DB.
      .order('position', { ascending: true, nullsFirst: false })
      .order('paid_at', { ascending: false });
    return (data as PublicFounder[] | null) ?? [];
  } catch {
    return [];
  }
}
