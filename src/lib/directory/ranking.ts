import type { DirectoryEntry } from './types';
import { scoreCompleteness } from './completeness';
import { isDetailIndexable } from './detail';

/**
 * Directory ranking (Milestone 25) — deterministic ordering built ONLY from
 * stored, factual signals. There is no popularity, traffic, click, or opinion
 * input: nothing here can be gamed by views and nothing is invented. The same
 * inputs always produce the same order (ties broken by completeness, then name,
 * then id), so pages are reproducible and testable.
 *
 * The five signals and their weights are disclosed verbatim to readers via
 * RANK_METHODOLOGY, so a page may honestly say WHY one listing is above
 * another. Because none of this measures "best," pages use conservative
 * headings ("Well-documented", "Most complete information", "Featured").
 */

export type RankSignal = 'completeness' | 'verification' | 'reviews' | 'parking' | 'amenities';

/** Weights sum to 100. Change here and RANK_METHODOLOGY together. */
export const RANK_WEIGHTS: Record<RankSignal, number> = {
  completeness: 40,
  verification: 20,
  reviews: 15,
  parking: 15,
  amenities: 10,
};

export const RANK_METHODOLOGY =
  'Ordered only by stored, factual signals — never by popularity, traffic, or opinion. ' +
  'Information completeness counts for 40%, how recently the listing was verified for 20%, ' +
  'the number of approved driver reviews for 15%, verified truck-parking capacity for 15%, ' +
  'and documented amenities for 10%.';

/** Caps beyond which a signal is already "full marks" (documented, not tuned to game). */
const REVIEW_CAP = 5; // 5+ approved reviews = full review credit
const PARKING_CAP = 100; // 100+ verified spaces = full parking credit
const AMENITY_CAP = 6; // 6+ documented amenities = full amenity credit
const VERIFY_FULL_DAYS = 90; // verified within 90d = full credit
const VERIFY_ZERO_DAYS = 550; // older than ~18mo = no verification credit

export type RankedEntry = {
  entry: DirectoryEntry;
  /** Composite 0–100, weighted sum of the five signals. */
  score: number;
  completeness: number;
  approvedReviews: number;
  verificationAgeDays: number | null;
  parkingSpaces: number | null;
  amenityCount: number;
  /** Per-signal 0–100 contribution (pre-weight), for transparency/tests. */
  signals: Record<RankSignal, number>;
};

function clamp(n: number): number {
  return n < 0 ? 0 : n > 100 ? 100 : n;
}

/**
 * Map a DirectoryEntry onto the completeness scorer's input shape. The picked
 * fields are already `T | undefined` on DirectoryEntry, so they pass straight
 * through (CompletenessInput uses `undefined`, not `null`, for absence).
 */
function completenessOf(entry: DirectoryEntry, approvedReviews: number): number {
  return scoreCompleteness({
    name: entry.name,
    category: entry.category,
    address: entry.address,
    city: entry.city,
    state: entry.state,
    zip: entry.zip,
    interstate: entry.interstate,
    exitNumber: entry.exitNumber,
    lat: entry.lat,
    lng: entry.lng,
    phone: entry.phone,
    website: entry.website,
    amenities: entry.amenities ?? [],
    parkingSpaces: entry.parkingSpaces,
    description: entry.description,
    tpcUrl: entry.tpcUrl,
    verifiedAt: entry.verifiedAt,
    approvedReviews,
  }).score;
}

/** Days between an ISO timestamp and `now`, or null if unset/unparseable. */
export function ageInDays(iso: string | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (now.getTime() - t) / 86_400_000);
}

function verificationSignal(ageDays: number | null): number {
  if (ageDays == null) return 0; // never verified → no credit (not penalised elsewhere)
  if (ageDays <= VERIFY_FULL_DAYS) return 100;
  if (ageDays >= VERIFY_ZERO_DAYS) return 0;
  // linear decay between full and zero
  return clamp(((VERIFY_ZERO_DAYS - ageDays) / (VERIFY_ZERO_DAYS - VERIFY_FULL_DAYS)) * 100);
}

export type RankInput = {
  /** Approved review counts keyed by listing id (real counts only; missing = 0). */
  reviewCounts?: Record<string, number>;
  /** Injected clock for deterministic tests. */
  now?: Date;
};

/**
 * Rank a set of entries most-documented first. Pure and deterministic. The
 * caller is responsible for passing only the entries that belong in the list
 * (e.g. published + indexable + a single category) — this function never
 * fetches and never mutates its input.
 */
export function rankEntries(entries: DirectoryEntry[], input: RankInput = {}): RankedEntry[] {
  const now = input.now ?? new Date();
  const reviewCounts = input.reviewCounts ?? {};
  const ranked: RankedEntry[] = entries.map((entry) => {
    const approvedReviews = Math.max(0, reviewCounts[entry.id] ?? 0);
    const completeness = completenessOf(entry, approvedReviews);
    const verificationAgeDays = ageInDays(entry.verifiedAt, now);
    const parkingSpaces = entry.parkingSpaces ?? null;
    const amenityCount = entry.amenities?.length ?? 0;
    const signals: Record<RankSignal, number> = {
      completeness: clamp(completeness),
      verification: verificationSignal(verificationAgeDays),
      reviews: clamp((Math.min(approvedReviews, REVIEW_CAP) / REVIEW_CAP) * 100),
      parking: clamp((Math.min(parkingSpaces ?? 0, PARKING_CAP) / PARKING_CAP) * 100),
      amenities: clamp((Math.min(amenityCount, AMENITY_CAP) / AMENITY_CAP) * 100),
    };
    const score =
      (Object.keys(RANK_WEIGHTS) as RankSignal[]).reduce(
        (sum, k) => sum + signals[k] * RANK_WEIGHTS[k],
        0,
      ) / 100;
    return {
      entry,
      score: Math.round(score * 10) / 10,
      completeness,
      approvedReviews,
      verificationAgeDays,
      parkingSpaces,
      amenityCount,
      signals,
    };
  });
  // Deterministic total order: score, then completeness, then name, then id.
  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      b.completeness - a.completeness ||
      a.entry.name.localeCompare(b.entry.name) ||
      a.entry.id.localeCompare(b.entry.id),
  );
  return ranked;
}

/**
 * The listings worth featuring in a "top" list: published entries that clear
 * the deterministic indexability gate (isDetailIndexable — street address plus
 * ≥2 substance signals), the same gate the sitemap and detail pages use. This
 * is deliberately NOT the locations.is_indexable column, which is an unused
 * manual override that is false on every current row. Returns [] rather than a
 * thin/empty list so pages can hide the section instead of showing filler.
 */
export function topRanked(
  entries: DirectoryEntry[],
  input: RankInput & { limit?: number; minScore?: number } = {},
): RankedEntry[] {
  const { limit = 25, minScore = 1, ...rankInput } = input;
  return rankEntries(
    entries.filter(isDetailIndexable),
    rankInput,
  )
    .filter((r) => r.score >= minScore)
    .slice(0, limit);
}
