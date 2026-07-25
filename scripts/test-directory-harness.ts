/**
 * Directory import + coverage harness tests (offline, no network, no DB).
 *
 * Covers: 32-column schema validation; state coverage across all 50+DC;
 * existing/incoming dedupe; cross-type same-name; blanks-where-unverified;
 * insert-plan shape (insert-only + rollback); deterministic reruns; and the
 * provenance / verified-date / source-link validators.
 *
 * Run:
 *   npx esbuild scripts/test-directory-harness.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-directory-harness.cjs && node /tmp/test-directory-harness.cjs
 */
import { CANONICAL_IMPORT_COLUMNS, recognizeHeader } from '@/lib/directory/import';
import {
  validateSchemaHeaders,
  stateCoverageReport,
  uncoveredStates,
  existingDedupeCheck,
  incomingDedupeCheck,
  crossTypeSameName,
  blanksWhereUnverified,
  buildInsertPlan,
  analyzeBatch,
  CANONICAL_COLUMNS,
  type ProductionRow,
  type IncomingRow,
  type InsertPlanRow,
} from './imports/directory-coverage';
import {
  validateBatchCsv,
  validateVerifiedDate,
  validateSourceLink,
  validateProvenanceFile,
  extractSourceLinks,
} from './validation/validate-directory-batch';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

const TODAY = '2026-07-24';

// A minimal-but-valid batch CSV in the established 20-column convention.
const HEADER =
  'name,category,address,city,state,zip,phone,website,description,interstate,exitnumber,showers,food,fuel,laundry,restrooms,repair,catscale,wifi,security';
const CSV = [
  HEADER,
  `Love's Travel Stop #500,truck-stops,100 Main St,Bedford,PA,15522,814-555-0100,https://www.loves.com/x,"Diesel and parking.",I-76,146,yes,yes,yes,,yes,,,yes,`,
  `Pilot Travel Center #22,truck-stops,200 Route 30,Breezewood,PA,15533,814-555-0200,https://pilotflyingj.com/y,"Fuel stop.",I-70,,yes,yes,yes,,yes,,,,`,
].join('\n');

/* ── 1. 32-column canonical schema ─────────────────────────────────────── */
check(
  'canonical columns count is 32',
  CANONICAL_IMPORT_COLUMNS.length === 32,
  CANONICAL_IMPORT_COLUMNS.length,
);
check('CANONICAL_COLUMNS re-export matches', CANONICAL_COLUMNS === CANONICAL_IMPORT_COLUMNS);
// A representative spec header for each of the 32 canonical columns; each must
// resolve back through the importer's own recognizeHeader to its column.
const SAMPLE_HEADER: Record<string, string> = {
  name: 'Business Name',
  category: 'Category',
  address: 'Address',
  city: 'City',
  state: 'State',
  zip: 'ZIP Code',
  lat: 'Latitude',
  lng: 'Longitude',
  phone: 'Phone',
  website: 'Website',
  description: 'Description',
  parking_spaces: 'Truck Spaces',
  free_parking: 'Free Parking',
  paid_parking: 'Paid Parking',
  reserved_parking: 'Reserved Parking',
  overnight_parking: 'Overnight Parking',
  am_Showers: 'Showers',
  am_Food: 'Food',
  am_Fuel: 'Fuel',
  am_Laundry: 'Laundry',
  am_Restrooms: 'Restrooms',
  am_Repair: 'Repair',
  'am_CAT Scale': 'CAT Scale',
  'am_Wi-Fi': 'Wi-Fi',
  am_Security: 'Security',
  tpc_url: 'Truck Parking Club URL',
  affiliate_code: 'Affiliate Code',
  image_url: 'Image URL',
  is_published: 'Published',
  is_featured: 'Featured',
  interstate: 'Interstate',
  exit_number: 'Exit Number',
};
check(
  'every canonical column resolves from a representative header',
  CANONICAL_IMPORT_COLUMNS.every((col) => recognizeHeader(SAMPLE_HEADER[col]) === col),
  CANONICAL_IMPORT_COLUMNS.filter((col) => recognizeHeader(SAMPLE_HEADER[col]) !== col),
);
check('SAMPLE_HEADER covers all 32 columns', Object.keys(SAMPLE_HEADER).length === 32);
check('recognizeHeader maps Business Name → name', recognizeHeader('Business Name') === 'name');
check('recognizeHeader maps ZIP Code → zip', recognizeHeader('ZIP Code') === 'zip');
check('recognizeHeader unknown → null', recognizeHeader('Nonsense Column') === null);

const schema = validateSchemaHeaders(CSV);
check('schema: 20-col batch header is ok', schema.ok, schema);
check(
  'schema: name recognized',
  schema.recognized.some((r) => r.field === 'name'),
);
check('schema: no unknown headers in canonical batch', schema.unknown.length === 0, schema.unknown);

const schemaMissing = validateSchemaHeaders('address,city,state\nx,y,z');
check(
  'schema: missing name+category flagged',
  schemaMissing.missingRequired.includes('name') &&
    schemaMissing.missingRequired.includes('category'),
);
check('schema: missing-required is not ok', !schemaMissing.ok);

const schemaUnknown = validateSchemaHeaders('name,category,frobnicate\nA,truck-stops,1');
check('schema: unknown header captured', schemaUnknown.unknown.includes('frobnicate'));

const schemaDup = validateSchemaHeaders('name,businessname,category\nA,B,truck-stops');
check(
  'schema: duplicate field (name via two headers) flagged',
  schemaDup.duplicateFields.some((d) => d.field === 'name'),
);
check('schema: duplicate-field batch is not ok', !schemaDup.ok);

/* ── 2. State coverage (all 50 + DC) ───────────────────────────────────── */
const existing: ProductionRow[] = [
  { id: 'e1', name: "Love's #1", city: 'Macon', state: 'GA', type: 'truck_stop' },
  { id: 'e2', name: 'Pilot #2', city: 'Knoxville', state: 'TN', type: 'truck_stop' },
  { id: 'e3', name: 'TA #3', city: 'Cordele', state: 'GA', type: 'truck_stop' },
];
const cov = stateCoverageReport(existing);
check('coverage: exactly 51 rows (50 states + DC)', cov.length === 51, cov.length);
check('coverage: GA existing = 2', cov.find((r) => r.code === 'GA')?.existing === 2);
check('coverage: TN existing = 1', cov.find((r) => r.code === 'TN')?.existing === 1);
check(
  'coverage: PA existing = 0 (row still present)',
  cov.find((r) => r.code === 'PA')?.existing === 0,
);
check('coverage: sorted by code (AK first-ish, AL before AR)', cov[0].code < cov[1].code);
const covProj = stateCoverageReport(existing, [{ state: 'PA' }, { state: 'PA' }, { state: 'GA' }]);
check(
  'coverage: projected = existing + incoming (PA 0+2=2)',
  covProj.find((r) => r.code === 'PA')?.projected === 2,
);
check('coverage: projected GA 2+1=3', covProj.find((r) => r.code === 'GA')?.projected === 3);
check(
  'uncoveredStates excludes GA/TN, includes PA',
  !uncoveredStates(existing).includes('GA') && uncoveredStates(existing).includes('PA'),
);

/* ── 3. Dedupe ─────────────────────────────────────────────────────────── */
const incoming: IncomingRow[] = [
  {
    name: "Love's #1",
    city: 'Macon',
    state: 'GA',
    type: 'truck_stop',
    lat: null,
    lng: null,
    verifiedAt: '2026-07-20',
  },
  {
    name: 'Brand New Stop',
    city: 'Bedford',
    state: 'PA',
    type: 'truck_stop',
    lat: null,
    lng: null,
    verifiedAt: '2026-07-20',
  },
  {
    name: 'Brand New Stop',
    city: 'Bedford',
    state: 'PA',
    type: 'truck_stop',
    lat: null,
    lng: null,
    verifiedAt: '2026-07-20',
  },
];
const exHits = existingDedupeCheck(incoming, existing);
check(
  "dedupe: incoming Love's #1/Macon/GA collides with production",
  exHits.length === 1 && exHits[0].existingId === 'e1',
);
const inHits = incomingDedupeCheck(incoming);
check(
  'dedupe: in-batch duplicate Bedford PA detected',
  inHits.length === 1 && inHits[0].indexes.length === 2,
);
check(
  'dedupe: unique rows produce no in-batch dup for row 0',
  !inHits.some((g) => g.indexes.includes(0)),
);

/* ── 4. Cross-type same-name ───────────────────────────────────────────── */
const crossExisting: ProductionRow[] = [
  { id: 'x1', name: "Love's Travel Stop", city: 'Macon', state: 'GA', type: 'truck_stop' },
];
const crossIncoming: IncomingRow[] = [
  {
    name: "Love's Travel Stop",
    city: 'Macon',
    state: 'GA',
    type: 'parking',
    lat: null,
    lng: null,
    verifiedAt: '2026-07-20',
  },
  {
    name: 'Unique Repair',
    city: 'Macon',
    state: 'GA',
    type: 'repair',
    lat: null,
    lng: null,
    verifiedAt: '2026-07-20',
  },
];
const cross = crossTypeSameName(crossExisting, crossIncoming);
check(
  "cross-type: Love's across truck_stop+parking flagged",
  cross.some((g) => g.types.includes('truck_stop') && g.types.includes('parking')),
);
check(
  'cross-type: single-type name not flagged',
  !cross.some((g) => g.normalizedName.includes('unique repair')),
);

/* ── 5. Blanks-where-unverified ────────────────────────────────────────── */
const coordRows: IncomingRow[] = [
  {
    name: 'No Coord OK',
    city: 'A',
    state: 'PA',
    type: 'truck_stop',
    lat: null,
    lng: null,
    verifiedAt: '2026-07-20',
  },
  {
    name: 'Coord With Date OK',
    city: 'B',
    state: 'PA',
    type: 'truck_stop',
    lat: 40.1,
    lng: -78.5,
    verifiedAt: '2026-07-20',
  },
  {
    name: 'Coord No Date BAD',
    city: 'C',
    state: 'PA',
    type: 'truck_stop',
    lat: 40.2,
    lng: -78.6,
    verifiedAt: null,
  },
];
const uv = blanksWhereUnverified(coordRows);
check(
  'blanks: exactly the coord-without-date row is a violation',
  uv.length === 1 && uv[0].name === 'Coord No Date BAD',
);
check('blanks: coord-with-date is allowed', !uv.some((v) => v.name === 'Coord With Date OK'));

/* ── 6. Insert plan (insert-only + rollback) ───────────────────────────── */
const planRows: InsertPlanRow[] = [
  { name: 'A', state: 'PA', slug: 'a', source: 'batch-x' },
  { name: 'B', state: 'PA', slug: 'b', source: 'batch-x' },
  { name: 'C', state: 'NJ', slug: 'c', source: 'batch-x' },
];
const plan = buildInsertPlan(planRows, 'pa-batch-100');
check(
  'plan: one entry per state, sorted',
  plan.length === 2 && plan[0].state === 'NJ' && plan[1].state === 'PA',
);
check('plan: PA has 2 rows', plan.find((p) => p.state === 'PA')?.count === 2);
check(
  'plan: no UPDATE statement anywhere (insert-only)',
  plan.every((p) => !/\bupdate\b/i.test(p.insertPreviewSql)),
);
check(
  'plan: rollback deletes by source + slug',
  plan.every((p) => /delete from public\.locations where source=/.test(p.rollbackSql)),
);
check(
  'plan: insert guarded by slug-collision check',
  plan.every((p) => /slug collision/.test(p.insertPreviewSql)),
);
check(
  'plan: before-count is a select count',
  plan.every((p) => /select count\(\*\)/.test(p.beforeCountSql)),
);

/* ── 7. Deterministic rerun ────────────────────────────────────────────── */
const a1 = analyzeBatch(CSV, existing, incoming, 'pa-batch-100');
const a2 = analyzeBatch(CSV, existing, incoming, 'pa-batch-100');
check(
  'determinism: analyzeBatch byte-identical across runs',
  JSON.stringify(a1) === JSON.stringify(a2),
);
check('determinism: prepared summary present', a1.prepared.summary.totalRows === 2);

/* ── 8. CSV cleanliness through the real importer ──────────────────────── */
const clean = validateBatchCsv(CSV);
check('csv: clean batch imports 2/2', clean.clean && clean.imported === 2, clean);
const dirty = validateBatchCsv('name,category\nX,not-a-category');
check('csv: unknown category is not clean', !dirty.clean && dirty.skipped === 1);

/* ── 9. Verified-date validation ───────────────────────────────────────── */
check('date: valid ISO passes', validateVerifiedDate('2026-07-20', TODAY).ok);
check('date: non-ISO fails', !validateVerifiedDate('07/20/2026', TODAY).ok);
check('date: impossible date fails', !validateVerifiedDate('2026-02-31', TODAY).ok);
check('date: future date fails', !validateVerifiedDate('2027-01-01', TODAY).ok);
check('date: missing when required fails', !validateVerifiedDate('', TODAY, true).ok);
check('date: missing when optional ok', validateVerifiedDate('', TODAY, false).ok);

/* ── 10. Source-link shape ─────────────────────────────────────────────── */
check('link: bare host/path ok', validateSourceLink('ta-petro.com/location/va/ta-ashland').ok);
check('link: https ok', validateSourceLink('https://www.loves.com/x').ok);
check('link: javascript scheme rejected', !validateSourceLink('javascript:alert(1)').ok);
check(
  'link: prose named-source accepted (non-url)',
  validateSourceLink('allstays.com Virginia truck stops').ok,
);
check('link: empty rejected', !validateSourceLink('').ok);

/* ── 11. Provenance file ───────────────────────────────────────────────── */
const goodProv = [
  '# Batch — Sources',
  '',
  '### TA Ashland — Ashland, VA',
  '- **Verified:** 2026-07-20',
  '- **Source:** ta-petro.com/location/va/ta-ashland',
  '',
  '### Pilot #384 — Colonial Heights, VA',
  '- **Verified:** 2026-07-20',
  '- **Source:** pilotflyingj.com/z; iExit I-95 Exit 54',
  '',
].join('\n');
const prov = validateProvenanceFile(goodProv, TODAY);
check('prov: 2 entries parsed', prov.entryCount === 2, prov.entryCount);
check('prov: well-formed file is ok', prov.ok, prov);

const badProv = [
  '### Missing Everything — X, PA',
  'no fields here',
  '',
  '### Bad Date — Y, PA',
  '- **Verified:** 2026-13-40',
  '- **Source:** example.com',
  '',
  '### Future — Z, PA',
  '- **Verified:** 2030-01-01',
  '- **Source:** example.com',
  '',
].join('\n');
const badReport = validateProvenanceFile(badProv, TODAY);
check(
  'prov: missing verified captured',
  badReport.missingVerified.includes('Missing Everything — X, PA'),
);
check(
  'prov: missing source captured',
  badReport.missingSource.includes('Missing Everything — X, PA'),
);
check(
  'prov: bad date captured',
  badReport.badDates.some((d) => d.heading.startsWith('Bad Date')),
);
check(
  'prov: future date captured',
  badReport.badDates.some((d) => d.heading.startsWith('Future')),
);
check('prov: bad file is not ok', !badReport.ok);

const links = extractSourceLinks(goodProv, TODAY);
check(
  'prov: extractSourceLinks returns dereferenceable urls',
  links.length >= 2 && links.every((l) => /^https?:\/\//.test(l)),
);

/* ── done ──────────────────────────────────────────────────────────────── */
console.log(`\ndirectory-harness: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
