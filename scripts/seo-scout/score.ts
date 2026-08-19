import { CLUSTER_BY_KEY, TYPE_MULTIPLIER, expectedCtr } from './config';
import type { ClusterKey, GscRow, OpportunityType, ScoreComponents } from './types';

/**
 * Deterministic, explainable opportunity score.
 *
 * THIS IS OUR PRIORITIZATION NUMBER, NOT GOOGLE'S. It estimates how many
 * clicks per 28 days are on the table if the page climbed three positions
 * (bounded at position 1), then weights that by the owner-reviewed
 * commercial cluster and by the opportunity type's urgency. Every input is
 * returned alongside the score so a ranked line can always answer "why".
 *
 *   headroomClicks = impressions × max(0, expectedCtr(target) − actualCtr)
 *   score          = round( (headroomClicks + |clicksDelta|·momentumShare)
 *                            × clusterWeight × typeMultiplier )
 *
 * momentumShare weighs movement at half strength: momentum flags direction,
 * headroom measures size.
 */
const POSITION_CLIMB = 3;
const MOMENTUM_SHARE = 0.5;

export function scoreOpportunity(
  row: GscRow,
  prior: GscRow | null,
  cluster: ClusterKey,
  types: OpportunityType[],
): { score: number; components: ScoreComponents } {
  const targetPosition = Math.max(1, row.position - POSITION_CLIMB);
  const headroomClicks = Math.max(0, row.impressions * (expectedCtr(targetPosition) - row.ctr));
  const clicksDelta = prior ? row.clicks - prior.clicks : 0;
  const clusterWeight = CLUSTER_BY_KEY[cluster].weight;
  const typeMultiplier = Math.max(...types.map((t) => TYPE_MULTIPLIER[t]));
  const score =
    Math.round(
      (headroomClicks + Math.abs(clicksDelta) * MOMENTUM_SHARE) *
        clusterWeight *
        typeMultiplier *
        10,
    ) / 10;
  return {
    score,
    components: {
      impressions: row.impressions,
      clicks: row.clicks,
      position: row.position,
      ctr: row.ctr,
      expectedCtr: expectedCtr(targetPosition),
      headroomClicks: Math.round(headroomClicks * 10) / 10,
      targetPosition,
      clicksDelta,
      clusterWeight,
      typeMultiplier,
      formulaVersion: 1,
    },
  };
}
