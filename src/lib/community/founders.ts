import { createStaticClient } from '@/lib/supabase/static';

/**
 * Founders Wall data access (Milestone 9). Read-only, public rows only — RLS
 * policy `anon_read_founders` limits SELECT to `is_public = true`, and the
 * `campaign_progress` view is `security_invoker` so it aggregates the same set.
 *
 * Uses the cookieless static client so the /founders page can render as ISR
 * (revalidate) instead of per-request SSR. Every fetch fails soft: a slow or
 * unreachable DB returns an empty wall / zeroed thermometer rather than a 500,
 * so the page always ships.
 */

export type FounderTier = 'equipment_sponsor' | 'student_sponsor' | 'iron' | 'steel' | 'brick';

export type PublicFounder = {
  id: string;
  display_name: string;
  business_name: string | null;
  business_url: string | null;
  tier: FounderTier;
  message: string | null;
  logo_url: string | null;
  paid_at: string;
};

export type CampaignProgress = {
  raised_cents: number;
  goal_cents: number;
  pct_to_goal: number;
  founder_count: number;
};

const PROGRESS_FALLBACK: CampaignProgress = {
  raised_cents: 0,
  goal_cents: 1_200_000,
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
    return {
      raised_cents: Number(data.raised_cents) || 0,
      goal_cents: Number(data.goal_cents) || PROGRESS_FALLBACK.goal_cents,
      pct_to_goal: Number(data.pct_to_goal) || 0,
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
      .select('id, display_name, business_name, business_url, tier, message, logo_url, paid_at')
      .eq('is_public', true)
      .order('paid_at', { ascending: false });
    return (data as PublicFounder[] | null) ?? [];
  } catch {
    return [];
  }
}
