/**
 * Founders Wall unit tests — aggregate campaign math, privacy (individual
 * amounts are never exposed), unique founder counts + duplicate detection,
 * tier grouping/order, and remaining tier capacity.
 *
 * Run:
 *   npx esbuild scripts/test-founders.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-founders.cjs && node /tmp/test-founders.cjs
 */
import { readFileSync } from 'node:fs';
import {
  dollars,
  remainingCents,
  pctToGoal,
  normalizeName,
  founderDupKey,
  uniqueFounderCount,
  repeatedFounderNames,
  tierRemaining,
  tierUsage,
} from '@/lib/community/campaign';
import { TIER_ORDER, TIER_CAPACITY, FOUNDER_TIERS } from '@/components/community/tiers';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

// Authoritative roster (mirror of migration 027 seed) ----------------------
type Row = { display_name: string; business_name: string | null; tier: string };
const mk = (display_name: string, tier: string): Row => ({ display_name, business_name: null, tier });
const ROSTER: Row[] = [
  mk('David Gresham', 'iron'),
  mk('Thomas Fields', 'iron'),
  mk('Gary Ford', 'steel'),
  mk('Jose Cotto', 'steel'),
  mk('Greg Walker', 'steel'),
  mk('Mario Capston', 'steel'),
  mk('Jon Blankenship', 'steel'),
  mk('Ricky M. Rosenbalm', 'steel'),
  mk('Idle Demon', 'steel'),
  mk('Sam Tusk', 'brick'),
  mk('Chris Nalley', 'brick'),
  mk('Terry Hostetler', 'brick'),
  mk('Billy Joe Poole', 'brick'),
  mk('J.A. Gresham', 'brick'),
  mk('R.A. Harper', 'brick'),
  mk('Steve Snyder', 'brick'),
  mk('Jose Cotto', 'brick'),
  mk('Sean Conway', 'brick'),
  mk('David Chasteen', 'brick'),
  mk('Clint E. Ingram', 'brick'),
  mk('Bryce Jennex', 'brick'),
  mk('Will Bethstern', 'brick'),
  mk('Shell Faroods', 'brick'),
  mk('Phil Tuts', 'brick'),
  mk('Joe Wise', 'brick'),
];

const GOAL = 1_200_000; // $12,000
const RAISED = 710_000; // $7,100

/* ---------------------- aggregate campaign math ---------------------- */
{
  check('remaining: goal − raised', remainingCents(GOAL, RAISED) === 490_000);
  check('totals reconcile: raised + remaining = goal', RAISED + remainingCents(GOAL, RAISED) === GOAL);
  check('remaining never negative (over-goal)', remainingCents(GOAL, 1_500_000) === 0);
  check('pct: 7100/12000 → 59.2', pctToGoal(GOAL, RAISED) === 59.2);
  check('pct clamps to 100 when over-goal', pctToGoal(GOAL, 1_500_000) === 100);
  check('pct: zero goal → 0 (no divide-by-zero)', pctToGoal(0, RAISED) === 0);
  check('pct: nothing raised → 0', pctToGoal(GOAL, 0) === 0);
  check('dollars: raised → $7,100', dollars(RAISED) === '$7,100');
  check('dollars: goal → $12,000', dollars(GOAL) === '$12,000');
  check('dollars: remaining → $4,900', dollars(remainingCents(GOAL, RAISED)) === '$4,900');
}

/* ---------------------- privacy: no individual amounts ---------------------- */
// Scan CODE only (comments stripped) so a doc comment mentioning "amounts"
// doesn't trip the privacy checks — we care about rendered/queried values.
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
{
  const reader = readFileSync('src/lib/community/founders.ts', 'utf8');
  // The public-founders SELECT must not pull amount_cents.
  const selectMatch = reader.match(/from\('founders'\)\s*\.select\(([\s\S]*?)\)/);
  check('reader founders SELECT exists', !!selectMatch, reader.slice(0, 80));
  check(
    'reader never selects amount_cents from founders',
    !!selectMatch && !/amount/i.test(selectMatch[1]),
    selectMatch?.[1],
  );
  check('PublicFounder type has no amount field', !/amount/i.test(reader.split('PublicFounder = {')[1]?.split('}')[0] ?? ''));

  const card = stripComments(readFileSync('src/components/community/FounderCard.tsx', 'utf8'));
  check('FounderCard code never references an amount', !/amount/i.test(card), card);
  const thermo = stripComments(readFileSync('src/components/community/CampaignThermometer.tsx', 'utf8'));
  check('Thermometer code never references a per-founder amount', !/amount/i.test(thermo), thermo);
}

/* ---------------------- external links: rel safety ---------------------- */
{
  const card = readFileSync('src/components/community/FounderCard.tsx', 'utf8');
  // The rendered external link (not the doc comment) carries the full rel.
  const relMatches = [...card.matchAll(/rel="([^"]*)"/g)].map((m) => m[1]);
  const safeRel = relMatches.find(
    (r) => r.includes('noopener') && r.includes('noreferrer'),
  );
  check('FounderCard external link sets a rel', relMatches.length > 0, card);
  check('rel includes noopener', !!safeRel, relMatches);
  check('rel includes noreferrer', !!safeRel, relMatches);
  check(
    'rel marks sponsored/nofollow for paid placement',
    !!safeRel && (safeRel.includes('sponsored') || safeRel.includes('nofollow')),
    safeRel,
  );
}

/* ---------------------- spots sold vs. unique names ---------------------- */
{
  check('founder spots sold = 25 (records)', ROSTER.length === 25);
  check('unique founder names = 24 (Jose Cotto counted once)', uniqueFounderCount(ROSTER) === 24);
  // Jose Cotto holds 2 spots on purpose — surfaced as a repeated name, not an error.
  const repeats = repeatedFounderNames(ROSTER);
  check('exactly one repeated name', repeats.length === 1, repeats);
  check('repeated name is Jose Cotto', repeats[0] === founderDupKey('Jose Cotto', null), repeats[0]);
  check('spots minus unique names = extra spots (1)', ROSTER.length - uniqueFounderCount(ROSTER) === 1);
  check('normalizeName is case/punctuation-insensitive', normalizeName('Jose  Cotto!') === normalizeName('jose cotto'));
  check('distinct names are not flagged as repeats', repeatedFounderNames([mk('A', 'iron'), mk('B', 'iron')]).length === 0);
}

/* ---------------------- tier grouping + order ---------------------- */
{
  check('tier order is recognition order', JSON.stringify(TIER_ORDER) === JSON.stringify(['equipment_sponsor', 'student_sponsor', 'iron', 'steel', 'brick']));
  const usage = tierUsage(ROSTER as { tier: 'iron' | 'steel' | 'brick' }[]);
  check('iron usage = 2', usage.iron === 2, usage);
  check('steel usage = 7', usage.steel === 7, usage);
  check('brick usage = 16', usage.brick === 16, usage);
  check('sponsor tiers empty', usage.equipment_sponsor === 0 && usage.student_sponsor === 0);
  check('tier count sums to roster', usage.iron + usage.steel + usage.brick === ROSTER.length);
  check('every FOUNDER_TIERS entry has a capacity field', FOUNDER_TIERS.every((t) => 'capacity' in t));
}

/* ---------------------- remaining tier capacity ---------------------- */
{
  const usage = tierUsage(ROSTER as { tier: 'iron' | 'steel' | 'brick' }[]);
  // Confirmed capacities: Iron 10 / Steel 25 / Brick 50.
  check('iron capacity is 10', TIER_CAPACITY.iron === 10);
  check('steel capacity is 25', TIER_CAPACITY.steel === 25);
  check('brick capacity is 50', TIER_CAPACITY.brick === 50);
  check('iron open = 10 − 2 = 8', tierRemaining(TIER_CAPACITY.iron, usage.iron) === 8);
  check('steel open = 25 − 7 = 18', tierRemaining(TIER_CAPACITY.steel, usage.steel) === 18);
  check('brick open = 50 − 16 = 34', tierRemaining(TIER_CAPACITY.brick, usage.brick) === 34);
  const totalOpen =
    (tierRemaining(TIER_CAPACITY.iron, usage.iron) ?? 0) +
    (tierRemaining(TIER_CAPACITY.steel, usage.steel) ?? 0) +
    (tierRemaining(TIER_CAPACITY.brick, usage.brick) ?? 0);
  check('total open spots = 60', totalOpen === 60, totalOpen);
  check('remaining never negative (over-subscribed)', tierRemaining(10, 12) === 0);
  check('uncapped tier → null', tierRemaining(TIER_CAPACITY.equipment_sponsor, 3) === null);
  check('all capped tiers have non-negative remaining', (['iron', 'steel', 'brick'] as const).every((t) => (tierRemaining(TIER_CAPACITY[t], usage[t]) ?? 0) >= 0));
}

/* ---------------------- confirmed report reconciliation ---------------------- */
{
  // Single-source-of-truth end-to-end: the exact numbers the owner confirmed.
  const usage = tierUsage(ROSTER as { tier: 'iron' | 'steel' | 'brick' }[]);
  check('spots sold = 25', ROSTER.length === 25);
  check('unique names = 24', uniqueFounderCount(ROSTER) === 24);
  check('tier occupancy Iron 2 / Steel 7 / Brick 16', usage.iron === 2 && usage.steel === 7 && usage.brick === 16);
  check('raised = $7,100', dollars(RAISED) === '$7,100' && RAISED === 710_000);
  check('goal = $12,000', dollars(GOAL) === '$12,000' && GOAL === 1_200_000);
  check('remaining = $4,900', dollars(remainingCents(GOAL, RAISED)) === '$4,900' && remainingCents(GOAL, RAISED) === 490_000);
  check('percent renders 59.2 (project 1-decimal convention)', pctToGoal(GOAL, RAISED) === 59.2);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
