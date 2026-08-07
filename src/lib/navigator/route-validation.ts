/**
 * Navigator route validation (milestone N8a) — the layer that decides
 * whether a provider answer is safe to hand to a navigation session.
 * The Trip Planner may show an estimated route; the Navigator may not:
 * every session must start from a VALIDATED truck route, and anything
 * doubtful is surfaced as a structured state, never silently used.
 *
 * States, in order of severity:
 *   'valid'              — safe to start a session
 *   'valid-with-warning' — safe, with provider notices worth showing
 *   'requires-review'    — structurally usable but suspicious; guidance
 *                          must not start from it automatically
 *   'rejected'           — failed validation; never usable
 *   'provider-failure'   — no usable provider response existed at all
 *
 * Pure: parsed route data in, a verdict out. No I/O, no clock.
 */

import { haversineMiles } from '@/lib/map/geo';
import type { LatLng } from '@/lib/map/bounds';

export type RouteState =
  | 'valid'
  | 'valid-with-warning'
  | 'requires-review'
  | 'rejected'
  | 'provider-failure';

export type RouteProblem = { code: string; message: string };

export type RouteValidationResult = {
  state: RouteState;
  /** Reasons the route was rejected / failed / needs review. */
  problems: RouteProblem[];
  /** Non-fatal notices worth surfacing with a valid route. */
  warnings: RouteProblem[];
};

/** The slice of a maneuver this validator judges. */
export type ManeuverForValidation = {
  action: string;
  instruction: string;
  offset: number;
};

/** Provider notice as retained by the parser. */
export type NoticeForValidation = {
  code: string;
  title: string;
  severity: string;
};

export type ParsedRouteForValidation = {
  summary: { meters: number; seconds: number };
  /** First and last points of the returned geometry. */
  firstPosition: LatLng;
  lastPosition: LatLng;
  /** Total geometry points the parser decoded. */
  geometryPointCount: number;
  maneuvers: ManeuverForValidation[];
  notices: NoticeForValidation[];
};

export type ProviderOutcomeForValidation =
  | { kind: 'no-response' }
  | { kind: 'malformed-response' }
  | { kind: 'parsed'; route: ParsedRouteForValidation };

/** Destination gap beyond which the route is simply not to the destination. */
export const DESTINATION_REJECT_MI = 2.0;
/** Gap that is plausibly provider snapping but needs a human look. */
export const DESTINATION_REVIEW_MI = 0.5;
/** Average speeds outside this band cannot be a real truck route. */
export const MIN_PLAUSIBLE_MPH = 3;
export const MAX_PLAUSIBLE_MPH = 90;

const METERS_PER_MILE = 1609.344;

function problem(code: string, message: string): RouteProblem {
  return { code, message };
}

/**
 * Judge one provider outcome against the request it answered.
 * `requestedDestination` is the point the driver asked to reach.
 */
export function validateRoute(
  requestedDestination: LatLng,
  outcome: ProviderOutcomeForValidation,
): RouteValidationResult {
  if (outcome.kind === 'no-response') {
    return {
      state: 'provider-failure',
      problems: [
        problem('no-provider-response', 'The routing provider returned no usable response.'),
      ],
      warnings: [],
    };
  }
  if (outcome.kind === 'malformed-response') {
    return {
      state: 'rejected',
      problems: [
        problem('malformed-provider-response', 'The provider response could not be parsed safely.'),
      ],
      warnings: [],
    };
  }

  const r = outcome.route;
  const problems: RouteProblem[] = [];
  const reviews: RouteProblem[] = [];
  const warnings: RouteProblem[] = [];

  // --- geometry -----------------------------------------------------------
  if (r.geometryPointCount < 2) {
    problems.push(problem('missing-geometry', 'The route has no usable geometry.'));
  }
  for (const [label, p] of [
    ['first', r.firstPosition],
    ['last', r.lastPosition],
  ] as const) {
    if (
      !Number.isFinite(p.lat) ||
      !Number.isFinite(p.lng) ||
      Math.abs(p.lat) > 90 ||
      Math.abs(p.lng) > 180
    ) {
      problems.push(
        problem('invalid-geometry', `The route's ${label} point is not a real coordinate.`),
      );
    }
  }

  // --- summary / travel time / distance -----------------------------------
  const { meters, seconds } = r.summary;
  if (!Number.isFinite(meters) || !Number.isFinite(seconds) || meters <= 0 || seconds <= 0) {
    problems.push(
      problem('invalid-summary', 'Distance or travel time is missing or non-positive.'),
    );
  } else {
    const mph = meters / METERS_PER_MILE / (seconds / 3600);
    if (mph < MIN_PLAUSIBLE_MPH || mph > MAX_PLAUSIBLE_MPH) {
      reviews.push(
        problem(
          'implausible-travel-time',
          `Average speed ${mph.toFixed(1)} mph is outside ${MIN_PLAUSIBLE_MPH}–${MAX_PLAUSIBLE_MPH} mph.`,
        ),
      );
    }
  }

  // --- destination ---------------------------------------------------------
  if (problems.every((p) => p.code !== 'invalid-geometry')) {
    const gapMi = haversineMiles(r.lastPosition, requestedDestination);
    if (gapMi > DESTINATION_REJECT_MI) {
      problems.push(
        problem(
          'destination-mismatch',
          `The route ends ${gapMi.toFixed(1)} mi from the requested destination.`,
        ),
      );
      // Pilot diagnosability: the measured distance rides as its own CODE
      // (clients surface codes, not messages). Sanitized — a distance in
      // miles, never a coordinate.
      problems.push(
        problem(`destination-distance:${gapMi.toFixed(1)}mi`, 'Measured endpoint gap.'),
      );
    } else if (gapMi > DESTINATION_REVIEW_MI) {
      reviews.push(
        problem(
          'destination-offset',
          `The route ends ${gapMi.toFixed(2)} mi from the requested destination — plausibly provider snapping, needs review.`,
        ),
      );
      reviews.push(problem(`destination-distance:${gapMi.toFixed(1)}mi`, 'Measured endpoint gap.'));
    }
  }

  // --- maneuvers ------------------------------------------------------------
  if (r.maneuvers.length === 0) {
    reviews.push(
      problem('no-maneuvers', 'The provider returned no maneuvers — turn-by-turn cannot run.'),
    );
  }
  let lastOffset = -1;
  for (const [i, m] of r.maneuvers.entries()) {
    if (
      typeof m.instruction !== 'string' ||
      m.instruction.trim() === '' ||
      typeof m.action !== 'string' ||
      m.action.trim() === ''
    ) {
      problems.push(problem('invalid-maneuver', `Maneuver ${i + 1} is missing its kind or text.`));
      break;
    }
    if (
      !Number.isInteger(m.offset) ||
      m.offset < 0 ||
      m.offset >= Math.max(r.geometryPointCount, 1)
    ) {
      problems.push(
        problem('maneuver-offset-out-of-range', `Maneuver ${i + 1} points outside the geometry.`),
      );
      break;
    }
    if (m.offset < lastOffset) {
      problems.push(
        problem('maneuver-order', `Maneuver ${i + 1} is out of order along the route.`),
      );
      break;
    }
    lastOffset = m.offset;
  }

  // --- provider notices (truck restrictions) --------------------------------
  for (const n of r.notices) {
    if (n.severity === 'critical') {
      problems.push(
        problem(
          `restriction-violated:${n.code || 'unknown'}`,
          n.title || 'The provider flagged a violated truck restriction on this route.',
        ),
      );
    } else {
      warnings.push(
        problem(`provider-notice:${n.code || 'unknown'}`, n.title || 'Provider notice.'),
      );
    }
  }

  // --- verdict ---------------------------------------------------------------
  if (problems.length > 0) return { state: 'rejected', problems, warnings };
  if (reviews.length > 0) return { state: 'requires-review', problems: reviews, warnings };
  if (warnings.length > 0) return { state: 'valid-with-warning', problems: [], warnings };
  return { state: 'valid', problems: [], warnings: [] };
}
