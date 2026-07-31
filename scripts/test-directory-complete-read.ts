/**
 * Directory complete-read pagination (2026-07-30).
 *
 * Several directory reads asked for a fixed `.limit(...)` with NO ORDER BY and
 * treated the answer as the whole dataset. A LIMIT without an ORDER BY lets
 * Postgres return ANY subset, so those reads were a *sample*:
 *
 *   - selectEntries capped at 1,000 against a category holding 1,882 published
 *     rows and an unfiltered (sitemap) read of 2,454 — ALREADY truncating
 *   - getDirectoryFacets capped at 5,000, unordered — the facet set drives exit
 *     pages, generateStaticParams and the sitemap, and /directory/i75/exit-369
 *     vanished from all three while 11 published rows existed
 *
 * A truncated read is neither an error nor an empty result, so the empty-vs-
 * error contract from the false-404 fix cannot detect it. These tests pin the
 * completeness contract and prove the presentation order survives paging.
 *
 * Run:
 *   npx esbuild scripts/test-directory-complete-read.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-directory-complete-read.cjs \
 *   && node /tmp/test-directory-complete-read.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { collectAllRows, DIRECTORY_PAGE_SIZE, DIRECTORY_MAX_PAGES } from '@/lib/directory/data';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const dataCode = strip(read('src/lib/directory/data.ts'));

/* ------------------------------------------------------- synthetic pool */

type Row = { id: string; name: string; featured: boolean };
const idFor = (i: number) => `row-${String(i).padStart(6, '0')}`;
const makePool = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    id: idFor(i),
    name: `Stop ${String(i).padStart(6, '0')}`,
    featured: i % 97 === 0,
  }));

function fetcherFor(pool: Row[], opts: { failOnPage?: number; serverCap?: number } = {}) {
  const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id));
  let calls = 0;
  return async (afterId: string | null, pageSize: number) => {
    calls++;
    if (opts.failOnPage === calls) return { rows: [], error: { code: 'PGRST500' } };
    const start = afterId === null ? 0 : sorted.findIndex((r) => r.id > afterId);
    if (start < 0) return { rows: [] };
    const take = opts.serverCap ? Math.min(pageSize, opts.serverCap) : pageSize;
    return { rows: sorted.slice(start, start + take) };
  };
}
const idsOf = (rows: Row[]) => rows.map((r) => r.id);

async function main() {
  /* ------------------------------- sizes spanning every old cap boundary */

  // 1000 = old selectEntries cap; 1882 = largest live category; 2454 =
  // published total; 2000 = old map cap; 5000 = old facet cap.
  for (const n of [0, 1, 499, 500, 501, 999, 1000, 1001, 1882, 1940, 2000, 2454, 3000, 5000]) {
    const pool = makePool(n);
    const res = await collectAllRows(fetcherFor(pool), n);
    check(`pool of ${n}: scan succeeds`, res.ok === true, res.ok ? '' : res);
    if (!res.ok) continue;
    check(`pool of ${n}: every row returned`, res.data.length === n, res.data.length);
    check(`pool of ${n}: no duplicates`, new Set(idsOf(res.data)).size === n);
    check(`pool of ${n}: no skipped rows`, idsOf(res.data).join(',') === idsOf(pool).join(','));
    check(
      `pool of ${n}: strictly ascending key order`,
      res.data.every((r, i) => i === 0 || r.id > res.data[i - 1].id),
    );
  }

  // The headline regressions, called out by name.
  const cat = await collectAllRows(fetcherFor(makePool(1882)), 1882);
  check(
    'a 1,882-row category loads completely (old cap dropped 882)',
    cat.ok && cat.data.length === 1882,
  );
  check(
    'the 1,001st row of a category is present',
    cat.ok && cat.data.some((r) => r.id === idFor(1000)),
  );

  const all = await collectAllRows(fetcherFor(makePool(2454)), 2454);
  check('all 2,454 published rows load (sitemap set)', all.ok && all.data.length === 2454);
  check(
    'the 2,455th-row boundary holds',
    all.ok && all.data[all.data.length - 1].id === idFor(2453),
  );

  const map = await collectAllRows(fetcherFor(makePool(1940)), 1940);
  check('the 1,940-row map pool loads completely', map.ok && map.data.length === 1940);

  /* --------------------------------------------------------- page mechanics */

  const boundary = await collectAllRows(
    fetcherFor(makePool(DIRECTORY_PAGE_SIZE * 3)),
    DIRECTORY_PAGE_SIZE * 3,
  );
  check(
    'a pool ending exactly on a page boundary is complete',
    boundary.ok && boundary.data.length === 1500,
  );

  const partial = await collectAllRows(
    fetcherFor(makePool(DIRECTORY_PAGE_SIZE * 2 + 7)),
    DIRECTORY_PAGE_SIZE * 2 + 7,
  );
  check('a final partial page is returned in full', partial.ok && partial.data.length === 1007);

  const small = await collectAllRows(fetcherFor(makePool(3)), 3, { pageSize: 10 });
  check('a pool smaller than one page works', small.ok && small.data.length === 3);

  /* ---------------------------------------------------------- failure modes */

  const midFail = await collectAllRows(fetcherFor(makePool(2454), { failOnPage: 3 }), 2454);
  check('a failed middle page does NOT return ok', midFail.ok === false);
  check('a failed middle page yields no partial data', !midFail.ok && !('data' in midFail));
  check(
    'a failed middle page reports query_error',
    !midFail.ok && midFail.reason === 'query_error',
  );

  const firstFail = await collectAllRows(fetcherFor(makePool(2454), { failOnPage: 1 }), 2454);
  check('a failed first page fails closed', !firstFail.ok);

  // A server-side row cap below the requested page size: every page comes back
  // short while more data exists. Without the count floor this looks like a
  // clean last page — the original bug wearing a new costume.
  const capped = await collectAllRows(fetcherFor(makePool(2454), { serverCap: 100 }), 2454);
  check('a server-side row cap is caught, not mistaken for the end', !capped.ok, capped);

  // Same cap, but no expected count available: paging must still not silently
  // claim completeness beyond what it saw.
  const cappedNoCount = await collectAllRows(fetcherFor(makePool(2454), { serverCap: 100 }), null);
  check(
    'without a count, a short first page ends the scan (documented limit)',
    cappedNoCount.ok && cappedNoCount.data.length === 100,
  );

  const stuck = await collectAllRows(async (_a, pageSize) => ({ rows: makePool(pageSize) }), null, {
    pageSize: 10,
    maxPages: 5,
  });
  check('a cursor-ignoring fetcher is stopped, not spun on', !stuck.ok);

  const runaway = await collectAllRows(fetcherFor(makePool(1000)), null, {
    pageSize: 10,
    maxPages: 3,
  });
  check('exhausting the page guard is a failure, never a quiet stop', !runaway.ok);

  const grew = await collectAllRows(fetcherFor(makePool(2500)), 2400);
  check(
    'a set that grew mid-scan still succeeds (count is a floor)',
    grew.ok && grew.data.length === 2500,
  );

  /* ------------------------------------------- presentation order preserved */

  // selectEntries pages by id, then restores featured-desc / name-asc. Verify
  // that ordering is a total, deterministic order over the COMPLETE set.
  const pool = makePool(2454);
  const scan = await collectAllRows(fetcherFor(pool), 2454);
  check('order-restore input is complete', scan.ok && scan.data.length === 2454);
  if (scan.ok) {
    const sorted = [...scan.data].sort(
      (a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name),
    );
    check('featured rows sort ahead of unfeatured', sorted[0].featured === true);
    check(
      'featured block is contiguous',
      sorted.findIndex((r) => !r.featured) === sorted.filter((r) => r.featured).length,
    );
    check(
      'within each block, name order is ascending',
      sorted.every(
        (r, i) => i === 0 || sorted[i - 1].featured !== r.featured || sorted[i - 1].name <= r.name,
      ),
    );
    check('re-sorting is stable/idempotent', sorted.length === 2454);
  }

  /* --------------------------------------------- category C caps are gone */

  check(
    'selectEntries no longer caps at 1000',
    !/\.limit\(1000\)[\s\S]{0,40}\n\s*if \(error\)/.test(dataCode),
  );
  check(
    'the facet read no longer caps at 5000',
    !/select\('state, interstate, exit_number'\)[\s\S]{0,200}\.limit\(5000\)/.test(dataCode),
  );
  check(
    'the route-facet read no longer caps at 5000',
    !/select\('state, interstate, category_slug'\)[\s\S]{0,200}\.limit\(5000\)/.test(dataCode),
  );
  check('the map read no longer caps at 2000', !/\.limit\(2000\)/.test(dataCode));
  check(
    'the detail-slug read no longer caps at 5000',
    !/select\('detail_slug, updated_at'\)[\s\S]{0,200}\.limit\(5000\)/.test(dataCode),
  );
  check('no .limit(5000) remains anywhere in the data layer', !/\.limit\(5000\)/.test(dataCode));

  check(
    'every complete read pages by the primary key',
    (dataCode.match(/\.gt\('id', afterId\)/g) ?? []).length === 5,
    (dataCode.match(/\.gt\('id', afterId\)/g) ?? []).length,
  );
  check(
    'every complete read requests a deterministic order',
    (dataCode.match(/\.order\('id', \{ ascending: true \}\)/g) ?? []).length === 5,
  );
  check(
    'every complete read uses the shared collector (5 call sites, 1 definition)',
    (dataCode.match(/await collectAllRows</g) ?? []).length === 5 &&
      (dataCode.match(/export async function collectAllRows</g) ?? []).length === 1,
  );

  /* ------------------------------ category A / B caps deliberately UNCHANGED */

  check(
    'presentation cap kept: recently-updated max 200',
    /Math\.min\(Math\.max\(limit, 1\), 200\)/.test(dataCode),
  );
  check(
    'presentation cap kept: newest-listings pagination via .range',
    /\.range\(from, to\)/.test(dataCode),
  );
  check(
    'single-row lookup kept: detail slug .limit(1)',
    /\.limit\(1\)\s*\n?\s*\.maybeSingle\(\)|\.limit\(1\)/.test(dataCode),
  );
  check('safety cap kept: corridor entries .limit(1000)', /\.limit\(1000\)/.test(dataCode));
  check('safety cap kept: CAT Scale map .limit(3000)', /\.limit\(3000\)/.test(dataCode));

  /* -------------------------------- filters / normalization are UNCHANGED */

  check(
    'published filter still on every read',
    (dataCode.match(/\.eq\('is_published', true\)/g) ?? []).length >= 8,
  );
  check(
    'soft-delete filter still on every read',
    (dataCode.match(/\.is\('deleted_at', null\)/g) ?? []).length >= 8,
  );
  check(
    'facet normalization unchanged (trim+upper state, trim highway/exit)',
    /r\.state\?\.trim\(\)\.toUpperCase\(\)/.test(dataCode) &&
      /r\.interstate\?\.trim\(\)/.test(dataCode) &&
      /r\.exit_number\?\.trim\(\)/.test(dataCode),
  );
  check(
    'exit facets still keyed by interstate with a numeric-aware sort',
    /localeCompare\(b, undefined, \{ numeric: true \}\)/.test(dataCode),
  );
  check(
    'corridor facet still requires the I-nnn shape',
    /\^I-\\d\{1,3\}\$/.test(dataCode) || /\/\^I-\\d\{1,3\}\$\//.test(dataCode),
  );
  check('no filter was loosened', !/\.or\(|\.ilike\(|\.neq\('is_published'/.test(dataCode));
  check(
    'the empty-vs-error contract from the false-404 fix is intact',
    /DirectoryReadResult/.test(dataCode) &&
      /unwrapDirectoryRead/.test(dataCode) &&
      /throwDirectoryUnavailable/.test(dataCode),
  );
  check(
    'failure logging still exposes only safe fields',
    !/error\.message|error\.details|error\.hint|process\.env/.test(dataCode),
  );

  check('page size stays under any conventional server row cap', DIRECTORY_PAGE_SIZE <= 1000);
  check(
    'the runaway guard is far beyond the directory size',
    DIRECTORY_PAGE_SIZE * DIRECTORY_MAX_PAGES >= 30000,
  );
  check(
    'no migration was added for this change',
    !fs.existsSync(path.join(process.cwd(), 'supabase/migrations/051_directory_pagination.sql')),
  );

  console.log(`directory-complete-read: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
