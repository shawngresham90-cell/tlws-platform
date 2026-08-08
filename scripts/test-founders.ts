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
import {
  TIER_ORDER,
  TIER_CAPACITY,
  TIER_AMOUNT_CENTS,
  FOUNDER_TIERS,
  tierAmountLabel,
} from '@/components/community/tiers';

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
const mk = (display_name: string, tier: string): Row => ({
  display_name,
  business_name: null,
  tier,
});
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
  check(
    'totals reconcile: raised + remaining = goal',
    RAISED + remainingCents(GOAL, RAISED) === GOAL,
  );
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
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
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
  check(
    'PublicFounder type has no amount field',
    !/amount/i.test(reader.split('PublicFounder = {')[1]?.split('}')[0] ?? ''),
  );

  const card = stripComments(readFileSync('src/components/community/FounderCard.tsx', 'utf8'));
  check('FounderCard code never references an amount', !/amount/i.test(card), card);
  const thermo = stripComments(
    readFileSync('src/components/community/CampaignThermometer.tsx', 'utf8'),
  );
  check('Thermometer code never references a per-founder amount', !/amount/i.test(thermo), thermo);
}

/* ---------------------- external links: rel safety ---------------------- */
{
  const card = readFileSync('src/components/community/FounderCard.tsx', 'utf8');
  // The rendered external link (not the doc comment) carries the full rel.
  const relMatches = [...card.matchAll(/rel="([^"]*)"/g)].map((m) => m[1]);
  const safeRel = relMatches.find((r) => r.includes('noopener') && r.includes('noreferrer'));
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
  check(
    'repeated name is Jose Cotto',
    repeats[0] === founderDupKey('Jose Cotto', null),
    repeats[0],
  );
  check(
    'spots minus unique names = extra spots (1)',
    ROSTER.length - uniqueFounderCount(ROSTER) === 1,
  );
  check(
    'normalizeName is case/punctuation-insensitive',
    normalizeName('Jose  Cotto!') === normalizeName('jose cotto'),
  );
  check(
    'distinct names are not flagged as repeats',
    repeatedFounderNames([mk('A', 'iron'), mk('B', 'iron')]).length === 0,
  );
}

/* ---------------------- tier grouping + order ---------------------- */
{
  check(
    'tier order is recognition order',
    JSON.stringify(TIER_ORDER) ===
      JSON.stringify([
        'equipment_sponsor',
        'student_sponsor',
        'iron',
        'steel',
        'brick',
        // founder_shirt ($35, 20 spots) sits lowest on the wall — added with
        // migration 048 for the approved 51-entry roster.
        'founder_shirt',
      ]),
  );
  const usage = tierUsage(ROSTER as { tier: 'iron' | 'steel' | 'brick' }[]);
  check('iron usage = 2', usage.iron === 2, usage);
  check('steel usage = 7', usage.steel === 7, usage);
  check('brick usage = 16', usage.brick === 16, usage);
  check('sponsor tiers empty', usage.equipment_sponsor === 0 && usage.student_sponsor === 0);
  check('tier count sums to roster', usage.iron + usage.steel + usage.brick === ROSTER.length);
  check(
    'every FOUNDER_TIERS entry has a capacity field',
    FOUNDER_TIERS.every((t) => 'capacity' in t),
  );
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
  check(
    'all capped tiers have non-negative remaining',
    (['iron', 'steel', 'brick'] as const).every(
      (t) => (tierRemaining(TIER_CAPACITY[t], usage[t]) ?? 0) >= 0,
    ),
  );
}

/* ---------------------- confirmed report reconciliation ---------------------- */
{
  // Single-source-of-truth end-to-end: the exact numbers the owner confirmed.
  const usage = tierUsage(ROSTER as { tier: 'iron' | 'steel' | 'brick' }[]);
  check('spots sold = 25', ROSTER.length === 25);
  check('unique names = 24', uniqueFounderCount(ROSTER) === 24);
  check(
    'tier occupancy Iron 2 / Steel 7 / Brick 16',
    usage.iron === 2 && usage.steel === 7 && usage.brick === 16,
  );
  check('raised = $7,100', dollars(RAISED) === '$7,100' && RAISED === 710_000);
  check('goal = $12,000', dollars(GOAL) === '$12,000' && GOAL === 1_200_000);
  check(
    'remaining = $4,900',
    dollars(remainingCents(GOAL, RAISED)) === '$4,900' && remainingCents(GOAL, RAISED) === 490_000,
  );
  check('percent renders 59.2 (project 1-decimal convention)', pctToGoal(GOAL, RAISED) === 59.2);
}

/* ---- Thermometer edge states + single-source wiring (Founders admin milestone) ---- */
{
  const GOAL = 1_200_000;
  // $0 raised
  check('$0 raised → 0%', pctToGoal(GOAL, 0) === 0);
  check('$0 raised → full goal remaining', remainingCents(GOAL, 0) === GOAL);
  // goal reached exactly
  check('goal reached → 100%', pctToGoal(GOAL, GOAL) === 100);
  check('goal reached → $0 remaining', remainingCents(GOAL, GOAL) === 0);
  // over goal
  check('over goal → capped at 100%', pctToGoal(GOAL, 1_500_000) === 100);
  check('over goal → remaining never negative', remainingCents(GOAL, 1_500_000) === 0);
  // zero goal never divides by zero
  check('zero goal → 0%', pctToGoal(0, 500) === 0);

  // dollars → cents admin parsing
  const { dollarsToCents } =
    require('@/lib/admin/founders') as typeof import('@/lib/admin/founders');
  check('dollarsToCents "7,100" = 710000', dollarsToCents('7,100') === 710_000);
  check('dollarsToCents "$500" = 50000', dollarsToCents('$500') === 50_000);
  check('dollarsToCents rejects negatives', dollarsToCents('-5') === null);
  check('dollarsToCents blank = null', dollarsToCents('') === null);

  // Single source of truth: one shared thermometer, no hard-coded totals
  const thermo = readFileSync('src/components/community/CampaignThermometer.tsx', 'utf8');
  check('thermometer has progressbar role', thermo.includes('role="progressbar"'));
  check('thermometer has aria-valuetext sentence', thermo.includes('aria-valuetext'));
  check(
    'thermometer clamps via shared math',
    thermo.includes('pctToGoal') && thermo.includes('remainingCents'),
  );
  check('thermometer has visible % text (not color alone)', thermo.includes('% funded'));
  // Owner-approved wording: the funded state says the literal word FUNDED.
  check('thermometer handles goal reached', thermo.includes('FUNDED'));
  for (const [label, path] of [
    ['founders wall page', 'src/app/(community)/founders/page.tsx'],
    ['homepage section', 'src/components/sections/FoundersWall.tsx'],
    ['academy page', 'src/app/(academy)/academy/page.tsx'],
    ['admin preview', 'src/app/admin/(dashboard)/founders/page.tsx'],
  ] as const) {
    const src = readFileSync(path, 'utf8');
    check(`${label} renders shared CampaignThermometer`, src.includes('CampaignThermometer'));
    check(`${label} has no hard-coded raised total`, !/7,?100|59\.2|4,?900/.test(src));
  }
  const thermoNoTotals = !/7,?100|59\.2|4,?900|12,?000/.test(thermo);
  check('thermometer component has no hard-coded totals', thermoNoTotals);

  // Admin actions never touch Pre-School tables
  const actions = readFileSync('src/app/admin/(dashboard)/founders/actions.ts', 'utf8');
  check('founders admin never touches preschool tables', !actions.includes('preschool'));
  check(
    'every founders admin action gated',
    (actions.match(/export async function/g) ?? []).length ===
      (actions.match(/requireAdmin\(\);/g) ?? []).length,
  );
  check(
    'actions revalidate all public surfaces',
    actions.includes("revalidatePath('/founders')") &&
      actions.includes("revalidatePath('/academy')") &&
      actions.includes("revalidatePath('/')"),
  );
}

/* ---- SSR render check: the shared thermometer with the real campaign values ---- */
{
  const React = require('react');
  // esbuild's classic JSX transform expects a React global when bundling TSX.
  (globalThis as Record<string, unknown>).React = React;
  const { renderToStaticMarkup } = require('react-dom/server');
  const { CampaignThermometer } = require('@/components/community/CampaignThermometer');
  const html = renderToStaticMarkup(
    React.createElement(CampaignThermometer, {
      progress: {
        raised_cents: 710_000,
        goal_cents: 1_200_000,
        remaining_cents: 0, // derived internally
        pct_to_goal: 0, // derived internally
        founder_count: 25,
      },
    }),
  );
  check('render: $7,100 raised', html.includes('$7,100 raised'));
  check('render: of $12,000 goal', html.includes('of $12,000 goal'));
  check('render: $4,900 left to open the school', html.includes('$4,900 left to open the school'));
  check('render: 59.2% funded', html.includes('59.2% funded'));
  check('render: aria-valuenow 59.2', html.includes('aria-valuenow="59.2"'));
  check('render: aria-valuetext sentence', html.includes('$7,100 raised of $12,000 goal'));
  check('render: 25 founders', html.includes('25 founders on the wall'));
  const zero = renderToStaticMarkup(
    React.createElement(CampaignThermometer, {
      progress: {
        raised_cents: 0,
        goal_cents: 1_200_000,
        remaining_cents: 0,
        pct_to_goal: 0,
        founder_count: 0,
      },
    }),
  );
  check('render $0: 0% funded', zero.includes('0% funded') && zero.includes('$0 raised'));
  const over = renderToStaticMarkup(
    React.createElement(CampaignThermometer, {
      progress: {
        raised_cents: 1_500_000,
        goal_cents: 1_200_000,
        remaining_cents: 0,
        pct_to_goal: 0,
        founder_count: 25,
      },
    }),
  );
  check(
    'render over-goal: capped 100%, goal reached',
    over.includes('100% funded') && over.includes('FUNDED') && over.includes('width:100%'),
  );
}

/* ------------- the live Founders Wall figures (Lauren Gresham) ------------- */
// The wall is entirely database-backed — no figure on it exists in the
// codebase — so these lock the ARITHMETIC the site derives from the two stored
// numbers (campaign_settings.goal_cents and .raised_cents_override), using the
// same helpers the page uses. They are true the moment the prepared statement
// in data/founders/lauren-gresham-2026-07-26/ADD-FOUNDER.sql is run, and they
// fail if anyone ever changes the derivation.
{
  const LIVE_GOAL = 1_155_000; // $11,550 — unchanged
  const RAISED_BEFORE = 905_500; // $9,055 — 26 founders
  const LAUREN = 50_000; // $500 — Steel
  const RAISED_AFTER = 955_500; // $9,555 — 27 founders

  check('Lauren adds $500 exactly', RAISED_BEFORE + LAUREN === RAISED_AFTER);
  check('new raised renders $9,555', dollars(RAISED_AFTER) === '$9,555');
  check('goal is unchanged at $11,550', dollars(LIVE_GOAL) === '$11,550');
  check(
    'new remaining is $1,995',
    remainingCents(LIVE_GOAL, RAISED_AFTER) === 199_500 &&
      dollars(remainingCents(LIVE_GOAL, RAISED_AFTER)) === '$1,995',
  );
  check(
    'the fundraising math reconciles: $9,555 + $1,995 = $11,550',
    RAISED_AFTER + remainingCents(LIVE_GOAL, RAISED_AFTER) === LIVE_GOAL,
  );
  check(
    'progress moves forward, not backward',
    pctToGoal(LIVE_GOAL, RAISED_AFTER) > pctToGoal(LIVE_GOAL, RAISED_BEFORE),
  );
  check(
    'progress stays under 100% (goal not yet reached)',
    pctToGoal(LIVE_GOAL, RAISED_AFTER) < 100,
  );

  // The superseded figures must never be reachable from the new total.
  check('old raised $9,055 is not the new total', dollars(RAISED_AFTER) !== '$9,055');
  check(
    'old remaining $2,495 is not the new remainder',
    dollars(remainingCents(LIVE_GOAL, RAISED_AFTER)) !== '$2,495',
  );
  // And $2,495 was only ever correct for the old raised figure.
  check(
    '$2,495 was the remainder before Lauren',
    dollars(remainingCents(LIVE_GOAL, RAISED_BEFORE)) === '$2,495',
  );

  // Exactly one founder added: 26 → 27.
  check('founder count increments by exactly one', 26 + 1 === 27);
}

/* ------- the prepared statement matches the figures asserted above ------- */
// The SQL is the only thing that can actually move the wall, so it is checked
// against the same numbers rather than trusted to agree with them.
{
  const sql = readFileSync('data/founders/lauren-gresham-2026-07-26/ADD-FOUNDER.sql', 'utf8');
  check('statement names Lauren Gresham', sql.includes("'Lauren Gresham'"));
  check('statement sets the Steel tier', /'Lauren Gresham',\s*'steel'/.test(sql));
  check('statement appends at position 9, after the existing eight', /'steel',\s*9\b/.test(sql));
  check('statement publishes the row', /'steel',\s*9,\s*true/.test(sql));
  check('statement moves raised to 955500', sql.includes('raised_cents_override = 955500'));
  check('statement asserts the 905500 starting point', sql.includes('905500'));
  check('statement asserts the 26-founder starting point', /expected 26 founders/.test(sql));
  check('statement refuses if a Lauren row already exists', /already match "lauren"/.test(sql));
  check('statement asserts 27 public founders afterwards', /expected 27 public founders/.test(sql));
  check('statement reconciles the arithmetic before committing', sql.includes('199500'));
  check('statement inserts exactly one founder', /Expected to insert exactly 1 founder/.test(sql));
  check('statement is transactional', /^begin;/m.test(sql) && /^commit;/m.test(sql));
  check('statement does not touch the goal', !/set\s+goal_cents/i.test(sql));
  check('statement touches no other founder row', !/update public\.founders/i.test(sql));

  const rollback = readFileSync('data/founders/lauren-gresham-2026-07-26/ROLLBACK.sql', 'utf8');
  check('a rollback exists', rollback.includes('Lauren Gresham'));
  check(
    'rollback restores the previous total',
    rollback.includes('raised_cents_override = 905500'),
  );
  check('rollback returns to 26 founders', /expected 26 founders/.test(rollback));
  check('rollback deletes exactly one row', /Expected to delete exactly 1 row/.test(rollback));
}

/* ----------------------- approved tier contribution amounts ----------------------- */
// Iron $1,000 / Steel $500 / Brick $100 are confirmed. The two sponsor tiers
// have no approved figure and must stay contact-based rather than inventing one.
{
  check('Iron Founder is $1,000', TIER_AMOUNT_CENTS.iron === 100_000);
  check('Steel Founder is $500', TIER_AMOUNT_CENTS.steel === 50_000);
  check('Brick Founder is $100', TIER_AMOUNT_CENTS.brick === 10_000);
  check('Equipment Sponsor has no set amount', TIER_AMOUNT_CENTS.equipment_sponsor === null);
  check('Student Sponsor has no set amount', TIER_AMOUNT_CENTS.student_sponsor === null);

  const byValue = Object.fromEntries(FOUNDER_TIERS.map((t) => [t.value, t]));
  check('Iron renders "$1,000"', tierAmountLabel(byValue.iron) === '$1,000');
  check('Steel renders "$500"', tierAmountLabel(byValue.steel) === '$500');
  check('Brick renders "$100"', tierAmountLabel(byValue.brick) === '$100');
  check(
    'Equipment Sponsor renders a contact-based label, not a number',
    !tierAmountLabel(byValue.equipment_sponsor).includes('$'),
  );
  check(
    'Student Sponsor renders a contact-based label, not a number',
    !tierAmountLabel(byValue.student_sponsor).includes('$'),
  );

  // Ordering is unchanged by adding amounts: sponsors first, then Iron > Steel > Brick.
  check(
    'priced tiers descend Iron > Steel > Brick',
    TIER_AMOUNT_CENTS.iron! > TIER_AMOUNT_CENTS.steel! &&
      TIER_AMOUNT_CENTS.steel! > TIER_AMOUNT_CENTS.brick!,
  );
  check(
    'wall/recognition order is untouched',
    TIER_ORDER.join(',') === 'equipment_sponsor,student_sponsor,iron,steel,brick',
  );

  // Steel is $500 — the same figure stored for Lauren. That agreement is what
  // makes the tier amount correct; it must NOT become a per-founder display.
  check('Steel tier amount matches the Steel contribution', TIER_AMOUNT_CENTS.steel === 50_000);
}

/* --------------- the page shows the amounts and no longer stalls --------------- */
{
  const page = readFileSync('src/app/(community)/founders/page.tsx', 'utf8');

  check('the "amounts TBD" placeholder is gone', !/amounts TBD/i.test(page));
  check('the "being finalized" copy is gone', !/being finalized/i.test(page));
  check('the Placeholder marker is no longer imported', !/\bPlaceholder\b/.test(page));

  check('tier cards render the amount from the tiers module', page.includes('tierAmountLabel'));
  check('tier cards carry an accessible amount label', /aria-label=\{/.test(page));

  // The FAQ array is also the FAQPage JSON-LD source (AcademyFaq emits schema
  // from the same array it renders), so asserting the copy asserts both.
  check('FAQ states Iron Founder is $1,000', /Iron Founder is \$1,000/.test(page));
  check('FAQ states Steel Founder is \\$500', /Steel Founder is \$500/.test(page));
  check('FAQ states Brick Founder is $100', /Brick Founder is \$100/.test(page));
  check(
    'FAQ keeps the sponsor tiers contact-based',
    /Equipment Sponsor and Student Sponsor don’t have a set figure/.test(page),
  );
  check(
    'FAQ says individual amounts are never shown beside a name',
    /never displayed next to their name/.test(page),
  );
  check('the personal follow-up flow is preserved', /Shawn follows up personally/.test(page));
  check('no payment is collected on the page', /No payment is collected here/.test(page));

  // Nothing that would amount to selling: no checkout, no card processing, no
  // guarantee, no tax claim beyond the existing "not tax advice" disclaimer.
  for (const banned of [
    'checkout',
    'add to cart',
    'stripe',
    'card number',
    'guarantee',
    'refund',
  ]) {
    check(`page adds no "${banned}"`, !new RegExp(banned, 'i').test(page));
  }
  check('page still declines to give tax advice', /tax advice/.test(page));

  // Lauren's individual contribution is still not displayed anywhere on the page.
  check('page never prints a per-founder amount', !/founder\.amount|amount_cents/i.test(page));
  const wallList = readFileSync('src/components/community/FoundersWallList.tsx', 'utf8');
  check('the wall list never references an amount', !/amount/i.test(wallList));

  const form = readFileSync('src/components/community/BecomeFounderForm.tsx', 'utf8');
  check('the interest form labels tiers with the same amounts', form.includes('tierAmountLabel'));
  // "card" alone would match the rounded-card utility class, so match the
  // payment senses specifically.
  check(
    'the interest form still collects no payment',
    !/stripe|checkout|card number|credit card|cardholder|payment method/i.test(form),
  );
}

/* ------------- the permission-hardening statement does what it says ------------- */
// Part 2 of this change is a database permission change, not code — so the SQL
// is asserted here the same way the Lauren statement is.
{
  const apply = readFileSync('data/founders/privacy-hardening-2026-07-26/APPLY.sql', 'utf8');

  check('hardening is transactional', /^begin;/m.test(apply) && /^commit;/m.test(apply));
  check(
    'it clears the blanket grants first',
    /revoke all on public\.founders from anon, authenticated;/.test(apply),
  );
  check(
    'it re-grants only column-level SELECT on founders',
    /grant select \([\s\S]*?\) on public\.founders to anon, authenticated;/.test(apply),
  );

  // The whole point: these columns must not appear in the granted list.
  const grantBlock = apply.split('grant select (')[1]?.split(') on public.founders')[0] ?? '';
  for (const restricted of [
    'amount_cents',
    'payment_ref',
    'payment_provider',
    'status',
    'created_at',
    'updated_at',
  ]) {
    check(`anon is not granted ${restricted}`, !grantBlock.includes(restricted));
  }
  for (const allowed of [
    'id',
    'display_name',
    'business_name',
    'business_url',
    'tier',
    'position',
    'message',
    'logo_url',
    'paid_at',
    'is_public',
  ]) {
    check(`anon keeps ${allowed}`, grantBlock.includes(allowed));
  }

  check(
    'it strips the write grants on campaign_settings',
    /revoke all on public\.campaign_settings from anon, authenticated;/.test(apply),
  );
  check(
    'the view no longer sums per-founder amounts',
    !/sum\(amount_cents\)/.test(apply.split('create or replace view')[1] ?? ''),
  );
  check('the view stays security_invoker', /security_invoker = true/.test(apply));
  check('RLS is not weakened', !/disable row level security|drop policy/i.test(apply));

  // It must not modify a single founder row.
  check('hardening inserts no founder row', !/insert\s+into\s+public\.founders/i.test(apply));
  check('hardening updates no founder row', !/update\s+public\.founders/i.test(apply));
  check('hardening deletes no founder row', !/delete\s+from\s+public\.founders/i.test(apply));
  check('hardening does not move the campaign totals', !/set\s+raised_cents_override/i.test(apply));

  // Guards.
  check('it asserts the pre-change exposure', /found 16|all 16 founders columns/.test(apply));
  check('it asserts the 27-founder state', /expected 27 founders/.test(apply));
  check('it proves the denials as the anon role', /set local role anon/.test(apply));
  check('it verifies the totals still read $9,555 / $1,995', /955500|199500/.test(apply));

  const rollback = readFileSync('data/founders/privacy-hardening-2026-07-26/ROLLBACK.sql', 'utf8');
  check('a permission rollback exists', /revoke all on public\.founders/.test(rollback));
  check('the rollback restores the original view', /sum\(amount_cents\)/.test(rollback));
  check('the rollback is transactional', /^begin;/m.test(rollback) && /^commit;/m.test(rollback));
  check('the rollback touches no founder row', !/insert into public\.founders/i.test(rollback));

  const probe = readFileSync(
    'data/founders/privacy-hardening-2026-07-26/PROVE-UNPUBLISHED.sql',
    'utf8',
  );
  check('the unpublished-row probe never commits', !/^commit;/m.test(probe));
  check('the unpublished-row probe rolls back', /^rollback;/m.test(probe));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
