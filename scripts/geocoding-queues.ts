/**
 * Geocoding queue generator (research tooling — never applies coordinates).
 *
 * Reads a verified geocoding batch CSV, runs the REAL parser + a 3-way triage
 * (ready / manual-review / rejected), flags duplicate proposed coordinates, and
 * writes three re-importable queue CSVs plus a markdown report. Read-only: it
 * touches no database and proposes no writes.
 *
 * Usage:
 *   npx esbuild scripts/geocoding-queues.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=.next/geocoding-queues.cjs \
 *   && node .next/geocoding-queues.cjs data/geocoding/<batch>.csv [outDir]
 */
import { readFileSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import { parseGeocodingCsv } from '@/lib/directory/geocoding';
import {
  classifyQueueStatic,
  splitQueues,
  duplicateCoordinateFindings,
  queueCsv,
  queueReport,
} from '@/lib/directory/geocoding-queues';

const inPath = process.argv[2];
const outDir = process.argv[3] || dirname(inPath || '');
if (!inPath) {
  console.error('usage: geocoding-queues <batch.csv> [outDir]');
  process.exit(2);
}

const text = readFileSync(inPath, 'utf8');
const { rows, errors } = parseGeocodingCsv(text);
if (errors.length) {
  console.error(`Parse errors (${errors.length}):`);
  for (const e of errors) console.error(`  ${e}`);
  if (rows.length === 0) process.exit(1);
}

const split = splitQueues(rows, classifyQueueStatic);
const duplicates = duplicateCoordinateFindings(rows);
const report = queueReport(rows, split, duplicates);

const stem = basename(inPath).replace(/\.csv$/i, '');
const write = (suffix: string, content: string) => {
  const p = join(outDir, `${stem}-${suffix}`);
  writeFileSync(p, content);
  return p;
};

write('queue-ready.csv', queueCsv(split.ready, split.verdicts));
write('queue-manual-review.csv', queueCsv(split.manualReview, split.verdicts));
write('queue-rejected.csv', queueCsv(split.rejected, split.verdicts));

const md: string[] = [
  `# Geocoding queues — ${stem}`,
  '',
  `Generated read-only from \`${basename(inPath)}\`. No coordinates were applied and no database was touched.`,
  '',
  `- **Total rows:** ${report.total}`,
  `- **Ready:** ${report.counts.ready} — pass all gates (action=ready, confidence=high, valid coordinates); safe to apply after admin selection.`,
  `- **Manual review:** ${report.counts['manual-review']} — have a candidate coordinate but need a human (low/medium confidence or action=manual-review).`,
  `- **Rejected:** ${report.counts.rejected} — must not be applied as-is (skip, unresolved, or missing/invalid coordinates).`,
  '',
  '## By confidence',
  '',
  '| Confidence | Rows |',
  '| --- | --- |',
  ...Object.entries(report.byConfidence).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '## By action',
  '',
  '| Action | Rows |',
  '| --- | --- |',
  ...Object.entries(report.byAction).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '## Duplicate proposed coordinates',
  '',
  duplicates.length === 0
    ? 'None — every proposed coordinate is unique across distinct listings.'
    : `${duplicates.length} coordinate(s) shared by more than one listing (likely a reused anchor or copy/paste — review before applying):`,
  ...duplicates.map(
    (d) => `- \`${d.latitude}, ${d.longitude}\` → ${d.names.join(' | ')} (${d.listingIds.length} listings)`,
  ),
  '',
  '## Queue files',
  '',
  `- \`${stem}-queue-ready.csv\``,
  `- \`${stem}-queue-manual-review.csv\``,
  `- \`${stem}-queue-rejected.csv\``,
  '',
  'Each queue CSV keeps the full 15-column geocoding contract plus a `queue_reasons` column, so it re-parses cleanly through `parseGeocodingCsv` and can be fed back into the console.',
  '',
];
write('queues-report.md', md.join('\n'));

console.log(`queues for ${stem}:`);
console.log(`  ready=${report.counts.ready} manual-review=${report.counts['manual-review']} rejected=${report.counts.rejected} (total ${report.total})`);
console.log(`  duplicate-coordinate findings: ${duplicates.length}`);
console.log(`  parse errors: ${errors.length}`);
