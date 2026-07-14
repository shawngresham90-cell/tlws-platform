import { createAdminClient } from '@/lib/supabase/admin';
import type { FounderTier } from '@/lib/community/founders';

/**
 * Admin-side data layer for the Academy Founders Wall. Server-only (service
 * role). Reads EVERYTHING the admin needs in one pass: all founder rows
 * (including the private amount_cents, which never reaches public readers),
 * the campaign settings singleton, and the same campaign_progress view the
 * public thermometer reads — one source of truth, so the admin preview can
 * never disagree with the live site.
 */

export const FOUNDER_TIER_VALUES = [
  'iron',
  'steel',
  'brick',
  'student_sponsor',
  'equipment_sponsor',
] as const satisfies readonly FounderTier[];

export type AdminFounderRow = {
  id: string;
  display_name: string;
  business_name: string | null;
  business_url: string | null;
  tier: FounderTier;
  /** Private contribution amount — admin-only, never summed into public copy today. */
  amount_cents: number | null;
  position: number | null;
  message: string | null;
  is_public: boolean;
  status: string;
  paid_at: string | null;
  created_at: string;
};

export type CampaignSettingsRow = {
  goal_cents: number;
  /** When set, this aggregate IS the public "raised" total (migration 026). */
  raised_cents_override: number | null;
};

const FOUNDER_COLUMNS =
  'id, display_name, business_name, business_url, tier, amount_cents, position, message, is_public, status, paid_at, created_at';

export async function getFoundersAdminState(): Promise<{
  founders: AdminFounderRow[];
  settings: CampaignSettingsRow | null;
  progress: { raised_cents: number; goal_cents: number; founder_count: number } | null;
  error: string | null;
}> {
  const supabase = createAdminClient();
  const [foundersRes, settingsRes, progressRes] = await Promise.all([
    supabase
      .from('founders')
      .select(FOUNDER_COLUMNS)
      .order('tier', { ascending: true })
      .order('position', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
    supabase.from('campaign_settings').select('goal_cents, raised_cents_override').maybeSingle(),
    supabase
      .from('campaign_progress')
      .select('raised_cents, goal_cents, founder_count')
      .maybeSingle(),
  ]);

  return {
    founders: (foundersRes.data as AdminFounderRow[] | null) ?? [],
    settings: (settingsRes.data as CampaignSettingsRow | null) ?? null,
    progress: progressRes.data
      ? {
          raised_cents: Number(progressRes.data.raised_cents) || 0,
          goal_cents: Number(progressRes.data.goal_cents) || 0,
          founder_count: Number(progressRes.data.founder_count) || 0,
        }
      : null,
    error: foundersRes.error?.message ?? settingsRes.error?.message ?? null,
  };
}

/** Dollars string ("7,100" / "7100" / "$7,100") → whole cents, or null when blank/invalid. */
export function dollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** https-only public link, mirroring the wall's rendering rule. */
export function isValidBusinessUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}
