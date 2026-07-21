/**
 * Approval-readiness verification for the Census review package (P1·S3/S4).
 *
 * Proves OFFLINE — before the owner spends review time — that the committed
 * `census-review.csv` round-trips the admin console's real import/validate
 * code path end to end:
 *
 *   1. it parses with zero errors through parseGeocodingCsv,
 *   2. every row validates against the (snapshot-derived) live listings with
 *      ONLY the two expected gates (not-ready, not-high-confidence) — i.e. no
 *      identity mismatches, no bad coordinates, no duplicates, and
 *   3. simulating the human upgrade (action→ready, confidence→high) makes
 *      every row applicable with zero overwrites.
 *
 * Pure file-in/report-out: no network, no database, no clock.
 *
 * Run:
 *   npx esbuild scripts/verify-census-approval-readiness.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/verify-census.cjs \
 *   && node /tmp/verify-census.cjs \
 *        data/geocoding/census/census-review.csv \
 *        data/geocoding/dry-run/directory-snapshot.json
 */
import { readFileSync } from 'node:fs';
import {
  parseGeocodingCsv,
  validateBatch,
  type LiveListingRef,
} from '@/lib/directory/geocoding';
import type { RunnerSnapshotRow } from '@/lib/directory/census-runner';

const [csvPath, snapshotPath] = process.argv.slice(2);
if (!csvPath || !snapshotPath) {
  console.error('Usage: verify-census-approval-readiness <census-review.csv> <snapshot.json>');
  process.exit(1);
}

const parsed = parseGeocodingCsv(readFileSync(csvPath, 'utf8'));
const snapshot: RunnerSnapshotRow[] = JSON.parse(readFileSync(snapshotPath, 'utf8'));
const live = new Map<string, LiveListingRef>(
  snapshot.map((r) => [
    r.id,
    {
      id: r.id,
      name: r.name,
      address: r.address,
      city: r.city ?? '',
      state: r.state ?? '',
      lat: r.lat,
      lng: r.lng,
      interstate: r.interstate,
    },
  ]),
);

let exit = 0;
const fail = (msg: string) => {
  console.log(`FAIL: ${msg}`);
  exit = 1;
};

if (parsed.errors.length) fail(`${parsed.errors.length} parse error(s): ${parsed.errors.slice(0, 3).join('; ')}`);
console.log(`parsed rows: ${parsed.rows.length} (parse errors: ${parsed.errors.length})`);

/* As shipped: every row must be gated by EXACTLY the two human gates. */
const asShipped = validateBatch(parsed.rows, live);
const expectedGates = new Set(['not-ready', 'not-high-confidence']);
const unexpected = asShipped.filter(
  (r) => r.applicable || r.problems.some((p) => !expectedGates.has(p)),
);
if (unexpected.length) {
  fail(`${unexpected.length} row(s) with unexpected problems or premature applicability`);
  for (const r of unexpected.slice(0, 5)) {
    console.log(`  ${r.listing_id}: applicable=${r.applicable} problems=${r.problems.join(',')} (${r.problemDetails.join('; ')})`);
  }
} else {
  console.log(
    `as shipped: 0/${asShipped.length} applicable — every row held back ONLY by the human gates (not-ready + not-high-confidence); no identity mismatches, no invalid coordinates, no duplicates`,
  );
}

/* Simulated approval: the exact edit the owner performs on accepted rows. */
const upgraded = validateBatch(
  parsed.rows.map((r) => ({ ...r, action: 'ready' as const, confidence: 'high' as const })),
  live,
);
const notApplicable = upgraded.filter((r) => !r.applicable);
const overwrites = upgraded.filter((r) => r.wouldOverwrite);
if (notApplicable.length) {
  fail(`${notApplicable.length} row(s) would STILL not apply after the ready/high upgrade`);
  for (const r of notApplicable.slice(0, 5)) {
    console.log(`  ${r.listing_id}: ${r.problems.join(',')} (${r.problemDetails.join('; ')})`);
  }
} else {
  console.log(
    `after simulated approval (action=ready, confidence=high): ${upgraded.length}/${upgraded.length} applicable, ${overwrites.length} would overwrite existing coordinates`,
  );
}
if (overwrites.length) fail(`${overwrites.length} unexpected overwrite(s) — all Census rows target listings with NO coordinates`);

console.log(exit === 0 ? 'READY: the approval workflow is verified end to end.' : 'NOT READY — fix the failures above before owner review.');
console.log('NO database access occurred (validation ran against the committed snapshot).');
process.exit(exit);
