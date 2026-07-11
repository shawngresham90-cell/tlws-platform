/**
 * Milestone 21 unit tests: geocoding console additions — optional evidence
 * columns (backward compatible with 15-column files), batch summary counts,
 * staging-file export of a selected subset, priority-sorted review queue,
 * and OpenStreetMap links.
 *
 * Run:
 *   npx esbuild scripts/test-geocoding-console.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-geo-console.cjs && node /tmp/test-geo-console.cjs
 */
import {
  parseGeocodingCsv,
  validateBatch,
  batchSummary,
  stagingCsv,
  reviewQueueCsv,
  osmUrl,
  GEOCODING_COLUMNS,
  type LiveListingRef,
} from '@/lib/directory/geocoding';
import { toCsv } from '@/lib/directory/csv';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const LIVE = new Map<string, LiveListingRef>([
  [A, { id: A, name: 'Lot A', address: '1 Road', city: 'Dalton', state: 'GA', lat: null, lng: null }],
  [B, { id: B, name: 'Lot B', address: '2 Road', city: 'Calhoun', state: 'GA', lat: 34.5, lng: -84.9 }],
]);

const base15 = (id: string, city: string, addr: string, conf: string, action: string) => [
  id, 'Lot', 'parking', addr, city, 'GA', '30720', '', '', '34.7', '-84.9', conf, 'https://src', 'notes', action,
];

/* ------------------------- backward compatibility ------------------------- */
{
  const csv = toCsv([[...GEOCODING_COLUMNS], base15(A, 'Dalton', '1 Road', 'high', 'ready')]);
  const parsed = parseGeocodingCsv(csv);
  check('compat: 15-column file still parses', parsed.rows.length === 1 && parsed.errors.length === 0);
  check('compat: empty evidence attached', parsed.rows[0].evidence.sourceUrls.length === 0 && parsed.rows[0].evidence.status === '');
}

/* ------------------------- evidence columns ------------------------- */
{
  const csv = toCsv([
    [...GEOCODING_COLUMNS, 'confidence_reason', 'source_count', 'source_urls', 'last_researched', 'reviewer_notes', 'side_of_road_confirmed', 'property_confirmed', 'city_state_validated', 'priority', 'concern_flag', 'status'],
    [...base15(A, 'Dalton', '1 Road', 'medium', 'manual-review'), 'two sources disagree', '2', 'https://a.example; https://b.example', '2026-07-01', 'check south side', 'yes', 'no', 'yes', 'high', 'yes', 'manual-review'],
    [...base15(B, 'Calhoun', '2 Road', 'high', 'ready'), '', '', '', '', '', '', '', '', '', '', 'ready'],
  ]);
  const parsed = parseGeocodingCsv(csv);
  check('evidence: rows parse', parsed.rows.length === 2, parsed.errors);
  const e = parsed.rows[0].evidence;
  check('evidence: reason', e.confidenceReason === 'two sources disagree');
  check('evidence: source count', e.sourceCount === 2);
  check('evidence: urls split + validated', e.sourceUrls.length === 2 && e.sourceUrls[1] === 'https://b.example');
  check('evidence: yes/no parsing', e.sideOfRoadConfirmed === true && e.propertyConfirmed === false && e.cityStateValidated === true);
  check('evidence: priority + concern + status', e.priority === 'high' && e.concernFlag && e.status === 'manual-review');

  const validated = validateBatch(parsed.rows, LIVE);
  const summary = batchSummary(validated);
  check('summary: totals', summary.total === 2 && summary.applicable === 1);
  check('summary: concerns counted', summary.concerns === 1);
  check('summary: confidence buckets', summary.byConfidence.medium === 1 && summary.byConfidence.high === 1);
  check('summary: overwrite counted (B has live coords)', summary.overwrites === 1);
  check('summary: status buckets', summary.byStatus['manual-review'] === 1 && summary.byStatus.ready === 1);

  const staging = stagingCsv(validated, new Set([B]));
  check('staging: only selected row, 15-column contract', staging.split('\r\n').length === 2 && staging.includes(B) && !staging.includes(A));
  const reparsed = parseGeocodingCsv(staging);
  check('staging: round-trips through the real parser', reparsed.rows.length === 1 && reparsed.errors.length === 0);

  const queue = reviewQueueCsv(validated);
  check('queue: only non-applicable rows', queue.includes(A) && !queue.split('\r\n').slice(1).some((l) => l.includes(B)));
  check('queue: evidence columns present', queue.split('\r\n')[0].includes('confidence_reason') && queue.includes('two sources disagree'));
}

/* ------------------------- priority sorting + osm ------------------------- */
{
  const csv = toCsv([
    [...GEOCODING_COLUMNS, 'priority'],
    [...base15(A, 'Dalton', '1 Road', 'low', 'manual-review'), 'low'],
    [...base15(B, 'Calhoun', '2 Road', 'medium', 'manual-review'), 'high'],
  ]);
  const validated = validateBatch(parseGeocodingCsv(csv).rows, LIVE);
  const queue = reviewQueueCsv(validated).split('\r\n');
  check('queue: high priority first', queue[1].includes(B) && queue[2].includes(A));

  check('osm: link shape', osmUrl(34.7, -84.9) === 'https://www.openstreetmap.org/?mlat=34.7&mlon=-84.9#map=17/34.7/-84.9');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
