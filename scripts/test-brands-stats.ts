/**
 * Unit tests for `lib/directory/brands` (brand derivation, city grouping) and
 * `lib/directory/stats` (location statistics) — the pure logic behind the new
 * Browse-by-Brand/City pages and /directory/stats.
 *
 * Run:
 *   npx esbuild scripts/test-brands-stats.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-brands-stats.cjs && node /tmp/test-brands-stats.cjs
 */
import { brandOf, brandBySlug, groupByBrand, groupByCity, citySlug } from '@/lib/directory/brands';
import {
  largestTruckStops,
  statesByCategory,
  categoryTotals,
  totalKnownParkingSpaces,
  interstatesByCoverage,
} from '@/lib/directory/stats';
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

/* ---------------------- brandOf ---------------------- */
{
  check('Pilot #', brandOf({ name: 'Pilot Travel Center #149' })?.slug === 'pilot');
  check("Love's", brandOf({ name: "Love's Travel Stop #244" })?.slug === 'loves');
  check('Flying J', brandOf({ name: 'Flying J Travel Center #607' })?.slug === 'flying-j');
  check('TA Express', brandOf({ name: 'TA Express Cookeville' })?.slug === 'ta');
  check('Petro maps to TA family', brandOf({ name: 'Petro #311' })?.slug === 'ta');
  check('ONE9', brandOf({ name: 'ONE9 Travel Center #226' })?.slug === 'one9');
  check('CAT Scale prefix', brandOf({ name: 'CAT Scale at ONE9 Travel Center' })?.slug === 'cat-scale');
  check('interior brand mention does NOT claim ("Southern Tire Mart at Pilot")', brandOf({ name: 'Southern Tire Mart at Pilot #330' })?.slug === 'southern-tire-mart');
  check('independent → undefined', brandOf({ name: 'Workman’s Travel Center' }) === undefined);
  check('independent truck plaza → undefined', brandOf({ name: 'Metropolis Truck Plaza' }) === undefined);
  check('brandBySlug round-trip', brandBySlug('flying-j')?.name === 'Flying J');
  check('brandBySlug unknown → undefined', brandBySlug('nope') === undefined);
}

/* ---------------------- groupByBrand / groupByCity ---------------------- */
{
  const es = [
    entry({ name: 'Pilot Travel Center #1' }),
    entry({ name: 'Pilot Travel Center #2' }),
    entry({ name: "Love's Travel Stop #3" }),
    entry({ name: 'Independent Truck Stop' }),
  ];
  const groups = groupByBrand(es);
  check('groups sorted by size', groups[0].brand.slug === 'pilot' && groups[0].entries.length === 2);
  check('independents omitted from brand groups', groups.every((g) => g.entries.every((e) => e.name !== 'Independent Truck Stop')));

  const cities = groupByCity([
    entry({ city: 'West Memphis', state: 'AR' }),
    entry({ city: 'West Memphis', state: 'AR' }),
    entry({ city: 'Memphis', state: 'TN' }),
  ]);
  check('citySlug format', citySlug('West Memphis', 'AR') === 'west-memphis-ar');
  check('city groups keyed by city+state', cities.length === 2);
  check('biggest city first', cities[0].city === 'West Memphis' && cities[0].entries.length === 2);
}

/* ---------------------- stats ---------------------- */
{
  const es = [
    entry({ name: 'Big', category: 'truck-stops', parkingSpaces: 175 }),
    entry({ name: 'Mid', category: 'truck-stops', parkingSpaces: 84 }),
    entry({ name: 'Unknown', category: 'truck-stops' }),
    entry({ name: 'ScaleTN1', category: 'cat-scales', state: 'TN' }),
    entry({ name: 'ScaleTN2', category: 'cat-scales', state: 'TN' }),
    entry({ name: 'ScaleGA', category: 'cat-scales', state: 'GA' }),
    entry({ name: 'LotWithSpaces', category: 'parking', parkingSpaces: 40, interstate: 'I-40' }),
  ];
  const largest = largestTruckStops(es);
  check('largest sorted desc', largest[0].entry.name === 'Big' && largest[1].entry.name === 'Mid');
  check('unknown counts excluded from largest', !largest.some((s) => s.entry.name === 'Unknown'));
  check('non-truck-stops excluded from largest', !largest.some((s) => s.entry.name === 'LotWithSpaces'));

  const scales = statesByCategory(es, 'cat-scales');
  check('statesByCategory ranks TN first', scales[0].state === 'TN' && scales[0].count === 2);
  check('statesByCategory includes state name', scales[0].stateName === 'Tennessee');

  const totals = categoryTotals(es);
  check('categoryTotals sorted by count then title', totals[0].count === 3 && totals[totals.length - 1].slug === 'parking');

  const park = totalKnownParkingSpaces(es);
  check('parking totals only known counts', park.spaces === 175 + 84 + 40 && park.listings === 3);

  const corr = interstatesByCoverage(es);
  check('corridor coverage counts I-40', corr[0].interstate === 'I-40' && corr[0].count === 1);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
