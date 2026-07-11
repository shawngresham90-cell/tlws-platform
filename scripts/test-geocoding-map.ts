/**
 * Milestone 17 unit tests: geodesy, coordinate validation, geocoding batch
 * validation, map filters, clustering, and bounds. Pure logic only — no
 * network, no database.
 *
 * Run:
 *   npx esbuild scripts/test-geocoding-map.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-geocoding-map.cjs \
 *   && node /tmp/test-geocoding-map.cjs
 */
import {
  haversineMiles,
  coordinateIssues,
  isValidUsCoordinate,
  withDistance,
  sortByDistance,
  withinRadius,
} from '@/lib/map/geo';
import { boundsForPoints, boundsContain, padBounds, boundsCenter } from '@/lib/map/bounds';
import { clusterMarkers, markersFromEntries, filterMarkers } from '@/lib/map/cluster';
import {
  applyScope,
  filterEntriesByState,
  filterEntriesByInterstate,
  filterEntriesByCategory,
  boundsForScope,
  buildMapDataset,
} from '@/lib/map/data';
import {
  parseGeocodingCsv,
  validateBatch,
  rejectedRowsCsv,
  GEOCODING_COLUMNS,
  type LiveListingRef,
} from '@/lib/directory/geocoding';
import type { DirectoryEntry } from '@/lib/directory/types';

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

/* ------------------------------------------------ haversine */
// Atlanta ⇄ Chattanooga is ~106 miles great-circle.
const ATL = { lat: 33.749, lng: -84.388 };
const CHA = { lat: 35.0456, lng: -85.3097 };
check('haversine: ATL–CHA ≈ 106 mi', approx(haversineMiles(ATL, CHA), 106, 4), haversineMiles(ATL, CHA));
check('haversine: zero distance', haversineMiles(ATL, ATL) === 0);
check('haversine: symmetric', haversineMiles(ATL, CHA) === haversineMiles(CHA, ATL));
// One degree of latitude ≈ 69 miles.
check(
  'haversine: 1° latitude ≈ 69 mi',
  approx(haversineMiles({ lat: 34, lng: -84 }, { lat: 35, lng: -84 }), 69.05, 0.3),
);

/* ------------------------------------------------ coordinate validation */
check('coords: valid GA point', isValidUsCoordinate(34.5, -84.9));
check('coords: 0/0 rejected', coordinateIssues(0, 0).includes('zero-zero'));
check('coords: lat 91 rejected', coordinateIssues(91, -84).includes('lat-out-of-range'));
check('coords: lng -190 rejected', coordinateIssues(34, -190).includes('lng-out-of-range'));
check('coords: NaN rejected', coordinateIssues(NaN, -84).includes('not-finite'));
check('coords: Paris rejected (outside US)', coordinateIssues(48.85, 2.35).includes('outside-us'));
check(
  'coords: swapped lat/lng rejected',
  !isValidUsCoordinate(-84.9, 34.5), // a lat of -84.9 is out of US bounds
);

/* ------------------------------------------------ distance pipeline */
{
  const items = [
    { id: 'a', lat: 35.0, lng: -85.0 },
    { id: 'b', lat: 34.0, lng: -84.0 },
    { id: 'c', lat: undefined as number | undefined, lng: undefined as number | undefined },
  ];
  const origin = { lat: 34.0, lng: -84.0 };
  const withD = withDistance(items, origin);
  check('withDistance: drops missing coords', withD.length === 2);
  const sorted = sortByDistance(withD);
  check('sortByDistance: nearest first', sorted[0].id === 'b' && sorted[1].id === 'a');
  check('withinRadius: filters', withinRadius(sorted, 10).length === 1);
}

/* ------------------------------------------------ bounds */
{
  const pts = [
    { lat: 34.9, lng: -85.2 },
    { lat: 30.8, lng: -83.5 },
  ];
  const b = boundsForPoints(pts)!;
  // boundsForPoints pads 10% so edge markers don't hug the frame.
  check(
    'bounds: contains all points with padding',
    pts.every((p) => boundsContain(b, p)) && b.north > 34.9 && b.south < 30.8,
    b,
  );
  check('bounds: contains inner point', boundsContain(b, { lat: 33, lng: -84 }));
  check('bounds: excludes outer point', !boundsContain(b, { lat: 36, lng: -84 }));
  const padded = padBounds(b, 0.1);
  check('bounds: padding expands', padded.north > b.north && padded.south < b.south);
  const c = boundsCenter(b);
  check('bounds: center inside', boundsContain(b, c));
  check('bounds: empty → null', boundsForPoints([]) === null);
}

/* ------------------------------------------------ entries + clustering */
const entry = (over: Partial<DirectoryEntry>): DirectoryEntry => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  category: 'truck-stops',
  name: 'Stop',
  state: 'GA',
  city: 'Dalton',
  slug: 'stop',
  ...over,
});
{
  const entries = [
    entry({ id: '1', state: 'GA', interstate: 'I-75', lat: 34.7, lng: -84.9 }),
    entry({ id: '2', state: 'TN', interstate: 'I-75', category: 'cat-scales', lat: 35.2, lng: -84.8 }),
    entry({ id: '3', state: 'TN', interstate: 'I-40', lat: 35.9, lng: -83.9 }),
    entry({ id: '4', state: 'GA' }), // no coords
  ];
  check('filter: by state', filterEntriesByState(entries, 'tn').length === 2);
  check('filter: by interstate', filterEntriesByInterstate(entries, 'I-75').length === 2);
  check('filter: by category', filterEntriesByCategory(entries, 'cat-scales').length === 1);
  check(
    'filter: combined scope',
    applyScope(entries, { state: 'TN', interstate: 'I-75' }).map((e) => e.id).join() === '2',
  );

  const markers = markersFromEntries(entries);
  check('markers: only coordinate-bearing entries', markers.length === 3);
  check('markers: category filter', filterMarkers(markers, ['cat-scales']).length === 1);
  check('markers: empty filter = all', filterMarkers(markers, []).length === 3);

  const bounds = boundsForScope(entries, {});
  const clusters = clusterMarkers(markers, bounds, 2); // coarse grid forces merging
  const total = clusters.reduce((n, c) => n + c.markers.length, 0);
  check('cluster: every marker lands in exactly one cluster', total === 3);
  check('cluster: coarse grid merges', clusters.length < 3, clusters.length);
  const fine = clusterMarkers(markers, bounds, 64);
  check('cluster: fine grid separates', fine.length === 3, fine.length);
  for (const c of clusters) {
    const latOk = c.markers.every((m) => approx(c.lat, m.lat, 2));
    check('cluster: centroid near members', latOk);
  }

  const dataset = buildMapDataset(entries, { state: 'TN' }, 12);
  check('dataset: scoped entries', dataset.entries.length === 2);
  check(
    'dataset: bounds contain scoped markers',
    dataset.entries
      .filter((e) => e.lat != null)
      .every((e) => boundsContain(dataset.bounds, { lat: e.lat!, lng: e.lng! })),
  );

  // Empty scope with a named state falls back to that state's preset bounds.
  const empty = boundsForScope([], { state: 'GA' });
  check('dataset: empty GA scope uses preset bounds', boundsContain(empty, { lat: 32.6, lng: -83.4 }));
}

/* ------------------------------------------------ geocoding CSV */
const LIVE = new Map<string, LiveListingRef>([
  [
    '11111111-1111-4111-8111-111111111111',
    { id: '11111111-1111-4111-8111-111111111111', name: 'Adel Truck Plaza', address: '1503 W 4th St', city: 'Adel', state: 'GA', lat: null, lng: null },
  ],
  [
    '22222222-2222-4222-8222-222222222222',
    { id: '22222222-2222-4222-8222-222222222222', name: 'TA Cartersville', address: '981 Cassville-White Rd', city: 'Cartersville', state: 'GA', lat: 34.244, lng: -84.82 },
  ],
]);

const HEADER = GEOCODING_COLUMNS.join(',');
const goodRow =
  '11111111-1111-4111-8111-111111111111,Adel Truck Plaza,truck-stops,1503 W 4th St,Adel,GA,31620,,,31.13871,-83.44229,high,https://example.com/src,verified,ready';

{
  const { rows, errors } = parseGeocodingCsv(`${HEADER}\n${goodRow}\n`);
  check('csv: parses valid row', rows.length === 1 && errors.length === 0, errors);
  check('csv: numbers coerced', rows[0]?.proposed_latitude === 31.13871);

  const validated = validateBatch(rows, LIVE);
  check('validate: good row applicable', validated[0].applicable, validated[0].problemDetails);
  check('validate: no overwrite for null coords', !validated[0].wouldOverwrite);

  // Missing header column is fatal.
  const noHeader = parseGeocodingCsv(`listing_id,business_name\nabc,def`);
  check('csv: missing columns fatal', noHeader.rows.length === 0 && noHeader.errors.length === 1);

  // Bad UUID is a row error.
  const badId = parseGeocodingCsv(`${HEADER}\n${goodRow.replace('11111111-1111-4111-8111-111111111111', 'not-a-uuid')}`);
  check('csv: bad uuid rejected', badId.rows.length === 0 && badId.errors.length === 1);

  // Unknown id blocks.
  const unknown = validateBatch(
    parseGeocodingCsv(`${HEADER}\n${goodRow.replace(/^1{8}/, '99999999')}`).rows,
    LIVE,
  );
  check('validate: unknown id blocked', !unknown[0].applicable && unknown[0].problems.includes('unknown-listing-id'));

  // Identity mismatch: right id, wrong city (name matching alone must not pass).
  const mismatch = validateBatch(
    parseGeocodingCsv(`${HEADER}\n${goodRow.replace(',Adel,', ',Macon,')}`).rows,
    LIVE,
  );
  check('validate: id+address identity check', mismatch[0].problems.includes('identity-mismatch'));

  // Medium confidence never applicable even when marked ready.
  const medium = validateBatch(
    parseGeocodingCsv(`${HEADER}\n${goodRow.replace(',high,', ',medium,')}`).rows,
    LIVE,
  );
  check('validate: medium blocked', !medium[0].applicable && medium[0].problems.includes('not-high-confidence'));

  // manual-review action blocked.
  const review = validateBatch(
    parseGeocodingCsv(`${HEADER}\n${goodRow.replace(/,ready$/, ',manual-review')}`).rows,
    LIVE,
  );
  check('validate: manual-review blocked', !review[0].applicable && review[0].problems.includes('not-ready'));

  // 0/0 and swapped coordinates blocked.
  const zero = validateBatch(
    parseGeocodingCsv(`${HEADER}\n${goodRow.replace('31.13871,-83.44229', '0,0')}`).rows,
    LIVE,
  );
  check('validate: 0/0 blocked', zero[0].problems.includes('invalid-coordinates'));
  const swapped = validateBatch(
    parseGeocodingCsv(`${HEADER}\n${goodRow.replace('31.13871,-83.44229', '-83.44229,31.13871')}`).rows,
    LIVE,
  );
  check('validate: swapped lat/lng blocked', swapped[0].problems.includes('invalid-coordinates'));

  // Ready row without coordinates blocked.
  const noCoords = validateBatch(
    parseGeocodingCsv(`${HEADER}\n${goodRow.replace('31.13871,-83.44229', ',')}`).rows,
    LIVE,
  );
  check('validate: ready w/o coords blocked', noCoords[0].problems.includes('missing-coordinates'));

  // Duplicate listing_id blocks both.
  const dup = validateBatch(parseGeocodingCsv(`${HEADER}\n${goodRow}\n${goodRow}`).rows, LIVE);
  check('validate: duplicates blocked', dup.every((r) => r.problems.includes('duplicate-listing-id')));

  // Overwrite detection on a listing that already has coords.
  const overwriteRow =
    '22222222-2222-4222-8222-222222222222,TA Cartersville,truck-stops,981 Cassville-White Rd,Cartersville,GA,30121,,,34.2441,-84.8305,high,https://example.com,verified,ready';
  const over = validateBatch(parseGeocodingCsv(`${HEADER}\n${overwriteRow}`).rows, LIVE);
  check('validate: overwrite flagged + still applicable', over[0].applicable && over[0].wouldOverwrite);

  // Rejected CSV includes only blocked rows plus a problems column.
  const mixed = validateBatch(parseGeocodingCsv(`${HEADER}\n${goodRow}\n${goodRow.replace(',high,', ',low,')}`).rows, LIVE);
  const rejectedCsv = rejectedRowsCsv(mixed);
  check(
    'rejected csv: blocked rows only, with problems column',
    rejectedCsv.includes('problems') && rejectedCsv.split('\n').filter((l) => l.trim()).length >= 3,
    rejectedCsv.split('\n').length,
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
