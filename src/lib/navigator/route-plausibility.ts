/**
 * Route plausibility (truck-routing priority 13).
 *
 * A returned route can be legal and still be wrong: a loop, a doubling
 * back, a destination two miles from where the driver asked to go. The
 * existing `route-validation` module already refuses routes that are
 * unusable — no maneuvers, impossible speed, destination far off. This
 * one asks a softer question, and answers it differently.
 *
 * IT NEVER REJECTS. Every finding is advisory, and that restraint is the
 * design. A truck route is SUPPOSED to be longer than the car route it
 * would be compared against: it goes around the low bridge, the weight
 * limit, the no-truck parkway. A plausibility check that rejected long
 * routes would systematically reject the correct ones and steer trucks
 * back onto the roads the restrictions exist to keep them off. Truck
 * legality outranks route length, always.
 *
 * So what comes out is a list of observations for a driver to glance at
 * before starting, and for a report to carry afterwards. The thresholds
 * are set where a human would say "that looks odd", not where a router
 * would say "that is illegal".
 *
 * Pure: geometry in, findings out. No clock, no I/O, no provider.
 */

import { haversineMiles } from '@/lib/map/geo';
import type { LatLng } from '@/lib/map/bounds';
import { KM_PER_MILE } from './format-units';

/**
 * A length inside an advisory SENTENCE — "doubles back about 12 miles".
 * Not `formatDistance`: that renders a cockpit figure ("12.0 mi"), and a
 * sentence wants the word. The imperial wording is byte-for-byte what it
 * has always been; the metric wording is its own sentence, in kilometres.
 */
function sentenceLength(mi: number, metric: boolean, precise: boolean): string {
  if (!metric) {
    return precise ? `${mi.toFixed(1)} miles` : `${Math.round(mi)} miles`;
  }
  const km = mi * KM_PER_MILE;
  return precise ? `${km.toFixed(1)} kilometres` : `${Math.round(km)} kilometres`;
}

export type PlausibilityCode =
  | 'extreme-detour'
  | 'repeated-segment'
  | 'doubles-back'
  | 'destination-mismatch'
  | 'degenerate-geometry';

export type PlausibilityFinding = Readonly<{
  code: PlausibilityCode;
  /** One line a driver can read before starting. */
  message: string;
  /** The number behind it, so a report is evidence and not an opinion. */
  measured: number;
}>;

export type PlausibilityConfig = {
  /**
   * Road miles per straight-line mile before the route is called extreme.
   * A truck route of 1.6x is ordinary; mountain and river crossings reach
   * 2.5x legitimately. 4x is where a human starts looking for a mistake.
   */
  detourRatio: number;
  /** Straight-line miles below which detour ratio is meaningless. */
  minTripMi: number;
  /** How close two points must be to count as the same place. */
  samePointMi: number;
  /** Repeats of the same place before it reads as a loop. */
  repeatVisits: number;
  /** Miles the route may give back after making real progress. */
  backtrackMi: number;
  /**
   * How much of the trip must be behind the truck before losing ground
   * counts at all. Below this, moving away from the destination is just
   * what going around something looks like.
   */
  progressFraction: number;
  /** Backtrack also has to be this share of the trip, so long trips scale. */
  backtrackShare: number;
  /** Miles between the route's end and the requested destination. */
  destinationMi: number;
};

export const DEFAULT_PLAUSIBILITY: PlausibilityConfig = {
  detourRatio: 4,
  minTripMi: 1,
  samePointMi: 0.05,
  repeatVisits: 3,
  backtrackMi: 5,
  progressFraction: 0.6,
  backtrackShare: 0.25,
  destinationMi: 0.5,
};

function routeMiles(points: readonly LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += haversineMiles(points[i - 1], points[i]);
  return total;
}

/**
 * Count how often the route returns to a place it has already been.
 * Quantising to a grid rather than comparing every pair keeps this linear
 * — a route is up to 400 points and this runs on every plan.
 */
function maxRevisits(points: readonly LatLng[], samePointMi: number): number {
  // ~69 miles per degree of latitude; good enough for a coarse grid.
  const cell = Math.max(samePointMi / 69, 1e-6);
  const seen = new Map<string, number>();
  let worst = 0;
  for (const p of points) {
    const key = `${Math.round(p.lat / cell)}:${Math.round(p.lng / cell)}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    if (n > worst) worst = n;
  }
  return worst;
}

/**
 * Ground given back after real progress: the most the distance-to-go ever
 * grows again, once the truck has genuinely closed on the destination.
 *
 * The first version of this measured distance from the ORIGIN instead, and
 * a "must stay silent" fixture caught it — a mountain crossing that runs
 * west, then north, then back east reads as a 10-mile return to the start
 * even though every mile is progress. Distance from where you began says
 * nothing about whether you are getting there.
 *
 * Distance-to-go alone is not enough either. Rounding an obstacle at the
 * start of a trip legitimately increases it — the same crossing adds nine
 * miles of distance-to-go before it subtracts thirty-four. So losing
 * ground only counts once `progressFraction` of the trip is behind the
 * truck: by then the route has committed, and giving distance back is a
 * U-turn rather than a detour.
 */
function backtrackAfterProgress(
  points: readonly LatLng[],
  destination: LatLng,
  progressFraction: number,
): number {
  if (points.length < 3) return 0;
  const initial = haversineMiles(points[0], destination);
  if (initial <= 0) return 0;
  const committed = initial * progressFraction;

  let closest = initial;
  let worst = 0;
  for (const p of points) {
    const toGo = haversineMiles(p, destination);
    if (toGo < closest) closest = toGo;
    else if (closest < committed && toGo - closest > worst) worst = toGo - closest;
  }
  return worst;
}

export function assessRoutePlausibility(
  input: {
    geometry: readonly LatLng[];
    /** Where the driver asked to go. */
    destination: LatLng;
    /** Provider-reported length, when available; geometry is used if not. */
    reportedMiles?: number | null;
    /**
     * Read the advisory in kilometres (Canada milestone). The MEASUREMENT
     * is unchanged — `measured` stays in canonical miles so a threshold, a
     * harness and a diagnostic report all keep comparing the same number.
     * Only the sentence the driver reads changes.
     */
    metric?: boolean;
  },
  config: Partial<PlausibilityConfig> = {},
): readonly PlausibilityFinding[] {
  const cfg = { ...DEFAULT_PLAUSIBILITY, ...config };
  const pts = input.geometry;
  const findings: PlausibilityFinding[] = [];
  // One place decides the words for a length in this module.
  const metric = input.metric === true;

  if (pts.length < 2) {
    return [
      Object.freeze({
        code: 'degenerate-geometry' as const,
        message: 'This route has no drawable path. Plan it again before you start.',
        measured: pts.length,
      }),
    ];
  }

  const straight = haversineMiles(pts[0], input.destination);
  const along =
    typeof input.reportedMiles === 'number' && Number.isFinite(input.reportedMiles)
      ? input.reportedMiles
      : routeMiles(pts);

  if (straight >= cfg.minTripMi) {
    const ratio = along / straight;
    if (ratio > cfg.detourRatio) {
      findings.push(
        Object.freeze({
          code: 'extreme-detour' as const,
          message: `This route is ${ratio.toFixed(1)} times the straight-line distance. That can be correct for a truck, but check it before you start.`,
          measured: Number(ratio.toFixed(2)),
        }),
      );
    }
  }

  const revisits = maxRevisits(pts, cfg.samePointMi);
  if (revisits >= cfg.repeatVisits) {
    findings.push(
      Object.freeze({
        code: 'repeated-segment' as const,
        message: 'This route passes the same spot several times. Look it over before you start.',
        measured: revisits,
      }),
    );
  }

  const backtrack = backtrackAfterProgress(pts, input.destination, cfg.progressFraction);
  // Both a floor and a share: five miles given back matters on a thirty
  // mile trip and is noise on a six hundred mile one.
  if (backtrack > Math.max(cfg.backtrackMi, straight * cfg.backtrackShare)) {
    findings.push(
      Object.freeze({
        code: 'doubles-back' as const,
        message: `This route doubles back about ${sentenceLength(backtrack, metric, false)} after getting close.`,
        measured: Number(backtrack.toFixed(1)),
      }),
    );
  }

  const endGap = haversineMiles(pts[pts.length - 1], input.destination);
  if (endGap > cfg.destinationMi) {
    findings.push(
      Object.freeze({
        code: 'destination-mismatch' as const,
        message: `This route ends about ${sentenceLength(endGap, metric, true)} from the place you searched for.`,
        measured: Number(endGap.toFixed(2)),
      }),
    );
  }

  return Object.freeze(findings);
}

/** Report lines, so a plan review and a problem report agree. */
export function plausibilityLines(findings: readonly PlausibilityFinding[]): string[] {
  if (findings.length === 0) return ['ROUTE CHECK', '  nothing unusual'];
  return ['ROUTE CHECK', ...findings.map((f) => `  ${f.code}: ${f.measured}`)];
}
