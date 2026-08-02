import { haversineMiles } from '@/lib/map/geo';
import type { LatLng } from '@/lib/map/bounds';

/**
 * Is that place ahead of me, or did I already pass it?
 *
 * The directory can already answer "what is near me" — `withDistance` +
 * `sortByDistance` in lib/map/geo do that. Near is the wrong question at 65mph.
 * A truck stop four miles behind is nearer than one eight miles ahead and
 * completely useless, and a driver scanning a nearest-first list has to work out
 * which entries are behind them by reading the exit numbers. This module answers
 * the question they were actually asking, from a position and a heading.
 *
 * WHAT THIS IS NOT. Every measurement here is straight-line geometry against the
 * driver's instantaneous compass heading. It is not route distance, it does not
 * know about roads, and it cannot tell that the stop 200 feet to the left is
 * across a divided highway with the next crossover eleven miles on. Where a real
 * route exists, HERE route geometry and the Trip Planner's own route-mile
 * projection are authoritative and this module must not be used to second-guess
 * them — lib/trip-planner is untouched by this file and imports nothing from it.
 * This is for the case where there is no route: a driver rolling down the
 * interstate who has not planned a trip.
 *
 * It deliberately invents nothing. When the heading is missing or unusable the
 * relation is `unknown` and the projections are null rather than a guessed
 * default — a fabricated heading of 0 would silently label everything north of
 * the driver as "ahead", which is worse than saying nothing.
 *
 * Provenance: the signed along-heading projection was identified as worth having
 * during the read-only audit of the partner PWA project (see
 * docs/donor-audit-extraction.md). That archive carried no LICENSE, no
 * authorship record and no git history, so nothing was copied from it; this is
 * an independent implementation. Distance comes from the existing TLWS
 * `haversineMiles` so the platform keeps exactly one geodesy implementation.
 */

/** Where a candidate sits relative to the direction of travel. */
export type DirectionRelation =
  /** Within the forward cone — the driver has not reached it yet. */
  | 'ahead'
  /** Within the rearward cone — already passed. */
  | 'behind'
  /** Off to one side, neither meaningfully ahead nor behind. */
  | 'lateral'
  /** Close enough to the driver that a bearing carries no information. */
  | 'coincident'
  /** No usable heading, so the question cannot be answered. */
  | 'unknown';

export type DirectionOfTravel = {
  /** Great-circle distance in miles. Always present, heading or not. */
  distanceMiles: number;
  /** Initial bearing origin → candidate, degrees clockwise from true north. Null when coincident. */
  bearingDegrees: number | null;
  /** Bearing minus heading, normalized to (−180, 180]. Null without a usable heading. */
  relativeBearingDegrees: number | null;
  /** Signed projection onto the heading: positive ahead, negative behind. Null without a heading. */
  alongTrackMiles: number | null;
  /** Signed offset across the heading: positive right of travel, negative left. Null without a heading. */
  crossTrackMiles: number | null;
  relation: DirectionRelation;
};

export type DirectionOptions = {
  /**
   * Half-angle of the forward cone, in degrees. Inside it the candidate reads as
   * `ahead`; the mirrored rear cone reads as `behind`; the remainder is
   * `lateral`. The default splits the compass into equal thirds — a 120° forward
   * arc, a 120° rear arc, and 60° on each side — which keeps "ahead" meaning
   * roughly "in front of the windshield" rather than merely "not behind".
   */
  coneDegrees?: number;
  /**
   * Below this distance a bearing is noise: GPS scatter alone moves the computed
   * bearing through the full circle when the two points are feet apart. About
   * 26 feet, comfortably inside civilian GPS error.
   */
  coincidentMiles?: number;
};

const DEFAULT_CONE_DEGREES = 60;
const DEFAULT_COINCIDENT_MILES = 0.005;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Normalize any finite heading into [0, 360). Handles the wraparound cases
 * callers actually produce — 361 from an accumulated turn, −10 from a signed
 * sensor — without rejecting them.
 */
export function normalizeHeading(headingDegrees: number): number {
  return ((headingDegrees % 360) + 360) % 360;
}

/**
 * A heading is usable only if it is a finite number. `null` (what the
 * Geolocation API reports for a stationary device), `undefined`, `NaN` and the
 * infinities are all "we do not know", and are treated identically.
 */
export function isUsableHeading(headingDegrees: unknown): headingDegrees is number {
  return typeof headingDegrees === 'number' && Number.isFinite(headingDegrees);
}

/**
 * Initial bearing from `origin` to `target`, degrees clockwise from true north.
 *
 * The `atan2` formulation is inherently correct across the antimeridian: the
 * longitude difference only ever reaches `Math.sin`/`Math.cos`, and those agree
 * on 359.8° and −0.2°. No special-casing is needed and none is done.
 */
export function initialBearingDegrees(origin: LatLng, target: LatLng): number {
  const lat1 = toRad(origin.lat);
  const lat2 = toRad(target.lat);
  const dLng = toRad(target.lng - origin.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return normalizeHeading(toDeg(Math.atan2(y, x)));
}

/** Signed difference between two compass angles, normalized to (−180, 180]. */
export function relativeBearingDegrees(bearing: number, heading: number): number {
  const diff = normalizeHeading(bearing - heading);
  return diff > 180 ? diff - 360 : diff;
}

/**
 * Resolve a candidate's position relative to the driver's direction of travel.
 *
 * Pure and deterministic: identical inputs always give an identical result, and
 * nothing is read from the clock, the network, or a global.
 */
export function directionOfTravel(
  origin: LatLng,
  headingDegrees: number | null | undefined,
  target: LatLng,
  options: DirectionOptions = {},
): DirectionOfTravel {
  const cone = clampCone(options.coneDegrees);
  const coincidentMiles = clampCoincident(options.coincidentMiles);
  const distanceMiles = haversineMiles(origin, target);

  // Too close to bear. Reported before the heading check, because at this range
  // the answer is the same whether or not a heading exists.
  if (!(distanceMiles > coincidentMiles)) {
    return {
      distanceMiles,
      bearingDegrees: null,
      relativeBearingDegrees: null,
      alongTrackMiles: null,
      crossTrackMiles: null,
      relation: 'coincident',
    };
  }

  const bearing = initialBearingDegrees(origin, target);

  if (!isUsableHeading(headingDegrees)) {
    // The bearing is still true and worth returning; only the heading-relative
    // measurements are unknowable, so they are null rather than invented.
    return {
      distanceMiles,
      bearingDegrees: bearing,
      relativeBearingDegrees: null,
      alongTrackMiles: null,
      crossTrackMiles: null,
      relation: 'unknown',
    };
  }

  const relative = relativeBearingDegrees(bearing, normalizeHeading(headingDegrees));
  const relativeRad = toRad(relative);
  const magnitude = Math.abs(relative);

  return {
    distanceMiles,
    bearingDegrees: bearing,
    relativeBearingDegrees: relative,
    alongTrackMiles: distanceMiles * Math.cos(relativeRad),
    crossTrackMiles: distanceMiles * Math.sin(relativeRad),
    relation: magnitude <= cone ? 'ahead' : magnitude >= 180 - cone ? 'behind' : 'lateral',
  };
}

/** Convenience predicate for the common filter — strictly the forward cone. */
export function isAhead(
  origin: LatLng,
  headingDegrees: number | null | undefined,
  target: LatLng,
  options?: DirectionOptions,
): boolean {
  return directionOfTravel(origin, headingDegrees, target, options).relation === 'ahead';
}

/**
 * A cone at or past 90° would make `ahead` and `behind` overlap, and one at 0°
 * would make `ahead` unreachable. Out-of-range and non-finite values fall back
 * to the default rather than producing a nonsensical classification.
 */
function clampCone(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_CONE_DEGREES;
  if (value <= 0 || value >= 90) return DEFAULT_CONE_DEGREES;
  return value;
}

function clampCoincident(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return DEFAULT_COINCIDENT_MILES;
  }
  return value;
}
