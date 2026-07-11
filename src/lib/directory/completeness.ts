import type { DirectoryEntry } from './types';
import { getCategory } from './categories';
import { validateTpcUrl } from './tpc';

/**
 * Deterministic listing-completeness scoring (Milestone 21). Pure arithmetic
 * over stored fields — no ML, no external calls, no randomness. Weights are
 * documented below and asserted by tests; the score is category-aware so a
 * weigh station is never punished for having no phone, website, or
 * reservation link.
 *
 * Weight table (points; category-irrelevant rows are redistributed by
 * scaling the achieved total to the applicable maximum):
 *
 *   Core identity (30): name 6, category 6, address 8, city 4, state 2, zip 4
 *   Routing      (20): interstate 6, exit 6, coordinates 8
 *   Contact      (14): phone 7, website 7            (places: skipped)
 *   Usefulness   (26): parking flags 5, spaces 4, amenities 7, description 8,
 *                      tpc 2                          (per-category, see below)
 *   Trust        (10): verified date 6, approved reviews 4
 *
 * A field that does not apply to the listing's category is removed from the
 * denominator instead of scored as missing.
 */

/** Weigh stations / rest-area-like places: public infrastructure, not businesses. */
const PLACE_CATEGORIES = new Set(['weigh-stations']);
/** Categories where a TPC reservation link is meaningful. */
const TPC_CATEGORIES = new Set(['parking', 'truck-stops', 'hotels-truck-parking']);
/** Categories where parking capacity fields are meaningful. */
const PARKING_CATEGORIES = new Set(['parking', 'truck-stops', 'hotels-truck-parking']);

export type CompletenessInput = Pick<
  DirectoryEntry,
  | 'name'
  | 'category'
  | 'address'
  | 'city'
  | 'state'
  | 'zip'
  | 'interstate'
  | 'exitNumber'
  | 'lat'
  | 'lng'
  | 'phone'
  | 'website'
  | 'amenities'
  | 'parkingSpaces'
  | 'description'
  | 'tpcUrl'
  | 'verifiedAt'
> & {
  /** Approved-review count when the caller has it (0 otherwise). */
  approvedReviews?: number;
};

export type CompletenessPart = {
  key: string;
  label: string;
  points: number;
  max: number;
  applicable: boolean;
};

export type CompletenessResult = {
  /** 0–100, integer. */
  score: number;
  label: 'Excellent' | 'Good' | 'Needs work' | 'Incomplete';
  parts: CompletenessPart[];
  /** Applicable fields that scored zero — the admin worklist. */
  missing: string[];
};

export function completenessLabel(score: number): CompletenessResult['label'] {
  if (score >= 85) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 40) return 'Needs work';
  return 'Incomplete';
}

const has = (v: string | null | undefined) => Boolean(v && v.trim().length > 0);

export function scoreCompleteness(entry: CompletenessInput): CompletenessResult {
  const isPlace = PLACE_CATEGORIES.has(entry.category);
  const knownCategory = Boolean(getCategory(entry.category));
  const tpcApplies = TPC_CATEGORIES.has(entry.category);
  const parkingApplies = PARKING_CATEGORIES.has(entry.category);
  const hasParkingChip = (entry.amenities ?? []).some((a) =>
    ['Free parking', 'Paid parking', 'Reserved', 'Overnight OK'].includes(a),
  );
  const validTpc = Boolean(entry.tpcUrl && validateTpcUrl(entry.tpcUrl).ok);

  const parts: CompletenessPart[] = [
    // Core identity
    { key: 'name', label: 'Name', points: has(entry.name) ? 6 : 0, max: 6, applicable: true },
    { key: 'category', label: 'Category', points: knownCategory ? 6 : 0, max: 6, applicable: true },
    { key: 'address', label: 'Street address', points: has(entry.address) ? 8 : 0, max: 8, applicable: true },
    { key: 'city', label: 'City', points: has(entry.city) ? 4 : 0, max: 4, applicable: true },
    { key: 'state', label: 'State', points: /^[A-Z]{2}$/.test(entry.state ?? '') ? 2 : 0, max: 2, applicable: true },
    { key: 'zip', label: 'ZIP', points: has(entry.zip) ? 4 : 0, max: 4, applicable: true },
    // Routing
    { key: 'interstate', label: 'Interstate', points: has(entry.interstate) ? 6 : 0, max: 6, applicable: true },
    { key: 'exit', label: 'Exit number', points: has(entry.exitNumber) ? 6 : 0, max: 6, applicable: true },
    {
      key: 'coordinates',
      label: 'Verified coordinates',
      points: entry.lat != null && entry.lng != null ? 8 : 0,
      max: 8,
      applicable: true,
    },
    // Contact (not applicable to public infrastructure)
    { key: 'phone', label: 'Phone', points: has(entry.phone) ? 7 : 0, max: 7, applicable: !isPlace },
    { key: 'website', label: 'Website', points: has(entry.website) ? 7 : 0, max: 7, applicable: !isPlace },
    // Driver usefulness
    {
      key: 'parking-type',
      label: 'Parking type',
      points: hasParkingChip ? 5 : 0,
      max: 5,
      applicable: parkingApplies,
    },
    {
      key: 'spaces',
      label: 'Truck-space count',
      points: entry.parkingSpaces != null ? 4 : 0,
      max: 4,
      applicable: parkingApplies,
    },
    {
      key: 'amenities',
      label: 'Amenities',
      points: (entry.amenities ?? []).length >= 2 ? 7 : (entry.amenities ?? []).length === 1 ? 4 : 0,
      max: 7,
      applicable: !isPlace,
    },
    {
      key: 'description',
      label: 'Description',
      points: (entry.description ?? '').trim().length >= 60 ? 8 : (entry.description ?? '').trim().length >= 20 ? 4 : 0,
      max: 8,
      applicable: true,
    },
    { key: 'tpc', label: 'TPC reservation link', points: validTpc ? 2 : 0, max: 2, applicable: tpcApplies },
    // Trust
    {
      key: 'verified',
      label: 'Verified date',
      points: has(entry.verifiedAt) ? 6 : 0,
      max: 6,
      applicable: true,
    },
    {
      key: 'reviews',
      label: 'Approved reviews',
      points: (entry.approvedReviews ?? 0) > 0 ? 4 : 0,
      max: 4,
      applicable: true,
    },
  ];

  const applicable = parts.filter((p) => p.applicable);
  const max = applicable.reduce((sum, p) => sum + p.max, 0);
  const achieved = applicable.reduce((sum, p) => sum + p.points, 0);
  const score = max === 0 ? 0 : Math.round((achieved / max) * 100);

  return {
    score,
    label: completenessLabel(score),
    parts,
    missing: applicable.filter((p) => p.points === 0).map((p) => p.label),
  };
}

/** Distribution buckets for the quality dashboard. */
export function completenessDistribution(scores: number[]): Record<CompletenessResult['label'], number> {
  const out: Record<CompletenessResult['label'], number> = {
    Excellent: 0,
    Good: 0,
    'Needs work': 0,
    Incomplete: 0,
  };
  for (const s of scores) out[completenessLabel(s)] += 1;
  return out;
}
