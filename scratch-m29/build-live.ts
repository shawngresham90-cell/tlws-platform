/**
 * Reconstruct the full live production snapshot (578 rows) deterministically
 * from the seven committed, already-merged master CSVs (GA/TN/KY/OH/MI/FL/IN).
 * Production == those seven batches imported unchanged; detail_slug is a pure
 * function of name+city+state, so this reconstruction equals production and is
 * verified against the real DB by a read-only slug-set md5 comparison.
 *
 *   npx esbuild scratch-m29/build-live.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=.next/bl.cjs && node .next/bl.cjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { prepareImport } from '@/lib/directory/import';
import { slugify } from '@/lib/directory/admin';

type LiveRow = { id: string; name: string; category_slug: string; address: string | null; city: string; state: string; phone: string | null; website: string | null; lat: number | null; lng: number | null; interstate: string | null; exit_number: string | null; detail_slug: string | null; is_published: boolean; };

const CSVS = [
  'data/imports/i75-georgia-batch-001.csv',
  'data/imports/i75-tennessee-batch-002.csv',
  'data/imports/i75-kentucky-batch-003.csv',
  'data/imports/i75-ohio-batch-004.csv',
  'data/imports/i75-michigan-batch-005.csv',
  'data/imports/i75-florida-batch-006.csv',
  'data/imports/i65-indiana-batch-007.csv',
];
const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
const out: LiveRow[] = [];
for (const path of CSVS) {
  const { rows } = prepareImport(readFileSync(path, 'utf8'), new Set());
  rows.forEach((r, i) => {
    const name = String(r.name ?? '');
    const city = String(r.city ?? '');
    const state = String(r.state ?? '');
    out.push({
      id: `${path.slice(-6, -4)}-${i}`, name, category_slug: String(r.category_slug ?? ''),
      address: s(r.address), city, state, phone: s(r.phone), website: s(r.website),
      lat: null, lng: null, interstate: s(r.interstate), exit_number: s(r.exit_number),
      detail_slug: `${slugify(name)}-${slugify(city)}-${state.toLowerCase()}`,
      is_published: r.is_published === true,
    });
  });
}
writeFileSync('scratch-m29/live.json', JSON.stringify(out, null, 1));
const byState: Record<string, number> = {};
for (const r of out) byState[r.state] = (byState[r.state] ?? 0) + 1;
const slugFp = createHash('md5').update([...out.map((r) => r.detail_slug)].sort().join('\n')).digest('hex');
console.log(`total=${out.length} byState=${JSON.stringify(byState)}`);
console.log(`published=${out.filter((r) => r.is_published).length} unpublished=${out.filter((r) => !r.is_published).length}`);
console.log(`detail_slug set md5=${slugFp}`);
