import { STATE_BOUNDS, INTERSTATE_BOUNDS, type LatLng } from '@/lib/map/bounds';
import { milesOutsideBounds, normalizeInterstate } from './coordinate-verification';
import { haversineMiles } from '@/lib/map/geo';

/**
 * Interstate mile-marker interpolation (Phase 2A: data readiness). Pure math —
 * no network, no database, and it NEVER writes anywhere. Given verified
 * coordinate anchors along a corridor (state + interstate + milepost), a
 * listing that only knows "I-75 exit 296" can be placed by linear
 * interpolation between the two anchors that bracket its milepost.
 *
 * Honesty rules, by construction:
 * - Interpolation only works where exit numbers ARE mileposts. States that
 *   number exits sequentially (Delaware here) are refused, never guessed.
 * - No extrapolation: a milepost outside the anchor range is unresolved.
 * - Confidence is capped at 'medium' — the admin apply tool auto-applies only
 *   'high', so an interpolated coordinate can never reach the database
 *   without a human upgrading it after review.
 * - Every result carries the anchor gap and provenance so a reviewer can see
 *   exactly how the number was made.
 */

/** How each directory state numbers its interstate exits. */
export const EXIT_NUMBERING: Record<string, 'milepost' | 'sequential'> = {
  AL: 'milepost',
  AR: 'milepost',
  FL: 'milepost',
  GA: 'milepost',
  IL: 'milepost',
  IN: 'milepost',
  KY: 'milepost',
  MD: 'milepost',
  MI: 'milepost',
  NC: 'milepost',
  OH: 'milepost',
  SC: 'milepost',
  TN: 'milepost',
  VA: 'milepost',
  // Delaware numbers I-95 exits sequentially — exit ≠ milepost, so
  // interpolation by exit number would be wrong there.
  DE: 'sequential',
};

export type MilepostAnchor = {
  milepost: number;
  lat: number;
  lng: number;
  /** Listing the anchor came from, when it came from one. */
  listingId?: string;
  /** Provenance label, e.g. 'directory-verified' | 'geocoding-batch'. */
  source: string;
};

export type CorridorCalibration = {
  /** Normalized form, e.g. "I-75". */
  interstate: string;
  /** Two-letter state abbreviation. */
  state: string;
  /** Sorted ascending by milepost; at least two anchors to interpolate. */
  anchors: MilepostAnchor[];
};

export type CalibrationSet = CorridorCalibration[];

/**
 * Parse an exit label into its numeric milepost part: "296", "296A", "22-B"
 * all yield the leading number. Returns null for blanks and non-numeric
 * labels — never guesses.
 */
export function parseExitNumber(raw: string | null | undefined): number | null {
  const m = String(raw ?? '')
    .trim()
    .match(/^(\d{1,3})\s*-?[A-Za-z]?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** Anchor-gap → confidence. Wide gaps hide curves; never better than medium. */
export function confidenceForGap(gapMiles: number): 'medium' | 'low' | null {
  if (gapMiles <= 10) return 'medium';
  if (gapMiles <= 30) return 'low';
  return null;
}

export type InterpolationFailure =
  | 'no-exit-number'
  | 'sequential-exit-state'
  | 'unknown-exit-numbering'
  | 'no-calibration'
  | 'too-few-anchors'
  | 'outside-anchor-range'
  | 'anchor-gap-too-large'
  | 'implausible-result';

export type InterpolationResult =
  | {
      ok: true;
      lat: number;
      lng: number;
      confidence: 'medium' | 'low';
      /** Milepost distance between the bracketing anchors. */
      gapMiles: number;
      /** Straight-line miles between the bracketing anchors (sanity metric). */
      anchorSpanMiles: number;
      lower: MilepostAnchor;
      upper: MilepostAnchor;
    }
  | { ok: false; reason: InterpolationFailure };

/** Normalize + index a calibration set for lookups. */
export function calibrationKey(interstate: string, state: string): string {
  return `${normalizeInterstate(interstate)}|${state.trim().toUpperCase()}`;
}

export function indexCalibrations(set: CalibrationSet): Map<string, CorridorCalibration> {
  const map = new Map<string, CorridorCalibration>();
  for (const cal of set) {
    const sorted = [...cal.anchors].sort((a, b) => a.milepost - b.milepost);
    map.set(calibrationKey(cal.interstate, cal.state), { ...cal, anchors: sorted });
  }
  return map;
}

/**
 * Interpolate a listing position from its corridor calibration. `exitNumber`
 * is the raw label from the listing ("296A"); mileposts equal to an anchor's
 * milepost return that anchor's position exactly.
 */
export function interpolateAlongCorridor(
  calibrations: Map<string, CorridorCalibration>,
  state: string | null | undefined,
  interstate: string | null | undefined,
  exitNumber: string | null | undefined,
): InterpolationResult {
  const st = (state ?? '').trim().toUpperCase();
  const milepost = parseExitNumber(exitNumber);
  if (milepost === null) return { ok: false, reason: 'no-exit-number' };
  const numbering = EXIT_NUMBERING[st];
  if (!numbering) return { ok: false, reason: 'unknown-exit-numbering' };
  if (numbering === 'sequential') return { ok: false, reason: 'sequential-exit-state' };
  const cal = calibrations.get(calibrationKey(interstate ?? '', st));
  if (!cal) return { ok: false, reason: 'no-calibration' };
  if (cal.anchors.length < 2) return { ok: false, reason: 'too-few-anchors' };

  const anchors = cal.anchors;

  // Exact exit match: a verified anchor AT this exit places the listing at
  // that exit regardless of how sparse the rest of the corridor is. Medium,
  // not high — same exit does not mean same driveway.
  const exact = anchors.find((a) => a.milepost === milepost);
  if (exact) {
    return {
      ok: true,
      lat: exact.lat,
      lng: exact.lng,
      confidence: 'medium',
      gapMiles: 0,
      anchorSpanMiles: 0,
      lower: exact,
      upper: exact,
    };
  }

  if (milepost < anchors[0].milepost || milepost > anchors[anchors.length - 1].milepost) {
    return { ok: false, reason: 'outside-anchor-range' };
  }
  let lower = anchors[0];
  let upper = anchors[anchors.length - 1];
  for (let i = 0; i < anchors.length - 1; i++) {
    if (anchors[i].milepost <= milepost && milepost <= anchors[i + 1].milepost) {
      lower = anchors[i];
      upper = anchors[i + 1];
      break;
    }
  }
  const gapMiles = upper.milepost - lower.milepost;
  const confidence = confidenceForGap(gapMiles);
  if (!confidence) return { ok: false, reason: 'anchor-gap-too-large' };

  const t = gapMiles === 0 ? 0 : (milepost - lower.milepost) / gapMiles;
  const lat = lower.lat + (upper.lat - lower.lat) * t;
  const lng = lower.lng + (upper.lng - lower.lng) * t;

  // Plausibility gates: the result must sit inside its state's framing bounds
  // (small tolerance for river-border stops) and its corridor bounds, and the
  // anchors themselves must not be wildly far apart for their milepost gap
  // (which would mean at least one anchor is bad).
  const p: LatLng = { lat, lng };
  const stateBounds = STATE_BOUNDS[st];
  const corridor = INTERSTATE_BOUNDS[normalizeInterstate(interstate)];
  const anchorSpanMiles = haversineMiles(
    { lat: lower.lat, lng: lower.lng },
    { lat: upper.lat, lng: upper.lng },
  );
  const spanPlausible = gapMiles === 0 || anchorSpanMiles <= gapMiles * 1.5 + 2;
  const insideState = !stateBounds || milesOutsideBounds(stateBounds, p) <= 5;
  const insideCorridor = !corridor || milesOutsideBounds(corridor, p) <= 5;
  if (!spanPlausible || !insideState || !insideCorridor) {
    return { ok: false, reason: 'implausible-result' };
  }

  return {
    ok: true,
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    confidence,
    gapMiles,
    anchorSpanMiles: Number(anchorSpanMiles.toFixed(1)),
    lower,
    upper,
  };
}
