/**
 * Phase 2B: staged-backfill dry-run report. Reads the committed directory
 * snapshot + geocoding batch CSVs, rebuilds corridor calibrations (with
 * anomaly detail), runs the dry-run pipeline, folds in Census results from a
 * JSON file when one exists (this script performs NO network I/O itself),
 * assigns Stages A–D, and writes the full Phase 2B report set. NEVER writes
 * to any database.
 *
 * Run:
 *   npx esbuild scripts/geocode-stage-report.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/geocode-stage-report.cjs \
 *   && node /tmp/geocode-stage-report.cjs \
 *        data/geocoding/dry-run/directory-snapshot.json \
 *        data/geocoding/dry-run/phase2b \
 *        [census-results.json]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseGeocodingCsv } from '@/lib/directory/geocoding';
import { buildCalibrations, type AnchorSourceRow } from '@/lib/directory/calibration';
import {
  runGeocodePipeline,
  dryRunCandidatesCsv,
  type PipelineListing,
} from '@/lib/directory/geocode-pipeline';
import {
  assignStages,
  summarizeStages,
  projectedCoverage,
  neverAutoGeocode,
} from '@/lib/directory/backfill-stages';
import { concurrencyReport, resolveCorridor, CONCURRENCY_RULES } from '@/lib/directory/concurrency';
import { parseExitNumber } from '@/lib/directory/interpolation';
import { findDuplicatePairs, type DupCandidate } from '@/lib/directory/duplicates';
import type { CensusResult } from '@/lib/directory/census-geocoder';

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
const outDir = process.argv[3];
const censusPath = process.argv[4];
if (!snapshotPath || !outDir) {
  console.error('Usage: geocode-stage-report <snapshot.json> <out-dir> [census-results.json]');
  process.exit(1);
}

const snapshot: SnapshotRow[] = JSON.parse(readFileSync(snapshotPath, 'utf8'));
const generatedAt = snapshot[0]?.snapshot_taken_at ?? 'unknown';

/* ------------------------------------------------ calibration (with detail) */
const anchorRows: AnchorSourceRow[] = [];
for (const r of snapshot) {
  if (r.lat == null || r.lng == null) continue;
  anchorRows.push({
    listingId: r.id,
    state: r.state ?? '',
    interstate: r.interstate ?? '',
    exitNumber: r.exit_number ?? '',
    lat: r.lat,
    lng: r.lng,
    source: 'directory-verified',
  });
}
const anchored = new Set(anchorRows.map((r) => r.listingId));
const byId = new Map(snapshot.map((r) => [r.id, r]));
for (const file of readdirSync('data/geocoding')) {
  if (!file.endsWith('.csv')) continue;
  const parsed = parseGeocodingCsv(readFileSync(join('data/geocoding', file), 'utf8'));
  for (const row of parsed.rows) {
    if (row.confidence !== 'high' && row.confidence !== 'medium') continue;
    if (row.proposed_latitude == null || row.proposed_longitude == null) continue;
    if (anchored.has(row.listing_id)) continue;
    const ref = byId.get(row.listing_id);
    if (!ref) continue;
    anchorRows.push({
      listingId: row.listing_id,
      state: ref.state ?? '',
      interstate: ref.interstate ?? '',
      exitNumber: ref.exit_number ?? '',
      lat: row.proposed_latitude,
      lng: row.proposed_longitude,
      source: `geocoding-batch:${file} (${row.confidence})`,
    });
    anchored.add(row.listing_id);
  }
}
const calibration = buildCalibrations(anchorRows);

/* --------------------------------------------------------------- pipeline */
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
const report = runGeocodePipeline(listings, calibration.calibrations, { generatedAt });

/* ----------------------------------------------------------------- census */
const censusResults: CensusResult[] =
  censusPath && existsSync(censusPath) ? JSON.parse(readFileSync(censusPath, 'utf8')) : [];
const censusCounts = {
  attempted: censusResults.length,
  exact: censusResults.filter((r) => r.status === 'exact').length,
  approximate: censusResults.filter((r) => r.status === 'approximate').length,
  rejected: censusResults.filter((r) => r.status === 'rejected').length,
  wrongState: censusResults.filter((r) => r.rejection === 'wrong-state').length,
  ties: censusResults.filter((r) => r.rejection === 'tie').length,
  noMatch: censusResults.filter((r) => r.rejection === 'no-match').length,
};

/* ----------------------------------------------------------------- stages */
const staged = assignStages(report, censusResults);
const stageSummaries = summarizeStages(staged);
// "Current coverage" = rows that HAVE coordinates (including suspect/invalid
// ones queued for adjudication) so identities hold when those counts are >0.
const rowsWithCoords = listings.filter((l) => l.lat != null && l.lng != null).length;
const coverage = projectedCoverage(report.summary.total, rowsWithCoords, stageSummaries);
const neverAuto = neverAutoGeocode(report);

/* -------------------------------------------------- duplicate-risk check */
const dupInput: DupCandidate[] = [];
for (const row of report.rows) {
  const l = row.listing;
  if (l.lat != null && l.lng != null) {
    dupInput.push({
      id: l.id,
      name: l.name,
      address: l.address,
      city: l.city,
      state: l.state,
      lat: l.lat,
      lng: l.lng,
    });
  } else if (row.klass === 'interpolated' && row.proposed) {
    dupInput.push({
      id: l.id,
      name: l.name,
      address: l.address,
      city: l.city,
      state: l.state,
      lat: row.proposed.lat,
      lng: row.proposed.lng,
    });
  }
}
const proposedIds = new Set(
  report.rows.filter((r) => r.klass === 'interpolated').map((r) => r.listing.id),
);
const dupPairs = findDuplicatePairs(dupInput, new Set(), 100000).filter(
  (p) => (proposedIds.has(p.aId) || proposedIds.has(p.bId)) && p.reasons.includes('coords'),
);

/* --------------------------------------------------------- concurrency */
const concurrencyRows = concurrencyReport(
  snapshot.map((r) => ({
    id: r.id,
    name: r.name,
    state: r.state ?? '',
    interstate: r.interstate ?? '',
    exitNumber: r.exit_number ?? '',
  })),
);

/* ----------------------------------------- calibration worklist (Step 2) */
// For every corridor with missing-coordinate rows but no usable calibration:
// how many rows are waiting and roughly how many verified anchor exits it
// would take (one per ~20 mileposts of exit span, minimum 2).
const calibratedKeys = new Set(calibration.calibrations.map((c) => `${c.interstate}|${c.state}`));
const worklistMap = new Map<
  string,
  { corridor: string; state: string; rows: number; minExit: number; maxExit: number }
>();
for (const r of snapshot) {
  if (r.lat != null && r.lng != null) continue;
  const res = resolveCorridor(r.state ?? '', r.interstate ?? '', r.exit_number ?? '');
  if (!res.canonical) continue;
  const key = `${res.canonical}|${(r.state ?? '').trim().toUpperCase()}`;
  if (calibratedKeys.has(key)) continue;
  const mp = parseExitNumber(r.exit_number ?? '');
  const entry = worklistMap.get(key) ?? {
    corridor: res.canonical,
    state: (r.state ?? '').trim().toUpperCase(),
    rows: 0,
    minExit: Number.POSITIVE_INFINITY,
    maxExit: 0,
  };
  entry.rows += 1;
  if (mp !== null) {
    entry.minExit = Math.min(entry.minExit, mp);
    entry.maxExit = Math.max(entry.maxExit, mp);
  }
  worklistMap.set(key, entry);
}
const calibrationWorklist = [...worklistMap.values()]
  .map((w) => ({
    ...w,
    minExit: Number.isFinite(w.minExit) ? w.minExit : null,
    anchorsNeeded: Number.isFinite(w.minExit)
      ? Math.max(2, Math.ceil((w.maxExit - w.minExit) / 20) + 1)
      : 0,
  }))
  .sort((a, b) => b.rows - a.rows);

/* ---------------------------------------------------------- write output */
mkdirSync(outDir, { recursive: true });

const confidenceDistribution: Record<string, number> = {};
for (const s of staged) {
  confidenceDistribution[s.confidence] = (confidenceDistribution[s.confidence] ?? 0) + 1;
}

const stageA = staged.filter((s) => s.stage === 'A');
const full = {
  generatedAt,
  totals: {
    totalActive: report.summary.total,
    validExisting: report.summary.alreadyGeocoded,
    existingSuspect: report.summary.existingSuspect,
    existingInvalid: report.summary.existingInvalid,
    conflicts: report.summary.conflicts,
    missing: report.summary.total - rowsWithCoords,
  },
  interpolationByCorridor: stageSummaries.find((s) => s.stage === 'A')!.byCorridor,
  interpolationByCorridorStageB: stageSummaries.find((s) => s.stage === 'B')!.byCorridor,
  census: censusCounts,
  concurrency: {
    rules: CONCURRENCY_RULES.length,
    normalizedRows: concurrencyRows.length,
    rows: concurrencyRows,
  },
  duplicateRisks: dupPairs,
  stages: stageSummaries,
  projectedCoverage: coverage,
  confidenceDistribution,
  neverAutoGeocode: neverAuto,
  manualReviewWorkload: stageSummaries
    .filter((s) => s.stage !== 'D')
    .reduce((n, s) => n + s.records, 0),
  manualResearchQueue: stageSummaries.find((s) => s.stage === 'D')!.records,
  externalServiceUsage: { censusRequestsThisRun: 0, paidRequestsEver: 0 },
  stageA,
  calibration: {
    corridors: calibration.calibrations.map((c) => ({
      corridor: `${c.interstate} ${c.state}`,
      anchors: c.anchors.length,
      minMilepost: Math.min(...c.anchors.map((a) => a.milepost)),
      maxMilepost: Math.max(...c.anchors.map((a) => a.milepost)),
      largestGap: Math.max(
        0,
        ...c.anchors.slice(1).map((a, i) => a.milepost - c.anchors[i].milepost),
      ),
    })),
    rejectedAnchors: calibration.rejected.map((r) => ({
      corridor: r.corridor,
      milepost: r.anchor.milepost,
      listingId: r.anchor.listingId,
      reason: r.reason,
    })),
    skipped: calibration.skipped,
    worklist: calibrationWorklist,
  },
};
writeFileSync(join(outDir, 'phase2b-report.json'), JSON.stringify(full, null, 2));

// Stage A exact records, in the admin console's reviewable CSV contract.
const stageAIds = new Set(stageA.map((s) => s.id));
const stageAReport = { ...report, rows: report.rows.filter((r) => stageAIds.has(r.listing.id)) };
writeFileSync(join(outDir, 'stage-a-candidates.csv'), dryRunCandidatesCsv(stageAReport));

// Per-corridor calibration report (markdown, tabular anomalies included).
let md = `# Corridor calibration report (${generatedAt})\n\n`;
md += `Anchors come ONLY from already-verified coordinates and high/medium batch rows; `;
md += `no coordinate here was invented.\n\n`;
for (const c of calibration.calibrations) {
  md += `## ${c.interstate} ${c.state} — ${c.anchors.length} anchors\n\n`;
  md += `| Milepost | Lat | Lng | Source | Listing |\n|---|---|---|---|---|\n`;
  for (const a of c.anchors) {
    md += `| ${a.milepost} | ${a.lat.toFixed(6)} | ${a.lng.toFixed(6)} | ${a.source} | ${a.listingId ?? '—'} |\n`;
  }
  const gaps = c.anchors.slice(1).map((a, i) => ({
    from: c.anchors[i].milepost,
    to: a.milepost,
    gap: a.milepost - c.anchors[i].milepost,
  }));
  const wide = gaps.filter((g) => g.gap > 30);
  md += `\nLargest anchor gap: ${Math.max(0, ...gaps.map((g) => g.gap))} mi.`;
  md +=
    wide.length > 0
      ? ` Gaps too wide to interpolate (${wide.length}): ${wide.map((g) => `${g.from}–${g.to}`).join(', ')}.\n\n`
      : ' All gaps interpolable.\n\n';
}
md += `## Anomalies\n\n`;
md += `Rejected anchors (implausible vs neighbors): ${calibration.rejected.length}\n\n`;
for (const r of calibration.rejected) {
  md += `- ${r.corridor} milepost ${r.anchor.milepost} (listing ${r.anchor.listingId ?? '?'}): ${r.reason}\n`;
}
md += `\nSkipped anchor-source rows: ${calibration.skipped.length}\n\n`;
const skipCounts: Record<string, number> = {};
for (const s of calibration.skipped) skipCounts[s.reason] = (skipCounts[s.reason] ?? 0) + 1;
for (const [reason, n] of Object.entries(skipCounts)) md += `- ${reason}: ${n}\n`;
md += `\n## Calibration worklist — corridors awaiting anchors\n\n`;
md += `| Corridor | Rows waiting | Exit span | Anchor exits needed (est.) |\n|---|---|---|---|\n`;
for (const w of calibrationWorklist) {
  md += `| ${w.corridor} ${w.state} | ${w.rows} | ${w.minExit ?? '?'}–${w.maxExit || '?'} | ${w.anchorsNeeded || '?'} |\n`;
}
md += `\nAnchors are gathered with the existing human-verified batch-CSV workflow — one high-confidence coordinate at each anchor exit.\n`;
md += `\n## Concurrency normalization\n\n${concurrencyRows.length} listings normalized under ${CONCURRENCY_RULES.length} documented rules (original tags preserved):\n\n`;
md += `| Listing | State | Tagged | Canonical | Exit |\n|---|---|---|---|---|\n`;
for (const c of concurrencyRows) {
  md += `| ${c.name} | ${c.state} | ${c.tagged} | ${c.canonical} | ${c.exit} |\n`;
}
writeFileSync(join(outDir, 'corridor-calibration-report.md'), md);

/* ---------------------------------------------------------------- stdout */
console.log(`total active:               ${full.totals.totalActive}`);
console.log(`valid existing coords:      ${full.totals.validExisting}`);
console.log(`missing coords:             ${full.totals.missing}`);
console.log(`corridors calibrated:       ${calibration.calibrations.length}`);
for (const c of full.calibration.corridors) {
  console.log(
    `  ${c.corridor}: ${c.anchors} anchors, mp ${c.minMilepost}–${c.maxMilepost}, largest gap ${c.largestGap}`,
  );
}
console.log(`concurrency-normalized:     ${concurrencyRows.length}`);
console.log(
  `census attempted/exact/approx/rejected: ${censusCounts.attempted}/${censusCounts.exact}/${censusCounts.approximate}/${censusCounts.rejected}`,
);
for (const s of stageSummaries) {
  console.log(`stage ${s.stage}: ${s.records} records ${JSON.stringify(s.byCorridor)}`);
}
console.log(`duplicate-coordinate risks: ${dupPairs.length}`);
console.log(`never-auto-geocode:         ${neverAuto.length}`);
console.log(
  `projected coverage: ${coverage.map((c) => `${c.stage}=${c.cumulative} (${c.pct}%)`).join(' → ')}`,
);
console.log(
  `\nwrote ${outDir}/phase2b-report.json, stage-a-candidates.csv, corridor-calibration-report.md`,
);
console.log('NO database writes and NO network requests were performed by this script.');
