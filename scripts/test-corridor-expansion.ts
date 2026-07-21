/**
 * Offline tests for the corridor interpolation expansion lib (P1·S4).
 * NO network, NO database, NO clock — a synthetic I-75 GA fixture exercises
 * anchor precedence, the census-pending partition, cross-validation, the
 * rejection ledger, reconciliation, and CSV safety. Run:
 *
 *   npx esbuild scripts/test-corridor-expansion.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-corridor-expansion.cjs && node /tmp/test-corridor-expansion.cjs
 */
import {
  assembleAnchorRows,
  buildCorridorExpansion,
  candidateDependency,
  CENSUS_ANCHOR_SOURCE,
} from '@/lib/directory/corridor-expansion';
import type { AnchorSourceRow } from '@/lib/directory/calibration';
import type { Checkpoint, RunnerSnapshotRow } from '@/lib/directory/census-runner';
import type { CensusResult } from '@/lib/directory/census-geocoder';
import { parseCsv } from '@/lib/directory/csv';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const row = (over: Partial<RunnerSnapshotRow>): RunnerSnapshotRow => ({
  id: 'id-x',
  name: 'Test Stop',
  category_slug: 'truck-stops',
  address: '100 Main St',
  city: 'Perry',
  state: 'GA',
  zip: '31069',
  lat: null,
  lng: null,
  interstate: 'I-75',
  exit_number: '',
  snapshot_taken_at: '2026-07-21',
  ...over,
});

const censusHit = (id: string, lat: number, lng: number): CensusResult => ({
  id,
  status: 'exact',
  lat,
  lng,
  confidence: 'high',
  submittedAddress: 's',
  matchedAddress: 'm',
  matchType: 'Exact',
  geography: {},
});

/* Fixture along I-75 GA (milepost ≈ latitude progression, central Georgia). */
const snapshot: RunnerSnapshotRow[] = [
  row({ id: 'anchor-a', exit_number: '100', lat: 32.15, lng: -83.8 }),
  row({ id: 'anchor-b', exit_number: '110' }), // batch-CSV anchor, no applied coords
  row({ id: 'census-c', exit_number: '120' }), // census match → pending anchor
  row({ id: 'census-g', exit_number: '110' }), // census match, exit shared with B
  row({ id: 'census-f', exit_number: '' }), // census match, no exit → no corridor math
  row({ id: 'census-j', exit_number: '120' }), // census match, exit shared with census-c
  row({ id: 'half-h2', exit_number: '130', lat: 32.5 }), // half-coordinate row + census match
  row({ id: 'cand-d', name: '=Danger Truck Stop', exit_number: '105' }),
  row({ id: 'cand-e', exit_number: '115' }),
  row({ id: 'cand-k', exit_number: '120' }), // no census; exact-exit on census-c's anchor
  row({ id: 'cand-l', exit_number: '120' }), // second exact-exit rider on the same point
  row({ id: 'rej-h', address: '5 Elm St', exit_number: '300' }), // outside anchor range
  row({ id: 'rej-i', address: '', exit_number: '' }), // nothing to work with
];

const checkpoint: Checkpoint = {
  'census-c': censusHit('census-c', 32.44, -83.9),
  'census-g': censusHit('census-g', 32.291, -83.851),
  'census-f': censusHit('census-f', 32.2, -83.82),
  'census-j': censusHit('census-j', 32.441, -83.901),
  'half-h2': censusHit('half-h2', 32.5, -83.95),
  // Stale: anchor-a already has applied coordinates in the snapshot.
  'anchor-a': censusHit('anchor-a', 32.15, -83.8),
};

const batchAnchors: AnchorSourceRow[] = [
  // Duplicate of an applied directory coordinate — precedence must skip it.
  {
    listingId: 'anchor-a',
    state: 'GA',
    interstate: 'I-75',
    exitNumber: '100',
    lat: 32.151,
    lng: -83.801,
    source: 'geocoding-batch:test.csv',
  },
  {
    listingId: 'anchor-b',
    state: 'GA',
    interstate: 'I-75',
    exitNumber: '110',
    lat: 32.29,
    lng: -83.85,
    source: 'geocoding-batch:test.csv',
  },
];

/* ------------------------------------------------------ anchor assembly */
{
  const a = assembleAnchorRows(snapshot, checkpoint, batchAnchors);
  check(
    'anchors: precedence counts (directory 1, batch 1, census-pending 3)',
    a.counts.directory === 1 && a.counts.batch === 1 && a.counts.censusPending === 3,
    a.counts,
  );
  check(
    'anchors: batch row duplicating an applied coordinate is skipped',
    a.rows.filter((r) => r.listingId === 'anchor-a').length === 1 &&
      a.rows.find((r) => r.listingId === 'anchor-a')!.source === 'directory-verified',
  );
  check(
    'anchors: stale checkpoint entry (row already has coords) is not a census anchor',
    !a.rows.some((r) => r.listingId === 'anchor-a' && r.source === CENSUS_ANCHOR_SOURCE),
  );
  check(
    'anchors: half-coordinate row (lat without lng) never becomes a census anchor',
    !a.rows.some((r) => r.listingId === 'half-h2'),
  );
  check(
    'anchors: census match without an exit number contributes no anchor',
    !a.rows.some((r) => r.listingId === 'census-f'),
  );
}

/* --------------------------------------------------------- full package */
const x = buildCorridorExpansion(snapshot, checkpoint, batchAnchors);
{
  check(
    'calibration: one I-75 GA corridor with 3 anchors (duplicate milepost dropped)',
    x.calibration.calibrations.length === 1 &&
      x.calibration.calibrations[0].anchors.length === 3,
    x.calibration.calibrations.map((c) => `${c.interstate} ${c.state} ${c.anchors.length}`),
  );

  const ids = (rows: { listing: { id: string } }[]) => rows.map((r) => r.listing.id).sort();
  check(
    'candidates: exactly the five non-Census missing rows with a bracket',
    JSON.stringify(ids(x.candidates)) ===
      JSON.stringify(['anchor-b', 'cand-d', 'cand-e', 'cand-k', 'cand-l']),
    ids(x.candidates),
  );
  check(
    'candidates: verified-only partition (batch/directory anchors only)',
    JSON.stringify(ids(x.candidatesVerifiedOnly)) === JSON.stringify(['anchor-b', 'cand-d']),
  );
  check(
    'candidates: census-dependent partition flags every census-anchored row',
    JSON.stringify(ids(x.candidatesCensusDependent)) ===
      JSON.stringify(['cand-e', 'cand-k', 'cand-l']) &&
      x.candidatesCensusDependent.every((r) => candidateDependency(r) === 'census-dependent'),
  );

  const byId = new Map(x.crossChecks.map((c) => [c.id, c]));
  check(
    'cross-validation: batch-anchored comparison labeled verified-anchors and agrees',
    x.crossChecks.length === 2 &&
      byId.get('census-g')?.basis === 'verified-anchors' &&
      byId.get('census-g')?.agrees === true &&
      (byId.get('census-g')?.milesApart ?? 99) < 0.2,
    x.crossChecks,
  );
  check(
    'cross-validation: census-vs-census comparison labeled census-internal, never independent',
    byId.get('census-j')?.basis === 'census-internal' && byId.get('census-j')?.agrees === true,
  );
  check(
    'cross-validation: self-anchored and no-interpolation census rows counted separately',
    x.crossCheckSelfAnchored === 1 && x.crossCheckNoInterpolation === 2,
  );

  check(
    'rejected: dead-end rows with honest reasons (no false Census claims for unfetched rows)',
    x.rejected.length === 2 &&
      x.rejected.some(
        (r) =>
          r.row.listing.id === 'rej-h' &&
          r.reason.startsWith('outside-anchor-range') &&
          r.reason.includes('not Census-matched'),
      ) &&
      x.rejected.some(
        (r) => r.row.listing.id === 'rej-i' && r.reason === 'no exit path and no street address',
      ),
    x.rejected.map((r) => `${r.row.listing.id}:${r.reason}`),
  );

  const s = x.summary;
  check('summary: reconciliation holds (recounted from emitted CSV text)', s.reconciliation.holds);
  check(
    'summary: coverage staircase 1 → 6 → 11 of 13',
    s.coverage.now === 1 &&
      s.coverage.afterCensusApprovals === 6 &&
      s.coverage.afterCensusPlusInterpolation === 11,
    s.coverage,
  );
  check(
    'summary: censusMatched counts only rows still missing full coordinates',
    s.censusMatched === 5,
  );
  check(
    'summary: co-location totals (2 candidates on another listing\'s anchor, 1 shared group)',
    s.candidates.coLocatedOnAnotherListingsAnchor === 2 &&
      s.candidates.sharedProposedPointGroups === 1,
    s.candidates,
  );
  check(
    'summary: cross-validation split by basis (1 verified, 1 census-internal)',
    s.crossValidation.verifiedBasis.compared === 1 &&
      s.crossValidation.verifiedBasis.agree === 1 &&
      s.crossValidation.censusInternalBasis.compared === 1 &&
      s.crossValidation.censusInternalBasis.agree === 1,
  );

  /* --------------------------------------------------------------- CSVs */
  const now = parseCsv(x.csv.reviewNowCsv);
  const after = parseCsv(x.csv.afterCensusCsv);
  check(
    'csv: review-now has the 2 verified-only rows; after-census the 3 dependent rows',
    now.length === 3 && after.length === 4,
  );
  check(
    'csv: extra anchor_provenance column appended to the console contract',
    now[0][now[0].length - 1] === 'anchor_provenance' &&
      after.slice(1).every((cells) => cells[cells.length - 1].includes(CENSUS_ANCHOR_SOURCE)),
  );
  check(
    'csv: every candidate row is action=manual-review',
    [...now.slice(1), ...after.slice(1)].every((cells) => cells[14] === 'manual-review'),
  );
  check(
    'csv: formula-injection guard on business names',
    (() => {
      const cell = now.slice(1).find((cells) => cells[0] === 'cand-d')?.[1] ?? '';
      return cell.startsWith("'=");
    })(),
  );
  check(
    'csv: co-located candidates carry the CO-LOCATED reviewer flag naming the anchor listing',
    (() => {
      const k = after.slice(1).find((cells) => cells[0] === 'cand-k');
      const l = after.slice(1).find((cells) => cells[0] === 'cand-l');
      return (
        !!k &&
        !!l &&
        k[16].includes('CO-LOCATED') &&
        k[16].includes('census-c') &&
        k[16].includes('cand-l') &&
        l[16].includes('CO-LOCATED')
      );
    })(),
  );
  const cross = parseCsv(x.csv.crossValidationCsv);
  check(
    'csv: cross-validation carries the comparison_basis column',
    cross.length === 3 &&
      cross[0][cross[0].length - 1] === 'comparison_basis' &&
      cross
        .slice(1)
        .find((cells) => cells[0] === 'census-j')?.[cross[0].length - 1]?.includes(
          'census-internal',
        ) === true,
  );
  const rej = parseCsv(x.csv.rejectedCsv);
  check('csv: rejected ledger parses with both rows', rej.length === 3);

  check(
    'deterministic: same inputs → identical output bytes',
    JSON.stringify(buildCorridorExpansion(snapshot, checkpoint, batchAnchors)) ===
      JSON.stringify(x),
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
