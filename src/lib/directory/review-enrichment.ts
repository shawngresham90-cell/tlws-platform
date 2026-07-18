import type { ValidatedRow } from './geocoding';
import { verifyListingCoordinate } from './coordinate-verification';

/**
 * Review-screen enrichment (Phase 2B, Step 5). Pure derivations the admin
 * geocoding console shows alongside each candidate row: which METHOD
 * produced the proposal, how far it sits from the listing's expected
 * corridor, and consolidated warning flags. Nothing here changes
 * applicability — action + confidence remain the only gates.
 */

export type ProposalMethod =
  | 'verified-existing'
  | 'corridor-interpolation'
  | 'census-geocoder'
  | 'manual';

/** Method is derived from the batch row's own provenance notes. */
export function proposalMethod(row: ValidatedRow): ProposalMethod {
  const notes = row.verification_notes.toLowerCase();
  if (notes.startsWith('mile-marker interpolation')) return 'corridor-interpolation';
  // Only the adapter's own generated prefixes count — free-text notes that
  // merely mention "census" must not set external-api provenance.
  if (notes.startsWith('census exact match') || notes.startsWith('census approximate match')) {
    return 'census-geocoder';
  }
  if (
    row.proposed_latitude != null &&
    row.live?.lat != null &&
    row.proposed_latitude === row.live.lat &&
    row.proposed_longitude === row.live.lng
  ) {
    return 'verified-existing';
  }
  return 'manual';
}

/** Map provenance method → the locations.geocode_source enum value. */
export function geocodeSourceForMethod(method: ProposalMethod): string {
  switch (method) {
    case 'corridor-interpolation':
      return 'interpolation';
    case 'census-geocoder':
      return 'external-api';
    case 'verified-existing':
    case 'manual':
      return 'batch-csv';
  }
}

export type ReviewWarning =
  | 'would-overwrite'
  | 'far-from-corridor'
  | 'outside-state-bounds'
  | 'low-confidence'
  | 'concern-flagged'
  | 'possible-duplicate';

export type EnrichedReviewRow = {
  method: ProposalMethod;
  /** Miles the PROPOSED point sits outside the listing's corridor bounds. */
  corridorDistanceMiles: number | null;
  /** Miles the PROPOSED point sits outside the listing's state bounds. */
  stateDistanceMiles: number | null;
  warnings: ReviewWarning[];
};

/**
 * Enrich one validated row for display. `liveInterstate` comes from the live
 * listing ref (the CSV itself does not carry corridor columns).
 */
export function enrichReviewRow(
  row: ValidatedRow,
  liveInterstate: string | null | undefined,
): EnrichedReviewRow {
  const method = proposalMethod(row);
  let corridorDistanceMiles: number | null = null;
  let stateDistanceMiles: number | null = null;
  const warnings: ReviewWarning[] = [];

  if (row.proposed_latitude != null && row.proposed_longitude != null) {
    const v = verifyListingCoordinate({
      id: row.listing_id,
      name: row.business_name,
      city: row.city,
      state: row.state,
      interstate: liveInterstate ?? '',
      lat: row.proposed_latitude,
      lng: row.proposed_longitude,
    });
    corridorDistanceMiles = v.milesOutsideCorridor;
    stateDistanceMiles = v.milesOutsideState;
    if (v.milesOutsideCorridor > 5) warnings.push('far-from-corridor');
    if (v.milesOutsideState > 0) warnings.push('outside-state-bounds');
  }

  if (row.wouldOverwrite) warnings.push('would-overwrite');
  if (row.confidence === 'low' || row.confidence === 'unresolved') warnings.push('low-confidence');
  if (row.evidence.concernFlag) warnings.push('concern-flagged');
  if (
    /near-duplicate|within .* of listing/i.test(row.verification_notes + row.evidence.reviewerNotes)
  ) {
    warnings.push('possible-duplicate');
  }
  return { method, corridorDistanceMiles, stateDistanceMiles, warnings };
}

/**
 * Stale-review check (server-side, at apply time): the reviewer approved
 * against the CSV's current_* coordinates; if the LIVE row's coordinates
 * have since changed, the approval no longer applies. Exact-epsilon compare
 * — coordinates are stored, not computed.
 */
export function isStaleReview(
  csvCurrentLat: number | null,
  csvCurrentLng: number | null,
  liveLat: number | null | undefined,
  liveLng: number | null | undefined,
): boolean {
  const eq = (a: number | null | undefined, b: number | null | undefined) => {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return Math.abs(a - b) < 1e-6;
  };
  return !(eq(csvCurrentLat, liveLat) && eq(csvCurrentLng, liveLng));
}
