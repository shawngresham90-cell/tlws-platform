/**
 * Guards for the founder recognition execution record
 * (docs/operations/founder-recognition-2026-07.md).
 *
 * The record documents a change that has ALREADY been applied to production.
 * Nothing here runs SQL or touches the database. These checks exist so the
 * record cannot drift from the production numbers it claims to describe, and so
 * the two things that matter most about the change stay true:
 *
 *   1. the arithmetic actually produces "$245 left" — verified against the
 *      REAL campaign math in src/lib/community/campaign.ts, not a restatement
 *      of it; and
 *   2. the contribution amounts stay PRIVATE. The public wall has never shown
 *      a per-founder amount and this change did not alter that.
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
const exists = (p: string) => fs.existsSync(path.join(process.cwd(), p));

const RECORD = 'docs/operations/founder-recognition-2026-07.md';
const doc = read(RECORD);

/* ------------------------------- the arithmetic, via the real campaign math */

const GOAL = 1_155_000; // $11,550 — unchanged throughout
const RAISED_BEFORE = 955_500; // $9,555
const CONTRIBUTIONS = {
  'Davis Claudeton': 105_000, // $1,050
  'Joel Jenkins': 10_000, // $100
  'Daniel Quijada': 10_000, // $100
  'Frederick C. Knapp': 50_000, // $500
};
const TOTAL = Object.values(CONTRIBUTIONS).reduce((a, b) => a + b, 0);
const RAISED_AFTER = RAISED_BEFORE + TOTAL;

check('the four contributions total $1,750', TOTAL === 175_000, TOTAL);
check('raised after the four founders is $11,305', RAISED_AFTER === 1_130_500, RAISED_AFTER);
check(
  'remaining after the four founders is exactly $245',
  remainingCents(GOAL, RAISED_AFTER) === 24_500,
  remainingCents(GOAL, RAISED_AFTER),
);
check(
  'the display string renders as "$245"',
  dollars(remainingCents(GOAL, RAISED_AFTER)) === '$245',
  dollars(remainingCents(GOAL, RAISED_AFTER)),
);
check(
  'the number the site showed before any of this was $1,995',
  dollars(remainingCents(GOAL, RAISED_BEFORE)) === '$1,995',
);
// The two transactions landed in sequence; the intermediate number is part of
// the record and must stay consistent with it.
check(
  'the intermediate state after transaction 1 was $845',
  dollars(remainingCents(GOAL, RAISED_BEFORE + 105_000 + 10_000)) === '$845',
);

/* ------------------------------ the record states those exact numbers ----- */

check(
  'record states 31 founder records',
  /\b31\b/.test(doc) && /Founder records \| \*\*31\*\*/.test(doc),
);
check('record states raised 1,130,500 / $11,305', /1,130,500/.test(doc) && /\$11,305/.test(doc));
check('record states remaining 24,500 / $245', /24,500/.test(doc) && /\$245/.test(doc));
check(
  'record states the goal is unchanged at $11,550',
  /1,155,000 — \*\*\$11,550\*\*, unchanged/.test(doc),
);
check(
  'record names all four founders with their tiers',
  /Davis Claudeton \| Iron/.test(doc) &&
    /Joel Jenkins \| Brick/.test(doc) &&
    /Daniel Quijada \| Brick/.test(doc) &&
    /Frederick C\. Knapp \| Steel/.test(doc),
);
check(
  'record carries each amount_cents value',
  Object.values(CONTRIBUTIONS).every((c) => new RegExp(`\\b${c}\\b`).test(doc)),
);
check(
  'the executed SQL in the record sets raised_cents_override to 1130500',
  /raised_cents_override = 1130500/.test(doc),
);
check('the executed SQL asserts founder_count = 31', /fc\s+<> 31/.test(doc));
check('the executed SQL asserts remaining_cents = 24500', /rem <> 24500/.test(doc));

/* ------------------------------- the superseded package is really gone ---- */

check(
  'the obsolete Davis-only package no longer exists in the tree',
  !exists('docs/operations/founder-davis-claudeton.sql'),
);
check(
  'its removal is explained rather than silent',
  /Superseded package/.test(doc) && /founder-davis-claudeton\.sql/.test(doc),
);
// The superseded section quotes the old package's numbers on purpose — that is
// what makes the removal auditable. They must not appear anywhere else, where
// they would read as a current claim.
const [beforeSuperseded, supersededSection] = doc.split('## Superseded package');
check('the record has a superseded section to scope the old numbers to', !!supersededSection);
check(
  'no stale $945 / 1,060,500 / count-28 claim is presented as current',
  !/\$945/.test(beforeSuperseded) &&
    !/1,060,500/.test(beforeSuperseded) &&
    !/1060500/.test(beforeSuperseded) &&
    !/founder_count = 28/.test(beforeSuperseded),
);
check(
  'the old numbers are quoted in the superseded section, as history',
  /1,060,500/.test(supersededSection ?? '') && /\$945/.test(supersededSection ?? ''),
);

/* ---------------------------------------------------------------- privacy */

const stripComments = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s\/\/.*$/gm, '');
const foundersReaderCode = stripComments(read('src/lib/community/founders.ts'));
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
  'the record states the amounts stay private',
  /Privacy model/.test(doc) && /never read on the public path/.test(doc),
);
check(
  'the aggregate privacy model is still documented in campaign.ts',
  // The sentence wraps across a comment line break, so match the contiguous part.
  /summed to derive the public total/i.test(read('src/lib/community/campaign.ts')) &&
    /NEVER/.test(read('src/lib/community/campaign.ts')),
);
check(
  'tier definitions are unchanged (no dollar thresholds introduced)',
  /Dollar thresholds are intentionally NOT hard-coded/.test(
    read('src/components/community/tiers.ts'),
  ),
);

/* ------------------------------------------------- no invented payment data */

check(
  'the record states payment fields are NULL on all four rows',
  /payment_provider` and `payment_ref` are NULL on all four rows/.test(doc),
);
check(
  'no payment provider name or transaction reference is fabricated',
  !/stripe|paypal|square|venmo|cash ?app|\btxn\b|charge_|\bpi_/i.test(doc),
);

/* ----------------------------------------- the record is inert, not runnable */

const deleteLines = doc.split('\n').filter((l) => /DELETE FROM/i.test(l));
check(
  'every DELETE FROM line is commented out',
  deleteLines.length > 0 && deleteLines.every((l) => l.trimStart().startsWith('--')),
  deleteLines,
);
check(
  'the record is labelled as already applied, not as a package to run',
  /EXECUTION RECORD\. Already applied to production\. Do not re-run/.test(doc),
);
check(
  'a rollback is documented',
  /## Rollback/.test(doc) && /raised_cents_override = 955500/.test(doc),
);
check(
  'no DDL or permission change is described as part of the change',
  !/\b(ALTER TABLE|DROP TABLE|CREATE TABLE|GRANT |REVOKE |TRUNCATE)\b/i.test(doc),
);

console.log(`founder-recognition-2026-07: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
