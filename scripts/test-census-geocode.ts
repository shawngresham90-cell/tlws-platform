/**
 * Census batch geocoder harness tests (offline, no network, no DB).
 *
 * Covers: input-CSV framing + eligibility + checksums (census-geocode.ts);
 * addressbatch output parsing; the full validation/classification matrix
 * against a documented fixture (pass / manual-review / rejected / no-match,
 * every rejection reason); control-distance metrics; and deterministic reruns.
 *
 * Run:
 *   npx esbuild scripts/test-census-geocode.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-census-geocode.cjs && node /tmp/test-census-geocode.cjs
 */
import { readFileSync } from 'fs';
import { parseCsv } from '@/lib/directory/csv';
import type { CensusQuery } from '@/lib/directory/census-geocoder';
import {
  buildBatchInputCsv,
  isEligible,
  sha256,
  buildManifest,
  type EligibleRecord,
} from './imports/census-geocode';
import {
  parseCensusBatchOutput,
  validateAndClassify,
  returnedStateOf,
  materialAddressConflict,
  type ControlPoint,
} from './validation/validate-geocodes';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

const ROOT = process.cwd();
const CAL = `${ROOT}/data/geocoding/census/calibration`;

/* ── 1. Eligibility + input framing ────────────────────────────────────── */
const good: EligibleRecord = {
  id: '46c70f80-8582-44d1-a7b6-ea9423392fea',
  address: '615 Watt Rd',
  city: 'Knoxville',
  state: 'TN',
  zip: '37922',
};
check('eligible: full row', isEligible(good));
check('ineligible: blank address', !isEligible({ ...good, address: '' }));
check('ineligible: PO box', !isEligible({ ...good, address: 'PO Box 123' }));
check('ineligible: highway-only', !isEligible({ ...good, address: 'I-40 & SR 5' }));
check('ineligible: bad uuid', !isEligible({ ...good, id: 'nope' }));
check('ineligible: no state', !isEligible({ ...good, state: '' }));
check('eligible: missing zip ok', isEligible({ ...good, zip: '' }));

const csv = buildBatchInputCsv([
  good,
  {
    id: '00000000-0000-0000-0000-000000000000',
    address: '1 A St, Suite 5',
    city: 'X',
    state: 'ga',
    zip: '',
  },
]);
const grid = parseCsv(csv);
check('input: 2 rows, 5 cols', grid.length === 2 && grid[0].length === 5, grid);
check('input: state upper-cased', grid[1][3] === 'GA', grid[1]);
check('input: missing zip preserved blank', grid[1][4] === '', JSON.stringify(grid[1]));
check(
  'input: deterministic (byte-identical rerun)',
  buildBatchInputCsv([good]) === buildBatchInputCsv([good]),
);
check('sha256 stable', sha256('abc') === sha256('abc') && sha256('abc') !== sha256('abd'));

const manifest = buildManifest({
  benchmark: 'Public_AR_Current',
  runTimestamp: '2026-07-24T00:00:00Z',
  records: [good],
  inputCsv: csv,
  rawOutput: 'raw',
  networkStatus: 'network-blocked',
});
check(
  'manifest: fields recorded',
  manifest.benchmark === 'Public_AR_Current' &&
    manifest.recordCount === 1 &&
    manifest.inputChecksum.length === 64 &&
    manifest.rawOutputChecksum?.length === 64 &&
    manifest.networkStatus === 'network-blocked',
);

/* ── 2. Helpers ────────────────────────────────────────────────────────── */
check('returnedStateOf', returnedStateOf('615 WATT RD, KNOXVILLE, TN, 37922') === 'TN');
check('returnedStateOf: none', returnedStateOf('SOMEWHERE') === '');
check(
  'address conflict: 122 vs 199',
  materialAddressConflict('122 Truck Stop Way', '199 TRUCK STOP WAY, JACKSON, GA') === true,
);
check(
  'address conflict: same number',
  materialAddressConflict('615 Watt Rd', '615 WATT RD, KNOXVILLE, TN') === false,
);
check(
  'address conflict: no number → not a conflict',
  materialAddressConflict('Smokey Park Hwy', 'SMOKEY PARK HWY, CANDLER, NC') === false,
);

/* ── 3. Build submitted + controls maps from the real calibration files ── */
const inputGrid = parseCsv(readFileSync(`${CAL}/census-calibration-input.csv`, 'utf8'));
const submitted = new Map<string, CensusQuery>();
for (const row of inputGrid) {
  if (row.length < 5) continue;
  submitted.set(row[0], { id: row[0], address: row[1], city: row[2], state: row[3], zip: row[4] });
}
check('input file: 100 calibration rows', submitted.size === 100, submitted.size);

const controlsGrid = parseCsv(readFileSync(`${CAL}/controls.csv`, 'utf8'));
const controls = new Map<string, ControlPoint>();
for (const row of controlsGrid) {
  if (row[0] === 'listing_id' || row.length < 3) continue;
  controls.set(row[0], { lat: Number(row[1]), lng: Number(row[2]) });
}
check('controls file: 45 verified rows', controls.size === 45, controls.size);

/* ── 4. Parse + validate the documented fixture ────────────────────────── */
const fixture = readFileSync(`${CAL}/fixtures/census-addressbatch-output.sample.csv`, 'utf8');
const rows = parseCensusBatchOutput(fixture);
check('fixture parsed: 12 rows', rows.length === 12, rows.length);

const { records, summary } = validateAndClassify(rows, submitted, controls);
const byId = (id: string) =>
  records.find((r) => r.id === id && r.rejectionReason !== 'duplicate-output-id');
const dupRec = records.filter((r) => r.id === '46c70f80-8582-44d1-a7b6-ea9423392fea');

check(
  'pass: near control 46c70f80',
  byId('46c70f80-8582-44d1-a7b6-ea9423392fea')?.reviewDecision === 'census-calibration-pass',
  byId('46c70f80-8582-44d1-a7b6-ea9423392fea'),
);
check(
  'manual-review: far control 4e8c0e97',
  byId('4e8c0e97-4aab-4853-8e43-904eacb3b0a9')?.reviewDecision === 'census-manual-review',
);
check(
  'manual-review: non-control match 04e8fad7',
  byId('04e8fad7-c564-4879-95ba-91816d3b1074')?.reviewDecision === 'census-manual-review',
);
check(
  'no-match: 01d5116b',
  byId('01d5116b-6fc7-4a6f-909d-11d594522aab')?.reviewDecision === 'census-no-match',
);
check(
  'rejected(tie): 0c8f2702',
  byId('0c8f2702-18ba-465d-ad9f-7222b3db2744')?.rejectionReason === 'tie',
);
check(
  'rejected(wrong-state component): 000c91b2',
  byId('000c91b2-9827-443c-8669-5f07c833f485')?.rejectionReason === 'wrong-state',
);
check(
  'rejected(wrong-state bounds): 096dd2fe',
  byId('096dd2fe-80a1-441b-a700-dbea8e1455c2')?.rejectionReason === 'wrong-state',
);
check(
  'rejected(impossible 0,0): 05c35c41',
  byId('05c35c41-6e8f-481f-a2f7-5f50e91170df')?.rejectionReason === 'impossible-coordinates',
);
check(
  'rejected(malformed coord): 042f917c',
  byId('042f917c-41af-484c-899b-051ebf3194f9')?.rejectionReason === 'impossible-coordinates',
);
const conflictRec = byId('33e41d22-1dac-425b-a17d-c9b6affcda21');
check(
  'manual-review + addressMismatch: 33e41d22',
  conflictRec?.reviewDecision === 'census-manual-review' && conflictRec?.addressMismatch === true,
  conflictRec,
);
check(
  'rejected(duplicate id): second 46c70f80',
  dupRec.some((r) => r.rejectionReason === 'duplicate-output-id'),
);
check(
  'rejected(uuid-not-submitted): 99999999',
  records.find((r) => r.id === '99999999-9999-9999-9999-999999999999')?.rejectionReason ===
    'uuid-not-submitted',
);

// Never label anything a rooftop/exact-pass for a non-control.
check(
  'non-control never passes',
  !records.some((r) => !r.isControl && r.reviewDecision === 'census-calibration-pass'),
);

/* ── 5. Control-distance metrics ───────────────────────────────────────── */
check(
  'controls matched = 3 (46c70f80, 4e8c0e97, 33e41d22)',
  summary.controls.matched === 3,
  summary.controls,
);
check('controls within 150m = 2', summary.controls.within150m === 2, summary.controls);
check('controls within 1mi = 3', summary.controls.withinMile === 3, summary.controls);
check('controls over 1mi = 0', summary.controls.overMile === 0, summary.controls);
check('address mismatch counted', summary.controls.addressMismatch === 1, summary.controls);
check('state mismatch counted (>=2)', summary.controls.stateMismatch >= 2, summary.controls);
check(
  'buckets sum to total',
  Object.values(summary.buckets).reduce((a, b) => a + b, 0) === summary.total,
);

/* ── 6. Determinism: same inputs → identical output ────────────────────── */
const again = validateAndClassify(parseCensusBatchOutput(fixture), submitted, controls);
check(
  'deterministic rerun',
  JSON.stringify(again.records) === JSON.stringify(records) &&
    JSON.stringify(again.summary) === JSON.stringify(summary),
);

console.log(`\ncensus-geocode: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
