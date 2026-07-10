/**
 * Dry-run validator for directory import CSVs.
 *
 * Runs a CSV through the EXACT same parser + zod schema the live
 * /admin/directory/import route uses (lib/directory/import.ts) — without
 * touching any database. Fails (exit 1) unless every row imports cleanly:
 * a data batch should be 100% valid before it is ever uploaded.
 *
 * Usage:
 *   npx esbuild scripts/validate-import.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=.next/validate-import.cjs \
 *   && node .next/validate-import.cjs data/imports/<file>.csv
 */
import { readFileSync } from 'fs';
import { parseCsv } from '@/lib/directory/csv';
import { prepareImport } from '@/lib/directory/import';

const path = process.argv[2];
if (!path) {
  console.error('Usage: validate-import <path-to-csv>');
  process.exit(2);
}

const text = readFileSync(path, 'utf8');

// Structural check: every row must have exactly the header's column count.
const grid = parseCsv(text);
const width = grid[0]?.length ?? 0;
const ragged = grid
  .map((row, i) => ({ row: i + 1, cols: row.length }))
  .filter((r) => r.cols !== width);
if (ragged.length > 0) {
  console.error(`FAIL: ragged rows (header has ${width} columns):`);
  for (const r of ragged.slice(0, 20)) console.error(`  row ${r.row}: ${r.cols} columns`);
  process.exit(1);
}
console.log(`Columns: ${width} · rows incl. header: ${grid.length}`);

// Full dry-run through the live import pipeline (no DB, no existing keys).
const { rows, summary } = prepareImport(text, new Set());
console.log(
  `Parsed: total=${summary.totalRows} imported=${summary.imported} skipped=${summary.skipped} ` +
    `duplicates=${summary.duplicates} errors=${summary.errors.length}`,
);
for (const e of summary.errors) console.error(`  row ${e.row}: ${e.message}`);

if (summary.skipped > 0 || summary.errors.length > 0) {
  console.error('FAIL: batch is not 100% clean.');
  process.exit(1);
}
if (summary.duplicates > 0) {
  console.error('FAIL: batch contains internal duplicate rows.');
  process.exit(1);
}
console.log(`OK: all ${rows.length} rows validate against the live import schema.`);
