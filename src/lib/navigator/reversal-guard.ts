/**
 * Implicit-reversal guard for REPLACEMENT routes (P0, owner road test).
 *
 * WHAT HAPPENED ON THE ROAD
 *
 * Planned route ran west on 278. The driver turned north onto Butler.
 * Navigator detected the departure correctly and asked for a replacement.
 * The provider returned a route that was, as geometry, perfectly valid: it
 * reached the destination. Its first move was to travel SOUTH on Butler —
 * back the way the truck had just come — and Navigator promoted it to
 * normal turn guidance without a word about how a 70-foot combination was
 * supposed to get pointed the other way.
 *
 * No U-turn was announced. No turnaround was identified. None was
 * verified as truck-suitable, because this app has no dataset that could.
 * The instruction simply assumed a reversal the driver had to invent.
 *
 * WHY VALID GEOMETRY IS NOT ENOUGH
 *
 * `route-validation` asks whether a route is usable — does it have
 * maneuvers, does it end where it was asked to, is its implied speed
 * possible. Every one of those answers was yes. The question it does not
 * ask, and cannot, is whether the FIRST ACTIONABLE PART of the route is
 * reachable from where the truck is pointed right now. A car can often
 * absorb that question at the next intersection. A truck cannot: it may
 * not U-turn at an arbitrary intersection, turn around on a two-lane
 * road, use a driveway, a private lot, a shoulder, or back into traffic.
 * "Just turn around" is not advice this app is equipped to give.
 *
 * WHAT THIS MODULE DOES, AND ONLY THIS
 *
 * It compares the truck's CURRENT heading against the bearing to the
 * first point on the replacement geometry that is far enough away to be
 * a direction rather than noise. If those disagree by more than a right
 * angle and a half, the replacement is reported as an implicit reversal
 * and the caller refuses to promote it to guidance.
 *
 * It identifies NO turnaround. It proposes no U-turn point, names no
 * intersection, and suggests no lot — deliberately, because inventing one
 * from generic geometry is the actual danger here. The safe response to a
 * reversal is to keep the driver moving forward and keep looking, which
 * is the caller's job, not this module's.
 *
 * RELATIONSHIP TO THE WRONG-WAY LOGIC (they are not the same thing)
 *
 *   wrong-way   the truck's heading conflicts with the ACTIVE route —
 *               the driver is going the wrong way down a road the app
 *               already planned. Lives in the matcher
 *               (`OPPOSING_HEADING_DEG`) and the off-route detector.
 *
 *   reversal    a PROPOSED replacement route conflicts with the way the
 *               truck is actually travelling. Nothing is wrong with the
 *               truck; the suggestion is wrong.
 *
 * The thresholds below are deliberately borrowed from that existing
 * machinery rather than invented beside it, so the two can never drift
 * into disagreeing about what "moving" and "a usable heading" mean.
 *
 * Pure: geometry and numbers in, a verdict out. No clock, no I/O.
 */

import { haversineMiles } from '@/lib/map/geo';
import type { LatLng } from '@/lib/map/bounds';
import { initialBearingDegrees, isUsableHeading, normalizeHeading } from './direction-of-travel';
import { relativeBearingDegrees } from './direction-of-travel';

export type ReversalConfig = {
  /**
   * How far the first actionable point must disagree with the truck's
   * heading before the route counts as a reversal.
   *
   * 120°, not 90°. An ordinary turn onto a cross street is exactly 90°
   * and is completely normal; a sweeping ramp or a highway curve can read
   * 60–80° over a short lead. Requiring more than 120° means only a
   * genuine about-face qualifies, which is the thing a truck cannot
   * improvise. The matcher's own opposing-heading bar is 100° against the
   * ACTIVE route; this one is deliberately stricter, because acting on it
   * withholds guidance rather than merely lowering a confidence score.
   */
  reversalDeg: number;
  /**
   * Road speed below which heading is not evidence. Same value as the
   * detector's `wrongDirectionSpeedMph`: below it the platform's heading
   * is noise, and a truck crawling a yard or a lot is not "travelling" in
   * a direction at all.
   */
  minSpeedMph: number;
  /**
   * Fix accuracy beyond which the heading came from drift. Same value as
   * the detector's `maxEvidenceAccuracyM`.
   */
  maxAccuracyM: number;
  /**
   * How far along the replacement to look for the first point that
   * expresses a direction.
   *
   * Short enough that a curving road cannot accumulate 120° inside it,
   * long enough that provider geometry snapped a truck-length behind the
   * current position — which is ordinary and harmless — is stepped over
   * rather than read as an about-face. ~264 ft.
   */
  leadMi: number;
};

export const REVERSAL_DEFAULTS: ReversalConfig = {
  reversalDeg: 120,
  minSpeedMph: 20,
  maxAccuracyM: 40,
  leadMi: 0.05,
};

/**
 * The internal reason a replacement was refused. Named as a validation
 * result rather than a generic failure so a diagnostic snapshot, a
 * problem report and a log entry all say the same specific thing.
 */
export const IMPLICIT_REVERSAL = 'implicit-direction-reversal';

export type ReversalReason =
  /** Confirmed: the route's first actionable move opposes travel. */
  | 'implicit-direction-reversal'
  /** No usable heading — the question cannot be answered, so it is not asked. */
  | 'no-heading'
  /** Yard crawl, parking lot, or stopped: heading is not evidence. */
  | 'below-speed'
  /** The fix is drift, not a position. */
  | 'loose-fix'
  /** No point far enough along to express a direction. */
  | 'no-lead-point'
  /** Checked, and the route starts in the direction the truck is going. */
  | 'forward';

export type ReversalCheck = Readonly<{
  /** True ONLY for a confirmed reversal. Every uncertainty is false. */
  reversal: boolean;
  reason: ReversalReason;
  /** Bearing-to-lead minus heading, in (−180, 180]. Null when not measured. */
  relativeDeg: number | null;
  /** Distance to the point that was measured. Null when none qualified. */
  leadMi: number | null;
}>;

function verdict(
  reversal: boolean,
  reason: ReversalReason,
  relativeDeg: number | null = null,
  leadMi: number | null = null,
): ReversalCheck {
  return Object.freeze({ reversal, reason, relativeDeg, leadMi });
}

/**
 * How far ahead of the truck to anchor a second reroute request when the
 * first one came back pointing backwards.
 *
 * This is the whole mechanism behind forward-progress rerouting, and it
 * needs no provider parameter: ask for a route starting from a point the
 * truck is ABOUT to reach rather than the one it is standing on, and any
 * route from there necessarily begins by going forward. Providers snap an
 * origin to the nearest road, so a point half a mile up the road the truck
 * is already on lands on that road.
 *
 * Half a mile: far enough that the provider cannot answer with a turn the
 * truck has already passed, close enough that it is still the same road
 * and still reachable at highway speed within one reroute cycle.
 */
export const FORWARD_ANCHOR_MI = 0.5;

const EARTH_RADIUS_MI = 3958.7613;

/**
 * A point `miles` ahead of `from` along `headingDeg` — the forward anchor.
 *
 * Great-circle destination formula rather than a flat-earth offset: at
 * half a mile the difference is centimetres, but this is the one place a
 * ROUTE REQUEST ORIGIN is synthesised, and an origin that drifts is an
 * origin snapped to the wrong road.
 *
 * Returns null for an unusable heading, so a caller can never anchor a
 * request on a guessed direction.
 */
export function projectAhead(
  from: LatLng,
  headingDeg: number | null,
  miles: number = FORWARD_ANCHOR_MI,
): LatLng | null {
  if (!isUsableHeading(headingDeg)) return null;
  if (!Number.isFinite(miles) || miles <= 0) return null;
  const d = miles / EARTH_RADIUS_MI;
  const brg = (normalizeHeading(headingDeg) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lng1 = (from.lng * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brg) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (((lng2 * 180) / Math.PI + 540) % 360) - 180,
  };
}

/**
 * Does this replacement route begin by asking the truck to reverse?
 *
 * FAILS OPEN, ALWAYS. Every case where the answer is unknown — no
 * heading, too slow to have one, a loose fix, geometry too short to point
 * anywhere — returns `reversal: false` with the reason recorded. A guard
 * that guessed "reversal" from thin evidence would withhold guidance from
 * a driver who needs it, which is its own hazard; this one only ever
 * speaks when it is sure.
 */
export function checkInitialReversal(
  input: {
    /** Where the truck is now — the matched position, not the raw fix. */
    position: LatLng;
    /** Current heading, degrees from true north. Null when unknown. */
    headingDeg: number | null;
    speedMph: number | null;
    accuracyM: number | null;
    /** The REPLACEMENT route's geometry, in order. */
    geometry: readonly LatLng[];
  },
  config: Partial<ReversalConfig> = {},
): ReversalCheck {
  const cfg = { ...REVERSAL_DEFAULTS, ...config };

  if (!isUsableHeading(input.headingDeg)) return verdict(false, 'no-heading');
  if (input.speedMph === null || !Number.isFinite(input.speedMph)) {
    return verdict(false, 'below-speed');
  }
  if (input.speedMph < cfg.minSpeedMph) return verdict(false, 'below-speed');
  if (
    input.accuracyM !== null &&
    Number.isFinite(input.accuracyM) &&
    input.accuracyM > cfg.maxAccuracyM
  ) {
    return verdict(false, 'loose-fix');
  }

  // The first point far enough away to BE a direction. Walking outward
  // from the start rather than taking a fixed index keeps this correct
  // for both a dense urban polyline and a sparse rural one.
  let lead: LatLng | null = null;
  let leadMi = 0;
  for (const p of input.geometry) {
    const d = haversineMiles(input.position, p);
    if (d >= cfg.leadMi) {
      lead = p;
      leadMi = d;
      break;
    }
  }
  if (lead === null) return verdict(false, 'no-lead-point');

  const bearing = initialBearingDegrees(input.position, lead);
  const relative = relativeBearingDegrees(bearing, normalizeHeading(input.headingDeg));
  const opposed = Math.abs(relative) >= cfg.reversalDeg;
  return verdict(
    opposed,
    opposed ? IMPLICIT_REVERSAL : 'forward',
    Number(relative.toFixed(1)),
    Number(leadMi.toFixed(3)),
  );
}
