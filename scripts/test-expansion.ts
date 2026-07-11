/**
 * Milestone 21 unit tests: expansion readiness — the real import parser is
 * the gate, slug previews respect live + in-file collisions, duplicates
 * against the live directory force manual review, completeness drives the
 * publish verdict, invalid coordinates are caught, and the report CSV is
 * formula-safe.
 *
 * Run:
 *   npx esbuild scripts/test-expansion.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-expansion.cjs && node /tmp/test-expansion.cjs
 */
import { assessExpansion, expansionReportCsv, expansionTemplateCsv } from '@/lib/directory/expansion';
import { importDupKey } from '@/lib/directory/import';
import { parseCsv, toCsv } from '@/lib/directory/csv';
import type { PairListing } from '@/lib/directory/colocation';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

const LIVE: PairListing[] = [
  {
    id: 'live-1',
    name: 'Pilot Travel Center #4558',
    category: 'truck-stops',
    address: '324 Carbondale Rd',
    city: 'Calhoun',
    state: 'GA',
    phone: null,
    website: null,
    lat: 34.4,
    lng: -84.9,
    interstate: 'I-75',
    exitNumber: '306',
  },
];
const EXISTING_KEYS = new Set([importDupKey('Pilot Travel Center #4558', 'Calhoun', 'GA')]);
const EXISTING_SLUGS = new Set(['new-stop-dalton-ga']);

const HEADER = ['Business Name', 'Category', 'Address', 'City', 'State', 'Zip', 'Latitude', 'Longitude', 'Phone', 'Website', 'Description', 'Overnight Parking', 'Showers'];
const row = (name: string, over: Partial<Record<string, string>> = {}) => [
  name,
  over.category ?? 'truck-stops',
  over.address ?? '10 Main St',
  over.city ?? 'Dalton',
  over.state ?? 'GA',
  over.zip ?? '30720',
  over.lat ?? '',
  over.lng ?? '',
  over.phone ?? '(706) 555-0100',
  over.website ?? 'https://example.com',
  over.description ?? 'A very reasonable truck stop description with plenty of driver detail here.',
  'yes',
  'yes',
];

{
  const csv = toCsv([
    HEADER,
    row('New Stop', {}), // collides with EXISTING_SLUGS → suffix
    row('New Stop', { city: 'Dalton' }), // duplicate within file (same name/city/state)
    row('Rich Stop', { lat: '34.7', lng: '-84.9' }),
    row('Bad Coords Stop', { lat: '-84.9', lng: '34.7' }),
    row('Thin Stop', { address: '', phone: '', website: '', description: '', zip: '' }),
    row('Pilot Travel Center #4558', { city: 'Calhoun', address: '324 Carbondale Rd' }), // dup vs live → parser-level duplicate
  ]);
  const report = assessExpansion(csv, EXISTING_KEYS, EXISTING_SLUGS, LIVE);

  check('parser: live duplicate counted', report.summary.duplicates >= 2, report.summary);
  check('rows: prepared rows exclude parser duplicates', report.rows.length === 4, report.rows.length);

  const byName = new Map(report.rows.map((r) => [r.name, r]));
  const newStop = byName.get('New Stop')!;
  check('slug: live collision gets suffix', newStop.slugPreview === 'new-stop-dalton-ga-2' && newStop.slugCollision);

  const rich = byName.get('Rich Stop')!;
  check('verdict: rich row ready to publish', rich.verdict === 'ready-to-publish', rich);
  check('geocoding: valid coords recognized', rich.geocoding === 'valid-coords');

  const badCoords = byName.get('Bad Coords Stop')!;
  check('verdict: invalid coords force manual review', badCoords.verdict === 'manual-review' && badCoords.geocoding === 'invalid-coords');

  const thin = byName.get('Thin Stop')!;
  check('verdict: thin row imports unpublished', thin.verdict === 'import-unpublished', thin.verdict);
  check('geocoding: missing coords flagged', thin.geocoding === 'needs-geocoding');

  check('counts: verdict buckets add up', report.verdictCounts['ready-to-publish'] + report.verdictCounts['import-unpublished'] + report.verdictCounts['manual-review'] === report.rows.length);

  const reportCsv = expansionReportCsv(report);
  check('csv: header + rows', reportCsv.split('\r\n').length === report.rows.length + 1);
}

/* duplicate-vs-live via similar (not identical) name at the same address —
   the parser's name/city/state key does NOT match ("Pilot Travel Center
   Calhoun" ≠ "Pilot Travel Center #4558"), so the row gets in and the
   classifier must flag it for manual review. */
{
  const csv = toCsv([HEADER, row('Pilot Travel Center Calhoun', { city: 'Calhoun', address: '324 Carbondale Rd' })]);
  const report = assessExpansion(csv, EXISTING_KEYS, EXISTING_SLUGS, LIVE);
  check('duplicates: near-identical name vs live → manual review', report.rows[0]?.verdict === 'manual-review', report.rows[0]);
  check('duplicates: hit names the live listing', report.rows[0]?.duplicateHits.some((h) => h.liveName.includes('Pilot')));
}

/* formula guard + template */
{
  const csv = toCsv([HEADER, row('=HYPERLINK("evil")', {})]);
  const report = assessExpansion(csv, new Set(), new Set(), []);
  check('csv: report guards formulas', expansionReportCsv(report).includes("'=HYPERLINK"));
  const template = parseCsv(expansionTemplateCsv());
  check('template: single header row with name+category', template.length === 1 && template[0].includes('Business Name') && template[0].includes('Category'));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
