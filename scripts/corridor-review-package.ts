/**
 * Phase 1 · Step 4 — corridor interpolation EXPANSION review package.
 *
 * Combines the committed snapshot, the committed Census checkpoint, and the
 * committed geocoding batch CSVs into corridor calibrations, then interpolates
 * every row the Census could NOT match. Fully offline and deterministic — no
 * network, no database, no clock. Applying anything still requires a human in
 * the admin console at /admin/directory/geocoding.
 *
 * Run:
 *   npx esbuild scripts/corridor-review-package.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/corridor-review-package.cjs \
 *   && node /tmp/corridor-review-package.cjs \
 *        data/geocoding/dry-run/directory-snapshot.json \
 *        data/geocoding/census/census-results.json \
 *        data/geocoding \
 *        data/geocoding/corridor-package
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseGeocodingCsv } from '@/lib/directory/geocoding';
import type { AnchorSourceRow } from '@/lib/directory/calibration';
import {
  buildCorridorExpansion,
  CENSUS_ANCHOR_SOURCE,
} from '@/lib/directory/corridor-expansion';
import type { Checkpoint, RunnerSnapshotRow } from '@/lib/directory/census-runner';

const [snapshotPath, checkpointPath, batchDir, outDir] = process.argv.slice(2);
if (!snapshotPath || !checkpointPath || !batchDir || !outDir) {
  console.error(
    'Usage: corridor-review-package <snapshot.json> <census-results.json> <batch-csv-dir> <out-dir>',
  );
  process.exit(1);
}

const snapshot: RunnerSnapshotRow[] = JSON.parse(readFileSync(snapshotPath, 'utf8'));
const checkpoint: Checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf8'));

// Batch-CSV anchors: human-researched proposals, high/medium only, joined to
// the snapshot for corridor metadata (same sourcing rule as build-calibration).
// A listing appearing in several files with DIFFERENT coordinates is a
// conflict — dropped entirely and reported, never silently first-file-wins
// (the combined batch file and its part-files must agree to contribute).
const byId = new Map(snapshot.map((r) => [r.id, r]));
type BatchPoint = { lat: number; lng: number; file: string };
const batchPoints = new Map<string, BatchPoint[]>();
for (const file of readdirSync(batchDir).sort()) {
  if (!file.endsWith('.csv')) continue;
  const parsed = parseGeocodingCsv(readFileSync(join(batchDir, file), 'utf8'));
  for (const row of parsed.rows) {
    if (row.confidence !== 'high' && row.confidence !== 'medium') continue;
    if (row.proposed_latitude == null || row.proposed_longitude == null) continue;
    if (!byId.has(row.listing_id)) continue;
    const lat = Number(row.proposed_latitude);
    const lng = Number(row.proposed_longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    batchPoints.set(row.listing_id, [
      ...(batchPoints.get(row.listing_id) ?? []),
      { lat, lng, file },
    ]);
  }
}
const batchAnchors: AnchorSourceRow[] = [];
const batchConflicts: string[] = [];
for (const [listingId, points] of batchPoints) {
  const agree = points.every(
    (p) => p.lat.toFixed(6) === points[0].lat.toFixed(6) && p.lng.toFixed(6) === points[0].lng.toFixed(6),
  );
  if (!agree) {
    batchConflicts.push(
      `${listingId}: ${points.map((p) => `${p.file}=(${p.lat},${p.lng})`).join(' vs ')}`,
    );
    continue;
  }
  const ref = byId.get(listingId)!;
  batchAnchors.push({
    listingId,
    state: ref.state ?? '',
    interstate: ref.interstate ?? '',
    exitNumber: ref.exit_number ?? '',
    lat: points[0].lat,
    lng: points[0].lng,
    source: `geocoding-batch:${points.map((p) => p.file).sort().join('+')}`,
  });
}
if (batchConflicts.length) {
  console.log(`WARNING: ${batchConflicts.length} batch-CSV coordinate conflict(s) — anchors dropped:`);
  for (const c of batchConflicts) console.log(`  ${c}`);
}

const x = buildCorridorExpansion(snapshot, checkpoint, batchAnchors);
mkdirSync(outDir, { recursive: true });

writeFileSync(join(outDir, 'corridor-review-now.csv'), x.csv.reviewNowCsv);
writeFileSync(join(outDir, 'corridor-review-after-census.csv'), x.csv.afterCensusCsv);
writeFileSync(join(outDir, 'corridor-cross-validation.csv'), x.csv.crossValidationCsv);
writeFileSync(join(outDir, 'corridor-rejected.csv'), x.csv.rejectedCsv);
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(x.summary, null, 2) + '\n');

/* ------------------------------------------------------- anchor report */
const anchorLines: string[] = [
  '# Corridor anchor report — Phase 1 · Step 4',
  '',
  `Snapshot ${x.generatedAt}. Anchor precedence: applied directory coordinate`,
  '→ high/medium batch-CSV proposal → unapproved Census match (labeled',
  `\`${CENSUS_ANCHOR_SOURCE}\`). Corridors are concurrency-normalized; anchors`,
  'failing the neighbor-distance sanity check are rejected below.',
  '',
];
for (const c of x.calibration.calibrations) {
  const mp = c.anchors.map((a) => a.milepost);
  const bySource: Record<string, number> = {};
  for (const a of c.anchors) {
    const label = a.source.startsWith('geocoding-batch') ? 'geocoding-batch' : a.source;
    bySource[label] = (bySource[label] ?? 0) + 1;
  }
  anchorLines.push(
    `## ${c.interstate} ${c.state} — ${c.anchors.length} anchor(s), mileposts ${Math.min(...mp)}–${Math.max(...mp)}`,
    '',
    ...Object.entries(bySource)
      .sort((a, b) => b[1] - a[1])
      .map(([s, n]) => `- ${s}: ${n}`),
    '',
  );
}
anchorLines.push(
  '## Anchors rejected by the neighbor-distance sanity check',
  '',
  x.calibration.rejected.length
    ? x.calibration.rejected
        .map((r) => `- ${r.corridor} mp ${r.anchor.milepost} (${r.anchor.source}): ${r.reason}`)
        .join('\n')
    : 'None.',
  '',
);
writeFileSync(join(outDir, 'anchor-report.md'), anchorLines.join('\n'));

/* -------------------------------------------------------------- README */
const s = x.summary;
writeFileSync(
  join(outDir, 'README.md'),
  [
    '# Corridor interpolation expansion package (P1·S4)',
    '',
    `Generated offline from the committed snapshot (\`${x.generatedAt}\`), the`,
    'committed Census checkpoint, and the committed geocoding batch CSVs.',
    'Deterministic: same inputs, same bytes. **No database access occurs.**',
    '',
    '## Review order — this matters',
    '',
    '1. **Approve the Census package first** (`data/geocoding/census/census-review.csv`',
    '   in `/admin/directory/geocoding`). Most anchors below are unapproved Census',
    `   matches (\`${CENSUS_ANCHOR_SOURCE}\`).`,
    '2. `corridor-review-now.csv` uses **verified anchors only** (applied directory',
    '   coordinates / human-researched batch rows) — reviewable at any time.',
    '3. `corridor-review-after-census.csv` depends on Census anchors. **Do not',
    '   apply these rows until the Census approvals land** — after they do,',
    '   refresh the snapshot and REGENERATE this package so every anchor is a',
    '   verified coordinate:',
    '',
    '```bash',
    'npx esbuild scripts/corridor-review-package.ts --bundle --platform=node --format=cjs \\',
    '  --alias:@=./src --alias:server-only=./scripts/shims/server-only.ts \\',
    '  --outfile=/tmp/corridor-review-package.cjs && node /tmp/corridor-review-package.cjs \\',
    '  data/geocoding/dry-run/directory-snapshot.json \\',
    '  data/geocoding/census/census-results.json \\',
    '  data/geocoding data/geocoding/corridor-package',
    '```',
    '',
    '| file | contents |',
    '| --- | --- |',
    '| `corridor-review-now.csv` | candidates bracketed by verified anchors only (admin-console contract) |',
    '| `corridor-review-after-census.csv` | candidates that depend on unapproved Census anchors |',
    '| `corridor-cross-validation.csv` | Census match vs corridor math, miles apart; `comparison_basis` says whether the interpolation used verified anchors (independent) or other unapproved Census anchors (internal consistency only) |',
    '| `corridor-rejected.csv` | missing-coordinate non-Census rows with no candidate, with reasons |',
    '| `anchor-report.md` | every corridor, anchor counts and provenance, sanity rejections |',
    '| `summary.json` | machine-readable totals, reconciliation, coverage projections |',
    '',
    '## Headline',
    '',
    `- Coverage now: ${s.coverage.now}/${s.coverage.directoryTotal} (${s.coverage.pctNow}%)`,
    `- After Census approvals: ${s.coverage.afterCensusApprovals} (${s.coverage.pctAfterCensusApprovals}%)`,
    `- After Census + these interpolation candidates: **${s.coverage.afterCensusPlusInterpolation} (${s.coverage.pctAfterCensusPlusInterpolation}%)**`,
    `- Candidates: ${s.candidates.total} (verified-only ${s.candidates.verifiedOnly}, census-dependent ${s.candidates.censusDependent}; medium ${s.candidates.medium}, low ${s.candidates.low})`,
    `- Co-location flags: ${s.candidates.coLocatedOnAnotherListingsAnchor} candidates propose a point identical to ANOTHER listing's pending anchor, in ${s.candidates.sharedProposedPointGroups} shared-point group(s) — each is flagged in its reviewer_notes (same exit ≠ same driveway; confirm distinct businesses before applying)`,
    `- Cross-validation, independent (verified anchors): ${s.crossValidation.verifiedBasis.compared} compared, ${s.crossValidation.verifiedBasis.agree} agree within 2 mi`,
    `- Cross-validation, census-internal (checkpoint consistency ONLY — adjacent Census results vs each other, NOT independent proof): ${s.crossValidation.censusInternalBasis.compared} compared, ${s.crossValidation.censusInternalBasis.agree} agree within 2 mi, ${s.crossValidation.disagree} total disagreements flagged for review`,
    `- Reconciliation \`${s.reconciliation.formula}\` (recounted from the emitted CSV text): ${s.reconciliation.holds ? 'HOLDS' : 'FAILS'}`,
    '',
    'Every candidate ships `action=manual-review` with confidence capped at',
    '`medium`; the admin console (preview → select → confirm → apply, history-',
    'first, provenance-stamped) remains the only path to the database.',
    '',
  ].join('\n'),
);

console.log(
  `anchors: ${s.anchors.sourceRows} (directory ${s.anchors.directory}, batch ${s.anchors.batch}, census-pending ${s.anchors.censusPending}) → ${s.anchors.corridors} corridors (${s.anchors.rejectedBySanity} rejected by sanity)`,
);
console.log(
  `candidates: ${s.candidates.total} (verified-only ${s.candidates.verifiedOnly}, census-dependent ${s.candidates.censusDependent}; medium ${s.candidates.medium}, low ${s.candidates.low}; co-located-on-anchor ${s.candidates.coLocatedOnAnotherListingsAnchor} in ${s.candidates.sharedProposedPointGroups} shared-point groups)`,
);
for (const [k, n] of Object.entries(s.candidates.byCorridor)) console.log(`  ${k}: ${n}`);
console.log(
  `cross-validation: independent(verified anchors) ${s.crossValidation.verifiedBasis.agree}/${s.crossValidation.verifiedBasis.compared} agree ≤2mi; census-internal(consistency only) ${s.crossValidation.censusInternalBasis.agree}/${s.crossValidation.censusInternalBasis.compared}; disagreements ${s.crossValidation.disagree} (self-anchored ${s.crossValidation.selfAnchored}, no-interp ${s.crossValidation.noInterpolation})`,
);
console.log(`rejected: ${s.rejected.total}`);
for (const [k, n] of Object.entries(s.rejected.byReason)) console.log(`  ${k}: ${n}`);
console.log(`reconciliation holds: ${s.reconciliation.holds}`);
console.log(
  `coverage: ${s.coverage.pctNow}% now → ${s.coverage.pctAfterCensusApprovals}% after Census → ${s.coverage.pctAfterCensusPlusInterpolation}% after Census + interpolation`,
);
console.log(`wrote 6 files to ${outDir}`);
console.log('NO database access occurred (pipeline has no database client).');
