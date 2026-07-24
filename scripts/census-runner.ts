/**
 * Phase 1 · Step 3 — Census batch runner CLI.
 *
 * Three subcommands over the pure lib (src/lib/directory/census-runner.ts):
 *
 *   worklist  <snapshot.json> <out-dir>            — deterministic, offline
 *   fetch     <snapshot.json> <out-dir> [--limit N] — NETWORK (owner-run)
 *   package   <snapshot.json> <out-dir>            — deterministic, offline
 *
 * `fetch` is the ONLY step that touches the network (the free US Census
 * geocoder, ~2 req/s, resumable checkpoint written every 25 results — safe to
 * Ctrl-C and rerun). It exists for the owner or a network-capable CI job; the
 * build sandbox blocks external hosts, so run it locally:
 *
 *   npx esbuild scripts/census-runner.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/census-runner.cjs \
 *   && node /tmp/census-runner.cjs fetch \
 *        data/geocoding/dry-run/directory-snapshot.json data/geocoding/census
 *
 * NEVER writes to any database. `package` emits review CSVs whose every row is
 * action=manual-review — applying stays a human decision in the admin console.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildWorklist,
  buildReviewPackage,
  mergeCheckpoint,
  pendingQueries,
  worklistCsvs,
  type Checkpoint,
  type RunnerSnapshotRow,
} from '@/lib/directory/census-runner';
import { censusGeocodeBatch, type CensusFetch } from '@/lib/directory/census-geocoder';

const [cmd, snapshotPath, outDir, ...rest] = process.argv.slice(2);
if (!cmd || !snapshotPath || !outDir || !['worklist', 'fetch', 'package'].includes(cmd)) {
  console.error(
    'Usage: census-runner <worklist|fetch|package> <snapshot.json> <out-dir> [--limit N]',
  );
  process.exit(1);
}

const snapshot: RunnerSnapshotRow[] = JSON.parse(readFileSync(snapshotPath, 'utf8'));
mkdirSync(outDir, { recursive: true });
const checkpointPath = join(outDir, 'census-results.json');

function loadCheckpoint(): Checkpoint {
  return existsSync(checkpointPath) ? JSON.parse(readFileSync(checkpointPath, 'utf8')) : {};
}
/** Checkpoint is always written sorted by id → byte-stable for identical data. */
function saveCheckpoint(cp: Checkpoint): void {
  const sorted = Object.fromEntries(Object.entries(cp).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(checkpointPath, JSON.stringify(sorted, null, 1) + '\n');
}

async function main(): Promise<void> {
  const worklist = buildWorklist(snapshot);

  if (cmd === 'worklist') {
    const { eligibleCsv, ineligibleCsv } = worklistCsvs(worklist);
    writeFileSync(join(outDir, 'census-worklist.csv'), eligibleCsv);
    writeFileSync(join(outDir, 'census-ineligible.csv'), ineligibleCsv);
    if (!existsSync(checkpointPath)) saveCheckpoint({});
    console.log(`eligible: ${worklist.eligible.length}, ineligible: ${worklist.ineligible.length}`);
    console.log(`wrote census-worklist.csv, census-ineligible.csv to ${outDir}`);
    return;
  }

  if (cmd === 'fetch') {
    const limitFlag = rest.indexOf('--limit');
    let limit = Infinity;
    if (limitFlag >= 0) {
      // A malformed --limit must never silently become a full 967-row run.
      const parsed = Number(rest[limitFlag + 1]);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        console.error('--limit requires a positive integer, e.g. --limit 50');
        process.exit(1);
      }
      limit = parsed;
    }
    let checkpoint = loadCheckpoint();
    const pending = pendingQueries(worklist, checkpoint).slice(
      0,
      Number.isFinite(limit) ? limit : undefined,
    );
    console.log(
      `checkpoint has ${Object.keys(checkpoint).length}; fetching ${pending.length} pending (free US Census service, ~2/s)`,
    );
    const fetchFn: CensusFetch = async (url) => {
      const res = await fetch(url);
      return { status: res.status, json: () => res.json() };
    };
    const CHUNK = 25;
    const interval = 600;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < pending.length; i += CHUNK) {
      // Keep the politeness interval ACROSS chunk boundaries too.
      if (i > 0) await sleep(interval);
      const chunk = pending.slice(i, i + CHUNK);
      const results = await censusGeocodeBatch(chunk, { fetchFn, minIntervalMs: interval });
      // Exhausted-retry service errors (outage, transient 5xx) must stay on the
      // fetch frontier — checkpointing them would permanently convert a blip
      // into a "no-match" rejection (existing entries win on resume).
      checkpoint = mergeCheckpoint(
        checkpoint,
        results.filter((r) => r.matchType !== 'service-error'),
      );
      saveCheckpoint(checkpoint);
      const skipped = results.filter((r) => r.matchType === 'service-error').length;
      console.log(
        `  ${Math.min(i + CHUNK, pending.length)}/${pending.length} processed${skipped ? ` (${skipped} service-error, will retry next run)` : ''}`,
      );
    }
    console.log(`done; checkpoint now ${Object.keys(checkpoint).length} results`);
    return;
  }

  // package
  const pkg = buildReviewPackage(snapshot, loadCheckpoint());
  writeFileSync(join(outDir, 'census-review.csv'), pkg.reviewCsv);
  writeFileSync(join(outDir, 'census-unresolved.csv'), pkg.unresolvedCsv);
  writeFileSync(join(outDir, 'census-verification.csv'), pkg.verificationCsv);
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify(pkg.summary, null, 2) + '\n');
  const s = pkg.summary;
  console.log(
    `worklist eligible ${s.worklist.eligible} / ineligible ${s.worklist.ineligible}; fetched ${s.checkpoint.fetched} (matched ${s.checkpoint.matched}, rejected ${s.checkpoint.rejected}, pending ${s.checkpoint.pending})`,
  );
  console.log(
    `confidence high ${s.confidence.high} / medium ${s.confidence.medium}; verification flags ${s.verificationFlags}`,
  );
  console.log(
    `coverage now ${s.coverage.pctNow}% -> ${s.coverage.pctAfterReviewingMatches}% after review; est. ${s.coverage.projectedIfPendingMatches70to85pct.low}–${s.coverage.projectedIfPendingMatches70to85pct.high}% if pending fetched (70–85% match band)`,
  );
  console.log(
    `wrote census-review.csv, census-unresolved.csv, census-verification.csv, summary.json to ${outDir}`,
  );
  console.log('NO database access occurred (runner has no database client).');
}

void main();
