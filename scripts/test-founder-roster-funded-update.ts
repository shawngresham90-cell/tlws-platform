/**
 * FOUNDER ROSTER UPDATE — FOUNDER-WALL-FUNDED-1 (2026-08-20).
 *
 * The roster change itself is a production data operation that this PR
 * deliberately does NOT perform: the SQL package ships unapplied behind an
 * owner-authorized gate. What IS deterministic — and what these checks lock —
 * is that the package says exactly what the owner approved:
 *
 *   moves Ricky and Phil Steel -> Iron by verified row id, adds Wayne's Meat
 *   Market / Globe Life to Iron and Margaret Abbey to Brick, invents no money,
 *   preserves the moved rows' financial fields, leaves campaign_settings and
 *   every other table alone, and fails loudly on any pre-state drift.
 *
 * The row ids and pre-state below came from a read-only production preflight
 * recorded in the package manifest; APPLY.sql re-asserts all of it in its own
 * transaction, so these checks and the script cannot disagree silently.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}
const PKG = 'data/founders/founder-wall-funded-update-2026-08-20';
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

const apply = read(`${PKG}/APPLY.sql`);
const verify = read(`${PKG}/VERIFY.sql`);
const rollback = read(`${PKG}/ROLLBACK.sql`);
const precheck = read(`${PKG}/PRECHECK.sql`);
const manifest = JSON.parse(read(`${PKG}/manifest.json`));

/** Strip SQL `--` comments: the scripts NAME campaign_settings in prose to
 *  explain that they never write it, which must not read as a reference. */
const sqlCode = (s: string) => s.replace(/--.*$/gm, '');
/** Strip TS block AND line comments, for the same reason. */
const tsCode = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const RICKY = '4086e3dd-b14f-44a5-aae4-57b77434993a';
const PHIL = '84af1472-7efd-4dba-a104-80e24bb76a4c';
const RICKY_NAME = 'Ricky M. Rosenbalm';
const PHIL_NAME = 'Phil Ciarco — NPM Trucking LLC';
const NEW_NAMES = ["Wayne''s Meat Market", 'Globe Life', 'Margaret Abbey'];

/* -------------------------------------------- package shape + unapplied */

for (const f of [
  'README.md',
  'PRECHECK.sql',
  'APPLY.sql',
  'VERIFY.sql',
  'ROLLBACK.sql',
  'manifest.json',
]) {
  check(`package contains ${f}`, fs.existsSync(path.join(process.cwd(), PKG, f)));
}
check('manifest records the package as UNAPPLIED', manifest.applied === false);
check(
  'manifest is an incremental change, not a migration',
  manifest.kind === 'incremental-founder-data-change',
);
check(
  'the historical 51-founder package is untouched',
  fs.existsSync(path.join(process.cwd(), 'data/founders/lauren-gresham-2026-07-26')),
);

/* ------------------------------- 1-2. Ricky and Phil move Steel -> Iron */

check(
  '1. Ricky moves to iron/7 by row id',
  new RegExp(`SET tier = 'iron', position = 7[^;]*WHERE id = v_ricky`).test(apply),
  apply,
);
check(
  '2. Phil moves to iron/8 by row id',
  new RegExp(`SET tier = 'iron', position = 8[^;]*WHERE id = v_phil`).test(apply),
);
check('Ricky targeted by the verified uuid', apply.includes(RICKY));
check('Phil targeted by the verified uuid', apply.includes(PHIL));
check(
  'moves assert the reviewed Steel pre-state',
  apply.includes("tier = 'steel' AND position = 8") &&
    apply.includes("tier = 'steel' AND position = 9"),
);

// The two UPDATEs must touch tier/position/updated_at and nothing else.
for (const [who, re] of [
  ['Ricky', /UPDATE public\.founders SET ([^;]*?) WHERE id = v_ricky;/],
  ['Phil', /UPDATE public\.founders SET ([^;]*?) WHERE id = v_phil;/],
] as const) {
  const set = apply.match(re)?.[1] ?? '';
  check(
    `${who}'s UPDATE sets only tier, position, updated_at`,
    /^tier = '\w+', position = \d+, updated_at = now\(\)$/.test(set.trim()),
    set,
  );
  for (const col of [
    'amount_cents',
    'payment_provider',
    'payment_ref',
    'paid_at',
    'is_public',
    'status',
  ]) {
    check(`${who}'s UPDATE never writes ${col}`, !set.includes(col), set);
  }
}

/* ---------------------------------------------- 3. neither is duplicated */

check(
  '3. APPLY asserts exactly one Ricky',
  apply.includes(`WHERE display_name = '${RICKY_NAME}'`) && /expected exactly 1 Ricky/.test(apply),
);
check(
  '3. APPLY asserts exactly one Phil',
  apply.includes(`WHERE display_name = '${PHIL_NAME}'`) && /expected exactly 1 Phil/.test(apply),
);
check(
  '3. post-state asserts each target name appears exactly once',
  /HAVING count\(\*\) <> 1/.test(apply),
);

/* ------------------------------------------ 4-6. the three new placements */

const insert = apply.slice(
  apply.indexOf('INSERT INTO public.founders'),
  apply.indexOf('----------------------------------------------------------------- 3. VERIFY'),
);
check(
  "4. Wayne's Meat Market is iron/5",
  /\('Wayne''s Meat Market'[^)]*'iron',\s*5,/.test(insert),
  insert,
);
check('5. Globe Life is iron/6', /\('Globe Life'[^)]*'iron',\s*6,/.test(insert), insert);
check(
  '6. Margaret Abbey is brick/21',
  /\('Margaret Abbey'[^)]*'brick',\s*21,/.test(insert),
  insert,
);

// Exact spellings, including Wayne's apostrophe, Ricky's middle initial and
// Phil's full existing display name.
check("Wayne's apostrophe is SQL-escaped, not dropped", insert.includes("Wayne''s Meat Market"));
check("Ricky's middle initial is preserved", apply.includes('Ricky M. Rosenbalm'));
check(
  "Phil's full display name with NPM Trucking LLC is preserved",
  apply.includes('Phil Ciarco — NPM Trucking LLC'),
);

/* ------------------------------------- 7-8. positions unique, steel freed */

check(
  '7. APPLY rejects duplicate tier/position pairs',
  /GROUP BY tier, position HAVING count\(\*\) > 1/.test(apply),
);
check(
  '7. APPLY checks the target slots are free first',
  /iron' AND position IN \(5,6,7,8\)/.test(apply) && /brick' AND position = 21/.test(apply),
);
check(
  '8. APPLY asserts steel 8/9 are vacated',
  /tier = 'steel' AND position IN \(8,9\)/.test(apply),
);
check(
  '8. steel is NOT renumbered (survivors keep their positions)',
  manifest.changes.steel_renumbered === false,
);
check(
  '8. manifest records the vacated slots',
  JSON.stringify(manifest.changes.steel_positions_vacated) === '[8,9]',
);

/* --------------------------------------- 9. final counts match preflight */

const pre = manifest.preflight;
check('9. preflight total is the reviewed 51', pre.total_founders === 51);
check(
  '9. preflight tiers are 4/11/20/16',
  pre.tier_counts.iron === 4 &&
    pre.tier_counts.steel === 11 &&
    pre.tier_counts.brick === 20 &&
    pre.tier_counts.founder_shirt === 16,
);
const post = manifest.expected_post_state;
check('9. expected total is 54', post.total_founders === 54);
check(
  '9. expected tiers are 8/9/21/16',
  post.tier_counts.iron === 8 &&
    post.tier_counts.steel === 9 &&
    post.tier_counts.brick === 21 &&
    post.tier_counts.founder_shirt === 16,
);
// The arithmetic must actually reconcile: 51 + 3 added = 54; iron 4 + 2 moved + 2 added = 8.
check(
  '9. totals reconcile: 51 + 3 inserts = 54',
  pre.total_founders + manifest.changes.inserts.length === post.total_founders,
);
check(
  '9. iron reconciles: 4 + 2 moved + 2 added = 8',
  pre.tier_counts.iron + 2 + 2 === post.tier_counts.iron,
);
check(
  '9. steel reconciles: 11 - 2 moved = 9',
  pre.tier_counts.steel - 2 === post.tier_counts.steel,
);
check(
  '9. brick reconciles: 20 + 1 added = 21',
  pre.tier_counts.brick + 1 === post.tier_counts.brick,
);
check(
  '9. founder_shirt is untouched',
  pre.tier_counts.founder_shirt === post.tier_counts.founder_shirt,
);
for (const n of ['iron = 8', 'steel = 9', 'brick = 21', 'total = 54']) {
  check(`9. VERIFY.sql asserts ${n}`, verify.includes(n));
}
check(
  '9. APPLY verifies every tier count in-transaction',
  /iron is %, expected 8/.test(apply) &&
    /steel is %, expected 9/.test(apply) &&
    /brick is %, expected 21/.test(apply) &&
    /founder_shirt is %, expected 16/.test(apply),
);

/* --------------------------------- 10. new rows carry no invented payment */

for (const row of manifest.changes.inserts) {
  check(`10. ${row.display_name} has no amount_cents`, row.amount_cents === null);
  check(`10. ${row.display_name} has no payment_provider`, row.payment_provider === null);
  check(`10. ${row.display_name} has no payment_ref`, row.payment_ref === null);
}
// Every VALUES tuple must supply NULL for the money columns.
const tuples = [...insert.matchAll(/\('(?:[^']|'')+',[\s\S]*?\)(?=,\n|;)/g)].map((m) => m[0]);
check('10. three insert tuples', tuples.length === 3, tuples.length);
for (const t of tuples) {
  check(
    `10. tuple invents no money: ${t.slice(1, 26)}…`,
    /NULL, NULL, NULL, NULL, NULL,/.test(t),
    t,
  );
  check(
    `10. tuple has no digits-as-cents: ${t.slice(1, 26)}…`,
    !/\b\d{3,}\b/.test(t.replace(/'[^']*'/g, '')),
    t,
  );
}
check(
  '10. APPLY re-checks the new rows carry no payment data',
  /a new row carries invented payment data/.test(apply),
);
check('10. APPLY refuses to invent paid_at', /will not invent a contribution date/.test(apply));
check(
  '10. manifest records the paid_at owner gate',
  manifest.blocked_on_owner_input?.field === 'public.founders.paid_at',
);

/* --------------------------- 11. moved rows preserve financial/payment */

check(
  '11. APPLY verifies Ricky kept amount + paid_at',
  /v_ricky[\s\S]{0,200}amount_cents = 50000[\s\S]{0,120}paid_at = '2026-07-13/.test(apply),
);
check(
  '11. APPLY verifies Phil kept amount + paid_at',
  /v_phil[\s\S]{0,200}amount_cents = 50000[\s\S]{0,120}paid_at = '2026-08-02/.test(apply),
);
check(
  '11. VERIFY.sql re-checks both preserved amounts',
  verify.includes('Ricky kept amount + paid_at') && verify.includes('Phil kept amount + paid_at'),
);

/* ---------------------------------------- 12. campaign_settings untouched */

for (const [label, raw] of [
  ['APPLY', apply],
  ['ROLLBACK', rollback],
] as const) {
  const sql = sqlCode(raw);
  const writes = sql.match(/\b(UPDATE|INSERT INTO|DELETE FROM|ALTER TABLE|DROP)\s+(\S+)/gi) ?? [];
  check(
    `12. ${label} writes only public.founders`,
    writes.every((w) => /public\.founders/i.test(w)),
    writes,
  );
  check(`12. ${label} never mentions campaign_settings`, !/campaign_settings/i.test(sql));
  for (const col of ['raised_cents_override', 'goal_cents']) {
    check(`12. ${label} never writes ${col}`, !new RegExp(`(SET|,)\\s*${col}\\s*=`).test(sql));
  }
}
// PRECHECK/VERIFY may READ campaign_settings — that is how the owner proves it did not change.
check(
  '12. PRECHECK reads campaign_settings for before/after comparison',
  /SELECT[\s\S]*campaign_settings/i.test(precheck),
);
check(
  '12. VERIFY reads campaign_settings for before/after comparison',
  /SELECT[\s\S]*campaign_settings/i.test(verify),
);
check(
  '12. manifest states campaign_settings is untouched',
  typeof manifest.untouched.campaign_settings === 'string',
);

/* ------------------------------------ transactional + rollback integrity */

check('APPLY runs in one transaction', /^BEGIN;/m.test(apply) && /^COMMIT;/m.test(apply));
check('APPLY aborts on pre-state drift', /expected the reviewed 51/.test(apply));
check('APPLY fails if any new name already exists', /already exists \(% found\)/.test(apply));
check(
  'ROLLBACK restores steel/8 and steel/9',
  /position = 8[^;]*v_ricky/.test(rollback) && /position = 9[^;]*v_phil/.test(rollback),
);
check(
  'ROLLBACK only deletes rows that still carry no payment data',
  /amount_cents IS NULL[\s\S]{0,120}payment_provider IS NULL[\s\S]{0,120}payment_ref IS NULL/.test(
    rollback,
  ),
);
check('ROLLBACK verifies it lands back on 51', /expected 51/.test(rollback));

/* ------------- 22. public founder cards still expose no individual amount */

const reader = read('src/lib/community/founders.ts');
check('22. public reader never selects amount_cents', !/amount_cents/.test(tsCode(reader)));
check(
  '22. PublicFounder type carries no amount',
  !/amount/i.test(reader.split('PublicFounder = {')[1]?.split('}')[0] ?? ''),
);
check(
  '22. FounderCard never renders an amount',
  !/amount/i.test(tsCode(read('src/components/community/FounderCard.tsx'))),
);

console.log(`founder-roster-funded-update: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
