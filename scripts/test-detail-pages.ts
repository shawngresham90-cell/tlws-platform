/**
 * Milestone 20 unit tests: per-listing detail pages — slug generation and
 * collision handling, the route-param guard, nearby ranking (distance /
 * exit-window / city fallbacks, self-exclusion, caps, empty sections), the
 * completeness gate that decides indexability, unique meta copy, directions
 * fallbacks, and the detail LocalBusiness/Place schema (AggregateRating and
 * Review only from approved data, geo only with coordinates).
 *
 * Run:
 *   npx esbuild scripts/test-detail-pages.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-detail-pages.cjs \
 *   && node /tmp/test-detail-pages.cjs
 */
import {
  detailSlugBase,
  uniqueDetailSlug,
  isValidDetailSlug,
  detailHref,
} from '@/lib/directory/detail-slug';
import {
  nearbySections,
  isDetailIndexable,
  detailTitle,
  detailDescription,
  detailDirectionsUrl,
  NEARBY_SECTION_CAP,
} from '@/lib/directory/detail';
import { listingDetailSchema } from '@/lib/directory/seo';
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

/* ------------------------- slug generation ------------------------- */
{
  check(
    'slug: name-city-state',
    detailSlugBase('Pilot Travel Center #4558', 'Dalton', 'GA') ===
      'pilot-travel-center-4558-dalton-ga',
  );
  check("slug: punctuation collapses", detailSlugBase("Love's #550", 'Valdosta', 'GA') === 'love-s-550-valdosta-ga');
  check('slug: whitespace + case', detailSlugBase('  TA  LAKE Park ', 'Lake Park', 'ga') === 'ta-lake-park-lake-park-ga');
  check('slug: never empty', detailSlugBase('***', '!!', '@') === 'listing');
  check('slug: capped length', detailSlugBase('x'.repeat(300), 'y'.repeat(300), 'GA').length <= 100);
  check('slug: no leading/trailing hyphen', /^[a-z0-9].*[a-z0-9]$/.test(detailSlugBase('—Big Foot—', 'Cartersville', 'GA')));
}

/* ------------------------- collision handling ------------------------- */
{
  const taken = new Set(['pilot-dalton-ga', 'pilot-dalton-ga-2']);
  check('collision: free base untouched', uniqueDetailSlug('loves-dalton-ga', taken) === 'loves-dalton-ga');
  check('collision: suffix increments', uniqueDetailSlug('pilot-dalton-ga', taken) === 'pilot-dalton-ga-3');
  check('collision: first suffix is -2', uniqueDetailSlug('ta-dalton-ga', new Set(['ta-dalton-ga'])) === 'ta-dalton-ga-2');
}

/* ------------------------- route-param guard ------------------------- */
{
  check('guard: valid slug', isValidDetailSlug('pilot-travel-center-4558-dalton-ga'));
  check('guard: single char', isValidDetailSlug('a'));
  check('guard: rejects uppercase', !isValidDetailSlug('Pilot-Dalton-GA'));
  check('guard: rejects path tricks', !isValidDetailSlug('../etc/passwd') && !isValidDetailSlug('a/b'));
  check('guard: rejects empty + hyphen edges', !isValidDetailSlug('') && !isValidDetailSlug('-abc') && !isValidDetailSlug('abc-'));
  check('guard: rejects overlong', !isValidDetailSlug('a'.repeat(121)));
  check('href: detail path', detailHref('x-y-z') === '/directory/location/x-y-z');
}

/* ------------------------- fixtures ------------------------- */
const entry = (over: Partial<DirectoryEntry>): DirectoryEntry => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  category: 'truck-stops',
  name: 'Stop',
  state: 'GA',
  city: 'Dalton',
  slug: 'stop',
  ...over,
});

const CURRENT = entry({
  id: 'current',
  name: 'Pilot Travel Center #4558',
  city: 'Dalton',
  lat: 34.7357,
  lng: -84.9227,
  interstate: 'I-75',
  exitNumber: '328',
  address: '324 Carbondale Rd',
  detailSlug: 'pilot-travel-center-4558-dalton-ga',
});

const POOL: DirectoryEntry[] = [
  CURRENT, // the page's own listing — must never appear in nearby
  entry({ id: 'near-stop', name: 'TA Dalton', city: 'Dalton', lat: 34.76, lng: -84.93, detailSlug: 'ta-dalton-ga' }),
  entry({ id: 'far-stop', name: 'TA Lake Park', city: 'Lake Park', lat: 30.94, lng: -83.19, detailSlug: 'ta-lake-park-lake-park-ga' }),
  entry({ id: 'exit-scale', name: 'CAT Scale Exit 333', category: 'cat-scales', city: 'Calhoun', interstate: 'I-75', exitNumber: '333' }),
  entry({ id: 'far-exit-scale', name: 'CAT Scale Exit 2', category: 'cat-scales', city: 'Valdosta', interstate: 'I-75', exitNumber: '2' }),
  entry({ id: 'city-wash', name: 'Blue Beacon Dalton', category: 'truck-washes', city: 'Dalton' }),
  entry({ id: 'other-town-wash', name: 'Wash Macon', category: 'truck-washes', city: 'Macon' }),
  entry({ id: 'near-parking-1', name: 'Lot A', category: 'parking', city: 'Dalton', lat: 34.74, lng: -84.92 }),
  entry({ id: 'near-parking-2', name: 'Lot B', category: 'parking', city: 'Dalton', lat: 34.73, lng: -84.91 }),
  entry({ id: 'near-parking-3', name: 'Lot C', category: 'parking', city: 'Dalton', lat: 34.72, lng: -84.9 }),
  entry({ id: 'near-parking-4', name: 'Lot D', category: 'parking', city: 'Dalton', lat: 34.71, lng: -84.89 }),
  entry({ id: 'near-parking-5', name: 'Lot E', category: 'parking', city: 'Dalton', lat: 34.7, lng: -84.88 }),
];

/* ------------------------- nearby ranking ------------------------- */
{
  const sections = nearbySections(CURRENT, POOL);
  const bySlug = Object.fromEntries(sections.map((s) => [s.slug, s]));

  check('nearby: excludes the current listing', !sections.some((s) => s.items.some((i) => i.entry.id === 'current')));
  check('nearby: distance beats distance (near first)', bySlug['truck-stops']?.items[0]?.entry.id === 'near-stop');
  check('nearby: distance attached when both have coords', bySlug['truck-stops']?.items[0]?.distanceMiles != null && (bySlug['truck-stops'].items[0].distanceMiles ?? 99) < 3);
  check('nearby: >75mi coordinate pairs dropped', !bySlug['truck-stops']?.items.some((i) => i.entry.id === 'far-stop'));
  check('nearby: exit window includes exit 333', bySlug['cat-scales']?.items.some((i) => i.entry.id === 'exit-scale'));
  check('nearby: exit window excludes exit 2 (326mi away)', !bySlug['cat-scales']?.items.some((i) => i.entry.id === 'far-exit-scale'));
  check('nearby: same-city fallback (no coords/exits)', bySlug['truck-washes']?.items.some((i) => i.entry.id === 'city-wash'));
  check('nearby: unrelated town excluded', !bySlug['truck-washes']?.items.some((i) => i.entry.id === 'other-town-wash'));
  check('nearby: sections capped', sections.every((s) => s.items.length <= NEARBY_SECTION_CAP), sections.map((s) => `${s.slug}:${s.items.length}`));
  check('nearby: parking capped at 4 of 5', bySlug['parking']?.items.length === NEARBY_SECTION_CAP);
  check('nearby: empty sections dropped', !bySlug['tire-repair'] && !bySlug['roadside-service'] && !bySlug['hotels-truck-parking']);
  check('nearby: no duplicate cards', sections.every((s) => new Set(s.items.map((i) => i.entry.id)).size === s.items.length));

  // A coordinate-less current listing falls back to exit/city relations.
  const noCoords = entry({ id: 'nc', name: 'No Coords Stop', city: 'Dalton', interstate: 'I-75', exitNumber: '328' });
  const fallback = nearbySections(noCoords, POOL);
  const fb = Object.fromEntries(fallback.map((s) => [s.slug, s]));
  check('nearby fallback: exit window works without coords', fb['cat-scales']?.items.some((i) => i.entry.id === 'exit-scale'));
  check('nearby fallback: same-city works without coords', fb['truck-stops']?.items.some((i) => i.entry.id === 'near-stop'));
  check('nearby fallback: no distances invented', fallback.every((s) => s.items.every((i) => i.distanceMiles == null)));
}

/* ------------------------- completeness gate ------------------------- */
{
  const rich = entry({
    address: '324 Carbondale Rd',
    phone: '(706) 555-0100',
    website: 'https://example.com',
    amenities: ['Showers'],
  });
  check('indexable: address + 2 signals', isDetailIndexable(rich));
  check('indexable: coords count as a signal', isDetailIndexable(entry({ address: 'x', lat: 34, lng: -84, phone: '555' })));
  const thin = entry({});
  check('noindex: no address', !isDetailIndexable(thin));
  check('noindex: address but 1 signal', !isDetailIndexable(entry({ address: 'x', phone: '555' })));
  check('noindex: short description not a signal', !isDetailIndexable(entry({ address: 'x', description: 'ok' })));
  check('noindex: unknown category', !isDetailIndexable(entry({ category: 'mystery', address: 'x', phone: '5', website: 'https://x.com' })));
}

/* ------------------------- meta copy ------------------------- */
{
  const a = entry({ name: 'Pilot #4558', city: 'Dalton', interstate: 'I-75', exitNumber: '328', parkingSpaces: 80, amenities: ['Showers', 'Fuel'] });
  const b = entry({ name: 'TA Lake Park', city: 'Lake Park' });
  check('meta: unique titles', detailTitle(a) !== detailTitle(b));
  check('meta: title has name + city', detailTitle(a).includes('Pilot #4558') && detailTitle(a).includes('Dalton, GA'));
  check('meta: unique descriptions', detailDescription(a) !== detailDescription(b));
  check('meta: description mentions exit + spaces', detailDescription(a).includes('Exit 328') && detailDescription(a).includes('80 truck spaces'));
  check('meta: description bounded', detailDescription(entry({ name: 'N'.repeat(120), city: 'C'.repeat(60), amenities: ['A'.repeat(60)] })).length <= 170);
}

/* ------------------------- directions ------------------------- */
{
  check(
    'directions: coords win',
    detailDirectionsUrl(entry({ lat: 34.7357, lng: -84.9227, address: '324 Carbondale Rd' })) ===
      'https://www.google.com/maps/dir/?api=1&destination=34.7357,-84.9227',
  );
  const byAddress = detailDirectionsUrl(entry({ address: '324 Carbondale Rd', zip: '30721' }));
  check('directions: address fallback (encoded, no invented coords)', byAddress === `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent('324 Carbondale Rd, Dalton, GA, 30721')}`);
  check('directions: nothing safe -> null', detailDirectionsUrl(entry({})) === null);
  check('directions: 0/0 coords fall back to address', detailDirectionsUrl(entry({ lat: 0, lng: 0, address: 'x' }))?.includes('destination=x') === true);
}

/* ------------------------- detail schema ------------------------- */
{
  const full = entry({
    id: 'loc1',
    name: 'Pilot #4558',
    address: '324 Carbondale Rd',
    zip: '30721',
    phone: '(706) 555-0100',
    website: 'https://example.com',
    lat: 34.7357,
    lng: -84.9227,
    updatedAt: '2026-07-01T12:00:00Z',
  });
  const reviews = [
    { rating: 5, title: 'Great', body: 'Clean showers', reviewerName: 'Driver A', createdAt: '2026-07-03T00:00:00Z' },
  ];
  const schema = listingDetailSchema(full, '/directory/location/pilot-4558-dalton-ga', { count: 3, average: 4.7 }, reviews) as Record<string, unknown>;
  check('schema: LocalBusiness for businesses', schema['@type'] === 'LocalBusiness');
  check('schema: @context present', schema['@context'] === 'https://schema.org');
  check('schema: canonical @id + mainEntityOfPage', String(schema['@id']).endsWith('/directory/location/pilot-4558-dalton-ga#listing') && String(schema.mainEntityOfPage).endsWith('/directory/location/pilot-4558-dalton-ga'));
  check('schema: geo present with coords', JSON.stringify(schema).includes('GeoCoordinates'));
  check('schema: aggregateRating from approved stats', JSON.stringify(schema).includes('"reviewCount":3'));
  check('schema: review objects present', Array.isArray(schema.review) && (schema.review as unknown[]).length === 1);
  check('schema: dateModified from newest review', schema.dateModified === '2026-07-03');

  const weigh = entry({ id: 'w1', category: 'weigh-stations', name: 'GA DPS Scale' });
  const weighSchema = listingDetailSchema(weigh, '/directory/location/x', null, []) as Record<string, unknown>;
  check('schema: Place for weigh stations', weighSchema['@type'] === 'Place');
  check('schema: no rating without approved reviews', !JSON.stringify(weighSchema).includes('aggregateRating'));
  check('schema: no review array without approved reviews', weighSchema.review === undefined);
  check('schema: no geo without coords', !JSON.stringify(weighSchema).includes('GeoCoordinates'));
  const noUpdated = listingDetailSchema(entry({ id: 'n1' }), '/directory/location/y', null, []) as Record<string, unknown>;
  check('schema: no dateModified without data', noUpdated.dateModified === undefined);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
