/**
 * Census BATCH output parser + validator + calibration classifier.
 *
 * Parses the raw `addressbatch` CSV, cross-checks every returned row against
 * what was submitted, and reuses `classifyCensusResponse`
 * (`@/lib/directory/census-geocoder`) for the deterministic state / bounds /
 * coordinate rules — no rule is re-implemented here. It NEVER writes anywhere
 * and NEVER auto-approves: matched rows become `census-manual-review`, and the
 * only "pass" is a calibration control whose Census point lands within the
 * accuracy threshold of its already-verified coordinate.
 *
 * Census coordinates are TIGER address-range interpolations, NOT rooftop —
 * nothing here is ever labeled "rooftop verified".
 */
import { parseCsv } from '@/lib/directory/csv';
import { haversineMiles } from '@/lib/map/geo';
import {
  classifyCensusResponse,
  type CensusApiResponse,
  type CensusQuery,
} from '@/lib/directory/census-geocoder';

/** The only four review decisions this calibration emits. */
export type ReviewDecision =
  | 'census-calibration-pass'
  | 'census-manual-review'
  | 'census-rejected'
  | 'census-no-match';

const METERS_PER_MILE = 1609.344;
/** A control this close to its verified point counts as a calibration pass. */
export const PASS_THRESHOLD_METERS = 150;

/** One parsed row of the Census addressbatch output. */
export type CensusBatchRow = {
  id: string;
  inputAddress: string;
  matchStatus: string; // Match | No_Match | Tie
  matchType: string; // Exact | Non_Exact | ''
  matchedAddress: string;
  lon: number | null;
  lat: number | null;
};

/** One fully-evaluated record with every field the calibration must record. */
export type ReviewRecord = {
  id: string;
  submittedAddress: string;
  inputState: string;
  matchStatus: string;
  matchType: string;
  matchedAddress: string;
  returnedState: string;
  lon: number | null;
  lat: number | null;
  reviewDecision: ReviewDecision;
  rejectionReason: string | null;
  isControl: boolean;
  controlDistanceMeters: number | null;
  addressMismatch: boolean;
};

/**
 * Parse the raw addressbatch CSV. Columns (no header):
 *   id, input, matchStatus, matchType, matchedAddress, "lon,lat", tigerId, side
 * No_Match / Tie rows carry only the first three columns.
 */
export function parseCensusBatchOutput(text: string): CensusBatchRow[] {
  const grid = parseCsv(text);
  const rows: CensusBatchRow[] = [];
  for (const cells of grid) {
    if (cells.length === 0 || (cells.length === 1 && cells[0].trim() === '')) continue;
    const id = (cells[0] ?? '').trim();
    const inputAddress = cells[1] ?? '';
    const matchStatus = (cells[2] ?? '').trim();
    let lon: number | null = null;
    let lat: number | null = null;
    const coordCell = cells[5] ?? '';
    if (coordCell.includes(',')) {
      const [lonS, latS] = coordCell.split(',');
      const lonN = Number(lonS);
      const latN = Number(latS);
      lon = Number.isFinite(lonN) ? lonN : null;
      lat = Number.isFinite(latN) ? latN : null;
    }
    rows.push({
      id,
      inputAddress,
      matchStatus,
      matchType: (cells[3] ?? '').trim(),
      matchedAddress: (cells[4] ?? '').trim(),
      lon,
      lat,
    });
  }
  return rows;
}

/** Pull the 2-letter state out of a Census matched address ("…, CITY, ST, ZIP"). */
export function returnedStateOf(matchedAddress: string): string {
  const parts = matchedAddress.split(',').map((p) => p.trim());
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^[A-Z]{2}$/.test(parts[i])) return parts[i];
  }
  return '';
}

/** Leading house number of an address, or null when it has none. */
function houseNumber(addr: string): string | null {
  const m = addr.trim().match(/^(\d+)\b/);
  return m ? m[1] : null;
}

/**
 * Material address conflict: both the submitted street and the matched address
 * carry a house number and the numbers differ. Missing-on-either-side is not a
 * conflict (Census can normalize), but a different rooftop number is.
 */
export function materialAddressConflict(submittedStreet: string, matchedAddress: string): boolean {
  const a = houseNumber(submittedStreet);
  const b = houseNumber(matchedAddress);
  return a != null && b != null && a !== b;
}

/** Build the synthetic single-match response `classifyCensusResponse` consumes. */
function toApiResponse(row: CensusBatchRow): CensusApiResponse {
  if (row.matchStatus === 'No_Match') return { result: { addressMatches: [] } };
  if (row.matchStatus === 'Tie') {
    // Two empty candidates → classifyCensusResponse returns the 'tie' rejection.
    return { result: { addressMatches: [{}, {}] } };
  }
  return {
    result: {
      addressMatches: [
        {
          coordinates: { x: row.lon ?? undefined, y: row.lat ?? undefined },
          matchedAddress: row.matchedAddress,
          matchType: row.matchType,
          addressComponents: { state: returnedStateOf(row.matchedAddress) },
        },
      ],
    },
  };
}

export type ControlPoint = { lat: number; lng: number };

export type ValidateSummary = {
  total: number;
  buckets: Record<ReviewDecision, number>;
  rejectionsByReason: Record<string, number>;
  controls: {
    total: number;
    matched: number;
    unmatched: number;
    medianMeters: number | null;
    p75Meters: number | null;
    p90Meters: number | null;
    p95Meters: number | null;
    maxMeters: number | null;
    within150m: number;
    withinQuarterMile: number;
    withinHalfMile: number;
    withinMile: number;
    overMile: number;
    stateMismatch: number;
    addressMismatch: number;
  };
};

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

/**
 * Validate + classify a whole batch. `submitted` maps id → the exact query
 * that was sent (so we can cross-check identity and input state); `controls`
 * maps id → verified coordinate for the calibration controls.
 *
 * Deterministic: same inputs → same output, every time (no clock, no network).
 */
export function validateAndClassify(
  rows: CensusBatchRow[],
  submitted: Map<string, CensusQuery>,
  controls: Map<string, ControlPoint>,
): { records: ReviewRecord[]; summary: ValidateSummary } {
  const records: ReviewRecord[] = [];
  const seen = new Set<string>();
  const distances: number[] = [];
  let stateMismatch = 0;
  let addressMismatchCount = 0;

  for (const row of rows) {
    const query = submitted.get(row.id);
    const base: ReviewRecord = {
      id: row.id,
      submittedAddress: query
        ? `${query.address}, ${query.city}, ${query.state} ${query.zip}`.trim()
        : row.inputAddress,
      inputState: query?.state ?? '',
      matchStatus: row.matchStatus,
      matchType: row.matchType,
      matchedAddress: row.matchedAddress,
      returnedState: returnedStateOf(row.matchedAddress),
      lon: row.lon,
      lat: row.lat,
      reviewDecision: 'census-rejected',
      rejectionReason: null,
      isControl: controls.has(row.id),
      controlDistanceMeters: null,
      addressMismatch: false,
    };

    // Identity guards first.
    if (!query) {
      records.push({
        ...base,
        reviewDecision: 'census-rejected',
        rejectionReason: 'uuid-not-submitted',
      });
      continue;
    }
    if (seen.has(row.id)) {
      records.push({
        ...base,
        reviewDecision: 'census-rejected',
        rejectionReason: 'duplicate-output-id',
      });
      continue;
    }
    seen.add(row.id);

    if (row.matchStatus === 'No_Match') {
      records.push({ ...base, reviewDecision: 'census-no-match', rejectionReason: 'no-match' });
      continue;
    }

    // Reuse the ONE deterministic classifier for tie / coord / state / bounds.
    const classified = classifyCensusResponse(query, base.submittedAddress, toApiResponse(row));
    if (classified.status === 'rejected') {
      if (classified.rejection === 'wrong-state') stateMismatch++;
      records.push({
        ...base,
        reviewDecision: 'census-rejected',
        rejectionReason: classified.rejection ?? 'rejected',
      });
      continue;
    }

    // Matched (exact/approximate). Address conflict → quarantine to review.
    const conflict = materialAddressConflict(query.address, row.matchedAddress);
    if (conflict) addressMismatchCount++;

    const control = controls.get(row.id);
    let decision: ReviewDecision = 'census-manual-review';
    let distMeters: number | null = null;
    if (control && classified.lat != null && classified.lng != null) {
      distMeters =
        haversineMiles(
          { lat: control.lat, lng: control.lng },
          { lat: classified.lat, lng: classified.lng },
        ) * METERS_PER_MILE;
      distances.push(distMeters);
      // A control within threshold and with no address conflict passes.
      if (!conflict && distMeters <= PASS_THRESHOLD_METERS) decision = 'census-calibration-pass';
    }

    records.push({
      ...base,
      lon: classified.lng,
      lat: classified.lat,
      returnedState: returnedStateOf(row.matchedAddress),
      reviewDecision: decision,
      rejectionReason: null,
      controlDistanceMeters: distMeters,
      addressMismatch: conflict,
    });
  }

  const buckets: Record<ReviewDecision, number> = {
    'census-calibration-pass': 0,
    'census-manual-review': 0,
    'census-rejected': 0,
    'census-no-match': 0,
  };
  const rejectionsByReason: Record<string, number> = {};
  for (const r of records) {
    buckets[r.reviewDecision]++;
    if (r.rejectionReason)
      rejectionsByReason[r.rejectionReason] = (rejectionsByReason[r.rejectionReason] ?? 0) + 1;
  }
  const sorted = [...distances].sort((a, b) => a - b);
  const matchedControls = records.filter(
    (r) => r.isControl && r.controlDistanceMeters != null,
  ).length;

  return {
    records,
    summary: {
      total: records.length,
      buckets,
      rejectionsByReason,
      controls: {
        total: controls.size,
        matched: matchedControls,
        unmatched: controls.size - matchedControls,
        medianMeters: percentile(sorted, 50),
        p75Meters: percentile(sorted, 75),
        p90Meters: percentile(sorted, 90),
        p95Meters: percentile(sorted, 95),
        maxMeters: sorted.length ? sorted[sorted.length - 1] : null,
        within150m: sorted.filter((d) => d <= 150).length,
        withinQuarterMile: sorted.filter((d) => d <= 0.25 * METERS_PER_MILE).length,
        withinHalfMile: sorted.filter((d) => d <= 0.5 * METERS_PER_MILE).length,
        withinMile: sorted.filter((d) => d <= METERS_PER_MILE).length,
        overMile: sorted.filter((d) => d > METERS_PER_MILE).length,
        stateMismatch,
        addressMismatch: addressMismatchCount,
      },
    },
  };
}

/**
 * Submitted UUIDs that received NO output row at all (the service silently
 * dropped them). These must be surfaced — a batch is only trustworthy when
 * every submitted id is accounted for. Returns a sorted list.
 */
export function findMissingOutputs(
  rows: CensusBatchRow[],
  submitted: Map<string, CensusQuery>,
): string[] {
  const got = new Set(rows.map((r) => r.id));
  return [...submitted.keys()].filter((id) => !got.has(id)).sort();
}

/** Columns of the human coordinate-review sheet (one row per evaluated result). */
export const REVIEW_REPORT_HEADER = [
  'listing_id',
  'business_name',
  'input_address',
  'census_matched_address',
  'existing_coordinate',
  'proposed_coordinate',
  'distance_from_control_m',
  'state_bounds_result',
  'match_classification',
  'reviewer_decision',
  'reviewer_notes',
] as const;

/** RFC-4180 quote. */
function rq(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

/**
 * Build the human-review CSV rows (as arrays, header first). `listings` maps
 * id → display fields; `controls` gives the verified point for controls. The
 * `reviewer_decision` and `reviewer_notes` columns are intentionally blank —
 * a human fills them, and nothing here approves or writes anything.
 */
export function toReviewReportRows(
  records: ReviewRecord[],
  listings: Map<string, { name: string }>,
  controls: Map<string, ControlPoint>,
): string[][] {
  const out: string[][] = [REVIEW_REPORT_HEADER.map((h) => h)];
  for (const r of records) {
    const control = controls.get(r.id);
    const stateBounds =
      r.rejectionReason === 'wrong-state'
        ? 'out-of-state/bounds'
        : r.lat != null && r.lng != null
          ? 'in-state'
          : 'n/a';
    out.push([
      r.id,
      listings.get(r.id)?.name ?? '',
      r.submittedAddress,
      r.matchedAddress,
      control ? `${control.lat},${control.lng}` : '',
      r.lat != null && r.lng != null ? `${r.lat},${r.lng}` : '',
      r.controlDistanceMeters != null ? r.controlDistanceMeters.toFixed(1) : '',
      stateBounds,
      r.reviewDecision,
      '', // reviewer_decision — human fills
      '', // reviewer_notes — human fills
    ]);
  }
  return out;
}

/** Serialize review rows to CSV text. */
export function toReviewReportCsv(
  records: ReviewRecord[],
  listings: Map<string, { name: string }>,
  controls: Map<string, ControlPoint>,
): string {
  return (
    toReviewReportRows(records, listings, controls)
      .map((row) => row.map(rq).join(','))
      .join('\n') + '\n'
  );
}
