import type { ClusterKey, OpportunityType } from './types';

/**
 * SEO-ENGINE-1 Scout configuration — every threshold and weight the
 * classifier uses lives HERE, documented, so the owner can review and tune
 * them. Nothing in this file is presented as a Google ranking factor; the
 * cluster weights in particular are a PRIORITIZATION HEURISTIC that encodes
 * which searches matter commercially to TLWS, nothing more.
 */

/** The Search Console property. Override with GSC_PROPERTY if the account
 *  holds a URL-prefix property instead of the domain property. */
export const DEFAULT_PROPERTY = 'sc-domain:truckinglifewithshawn.com';

/**
 * GSC data for the most recent ~2–3 days is incomplete. The window therefore
 * ends 3 days before the run date and spans 28 complete days; the comparison
 * window is the immediately preceding 28 days. 28 days smooths weekday/
 * weekend cycles without stretching so far that decay hides.
 */
export const WINDOW_DAYS = 28;
export const DATA_LAG_DAYS = 3;

/** Cap the rows fetched per window. 5000 covers this property many times
 *  over today; the report is bounded far below this regardless. */
export const GSC_ROW_LIMIT = 5000;

/**
 * MINIMUM IMPRESSIONS for striking-distance classification: 50 per 28-day
 * window (~1.8/day). Below that, GSC position averages swing wildly on a
 * handful of auctions and acting on them is noise-chasing. This is a
 * documented judgment call, not a Google constant — tune with real data.
 */
export const STRIKING_MIN_IMPRESSIONS = 50;
/** Striking distance = page 1 bottom through page 2 (positions 4–20). */
export const STRIKING_POSITION_MIN = 4;
export const STRIKING_POSITION_MAX = 20;

/**
 * DECAY guards — both a RELATIVE drop and an ABSOLUTE floor must be met, so
 * tiny-volume noise (5 clicks → 3 clicks) is never called decay:
 *  - the PRIOR period must have been meaningful (≥ 10 clicks or ≥ 300
 *    impressions), and
 *  - clicks fell ≥ 30% AND by ≥ 5, or impressions fell ≥ 30% AND by ≥ 100.
 */
export const DECAY_PRIOR_MIN_CLICKS = 10;
export const DECAY_PRIOR_MIN_IMPRESSIONS = 300;
export const DECAY_RELATIVE_DROP = 0.3;
export const DECAY_ABS_CLICK_DROP = 5;
export const DECAY_ABS_IMPRESSION_DROP = 100;

/** STRENGTHEN — positive momentum with the same anti-noise floors. */
export const STRENGTHEN_MIN_CLICKS = 5;
export const STRENGTHEN_RELATIVE_GROWTH = 0.3;
export const STRENGTHEN_ABS_CLICK_GROWTH = 3;

/**
 * GAP — meaningful impressions that nothing on the site satisfies well:
 * either the ranking URL sits beyond page 2, or it holds a decent position
 * but earns under a quarter of the CTR that position typically pays (a
 * strong signal the page does not match the intent). Gap findings default
 * to MANUAL_REVIEW; the Scout never creates a page.
 */
export const GAP_MIN_IMPRESSIONS = 50;
export const GAP_POSITION_BEYOND = 20;
export const GAP_CTR_FRACTION_OF_EXPECTED = 0.25;
/** POSSIBLE_NEW_PAGE is only even SUGGESTED at this volume or above. */
export const NEW_PAGE_MIN_IMPRESSIONS = 200;

/** The report is bounded — owner review works on a shortlist, not a dump. */
export const REPORT_MAX_OPPORTUNITIES = 15;
/** Hard ceiling; config tuning can raise the cap to 20 but no further. */
export const REPORT_ABSOLUTE_CAP = 20;

/**
 * Static expected-CTR-by-position curve used for headroom estimates.
 * Industry-typical shape, deliberately conservative; documented as an
 * ESTIMATE — Google publishes no such table.
 */
export function expectedCtr(position: number): number {
  if (position <= 1) return 0.28;
  if (position <= 2) return 0.15;
  if (position <= 3) return 0.1;
  if (position <= 4) return 0.07;
  if (position <= 5) return 0.05;
  if (position <= 7) return 0.035;
  if (position <= 10) return 0.02;
  if (position <= 20) return 0.01;
  return 0.005;
}

/** Score multipliers per opportunity type — decay is urgent (defend what we
 *  already earned), striking distance is the classic quick win. */
export const TYPE_MULTIPLIER: Record<OpportunityType, number> = {
  DECAY: 1.3,
  STRIKING_DISTANCE: 1.2,
  STRENGTHEN: 1.0,
  GAP: 0.9,
};

export type ClusterConfig = {
  key: ClusterKey;
  label: string;
  /**
   * Owner-reviewed commercial weight. academy_local is highest because an
   * Academy enrollment is worth orders of magnitude more than an info
   * pageview — a BUSINESS prioritization, not an SEO signal.
   */
  weight: number;
  /** Query regexes that pull a row into this cluster (first match wins). */
  queryPatterns: RegExp[];
  /** Existing route prefixes that legitimately serve this cluster's intent.
   *  S8/S9: queries here map to these EXISTING URLs before any new page is
   *  ever contemplated. */
  routeHints: string[];
};

export const CLUSTERS: ClusterConfig[] = [
  {
    key: 'academy_local',
    label: 'Academy / Local',
    weight: 3.0,
    queryPatterns: [
      /\bcdl (school|schools|training|class|classes|academy)\b/i,
      /\b(truck|truck driving|driving) school\b/i,
      /\bdalton\b/i,
      /\bnorth georgia\b/i,
      /\bwhitfield\b/i,
      /\bchattanooga\b.*\bcdl\b|\bcdl\b.*\bchattanooga\b/i,
    ],
    routeHints: ['/academy'],
  },
  {
    key: 'product_support',
    label: 'Product Support',
    weight: 1.5,
    queryPatterns: [
      /\bpractice test\b|\bpermit test\b|\bcdl test\b/i,
      /\bpre.?school\b|\bpre.?trip\b/i,
      /\bdash ?cam|headset|gps|gift|store\b/i,
      /\bhos calculator\b|\btrip planner\b/i,
    ],
    routeHints: ['/practice-tests', '/cdl-pre-school', '/store', '/tools', '/trip-planner'],
  },
  {
    key: 'national_info',
    label: 'National Information',
    weight: 1.0,
    // Default cluster — anything not matched above lands here.
    queryPatterns: [],
    routeHints: ['/knowledge', '/directory', '/dot-tools'],
  },
];

export const CLUSTER_BY_KEY: Record<ClusterKey, ClusterConfig> = Object.fromEntries(
  CLUSTERS.map((c) => [c.key, c]),
) as Record<ClusterKey, ClusterConfig>;
