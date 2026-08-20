/**
 * Build the PARKING-QUALITY-1 audit package from a read-only snapshot.
 *
 * Read-only by construction: it takes two JSON snapshots exported from the
 * database with SELECTs, runs the real `classifyParkingRow` over them, and
 * writes AUDIT.csv + manifest.json. It has no Supabase client, no write path
 * and no network access — the only way this script can touch production is
 * if someone adds one, which `scripts/test-parking-quality.ts` asserts
 * against.
 *
 * Snapshots (produced by FINGERPRINT.sql, saved as JSON):
 *   --unpublished  the unpublished, non-deleted category_slug='parking' rows
 *   --published    published rows used for duplicate/proximity context
 *
 * Usage:
 *   npx esbuild scripts/build-parking-quality-audit.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/pq.cjs && \
 *   node /tmp/pq.cjs --unpublished unpublished.json --published published.json \
 *     --out data/imports/parking-quality-2026-08
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import {
  classifyParkingRow,
  summarize,
  auditCsv,
  ownerActionFor,
  type ParkingRow,
  type ParkingContext,
  type ParkingQualityResult,
} from '@/lib/directory/parking-quality';

function arg(name: string, fallback: string | null = null): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
}

const UNPUBLISHED = arg('unpublished');
const PUBLISHED = arg('published');
const OUT = arg('out', 'data/imports/parking-quality-2026-08')!;
const MAIN_SHA = arg('sha', '');
const NOW = arg('now', '');

if (!UNPUBLISHED || !PUBLISHED) {
  console.error('--unpublished and --published snapshot paths are required');
  process.exit(2);
}

const unpublished = JSON.parse(fs.readFileSync(UNPUBLISHED, 'utf8')) as ParkingRow[];
const published = JSON.parse(fs.readFileSync(PUBLISHED, 'utf8')) as ParkingContext['published'];

/**
 * Evidence is EMPTY by design. Every agency host this package needs is
 * blocked at the environment's egress proxy (verified again for this
 * milestone: fdot.gov, caltrans-gis.dot.ca.gov and data.transportation.gov
 * all answer `000`). No source was retrieved, so no source is recorded, and
 * a row with no evidence record is blocked rather than assumed. Filling this
 * map is the owner-side task the audit produces.
 */
const evidenceByLocation: NonNullable<ParkingContext['evidenceByLocation']> = {};

const context: ParkingContext = {
  published,
  batch: unpublished,
  evidenceByLocation,
  // Report counts are attention-only and never reach a verdict; the audit
  // records them so triage can be ordered, nothing more.
  reportCountsByLocation: {},
};

const results: ParkingQualityResult[] = unpublished.map((row) => classifyParkingRow(row, context));
const summary = summarize(results);

const ids = unpublished.map((r) => r.id).sort();
const fingerprint = crypto.createHash('sha256').update(ids.join('\n')).digest('hex');

const reasonCounts: Record<string, number> = {};
for (const r of results)
  for (const code of r.reasons) reasonCounts[code] = (reasonCounts[code] ?? 0) + 1;

const manifest = {
  milestone: 'PARKING-QUALITY-1',
  ruleVersion: 1,
  createdAt: NOW || null,
  sourceMainSha: MAIN_SHA || null,
  query: {
    table: 'public.locations',
    filter: "category_slug = 'parking' AND deleted_at IS NULL AND is_published = false",
    contextFilter:
      "is_published = true AND deleted_at IS NULL AND (category_slug = 'parking' OR coordinates present)",
  },
  rowCount: unpublished.length,
  contextRowCount: published?.length ?? 0,
  idFingerprintSha256: fingerprint,
  classification: {
    publication: summary.publication,
    overnight: summary.overnight,
    coordinate: summary.coordinate,
    facility: summary.facility,
    provenance: summary.provenance,
  },
  reasonCounts,
  byState: summary.byState,
  readyForOwnerReview: summary.readyForOwnerReview,
  proposedForPublication: 0,
  blocked: unpublished.length - summary.readyForOwnerReview,
  evidenceRecordsSupplied: Object.keys(evidenceByLocation).length,
  productionWrites: 0,
  sqlExecuted: false,
  migrationsAdded: 0,
} as const;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'AUDIT.csv'), auditCsv(results));
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

/* ------------------------------------------------------------- reporting */

const pad = (s: string, n: number) => s.padEnd(n);
console.log(`PARKING-QUALITY-1 — ${unpublished.length} unpublished parking rows\n`);
console.log('PUBLICATION VERDICT');
for (const [k, v] of Object.entries(summary.publication)) {
  if (v > 0) console.log(`  ${pad(k, 34)} ${String(v).padStart(4)}`);
}
console.log('\nOVERNIGHT VERDICT (evidence-backed)');
for (const [k, v] of Object.entries(summary.overnight)) {
  console.log(`  ${pad(k, 34)} ${String(v).padStart(4)}`);
}
console.log('\nCOORDINATE VERDICT');
for (const [k, v] of Object.entries(summary.coordinate)) {
  if (v > 0) console.log(`  ${pad(k, 34)} ${String(v).padStart(4)}`);
}
console.log('\nFACILITY VERDICT');
for (const [k, v] of Object.entries(summary.facility)) {
  if (v > 0) console.log(`  ${pad(k, 34)} ${String(v).padStart(4)}`);
}
console.log('\nPROVENANCE');
for (const [k, v] of Object.entries(summary.provenance)) {
  if (v > 0) console.log(`  ${pad(k, 34)} ${String(v).padStart(4)}`);
}
console.log('\nREASON CODES');
for (const [k, v] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${pad(k, 34)} ${String(v).padStart(4)}`);
}
console.log('\nOWNER ACTIONS');
const actions: Record<string, number> = {};
for (const r of results) {
  const a = ownerActionFor(r).replace(/: https?:\/\/\S+/, ': <source url>');
  actions[a] = (actions[a] ?? 0) + 1;
}
for (const [k, v] of Object.entries(actions).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${pad(k, 46)} ${String(v).padStart(4)}`);
}
console.log(`\nready for owner review: ${summary.readyForOwnerReview}`);
console.log(`fingerprint: ${fingerprint}`);
console.log(`wrote ${path.join(OUT, 'AUDIT.csv')} and manifest.json`);
