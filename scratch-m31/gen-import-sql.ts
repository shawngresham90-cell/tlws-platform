/**
 * Generate a corruption-proof production import statement for ONE part CSV,
 * using the REAL production import pipeline (prepareImport) so the inserted
 * columns exactly match the admin CSV-import action: toRow(...) + slug +
 * source='csv-import'. Nothing here writes to the DB.
 *
 *   npx esbuild scratch-m26/gen-import-sql.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=.next/gen.cjs && \
 *   node .next/gen.cjs <part.csv> <live.json> [priorPart.csv ...] > out.sql
 *
 * The prepared rows are serialized to JSON, base64-encoded, and embedded with
 * an md5 guard: if the blob is altered in transit the guard yields NULL, which
 * expands to zero rows (a safe no-op abort) instead of committing bad data.
 * The final SELECT returns verification counts. Aborts (exit 1) on any
 * skip/duplicate/parse error or any non-null coordinate.
 */
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { prepareImport, importDupKey } from '@/lib/directory/import';

const [, , partPath, liveJsonPath, outPrefix, chunkArg, ...priorParts] = process.argv;
if (!partPath || !liveJsonPath || !outPrefix) {
  console.error('usage: gen-import-sql <part.csv> <live.json> <outPrefix> [chunkSize] [priorPart.csv ...]');
  process.exit(2);
}
const CHUNK = Number(chunkArg) > 0 ? Number(chunkArg) : 13;

type LiveRow = { name: string; city: string; state: string };
const live: LiveRow[] = JSON.parse(readFileSync(liveJsonPath, 'utf8'));
const keys = new Set(live.map((l) => importDupKey(l.name, l.city, l.state)));
for (const p of priorParts) {
  const { rows } = prepareImport(readFileSync(p, 'utf8'), new Set());
  for (const r of rows) keys.add(importDupKey(r.name as string, r.city as string, r.state as string));
}

const { rows, summary } = prepareImport(readFileSync(partPath, 'utf8'), keys);
if (summary.skipped || summary.duplicates || summary.errors.length) {
  console.error('ABORT — parser flagged rows:', JSON.stringify(summary));
  process.exit(1);
}
for (const r of rows) {
  if (r.lat != null || r.lng != null) {
    console.error('ABORT — non-null coordinate on', r.name);
    process.exit(1);
  }
}

// Normalize each prepared row to the exact insert payload (string/number/bool/null;
// amenities stays a JSON array → jsonb). Order of keys is irrelevant (accessed by name).
const COLS = [
  'name', 'category_slug', 'type', 'address', 'city', 'state', 'zip', 'lat', 'lng',
  'phone', 'website', 'description', 'free_parking', 'paid_parking', 'reserved_parking',
  'overnight_parking', 'parking_spaces', 'amenities', 'tpc_url', 'affiliate_code',
  'image_url', 'interstate', 'exit_number', 'is_published', 'is_featured', 'is_indexable',
  'verified_at', 'slug', 'source',
];
const allPayload = rows.map((r) => {
  const o: Record<string, unknown> = {};
  for (const c of COLS) o[c] = c === 'amenities' ? (Array.isArray(r[c]) ? r[c] : []) : (r[c] ?? null);
  return o;
});

function buildSql(payload: Record<string, unknown>[]): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, 'utf8').toString('base64');
  const md5 = createHash('md5').update(b64).digest('hex');
  const expected = payload.length;
  return (
`with payload(b64) as (values ('${b64}')),
guard as (select case when md5(b64) = '${md5}' then b64 else null end as b64 from payload),
rows as (
  select jsonb_array_elements(convert_from(decode((select b64 from guard), 'base64'), 'utf8')::jsonb) as r
),
ins as (
  insert into locations (
    name, category_slug, type, address, city, state, zip, lat, lng, phone, website,
    description, free_parking, paid_parking, reserved_parking, overnight_parking,
    parking_spaces, amenities, tpc_url, affiliate_code, image_url, interstate,
    exit_number, is_published, is_featured, is_indexable, verified_at, slug, source
  )
  select
    r->>'name', r->>'category_slug', r->>'type', r->>'address', r->>'city', r->>'state',
    r->>'zip', (r->>'lat')::double precision, (r->>'lng')::double precision, r->>'phone',
    r->>'website', r->>'description', (r->>'free_parking')::boolean, (r->>'paid_parking')::boolean,
    (r->>'reserved_parking')::boolean, (r->>'overnight_parking')::boolean,
    (r->>'parking_spaces')::int, r->'amenities', r->>'tpc_url', r->>'affiliate_code',
    r->>'image_url', r->>'interstate', r->>'exit_number', (r->>'is_published')::boolean,
    (r->>'is_featured')::boolean, (r->>'is_indexable')::boolean,
    nullif(r->>'verified_at','')::timestamptz, r->>'slug', r->>'source'
  from rows
  returning id, is_published, lat, lng, detail_slug, source
)
select ${expected} as expected,
       count(*) as inserted,
       count(*) filter (where is_published) as published,
       count(*) filter (where not is_published) as held,
       count(*) filter (where lat is not null or lng is not null) as with_coords,
       count(*) filter (where source <> 'csv-import') as wrong_source,
       count(*) filter (where detail_slug is null or detail_slug = '') as missing_slug
from ins;`
  );
}

const manifest: { file: string; rows: number; md5: string }[] = [];
for (let i = 0, c = 1; i < allPayload.length; i += CHUNK, c++) {
  const slice = allPayload.slice(i, i + CHUNK);
  const sql = buildSql(slice);
  const file = `${outPrefix}.chunk${c}.sql`;
  writeFileSync(file, sql);
  const md5 = /md5\(b64\) = '([0-9a-f]{32})'/.exec(sql)![1];
  manifest.push({ file, rows: slice.length, md5 });
}
console.error(`OK part=${partPath} totalRows=${rows.length} published=${rows.filter((r) => r.is_published).length} held=${rows.filter((r) => !r.is_published).length} existingKeys=${keys.size} chunkSize=${CHUNK}`);
console.error('CHUNKS:');
for (const m of manifest) console.error(`  ${m.file}  rows=${m.rows}  md5=${m.md5}`);
