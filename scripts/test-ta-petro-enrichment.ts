/**
 * TA/Petro interstate + exit enrichment — manifest integrity + normalization.
 *
 * Guards the enrichment package under data/imports/ta-petro/enrichment/:
 * every value written to the live DB came from the operator master Directions
 * field, matches the app's stored format, and produces a valid corridor/exit
 * route via the SAME functions the app uses. Offline; reads the manifest JSON.
 *
 * Run:
 *   npx esbuild scripts/test-ta-petro-enrichment.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-ta-petro-enrichment.cjs && node /tmp/test-ta-petro-enrichment.cjs
 */
import { readFileSync } from 'node:fs';
import { interstateSlug, exitSlug, interstateBySlug } from '@/lib/directory/interstates';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

type Row = {
  id: string;
  name: string;
  state: string;
  interstate: string | null;
  exit_number: string | null;
  interstate_decision: string;
  exit_decision: string;
  concurrency?: boolean;
  all_interstates?: string[] | null;
  evidence?: string | null;
};
const pkg = JSON.parse(
  readFileSync('data/imports/ta-petro/enrichment/manifest-enrichment.json', 'utf8'),
) as { source_label: string; counts: Record<string, number>; rows: Row[] };

const rows = pkg.rows;
const iApproved = rows.filter((r) => r.interstate_decision === 'approved');
const eApproved = rows.filter((r) => r.exit_decision === 'approved');

// ---- counts match the package header ----
check('304 rows in manifest', rows.length === 304, String(rows.length));
check(
  'interstate approved count matches header',
  iApproved.length === pkg.counts.interstate_approved,
);
check('exit approved count matches header', eApproved.length === pkg.counts.exit_approved);
check(
  'source label is the checkpoint label',
  pkg.source_label === 'official-ta-petro-20260725-5ebe0e9f',
);

// ---- id uniqueness ----
check('row ids unique', new Set(rows.map((r) => r.id)).size === 304);

// ---- format: interstate I-<num>, exit <num>[A-Z] ----
for (const r of iApproved) {
  check(
    `interstate format ${r.name}`,
    /^I-\d{1,3}$/.test(r.interstate ?? ''),
    r.interstate ?? 'null',
  );
}
for (const r of eApproved) {
  check(
    `exit format ${r.name}`,
    /^\d{1,3}[A-Z]?$/.test(r.exit_number ?? ''),
    r.exit_number ?? 'null',
  );
}

// ---- exit-approved ⊆ interstate-approved (never an exit without its interstate) ----
const iIds = new Set(iApproved.map((r) => r.id));
check(
  'every exit-approved row also has interstate approved',
  eApproved.every((r) => iIds.has(r.id)),
);

// ---- normalization: every approved value yields a valid route via the app's own fns ----
for (const r of iApproved) {
  const slug = interstateSlug(r.interstate ?? '');
  check(`interstate ${r.interstate} -> slug`, !!slug && /^i\d{1,3}$/.test(slug), String(slug));
  check(
    `interstate ${r.interstate} round-trips`,
    !!slug && interstateBySlug(slug)?.designation === r.interstate,
  );
}
for (const r of eApproved) {
  const es = exitSlug(r.exit_number ?? '');
  check(`exit ${r.exit_number} -> slug`, /^exit-[a-z0-9-]+$/.test(es));
}

// ---- evidence: the approved value must appear in the master Directions text ----
for (const r of iApproved) {
  const d = (r.evidence ?? '').replace(/\s/g, '');
  const num = (r.interstate ?? '').replace('I-', '');
  check(
    `interstate ${r.name} supported by evidence`,
    d.includes(`I-${num}`) || d.includes(`I${num}`),
    r.evidence ?? '',
  );
}
for (const r of eApproved) {
  const d = (r.evidence ?? '').toLowerCase();
  const n = (r.exit_number ?? '').replace(/[a-z]/i, '').toLowerCase();
  check(
    `exit ${r.name} supported by evidence`,
    d.includes('exit') && d.includes(n),
    r.evidence ?? '',
  );
}

// ---- decisions are from the allowed vocabulary; N/A + unresolved carry no written value ----
const VOCAB = new Set(['approved', 'not-applicable', 'unresolved', 'skip-existing']);
for (const r of rows) {
  check(
    `interstate decision vocab ${r.name}`,
    VOCAB.has(r.interstate_decision),
    r.interstate_decision,
  );
  check(`exit decision vocab ${r.name}`, VOCAB.has(r.exit_decision), r.exit_decision);
  if (r.interstate_decision !== 'approved')
    check(`no interstate value when not approved ${r.name}`, !r.interstate);
  if (r.exit_decision !== 'approved')
    check(`no exit value when not approved ${r.name}`, !r.exit_number);
}

console.log(`ta-petro-enrichment: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
