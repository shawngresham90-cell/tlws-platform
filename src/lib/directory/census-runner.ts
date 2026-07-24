/**
 * Census batch RUNNER (Phase 1 · Step 3) — the orchestration layer that turns
 * the directory snapshot into (a) a deterministic geocoding WORKLIST, (b) a
 * resumable results CHECKPOINT produced by the network fetch step, and (c) the
 * offline human-review PACKAGE for the admin geocoding console.
 *
 * Everything in this module is PURE (no fs, no network, no clock): the CLI
 * wrapper (scripts/census-runner.ts) owns files and the injected fetch. The
 * network step only ever exists behind the same `CensusFetch` seam the adapter
 * uses, so tests run fully offline, and the package step is a deterministic
 * function of (snapshot, checkpoint) — same inputs, same bytes.
 *
 * Safety: this module cannot write to any database. Review rows inherit the
 * adapter's contract — every row ships `action=manual-review`, so the admin
 * console's human gate remains mandatory before any coordinate applies.
 */
import {
  normalizeCensusAddress,
  censusResultsToReviewRows,
  type CensusQuery,
  type CensusRejection,
  type CensusResult,
} from './census-geocoder';
import { GEOCODING_COLUMNS } from './geocoding';
import { verifyListingCoordinate } from './coordinate-verification';
import { toCsv, safeCsvCell } from './csv';

export type RunnerSnapshotRow = {
  id: string;
  name: string;
  category_slug: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  interstate: string | null;
  exit_number: string | null;
  snapshot_taken_at?: string;
};

export type WorklistEntry = { query: CensusQuery; interstate: string };
export type IneligibleEntry = {
  id: string;
  name: string;
  city: string;
  state: string;
  reason: CensusRejection | 'already-has-coordinates' | 'no-city-or-state';
};

export type Worklist = {
  eligible: WorklistEntry[];
  ineligible: IneligibleEntry[];
};

/**
 * Deterministic worklist: every ACTIVE row missing coordinates whose address
 * passes the adapter's normalization gates, sorted by id. Rows the normalizer
 * would refuse (PO box / highway-only / blank) are listed as ineligible with
 * the exact reason so nothing silently disappears.
 */
export function buildWorklist(snapshot: RunnerSnapshotRow[]): Worklist {
  const eligible: WorklistEntry[] = [];
  const ineligible: IneligibleEntry[] = [];
  const sorted = [...snapshot].sort((a, b) => a.id.localeCompare(b.id));
  for (const r of sorted) {
    const base = {
      id: r.id,
      name: r.name,
      city: r.city ?? '',
      state: r.state ?? '',
    };
    if (r.lat != null && r.lng != null) {
      ineligible.push({ ...base, reason: 'already-has-coordinates' });
      continue;
    }
    if (!(r.city ?? '').trim() || !(r.state ?? '').trim()) {
      ineligible.push({ ...base, reason: 'no-city-or-state' });
      continue;
    }
    const query: CensusQuery = {
      id: r.id,
      address: r.address ?? '',
      city: r.city ?? '',
      state: r.state ?? '',
      zip: r.zip ?? '',
    };
    const norm = normalizeCensusAddress(query);
    if (!norm.line) {
      ineligible.push({ ...base, reason: norm.rejection ?? 'blank-address' });
      continue;
    }
    eligible.push({ query, interstate: r.interstate ?? '' });
  }
  return { eligible, ineligible };
}

/** The committed checkpoint: results keyed by listing id, written by `fetch`. */
export type Checkpoint = Record<string, CensusResult>;

/**
 * Merge newly fetched results into the checkpoint. Existing entries win —
 * a resume never refetches or overwrites, which keeps reruns deterministic
 * and the fetch step idempotent.
 */
export function mergeCheckpoint(existing: Checkpoint, fresh: CensusResult[]): Checkpoint {
  const out: Checkpoint = { ...existing };
  for (const r of fresh) {
    if (!(r.id in out)) out[r.id] = r;
  }
  return out;
}

/** Worklist entries not yet present in the checkpoint (the resume frontier). */
export function pendingQueries(worklist: Worklist, checkpoint: Checkpoint): CensusQuery[] {
  return worklist.eligible.filter((e) => !(e.query.id in checkpoint)).map((e) => e.query);
}

export type PackageSummary = {
  snapshotTakenAt: string;
  snapshotRows: number;
  snapshotWithCoords: number;
  worklist: {
    eligible: number;
    ineligible: number;
    ineligibleReasons: Record<string, number>;
  };
  checkpoint: {
    fetched: number;
    pending: number;
    matched: number;
    rejected: number;
    /** Checkpoint entries ignored because the listing has coords in this snapshot. */
    staleIgnored: number;
    rejectionReasons: Record<string, number>;
  };
  confidence: { high: number; medium: number };
  verificationFlags: number;
  coverage: {
    directoryTotal: number;
    withCoordsNow: number;
    pctNow: number;
    /** Actual: coords now + matched checkpoint rows (pending human review). */
    afterReviewingMatches: number;
    pctAfterReviewingMatches: number;
    /**
     * Estimate band for rows not yet fetched, based on U.S. Census national
     * street-address match rates (~70–85%). Estimates, clearly labelled —
     * replaced by actuals as the checkpoint fills.
     */
    projectedIfPendingMatches70to85pct: { low: number; high: number };
  };
  guarantees: string[];
};

export type ReviewPackage = {
  reviewCsv: string;
  unresolvedCsv: string;
  verificationCsv: string;
  summary: PackageSummary;
};

/**
 * Deterministic packaging: (snapshot, checkpoint) → review CSV in the admin
 * console's 15-column contract (every row `manual-review`), an unresolved CSV
 * with per-row rejection reasons, a plausibility cross-check CSV (proposed
 * coordinates run through the state/corridor verifier), and a machine-readable
 * summary with actual + clearly-labelled estimated coverage.
 */
export function buildReviewPackage(
  snapshot: RunnerSnapshotRow[],
  checkpoint: Checkpoint,
): ReviewPackage {
  const worklist = buildWorklist(snapshot);
  const byId = new Map(snapshot.map((r) => [r.id, r]));
  // Stale-checkpoint guard: a result whose listing has since gained coordinates
  // (or left the snapshot) must not re-enter the review queue or double-count
  // coverage when an old checkpoint is reused against a fresher snapshot.
  const allResults = Object.values(checkpoint);
  const results = allResults
    .filter((r) => {
      const l = byId.get(r.id);
      return !!l && (l.lat == null || l.lng == null);
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const staleIgnored = allResults.length - results.length;

  const matched = results.filter((r) => r.status !== 'rejected' && r.lat != null && r.lng != null);
  const rejectedResults = results.filter((r) => !matched.includes(r));

  // Review CSV — via the adapter's emitter so the console contract stays in
  // exactly one place. Every human-authored cell (name/address/city/state/zip)
  // passes through safeCsvCell per csv.ts's formula-injection rule.
  const listingMeta = new Map(
    snapshot.map((r) => [
      r.id,
      {
        name: safeCsvCell(r.name),
        categorySlug: r.category_slug ?? '',
        address: safeCsvCell(r.address ?? ''),
        city: safeCsvCell(r.city ?? ''),
        state: safeCsvCell(r.state ?? ''),
        zip: safeCsvCell(r.zip ?? ''),
        lat: r.lat,
        lng: r.lng,
      },
    ]),
  );
  const reviewRows = censusResultsToReviewRows(results, listingMeta);
  const reviewCsv = toCsv([[...GEOCODING_COLUMNS], ...reviewRows]);

  // Unresolved CSV — every fetched-but-unusable row, with the exact reason.
  const unresolvedCsv = toCsv([
    ['listing_id', 'business_name', 'city', 'state', 'rejection', 'match_type', 'submitted'],
    ...rejectedResults.map((r) => {
      const l = byId.get(r.id);
      return [
        r.id,
        safeCsvCell(l?.name ?? ''),
        safeCsvCell(l?.city ?? ''),
        safeCsvCell(l?.state ?? ''),
        r.rejection ?? 'no-match',
        r.matchType,
        // Begins with the raw listing address — guard it like any human cell.
        safeCsvCell(r.submittedAddress),
      ];
    }),
  ]);

  // Plausibility cross-check: run each PROPOSED coordinate through the
  // state/corridor verifier as if it were the listing's coordinate.
  const verifications = matched.map((r) => {
    const l = byId.get(r.id);
    return {
      id: r.id,
      v: verifyListingCoordinate({
        id: r.id,
        name: l?.name ?? '',
        city: l?.city ?? '',
        state: l?.state ?? '',
        interstate: l?.interstate ?? '',
        lat: r.lat,
        lng: r.lng,
      }),
    };
  });
  const flagged = verifications.filter((x) => x.v.severity !== 'ok');
  const verificationCsv = toCsv([
    [
      'listing_id',
      'proposed_latitude',
      'proposed_longitude',
      'severity',
      'findings',
      'miles_outside_state',
      'miles_outside_corridor',
    ],
    ...verifications.map(({ id, v }) => [
      id,
      v.lat ?? '',
      v.lng ?? '',
      v.severity,
      v.findings.join('; '),
      v.milesOutsideState,
      v.milesOutsideCorridor,
    ]),
  ]);

  const ineligibleReasons: Record<string, number> = {};
  for (const i of worklist.ineligible)
    ineligibleReasons[i.reason] = (ineligibleReasons[i.reason] ?? 0) + 1;
  const rejectionReasons: Record<string, number> = {};
  for (const r of rejectedResults) {
    const k = r.rejection ?? 'no-match';
    rejectionReasons[k] = (rejectionReasons[k] ?? 0) + 1;
  }

  const withCoordsNow = snapshot.filter((r) => r.lat != null && r.lng != null).length;
  const pending = pendingQueries(worklist, checkpoint).length;
  const pct = (n: number) => Number(((100 * n) / snapshot.length).toFixed(1));

  const summary: PackageSummary = {
    snapshotTakenAt: snapshot[0]?.snapshot_taken_at ?? 'unknown',
    snapshotRows: snapshot.length,
    snapshotWithCoords: withCoordsNow,
    worklist: {
      eligible: worklist.eligible.length,
      ineligible: worklist.ineligible.length,
      ineligibleReasons,
    },
    checkpoint: {
      fetched: results.length,
      pending,
      matched: matched.length,
      rejected: rejectedResults.length,
      staleIgnored,
      rejectionReasons,
    },
    confidence: {
      high: matched.filter((r) => r.confidence === 'high').length,
      medium: matched.filter((r) => r.confidence !== 'high').length,
    },
    verificationFlags: flagged.length,
    coverage: {
      directoryTotal: snapshot.length,
      withCoordsNow,
      pctNow: pct(withCoordsNow),
      afterReviewingMatches: withCoordsNow + matched.length,
      pctAfterReviewingMatches: pct(withCoordsNow + matched.length),
      projectedIfPendingMatches70to85pct: {
        low: pct(withCoordsNow + matched.length + Math.floor(pending * 0.7)),
        high: pct(withCoordsNow + matched.length + Math.floor(pending * 0.85)),
      },
    },
    guarantees: [
      'runner has no database client — it cannot read or write production',
      'network exists only in the fetch step behind the injected CensusFetch seam',
      'every review row is action=manual-review; applying requires the admin console',
      'package output is a pure function of (snapshot, checkpoint) — reproducible offline',
    ],
  };

  return { reviewCsv, unresolvedCsv, verificationCsv, summary };
}

/** Worklist CSVs for human eyes (the JSON worklist drives the fetch step). */
export function worklistCsvs(worklist: Worklist): { eligibleCsv: string; ineligibleCsv: string } {
  const eligibleCsv = toCsv([
    ['listing_id', 'address', 'city', 'state', 'zip', 'interstate'],
    ...worklist.eligible.map((e) => [
      e.query.id,
      safeCsvCell(e.query.address),
      safeCsvCell(e.query.city),
      safeCsvCell(e.query.state),
      safeCsvCell(e.query.zip),
      e.interstate,
    ]),
  ]);
  const ineligibleCsv = toCsv([
    ['listing_id', 'business_name', 'city', 'state', 'reason'],
    ...worklist.ineligible.map((i) => [
      i.id,
      safeCsvCell(i.name),
      safeCsvCell(i.city),
      safeCsvCell(i.state),
      i.reason,
    ]),
  ]);
  return { eligibleCsv, ineligibleCsv };
}
