/**
 * Offline tests for the Census batch runner lib. NO network: every fetch is an
 * injected fixture; sleep is injected as a no-op. Run:
 *
 *   npx esbuild scripts/test-census-runner.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-census-runner.cjs && node /tmp/test-census-runner.cjs
 */
import {
  buildWorklist,
  buildReviewPackage,
  mergeCheckpoint,
  pendingQueries,
  worklistCsvs,
  type Checkpoint,
  type RunnerSnapshotRow,
} from '@/lib/directory/census-runner';
import {
  censusGeocodeBatch,
  type CensusFetch,
  type CensusResult,
} from '@/lib/directory/census-geocoder';
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
  city: 'Lebanon',
  state: 'TN',
  zip: '37090',
  lat: null,
  lng: null,
  interstate: 'I-40',
  exit_number: '238',
  snapshot_taken_at: '2026-07-21',
  ...over,
});

/* ------------------------------------------------------------- worklist */
{
  const snap = [
    row({ id: 'b-has-coords', lat: 36.2, lng: -86.3 }),
    row({ id: 'a-good' }),
    row({ id: 'c-pobox', address: 'PO Box 12' }),
    row({ id: 'd-highway', address: 'I-40 & SR 5' }),
    row({ id: 'e-blank', address: '' }),
    row({ id: 'f-no-city', city: '' }),
  ];
  const w = buildWorklist(snap);
  check('worklist: only the clean row is eligible', w.eligible.length === 1);
  check('worklist: eligible sorted + right id', w.eligible[0]?.query.id === 'a-good');
  check('worklist: ineligible count', w.ineligible.length === 5);
  const reasons = Object.fromEntries(w.ineligible.map((i) => [i.id, i.reason]));
  check('worklist: has-coords reason', reasons['b-has-coords'] === 'already-has-coordinates');
  check('worklist: po-box reason', reasons['c-pobox'] === 'po-box');
  check('worklist: highway-only reason', reasons['d-highway'] === 'highway-only-address');
  check('worklist: blank reason', reasons['e-blank'] === 'blank-address');
  check('worklist: no-city reason', reasons['f-no-city'] === 'no-city-or-state');
  check(
    'worklist: deterministic (same input → same output)',
    JSON.stringify(buildWorklist(snap)) === JSON.stringify(w),
  );
  const csvs = worklistCsvs(w);
  check(
    'worklist: csvs parse and have expected row counts',
    parseCsv(csvs.eligibleCsv).length === 2 && parseCsv(csvs.ineligibleCsv).length === 6,
  );
}

/* --------------------------------------------------- checkpoint semantics */
{
  const r = (id: string, lat: number | null): CensusResult => ({
    id,
    status: lat == null ? 'rejected' : 'exact',
    rejection: lat == null ? 'no-match' : undefined,
    lat,
    lng: lat == null ? null : -86,
    confidence: lat == null ? null : 'high',
    submittedAddress: 's',
    matchedAddress: 'm',
    matchType: lat == null ? '' : 'Exact',
    geography: {},
  });
  const cp = mergeCheckpoint({}, [r('a', 36), r('b', null)]);
  check('checkpoint: merge adds fresh', Object.keys(cp).length === 2);
  const cp2 = mergeCheckpoint(cp, [r('a', 99), r('c', 35)]);
  check('checkpoint: existing entry wins on remerge (idempotent resume)', cp2['a'].lat === 36);
  check('checkpoint: new entry added', cp2['c'].lat === 35);

  const snap = [row({ id: 'a' }), row({ id: 'b' }), row({ id: 'c' }), row({ id: 'd' })];
  const w = buildWorklist(snap);
  const pending = pendingQueries(w, cp2);
  check(
    'checkpoint: pending = worklist minus checkpointed',
    pending.length === 1 && pending[0].id === 'd',
  );
}

/* ------------------------------------------- batch fetch (injected, offline) */
{
  const calls: string[] = [];
  const match = {
    result: {
      addressMatches: [
        {
          coordinates: { x: -86.29, y: 36.21 },
          matchedAddress: '100 MAIN ST, LEBANON, TN, 37090',
          matchType: 'Exact',
          addressComponents: { state: 'TN' },
        },
      ],
    },
  };
  let flaky = 0;
  const fetchFn: CensusFetch = async (url) => {
    calls.push(url);
    if (url.includes('FLAKY') && flaky++ < 1) return { status: 503, json: async () => ({}) };
    if (url.includes('NOMATCH'))
      return { status: 200, json: async () => ({ result: { addressMatches: [] } }) };
    return { status: 200, json: async () => match };
  };
  const sleep = async () => {};
  const q = (id: string, address: string) => ({
    id,
    address,
    city: 'Lebanon',
    state: 'TN',
    zip: '37090',
  });
  const run = censusGeocodeBatch(
    [q('ok1', '100 Main St'), q('retry1', '1 FLAKY Rd'), q('miss1', '9 NOMATCH Ln')],
    { fetchFn, sleep, minIntervalMs: 0 },
  );
  void run.then((results) => {
    check(
      'fetch: exact match classified high',
      results[0].status === 'exact' && results[0].confidence === 'high',
    );
    check('fetch: 5xx retried then succeeded', results[1].status === 'exact');
    check(
      'fetch: no-match rejected',
      results[2].status === 'rejected' && results[2].rejection === 'no-match',
    );
    check(
      'fetch: zero real network (all through injected fn)',
      calls.every((u) => u.startsWith('https://geocoding.geo.census.gov/')),
    );

    /* --------------------------------------------------- package (offline) */
    const snap = [
      row({ id: 'ok1' }),
      row({ id: 'retry1', address: '1 FLAKY Rd' }),
      row({ id: 'miss1', address: '9 NOMATCH Ln' }),
      row({ id: 'coords1', lat: 36.4, lng: -84.2, interstate: 'I-75' }),
      row({ id: 'never1', address: 'PO Box 9' }),
    ];
    const cp = mergeCheckpoint({}, results);
    const pkg = buildReviewPackage(snap, cp);

    const review = parseCsv(pkg.reviewCsv);
    check(
      'package: review header is the 15-column console contract',
      review[0].length === 15 && review[0][0] === 'listing_id',
    );
    check('package: only matched rows in review CSV', review.length === 3);
    check(
      'package: every review row is manual-review',
      review.slice(1).every((cells) => cells[14] === 'manual-review'),
    );
    check(
      'package: proposed coords are 6dp strings from the service',
      review
        .slice(1)
        .every((cells) => /^-?\d+\.\d{6}$/.test(cells[9]) && /^-?\d+\.\d{6}$/.test(cells[10])),
    );

    const unresolved = parseCsv(pkg.unresolvedCsv);
    check(
      'package: unresolved lists the rejected fetch',
      unresolved.length === 2 && unresolved[1][0] === 'miss1',
    );

    const verification = parseCsv(pkg.verificationCsv);
    check('package: verification covers each matched row', verification.length === 3);

    const s = pkg.summary;
    check('package: worklist math', s.worklist.eligible === 3 && s.worklist.ineligible === 2);
    check(
      'package: checkpoint math (pending 0 — ineligible rows are not pending)',
      s.checkpoint.fetched === 3 &&
        s.checkpoint.matched === 2 &&
        s.checkpoint.rejected === 1 &&
        s.checkpoint.pending === 0,
    );
    check('package: confidence split', s.confidence.high === 2 && s.confidence.medium === 0);
    check(
      'package: coverage actuals',
      s.coverage.withCoordsNow === 1 && s.coverage.afterReviewingMatches === 3,
    );
    check(
      'package: projection band uses pending only',
      s.coverage.projectedIfPendingMatches70to85pct.low <=
        s.coverage.projectedIfPendingMatches70to85pct.high,
    );
    check(
      'package: deterministic (same inputs → identical bytes)',
      JSON.stringify(buildReviewPackage(snap, cp)) === JSON.stringify(pkg),
    );
    check(
      'package: formula-injection guard on names',
      (() => {
        const evil = [row({ id: 'ok1', name: '=HYPERLINK("x")' })];
        const p = buildReviewPackage(evil, { ok1: results[0] });
        const cell = parseCsv(p.reviewCsv)[1]?.[1] ?? '';
        return !cell.startsWith('=');
      })(),
    );
    check(
      'package: formula-injection guard on addresses (review + worklist CSVs)',
      (() => {
        const evil = [row({ id: 'ok1', address: '=2+5 Main St' })];
        const p = buildReviewPackage(evil, { ok1: { ...results[0], id: 'ok1' } });
        const reviewCell = parseCsv(p.reviewCsv)[1]?.[3] ?? '';
        const wl = worklistCsvs(buildWorklist(evil));
        const wlCell = parseCsv(wl.eligibleCsv)[1]?.[1] ?? '';
        return !reviewCell.startsWith('=') && !wlCell.startsWith('=');
      })(),
    );
    check(
      'package: stale checkpoint entries ignored after a snapshot refresh',
      (() => {
        // 'coords1' HAS coordinates in the snapshot; a leftover checkpoint
        // entry for it must not re-enter review or double-count coverage.
        const staleCp: Checkpoint = mergeCheckpoint(cp, [{ ...results[0], id: 'coords1' }]);
        const p = buildReviewPackage(snap, staleCp);
        return (
          p.summary.checkpoint.staleIgnored === 1 &&
          p.summary.checkpoint.fetched === 3 &&
          p.summary.coverage.afterReviewingMatches === 3 &&
          parseCsv(p.reviewCsv).length === 3
        );
      })(),
    );

    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
}
