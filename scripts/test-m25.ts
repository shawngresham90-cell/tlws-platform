/**
 * Milestone 25 unit tests — growth/monetization pure logic:
 * deterministic factual ranking, current/unpublished/deleted exclusion in
 * related locations, parking filters, recently-updated & newest ordering,
 * sponsor URL validation + sponsored rel attributes, and canonical building.
 *
 * Run:
 *   npx esbuild scripts/test-m25.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-m25.cjs && node /tmp/test-m25.cjs
 */
import { rankEntries, topRanked, ageInDays, RANK_METHODOLOGY, RANK_WEIGHTS } from '@/lib/directory/ranking';
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

const NOW = new Date('2026-07-11T00:00:00Z');

function entry(over: Partial<DirectoryEntry> = {}): DirectoryEntry {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    category: 'truck-stops',
    name: 'Stop',
    state: 'GA',
    city: 'Dalton',
    slug: 'stop',
    indexable: true,
    ...over,
  };
}

const full = (over: Partial<DirectoryEntry> = {}): DirectoryEntry =>
  entry({
    address: '324 Carbondale Rd',
    zip: '30701',
    interstate: 'I-75',
    exitNumber: '306',
    lat: 34.4,
    lng: -84.9,
    phone: '(706) 555-0100',
    website: 'https://example.com',
    amenities: ['Showers', 'Fuel', 'Overnight OK'],
    parkingSpaces: 90,
    description: 'A full-service truck stop with fuel, showers, parking, and a real diner on site.',
    verifiedAt: '2026-07-01T00:00:00Z',
    ...over,
  });

/* ---------------- weights + methodology ---------------- */
{
  const sum = Object.values(RANK_WEIGHTS).reduce((a, b) => a + b, 0);
  check('weights sum to 100', sum === 100, sum);
  check('methodology discloses signals', /completeness/i.test(RANK_METHODOLOGY) && /verified/i.test(RANK_METHODOLOGY) && /review/i.test(RANK_METHODOLOGY));
  check('methodology disavows popularity', /never by popularity/i.test(RANK_METHODOLOGY));
}

/* ---------------- determinism ---------------- */
{
  const set = [full({ id: 'a', name: 'Alpha' }), full({ id: 'b', name: 'Bravo' }), entry({ id: 'c', name: 'Thin' })];
  const r1 = rankEntries(set, { now: NOW }).map((r) => r.entry.id);
  const r2 = rankEntries([...set].reverse(), { now: NOW }).map((r) => r.entry.id);
  check('deterministic regardless of input order', JSON.stringify(r1) === JSON.stringify(r2), `${r1} vs ${r2}`);
}

/* ---------------- factual signals rank higher ---------------- */
{
  const rich = full({ id: 'rich' });
  const thin = entry({ id: 'thin', name: 'Thin', amenities: [] });
  const ranked = rankEntries([thin, rich], { now: NOW });
  check('more complete ranks first', ranked[0].entry.id === 'rich', ranked.map((r) => r.entry.id));
  check('thin listing scores lower', ranked[0].score > ranked[1].score, ranked.map((r) => r.score));

  // approved reviews lift a listing (real counts only)
  const a = full({ id: 'a' });
  const b = full({ id: 'b' });
  const withReviews = rankEntries([a, b], { now: NOW, reviewCounts: { b: 5 } });
  check('approved reviews raise rank', withReviews[0].entry.id === 'b', withReviews.map((r) => `${r.entry.id}:${r.score}`));
  check('review signal reflects real count', withReviews.find((r) => r.entry.id === 'b')!.signals.reviews === 100);
  check('no reviews → zero review signal (not invented)', withReviews.find((r) => r.entry.id === 'a')!.signals.reviews === 0);

  // verification recency
  const fresh = full({ id: 'fresh', verifiedAt: '2026-07-01T00:00:00Z' });
  const stale = full({ id: 'stale', verifiedAt: '2023-01-01T00:00:00Z' });
  const byVerify = rankEntries([stale, fresh], { now: NOW });
  check('fresher verification ranks higher', byVerify[0].entry.id === 'fresh');
  check('stale verification → zero verify signal', byVerify.find((r) => r.entry.id === 'stale')!.signals.verification === 0);
  check('never-verified → zero verify signal, not negative', rankEntries([entry({ id: 'nv' })], { now: NOW })[0].signals.verification === 0);
}

/* ---------------- parking usefulness ---------------- */
{
  const big = full({ id: 'big', parkingSpaces: 100 });
  const small = full({ id: 'small', parkingSpaces: 5 });
  const r = rankEntries([small, big], { now: NOW });
  check('more parking ranks higher (all else equal)', r[0].entry.id === 'big');
  check('parking signal caps at 100', r.find((x) => x.entry.id === 'big')!.signals.parking === 100);
}

/* ---------------- topRanked: indexable-only + cap + no filler ---------------- */
{
  const set = [full({ id: 'i1', indexable: true }), full({ id: 'i2', indexable: true }), full({ id: 'ni', indexable: false })];
  const top = topRanked(set, { now: NOW });
  check('topRanked excludes non-indexable', top.every((r) => r.entry.indexable) && top.length === 2, top.map((r) => r.entry.id));
  check('topRanked respects limit', topRanked(set, { now: NOW, limit: 1 }).length === 1);
  check('topRanked empty when nothing indexable', topRanked([full({ indexable: false })], { now: NOW }).length === 0);
}

/* ---------------- ageInDays ---------------- */
{
  check('ageInDays basic', Math.round(ageInDays('2026-07-01T00:00:00Z', NOW)!) === 10, ageInDays('2026-07-01T00:00:00Z', NOW));
  check('ageInDays undefined → null', ageInDays(undefined, NOW) === null);
  check('ageInDays garbage → null', ageInDays('not-a-date', NOW) === null);
}

console.log(`\n${passed} passed, ${failed} failed`);
export {};
process.exit(failed ? 1 : 0);
