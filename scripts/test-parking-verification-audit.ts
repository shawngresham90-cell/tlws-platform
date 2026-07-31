/**
 * Guards for the truck parking verification audit
 * (docs/operations/parking-verification-audit-2026-07-31.md + .sql).
 *
 * The audit made NO production write. These checks exist so that stays true
 * and so the report cannot drift from the definitions it claims to use:
 *
 *   1. the committed audit SQL is read-only — every statement a SELECT; and
 *   2. the eligibility definitions in the report are the ones the APPLICATION
 *      uses, not a hand-restatement that could quietly diverge; and
 *   3. the report's own arithmetic is internally consistent.
 *
 * Filesystem + pure functions only. No database, CI-safe.
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

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

const DOC = 'docs/operations/parking-verification-audit-2026-07-31.md';
const SQL = 'docs/operations/parking-verification-audit-2026-07-31.sql';
const doc = read(DOC);
const sqlRaw = read(SQL);

/** Executable statements only — the file documents its reasoning in prose. */
const sql = sqlRaw
  .split('\n')
  .filter((l) => !l.trimStart().startsWith('--'))
  .join('\n');

/* ------------------------------------------- the audit SQL is read-only --- */

check(
  'the audit SQL contains no write statement',
  !/\b(INSERT|UPDATE|DELETE|MERGE|UPSERT)\b/i.test(sql),
  sql.match(/\b(INSERT|UPDATE|DELETE|MERGE|UPSERT)\b/i)?.[0],
);
check(
  'the audit SQL contains no DDL or permission change',
  !/\b(ALTER|DROP|CREATE|GRANT|REVOKE|TRUNCATE)\b/i.test(sql),
);
check('the audit SQL opens no transaction', !/\b(BEGIN|COMMIT|ROLLBACK)\b/i.test(sql));

const statements = sql
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);
check('the audit SQL has statements to inspect', statements.length >= 8, statements.length);
check(
  'every audit statement is a SELECT or a WITH…SELECT',
  statements.every((s) => /^(WITH|SELECT)\b/i.test(s)),
  statements.filter((s) => !/^(WITH|SELECT)\b/i.test(s)).map((s) => s.slice(0, 40)),
);

/* -------------------- the report's definitions match the application code -- */

const loader = read('src/lib/trip-planner/directory-loader.ts');
check(
  'the planner pool filter in the loader is still published + not-deleted + lat + lng',
  /\.eq\('is_published', true\)/.test(loader) &&
    /\.is\('deleted_at', null\)/.test(loader) &&
    /\.not\('lat', 'is', null\)/.test(loader) &&
    /\.not\('lng', 'is', null\)/.test(loader),
);
check(
  'the report cites the loader as the source of that definition',
  /directory-loader\.ts/.test(doc),
);

const layer = read('src/lib/trip-planner/directory-layer.ts');
check(
  'confirmed truck parking is still a finite POSITIVE space count',
  /Number\.isFinite\(spaces\) && spaces > 0/.test(layer),
);
check(
  'the report cites the zero-space safety rule as the parking definition',
  /hasConfirmedTruckParking/.test(doc) && /zero-space safety rule/i.test(doc),
);

const overnight = read('src/lib/directory/overnight.ts');
check(
  'unknown overnight still never becomes confirmed',
  /value === 'confirmed' \|\| value === 'prohibited' \? value : 'unknown'/.test(overnight),
);

/* ----------------------------------- the report's arithmetic is consistent - */

const PUBLISHED = 2454;
const PUBLISHED_NO_COORDS = 514;
const PLANNER_POOL = 1940;
const DRIVER_USEFUL = 1856;
const PLANNER_PARKING_ELIGIBLE = 1777;
const RECOVERABLE_QUEUE = 79;

check(
  'published − published-without-coordinates equals the planner pool',
  PUBLISHED - PUBLISHED_NO_COORDS === PLANNER_POOL,
);
check(
  'driver-useful − planner-parking-eligible equals the recoverable queue',
  DRIVER_USEFUL - PLANNER_PARKING_ELIGIBLE === RECOVERABLE_QUEUE,
);
check(
  'the report states each of those figures',
  [PUBLISHED, PLANNER_POOL, DRIVER_USEFUL, PLANNER_PARKING_ELIGIBLE, RECOVERABLE_QUEUE].every((v) =>
    new RegExp(`\\b${v.toLocaleString('en-US')}\\b`).test(doc),
  ),
);
check(
  'the reported coordinate coverage matches the reported counts',
  `${((PLANNER_POOL / PUBLISHED) * 100).toFixed(1)} %` === '79.1 %' && /79\.1 %/.test(doc),
);

/* --------------------------------------- the standards were not weakened -- */

check(
  'the report records that no production write occurred',
  /No production data was written/i.test(doc) && /Production writes \| \*\*None\*\*/.test(doc),
);
check('the report records zero newly verified', /Newly verified \| \*\*0\*\*/.test(doc));
check(
  'the blocker is documented rather than worked around',
  /No authoritative source is reachable/i.test(doc) && /403/.test(doc),
);
check(
  'the report explicitly refuses aggregator data as evidence',
  /no aggregator was accepted as evidence/i.test(doc),
);
check(
  'the prohibited shortcuts are named as rejected, not taken',
  /Deliberately \*\*not\*\* recommended/.test(doc) &&
    /rest areas/.test(doc) &&
    /mile markers/.test(doc),
);
check(
  'CAT Scale rows are excluded from the actionable queue',
  /`cat-scales` category \| 6 \| \*\*Excluded\*\*/.test(doc),
);
check(
  'completed operator work is excluded from the actionable queue',
  /do not redo completed operator work/i.test(doc),
);
check(
  'coordinate collisions are quarantine candidates, not silent corrections',
  /quarantine candidates/i.test(doc) && /Guessing would be inventing a coordinate/.test(doc),
);

console.log(`parking-verification-audit: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
