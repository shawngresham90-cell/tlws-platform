/**
 * Phase 2A: build milepost calibration anchors from ALREADY-VERIFIED data —
 * (a) directory rows that have applied coordinates and (b) high/medium-
 * confidence rows in the committed geocoding batch CSVs. No network, no
 * database, no invented coordinates. Writes ONLY the calibration JSON file.
 *
 * Run:
 *   npx esbuild scripts/build-calibration.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/build-calibration.cjs \
 *   && node /tmp/build-calibration.cjs \
 *        data/geocoding/dry-run/directory-snapshot.json \
 *        data/geocoding/dry-run/calibration.json
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseGeocodingCsv } from '@/lib/directory/geocoding';
import { buildCalibrations, type AnchorSourceRow } from '@/lib/directory/calibration';

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
};

const snapshotPath = process.argv[2];
const outPath = process.argv[3];
if (!snapshotPath || !outPath) {
  console.error('Usage: build-calibration <directory-snapshot.json> <calibration-out.json>');
  process.exit(1);
}

const snapshot: SnapshotRow[] = JSON.parse(readFileSync(snapshotPath, 'utf8'));
const rows: AnchorSourceRow[] = [];

// (a) Directory rows with applied coordinates — the strongest anchors.
for (const r of snapshot) {
  if (r.lat == null || r.lng == null) continue;
  rows.push({
    listingId: r.id,
    state: r.state ?? '',
    interstate: r.interstate ?? '',
    exitNumber: r.exit_number ?? '',
    lat: r.lat,
    lng: r.lng,
    source: 'directory-verified',
  });
}
const anchoredIds = new Set(rows.map((r) => r.listingId));

// (b) Geocoding batch CSVs: human-researched proposals, high/medium only,
// joined to the snapshot for corridor metadata. Rows already anchored from
// the directory are skipped (the applied coordinate wins).
const byId = new Map(snapshot.map((r) => [r.id, r]));
const geocodingDir = 'data/geocoding';
let batchRowsUsed = 0;
for (const file of readdirSync(geocodingDir)) {
  if (!file.endsWith('.csv')) continue;
  const parsed = parseGeocodingCsv(readFileSync(join(geocodingDir, file), 'utf8'));
  for (const row of parsed.rows) {
    if (row.confidence !== 'high' && row.confidence !== 'medium') continue;
    if (row.proposed_latitude == null || row.proposed_longitude == null) continue;
    if (anchoredIds.has(row.listing_id)) continue;
    const ref = byId.get(row.listing_id);
    if (!ref) continue;
    const lat = Number(row.proposed_latitude);
    const lng = Number(row.proposed_longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    rows.push({
      listingId: row.listing_id,
      state: ref.state ?? '',
      interstate: ref.interstate ?? '',
      exitNumber: ref.exit_number ?? '',
      lat,
      lng,
      source: `geocoding-batch:${file}`,
    });
    anchoredIds.add(row.listing_id);
    batchRowsUsed++;
  }
}

const result = buildCalibrations(rows);
writeFileSync(outPath, JSON.stringify(result.calibrations, null, 2));

console.log(`anchor source rows: ${rows.length} (batch csv contributed ${batchRowsUsed})`);
console.log(`corridors calibrated: ${result.calibrations.length}`);
for (const c of result.calibrations) {
  const mp = c.anchors.map((a) => a.milepost);
  console.log(
    `  ${c.interstate} ${c.state}: ${c.anchors.length} anchors, mileposts ${Math.min(...mp)}–${Math.max(...mp)}`,
  );
}
console.log(`anchors rejected (sanity): ${result.rejected.length}`);
for (const r of result.rejected)
  console.log(`  ${r.corridor} mp ${r.anchor.milepost}: ${r.reason}`);
console.log(`rows skipped: ${result.skipped.length}`);
const reasons: Record<string, number> = {};
for (const s of result.skipped) reasons[s.reason] = (reasons[s.reason] ?? 0) + 1;
for (const [reason, n] of Object.entries(reasons)) console.log(`  ${reason}: ${n}`);
console.log(`wrote ${outPath}`);
