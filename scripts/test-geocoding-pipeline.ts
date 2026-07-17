/**
 * Phase 2A unit tests: mile-marker interpolation, calibration building, and
 * the dry-run geocoding pipeline. Pure logic only — no network, no database.
 *
 * Run:
 *   npx esbuild scripts/test-geocoding-pipeline.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-geocoding-pipeline.cjs \
 *   && node /tmp/test-geocoding-pipeline.cjs
 */
import {
  parseExitNumber,
  confidenceForGap,
  interpolateAlongCorridor,
  indexCalibrations,
  EXIT_NUMBERING,
  type CalibrationSet,
} from '@/lib/directory/interpolation';
import { buildCalibrations, type AnchorSourceRow } from '@/lib/directory/calibration';
import {
  runGeocodePipeline,
  dryRunCandidatesCsv,
  dryRunReportJson,
  nullGeocoder,
  type PipelineListing,
} from '@/lib/directory/geocode-pipeline';
import { parseGeocodingCsv, validateBatch, type LiveListingRef } from '@/lib/directory/geocoding';
import { STATE_BOUNDS, INTERSTATE_BOUNDS, boundsContain } from '@/lib/map/bounds';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}
const approx = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

/* ------------------------------------------------ exit number parsing */
check('exit: plain number', parseExitNumber('296') === 296);
check('exit: letter suffix', parseExitNumber('296A') === 296);
check('exit: dashed suffix', parseExitNumber('22-B') === 22);
check('exit: whitespace', parseExitNumber(' 105 ') === 105);
check('exit: blank is null', parseExitNumber('') === null);
check('exit: null is null', parseExitNumber(null) === null);
check('exit: non-numeric is null', parseExitNumber('A12') === null);
check('exit: 4+ digits rejected', parseExitNumber('1234') === null);

/* ------------------------------------------------ confidence by gap */
check('gap 5 → medium', confidenceForGap(5) === 'medium');
check('gap 10 → medium', confidenceForGap(10) === 'medium');
check('gap 25 → low', confidenceForGap(25) === 'low');
check('gap 30 → low', confidenceForGap(30) === 'low');
check('gap 31 → null', confidenceForGap(31) === null);

/* ------------------------------------------------ bounds additions */
check('AR bounds contain Little Rock', boundsContain(STATE_BOUNDS.AR, { lat: 34.74, lng: -92.28 }));
check('NC bounds contain Raleigh', boundsContain(STATE_BOUNDS.NC, { lat: 35.78, lng: -78.64 }));
check('SC bounds contain Columbia', boundsContain(STATE_BOUNDS.SC, { lat: 34.0, lng: -81.03 }));
check('VA bounds contain Richmond', boundsContain(STATE_BOUNDS.VA, { lat: 37.54, lng: -77.44 }));
check('MD bounds contain Baltimore', boundsContain(STATE_BOUNDS.MD, { lat: 39.29, lng: -76.61 }));
check('DE bounds contain Wilmington', boundsContain(STATE_BOUNDS.DE, { lat: 39.75, lng: -75.55 }));
check(
  'I-40 corridor contains Little Rock',
  boundsContain(INTERSTATE_BOUNDS['I-40'], { lat: 34.74, lng: -92.28 }),
);
check(
  'I-95 corridor contains Richmond',
  boundsContain(INTERSTATE_BOUNDS['I-95'], { lat: 37.54, lng: -77.44 }),
);
check(
  'every directory state has an exit-numbering entry for its bounds',
  Object.keys(EXIT_NUMBERING).every((st) => STATE_BOUNDS[st] !== undefined),
);

/* ------------------------------------------------ interpolation engine */
// Synthetic GA I-75 segment: two anchors 10 mileposts apart, ~10.9 road-miles.
const GA_CAL: CalibrationSet = [
  {
    interstate: 'I-75',
    state: 'GA',
    anchors: [
      { milepost: 100, lat: 32.0, lng: -83.7, source: 'test' },
      { milepost: 110, lat: 32.15, lng: -83.75, source: 'test' },
      { milepost: 140, lat: 32.6, lng: -83.9, source: 'test' },
    ],
  },
];
const cals = indexCalibrations(GA_CAL);

const mid = interpolateAlongCorridor(cals, 'GA', 'I-75', '105');
check(
  'interp: brackets correct pair',
  mid.ok && mid.lower.milepost === 100 && mid.upper.milepost === 110,
);
check('interp: midpoint lat', mid.ok && approx(mid.lat, 32.075, 0.001), mid);
check('interp: midpoint lng', mid.ok && approx(mid.lng, -83.725, 0.001), mid);
check('interp: 10-mi gap → medium', mid.ok && mid.confidence === 'medium');

const atAnchor = interpolateAlongCorridor(cals, 'GA', 'I-75', '100');
check(
  'interp: exact anchor returns anchor position',
  atAnchor.ok && atAnchor.lat === 32.0 && atAnchor.lng === -83.7,
);

const wideGap = interpolateAlongCorridor(cals, 'GA', 'I-75', '125');
check('interp: 30-mi gap → low confidence', wideGap.ok && wideGap.confidence === 'low');

check('interp: below range refused', !interpolateAlongCorridor(cals, 'GA', 'I-75', '90').ok);
const below = interpolateAlongCorridor(cals, 'GA', 'I-75', '90');
check('interp: below range reason', !below.ok && below.reason === 'outside-anchor-range');
const above = interpolateAlongCorridor(cals, 'GA', 'I-75', '150');
check(
  'interp: above range refused (no extrapolation)',
  !above.ok && above.reason === 'outside-anchor-range',
);

const seq = interpolateAlongCorridor(cals, 'DE', 'I-95', '4');
check('interp: sequential-exit state refused', !seq.ok && seq.reason === 'sequential-exit-state');
const unknownState = interpolateAlongCorridor(cals, 'XX', 'I-75', '105');
check(
  'interp: unknown state refused',
  !unknownState.ok && unknownState.reason === 'unknown-exit-numbering',
);
const noCal = interpolateAlongCorridor(cals, 'TN', 'I-75', '105');
check('interp: missing calibration refused', !noCal.ok && noCal.reason === 'no-calibration');
const noExit = interpolateAlongCorridor(cals, 'GA', 'I-75', '');
check('interp: missing exit refused', !noExit.ok && noExit.reason === 'no-exit-number');

// Wide-gap corridor: anchors 40 mileposts apart bracket nothing usable.
const WIDE_CAL = indexCalibrations([
  {
    interstate: 'I-75',
    state: 'GA',
    anchors: [
      { milepost: 100, lat: 32.0, lng: -83.7, source: 'test' },
      { milepost: 140, lat: 32.6, lng: -83.9, source: 'test' },
    ],
  },
]);
const tooWide = interpolateAlongCorridor(WIDE_CAL, 'GA', 'I-75', '120');
check(
  'interp: >30-mi anchor gap refused',
  !tooWide.ok && tooWide.reason === 'anchor-gap-too-large',
);

// Exact exit match beats gap limits: a verified anchor AT the exit places
// the listing there even on a sparse corridor.
const SPARSE_CAL = indexCalibrations([
  {
    interstate: 'I-75',
    state: 'GA',
    anchors: [
      { milepost: 100, lat: 32.0, lng: -83.7, source: 'test' },
      { milepost: 300, lat: 34.6, lng: -84.9, source: 'test' },
    ],
  },
]);
const exactSparse = interpolateAlongCorridor(SPARSE_CAL, 'GA', 'I-75', '300');
check(
  'interp: exact anchor match works despite huge gap',
  exactSparse.ok && exactSparse.lat === 34.6 && exactSparse.confidence === 'medium',
  exactSparse,
);

// Implausible anchors: 2 mileposts apart but ~104 miles apart on the ground.
const BAD_CAL = indexCalibrations([
  {
    interstate: 'I-75',
    state: 'GA',
    anchors: [
      { milepost: 100, lat: 32.0, lng: -83.7, source: 'test' },
      { milepost: 102, lat: 33.5, lng: -83.7, source: 'test' },
    ],
  },
]);
const implausible = interpolateAlongCorridor(BAD_CAL, 'GA', 'I-75', '101');
check(
  'interp: implausible anchor span refused',
  !implausible.ok && implausible.reason === 'implausible-result',
);

/* ------------------------------------------------ calibration builder */
const anchorRows: AnchorSourceRow[] = [
  {
    listingId: 'a',
    state: 'GA',
    interstate: 'I-75',
    exitNumber: '100',
    lat: 32.0,
    lng: -83.7,
    source: 'directory-verified',
  },
  {
    listingId: 'b',
    state: 'GA',
    interstate: 'I-75',
    exitNumber: '110',
    lat: 32.15,
    lng: -83.75,
    source: 'directory-verified',
  },
  {
    listingId: 'b2',
    state: 'GA',
    interstate: 'I-75',
    exitNumber: '110',
    lat: 32.15,
    lng: -83.75,
    source: 'geocoding-batch',
  },
  {
    listingId: 'c',
    state: 'GA',
    interstate: 'I-75',
    exitNumber: '105',
    lat: 38.0,
    lng: -83.72,
    source: 'directory-verified',
  }, // ~410 mi off — outlier
  {
    listingId: 'd',
    state: 'DE',
    interstate: 'I-95',
    exitNumber: '4',
    lat: 39.68,
    lng: -75.65,
    source: 'directory-verified',
  },
  {
    listingId: 'e',
    state: 'GA',
    interstate: 'I-75',
    exitNumber: '',
    lat: 32.2,
    lng: -83.76,
    source: 'directory-verified',
  },
  {
    listingId: 'f',
    state: 'TN',
    interstate: 'I-40',
    exitNumber: '70',
    lat: 35.6,
    lng: -88.8,
    source: 'directory-verified',
  }, // lone anchor → corridor dropped
];
const built = buildCalibrations(anchorRows);
check('calib: one usable corridor', built.calibrations.length === 1, built.calibrations);
check(
  'calib: outlier anchor rejected',
  built.rejected.length === 1 && built.rejected[0].anchor.listingId === 'c',
);
check(
  'calib: duplicate milepost skipped',
  built.skipped.some((s) => s.listingId === 'b2' && s.reason === 'duplicate-milepost'),
);
check(
  'calib: sequential state skipped',
  built.skipped.some((s) => s.listingId === 'd' && s.reason === 'sequential-exit-state'),
);
check(
  'calib: no-exit row skipped',
  built.skipped.some((s) => s.listingId === 'e' && s.reason === 'no-exit-number'),
);
check(
  'calib: surviving corridor anchors sorted and clean',
  built.calibrations[0]?.anchors.map((a) => a.milepost).join(',') === '100,110',
);

/* ------------------------------------------------ pipeline classification */
// The admin console contract requires UUID listing ids — mint stable ones.
const UUIDS: Record<string, string> = {};
let uuidSeq = 0;
const uuidFor = (key: string): string => {
  if (!UUIDS[key]) {
    uuidSeq++;
    UUIDS[key] = `00000000-0000-4000-8000-${String(uuidSeq).padStart(12, '0')}`;
  }
  return UUIDS[key];
};

const L = (over: Partial<PipelineListing>): PipelineListing => ({
  id: over.id ?? 'x',
  name: over.name ?? 'Test Stop',
  categorySlug: 'truck-stops',
  address: over.address ?? '',
  city: 'Macon',
  state: 'GA',
  zip: '31201',
  lat: null,
  lng: null,
  interstate: 'I-75',
  exitNumber: '',
  ...over,
});

const listings: PipelineListing[] = [
  L({ id: uuidFor('ok1'), lat: 32.01, lng: -83.7, exitNumber: '100' }), // good coords near anchor
  L({ id: uuidFor('sus1'), lat: 40.0, lng: -84.0 }), // valid US point, wrong state
  L({ id: uuidFor('inv1'), lat: 0, lng: 0 }), // hard-invalid
  L({ id: uuidFor('int1'), exitNumber: '105' }), // interpolation candidate
  L({ id: uuidFor('int2'), exitNumber: '105', name: 'Shares The Exit' }), // same exit → near-duplicate note vs nothing verified there; expect plain interpolated
  L({ id: uuidFor('conf1'), lat: 31.5, lng: -83.6, exitNumber: '105' }), // coords ~42 mi from interpolated spot
  L({
    id: uuidFor('ext1'),
    state: 'DE',
    interstate: 'I-95',
    exitNumber: '4',
    address: '100 Main St',
  }), // sequential state, has address
  L({ id: uuidFor('unres1'), exitNumber: '', address: '' }), // nothing to work with
  L({ id: uuidFor('unres2'), exitNumber: '300' }), // outside anchor range, no address
];
const report = runGeocodePipeline(listings, GA_CAL, { generatedAt: 'test-run' });
const byId2 = new Map(report.rows.map((r) => [r.listing.id, r]));

check(
  'pipe: good coords → already-geocoded',
  byId2.get(uuidFor('ok1'))?.klass === 'already-geocoded',
  byId2.get(uuidFor('ok1'))?.klass,
);
check(
  'pipe: wrong-state coords → existing-suspect',
  byId2.get(uuidFor('sus1'))?.klass === 'existing-suspect',
);
check('pipe: 0,0 → existing-invalid', byId2.get(uuidFor('inv1'))?.klass === 'existing-invalid');
check('pipe: missing+exit → interpolated', byId2.get(uuidFor('int1'))?.klass === 'interpolated');
check(
  'pipe: interpolated confidence medium',
  byId2.get(uuidFor('int1'))?.proposed?.confidence === 'medium',
);
check(
  'pipe: coords disagree with milepost → conflict',
  byId2.get(uuidFor('conf1'))?.klass === 'conflict',
  byId2.get(uuidFor('conf1')),
);
check('pipe: conflict miles recorded', (byId2.get(uuidFor('conf1'))?.conflictMiles ?? 0) > 30);
check(
  'pipe: sequential state w/ address → needs-external-geocode',
  byId2.get(uuidFor('ext1'))?.klass === 'needs-external-geocode',
);
check(
  'pipe: no exit, no address → unresolved',
  byId2.get(uuidFor('unres1'))?.klass === 'unresolved',
);
check(
  'pipe: out of anchor range, no address → unresolved',
  byId2.get(uuidFor('unres2'))?.klass === 'unresolved',
);
check(
  'pipe: unresolved reasons tallied',
  (report.summary.unresolvedReasons['no-exit-number'] ?? 0) >= 1 &&
    (report.summary.unresolvedReasons['outside-anchor-range'] ?? 0) >= 1 &&
    (report.summary.unresolvedReasons['sequential-exit-state'] ?? 0) >= 1,
);
check(
  'pipe: summary counts consistent',
  report.summary.total === listings.length &&
    report.summary.alreadyGeocoded === 1 &&
    report.summary.existingSuspect === 1 &&
    report.summary.existingInvalid === 1 &&
    report.summary.conflicts === 1 &&
    report.summary.interpolated === 2 &&
    report.summary.needsExternalGeocode === 1 &&
    report.summary.unresolved === 2,
  report.summary,
);

/* -------------------------------- duplicate-coordinate detection */
// A verified listing sits exactly where int-dup would interpolate to.
const dupListings: PipelineListing[] = [
  L({ id: uuidFor('ver1'), lat: 32.075, lng: -83.725 }),
  L({ id: uuidFor('int-dup'), exitNumber: '105' }),
];
const dupReport = runGeocodePipeline(dupListings, GA_CAL, { generatedAt: 'test-run' });
const dupRow = dupReport.rows.find((r) => r.listing.id === uuidFor('int-dup'));
check(
  'pipe: interpolated onto verified listing → near-duplicate flagged',
  dupRow?.nearListingId === uuidFor('ver1'),
  dupRow,
);

/* -------------------------------- candidates CSV round-trip */
const csv = dryRunCandidatesCsv(report);
const parsed = parseGeocodingCsv(csv);
check('csv: parses under the admin console contract', parsed.rows.length === 2, parsed.rows.length);
check(
  'csv: every row is manual-review',
  parsed.rows.every((r) => r.action === 'manual-review'),
);
check(
  'csv: confidence stays medium/low (never high)',
  parsed.rows.every((r) => r.confidence === 'medium' || r.confidence === 'low'),
);
check(
  'csv: proposed coordinates present',
  parsed.rows.every((r) => r.proposed_latitude != null && r.proposed_longitude != null),
);

const refs: LiveListingRef[] = listings.map((l) => ({
  id: l.id,
  name: l.name,
  address: l.address,
  city: l.city,
  state: l.state,
  lat: l.lat,
  lng: l.lng,
}));
const validated = validateBatch(parsed.rows, new Map(refs.map((r) => [r.id, r])));
check(
  'csv: zero rows auto-applicable through the console',
  validated.every((r) => !r.applicable),
  validated.map((r) => ({ id: r.listing_id, applicable: r.applicable })),
);
check(
  'csv: no identity mismatches against live refs',
  validated.every((r) => !r.problems.includes('identity-mismatch')),
  validated.map((r) => r.problems),
);

/* -------------------------------- report JSON + null geocoder */
const json = JSON.parse(dryRunReportJson(report));
check('json: rows serialized', json.rows.length === listings.length);
check('json: summary embedded', json.summary.total === listings.length);
check(
  'json: interpolation provenance present',
  json.rows.find((r: { id: string }) => r.id === uuidFor('int1')).interpolation.lowerMilepost ===
    100,
);

void nullGeocoder
  .geocode({ address: '1 Main St', city: 'Macon', state: 'GA', zip: '31201' })
  .then((r) => {
    check('null geocoder resolves nothing', r === null);
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
