/**
 * Corridor interpolation EXPANSION (Phase 1 · Step 4) — turn the Census
 * checkpoint into corridor calibration anchors and interpolate the rows the
 * Census could NOT match.
 *
 * Everything here is PURE (no fs, no network, no clock, no database): inputs
 * are the committed snapshot, the committed Census checkpoint, and pre-parsed
 * batch-CSV anchors; outputs are report objects and CSV text. The CLI wrapper
 * (scripts/corridor-review-package.ts) owns files.
 *
 * Honesty rules, by construction:
 * - Census-derived anchors are labeled `census-pending-approval` — they come
 *   from Census matches a human has NOT yet approved in the admin console.
 *   Every candidate whose bracketing anchors include one is partitioned into
 *   a separate "after-census" CSV that must not be applied (and must be
 *   REGENERATED from a fresh snapshot) until those approvals land.
 * - Rows the Census DID match are never interpolation candidates — their
 *   coordinates arrive via the Census review package. Where corridor math can
 *   independently place one anyway (without using the row's own anchor), the
 *   two proposals are compared in a cross-validation report instead.
 * - Confidence stays capped at 'medium' and action is always 'manual-review';
 *   the only path to the database remains the admin console's human gate.
 */
import {
  buildCalibrations,
  type AnchorSourceRow,
  type CalibrationBuildResult,
} from './calibration';
import {
  runGeocodePipeline,
  dryRunCandidatesCsv,
  interpolationFailureLabel,
  type ClassifiedRow,
  type PipelineListing,
  type PipelineReport,
} from './geocode-pipeline';
import { resolveCorridor } from './concurrency';
import { parseCsv, toCsv, safeCsvCell } from './csv';
import { haversineMiles } from '@/lib/map/geo';
import type { Checkpoint, RunnerSnapshotRow } from './census-runner';

export const CENSUS_ANCHOR_SOURCE = 'census-pending-approval';

/** A checkpoint entry that proposes coordinates (not rejected, has a point). */
export function isCensusMatch(checkpoint: Checkpoint, id: string): boolean {
  const r = checkpoint[id];
  return !!r && r.status !== 'rejected' && r.lat != null && r.lng != null;
}

export type AnchorAssembly = {
  rows: AnchorSourceRow[];
  counts: { directory: number; batch: number; censusPending: number };
};

/**
 * Assemble anchor source rows with strict precedence — an applied directory
 * coordinate always wins over a batch-CSV proposal, which wins over an
 * unapproved Census match. One row per listing.
 */
export function assembleAnchorRows(
  snapshot: RunnerSnapshotRow[],
  checkpoint: Checkpoint,
  batchAnchors: AnchorSourceRow[],
): AnchorAssembly {
  const rows: AnchorSourceRow[] = [];
  const used = new Set<string>();
  const counts = { directory: 0, batch: 0, censusPending: 0 };

  const sorted = [...snapshot].sort((a, b) => a.id.localeCompare(b.id));

  // 1. Applied directory coordinates — the strongest anchors.
  for (const r of sorted) {
    if (r.lat == null || r.lng == null) continue;
    rows.push({
      listingId: r.id,
      state: r.state ?? '',
      interstate: r.interstate ?? '',
      exitNumber: r.exit_number ?? '',
      lat: r.lat,
      lng: r.lng,
      source: 'directory-verified',
    });
    used.add(r.id);
    counts.directory++;
  }

  // 2. Human-researched batch-CSV proposals (high/medium), parsed by the CLI.
  for (const a of [...batchAnchors].sort((x, y) => x.listingId.localeCompare(y.listingId))) {
    if (used.has(a.listingId)) continue;
    rows.push(a);
    used.add(a.listingId);
    counts.batch++;
  }

  // 3. Unapproved Census matches on rows that still lack coordinates but carry
  //    corridor metadata (interstate + exit). Explicit provenance label.
  const byId = new Map(snapshot.map((r) => [r.id, r]));
  for (const [id, result] of Object.entries(checkpoint).sort(([a], [b]) => a.localeCompare(b))) {
    if (used.has(id)) continue;
    if (!isCensusMatch(checkpoint, id)) continue;
    const ref = byId.get(id);
    if (!ref || ref.lat != null || ref.lng != null) continue; // stale entry
    if (!(ref.interstate ?? '').trim() || !(ref.exit_number ?? '').trim()) continue;
    rows.push({
      listingId: id,
      state: ref.state ?? '',
      interstate: ref.interstate ?? '',
      exitNumber: ref.exit_number ?? '',
      lat: result.lat as number,
      lng: result.lng as number,
      source: CENSUS_ANCHOR_SOURCE,
    });
    used.add(id);
    counts.censusPending++;
  }

  return { rows, counts };
}

export type AnchorDependency = 'verified-only' | 'census-dependent';

/** Which anchor tier a candidate's bracketing anchors require. */
export function candidateDependency(row: ClassifiedRow): AnchorDependency {
  const i = row.interpolation;
  if (!i || !i.ok) return 'verified-only';
  const uses = (s: string) => s.includes(CENSUS_ANCHOR_SOURCE);
  return uses(i.lower.source) || uses(i.upper.source) ? 'census-dependent' : 'verified-only';
}

export type CrossCheck = {
  id: string;
  name: string;
  state: string;
  corridor: string;
  exitNumber: string;
  censusLat: number;
  censusLng: number;
  interpolatedLat: number;
  interpolatedLng: number;
  milesApart: number;
  /** ≤ 2 mi straight-line. What that MEANS depends on `basis`. */
  agrees: boolean;
  /**
   * 'verified-anchors': the interpolation used only verified anchors —
   * genuinely independent corroboration of the Census point.
   * 'census-internal': at least one bracketing anchor is itself an unapproved
   * Census match — this only measures the checkpoint's INTERNAL consistency
   * (adjacent Census results agreeing with each other), NOT independent proof.
   */
  basis: 'verified-anchors' | 'census-internal';
};

export type CorridorExpansion = {
  generatedAt: string;
  anchors: AnchorAssembly;
  calibration: CalibrationBuildResult;
  report: PipelineReport;
  /** Interpolation candidates: rows missing coords with NO Census match. */
  candidates: ClassifiedRow[];
  candidatesVerifiedOnly: ClassifiedRow[];
  candidatesCensusDependent: ClassifiedRow[];
  /** Census-matched rows independently corroborated (or not) by corridor math. */
  crossChecks: CrossCheck[];
  /** Census-matched rows whose only interpolation path was their own anchor. */
  crossCheckSelfAnchored: number;
  /** Census-matched rows corridor math could not place at all. */
  crossCheckNoInterpolation: number;
  /** Missing-coord non-Census rows with no candidate, with reasons. */
  rejected: { row: ClassifiedRow; reason: string }[];
  summary: CorridorExpansionSummary;
  csv: {
    reviewNowCsv: string;
    afterCensusCsv: string;
    crossValidationCsv: string;
    rejectedCsv: string;
  };
};

export type CorridorExpansionSummary = {
  generatedAt: string;
  snapshotRows: number;
  withCoordsNow: number;
  missingCoords: number;
  censusMatched: number;
  anchors: {
    sourceRows: number;
    directory: number;
    batch: number;
    censusPending: number;
    corridors: number;
    rejectedBySanity: number;
  };
  candidates: {
    total: number;
    verifiedOnly: number;
    censusDependent: number;
    medium: number;
    low: number;
    nearDuplicateFlags: number;
    /** Exact-exit candidates whose proposed point IS another listing's anchor. */
    coLocatedOnAnotherListingsAnchor: number;
    /** Groups of 2+ candidates sharing an identical proposed point. */
    sharedProposedPointGroups: number;
    byCorridor: Record<string, number>;
  };
  crossValidation: {
    compared: number;
    agreeWithin2mi: number;
    disagree: number;
    /** Interpolation used verified anchors only — independent corroboration. */
    verifiedBasis: { compared: number; agree: number };
    /** Interpolation leaned on unapproved Census anchors — internal consistency only. */
    censusInternalBasis: { compared: number; agree: number };
    selfAnchored: number;
    noInterpolation: number;
  };
  rejected: { total: number; byReason: Record<string, number> };
  reconciliation: {
    formula: 'missingCoords = censusMatched + reviewNowCsvRows + afterCensusCsvRows + rejectedCsvRows';
    /** Recounted from the EMITTED CSVs, not the in-memory partition. */
    holds: boolean;
  };
  coverage: {
    directoryTotal: number;
    now: number;
    pctNow: number;
    afterCensusApprovals: number;
    pctAfterCensusApprovals: number;
    afterCensusPlusInterpolation: number;
    pctAfterCensusPlusInterpolation: number;
  };
};

const pct = (n: number, total: number) => Number(((100 * n) / total).toFixed(1));

/** Canonical corridor label ("I-75 GA") a row's exit actually belongs to. */
function corridorLabel(l: PipelineListing): string {
  const resolved = resolveCorridor(l.state, l.interstate, l.exitNumber);
  return `${resolved.canonical} ${(l.state ?? '').trim().toUpperCase()}`.trim();
}

export function buildCorridorExpansion(
  snapshot: RunnerSnapshotRow[],
  checkpoint: Checkpoint,
  batchAnchors: AnchorSourceRow[],
): CorridorExpansion {
  const generatedAt = snapshot[0]?.snapshot_taken_at ?? 'unknown';
  const anchors = assembleAnchorRows(snapshot, checkpoint, batchAnchors);
  const calibration = buildCalibrations(anchors.rows);

  const listings: PipelineListing[] = [...snapshot]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => ({
      id: r.id,
      name: r.name,
      categorySlug: r.category_slug ?? '',
      address: r.address ?? '',
      city: r.city ?? '',
      state: r.state ?? '',
      zip: r.zip ?? '',
      lat: r.lat,
      lng: r.lng,
      interstate: r.interstate ?? '',
      exitNumber: r.exit_number ?? '',
    }));
  const report = runGeocodePipeline(listings, calibration.calibrations, { generatedAt });

  const missing = report.rows.filter((r) => r.listing.lat == null || r.listing.lng == null);
  const censusMatchedRows = missing.filter((r) => isCensusMatch(checkpoint, r.listing.id));
  const nonCensus = missing.filter((r) => !isCensusMatch(checkpoint, r.listing.id));

  const candidates = nonCensus.filter((r) => r.klass === 'interpolated' && r.proposed);
  const candidatesVerifiedOnly = candidates.filter(
    (r) => candidateDependency(r) === 'verified-only',
  );
  const candidatesCensusDependent = candidates.filter(
    (r) => candidateDependency(r) === 'census-dependent',
  );

  // Cross-validation: a Census-matched row that corridor math can place WITHOUT
  // using the row's own anchor gives two proposals to compare. A row whose
  // bracketing anchors include itself proves nothing (circular). What a
  // comparison MEANS depends on its anchors: verified anchors → independent
  // corroboration; census anchors → internal consistency of the checkpoint
  // only (adjacent Census results agreeing with each other).
  const usesCensusAnchor = (lower: { source: string }, upper: { source: string }) =>
    lower.source.includes(CENSUS_ANCHOR_SOURCE) || upper.source.includes(CENSUS_ANCHOR_SOURCE);
  const crossChecks: CrossCheck[] = [];
  let crossCheckSelfAnchored = 0;
  let crossCheckNoInterpolation = 0;
  for (const r of censusMatchedRows) {
    const i = r.interpolation;
    if (!i || !i.ok) {
      crossCheckNoInterpolation++;
      continue;
    }
    if (i.lower.listingId === r.listing.id || i.upper.listingId === r.listing.id) {
      crossCheckSelfAnchored++;
      continue;
    }
    const c = checkpoint[r.listing.id];
    const milesApart = haversineMiles(
      { lat: c.lat as number, lng: c.lng as number },
      { lat: i.lat, lng: i.lng },
    );
    crossChecks.push({
      id: r.listing.id,
      name: r.listing.name,
      state: (r.listing.state ?? '').trim().toUpperCase(),
      corridor: corridorLabel(r.listing),
      exitNumber: r.listing.exitNumber,
      censusLat: c.lat as number,
      censusLng: c.lng as number,
      interpolatedLat: i.lat,
      interpolatedLng: i.lng,
      milesApart: Number(milesApart.toFixed(2)),
      agrees: milesApart <= 2,
      basis: usesCensusAnchor(i.lower, i.upper) ? 'census-internal' : 'verified-anchors',
    });
  }

  // Co-location: an exact-exit candidate (gap 0) proposes the anchor's OWN
  // point — when that anchor belongs to a DIFFERENT listing, two businesses
  // would end up with identical coordinates. Same exit ≠ same driveway, so
  // every such row (and every group of candidates sharing one proposed point)
  // is flagged for the reviewer instead of silently stacking pins.
  const coLocatedWith = new Map<string, string>();
  for (const r of candidates) {
    const i = r.interpolation;
    if (i && i.ok && i.gapMiles === 0 && i.lower.listingId && i.lower.listingId !== r.listing.id) {
      coLocatedWith.set(r.listing.id, i.lower.listingId);
    }
  }
  const byPoint = new Map<string, string[]>();
  for (const r of candidates) {
    const key = `${r.proposed!.lat.toFixed(6)},${r.proposed!.lng.toFixed(6)}`;
    byPoint.set(key, [...(byPoint.get(key) ?? []), r.listing.id]);
  }
  const sharedPointGroups = [...byPoint.values()].filter((ids) => ids.length > 1);
  const sharedPointPeers = new Map<string, string[]>();
  for (const ids of sharedPointGroups)
    for (const id of ids) sharedPointPeers.set(id, ids.filter((x) => x !== id));

  const rejectionReason = (r: ClassifiedRow): string => {
    if (r.klass === 'unresolved') return 'no exit path and no street address';
    if (r.interpolation && !r.interpolation.ok) {
      const label = interpolationFailureLabel(r.interpolation.reason);
      if (r.klass !== 'needs-external-geocode') return label;
      const cp = checkpoint[r.listing.id];
      const censusNote =
        cp && cp.status === 'rejected'
          ? 'Census rejected this address'
          : 'address not Census-matched (ineligible or not yet fetched)';
      return `${label}; has street address (${censusNote})`;
    }
    return r.klass;
  };
  const rejected = nonCensus
    .filter((r) => !(r.klass === 'interpolated' && r.proposed))
    .map((row) => ({ row, reason: rejectionReason(row) }));

  /* ------------------------------------------------------------- CSVs */
  // The admin-console contract CSV for ALL interpolated rows, then filtered by
  // candidate id and re-emitted with a formula-injection guard on the
  // human-authored cells plus an anchor_provenance evidence column.
  const full = parseCsv(dryRunCandidatesCsv(report));
  const header = [...full[0], 'anchor_provenance'];
  const GUARDED = new Set([1, 3, 4, 5, 6]); // business_name, address, city, state, zip
  const REVIEWER_NOTES_COL = 16;
  const provenance = new Map<string, string>();
  for (const r of candidates) {
    const i = r.interpolation;
    if (i && i.ok) {
      provenance.set(
        r.listing.id,
        i.lower === i.upper
          ? `exact-exit anchor: ${i.lower.source}`
          : `lower: ${i.lower.source}; upper: ${i.upper.source}`,
      );
    }
  }
  const reviewerFlags = (id: string): string[] => {
    const flags: string[] = [];
    const co = coLocatedWith.get(id);
    if (co) flags.push(`CO-LOCATED: identical point to pending anchor of listing ${co} — confirm distinct businesses at this exit`);
    const peers = sharedPointPeers.get(id);
    if (peers) flags.push(`shares proposed point with candidate(s) ${peers.join(', ')}`);
    return flags;
  };
  const emit = (ids: Set<string>): string =>
    toCsv([
      header,
      ...full
        .slice(1)
        .filter((cells) => ids.has(cells[0]))
        .map((cells) => [
          ...cells.map((c, idx) => {
            if (idx === REVIEWER_NOTES_COL) {
              const flags = reviewerFlags(cells[0]);
              return flags.length ? [c, ...flags].filter(Boolean).join('; ') : c;
            }
            return GUARDED.has(idx) ? safeCsvCell(c) : c;
          }),
          provenance.get(cells[0]) ?? '',
        ]),
    ]);
  const reviewNowCsv = emit(new Set(candidatesVerifiedOnly.map((r) => r.listing.id)));
  const afterCensusCsv = emit(new Set(candidatesCensusDependent.map((r) => r.listing.id)));

  const crossValidationCsv = toCsv([
    [
      'listing_id',
      'business_name',
      'state',
      'corridor',
      'exit_number',
      'census_lat',
      'census_lng',
      'interpolated_lat',
      'interpolated_lng',
      'miles_apart',
      'agrees_within_2mi',
      'comparison_basis',
    ],
    ...crossChecks.map((c) => [
      c.id,
      safeCsvCell(c.name),
      safeCsvCell(c.state),
      c.corridor,
      safeCsvCell(c.exitNumber),
      c.censusLat.toFixed(6),
      c.censusLng.toFixed(6),
      c.interpolatedLat.toFixed(6),
      c.interpolatedLng.toFixed(6),
      c.milesApart.toFixed(2),
      c.agrees ? 'yes' : 'NO — investigate',
      c.basis === 'verified-anchors'
        ? 'verified-anchors (independent corroboration)'
        : 'census-internal (checkpoint consistency only)',
    ]),
  ]);

  const rejectedCsv = toCsv([
    [
      'listing_id',
      'business_name',
      'category',
      'city',
      'state',
      'interstate',
      'exit_number',
      'classification',
      'reason',
    ],
    ...rejected.map(({ row, reason }) => [
      row.listing.id,
      safeCsvCell(row.listing.name),
      safeCsvCell(row.listing.categorySlug),
      safeCsvCell(row.listing.city),
      safeCsvCell(row.listing.state),
      safeCsvCell(row.listing.interstate),
      safeCsvCell(row.listing.exitNumber),
      row.klass,
      reason,
    ]),
  ]);

  /* ---------------------------------------------------------- summary */
  const total = snapshot.length;
  const withCoordsNow = total - missing.length;
  const byCorridor: Record<string, number> = {};
  for (const r of candidates) {
    const k = corridorLabel(r.listing);
    byCorridor[k] = (byCorridor[k] ?? 0) + 1;
  }
  const byReason: Record<string, number> = {};
  for (const { reason } of rejected) byReason[reason] = (byReason[reason] ?? 0) + 1;

  const afterCensus = withCoordsNow + censusMatchedRows.length;
  const afterBoth = afterCensus + candidates.length;
  const summary: CorridorExpansionSummary = {
    generatedAt,
    snapshotRows: total,
    withCoordsNow,
    missingCoords: missing.length,
    censusMatched: censusMatchedRows.length,
    anchors: {
      sourceRows: anchors.rows.length,
      directory: anchors.counts.directory,
      batch: anchors.counts.batch,
      censusPending: anchors.counts.censusPending,
      corridors: calibration.calibrations.length,
      rejectedBySanity: calibration.rejected.length,
    },
    candidates: {
      total: candidates.length,
      verifiedOnly: candidatesVerifiedOnly.length,
      censusDependent: candidatesCensusDependent.length,
      medium: candidates.filter((r) => r.proposed!.confidence === 'medium').length,
      low: candidates.filter((r) => r.proposed!.confidence === 'low').length,
      nearDuplicateFlags: candidates.filter((r) => r.nearListingId).length,
      coLocatedOnAnotherListingsAnchor: coLocatedWith.size,
      sharedProposedPointGroups: sharedPointGroups.length,
      byCorridor: Object.fromEntries(Object.entries(byCorridor).sort((a, b) => b[1] - a[1])),
    },
    crossValidation: {
      compared: crossChecks.length,
      agreeWithin2mi: crossChecks.filter((c) => c.agrees).length,
      disagree: crossChecks.filter((c) => !c.agrees).length,
      verifiedBasis: {
        compared: crossChecks.filter((c) => c.basis === 'verified-anchors').length,
        agree: crossChecks.filter((c) => c.basis === 'verified-anchors' && c.agrees).length,
      },
      censusInternalBasis: {
        compared: crossChecks.filter((c) => c.basis === 'census-internal').length,
        agree: crossChecks.filter((c) => c.basis === 'census-internal' && c.agrees).length,
      },
      selfAnchored: crossCheckSelfAnchored,
      noInterpolation: crossCheckNoInterpolation,
    },
    rejected: {
      total: rejected.length,
      byReason: Object.fromEntries(Object.entries(byReason).sort((a, b) => b[1] - a[1])),
    },
    reconciliation: {
      formula:
        'missingCoords = censusMatched + reviewNowCsvRows + afterCensusCsvRows + rejectedCsvRows',
      // Recounted from the EMITTED CSV text (an independent data path), so a
      // partition or serialization bug actually fails this — unlike recounting
      // the same in-memory arrays the CSVs were built from.
      holds:
        missing.length ===
        censusMatchedRows.length +
          (parseCsv(reviewNowCsv).length - 1) +
          (parseCsv(afterCensusCsv).length - 1) +
          (parseCsv(rejectedCsv).length - 1),
    },
    coverage: {
      directoryTotal: total,
      now: withCoordsNow,
      pctNow: pct(withCoordsNow, total),
      afterCensusApprovals: afterCensus,
      pctAfterCensusApprovals: pct(afterCensus, total),
      afterCensusPlusInterpolation: afterBoth,
      pctAfterCensusPlusInterpolation: pct(afterBoth, total),
    },
  };

  return {
    generatedAt,
    anchors,
    calibration,
    report,
    candidates,
    candidatesVerifiedOnly,
    candidatesCensusDependent,
    crossChecks,
    crossCheckSelfAnchored,
    crossCheckNoInterpolation,
    rejected,
    summary,
    csv: { reviewNowCsv, afterCensusCsv, crossValidationCsv, rejectedCsv },
  };
}
