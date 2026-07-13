/**
 * Unit tests for `lib/directory/search` — query normalization, brand/city/
 * interstate aliases, exit search, fuzzy matching, and relevance ranking —
 * plus the browse.ts integration (relevance on default sort, alias hits
 * flowing through filters).
 *
 * Run:
 *   npx esbuild scripts/test-search.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-search.cjs && node /tmp/test-search.cjs
 */
import {
  normalizeQuery,
  expandQuery,
  editDistanceAtMost1,
  rankEntries,
} from '@/lib/directory/search';
import { filterAndSortEntries } from '@/lib/directory/browse';
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

/* ---------------------- normalizeQuery ---------------------- */
{
  check('I40 → i-40', normalizeQuery('I40') === 'i-40');
  check('I 40 → i-40', normalizeQuery('I 40') === 'i-40');
  check('Interstate 40 → i-40', normalizeQuery('Interstate 40') === 'i-40');
  check('i-40 unchanged', normalizeQuery('i-40') === 'i-40');
  check('embedded: "pilot I40 memphis"', normalizeQuery('pilot I40 memphis') === 'pilot i-40 memphis');
  check('exit81 → exit 81', normalizeQuery('exit81') === 'exit 81');
  check('ex 81 → exit 81', normalizeQuery('ex 81') === 'exit 81');
  check('ex. 81 → exit 81', normalizeQuery('ex. 81') === 'exit 81');
  check('lettered exit', normalizeQuery('EXIT 7B') === 'exit 7b');
  check('whitespace collapsed', normalizeQuery('  pilot   memphis ') === 'pilot memphis');
  check('does not mangle words containing i<number>', normalizeQuery('one9') === 'one9');
}

/* ---------------------- expandQuery ---------------------- */
{
  check('loves ↔ love’s alias', expandQuery('loves travel stop').some((v) => v.includes("love's")));
  check("love's → loves alias too", expandQuery("love's").some((v) => v === 'loves'));
  check('flyingj → flying j', expandQuery('flyingj').some((v) => v === 'flying j'));
  check('qt → quiktrip', expandQuery('qt travel center').some((v) => v.includes('quiktrip')));
  check('catscale → cat scale', expandQuery('catscale').some((v) => v === 'cat scale'));
  check('ft ↔ fort word alias', expandQuery('ft smith').some((v) => v === 'fort smith'));
  check('fort → ft word alias', expandQuery('fort smith').some((v) => v === 'ft smith'));
  check('st → saint word alias', expandQuery('st louis').some((v) => v === 'saint louis'));
  check('word alias does not fire mid-word', !expandQuery('stanton').some((v) => v.includes('sainton')));
  check('original phrasing kept first', expandQuery('loves')[0] === 'loves');
}

/* ---------------------- editDistanceAtMost1 ---------------------- */
{
  check('identical', editDistanceAtMost1('memphis', 'memphis'));
  check('one substitution', editDistanceAtMost1('memphes', 'memphis'));
  check('one deletion', editDistanceAtMost1('knoxvile', 'knoxville'));
  check('one insertion', editDistanceAtMost1('nashvillle', 'nashville'));
  check('two edits rejected', !editDistanceAtMost1('nashvile', 'knoxville'));
  check('length gap of 2 rejected', !editDistanceAtMost1('abc', 'abcde'));
}

/* ---------------------- rankEntries: aliases + fuzzy ---------------------- */
{
  const es = [
    entry({ name: "Love's Travel Stop #244", city: 'Jackson' }),
    entry({ name: 'Pilot Travel Center #149', city: 'Stanton' }),
    entry({ name: 'Flying J Travel Center #607', city: 'West Memphis', state: 'AR', interstate: 'I-40' }),
    entry({ name: 'QuikTrip #7154 Travel Center', city: 'Memphis', interstate: 'I-40', exitNumber: '14' }),
    entry({ name: 'CAT Scale at ONE9 Travel Center', city: 'Wildwood', state: 'GA', category: 'cat-scales' }),
  ];
  const hit = (q: string) => rankEntries(es, q).map((r) => r.entry.name);

  check('brand alias: "loves" finds Love’s', hit('loves').some((x) => x.includes("Love's")));
  check('brand alias: "flyingj" finds Flying J', hit('flyingj').some((x) => x.includes('Flying J')));
  check('brand alias: "qt" finds QuikTrip', hit('qt memphis').some((x) => x.includes('QuikTrip')));
  check('brand alias: "catscale" finds CAT Scale', hit('catscale').some((x) => x.includes('CAT Scale')));
  check('interstate alias: "I40" matches I-40 rows', hit('I40').length === 2);
  check('interstate alias: "interstate 40" too', hit('interstate 40').length === 2);
  check('exit alias: "ex 14" finds Exit 14 row', hit('ex 14').some((x) => x.includes('QuikTrip')));
  check('fuzzy: "memphs" finds Memphis', hit('memphs').some((x) => x.includes('QuikTrip')));
  check('fuzzy: "knoxvile" no false hit here', hit('knoxvile').length === 0);
  check('short tokens never fuzz: "qx" no hits', hit('qx').length === 0);
  check('empty query → all, score 0', rankEntries(es, '').length === 5 && rankEntries(es, '')[0].score === 0);
}

/* ---------------------- rankEntries: ranking quality ---------------------- */
{
  const es = [
    entry({ name: 'Pilot Travel Center #149', city: 'Stanton' }),
    entry({ name: 'Southern Tire Mart at Pilot', city: 'Jackson' }),
    entry({ name: 'Bells Truck Stop', city: 'Bells', description: 'near the Pilot on the north side' }),
  ];
  const ranked = rankEntries(es, 'pilot').map((r) => r.entry.name);
  check('name-field hit outranks description hit', ranked.indexOf('Pilot Travel Center #149') < ranked.indexOf('Bells Truck Stop'), ranked);
  check('description-only match still included', ranked.includes('Bells Truck Stop'));

  const es2 = [
    entry({ name: 'Alpha Stop', city: 'Marion', featured: false }),
    entry({ name: 'Bravo Stop', city: 'Marion', featured: true }),
  ];
  const r2 = rankEntries(es2, 'marion').map((r) => r.entry.name);
  check('featured boosts equal-relevance ties', r2[0] === 'Bravo Stop', r2);
}

/* ---------------------- browse.ts integration ---------------------- */
{
  const es = [
    entry({ name: "Love's Travel Stop #429", city: 'Nashville', interstate: 'I-65' }),
    entry({ name: 'Pilot Travel Center #411', city: 'Lebanon', interstate: 'I-40', exitNumber: '238' }),
    entry({ name: 'Workman’s Travel Center', city: 'Ozark', state: 'AR', interstate: 'I-40' }),
  ];
  check('browse: alias query flows through ("loves")', names(filterAndSortEntries(es, { ...base, query: 'loves' })).join() === "Love's Travel Stop #429");
  check('browse: "I40" filter', filterAndSortEntries(es, { ...base, query: 'I40' }).length === 2);
  check('browse: state filter ANDs with alias query', filterAndSortEntries(es, { ...base, query: 'I40', state: 'AR' }).length === 1);
  check('browse: relevance order on default sort with query', names(filterAndSortEntries(es, { ...base, query: 'pilot lebanon' }))[0] === 'Pilot Travel Center #411');
  check('browse: alpha sort still alphabetical with query', names(filterAndSortEntries(es, { ...base, query: 'travel', sort: 'alpha' })).join() === "Love's Travel Stop #429,Pilot Travel Center #411,Workman’s Travel Center");
  check('browse: empty query featured-first preserved', filterAndSortEntries(es, base).length === 3);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
