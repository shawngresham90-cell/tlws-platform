/**
 * SEO-ENGINE-1 Scout types. The Scout is READ-ONLY evidence gathering: it
 * fetches Search Console performance rows, classifies opportunities
 * deterministically, and writes a bounded human report for OWNER review.
 * It never generates pages, never writes to the site, the database, or git.
 */

/** One Search Console row for the (query, page) dimension pair. */
export type GscRow = {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  /** Click-through rate as a fraction (0..1), as GSC reports it. */
  ctr: number;
  /** Average position (1 = top). */
  position: number;
};

export type DateWindow = { startDate: string; endDate: string };

/** The two windows one Scout run compares. */
export type ScoutWindows = {
  /** Last 28 COMPLETE days (GSC data lags ~2–3 days; see config). */
  current: DateWindow;
  /** The preceding comparable 28-day period. */
  prior: DateWindow;
};

export type ClusterKey = 'academy_local' | 'national_info' | 'product_support';

export type OpportunityType = 'STRIKING_DISTANCE' | 'DECAY' | 'GAP' | 'STRENGTHEN';

/**
 * What the owner should do about it. The Scout NEVER acts on these —
 * distinguishing them exists precisely to prevent cannibalization and
 * doorway-page generation by a later, human-gated step.
 */
export type RecommendedAction = 'IMPROVE_EXISTING_URL' | 'POSSIBLE_NEW_PAGE' | 'MANUAL_REVIEW';

/** Every component that feeds the score, exposed so ranking is explainable. */
export type ScoreComponents = {
  impressions: number;
  clicks: number;
  position: number;
  ctr: number;
  /** What a page at this position typically earns (static curve in config). */
  expectedCtr: number;
  /** Estimated extra clicks/28d if the page reached `targetPosition`. */
  headroomClicks: number;
  targetPosition: number;
  /** Current-vs-prior movement, clicks delta (0 when no prior data). */
  clicksDelta: number;
  /** Owner-reviewed commercial cluster weight (heuristic, NOT a ranking factor). */
  clusterWeight: number;
  /** Type multiplier (decay urgency etc.), from config. */
  typeMultiplier: number;
  formulaVersion: 1;
};

export type Opportunity = {
  query: string;
  page: string;
  cluster: ClusterKey;
  types: OpportunityType[];
  action: RecommendedAction;
  /** Existing URL the improvement should land on (S9: prefer over new pages). */
  targetUrl: string;
  /** One-sentence deterministic explanation of the classification. */
  why: string;
  current: GscRow;
  prior: GscRow | null;
  score: number;
  scoreComponents: ScoreComponents;
};

export class ScoutError extends Error {
  constructor(
    public code:
      | 'MISSING_CREDENTIALS'
      | 'BAD_CREDENTIALS'
      | 'MALFORMED_RESPONSE'
      | 'GSC_HTTP_ERROR'
      | 'REPORT_SAFETY',
    message: string,
  ) {
    super(message);
    this.name = 'ScoutError';
  }
}
