import type { FounderTier, CampaignProgress } from '@/lib/community/founders';
import { normalizeName } from '@/lib/community/campaign';
import { TIER_LABEL } from '@/components/community/tiers';
import { tierRank, type WallFounder } from './founder-number';

/**
 * THE ROAD AHEAD — authoritative Founder Wall dataset.
 *
 * These 40 contribution records are the single source of truth for the
 * road-ahead wall and its fundraising total. They are imported VERBATIM from the
 * owner-supplied roster — names are never shortened, corrected, combined, or
 * invented. The public campaign total is the SUM of these amounts; individual
 * amounts stay in this module and are NEVER rendered per-founder (privacy).
 *
 * Duplicate handling:
 *   - Same person, SAME tier, multiple times  → ONE wall placement carrying a
 *     "N CONTRIBUTIONS" designation, with every amount still summed
 *     (e.g. Barry Van Hammee Jr — two Final Founder spots).
 *   - Same person, DIFFERENT tiers            → SEPARATE wall placements, one per
 *     tier, because two tiers are two distinct spots on the wall
 *     (e.g. Jose Cotto — a Steel spot AND a Brick spot).
 *
 * DB-free + deterministic so it is unit-tested (scripts/test-road-ahead.ts) and
 * renders identically on the server and client.
 */

export type FounderRecord = {
  /** Exact owner-supplied name — displayed as-is. */
  fullName: string;
  tier: FounderTier;
  /** Whole-dollar contribution for this record. */
  amount: number;
};

/** The verified fundraising goal (whole dollars). */
export const ROAD_GOAL_DOLLARS = 11_550;

/**
 * The 40 authoritative contribution records, in wall order (tier bands top to
 * bottom: Iron → Steel → Brick → Final Founder; within a tier, roster order).
 */
export const FOUNDER_RECORDS: FounderRecord[] = [
  // ---- Iron ($1,000) ----
  { fullName: 'David Gresham', tier: 'iron', amount: 1000 },
  { fullName: 'Thomas Fields', tier: 'iron', amount: 1000 },
  { fullName: 'Rosedale Transport', tier: 'iron', amount: 1000 },

  // ---- Steel ($500) ----
  { fullName: 'Gary Ford', tier: 'steel', amount: 500 },
  { fullName: 'Jose Cotto', tier: 'steel', amount: 500 },
  { fullName: 'Greg Walker', tier: 'steel', amount: 500 },
  { fullName: 'Mario Capston', tier: 'steel', amount: 500 },
  { fullName: 'Jon Blankenship', tier: 'steel', amount: 500 },
  { fullName: 'Rush Enterprises', tier: 'steel', amount: 500 },
  { fullName: 'Idle Demon Inc', tier: 'steel', amount: 500 },
  { fullName: 'Ricky M. Rosenbalm', tier: 'steel', amount: 500 },

  // ---- Brick ($100) ----
  { fullName: 'Sam Tusk', tier: 'brick', amount: 100 },
  { fullName: 'Chris Nalley', tier: 'brick', amount: 100 },
  { fullName: 'Terry Hostetler', tier: 'brick', amount: 100 },
  { fullName: 'Billy Joe Poole', tier: 'brick', amount: 100 },
  { fullName: 'J.A. Gresham', tier: 'brick', amount: 100 },
  { fullName: 'R.A. Harper', tier: 'brick', amount: 100 },
  { fullName: 'Steve Snyder', tier: 'brick', amount: 100 },
  { fullName: 'Jose Cotto', tier: 'brick', amount: 100 },
  { fullName: 'Sean Conway', tier: 'brick', amount: 100 },
  { fullName: 'David Chasteen', tier: 'brick', amount: 100 },
  { fullName: 'Clint E. Ingram', tier: 'brick', amount: 100 },
  { fullName: 'Bryce Jennex', tier: 'brick', amount: 100 },
  { fullName: 'Will Bethstern', tier: 'brick', amount: 100 },
  { fullName: 'Shell Fardods', tier: 'brick', amount: 100 },
  { fullName: 'Phil Tuts', tier: 'brick', amount: 100 },
  { fullName: 'Joe Wise', tier: 'brick', amount: 100 },

  // ---- Final Founder ($35) ----
  { fullName: 'James R. Shaw', tier: 'final_founder', amount: 35 },
  { fullName: 'Ernest Murry', tier: 'final_founder', amount: 35 },
  { fullName: 'Stacey Beavers', tier: 'final_founder', amount: 35 },
  { fullName: 'Chad Huckelby', tier: 'final_founder', amount: 35 },
  { fullName: 'Bear & Bug Logistics', tier: 'final_founder', amount: 35 },
  { fullName: 'Kyle Koerner', tier: 'final_founder', amount: 35 },
  { fullName: 'Deirdre Monice Sanders', tier: 'final_founder', amount: 35 },
  { fullName: 'Edward Colon', tier: 'final_founder', amount: 35 },
  { fullName: 'Zac Elrod', tier: 'final_founder', amount: 35 },
  { fullName: 'Matt Allgood', tier: 'final_founder', amount: 35 },
  { fullName: 'Barry Van Hammee Jr', tier: 'final_founder', amount: 35 },
  { fullName: 'Barry Van Hammee Jr', tier: 'final_founder', amount: 35 },
  { fullName: 'Jesus Chapa', tier: 'final_founder', amount: 35 },
];

/** Total raised, in cents — the SUM of every record's amount. */
export function raisedCentsFromRecords(records: FounderRecord[] = FOUNDER_RECORDS): number {
  return records.reduce((sum, r) => sum + Math.round(r.amount * 100), 0);
}

/** Number of imported contribution records (spots sold). */
export function contributionCount(records: FounderRecord[] = FOUNDER_RECORDS): number {
  return records.length;
}

/**
 * Collapse the records into wall placements. Key = normalized name + tier, so a
 * same-tier repeat merges into one placement (with a contributions count) while
 * a different-tier spot stays separate. Placements keep roster order within a
 * tier and are ordered by tier band across the wall.
 */
export function buildAuthoritativeWall(records: FounderRecord[] = FOUNDER_RECORDS): WallFounder[] {
  type Placement = { fullName: string; tier: FounderTier; contributions: number; order: number };
  const byKey = new Map<string, Placement>();
  records.forEach((r, i) => {
    const key = `${normalizeName(r.fullName)}|${r.tier}`;
    const existing = byKey.get(key);
    if (existing) existing.contributions += 1;
    else byKey.set(key, { fullName: r.fullName, tier: r.tier, contributions: 1, order: i });
  });

  const placements = [...byKey.values()].sort((a, b) => {
    const tr = tierRank(a.tier) - tierRank(b.tier);
    return tr !== 0 ? tr : a.order - b.order;
  });

  const perTier = new Map<FounderTier, number>();
  return placements.map((p, i) => {
    const tierPosition = (perTier.get(p.tier) ?? 0) + 1;
    perTier.set(p.tier, tierPosition);
    return {
      id: `${normalizeName(p.fullName)}-${p.tier}`,
      displayName: p.fullName,
      businessName: null,
      businessUrl: null,
      tier: p.tier,
      tierLabel: TIER_LABEL[p.tier] ?? 'Founder',
      tierPosition,
      wallNumber: i + 1,
      message: null,
      contributions: p.contributions,
    };
  });
}

/**
 * The authoritative campaign progress for the road-ahead experience. Raised is
 * the summed contributions; goal is fixed; remaining and percentage are derived
 * so every surface shows the same numbers.
 */
export function buildAuthoritativeCampaign(
  records: FounderRecord[] = FOUNDER_RECORDS,
): CampaignProgress {
  const raised = raisedCentsFromRecords(records);
  const goal = ROAD_GOAL_DOLLARS * 100;
  const remaining = Math.max(goal - raised, 0);
  const pct = goal > 0 ? Math.round((raised / goal) * 1000) / 10 : 0;
  return {
    raised_cents: raised,
    goal_cents: goal,
    remaining_cents: remaining,
    pct_to_goal: pct,
    founder_count: records.length,
  };
}
