/**
 * Phase 2A: dry-run geocoding pipeline over a directory snapshot. NEVER
 * writes to any database — output is three local report files. The
 * candidates CSV uses the admin geocoding console's contract, so applying
 * anything still requires a human in that console.
 *
 * Run:
 *   npx esbuild scripts/geocode-dry-run.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/geocode-dry-run.cjs \
 *   && node /tmp/geocode-dry-run.cjs \
 *        data/geocoding/dry-run/directory-snapshot.json \
 *        data/geocoding/dry-run/calibration.json \
 *        data/geocoding/dry-run
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  runGeocodePipeline,
  dryRunCandidatesCsv,
  dryRunReportJson,
  type PipelineListing,
} from '@/lib/directory/geocode-pipeline';
import { verificationReportCsv } from '@/lib/directory/coordinate-verification';
import type { CalibrationSet } from '@/lib/directory/interpolation';

type SnapshotRow = {
  id: string;
  name: string;
  category_slug: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  interstate: string | null;
  exit_number: string | null;
  snapshot_taken_at?: string;
};

const snapshotPath = process.argv[2];
const calibrationPath = process.argv[3];
const outDir = process.argv[4];
if (!snapshotPath || !calibrationPath || !outDir) {
  console.error('Usage: geocode-dry-run <snapshot.json> <calibration.json> <out-dir>');
  process.exit(1);
}

const snapshot: SnapshotRow[] = JSON.parse(readFileSync(snapshotPath, 'utf8'));
const calibrations: CalibrationSet = JSON.parse(readFileSync(calibrationPath, 'utf8'));

const listings: PipelineListing[] = snapshot.map((r) => ({
  id: r.id,
  name: r.name,
  categorySlug: r.category_slug ?? '',
  address: r.address ?? '',
  city: r.city ?? '',
  state: r.state ?? '',
  zip: r.zip ?? '',
  lat: r.lat,
  lng: r.lng,
  interstate: r.interstate ?? '',
  exitNumber: r.exit_number ?? '',
}));

const generatedAt = snapshot[0]?.snapshot_taken_at ?? 'unknown';
const report = runGeocodePipeline(listings, calibrations, { generatedAt });

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'dry-run-report.json'), dryRunReportJson(report));
writeFileSync(join(outDir, 'dry-run-candidates.csv'), dryRunCandidatesCsv(report));
writeFileSync(
  join(outDir, 'dry-run-coordinate-review.csv'),
  verificationReportCsv(report.rows.map((r) => r.verification)),
);

const s = report.summary;
console.log(`total listings:            ${s.total}`);
console.log(`already geocoded (ok):     ${s.alreadyGeocoded}`);
console.log(`existing suspect:          ${s.existingSuspect}`);
console.log(`existing invalid:          ${s.existingInvalid}`);
console.log(`conflicts (coords vs mm):  ${s.conflicts}`);
console.log(
  `interpolated candidates:   ${s.interpolated} (medium ${s.interpolatedMedium}, low ${s.interpolatedLow})`,
);
console.log(`needs external geocode:    ${s.needsExternalGeocode}`);
console.log(`unresolved:                ${s.unresolved}`);
console.log(`unresolved/external reasons:`);
for (const [reason, n] of Object.entries(s.unresolvedReasons).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${reason}: ${n}`);
}
if (s.statesWithoutBounds.length) {
  console.log(`states without bounds: ${s.statesWithoutBounds.join(', ')}`);
}
console.log(
  `\nwrote ${outDir}/dry-run-report.json, dry-run-candidates.csv, dry-run-coordinate-review.csv`,
);
console.log('NO database writes were performed (this pipeline has no database client).');
