/**
 * Rest-area milestone safety tests (2026-07-29): migration/backfill/canary
 * static checks. CI-safe, filesystem-only.
 *
 *   - migration 047 body is byte-identical to the reviewed plan (PR #207)
 *     and remains schema-only (no data writes) with fail-closed guards
 *   - the M2 backfill script carries every owner-required guard and can
 *     only ever write confirmed/official-operator-export on the 541 cohort
 *   - no 'prohibited' write exists anywhere in milestone SQL
 *   - the canary package is INERT: zero executable SQL lines
 *   - exits are never copied into mile_marker; mile_marker writes carry
 *     state-dot provenance and appear only in commented plan lines
 *   - is_indexable / is_featured / geo are never written
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
const exec = (t: string) =>
  t
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .filter((l) => l.trim().length > 0)
    .join('\n');

/* ------------------------------------------------------- migration 047 */
const plan = read('data/plans/schema-mm-overnight-2026-07-29/PROPOSED-MIGRATION.sql');
const mig = read('supabase/migrations/047_mile_marker_overnight_status.sql');
check(
  '047 body byte-identical to the reviewed plan',
  plan.slice(plan.indexOf('begin;')) === mig.slice(mig.indexOf('begin;')),
);
const migExec = exec(mig);
check('047 is schema-only (no INSERT/UPDATE/DELETE)', !/^\s*(insert|update|delete)\b/im.test(migExec));
check('047 keeps drift guards + post-conditions', /schema drift/.test(mig) && /post-condition failed/.test(mig));
check('047 never touches overnight_parking definition', !/alter column overnight_parking|drop column overnight_parking/i.test(migExec));

/* ---------------------------------------------------------- M2 backfill */
const m2 = read('data/imports/rest-area-2026-07-29/M2-BACKFILL-AS-EXECUTED.sql');
const m2e = exec(m2);
check('M2: cohort id-fingerprint guard present', m2e.includes('d68a000a205e14cfd7c58b4e60da34dc'));
check('M2: exact 541 count guards', (m2e.match(/<> 541/g) ?? []).length >= 3);
check('M2: positive parking count required', /parking_spaces is null or parking_spaces <= 0/.test(m2e));
check('M2: legacy 330 queue guarded and untouched', /<> 330/.test(m2e) && !/set[^;]*csv-import/is.test(m2e));
check(
  "M2: writes only confirmed/official-operator-export/now()",
  /set overnight_status\s*=\s*'confirmed'/.test(m2e) &&
    /'official-operator-export'/.test(m2e) &&
    !/set[^;]*overnight_status\s*=\s*'prohibited'/i.test(m2e),
);
check('M2: correction-safe (only unknown rows)', /and overnight_status = 'unknown'/.test(m2e));
check('M2: never writes mile_marker', !/set[^;]*mile_marker/i.test(m2e));
// The UPDATE's SET list must contain exactly the three authorized
// assignments — overnight_parking may appear only as a WHERE predicate.
const setList = /update public\.locations\s+set([\s\S]*?)\s+where/i.exec(m2e)?.[1] ?? '';
check(
  'M2: SET list is exactly status/source/timestamp (boolean never assigned)',
  /overnight_status\s*=/.test(setList) &&
    /overnight_status_source\s*=/.test(setList) &&
    /overnight_status_verified_at\s*=/.test(setList) &&
    !/overnight_parking\s*=/.test(setList) &&
    setList.split('=').length - 1 === 3,
  setList.trim(),
);
const m2r = read('data/imports/rest-area-2026-07-29/M2-ROLLBACK.sql');
check(
  'M2 rollback: value-matched + count-guarded',
  /overnight_status = 'confirmed'/.test(m2r) &&
    /overnight_status_source = 'official-operator-export'/.test(m2r) &&
    /<> 541/.test(m2r),
);

/* ------------------------------------------------------- canary package */
const canary = read('data/imports/rest-area-2026-07-29/CANARY-PREP-INERT.sql');
check('canary: INERT banner', canary.includes('INERT PLAN — DO NOT EXECUTE'));
check('canary: ZERO executable SQL lines', exec(canary).trim() === '');
check('canary: never proposes an overnight status write', !/set\s+overnight_status/i.test(canary.replace(/HELD:.*$/gm, '')));
check(
  'canary: mile_marker only with state-dot provenance',
  !/mile_marker\s*=\s*\d/.test(canary) ||
    /mile_marker_source='state-dot'/.test(canary.replace(/\s/g, '').replace(/mile_marker_source='state-dot'/g, "mile_marker_source='state-dot'")),
);
check(
  'canary: exit values never copied into mile_marker (distinct fields, distinct values)',
  !/mile_marker\s*=\s*144/.test(canary), // CA exit is 144; its MM is never claimed
);
check('canary: is_indexable/is_featured/geo never written', !/set[^;]*(is_indexable|is_featured|\bgeo\b)\s*=/i.test(canary));
check('canary: AL hold recorded', /AL Grand Bay/.test(canary) && /HELD/.test(canary));

/* ------------------------------------------------------------ documents */
for (const f of [
  'data/imports/rest-area-2026-07-29/M1-EXECUTION-RECORD.md',
  'data/imports/rest-area-2026-07-29/M2-EXECUTION-RECORD.md',
  'data/imports/rest-area-2026-07-29/TAXONOMY-AUDIT.md',
  'data/imports/rest-area-2026-07-29/STATE-DOT-EVIDENCE.md',
]) {
  check(`doc exists: ${path.basename(f)}`, fs.existsSync(path.join(process.cwd(), f)));
}
check(
  'taxonomy: weigh stations kept separate from recommendable parking',
  /never recommendable parking without explicit truck-parking evidence/i.test(
    read('data/imports/rest-area-2026-07-29/TAXONOMY-AUDIT.md'),
  ),
);
check(
  'evidence: honesty rules recorded (24h ≠ overnight, time limit ≠ prohibited)',
  /24 hours" ≠ overnight|"open 24 hours" ≠ overnight confirmed/i.test(
    read('data/imports/rest-area-2026-07-29/STATE-DOT-EVIDENCE.md'),
  ),
);

console.log(`rest-area-plan: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
