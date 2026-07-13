/**
 * M28 (I-65 Indiana) assessment — read-only, drives the REAL production libs:
 *  prepareImport, assessExpansion, classifyPair, scoreCompleteness, normalizeText.
 *
 *   npx esbuild scratch-m28/assess-m28.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=.next/assess-m28.cjs && node .next/assess-m28.cjs \
 *     data/imports/i65-indiana-batch-007.csv scratch-m28/live.json scratch-m28
 */
import { readFileSync, writeFileSync } from 'fs';
import { prepareImport, importDupKey } from '@/lib/directory/import';
import { assessExpansion, expansionReportCsv } from '@/lib/directory/expansion';
import { classifyPair, type PairListing } from '@/lib/directory/colocation';
import { normalizeText } from '@/lib/directory/duplicates';
import { scoreCompleteness } from '@/lib/directory/completeness';

const [, , masterPath, livePath, outDir] = process.argv;
if (!masterPath || !livePath || !outDir) { console.error('usage: assess-m28 <master.csv> <live.json> <out-dir>'); process.exit(2); }

const csvText = readFileSync(masterPath, 'utf8');
type LiveRow = { id: string; name: string; category_slug: string; address: string | null; city: string; state: string; phone: string | null; website: string | null; lat: number | null; lng: number | null; interstate: string | null; exit_number: string | null; detail_slug: string | null; is_published: boolean; };
const live: LiveRow[] = JSON.parse(readFileSync(livePath, 'utf8'));

const livePairs: PairListing[] = live.map((l) => ({ id: l.id, name: l.name, category: l.category_slug, address: l.address, city: l.city, state: l.state, phone: l.phone, website: l.website, lat: l.lat, lng: l.lng, interstate: l.interstate, exitNumber: l.exit_number == null ? null : String(l.exit_number) }));
const liveKeys = new Set(live.map((l) => importDupKey(l.name, l.city, l.state)));
const liveSlugs = new Set(live.map((l) => l.detail_slug).filter(Boolean) as string[]);

// ---- expansion readiness (vs live DB) ----
const report = assessExpansion(csvText, liveKeys, liveSlugs, livePairs);
console.log('=== EXPANSION READINESS (vs live production) ===');
console.log(`parser: total=${report.summary.totalRows} imported=${report.summary.imported} skipped=${report.summary.skipped} duplicates=${report.summary.duplicates} errors=${report.summary.errors.length}`);
for (const e of report.summary.errors) console.log(`  row ${e.row}: ${e.message}`);
console.log('verdicts:', JSON.stringify(report.verdictCounts));
let slugCollisions = 0;
for (const r of report.rows) {
  if (r.slugCollision) slugCollisions++;
  if (r.slugCollision || r.duplicateHits.length) {
    const dup = r.duplicateHits.length ? ` dupHits=[${r.duplicateHits.map((h) => `${h.liveName}:${h.class}`).join('; ')}]` : '';
    console.log(`  ${r.verdict.padEnd(17)} ${String(r.completeness).padStart(3)} ${r.slugPreview}${r.slugCollision ? ' SLUG-COLLISION' : ''}${dup} :: ${r.verdictReason}`);
  }
}
console.log(`slug collisions vs live: ${slugCollisions}`);
writeFileSync(`${outDir}/../data/imports/i65-kentucky-batch-010-expansion-report.csv`, expansionReportCsv(report));
writeFileSync(`${outDir}/expansion-summary.json`, JSON.stringify({ ready: report.verdictCounts['ready-to-publish'] ?? 0, unpub: report.verdictCounts['import-unpublished'] ?? 0, manual: report.verdictCounts['manual-review'] ?? 0, reject: report.verdictCounts['reject'] ?? 0, slugCollisions }, null, 1));

// in-batch slug uniqueness (detail_slug is name+city+state; two same-name+city rows collide)
const slugCount: Record<string, number> = {};
for (const r of report.rows) slugCount[r.slugPreview] = (slugCount[r.slugPreview] ?? 0) + 1;
const inBatchSlugDupes = Object.entries(slugCount).filter(([, n]) => n > 1);
console.log(`in-batch slug duplicates: ${inBatchSlugDupes.length}`);
for (const [sl, cnt] of inBatchSlugDupes) console.log(`  ${sl} x${cnt}`);

// ---- duplicates vs GA/TN/KY/OH/MI/FL batch CSVs + live ----
function csvToPairs(path: string, prefix: string): PairListing[] {
  const { rows } = prepareImport(readFileSync(path, 'utf8'), new Set());
  const s = (v: unknown) => (typeof v === 'string' ? v : ''); const n = (v: unknown) => (typeof v === 'number' ? v : null);
  return rows.map((row, i) => ({ id: `${prefix}-${i}`, name: s(row.name), category: s(row.category_slug), address: s(row.address) || null, city: s(row.city), state: s(row.state), phone: s(row.phone) || null, website: s(row.website) || null, lat: n(row.lat), lng: n(row.lng), interstate: s(row.interstate) || null, exitNumber: s(row.exit_number) || null }));
}
const newPairs = csvToPairs(masterPath, 'ky');
function crossCheck(label: string, others: PairListing[]) {
  console.log(`=== DUPLICATES vs ${label} ===`);
  let hits = 0;
  for (const a of newPairs) for (const b of others) {
    const digits = (p: string | null) => (p ?? '').replace(/\D/g, '').slice(-10);
    const nameMatch = normalizeText(a.name) === normalizeText(b.name);
    const phoneMatch = !!digits(a.phone) && digits(a.phone) === digits(b.phone);
    if (!nameMatch && !phoneMatch && a.state !== b.state) continue;
    const pair = classifyPair(a, b);
    if (pair.score >= 35 || nameMatch || phoneMatch) { hits++; console.log(`  ${a.name} (${a.city} ${a.state}) <-> ${b.name} (${b.city} ${b.state}) :: ${pair.class} score=${pair.score} [${pair.reasons.join(', ')}]`); }
  }
  if (!hits) console.log('  none');
  return hits;
}
const gaHits = crossCheck('Georgia CSV', csvToPairs('data/imports/i75-georgia-batch-001.csv', 'ga'));
const tnHits = crossCheck('Tennessee CSV', csvToPairs('data/imports/i75-tennessee-batch-002.csv', 'tn'));
const kyHits = crossCheck('Kentucky CSV', csvToPairs('data/imports/i75-kentucky-batch-003.csv', 'ky'));
const ohHits = crossCheck('Ohio CSV', csvToPairs('data/imports/i75-ohio-batch-004.csv', 'oh'));
const miHits = crossCheck('Michigan CSV', csvToPairs('data/imports/i75-michigan-batch-005.csv', 'mi'));
const flHits = crossCheck('Florida CSV', csvToPairs('data/imports/i75-florida-batch-006.csv', 'fl'));
const inHits = crossCheck('Indiana CSV', csvToPairs('data/imports/i65-indiana-batch-007.csv', 'in'));
const alHits = crossCheck('Alabama CSV', csvToPairs('data/imports/i65-alabama-batch-008.csv', 'al'));
const tn65Hits = crossCheck('Tennessee I-65 CSV', csvToPairs('data/imports/i65-tennessee-batch-009.csv', 'tn65'));
const liveHits = crossCheck('LIVE production DB', livePairs);

// in-file co-location pairs (established pattern, informational)
console.log('=== IN-FILE PAIR CLASSES (score >= 50) ===');
let inFile = 0;
for (let i = 0; i < newPairs.length; i++) for (let j = i + 1; j < newPairs.length; j++) {
  const pair = classifyPair(newPairs[i], newPairs[j]);
  if (pair.score >= 50) { inFile++; console.log(`  ${newPairs[i].name} <-> ${newPairs[j].name} :: ${pair.class} score=${pair.score} [${pair.reasons.join(', ')}]`); }
}
if (!inFile) console.log('  none');

// ---- quality (completeness) ----
const { rows: prepared } = prepareImport(csvText, new Set());
const s = (v: unknown) => (typeof v === 'string' ? v : ''); const n = (v: unknown) => (typeof v === 'number' ? v : null);
const scores = prepared.map((row) => {
  const res = scoreCompleteness({ name: s(row.name), category: s(row.category_slug), address: s(row.address) || null, city: s(row.city), state: s(row.state), zip: s(row.zip) || null, interstate: s(row.interstate) || null, exitNumber: s(row.exit_number) || null, lat: n(row.lat), lng: n(row.lng), phone: s(row.phone) || null, website: s(row.website) || null, amenities: Array.isArray(row.amenities) ? (row.amenities as string[]) : [], parkingSpaces: n(row.parking_spaces), description: s(row.description) || null, tpcUrl: s(row.tpc_url) || null, verifiedAt: null, approvedReviews: 0 });
  return { name: s(row.name), city: s(row.city), score: res.score, label: res.label };
});
scores.sort((a, b) => a.score - b.score);
const dist: Record<string, number> = {}; for (const q of scores) dist[q.label] = (dist[q.label] ?? 0) + 1;
const mean = scores.reduce((t, q) => t + q.score, 0) / (scores.length || 1);
const median = scores[Math.floor(scores.length / 2)]?.score ?? 0;
console.log('=== QUALITY (completeness) ===');
console.log(`rows=${scores.length} min=${scores[0]?.score} median=${median} mean=${mean.toFixed(1)} max=${scores[scores.length - 1]?.score}`);
console.log('labels:', JSON.stringify(dist));
console.log('lowest 10:'); for (const q of scores.slice(0, 10)) console.log(`  ${q.score} ${q.label} — ${q.name} (${q.city})`);
writeFileSync(`${outDir}/quality-scores.json`, JSON.stringify({ mean: Number(mean.toFixed(1)), median, min: scores[0]?.score, max: scores[scores.length-1]?.score, dist, scores }, null, 1));
writeFileSync(`${outDir}/dup-summary.json`, JSON.stringify({ gaHits, tnHits, kyHits, ohHits, miHits, flHits, inHits, alHits, tn65Hits, liveHits, inFile, inBatchSlugDupes: inBatchSlugDupes.length }, null, 1));
console.log('DONE');
