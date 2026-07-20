import type { FounderTier, PublicFounder } from './founders';

/**
 * Pure campaign math + founder helpers for the Founders Wall.
 *
 * PRIVACY-FIRST AGGREGATE MODEL. The campaign total ("raised") is stored and
 * read as a single aggregate value, independent of any per-founder contribution
 * amount. Individual amounts are private (nullable in the DB) and are NEVER
 * summed to derive the public total, distributed across founders, or exposed in
 * the UI. `founder_count` is derived from the count of published founder records,
 * not from money.
 *
 * These functions are DB-free so they can be unit-tested in isolation
 * (scripts/test-founders.ts) and shared by the reader and the presentational
 * components.
 */

/** Money helpers -------------------------------------------------------- */

/** Cents → "$7,100" (whole-dollar, thousands-separated). */
export function dollars(cents: number): string {
  return `$${Math.round((Number(cents) || 0) / 100).toLocaleString('en-US')}`;
}

/**
 * Remaining toward the goal, in cents. Never negative — an over-goal campaign
 * reads as $0 remaining, not a negative number.
 */
export function remainingCents(goalCents: number, raisedCents: number): number {
  const goal = Number(goalCents) || 0;
  const raised = Number(raisedCents) || 0;
  return Math.max(goal - raised, 0);
}

/**
 * Percentage toward the goal, one decimal place, clamped to [0, 100] for display.
 * A zero/invalid goal yields 0 rather than a divide-by-zero.
 */
export function pctToGoal(goalCents: number, raisedCents: number): number {
  const goal = Number(goalCents) || 0;
  const raised = Number(raisedCents) || 0;
  if (goal <= 0) return 0;
  const pct = Math.round((raised / goal) * 1000) / 10;
  return Math.min(Math.max(pct, 0), 100);
}

/** Founder counting / de-duplication ----------------------------------- */

/** Normalize a name for duplicate detection (case/space/punctuation-insensitive). */
export function normalizeName(name: string | null | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Stable key identifying "the same founder" for de-duplication. */
export function founderDupKey(displayName: string, businessName?: string | null): string {
  return `${normalizeName(displayName)}|${normalizeName(businessName)}`;
}

/**
 * Count of unique founder NAMES (informational). This is intentionally distinct
 * from spots sold: one person may hold multiple founder spots (e.g. a Steel and
 * a Brick spot), which counts as 1 unique name but 2 spots. Tier availability
 * and wall occupancy count SPOTS (i.e. records), not this.
 */
export function uniqueFounderCount(
  founders: Pick<PublicFounder, 'display_name' | 'business_name'>[],
): number {
  return new Set(founders.map((f) => founderDupKey(f.display_name, f.business_name))).size;
}

/**
 * Names that hold more than one spot (informational — NOT an error). A founder
 * intentionally buying several spots is expected; this just surfaces which names
 * recur so reporting can show spots-sold vs. unique-names.
 */
export function repeatedFounderNames(
  founders: Pick<PublicFounder, 'display_name' | 'business_name'>[],
): string[] {
  const seen = new Map<string, number>();
  for (const f of founders) {
    const k = founderDupKey(f.display_name, f.business_name);
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
}

/** Tier capacity / availability ---------------------------------------- */

/**
 * Remaining spots in a tier given how many published founders already hold it.
 * `capacity === null` means uncapped/unknown → returns null (render as open).
 * A capped tier never returns negative (over-subscription reads as 0 left).
 */
export function tierRemaining(capacity: number | null, usedCount: number): number | null {
  if (capacity === null) return null;
  return Math.max(capacity - (Number(usedCount) || 0), 0);
}

/** How many published founders currently hold each tier. */
export function tierUsage(founders: Pick<PublicFounder, 'tier'>[]): Record<FounderTier, number> {
  const usage = {
    equipment_sponsor: 0,
    student_sponsor: 0,
    iron: 0,
    steel: 0,
    brick: 0,
    final_founder: 0,
  } as Record<FounderTier, number>;
  for (const f of founders) {
    if (f.tier in usage) usage[f.tier] += 1;
  }
  return usage;
}
