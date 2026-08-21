/**
 * Phase 1 · Step 3 — Directory completion ASSESSMENT from the Census results.
 *
 * Pure/offline: reads the committed snapshot + Census checkpoint and emits the
 * owner's decision package — actual match counts, projected coverage overall
 * and state-by-state, unmatched rows by state/corridor, the interpolation-
 * eligible remainder, manual-investigation rows, and the minimum work needed to
 * reach 75/85/90/95% coverage. No network, no database, no clock.
 *
 * Run:
 *   npx esbuild scripts/census-assessment.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/census-assessment.cjs \
 *   && node /tmp/census-assessment.cjs \
 *        data/geocoding/dry-run/directory-snapshot.json \
 *        data/geocoding/census/census-results.json \
 *        data/geocoding/census
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildWorklist,
  type Checkpoint,
  type RunnerSnapshotRow,
} from '@/lib/directory/census-runner';

const [snapshotPath, checkpointPath, outDir] = process.argv.slice(2);
if (!snapshotPath || !checkpointPath || !outDir) {
  console.error('Usage: census-assessment <snapshot.json> <census-results.json> <out-dir>');
  process.exit(1);
}

const snapshot: RunnerSnapshotRow[] = JSON.parse(readFileSync(snapshotPath, 'utf8'));
const checkpoint: Checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf8'));
mkdirSync(outDir, { recursive: true });

const total = snapshot.length;
const worklist = buildWorklist(snapshot);
const ineligibleById = new Map(worklist.ineligible.map((i) => [i.id, i.reason]));

type RowView = {
  id: string;
  state: string;
  corridor: string;
  hasCoords: boolean;
  hasExit: boolean;
  census: 'high' | 'medium' | 'rejected' | 'pending' | 'ineligible' | 'n/a';
  rejection?: string;
};

const rows: RowView[] = snapshot.map((r) => {
  const hasCoords = r.lat != null && r.lng != null;
  const result = checkpoint[r.id];
  let census: RowView['census'] = 'n/a';
  let rejection: string | undefined;
  if (!hasCoords) {
    if (result && result.status !== 'rejected' && result.lat != null) {
      census = result.confidence === 'high' ? 'high' : 'medium';
    } else if (result) {
      census = 'rejected';
      rejection = result.rejection ?? 'no-match';
    } else if (ineligibleById.has(r.id)) {
      census = 'ineligible';
      rejection = ineligibleById.get(r.id);
    } else {
      census = 'pending';
    }
  }
  return {
    id: r.id,
    state: (r.state ?? '').trim().toUpperCase() || '(none)',
    corridor: r.interstate ?? '(none)',
    hasCoords,
    hasExit: !!(r.exit_number && String(r.exit_number).trim()) && !!r.interstate,
    census,
    rejection,
  };
});

const withCoordsNow = rows.filter((r) => r.hasCoords).length;
const matchedHigh = rows.filter((r) => r.census === 'high').length;
const matchedMedium = rows.filter((r) => r.census === 'medium').length;
const matched = matchedHigh + matchedMedium;
const rejected = rows.filter((r) => r.census === 'rejected');
const pending = rows.filter((r) => r.census === 'pending').length;
const rejectionReasons: Record<string, number> = {};
for (const r of rejected)
  rejectionReasons[r.rejection ?? '?'] = (rejectionReasons[r.rejection ?? '?'] ?? 0) + 1;

const projected = withCoordsNow + matched;
const pct = (n: number) => Number(((100 * n) / total).toFixed(1));

// Unmatched = still missing coordinates even if every Census match is approved.
const unmatched = rows.filter((r) => !r.hasCoords && r.census !== 'high' && r.census !== 'medium');
const by = (key: (r: RowView) => string, list: RowView[]) => {
  const out: Record<string, number> = {};
  for (const r of list) out[key(r)] = (out[key(r)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
};

// Of the unmatched: interpolation-eligible (corridor + exit → coverable by
// corridor calibration) vs manual investigation (no exit path left).
const interpEligible = unmatched.filter((r) => r.hasExit);
const manualOnly = unmatched.filter((r) => !r.hasExit);

// State-by-state projected coverage.
const states = [...new Set(rows.map((r) => r.state))].sort();
const stateTable = states.map((s) => {
  const inState = rows.filter((r) => r.state === s);
  const now = inState.filter((r) => r.hasCoords).length;
  const proj = now + inState.filter((r) => r.census === 'high' || r.census === 'medium').length;
  return {
    state: s,
    total: inState.length,
    withCoordsNow: now,
    projectedAfterCensus: proj,
    projectedPct: Number(((100 * proj) / inState.length).toFixed(1)),
  };
});

// Minimum work to reach coverage thresholds, in cheapest-first order:
// 1) approve Census matches (already counted in `projected`),
// 2) interpolate unmatched corridor+exit rows (needs corridor calibration),
// 3) manual research for the remainder.
const thresholds = [75, 85, 90, 95].map((t) => {
  const target = Math.ceil((t / 100) * total);
  const gapAfterCensus = Math.max(0, target - projected);
  const fromInterpolation = Math.min(gapAfterCensus, interpEligible.length);
  const fromManual = Math.max(0, gapAfterCensus - fromInterpolation);
  return {
    thresholdPct: t,
    targetRows: target,
    projectedAfterCensus: projected,
    additionalRowsNeeded: gapAfterCensus,
    coverableByInterpolation: fromInterpolation,
    requiringManualResearch: fromManual,
    reachableWithoutManualResearch: fromManual === 0,
  };
});

const assessment = {
  generatedFrom: {
    snapshotTakenAt: snapshot[0]?.snapshot_taken_at ?? 'unknown',
    checkpointResults: Object.keys(checkpoint).length,
  },
  totals: {
    directoryRows: total,
    withCoordsNow,
    pctNow: pct(withCoordsNow),
    censusMatched: matched,
    censusHigh: matchedHigh,
    censusMedium: matchedMedium,
    censusRejected: rejected.length,
    censusRejectionReasons: rejectionReasons,
    censusPending: pending,
    projectedAfterApprovals: projected,
    projectedPct: pct(projected),
  },
  stateByState: stateTable,
  unmatched: {
    total: unmatched.length,
    byState: by((r) => r.state, unmatched),
    byCorridor: by((r) => r.corridor, unmatched),
    interpolationEligible: interpEligible.length,
    interpolationEligibleByCorridor: by((r) => r.corridor, interpEligible),
    manualInvestigation: manualOnly.length,
    manualInvestigationByState: by((r) => r.state, manualOnly),
  },
  thresholds,
};

writeFileSync(join(outDir, 'assessment.json'), JSON.stringify(assessment, null, 2) + '\n');

const md: string[] = [
  '# Directory completion assessment — after Census processing',
  '',
  `Snapshot ${assessment.generatedFrom.snapshotTakenAt} · ${total} rows · checkpoint ${assessment.generatedFrom.checkpointResults} results. All figures assume every valid Census match is APPROVED in the admin console (each row remains manual-review until then).`,
  '',
  '## Headline',
  '',
  `| metric | value |`,
  `| --- | --- |`,
  `| Coverage now | ${withCoordsNow} / ${total} (${pct(withCoordsNow)}%) |`,
  `| Census matches | ${matched} (high ${matchedHigh} · medium ${matchedMedium}) |`,
  `| Census rejected | ${rejected.length} |`,
  `| Not fetched (pending) | ${pending} |`,
  `| **Projected coverage after approvals** | **${projected} / ${total} (${pct(projected)}%)** |`,
  '',
  '## State-by-state projected coverage',
  '',
  '| state | rows | coords now | after Census | projected % |',
  '| --- | --- | --- | --- | --- |',
  ...stateTable.map(
    (s) =>
      `| ${s.state} | ${s.total} | ${s.withCoordsNow} | ${s.projectedAfterCensus} | ${s.projectedPct}% |`,
  ),
  '',
  '## Unmatched after Census (still missing coordinates)',
  '',
  `Total unmatched: **${unmatched.length}** — of which **${interpEligible.length} interpolation-eligible** (corridor + exit; coverable by corridor calibration) and **${manualOnly.length} manual-investigation** (no exit path).`,
  '',
  '### By state',
  '',
  ...Object.entries(assessment.unmatched.byState).map(([k, v]) => `- ${k}: ${v}`),
  '',
  '### By corridor',
  '',
  ...Object.entries(assessment.unmatched.byCorridor).map(([k, v]) => `- ${k}: ${v}`),
  '',
  '### Interpolation-eligible remainder by corridor',
  '',
  ...Object.entries(assessment.unmatched.interpolationEligibleByCorridor).map(
    ([k, v]) => `- ${k}: ${v}`,
  ),
  '',
  '## Minimum work to reach coverage thresholds',
  '',
  '| target | rows needed | gap after Census | coverable by interpolation | manual research |',
  '| --- | --- | --- | --- | --- |',
  ...thresholds.map(
    (t) =>
      `| ${t.thresholdPct}% | ${t.targetRows} | ${t.additionalRowsNeeded} | ${t.coverableByInterpolation} | ${t.requiringManualResearch} |`,
  ),
  '',
  '_Order of operations: approve Census matches (free, done) → corridor interpolation (engineering, needs calibration anchors) → manual research (human time)._',
  '',
];
writeFileSync(join(outDir, 'assessment.md'), md.join('\n'));

console.log(
  `coverage ${pct(withCoordsNow)}% now -> ${pct(projected)}% projected (matched ${matched}: high ${matchedHigh}/medium ${matchedMedium}; rejected ${rejected.length}; pending ${pending})`,
);
console.log(
  `unmatched ${unmatched.length} (interp-eligible ${interpEligible.length}, manual ${manualOnly.length})`,
);
for (const t of thresholds)
  console.log(
    `  ${t.thresholdPct}%: need +${t.additionalRowsNeeded} (interp ${t.coverableByInterpolation}, manual ${t.requiringManualResearch})`,
  );
console.log(`wrote assessment.json, assessment.md to ${outDir}`);
