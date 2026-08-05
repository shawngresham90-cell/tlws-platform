/**
 * Phase 1 · Step 2 — I-75 GA/TN interpolation REVIEW PACKAGE.
 *
 * Re-runs the pure dry-run pipeline over the committed snapshot + calibration
 * and emits the complete human-review package for the admin geocoding console.
 * NEVER touches a database — inputs are two committed JSON files, outputs are
 * committed report files. Applying anything still requires a human in the
 * console at /admin/directory/geocoding.
 *
 * Run:
 *   npx esbuild scripts/i75-review-package.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/i75-review-package.cjs \
 *   && node /tmp/i75-review-package.cjs \
 *        data/geocoding/dry-run/directory-snapshot.json \
 *        data/geocoding/dry-run/calibration.json \
 *        data/geocoding/i75-package
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  runGeocodePipeline,
  dryRunCandidatesCsv,
  interpolationFailureLabel,
  type ClassifiedRow,
  type PipelineListing,
} from '@/lib/directory/geocode-pipeline';
import { resolveCorridor } from '@/lib/directory/concurrency';
import { parseCsv, toCsv, safeCsvCell } from '@/lib/directory/csv';
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

const SCOPE = new Set(['I-75|GA', 'I-75|TN']);
const inScope = (l: PipelineListing) => SCOPE.has(`${l.interstate}|${l.state}`);

const snapshotPath = process.argv[2];
const calibrationPath = process.argv[3];
const outDir = process.argv[4];
if (!snapshotPath || !calibrationPath || !outDir) {
  console.error('Usage: i75-review-package <snapshot.json> <calibration.json> <out-dir>');
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

/* ------------------------------------------------ 1. full dry-run CSV */
writeFileSync(join(outDir, 'i75-full-dry-run-candidates.csv'), dryRunCandidatesCsv(report));

/* ------------------------------------------------ 2. human-review CSV (scope) */
const scopeRows = report.rows.filter((r) => inScope(r.listing));
// A listing's TAGGED interstate can normalize to a different canonical corridor
// (Knoxville concurrency: I-75 exits 368–385 → I-40). This package's scope is
// the calibrated I-75 GA/TN corridors, so a candidate is included only when its
// RESOLVED corridor is I-75; concurrency-resolved rows (which the single I-40
// anchor serves via exact-exit match only) are excluded from the review CSV and
// listed in the rejected CSV with an explicit reason.
const interpolatedInScope = scopeRows.filter((r) => r.klass === 'interpolated' && r.proposed);
const resolvesToI75 = (r: ClassifiedRow): boolean =>
  resolveCorridor(r.listing.state, r.listing.interstate, r.listing.exitNumber).canonical === 'I-75';
const candidates = interpolatedInScope.filter(resolvesToI75);
const excluded = interpolatedInScope.filter((r) => !resolvesToI75(r));

const fullRows = parseCsv(dryRunCandidatesCsv(report));
const candidateIds = new Set(candidates.map((r) => r.listing.id));
const reviewRows = [
  fullRows[0],
  ...fullRows.slice(1).filter((cells) => candidateIds.has(cells[0])),
];
writeFileSync(join(outDir, 'i75-ga-tn-review.csv'), toCsv(reviewRows));

/* ------------------------------------------------ 3. rejected-candidates CSV */
// Only rows genuinely MISSING coordinates belong here: pipeline rows that could
// not produce a candidate, plus the concurrency-excluded candidates above.
// Coordinate-bearing outlier classes (suspect/invalid/conflict) are reported in
// outlier-report.md, never as "rejected candidates".
const rejected = scopeRows.filter(
  (r) =>
    (r.listing.lat == null || r.listing.lng == null) &&
    r.klass !== 'interpolated' &&
    r.klass !== 'already-geocoded',
);
const rejectedHeader = [
  'listing_id',
  'business_name',
  'category',
  'city',
  'state',
  'exit_number',
  'classification',
  'reason',
  'notes',
];
const reasonFor = (r: ClassifiedRow): string => {
  if (r.klass === 'unresolved') return 'no exit number and no street address';
  if (r.interpolation && !r.interpolation.ok) {
    const label = interpolationFailureLabel(r.interpolation.reason);
    return r.klass === 'needs-external-geocode'
      ? `${label}; has street address for future Census geocoding`
      : label;
  }
  return r.klass;
};
const EXCLUDED_REASON =
  'resolved corridor is I-40 (Knoxville concurrency) — out of this package scope; single-anchor exact-exit match only';
writeFileSync(
  join(outDir, 'i75-ga-tn-rejected.csv'),
  toCsv([
    rejectedHeader,
    ...excluded.map((r) => [
      r.listing.id,
      safeCsvCell(r.listing.name),
      r.listing.categorySlug,
      r.listing.city,
      r.listing.state,
      r.listing.exitNumber,
      'excluded-out-of-scope-corridor',
      EXCLUDED_REASON,
      r.notes.join('; '),
    ]),
    ...rejected.map((r) => [
      r.listing.id,
      safeCsvCell(r.listing.name),
      r.listing.categorySlug,
      r.listing.city,
      r.listing.state,
      r.listing.exitNumber,
      r.klass,
      reasonFor(r),
      r.notes.join('; '),
    ]),
  ]),
);

/* ------------------------------------------------ 4. anchor report */
const scopeCals = calibrations.filter((c) => SCOPE.has(`${c.interstate}|${c.state}`));
const otherCals = calibrations.filter((c) => !SCOPE.has(`${c.interstate}|${c.state}`));
const anchorLines: string[] = [
  '# I-75 GA/TN anchor report',
  '',
  `Snapshot date: ${generatedAt}. Anchors come ONLY from already-verified data:`,
  'applied directory coordinates (`directory-verified`) and high/medium rows in the',
  'committed geocoding batch CSVs. No coordinate here was invented.',
  '',
];
for (const c of scopeCals) {
  const mp = c.anchors.map((a) => a.milepost);
  const bySource: Record<string, number> = {};
  for (const a of c.anchors) bySource[a.source] = (bySource[a.source] ?? 0) + 1;
  anchorLines.push(
    `## ${c.interstate} ${c.state} — ${c.anchors.length} anchors, mileposts ${Math.min(...mp)}–${Math.max(...mp)}`,
    '',
    ...Object.entries(bySource).map(([s, n]) => `- ${s}: ${n}`),
    '',
    '| milepost | lat | lng | listing | source |',
    '| --- | --- | --- | --- | --- |',
    ...c.anchors.map(
      (a) => `| ${a.milepost} | ${a.lat} | ${a.lng} | \`${a.listingId}\` | ${a.source} |`,
    ),
    '',
  );
}
if (otherCals.length) {
  anchorLines.push(
    '## Out-of-scope corridors present in calibration.json',
    '',
    ...otherCals.map(
      (c) =>
        `- ${c.interstate} ${c.state}: ${c.anchors.length} anchor(s) — not in this package's scope.${
          c.anchors.length < 2
            ? ' A single anchor cannot interpolate BETWEEN exits, but it does serve exact-exit matches (including listings routed here by concurrency normalization); any such candidates are excluded from the review CSV and recorded in the rejected CSV.'
            : ' Candidates resolving to this corridor are excluded from the review CSV.'
        }`,
    ),
    '',
    `Concurrency-resolved candidates excluded from this package: ${excluded.length}`,
    '',
  );
}
writeFileSync(join(outDir, 'anchor-report.md'), anchorLines.join('\n'));

/* ------------------------------------------------ 5. outlier report */
const suspects = report.rows.filter(
  (r) => r.klass === 'existing-suspect' || r.klass === 'existing-invalid' || r.klass === 'conflict',
);
const nearDupes = candidates.filter((r) => r.nearListingId);
writeFileSync(
  join(outDir, 'outlier-report.md'),
  [
    '# Outlier report',
    '',
    `Existing-coordinate rows checked: ${report.summary.alreadyGeocoded + report.summary.existingSuspect + report.summary.existingInvalid}`,
    '',
    `- existing-suspect: **${report.summary.existingSuspect}**`,
    `- existing-invalid: **${report.summary.existingInvalid}**`,
    `- conflicts (existing coords vs interpolation): **${report.summary.conflicts}**`,
    '',
    suspects.length
      ? [
          '| listing | class | notes |',
          '| --- | --- | --- |',
          ...suspects.map(
            (r) =>
              `| ${r.listing.name} (\`${r.listing.id}\`) | ${r.klass} | ${r.notes.join('; ')} |`,
          ),
        ].join('\n')
      : 'No outliers: every existing coordinate passed the state/corridor plausibility gates.',
    '',
    '## Near-duplicate flags on proposed candidates',
    '',
    nearDupes.length
      ? nearDupes
          .map(
            (r) =>
              `- \`${r.listing.id}\` (${r.listing.name}) proposes a point near verified listing \`${r.nearListingId}\` — reviewer must confirm these are genuinely distinct businesses at the same exit.`,
          )
          .join('\n')
      : 'None.',
    '',
  ].join('\n'),
);

/* ------------------------------------------------ 6. plausibility report */
const plausLines = [
  '# Plausibility report — proposed I-75 GA/TN candidates',
  '',
  'Every candidate below RESOLVES to the I-75 corridor and was linearly',
  'interpolated between two verified anchors bracketing its exit (rows whose',
  'corridor normalizes elsewhere via concurrency are excluded and listed in the',
  'rejected CSV). Confidence is capped at `medium` by design (≤10 mi anchor gap',
  '→ medium; ≤30 mi → low); action is always `manual-review` — nothing can be',
  'auto-applied.',
  '',
  '| listing | exit | proposed | confidence | anchor gap (mi) | checks |',
  '| --- | --- | --- | --- | --- | --- |',
];
for (const r of candidates) {
  const i = r.interpolation;
  const gap = i && i.ok ? i.gapMiles : '';
  plausLines.push(
    `| ${r.listing.name} | ${r.listing.exitNumber} | ${r.proposed!.lat.toFixed(6)}, ${r.proposed!.lng.toFixed(6)} | ${r.proposed!.confidence} | ${gap} | in-state bounds ✓ · corridor bounds ✓${r.nearListingId ? ' · near-duplicate flag' : ''} |`,
  );
}
plausLines.push(
  '',
  `Interpolation refusals inside the calibrated corridors are listed in`,
  '`i75-ga-tn-rejected.csv` with per-row reasons (outside anchor range, anchor',
  'gap too large, no exit number, etc.). The pipeline never extrapolates beyond',
  'the anchored milepost range.',
  '',
);
writeFileSync(join(outDir, 'plausibility-report.md'), plausLines.join('\n'));

/* ------------------------------------------------ 7. summary JSON */
const scopeMissing = scopeRows.filter((r) => r.listing.lat == null || r.listing.lng == null);
const snapshotWithCoords = snapshot.filter((r) => r.lat != null && r.lng != null).length;
const rejReasons: Record<string, number> = {};
for (const r of rejected) rejReasons[reasonFor(r)] = (rejReasons[reasonFor(r)] ?? 0) + 1;
const summary = {
  generatedAt,
  scope: 'I-75 GA/TN (calibrated corridors only; candidates must RESOLVE to I-75)',
  snapshotRows: snapshot.length,
  snapshotWithCoords,
  scopeRows: scopeRows.length,
  scopeAlreadyGeocoded: scopeRows.filter((r) => r.klass === 'already-geocoded').length,
  scopeMissingCoords: scopeMissing.length,
  candidates: candidates.length,
  confidence: {
    medium: candidates.filter((r) => r.proposed!.confidence === 'medium').length,
    low: candidates.filter((r) => r.proposed!.confidence === 'low').length,
  },
  nearDuplicateFlags: nearDupes.length,
  excludedOutOfScopeCorridor: excluded.length,
  excludedReason: EXCLUDED_REASON,
  rejected: rejected.length,
  rejectedReasons: rejReasons,
  reconciliation: {
    holds: scopeMissing.length === candidates.length + excluded.length + rejected.length,
    formula: 'scopeMissingCoords = candidates + excludedOutOfScopeCorridor + rejected',
  },
  outliers: {
    existingSuspect: report.summary.existingSuspect,
    existingInvalid: report.summary.existingInvalid,
    conflicts: report.summary.conflicts,
  },
  anchors: scopeCals.map((c) => ({
    corridor: `${c.interstate} ${c.state}`,
    count: c.anchors.length,
    milepostMin: Math.min(...c.anchors.map((a) => a.milepost)),
    milepostMax: Math.max(...c.anchors.map((a) => a.milepost)),
  })),
  projectedCoverage: {
    directoryWithCoordsNow: snapshotWithCoords,
    afterApplyingAllCandidates: snapshotWithCoords + candidates.length,
    directoryTotal: snapshot.length,
    pctNow: Number(((100 * snapshotWithCoords) / snapshot.length).toFixed(1)),
    pctAfter: Number(
      ((100 * (snapshotWithCoords + candidates.length)) / snapshot.length).toFixed(1),
    ),
  },
  guarantees: [
    'no database client exists in this pipeline — zero production reads or writes at runtime',
    'inputs are two committed JSON files; outputs are committed report files',
    'every candidate action is manual-review; apply requires the admin console',
  ],
};
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');

/* ------------------------------------------------ 8. reproducibility doc */
writeFileSync(
  join(outDir, 'README.md'),
  [
    '# I-75 GA/TN interpolation review package',
    '',
    `Generated from the committed snapshot (\`snapshot_taken_at: ${generatedAt}\`,`,
    'SELECT-only export of `public.locations`) and the committed calibration set.',
    'Fully reproducible offline — no network, no database, no clock:',
    '',
    '```bash',
    '# 1. rebuild anchors from verified data',
    'npx esbuild scripts/build-calibration.ts --bundle --platform=node --format=cjs \\',
    '  --alias:@=./src --alias:server-only=./scripts/shims/server-only.ts \\',
    '  --outfile=/tmp/build-calibration.cjs && node /tmp/build-calibration.cjs \\',
    '  data/geocoding/dry-run/directory-snapshot.json data/geocoding/dry-run/calibration.json',
    '',
    '# 2. regenerate this package',
    'npx esbuild scripts/i75-review-package.ts --bundle --platform=node --format=cjs \\',
    '  --alias:@=./src --alias:server-only=./scripts/shims/server-only.ts \\',
    '  --outfile=/tmp/i75-review-package.cjs && node /tmp/i75-review-package.cjs \\',
    '  data/geocoding/dry-run/directory-snapshot.json \\',
    '  data/geocoding/dry-run/calibration.json data/geocoding/i75-package',
    '```',
    '',
    '| file | contents |',
    '| --- | --- |',
    '| `i75-full-dry-run-candidates.csv` | every interpolation candidate from the full snapshot (admin-console contract) |',
    '| `i75-ga-tn-review.csv` | the I-75 GA/TN candidates for upload to `/admin/directory/geocoding` |',
    '| `i75-ga-tn-rejected.csv` | in-scope missing-coordinate rows with no included candidate (incl. concurrency-excluded rows), with per-row reasons |',
    '| `anchor-report.md` | every anchor used, by corridor, with source provenance |',
    '| `outlier-report.md` | existing-coordinate outliers + near-duplicate flags |',
    '| `plausibility-report.md` | per-candidate checks and the no-extrapolation guarantee |',
    '| `summary.json` | machine-readable totals, confidence distribution, projected coverage |',
    '',
    'Applying any row remains a human decision in the admin console (preview →',
    'select → confirm → apply), which writes `location_history` first and stamps',
    'provenance. This package cannot and does not modify the database.',
    '',
  ].join('\n'),
);

console.log(
  `scope rows: ${scopeRows.length} (already geocoded ${summary.scopeAlreadyGeocoded}, missing ${summary.scopeMissingCoords})`,
);
console.log(
  `candidates: ${candidates.length} (medium ${summary.confidence.medium}, low ${summary.confidence.low}; near-dupe flags ${nearDupes.length})`,
);
console.log(`excluded (corridor resolves to I-40 via concurrency): ${excluded.length}`);
console.log(`rejected in scope: ${rejected.length}`);
console.log(`reconciliation holds: ${summary.reconciliation.holds}`);
for (const [reason, n] of Object.entries(rejReasons).sort((a, b) => b[1] - a[1]))
  console.log(`  ${reason}: ${n}`);
console.log(
  `coverage: ${summary.projectedCoverage.pctNow}% -> ${summary.projectedCoverage.pctAfter}% after review/apply`,
);
console.log(`wrote 8 files to ${outDir}`);
console.log('NO database access occurred (pipeline has no database client).');
