import { trackEvent } from '@/lib/analytics';

/**
 * Truck Parking Club analytics (Phase 1) — the planner's outbound-revenue
 * funnel, mirroring lib/store/analytics.ts conventions. Payloads carry only
 * BUCKETED, non-personal context: never coordinates, never origin or
 * destination strings, never anything driver-identifying.
 */
export const TPC_EVENTS = {
  resultsShown: 'tpc_results_shown',
  reserveClicked: 'tpc_reserve_clicked',
  noResults: 'tpc_no_results',
} as const;

/** Remaining usable drive minutes → coarse bucket. */
export function hosBucket(usableDriveMin: number): string {
  if (usableDriveMin < 60) return '<1h';
  if (usableDriveMin <= 180) return '1-3h';
  return '3h+';
}

/** Off-route detour estimate minutes → coarse bucket. */
export function detourBucket(detourMinutes: number): string {
  if (detourMinutes < 5) return '<5m';
  if (detourMinutes <= 15) return '5-15m';
  return '15m+';
}

export function trackTpcResultsShown(props: { count: number; hos: string; fallback: boolean }) {
  trackEvent(TPC_EVENTS.resultsShown, props);
}

export function trackTpcReserveClicked(props: {
  slot: string;
  position: number;
  hos: string;
  detour: string;
}) {
  trackEvent(TPC_EVENTS.reserveClicked, props);
}

export function trackTpcNoResults(props: { hos: string }) {
  trackEvent(TPC_EVENTS.noResults, props);
}
