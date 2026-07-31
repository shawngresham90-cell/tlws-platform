/**
 * Guards for the inert Davis Claudeton founder package
 * (docs/operations/founder-davis-claudeton.sql).
 *
 * The package is NOT executed by anything in this repo. These checks exist so
 * the statements cannot drift from what was approved, and so the two things
 * that matter most about this change stay true:
 *
 *   1. the arithmetic actually produces "$945 left" — verified against the
 *      REAL campaign math, not a restatement of it; and
 *   2. the contribution amount stays PRIVATE. The public wall has never shown
 *      a per-founder amount and this package must not change that.
 *
 * Filesystem + pure functions only. No database, CI-safe.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { dollars, remainingCents } from '@/lib/community/campaign';

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
const sql = read('docs/operations/founder-davis-claudeton.sql');
/** Executable statements only — the header documents the reasoning in prose. */
const stripSqlComments = (s: string) =>
  s
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('--'))
    .map((l) => l.replace(/\s--.*$/, '')) // trailing comments too
    .join('\n');
const exec = stripSqlComments(sql);

/* ------------------------------- the arithmetic, via the real campaign math */

const GOAL = 1_155_000; // $11,550 — unchanged by this package
const RAISED_BEFORE = 955_500; // $9,555
const CONTRIBUTION = 105_000; // $1,050
const RAISED_AFTER = RAISED_BEFORE + CONTRIBUTION;

check('raised after the contribution is $10,605', RAISED_AFTER === 1_060_500);
check(
  'remaining after the contribution is exactly $945',
  remainingCents(GOAL, RAISED_AFTER) === 94_500,
  remainingCents(GOAL, RAISED_AFTER),
);
check(
  'the display string renders as "$945"',
  dollars(remainingCents(GOAL, RAISED_AFTER)) === '$945',
  dollars(remainingCents(GOAL, RAISED_AFTER)),
);
check(
  'the number the site shows today is $1,995',
  dollars(remainingCents(GOAL, RAISED_BEFORE)) === '$1,995',
);
// The originally requested $1,000 would NOT have produced $945 — this is why
// the amount was confirmed as $1,050. Pinned so the discrepancy stays visible.
check(
  'a $1,000 contribution would have left $995, not $945',
  dollars(remainingCents(GOAL, RAISED_BEFORE + 100_000)) === '$995',
);

/* ------------------------------------- the package writes those exact values */

check(
  'package sets raised_cents_override to 1060500',
  /raised_cents_override = 1060500/.test(exec),
);
check('package asserts remaining_cents = 94500 before committing', /rem <> 94500/.test(exec));
check('package asserts founder_count = 28 before committing', /fc\s+<> 28/.test(exec));
const setClause = /UPDATE campaign_settings\s+SET([\s\S]*?)WHERE/i.exec(exec)?.[1] ?? '';
check('the UPDATE has a SET clause to inspect', setClause.length > 0);
check(
  'goal_cents is never assigned (it appears only as a WHERE guard)',
  !/goal_cents/.test(setClause),
);
check(
  'goal_cents IS used as a guard in the WHERE clause',
  /WHERE[\s\S]*goal_cents = 1155000/.test(exec),
);

/* ---------------------------------------------------------------- privacy */

const foundersReaderCode = read('src/lib/community/founders.ts')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
check(
  'the public founder reader still never selects amount_cents',
  !/amount_cents/.test(foundersReaderCode),
);
check(
  'no component renders a per-founder amount',
  !/amount_cents/.test(read('src/components/community/FounderCard.tsx')) &&
    !/amount_cents/.test(read('src/components/community/FoundersWallList.tsx')),
);
check(
  'the contribution is recorded privately in amount_cents',
  /amount_cents/.test(exec) && /105000/.test(exec),
);

/* ------------------------------------------------- no invented payment data */

check(
  'payment_provider and payment_ref are inserted as NULL',
  /payment_provider, payment_ref/.test(exec) && /NULL,\s*NULL,\s*true,\s*'approved'/.test(exec),
);
check(
  'no payment provider name or reference is fabricated anywhere',
  !/stripe|paypal|square|venmo|cash ?app|txn|charge_|pi_/i.test(exec),
);

/* ------------------------------------------- blast radius: one row, one row */

check('exactly one INSERT', (exec.match(/INSERT INTO/gi) ?? []).length === 1);
check('the only INSERT targets founders', /INSERT INTO founders/i.test(exec));
check(
  'exactly one UPDATE, and it targets campaign_settings',
  (exec.match(/UPDATE /gi) ?? []).length === 1 && /UPDATE campaign_settings/i.test(exec),
);
check('no DELETE outside the commented rollback', !/DELETE/i.test(exec));
check('no other founder row is modified', !/UPDATE founders/i.test(exec));
check(
  'no DDL, no migration, no permission change',
  !/\b(ALTER|DROP|CREATE|GRANT|REVOKE|TRUNCATE)\b/i.test(exec),
);
check(
  'nothing outside founders + campaign_settings is written',
  {
    ok: !/INSERT INTO (?!founders)|UPDATE (?!campaign_settings)/i.test(exec),
  }.ok,
);

/* ---------------------------------------------------------------- guards */

check('guarded against running twice', /already exists/.test(sql));
check(
  'guarded against the campaign numbers having moved',
  /expected 1155000\/955500/.test(sql) && /IS DISTINCT FROM 955500/.test(exec),
);
check('wrapped in a transaction', /BEGIN;/.test(exec) && /COMMIT;/.test(exec));
check('a rollback is documented', /ROLLBACK/.test(sql) && /955500, updated_at = now\(\)/.test(sql));
check('the tier is flagged as the one open decision', /CONFIRM OR CHANGE THIS ONE WORD/.test(sql));
check('the package is labelled inert', /INERT PACKAGE — NOT EXECUTED/.test(sql));

/* ------------------------------- the wall design itself is left alone ------ */

check(
  'tier definitions are unchanged (no dollar thresholds introduced)',
  /Dollar thresholds are intentionally NOT hard-coded/.test(
    read('src/components/community/tiers.ts'),
  ),
);
check(
  'the aggregate privacy model is still documented in campaign.ts',
  // The sentence wraps across a comment line break, so match the contiguous part.
  /summed to derive the public total/i.test(read('src/lib/community/campaign.ts')) &&
    /NEVER/.test(read('src/lib/community/campaign.ts')),
);

console.log(`founder-davis-claudeton: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
