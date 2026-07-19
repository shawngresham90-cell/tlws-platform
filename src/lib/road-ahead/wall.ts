import type { PublicFounder } from '@/lib/community/founders';
import type { WallFounder } from '@/components/founders-movement/WallScene';

/**
 * Shared founder-numbering for the cinematic Founders Wall.
 *
 * Canonical founder numbering (owner ruling, unchanged from the FM prototype):
 * chronological across ALL tiers by earliest `paid_at` — №N is the Nth person
 * who said yes, ever. Ties break by wall position, then name, for a stable
 * order. Read-only: this derives display numbers, it never writes founder data.
 *
 * Extracted so THE ROAD AHEAD reuses the exact same rule as /founders-movement
 * (rather than duplicating the sort) and so it can be unit-tested directly.
 */
export function toWallFounders(publicFounders: PublicFounder[]): WallFounder[] {
  return [...publicFounders]
    .sort(
      (a, b) =>
        new Date(a.paid_at).getTime() - new Date(b.paid_at).getTime() ||
        (a.position ?? 1e9) - (b.position ?? 1e9) ||
        a.display_name.localeCompare(b.display_name),
    )
    .map((f, i) => ({
      name: f.business_name ?? f.display_name,
      tier: f.tier,
      number: i + 1,
      year: new Date(f.paid_at).getFullYear(),
      message: f.message,
    }));
}

/** The number the next founder would receive — max(loaded, aggregate) + 1. */
export function nextFounderNumber(wallCount: number, founderCount: number): number {
  return Math.max(wallCount, founderCount) + 1;
}
