/**
 * Milestone 19 unit tests: the public map's pure logic — filter pipeline,
 * radius/nearest-first behavior, manual location search, directions URLs,
 * cluster grid sizing — plus the visibility invariants (unpublished and
 * coordinate-less entries can never reach the map).
 *
 * Run:
 *   npx esbuild scripts/test-map-explore.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-map-explore.cjs \
 *   && node /tmp/test-map-explore.cjs
 */
import {
  applyExploreFilters,
  searchLocation,
  directionsUrl,
  gridSizeForZoom,
  hasActiveFilters,
  EMPTY_FILTERS,
} from '@/lib/map/explore';
import { markersFromEntries, clusterMarkers } from '@/lib/map/cluster';
import { boundsForPoints, boundsContain } from '@/lib/map/bounds';
import { coordinateIssues } from '@/lib/map/geo';
import type { DirectoryEntry } from '@/lib/directory/types';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

const entry = (over: Partial<DirectoryEntry>): DirectoryEntry => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  category: 'truck-stops',
  name: 'Stop',
  state: 'GA',
  city: 'Dalton',
  slug: 'stop',
  ...over,
});

const POOL: DirectoryEntry[] = [
  entry({ id: 'pilot67', name: 'Pilot #67', city: 'Cartersville', zip: '30121', lat: 34.2727, lng: -84.8077, interstate: 'I-75', exitNumber: '296', amenities: ['Showers', 'Fuel', 'Overnight OK'] }),
  entry({ id: 'loves735', name: "Love's #735", city: 'Calhoun', lat: 34.4439, lng: -84.9152, interstate: 'I-75', amenities: ['Fuel', 'Free parking'] }),
  entry({ id: 'scale4561', name: 'CAT Scale Valdosta', category: 'cat-scales', city: 'Valdosta', lat: 30.7543, lng: -83.2732, interstate: 'I-75', amenities: ['CAT Scale'] }),
  entry({ id: 'ta-knox', name: 'TA Knoxville West', state: 'TN', city: 'Knoxville', lat: 35.8731, lng: -84.2379, interstate: 'I-40', amenities: ['Showers', 'Repair'] }),
];

/* ------------------------- filters ------------------------- */
{
  const all = applyExploreFilters(POOL, EMPTY_FILTERS, null);
  check('filters: no filters -> all', all.length === 4);
  check('filters: category', applyExploreFilters(POOL, { ...EMPTY_FILTERS, category: 'cat-scales' }, null).map((e) => e.id).join() === 'scale4561');
  check('filters: state', applyExploreFilters(POOL, { ...EMPTY_FILTERS, state: 'tn' }, null).map((e) => e.id).join() === 'ta-knox');
  check('filters: interstate', applyExploreFilters(POOL, { ...EMPTY_FILTERS, interstate: 'I-40' }, null).length === 1);
  check('filters: city', applyExploreFilters(POOL, { ...EMPTY_FILTERS, city: 'calhoun' }, null).length === 1);
  check('filters: single amenity', applyExploreFilters(POOL, { ...EMPTY_FILTERS, amenities: ['Showers'] }, null).length === 2);
  check('filters: AND amenities', applyExploreFilters(POOL, { ...EMPTY_FILTERS, amenities: ['Showers', 'Repair'] }, null).map((e) => e.id).join() === 'ta-knox');
  check('filters: parking chip', applyExploreFilters(POOL, { ...EMPTY_FILTERS, amenities: ['Overnight OK'] }, null).map((e) => e.id).join() === 'pilot67');
  check('filters: hasActiveFilters', !hasActiveFilters(EMPTY_FILTERS) && hasActiveFilters({ ...EMPTY_FILTERS, city: 'x' }));
}

/* ------------------------- radius + nearest-first ------------------------- */
{
  const origin = { lat: 34.1651, lng: -84.801, label: 'Cartersville' };
  const near = applyExploreFilters(POOL, EMPTY_FILTERS, origin);
  check('origin: distances attached', near.every((e) => e.distanceMiles != null));
  check('origin: nearest first', near[0].id === 'pilot67' && near[1].id === 'loves735', near.map((e) => `${e.id}:${e.distanceMiles}`));
  check('origin: distance sane (~7.4mi)', Math.abs((near[0].distanceMiles ?? 0) - 7.4) < 0.5);

  const r25 = applyExploreFilters(POOL, { ...EMPTY_FILTERS, radiusMiles: 25 }, origin);
  check('radius: 25mi keeps 2', r25.length === 2, r25.map((e) => e.id));
  const r10 = applyExploreFilters(POOL, { ...EMPTY_FILTERS, radiusMiles: 10 }, origin);
  check('radius: 10mi keeps 1', r10.length === 1 && r10[0].id === 'pilot67');
  // Radius without origin must be a no-op.
  const noOrigin = applyExploreFilters(POOL, { ...EMPTY_FILTERS, radiusMiles: 10 }, null);
  check('radius: inactive without origin', noOrigin.length === 4);
}

/* ------------------------- visibility invariants ------------------------- */
{
  // markersFromEntries drops coordinate-less rows — a listing without valid
  // coordinates can never become a marker.
  const withBad = [...POOL, entry({ id: 'nocoords' }), entry({ id: 'halfcoords', lat: 33.0 })];
  const markers = markersFromEntries(withBad);
  check('markers: only coordinate rows', markers.length === 4 && !markers.some((m) => m.id === 'nocoords' || m.id === 'halfcoords'));
  // Unpublished rows are excluded server-side (getEntriesWithCoordinates
  // filters is_published + deleted_at in SQL); the client pool never sees
  // them. Assert the invariant the server upholds: our pool has no flag to
  // leak, so coordinateIssues is the last line for bad coords.
  check('coords: 0/0 rejected', coordinateIssues(0, 0).length > 0);
  check('coords: swapped rejected', coordinateIssues(-84.8, 34.2).length > 0);
}

/* ------------------------- manual search (query parsing) ------------------------- */
{
  const names = { GA: 'Georgia', TN: 'Tennessee' };
  const city = searchLocation(POOL, 'Valdosta', names);
  check('search: city match', city.kind === 'match' && city.matches[0].id === 'scale4561');
  const cityState = searchLocation(POOL, 'Knoxville, TN', names);
  check('search: "city, st" match', cityState.kind === 'match' && cityState.matches[0].id === 'ta-knox');
  const stateName = searchLocation(POOL, 'tennessee', names);
  check('search: state name match', stateName.kind === 'match' && stateName.matches.length === 1);
  const stateCode = searchLocation(POOL, 'ga', names);
  check('search: state code match', stateCode.kind === 'match' && stateCode.matches.length === 3);
  const zip = searchLocation(POOL, '30121', names);
  check('search: zip match', zip.kind === 'match' && zip.matches[0].id === 'pilot67');
  const biz = searchLocation(POOL, "love's", names);
  check('search: business name match', biz.kind === 'match' && biz.matches[0].id === 'loves735');
  check('search: no match -> none (no invented coords)', searchLocation(POOL, 'Miami, FL', names).kind === 'none');
  check('search: empty -> none', searchLocation(POOL, '   ', names).kind === 'none');
  if (city.kind === 'match') {
    check('search: origin centered in bounds', boundsContain(city.bounds, { lat: city.origin.lat, lng: city.origin.lng }));
  }
}

/* ------------------------- clustering + bounds ------------------------- */
{
  const markers = markersFromEntries(POOL);
  const bounds = boundsForPoints(markers.map((m) => ({ lat: m.lat, lng: m.lng })))!;
  const coarse = clusterMarkers(markers, bounds, gridSizeForZoom(5));
  const fine = clusterMarkers(markers, bounds, gridSizeForZoom(13));
  const total = (cs: { markers: unknown[] }[]) => cs.reduce((n, c) => n + c.markers.length, 0);
  check('cluster: all markers accounted (coarse)', total(coarse) === 4);
  check('cluster: fine grid separates', fine.length === 4);
  check('cluster: zoom grid monotonic', gridSizeForZoom(4) < gridSizeForZoom(8) && gridSizeForZoom(8) < gridSizeForZoom(13));
  check('bounds: contain all markers', markers.every((m) => boundsContain(bounds, m)));
}

/* ------------------------- directions ------------------------- */
{
  const ok = directionsUrl({ lat: 34.2727, lng: -84.8077 });
  check('directions: standard url', ok === 'https://www.google.com/maps/dir/?api=1&destination=34.2727,-84.8077');
  check('directions: missing coords -> null', directionsUrl({ lat: undefined, lng: undefined }) === null);
  check('directions: 0/0 -> null', directionsUrl({ lat: 0, lng: 0 }) === null);
  check('directions: NaN -> null', directionsUrl({ lat: NaN, lng: -84 }) === null);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
