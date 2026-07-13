import {
  STATE_BOUNDS,
  INTERSTATE_BOUNDS,
  boundsContain,
  type LatLngBounds,
  type LatLng,
} from '@/lib/map/bounds';
import { coordinateIssues, haversineMiles, type CoordinateIssue } from '@/lib/map/geo';
import { toCsv } from './csv';

/**
 * Coordinate verification (pure): cross-checks a coordinate pair against the
 * listing's OWN metadata — its state's framing bounds and, when known, its
 * interstate corridor bounds. Catches the most common real geocoding error
 * classes (wrong state, transposed/negated lat-lng, corridor outliers) that
 * the US-wide `coordinateIssues` gate cannot see.
 *
 * IMPORTANT: state/corridor bounds are coarse framing rectangles, not legal
 * boundaries, so a bounds miss is a TRIAGE FLAG ("suspect"), never proof of
 * error. Distances-outside-bounds are reported so reviewers can tell a
 * 2-mile technicality from a 300-mile wrong-state geocode. Read-only: this
 * module never writes coordinates anywhere.
 */

export type VerificationFinding =
  | CoordinateIssue
  | 'outside-state-bounds'
  | 'outside-interstate-corridor'
  | 'state-unknown'
  | 'no-coordinates';

export type VerificationSeverity = 'ok' | 'suspect' | 'invalid' | 'no-coordinates';

export type VerifiableListing = {
  id?: string;
  name?: string;
  city?: string;
  /** Two-letter state abbreviation, e.g. "TN". */
  state?: string | null;
  interstate?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type VerificationResult = {
  id: string;
  name: string;
  city: string;
  state: string;
  interstate: string;
  lat: number | null;
  lng: number | null;
  severity: VerificationSeverity;
  findings: VerificationFinding[];
  /** Miles outside the state's framing bounds (0 when inside / unknown). */
  milesOutsideState: number;
  /** Miles outside the interstate's corridor bounds (0 when inside / unknown). */
  milesOutsideCorridor: number;
};

/**
 * Shortest straight-line distance (miles) from a point to a bounds rectangle
 * (0 when the point is inside). Uses the nearest point on the rectangle, so
 * it is exact for the equirectangular boxes we frame states with.
 */
export function milesOutsideBounds(b: LatLngBounds, p: LatLng): number {
  if (boundsContain(b, p)) return 0;
  const nearest: LatLng = {
    lat: Math.min(b.north, Math.max(b.south, p.lat)),
    lng: Math.min(b.east, Math.max(b.west, p.lng)),
  };
  return haversineMiles(p, nearest);
}

/** Normalize an interstate label to the INTERSTATE_BOUNDS key form ("I-75"). */
export function normalizeInterstate(raw: string | null | undefined): string {
  const m = String(raw ?? '')
    .toUpperCase()
    .match(/I[\s-]*(\d{1,3})/);
  return m ? `I-${m[1]}` : '';
}

/**
 * Verify one listing's coordinates against its own metadata. Severity:
 * - 'no-coordinates' — nothing to verify (not an error; most rows pre-geocode)
 * - 'invalid'  — fails the hard `coordinateIssues` gate (never plausible)
 * - 'suspect'  — valid US point but outside the listing's state bounds, or
 *                far outside its interstate corridor (triage for review)
 * - 'ok'       — inside every applicable box
 */
export function verifyListingCoordinate(l: VerifiableListing): VerificationResult {
  const state = (l.state ?? '').trim().toUpperCase();
  const interstate = normalizeInterstate(l.interstate);
  const base = {
    id: l.id ?? '',
    name: l.name ?? '',
    city: l.city ?? '',
    state,
    interstate,
    lat: l.lat ?? null,
    lng: l.lng ?? null,
    milesOutsideState: 0,
    milesOutsideCorridor: 0,
  };
  if (l.lat == null || l.lng == null) {
    return { ...base, severity: 'no-coordinates', findings: ['no-coordinates'] };
  }
  const hard = coordinateIssues(l.lat, l.lng);
  if (hard.length > 0) {
    return { ...base, severity: 'invalid', findings: hard };
  }
  const findings: VerificationFinding[] = [];
  const p: LatLng = { lat: l.lat, lng: l.lng };
  let milesOutsideState = 0;
  let milesOutsideCorridor = 0;
  const stateBounds = state ? STATE_BOUNDS[state] : undefined;
  if (!stateBounds) {
    findings.push('state-unknown');
  } else {
    milesOutsideState = milesOutsideBounds(stateBounds, p);
    if (milesOutsideState > 0) findings.push('outside-state-bounds');
  }
  const corridorBounds = interstate ? INTERSTATE_BOUNDS[interstate] : undefined;
  if (corridorBounds) {
    milesOutsideCorridor = milesOutsideBounds(corridorBounds, p);
    if (milesOutsideCorridor > 0) findings.push('outside-interstate-corridor');
  }
  const suspect = findings.includes('outside-state-bounds') || findings.includes('outside-interstate-corridor');
  return {
    ...base,
    severity: suspect ? 'suspect' : 'ok',
    findings,
    milesOutsideState: Number(milesOutsideState.toFixed(1)),
    milesOutsideCorridor: Number(milesOutsideCorridor.toFixed(1)),
  };
}

export type VerificationSummary = {
  total: number;
  ok: number;
  suspect: number;
  invalid: number;
  noCoordinates: number;
  /** States seen that have no STATE_BOUNDS entry (coverage gaps to fix). */
  statesWithoutBounds: string[];
};

/** Verify a whole export/snapshot. Input order is preserved in `results`. */
export function verifyCoordinateBatch(listings: VerifiableListing[]): {
  results: VerificationResult[];
  summary: VerificationSummary;
} {
  const results = listings.map(verifyListingCoordinate);
  const missing = new Set<string>();
  for (const r of results) {
    if (r.findings.includes('state-unknown') && r.state) missing.add(r.state);
  }
  return {
    results,
    summary: {
      total: results.length,
      ok: results.filter((r) => r.severity === 'ok').length,
      suspect: results.filter((r) => r.severity === 'suspect').length,
      invalid: results.filter((r) => r.severity === 'invalid').length,
      noCoordinates: results.filter((r) => r.severity === 'no-coordinates').length,
      statesWithoutBounds: [...missing].sort(),
    },
  };
}

/** Reviewer CSV of every non-ok row (worst first), for the geocoding console. */
export function verificationReportCsv(results: VerificationResult[]): string {
  const order: Record<VerificationSeverity, number> = {
    invalid: 0,
    suspect: 1,
    'no-coordinates': 2,
    ok: 3,
  };
  const rows = results
    .filter((r) => r.severity !== 'ok')
    .sort(
      (a, b) =>
        order[a.severity] - order[b.severity] ||
        b.milesOutsideState - a.milesOutsideState ||
        a.name.localeCompare(b.name),
    )
    .map((r) => [
      r.id,
      r.name,
      r.city,
      r.state,
      r.interstate,
      r.lat,
      r.lng,
      r.severity,
      r.findings.join('; '),
      r.milesOutsideState || '',
      r.milesOutsideCorridor || '',
    ]);
  return toCsv([
    ['listing_id', 'business_name', 'city', 'state', 'interstate', 'lat', 'lng', 'severity', 'findings', 'miles_outside_state', 'miles_outside_corridor'],
    ...rows,
  ]);
}
