/**
 * Static tests for the mile-marker + overnight-status planning package
 * (data/plans/schema-mm-overnight-2026-07-29). The package is PLAN ONLY —
 * these tests prove, from the committed files alone, that:
 *
 *   - no plan SQL is in an auto-applied location and every SQL file is
 *     banner-marked inert
 *   - the proposed migration writes no data (no INSERT/UPDATE at all)
 *   - exit numbers are never copied/relabeled into mile_marker
 *   - unknown overnight values can never become prohibited (no prohibited
 *     write exists anywhere)
 *   - Pilot / TA / NTAD / legacy csv rows are never auto-confirmed
 *   - the backfill is count-guarded and correction-safe
 *   - the rollback drops every object the migration adds
 *   - the parking-count safety gate (hasConfirmedTruckParking) behaves
 *     exactly as before
 *
 * Run: npx esbuild scripts/test-schema-plan.ts --bundle --platform=node \
 *   --format=cjs --alias:@=./src --outfile=/tmp/test-schema-plan.cjs \
 *   && node /tmp/test-schema-plan.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { hasConfirmedTruckParking } from '@/lib/trip-planner/directory-layer';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const PLAN_DIR = path.join(process.cwd(), 'data/plans/schema-mm-overnight-2026-07-29');
const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase/migrations');

const read = (f: string) => fs.readFileSync(path.join(PLAN_DIR, f), 'utf8');
/** Executable (non-comment) lines of a SQL file. */
const sqlLines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .filter((l) => l.trim().length > 0);

/* --------------------------------------------------------- package shape */
const EXPECTED = [
  'SCHEMA-AUDIT.md',
  'OVERNIGHT-ACCOUNTING.md',
  'DESIGN.md',
  'PROPOSED-MIGRATION.sql',
  'PROPOSED-ROLLBACK.sql',
  'PROPOSED-BACKFILL.sql',
];
for (const f of EXPECTED) {
  check(`plan file exists: ${f}`, fs.existsSync(path.join(PLAN_DIR, f)));
}

/* ------------------------------------------------- inertness / location */
const SQL_FILES = ['PROPOSED-MIGRATION.sql', 'PROPOSED-ROLLBACK.sql', 'PROPOSED-BACKFILL.sql'];
for (const f of SQL_FILES) {
  check(`${f}: carries the INERT banner`, read(f).includes('INERT PLAN — DO NOT EXECUTE'));
}
// M1 was explicitly authorized and applied (rest-area milestone, 2026-07-29):
// exactly ONE migration file may mention the new columns —
// 047_mile_marker_overnight_status.sql — and its body must remain
// byte-identical to the reviewed plan. No other migration mentions them.
const AUTHORIZED_M1 = '047_mile_marker_overnight_status.sql';
const migrationFiles = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
check(
  'only the authorized 047 migration mentions mile_marker or overnight_status',
  migrationFiles.every((f) => {
    if (f === AUTHORIZED_M1) return true;
    const t = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
    return !/mile_marker|overnight_status/i.test(t);
  }),
);
check(
  '047 exists and its body is byte-identical to the reviewed plan',
  (() => {
    const migPath = path.join(MIGRATIONS_DIR, AUTHORIZED_M1);
    if (!fs.existsSync(migPath)) return false;
    const mig = fs.readFileSync(migPath, 'utf8');
    const plan = read('PROPOSED-MIGRATION.sql');
    return plan.slice(plan.indexOf('begin;')) === mig.slice(mig.indexOf('begin;'));
  })(),
);
// And the harness reconfirms nothing auto-applies migrations at build time.
const netlifyToml = fs.readFileSync(path.join(process.cwd(), 'netlify.toml'), 'utf8');
check('netlify build does not run migrations', !/supabase\s+(db|migration)/i.test(netlifyToml));
const workflowDir = path.join(process.cwd(), '.github/workflows');
check(
  'no GitHub workflow applies migrations',
  fs
    .readdirSync(workflowDir)
    .every(
      (f) =>
        !/supabase\s+(db|migration)|migration:apply|db push/i.test(
          fs.readFileSync(path.join(workflowDir, f), 'utf8'),
        ),
    ),
);

/* ----------------------------------------- migration writes no data at all */
const mig = read('PROPOSED-MIGRATION.sql');
const migExec = sqlLines(mig).join('\n');
check(
  'migration contains no INSERT/UPDATE/DELETE (schema-only, zero data writes)',
  !/^\s*(insert|update|delete)\b/im.test(migExec),
);
check('migration is transaction-wrapped', /^begin;/m.test(mig) && /^commit;/m.test(mig));
check('migration has fail-closed drift guards', /raise exception 'schema drift/.test(mig));
check('migration has fail-closed post-conditions', /post-condition failed/.test(mig));
check("overnight_status defaults to 'unknown'", /default 'unknown'/.test(migExec));
check(
  'status CHECK is exactly confirmed/prohibited/unknown',
  /overnight_status in \('confirmed', 'prohibited', 'unknown'\)/.test(migExec),
);
check(
  'mile marker is exact numeric, not floating point',
  /mile_marker numeric\(6,2\)/.test(migExec) &&
    !/mile_marker (double precision|real|float)/i.test(migExec),
);
check(
  'mile marker rejects negatives and caps range',
  /mile_marker >= 0 and mile_marker <= 1500/.test(migExec),
);
check(
  'mile marker requires provenance (pairing check)',
  /\(mile_marker is null\) = \(mile_marker_source is null\)/.test(migExec),
);
check(
  'confirmed/prohibited require provenance (pairing check)',
  /overnight_status = 'unknown' or overnight_status_source is not null/.test(migExec),
);
check(
  'anti-drift: boolean-true + prohibited is structurally impossible',
  /not \(overnight_parking = true and overnight_status = 'prohibited'\)/.test(migExec),
);

/* ------------------------------- exit numbers are never relabeled as MM */
for (const f of SQL_FILES) {
  const exec = sqlLines(read(f)).join('\n');
  check(
    `${f}: never assigns mile_marker (no exit-number copy possible)`,
    !/\bmile_marker\s*=(?!=)/.test(exec.replace(/mile_marker (is null\) =|>=|<=)/g, 'MM_SAFE ')),
  );
  check(
    `${f}: no UPDATE/INSERT references exit_number`,
    !/^\s*(update|insert)[\s\S]*?exit_number/im.test(exec) && !/set[^;]*exit_number/i.test(exec),
  );
}

/* ------------------------------------ prohibited is never written anywhere */
for (const f of SQL_FILES) {
  const exec = sqlLines(read(f)).join('\n');
  check(
    `${f}: never sets overnight_status to prohibited`,
    !/set[^;]*overnight_status\s*=\s*'prohibited'/i.test(exec) &&
      !/'prohibited'[^;]*where/i.test(
        exec.replace(/in \('confirmed', 'prohibited', 'unknown'\)/g, ''),
      ),
  );
}

/* --------------------------------------------- backfill scope and guards */
const backfill = read('PROPOSED-BACKFILL.sql');
const backfillExec = sqlLines(backfill).join('\n');
check(
  "backfill confirms ONLY the Love's evidence cohort",
  /source = 'loves-master-2026-07-27'/.test(backfillExec) &&
    /overnight_parking = true/.test(backfillExec),
);
check(
  'backfill never auto-confirms Pilot rows',
  !/set[^;]*confirmed[^;]*pilot/is.test(backfillExec) &&
    /pilot-master-2026-07-27/.test(backfillExec), // present only in the exclusion post-condition
);
check(
  'backfill never auto-confirms TA rows',
  !/set[^;]*confirmed[^;]*ta-petro/is.test(backfillExec) &&
    /official-ta-petro-20260725-5ebe0e9f/.test(backfillExec),
);
check('backfill leaves NTAD canaries unknown', /ntad-2019-v04/.test(backfillExec));
check(
  'backfill excludes legacy csv-import from auto-confirmation',
  /source = 'csv-import'/.test(backfillExec),
);
check('backfill is count-guarded (exactly 541)', /<> 541/.test(backfillExec));
check(
  'backfill is correction-safe (only touches unknown rows)',
  /and overnight_status = 'unknown'/.test(backfillExec),
);
check('backfill never writes mile_marker', !/mile_marker/.test(backfillExec));
check(
  'backfill post-condition proves no prohibited row appeared',
  /overnight_status = 'prohibited'/.test(backfillExec) && /post-condition failed/.test(backfill),
);

/* -------------------------------------------------- rollback covers all */
const rollback = read('PROPOSED-ROLLBACK.sql');
const addedColumns = [...mig.matchAll(/add column (\w+)/g)].map((m) => m[1]);
const addedConstraints = [...mig.matchAll(/add constraint (\w+)/g)].map((m) => m[1]);
const addedIndexes = [...mig.matchAll(/create index (\w+)/g)].map((m) => m[1]);
check('migration adds exactly 6 columns', addedColumns.length === 6, addedColumns);
check('migration adds exactly 7 constraints', addedConstraints.length === 7, addedConstraints);
check('migration adds exactly 1 index', addedIndexes.length === 1, addedIndexes);
for (const col of addedColumns) {
  check(`rollback drops column ${col}`, rollback.includes(`drop column if exists ${col}`));
}
for (const con of addedConstraints) {
  check(`rollback drops constraint ${con}`, rollback.includes(`drop constraint if exists ${con}`));
}
for (const idx of addedIndexes) {
  check(`rollback drops index ${idx}`, rollback.includes(`drop index if exists public.${idx}`));
}
check('rollback verifies nothing remains', /rollback post-condition failed/.test(rollback));
check('rollback warns about post-correction data loss', /export them first/i.test(rollback));

/* -------------------------------- no plan SQL touches guarded flag fields */
for (const f of SQL_FILES) {
  const exec = sqlLines(read(f)).join('\n');
  check(
    `${f}: never writes is_published/is_featured/is_indexable/geo/parking_spaces`,
    !/set[^;]*(is_published|is_featured|is_indexable|\bgeo\b|parking_spaces)\s*=/i.test(exec) &&
      !/add column (is_published|is_featured|is_indexable|geo|parking_spaces)/i.test(exec),
  );
}

/* ------------------------------------ parking-count safety gate untouched */
check('gate: positive count passes', hasConfirmedTruckParking(5) === true);
check('gate: zero fails', hasConfirmedTruckParking(0) === false);
check('gate: undefined fails', hasConfirmedTruckParking(undefined) === false);
check('gate: null fails', hasConfirmedTruckParking(null) === false);
check('gate: NaN fails', hasConfirmedTruckParking(Number.NaN) === false);
check('gate: string fails', hasConfirmedTruckParking('12') === false);
check('gate: Infinity fails', hasConfirmedTruckParking(Number.POSITIVE_INFINITY) === false);

console.log(`schema-plan: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
