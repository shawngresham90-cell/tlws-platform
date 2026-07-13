/**
 * Unit tests for `lib/directory/coordinate-verification` — the pure
 * state-bounds / corridor-bounds coordinate cross-check behind the
 * geocoding review workflow.
 *
 * Run:
 *   npx esbuild scripts/test-coordinate-verification.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-coordver.cjs && node /tmp/test-coordver.cjs
 */
import {
  milesOutsideBounds,
  normalizeInterstate,
  verifyListingCoordinate,
  verifyCoordinateBatch,
  verificationReportCsv,
} from '@/lib/directory/coordinate-verification';
import { STATE_BOUNDS } from '@/lib/map/bounds';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

/* ---------------------- milesOutsideBounds ---------------------- */
{
  const tn = STATE_BOUNDS.TN;
  check('inside bounds → 0', milesOutsideBounds(tn, { lat: 36.16, lng: -86.78 }) === 0);
  const oneDegNorth = milesOutsideBounds(tn, { lat: tn.north + 1, lng: -86.78 });
  check('1° north of bounds ≈ 69 mi', Math.abs(oneDegNorth - 69.09) < 0.7, oneDegNorth);
  check('corner distance uses nearest point', milesOutsideBounds(tn, { lat: tn.north + 1, lng: tn.east + 1 }) > oneDegNorth);
}

/* ---------------------- normalizeInterstate ---------------------- */
{
  check('I-75 stays', normalizeInterstate('I-75') === 'I-75');
  check('i75 normalized', normalizeInterstate('i75') === 'I-75');
  check('I 24 normalized', normalizeInterstate('I 24') === 'I-24');
  check('null → empty', normalizeInterstate(null) === '');
  check('junk → empty', normalizeInterstate('US-45') === '');
}

/* ---------------------- verifyListingCoordinate ---------------------- */
{
  // Nashville TN on I-24: inside state + corridor
  const ok = verifyListingCoordinate({ id: '1', name: 'A', city: 'Nashville', state: 'TN', interstate: 'I-24', lat: 36.16, lng: -86.78 });
  check('valid TN point → ok', ok.severity === 'ok' && ok.findings.length === 0, ok);

  // No coordinates: the normal pre-geocode case, not an error
  const none = verifyListingCoordinate({ state: 'TN', lat: null, lng: null });
  check('missing coords → no-coordinates', none.severity === 'no-coordinates' && none.findings.join() === 'no-coordinates');

  // Hard-invalid short-circuits (null island)
  const inv = verifyListingCoordinate({ state: 'TN', lat: 0, lng: 0 });
  check('0,0 → invalid via coordinateIssues', inv.severity === 'invalid' && inv.findings.includes('zero-zero'));

  // Wrong state: an Atlanta GA point on a "TN" listing
  const wrong = verifyListingCoordinate({ state: 'TN', lat: 33.75, lng: -84.39 });
  check('GA point on TN listing → suspect', wrong.severity === 'suspect' && wrong.findings.includes('outside-state-bounds'));
  check('wrong-state distance is meaningful (>50mi)', wrong.milesOutsideState > 50, wrong.milesOutsideState);

  // Corridor check: a Memphis point (fine for TN) on an "I-75" listing is far off the I-75 corridor
  const corr = verifyListingCoordinate({ state: 'TN', interstate: 'I-75', lat: 35.15, lng: -90.05 });
  check('Memphis on I-75 listing → suspect corridor', corr.severity === 'suspect' && corr.findings.includes('outside-interstate-corridor'), corr);
  check('corridor miss but state ok has milesOutsideState 0', corr.milesOutsideState === 0);

  // Unknown state code → flagged, never crashes
  const unk = verifyListingCoordinate({ state: 'XX', lat: 36.0, lng: -86.0 });
  check('unknown state → state-unknown finding, ok severity', unk.findings.includes('state-unknown') && unk.severity === 'ok');

  // All 8 live-data states have bounds coverage
  for (const st of ['GA', 'TN', 'FL', 'KY', 'OH', 'MI', 'AL', 'IN', 'IL']) {
    check(`STATE_BOUNDS covers ${st}`, !!STATE_BOUNDS[st]);
  }
}

/* ---------------------- verifyCoordinateBatch ---------------------- */
{
  const { results, summary } = verifyCoordinateBatch([
    { id: 'a', name: 'Good', state: 'KY', lat: 37.0, lng: -87.0 },
    { id: 'b', name: 'WrongState', state: 'KY', lat: 30.0, lng: -87.0 },
    { id: 'c', name: 'NullIsland', state: 'KY', lat: 0, lng: 0 },
    { id: 'd', name: 'NotYet', state: 'KY' },
    { id: 'e', name: 'Mystery', state: 'ZZ', lat: 37.0, lng: -87.0 },
  ]);
  check('batch preserves order', results.map((r) => r.id).join('') === 'abcde');
  check('summary total', summary.total === 5);
  check('summary ok (incl. state-unknown row)', summary.ok === 2, summary);
  check('summary suspect', summary.suspect === 1);
  check('summary invalid', summary.invalid === 1);
  check('summary noCoordinates', summary.noCoordinates === 1);
  check('statesWithoutBounds lists ZZ', summary.statesWithoutBounds.join() === 'ZZ');

  const csv = verificationReportCsv(results);
  const lines = csv.split('\r\n');
  check('report has header + 3 non-ok rows', lines.length === 4, lines.length);
  check('invalid sorts before suspect', lines[1].includes('NullIsland') && lines[2].includes('WrongState'), lines);
  check('report omits ok rows', !csv.includes('Good'));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
