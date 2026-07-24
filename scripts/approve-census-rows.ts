/**
 * Owner-directed bulk approval (2026-07-21): produce the ready-to-upload
 * Census approval CSV from the review package.
 *
 * The owner approved 713 of the 745 Census matches; the 32 rows flagged by
 * cross-validation ("NO — investigate" in corridor-cross-validation.csv,
 * where the Census point and corridor math disagree by 2+ miles) stay
 * action=manual-review for individual review later. This script upgrades the
 * approved rows to action=ready + confidence=high and verifies the result
 * against the committed snapshot with the console's OWN validation code:
 * exactly 713 applicable, 32 held, 0 overwrites.
 *
 * Offline and deterministic — writes ONE repo file. Applying still happens
 * only in /admin/directory/geocoding, by the owner.
 *
 * Run:
 *   npx esbuild scripts/approve-census-rows.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/approve-census.cjs \
 *   && node /tmp/approve-census.cjs \
 *        data/geocoding/census/census-review.csv \
 *        /tmp/corridor-cross-validation.csv \
 *        data/geocoding/dry-run/directory-snapshot.json \
 *        data/geocoding/census/census-review-approved.csv
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseCsv, toCsv } from '@/lib/directory/csv';
import {
  parseGeocodingCsv,
  validateBatch,
  type LiveListingRef,
} from '@/lib/directory/geocoding';
import type { RunnerSnapshotRow } from '@/lib/directory/census-runner';

const [reviewPath, crossPath, snapshotPath, outPath] = process.argv.slice(2);
if (!reviewPath || !crossPath || !snapshotPath || !outPath) {
  console.error('Usage: approve-census-rows <review.csv> <cross-validation.csv> <snapshot.json> <out.csv>');
  process.exit(1);
}

// The 32 held rows: cross-validation rows whose agreement column says NO.
const cross = parseCsv(readFileSync(crossPath, 'utf8'));
const crossHeader = cross[0];
const idCol = crossHeader.indexOf('listing_id');
const agreeCol = crossHeader.indexOf('agrees_within_2mi');
const held = new Set(
  cross.slice(1).filter((r) => (r[agreeCol] ?? '').startsWith('NO')).map((r) => r[idCol]),
);

const rows = parseCsv(readFileSync(reviewPath, 'utf8'));
const header = rows[0];
const cId = header.indexOf('listing_id');
const cConfidence = header.indexOf('confidence');
const cAction = header.indexOf('action');
let approved = 0;
let heldSeen = 0;
const out = [
  header,
  ...rows.slice(1).map((cells) => {
    if (held.has(cells[cId])) {
      heldSeen++;
      return cells; // untouched → stays manual-review, cannot apply
    }
    approved++;
    const next = [...cells];
    next[cAction] = 'ready';
    next[cConfidence] = 'high';
    return next;
  }),
];
writeFileSync(outPath, toCsv(out));

// Verify with the console's real import/validate path against the snapshot.
const parsed = parseGeocodingCsv(readFileSync(outPath, 'utf8'));
const snapshot: RunnerSnapshotRow[] = JSON.parse(readFileSync(snapshotPath, 'utf8'));
const live = new Map<string, LiveListingRef>(
  snapshot.map((r) => [
    r.id,
    { id: r.id, name: r.name, address: r.address, city: r.city ?? '', state: r.state ?? '', lat: r.lat, lng: r.lng },
  ]),
);
const validated = validateBatch(parsed.rows, live);
const applicable = validated.filter((r) => r.applicable);
const overwrites = validated.filter((r) => r.wouldOverwrite);
const heldValidated = validated.filter((r) => !r.applicable);

let exit = 0;
const expect = (name: string, cond: boolean, detail: unknown) => {
  if (!cond) { exit = 1; console.log(`FAIL: ${name}`, detail); }
};
expect('parse errors = 0', parsed.errors.length === 0, parsed.errors.slice(0, 3));
expect('approved = 713', approved === 713, approved);
expect('held = 32', heldSeen === 32 && held.size === 32, { heldSeen, heldSize: held.size });
expect('applicable = 713', applicable.length === 713, applicable.length);
expect('held back = 32', heldValidated.length === 32, heldValidated.length);
expect('overwrites = 0', overwrites.length === 0, overwrites.length);
expect(
  'every held row is a flagged disagreement',
  heldValidated.every((r) => held.has(r.listing_id)),
  heldValidated.filter((r) => !held.has(r.listing_id)).map((r) => r.listing_id).slice(0, 5),
);

console.log(
  `wrote ${outPath}: ${approved} rows action=ready/confidence=high, ${heldSeen} flagged rows held as manual-review`,
);
console.log(
  `console-validation: ${applicable.length} applicable, ${heldValidated.length} held, ${overwrites.length} overwrites`,
);
console.log(exit === 0 ? 'READY for owner upload + Apply.' : 'NOT READY — failures above.');
process.exit(exit);
