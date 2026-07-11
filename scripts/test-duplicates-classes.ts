/**
 * Milestone 21 unit tests: pair classification — exact vs probable
 * duplicates, legitimate co-locations, shared-address sub-services, same
 * brand at different exits, similar-name-different-address, contact-detail
 * bucketing, exclusion of decided pairs, and deterministic scoring.
 *
 * Run:
 *   npx esbuild scripts/test-duplicates-classes.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-dup.cjs && node /tmp/test-dup.cjs
 */
import {
  classifyPair,
  findClassifiedPairs,
  brandKey,
  nameSimilarity,
  classifiedPairsCsv,
  type PairListing,
} from '@/lib/directory/colocation';
import { orderPair } from '@/lib/directory/duplicates';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

const L = (over: Partial<PairListing>): PairListing => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  name: 'Stop',
  category: 'truck-stops',
  address: '1 Road',
  city: 'Dalton',
  state: 'GA',
  phone: null,
  website: null,
  lat: null,
  lng: null,
  interstate: 'I-75',
  exitNumber: '333',
  ...over,
});

/* ------------------------- helpers ------------------------- */
{
  check('brand: store number stripped', brandKey('Pilot Travel Center #4558') === brandKey('Pilot Travel Center #192'));
  check('brand: different brands differ', brandKey("Love's Travel Stop #1") !== brandKey('Pilot Travel Center #1'));
  check('similarity: identical = 1', nameSimilarity('TA Dalton', 'TA Dalton') === 1);
  check('similarity: contained name high', nameSimilarity('CAT Scale Petro Atlanta', 'Petro Atlanta') >= 0.6);
  check('similarity: unrelated low', nameSimilarity('Blue Beacon Wash', 'Georgia DPS Scale') < 0.3);
}

/* ------------------------- classification ------------------------- */
{
  const exact = classifyPair(
    L({ id: 'a', name: 'TA Dalton', address: '100 Connector 3' }),
    L({ id: 'b', name: 'TA Dalton', address: '100 Connector 3' }),
  );
  check('class: exact duplicate', exact.class === 'exact-duplicate', exact);
  check('class: exact scores high', exact.score >= 70);
  check('class: reasons name+address', exact.reasons.some((r) => r.includes('identical name')) && exact.reasons.some((r) => r.includes('identical address')));

  const probable = classifyPair(
    L({ id: 'a', name: 'TA Travel Center Dalton', address: '100 Connector 3' }),
    L({ id: 'b', name: 'TA Dalton', address: '100 Connector 3' }),
  );
  check('class: probable duplicate (similar name, same address, same category)', probable.class === 'probable-duplicate', probable.class);

  const subService = classifyPair(
    L({ id: 'a', name: 'Petro Stopping Center Atlanta', category: 'truck-stops', address: '200 Hwy 41' }),
    L({ id: 'b', name: 'CAT Scale — Petro Atlanta', category: 'cat-scales', address: '200 Hwy 41' }),
  );
  check('class: shared-address sub-service', subService.class === 'shared-address-sub-service', subService.class);

  const coords = classifyPair(
    L({ id: 'a', name: 'Big Lot Parking', category: 'parking', address: '1 A St', lat: 34.7, lng: -84.9 }),
    L({ id: 'b', name: 'Roadside Repair Co', category: 'roadside-service', address: '3 B St', lat: 34.7004, lng: -84.9004 }),
  );
  check('class: same coords, different category', coords.class === 'same-coords-diff-category', coords.class);

  const brand = classifyPair(
    L({ id: 'a', name: 'Pilot Travel Center #4558', city: 'Calhoun', exitNumber: '306' }),
    L({ id: 'b', name: 'Pilot Travel Center #192', city: 'Tifton', exitNumber: '60', address: '99 Other Rd' }),
  );
  check('class: same brand different exits is NOT a duplicate', brand.class === 'brand-multi-exit', brand.class);

  const similar = classifyPair(
    L({ id: 'a', name: 'A-1 Truck Stop', city: 'Ashburn', address: '10 Main St', exitNumber: '82' }),
    L({ id: 'b', name: 'A1 Truck Stop', city: 'Macon', address: '99 Elm St', exitNumber: '160' }),
  );
  check('class: similar name different address', ['similar-name-diff-address', 'brand-multi-exit'].includes(similar.class), similar.class);

  check('class: deterministic', classifyPair(L({ id: 'a', name: 'X' }), L({ id: 'b', name: 'X' })).score === classifyPair(L({ id: 'a', name: 'X' }), L({ id: 'b', name: 'X' })).score);
}

/* ------------------------- pair finding + exclusion ------------------------- */
{
  const rows = [
    L({ id: 'a', name: 'TA Dalton', address: '100 Connector 3' }),
    L({ id: 'b', name: 'TA Dalton', address: '100 Connector 3' }),
    L({ id: 'c', name: 'Unrelated Wash', category: 'truck-washes', address: '9 Elsewhere', city: 'Macon' }),
    // shared phone, no other match signals
    L({ id: 'd', name: 'Dispatch Repair', category: 'roadside-service', address: '5 X St', city: 'Calhoun', phone: '(706) 555-1234' }),
    L({ id: 'e', name: 'Calhoun Mobile Tire', category: 'tire-repair', address: '7 Y St', city: 'Calhoun', phone: '706-555-1234' }),
  ];
  const pairs = findClassifiedPairs(rows);
  const key = (x: string, y: string) => {
    const { a, b } = orderPair(x, y);
    return `${a}|${b}`;
  };
  check('find: exact pair surfaced', pairs.some((p) => `${p.aId}|${p.bId}` === key('a', 'b')));
  check('find: shared phone surfaced', pairs.some((p) => `${p.aId}|${p.bId}` === key('d', 'e')), pairs.map((p) => `${p.aId}|${p.bId}`));
  check('find: unrelated listing not paired', !pairs.some((p) => p.aId === 'c' || p.bId === 'c'));
  check('find: sorted by score desc', pairs.every((p, i) => i === 0 || pairs[i - 1].score >= p.score));

  const excluded = findClassifiedPairs(rows, new Set([key('a', 'b')]));
  check('find: decided pair excluded', !excluded.some((p) => `${p.aId}|${p.bId}` === key('a', 'b')));

  const csv = classifiedPairsCsv(pairs, new Map(rows.map((r) => [r.id, r])));
  check('csv: export has header + rows', csv.startsWith('a_id,a_name') && csv.split('\r\n').length === pairs.length + 1);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
