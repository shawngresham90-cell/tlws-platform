/**
 * Unit tests for the public directory search + sort (`lib/directory/browse`) —
 * the pure logic behind the browser component: multi-field haystack search,
 * state/city filters, and the four sort modes.
 *
 * Run:
 *   npx esbuild scripts/test-browse.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-browse.cjs && node /tmp/test-browse.cjs
 */
import { filterAndSortEntries, distanceMiles } from '@/lib/directory/browse';
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

let n = 0;
function entry(over: Partial<DirectoryEntry> = {}): DirectoryEntry {
  n += 1;
  return {
    id: `id-${n}`,
    category: 'truck-stops',
    name: `Stop ${n}`,
    state: 'TN',
    city: 'Nashville',
    slug: `stop-${n}`,
    ...over,
  };
}
const names = (es: DirectoryEntry[]) => es.map((e) => e.name);
const base = { query: '', state: '', city: '', sort: 'featured' as const, origin: null };

/* ---------------------- filtering ---------------------- */
{
  const es = [
    entry({ name: 'Pilot #404', city: 'Murfreesboro', state: 'TN', interstate: 'I-24', exitNumber: '81' }),
    entry({ name: "Love's #348", city: 'Calvert City', state: 'KY', category: 'cat-scales', amenities: ['CAT Scale'] }),
    entry({ name: 'Blue Beacon', city: 'Nashville', state: 'TN', category: 'truck-washes', zip: '37207' }),
  ];
  check('state filter', names(filterAndSortEntries(es, { ...base, state: 'KY' })).join() === "Love's #348");
  check('city filter', names(filterAndSortEntries(es, { ...base, city: 'Murfreesboro' })).join() === 'Pilot #404');
  check('empty query returns all', filterAndSortEntries(es, base).length === 3);
  check('query matches business name', names(filterAndSortEntries(es, { ...base, query: 'pilot' })).join() === 'Pilot #404');
  check('query matches city', names(filterAndSortEntries(es, { ...base, query: 'calvert' })).join() === "Love's #348");
  check('query matches ZIP', names(filterAndSortEntries(es, { ...base, query: '37207' })).join() === 'Blue Beacon');
  check('query "exit 81" matches exit haystack token', names(filterAndSortEntries(es, { ...base, query: 'exit 81' })).join() === 'Pilot #404');
  check('query matches category title', names(filterAndSortEntries(es, { ...base, query: 'cat scale' })).join() === "Love's #348");
  check('query matches interstate', names(filterAndSortEntries(es, { ...base, query: 'i-24' })).join() === 'Pilot #404');
  check('no match → empty', filterAndSortEntries(es, { ...base, query: 'zzzz' }).length === 0);
  check('state + query combine (AND)', filterAndSortEntries(es, { ...base, state: 'KY', query: 'pilot' }).length === 0);
}

/* ---------------------- sorting ---------------------- */
{
  const es = [
    entry({ name: 'Charlie', featured: false, createdAt: '2026-03-01' }),
    entry({ name: 'alpha', featured: true, createdAt: '2026-01-01' }),
    entry({ name: 'Bravo', featured: false, createdAt: '2026-05-01' }),
  ];
  check('alpha sort (locale, case-insensitive)', names(filterAndSortEntries(es, { ...base, sort: 'alpha' })).join() === 'alpha,Bravo,Charlie');
  check('newest sort (createdAt desc)', names(filterAndSortEntries(es, { ...base, sort: 'newest' })).join() === 'Bravo,Charlie,alpha');
  check('featured sort (featured first, then name)', names(filterAndSortEntries(es, { ...base, sort: 'featured' }))[0] === 'alpha');
}

/* ---------------------- distance sort ---------------------- */
{
  const origin = { lat: 36.0, lng: -86.0 };
  const es = [
    entry({ name: 'Far', lat: 38.0, lng: -86.0 }),
    entry({ name: 'Near', lat: 36.1, lng: -86.0 }),
    entry({ name: 'NoCoords' }),
  ];
  check('distance sort nearest-first, coordless last', names(filterAndSortEntries(es, { ...base, sort: 'distance', origin })).join() === 'Near,Far,NoCoords');
  check('distance sort without origin falls back to alpha', names(filterAndSortEntries(es, { ...base, sort: 'distance', origin: null })).join() === 'Far,Near,NoCoords');
}

/* ---------------------- purity ---------------------- */
{
  const es = [entry({ name: 'B' }), entry({ name: 'A' })];
  const before = names(es).join();
  filterAndSortEntries(es, { ...base, sort: 'alpha' });
  check('does not mutate input order', names(es).join() === before);
}

/* ---------------------- distanceMiles ---------------------- */
{
  check('distanceMiles zero for same point', distanceMiles({ lat: 36, lng: -86 }, { lat: 36, lng: -86 }) === 0);
  const d = distanceMiles({ lat: 36, lng: -86 }, { lat: 37, lng: -86 });
  check('distanceMiles ~69 mi per degree latitude', Math.abs(d - 69.09) < 0.6, d);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
