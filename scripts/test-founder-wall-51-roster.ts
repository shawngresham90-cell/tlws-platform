/**
 * Guards for the approved 51-entry Founder Wall roster:
 *   supabase/migrations/048_founder_shirt_tier.sql   (not yet applied)
 *   docs/operations/founder-wall-51-roster.sql       (not executed)
 *   the founder_shirt tier config + the FUNDED wording
 *
 * Neither SQL file is run by anything in this repo. These checks exist so the
 * package cannot drift from what was approved, and so the things that matter
 * most stay true:
 *
 *   1. the arithmetic lands on $12,060 raised / $0 remaining / $510 over —
 *      verified through the REAL campaign math, not restated;
 *   2. tier capacities produce the approved "spots left" numbers;
 *   3. the two intentional duplicates survive;
 *   4. contribution amounts stay PRIVATE and no payment record is invented.
 *
 * Filesystem + pure functions only. No database, CI-safe.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { dollars, remainingCents, tierRemaining, tierUsage } from '@/lib/community/campaign';
import { TIER_CAPACITY, TIER_LABEL, FOUNDER_TIERS } from '@/components/community/tiers';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const migration = read('supabase/migrations/048_founder_shirt_tier.sql');
const roster = read('docs/operations/founder-wall-51-roster.sql');

/** Executable statements only — both files carry long prose headers. */
const execOnly = (s: string) =>
  s
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('--'))
    .join('\n');
const migrationExec = execOnly(migration);
const rosterExec = execOnly(roster);

/* ---------------------------------------------------------------- schema */

check(
  'migration adds founder_shirt to the tier CHECK constraint',
  /ADD CONSTRAINT founders_tier_check[\s\S]*'founder_shirt'/.test(migrationExec),
);
check(
  'every pre-existing tier identifier remains accepted',
  ['iron', 'steel', 'brick', 'student_sponsor', 'equipment_sponsor'].every((t) =>
    new RegExp(`ADD CONSTRAINT founders_tier_check[\\s\\S]*'${t}'`).test(migrationExec),
  ),
);
check(
  'migration proves an invalid tier is still rejected',
  migrationExec.includes("'not_a_real_tier'") && /an invalid tier was accepted/.test(migrationExec),
);
check(
  'migration rewrites no founder row',
  !/UPDATE\s+(public\.)?founders\s+SET/i.test(migrationExec),
);
check(
  'migration changes no tier capacity (capacities live in app config)',
  !/capacity/i.test(migrationExec),
);
check('migration is reversible', /ROLLBACK/.test(migration));
check(
  'rollback refuses to run while founder_shirt rows exist',
  /Refusing to roll back 048/.test(roster) === false &&
    /Refusing to roll back 048/.test(migration) &&
    /will not[\s\S]{0,40}delete founder records/.test(migration),
);
check('migration is not applied by anything in the repo', !/\bnpm run\b/.test(migration));

/* ------------------------------------------------------------ tier config */

check(
  'Founder / Shirt capacity is exactly 20',
  TIER_CAPACITY.founder_shirt === 20,
  TIER_CAPACITY.founder_shirt,
);
check(
  'Founder / Shirt label is "Founder / Shirt"',
  TIER_LABEL.founder_shirt === 'Founder / Shirt',
  TIER_LABEL.founder_shirt,
);
check(
  'existing capacities are unchanged',
  TIER_CAPACITY.iron === 10 && TIER_CAPACITY.steel === 25 && TIER_CAPACITY.brick === 50,
);
check(
  'founder_shirt is not mapped onto a sponsor tier',
  TIER_CAPACITY.student_sponsor === null && TIER_CAPACITY.equipment_sponsor === null,
);
check('the wall lists exactly six tiers', FOUNDER_TIERS.length === 6, FOUNDER_TIERS.length);
check(
  'founder_shirt has its own band on the 3D wall',
  /tiers: \['founder_shirt'\]/.test(read('src/components/road-ahead/FounderWall3D.tsx')),
);

/* ------------------------------------- spots left, via the real function */

check(
  '16 Founder/Shirt entries leave 4 spots',
  tierRemaining(TIER_CAPACITY.founder_shirt, 16) === 4,
);
check('11 Steel entries leave 14 of 25', tierRemaining(TIER_CAPACITY.steel, 11) === 14);
check('20 Brick entries leave 30 of 50', tierRemaining(TIER_CAPACITY.brick, 20) === 30);
check('4 Iron entries leave 6 of 10', tierRemaining(TIER_CAPACITY.iron, 4) === 6);

/* ---------------------------------- roster arithmetic, via the real math */

const GOAL = 1_155_000;
const TIERS = [
  { tier: 'iron', n: 4, each: 100_000 },
  { tier: 'steel', n: 11, each: 50_000 },
  { tier: 'brick', n: 20, each: 10_000 },
  { tier: 'founder_shirt', n: 16, each: 3_500 },
];
const ENTRIES = TIERS.reduce((a, t) => a + t.n, 0);
const RAISED = TIERS.reduce((a, t) => a + t.n * t.each, 0);

check('the roster contains exactly 51 entries', ENTRIES === 51, ENTRIES);
check('the private arithmetic totals $12,060', RAISED === 1_206_000, RAISED);
check('remaining clamps to $0', remainingCents(GOAL, RAISED) === 0);
check('the remaining display renders "$0"', dollars(remainingCents(GOAL, RAISED)) === '$0');
check('over-goal is $510', RAISED - GOAL === 51_000 && dollars(RAISED - GOAL) === '$510');
check('goal is unchanged at $11,550', dollars(GOAL) === '$11,550');
check(
  'per-tier subtotals are $4,000 / $5,500 / $2,000 / $560',
  TIERS.map((t) => dollars(t.n * t.each)).join('|') === '$4,000|$5,500|$2,000|$560',
  TIERS.map((t) => dollars(t.n * t.each)),
);

/* ------------------------------- the package writes those exact values */

check(
  'package sets raised_cents_override to 1206000',
  /raised_cents_override = 1206000/.test(rosterExec),
);
check('package asserts 51 founders before commit', /expected 51/.test(rosterExec));
check('package asserts remaining is 0 before commit', /rem <> 0/.test(rosterExec));
check('package asserts the roster sum is 1206000', /<> 1206000/.test(rosterExec));
// Inspect the SET clause itself — goal_cents legitimately appears in the
// WHERE guard, and a proximity regex cannot tell the two apart.
const campaignSet = /UPDATE campaign_settings\s+SET([\s\S]*?)WHERE/i.exec(rosterExec)?.[1] ?? '';
check('the campaign UPDATE has a SET clause to inspect', campaignSet.length > 0);
check(
  'goal_cents is never assigned (it appears only as a WHERE guard)',
  !/goal_cents/.test(campaignSet) && /WHERE[\s\S]*goal_cents = 1155000/.test(rosterExec),
);
check(
  'Davis Claudeton is $1,000 (Iron rate), not $1,050',
  /UPDATE founders SET amount_cents = 100000[\s\S]{0,60}tier = 'iron'/.test(rosterExec) &&
    !rosterExec.includes('105000'),
);

/* -------------------------------------------- names + duplicate survival */

check(
  'Shell Fardods uses the approved spelling',
  rosterExec.includes("display_name = 'Shell Fardods'") && rosterExec.includes("'Shell Faroods'"),
);
check(
  'Rush Enterprises expansion is applied',
  rosterExec.includes("display_name = 'Rush Enterprises'"),
);
check(
  'Idle Demon Inc expansion is applied',
  rosterExec.includes("display_name = 'Idle Demon Inc'"),
);
check(
  'names are title case, not the uppercase the roster was typed in',
  !rosterExec.includes("'SHELL FARDODS'") && !rosterExec.includes("'RUSH ENTERPRISES'"),
);

const SHIRT = [
  'James R. Shaw',
  'Ernest Murry',
  'Stacey Beavers',
  'Chad Huckelby',
  'Bear & Bug Logistics',
  'Kyle Koerner',
  'Deirdre Monice Sanders',
  'Edward Colon',
  'Zac Elrod',
  'Matt Allgood',
  'Barry Van Hammee Jr',
  'Jesus Chapa',
  'Gunny',
  'Luxury Autos',
  'Cameron Barnes',
];
check(
  'every Founder/Shirt name is present',
  SHIRT.every((n) => rosterExec.includes(`'${n}'`)),
  SHIRT.filter((n) => !rosterExec.includes(`'${n}'`)),
);
check(
  'the four other missing roster entries are inserted',
  [
    'Rosedale Transport',
    'Phil Ciarco — NPM Trucking LLC',
    'Keith Cambell',
    'One Busted Trucker',
  ].every((n) => rosterExec.includes(`'${n}'`)),
);

const barryInserts = (rosterExec.match(/'Barry Van Hammee Jr',\s*'founder_shirt'/g) ?? []).length;
check('Barry Van Hammee Jr is inserted exactly twice', barryInserts === 2, barryInserts);
check(
  'the package asserts Barry holds 2 spots',
  /Barry Van Hammee Jr[\s\S]{0,60}<> 2/.test(rosterExec),
);
check(
  'the package asserts Jose Cotto holds 2 spots across tiers',
  /Jose Cotto[\s\S]{0,60}<> 2/.test(rosterExec),
);
check(
  'Jose Cotto is positioned in BOTH steel and brick',
  rosterExec.includes("('Jose Cotto','steel',2)") &&
    rosterExec.includes("('Jose Cotto','brick',8)"),
);
// Scope to each INSERT statement individually. A greedy match across the whole
// file would hit the position-VALUES list further down, which is a reorder of
// the two EXISTING Jose Cotto rows, not a third insert.
const insertStatements = rosterExec
  .split(/INSERT INTO/i)
  .slice(1)
  .map((chunk) => chunk.split(';')[0]);
check(
  'no INSERT creates a third Jose Cotto row',
  insertStatements.every((s) => !s.includes('Jose Cotto')),
  insertStatements.filter((s) => s.includes('Jose Cotto')).length,
);

/* ---------------------------------------------------------------- privacy */

const stripComments = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s\/\/.*$/gm, '');
check(
  'the public founder reader still never selects amount_cents',
  !/amount_cents/.test(stripComments(read('src/lib/community/founders.ts'))),
);
check(
  'no wall component renders a per-founder amount',
  !/amount_cents/.test(read('src/components/community/FounderCard.tsx')) &&
    !/amount_cents/.test(read('src/components/community/FoundersWallList.tsx')) &&
    !/amount_cents/.test(read('src/components/road-ahead/FounderWall3D.tsx')),
);
check(
  'the aggregate privacy model is still documented',
  /summed to derive the public total/i.test(read('src/lib/community/campaign.ts')),
);

/* ------------------------------------------- no fabricated payment data */

check(
  'no payment provider or reference is written',
  !/payment_provider\s*(,|=)/.test(rosterExec) && !/payment_ref\s*(,|=)/.test(rosterExec),
);
check(
  'the package asserts zero payment references before commit',
  /none may be fabricated/.test(rosterExec),
);
check(
  'no payment processor name appears anywhere in the package',
  !/stripe|paypal|square|venmo|cash ?app/i.test(rosterExec),
);

/* ------------------------------------------------------- FUNDED wording */

const thermometer = read('src/components/admin/AdminCampaignThermometer.tsx');
check(
  'the literal word FUNDED is shown when the goal is reached',
  /goalReached \?[\s\S]{0,200}FUNDED/.test(thermometer),
);
// The owner-approved funded message, verbatim including the em dash.
const FUNDED_MESSAGE = 'FUNDED \u2014 THE WALL IS COMPLETE';
check(
  'the funded message is exactly the approved wording',
  thermometer.includes(FUNDED_MESSAGE),
  FUNDED_MESSAGE,
);
check(
  'the approved wording sits inside the goalReached branch',
  new RegExp(`goalReached \\?[\\s\\S]{0,200}${FUNDED_MESSAGE}`).test(thermometer),
);
check('the superseded funded wording is gone', !/thank you, drivers/i.test(thermometer));
check(
  'FUNDED is gated on remaining reaching zero',
  /const goalReached = goal > 0 && remaining === 0/.test(thermometer),
);
check('the pre-goal wording is unchanged', thermometer.includes('left to open the school'));

/* --------------------------------------------- blast radius of the package */

check(
  'only founders and campaign_settings are written',
  !/INSERT INTO (?!founders)/i.test(rosterExec) &&
    !/UPDATE (?!founders|campaign_settings)/i.test(rosterExec),
);
check(
  'no DELETE outside the commented rollback',
  !/^\s*DELETE/im.test(rosterExec.replace(/__roster_probe__[\s\S]{0,200}/, '')),
);
check(
  'no DDL in the operational package',
  !/\b(ALTER|DROP|CREATE|GRANT|REVOKE|TRUNCATE)\b/i.test(rosterExec),
);
check(
  'the package requires migration 048 first',
  /Migration 048 has not been applied/.test(rosterExec),
);
check('the package is labelled not-executed', /NOT EXECUTED/.test(roster));

/* ------------------------------------------------ tierUsage exhaustiveness */
// Regression: tierUsage used to build its accumulator with an `as` cast, which
// defeated the exhaustiveness check. Adding founder_shirt to the union left the
// object unchanged and every shirt row was silently dropped — the wall rendered
// "20 of 20 spots open" while 16 were sold. Caught by visual validation, not by
// any unit test, which is why this one exists.
{
  const rows = [
    ...Array.from({ length: 4 }, () => ({ tier: 'iron' as const })),
    ...Array.from({ length: 11 }, () => ({ tier: 'steel' as const })),
    ...Array.from({ length: 20 }, () => ({ tier: 'brick' as const })),
    ...Array.from({ length: 16 }, () => ({ tier: 'founder_shirt' as const })),
  ];
  const usage = tierUsage(rows);
  check('tierUsage counts founder_shirt rows', usage.founder_shirt === 16, usage.founder_shirt);
  check(
    'tierUsage counts every tier',
    usage.iron === 4 && usage.steel === 11 && usage.brick === 20,
  );
  check(
    'tierUsage total equals the roster size',
    Object.values(usage).reduce((a, b) => a + b, 0) === 51,
  );
  check(
    'spots-left renders 4 of 20 for Founder / Shirt',
    tierRemaining(TIER_CAPACITY.founder_shirt, usage.founder_shirt) === 4,
  );
  check(
    'every tier in FOUNDER_TIERS has a usage key',
    FOUNDER_TIERS.every((t) => t.value in usage),
  );
}

console.log(`founder-wall-51-roster: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
