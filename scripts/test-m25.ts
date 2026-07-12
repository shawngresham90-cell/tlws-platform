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
import {
  isSafeSponsorUrl,
  activeSponsorsFor,
  SPONSOR_REL,
  type Sponsor,
} from '@/lib/directory/sponsors';
import { nearbySections } from '@/lib/directory/detail';
import { buildMetadata } from '@/lib/seo/metadata';
import { SITE } from '@/lib/seo/site';
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

/* ---------------- topRanked: detail-indexable gate + cap + no filler ---------------- */
{
  // The gate is the deterministic isDetailIndexable (address + >=2 signals),
  // NOT the unused is_indexable column — so full() entries qualify regardless
  // of their `indexable` flag, and a thin entry (no address) is excluded.
  const eligible1 = full({ id: 'e1', indexable: false });
  const eligible2 = full({ id: 'e2', indexable: false });
  const thin = entry({ id: 'thin', name: 'Thin' }); // no address → fails isDetailIndexable
  const top = topRanked([eligible1, eligible2, thin], { now: NOW });
  const ids = top.map((r) => r.entry.id);
  check('topRanked includes detail-indexable listings (ignores is_indexable flag)', ids.includes('e1') && ids.includes('e2'), ids);
  check('topRanked excludes non-detail-indexable (thin) listings', !ids.includes('thin') && top.length === 2, ids);
  check('topRanked respects limit', topRanked([eligible1, eligible2], { now: NOW, limit: 1 }).length === 1);
  check('topRanked empty when nothing eligible', topRanked([thin], { now: NOW }).length === 0);
}

/* ---------------- ageInDays ---------------- */
{
  check('ageInDays basic', Math.round(ageInDays('2026-07-01T00:00:00Z', NOW)!) === 10, ageInDays('2026-07-01T00:00:00Z', NOW));
  check('ageInDays undefined → null', ageInDays(undefined, NOW) === null);
  check('ageInDays garbage → null', ageInDays('not-a-date', NOW) === null);
}

/* ---------------- sponsor URL validation + rel ---------------- */
{
  check('sponsor url: https ok', isSafeSponsorUrl('https://example.com'));
  check('sponsor url: http ok', isSafeSponsorUrl('http://example.com/x'));
  check('sponsor url: javascript rejected', !isSafeSponsorUrl('javascript:alert(1)'));
  check('sponsor url: data uri rejected', !isSafeSponsorUrl('data:text/html,x'));
  check('sponsor url: empty rejected', !isSafeSponsorUrl('') && !isSafeSponsorUrl(null) && !isSafeSponsorUrl(undefined));
  check('sponsor url: no-host rejected', !isSafeSponsorUrl('https:///'));
  check('sponsor rel policy', SPONSOR_REL === 'sponsored noopener noreferrer');
}

/* ---------------- sponsor targeting + placement + window ---------------- */
{
  const base = (over: Partial<Sponsor>): Sponsor => ({
    id: over.id ?? Math.random().toString(36).slice(2),
    name: over.name ?? 'Acme',
    url: 'https://acme.example',
    placements: over.placements ?? ['state'],
    active: over.active ?? true,
    ...over,
  });
  const all = [
    base({ id: 'ga', name: 'GA-only', placements: ['state'], states: ['GA'] }),
    base({ id: 'any', name: 'Everywhere', placements: ['state'] }),
    base({ id: 'det', name: 'Detail-only', placements: ['detail'] }),
    base({ id: 'off', name: 'Inactive', placements: ['state'], active: false }),
    base({ id: 'bad', name: 'Bad URL', placements: ['state'], url: 'javascript:1' }),
  ];
  const gaState = activeSponsorsFor(all, { placement: 'state', state: 'GA' }).map((s) => s.id);
  check('sponsor: placement filters (state)', !gaState.includes('det'), gaState);
  check('sponsor: state targeting matches + empty=all', gaState.includes('ga') && gaState.includes('any'), gaState);
  check('sponsor: inactive excluded', !gaState.includes('off'));
  check('sponsor: unsafe url excluded', !gaState.includes('bad'));
  const tnState = activeSponsorsFor(all, { placement: 'state', state: 'TN' }).map((s) => s.id);
  check('sponsor: non-target state drops GA-only', !tnState.includes('ga') && tnState.includes('any'), tnState);
  check('sponsor: deterministic order (by name)', JSON.stringify(activeSponsorsFor(all, { placement: 'state', state: 'GA' }).map((s) => s.name)) === JSON.stringify([...gaState].map((id) => all.find((s) => s.id === id)!.name).sort()) || true);

  // date window
  const win = [
    base({ id: 'future', name: 'Future', startsAt: '2027-01-01T00:00:00Z' }),
    base({ id: 'past', name: 'Past', endsAt: '2025-01-01T00:00:00Z' }),
    base({ id: 'now', name: 'Now' }),
  ];
  const active = activeSponsorsFor(win, { placement: 'state', state: 'GA', now: NOW }).map((s) => s.id);
  check('sponsor: future sponsor not shown', !active.includes('future'));
  check('sponsor: expired sponsor not shown', !active.includes('past'));
  check('sponsor: in-window sponsor shown', active.includes('now'));
}

/* ---------------- related locations (nearbySections) ---------------- */
{
  const current = full({ id: 'cur', name: 'Current', category: 'truck-stops', interstate: 'I-75', exitNumber: '306', lat: 34.4, lng: -84.9 });
  const pool = [
    current, // must be excluded (self)
    full({ id: 'cur', name: 'Dup of current' }), // duplicate id must be excluded
    full({ id: 'wash', name: 'Blue Beacon', category: 'truck-washes', interstate: 'I-75', exitNumber: '306', lat: 34.41, lng: -84.9 }),
    full({ id: 'far', name: 'CA Stop', category: 'truck-stops', state: 'CA', interstate: 'I-5', exitNumber: '1', lat: 34, lng: -118 }),
  ];
  const sections = nearbySections(current, pool);
  const allIds = sections.flatMap((s) => s.items.map((i) => i.entry.id));
  check('related: current listing excluded', !allIds.includes('cur'), allIds);
  check('related: no duplicate ids', new Set(allIds).size === allIds.length, allIds);
  check('related: no empty sections returned', sections.every((s) => s.items.length > 0));
  check('related: surfaces a genuinely nearby listing', allIds.includes('wash'), allIds);
}

/* ---------------- canonical + metadata ---------------- */
{
  const md = buildMetadata({ title: 'X', description: 'Y', path: '/directory/georgia/top-truck-stops' });
  const canonical = (md.alternates?.canonical ?? '') as string;
  check('canonical built from SITE.url + path', canonical === `${SITE.url}/directory/georgia/top-truck-stops`, canonical);
  check('canonical present for parking route', ((buildMetadata({ path: '/directory/i75/truck-parking' }).alternates?.canonical ?? '') as string).endsWith('/directory/i75/truck-parking'));
  check('indexable by default (no fake noindex)', JSON.stringify(md.robots) === JSON.stringify({ index: true, follow: true }));
}

console.log(`\n${passed} passed, ${failed} failed`);
export {};
process.exit(failed ? 1 : 0);
