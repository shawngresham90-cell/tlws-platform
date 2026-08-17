/**
 * Directory complete-read pagination (2026-07-30 / hardened 2026-07-31).
 *
 * Several directory reads asked for a fixed `.limit(...)` with NO ORDER BY and
 * treated the answer as the whole dataset. A LIMIT without an ORDER BY lets
 * Postgres return ANY subset, so those reads were a *sample*:
 *
 *   - selectEntries capped at 1,000 against a category holding 1,882 published
 *     rows and an unfiltered (sitemap) read of 2,454 — ALREADY truncating
 *   - getDirectoryFacets capped at 5,000 and the map at 2,000, both unordered
 *     — NOT binding at 2,454 published rows, so they are latent rather than
 *     active defects. They do NOT explain the /directory/i75/exit-369 cached
 *     404 — and neither does #215's empty-vs-error contract, which shipped
 *     while the 404 persisted. That cause is still unidentified.
 *
 * A truncated read is neither an error nor an empty result, so the empty-vs-
 * error contract from the false-404 fix cannot detect it.
 *
 * THE TERMINAL CONDITION IS THE POINT. `batch.length < pageSize` proves
 * nothing on its own: a backend that caps rows server-side returns a short
 * page while more data exists. A scan therefore ends in exactly two ways —
 * a request positioned after the last row returns EMPTY, or a short page is
 * CORROBORATED by the database's own exact count over the same filtered set,
 * returned with the first page. A server-side cap can satisfy neither, and
 * with no count available only the first is reachable.
 *
 * Run:
 *   npx esbuild scripts/test-directory-complete-read.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-directory-complete-read.cjs \
 *   && node /tmp/test-directory-complete-read.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  collectAllRows,
  isDirectoryBuildPhase,
  __resetBuildReadMemo,
  __buildReadMemoSize,
  __buildReadStats,
  __memoizeDuringBuildForTest,
  DIRECTORY_PAGE_SIZE,
  DIRECTORY_MAX_PAGES,
} from '@/lib/directory/data';
import {
  exitSlug,
  exitFromSlug,
  interstateBySlug,
  interstateSlug,
} from '@/lib/directory/interstates';
import {
  parseExitPosition,
  resolveRoutePosition,
  PARKING_CATEGORIES,
} from '@/lib/directory/corridor';

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
const dataSrc = read('src/lib/directory/data.ts');
const dataCode = strip(dataSrc);

/* ------------------------------------------------------- synthetic pool */

type Row = { id: string; name: string; featured: boolean };
const idFor = (i: number) => `row-${String(i).padStart(6, '0')}`;
const makePool = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    id: idFor(i),
    name: `Stop ${String(i).padStart(6, '0')}`,
    featured: i % 97 === 0,
  }));

type FetchOpts = {
  failOnPage?: number;
  failLastPage?: boolean;
  serverCap?: number;
  growTo?: number;
};

function fetcherFor(pool: Row[], opts: FetchOpts = {}) {
  let sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id));
  let calls = 0;
  const totalPages = Math.ceil(sorted.length / DIRECTORY_PAGE_SIZE) + 1;
  return async (afterId: string | null, pageSize: number) => {
    calls++;
    if (opts.failOnPage === calls) return { rows: [], error: { code: 'PGRST500' } };
    if (opts.failLastPage && calls === totalPages) return { rows: [], error: { code: 'PGRST500' } };
    if (opts.growTo && calls === 2) {
      sorted = [...makePool(opts.growTo)].sort((a, b) => a.id.localeCompare(b.id));
    }
    const start = afterId === null ? 0 : sorted.findIndex((r) => r.id > afterId);
    if (start < 0) return { rows: [] };
    const take = opts.serverCap ? Math.min(pageSize, opts.serverCap) : pageSize;
    return { rows: sorted.slice(start, start + take) };
  };
}
const idsOf = (rows: Row[]) => rows.map((r) => r.id);

/** Same fetcher, with the request count exposed — round trips are the cost. */
function counting(pool: Row[], opts: FetchOpts = {}) {
  const inner = fetcherFor(pool, opts);
  const state = { calls: 0 };
  const fetch = async (afterId: string | null, pageSize: number) => {
    state.calls++;
    return inner(afterId, pageSize);
  };
  return { fetch, state };
}

async function main() {
  /* ------------- OBJECTIVE 12: sizes spanning every old cap boundary ---- */

  // 1000 = old selectEntries cap; 1882 = largest live category; 1940 = live
  // map pool; 2000 = old map cap; 2454 = published total; 5000 = old facet cap.
  const SIZES = [
    0, 1, 499, 500, 501, 999, 1000, 1001, 1882, 1940, 1999, 2000, 2001, 2454, 3000, 5000,
  ];
  for (const n of SIZES) {
    const pool = makePool(n);
    const res = await collectAllRows(fetcherFor(pool), n);
    check(`pool of ${n}: scan succeeds`, res.ok === true, res.ok ? '' : res);
    if (!res.ok) continue;
    check(`pool of ${n}: every row returned`, res.data.length === n, res.data.length);
    check(`pool of ${n}: no duplicate ids`, new Set(idsOf(res.data)).size === n);
    check(`pool of ${n}: no skipped ids`, idsOf(res.data).join(',') === idsOf(pool).join(','));
    check(
      `pool of ${n}: strictly increasing cursor`,
      res.data.every((r, i) => i === 0 || r.id > res.data[i - 1].id),
    );
  }

  // Headline regressions, named.
  const cat = await collectAllRows(fetcherFor(makePool(1882)), 1882);
  check(
    '1,882-row category loads completely (old cap dropped 882)',
    cat.ok && cat.data.length === 1882,
  );
  check(
    'the 1,001st row of that category is present',
    cat.ok && cat.data.some((r) => r.id === idFor(1000)),
  );
  const all = await collectAllRows(fetcherFor(makePool(2454)), 2454);
  check('all 2,454 published rows load (sitemap set)', all.ok && all.data.length === 2454);
  const map2001 = await collectAllRows(fetcherFor(makePool(2001)), 2001);
  check('map pool of 2,001 loads (old cap was 2,000)', map2001.ok && map2001.data.length === 2001);
  const map3000 = await collectAllRows(fetcherFor(makePool(3000)), 3000);
  check('map pool of 3,000 loads', map3000.ok && map3000.data.length === 3000);
  const map5000 = await collectAllRows(fetcherFor(makePool(5000)), 5000);
  check('map pool of 5,000 loads', map5000.ok && map5000.data.length === 5000);

  /* ------------------------- page mechanics + terminal condition -------- */

  const boundary = await collectAllRows(fetcherFor(makePool(DIRECTORY_PAGE_SIZE * 3)), 1500);
  check(
    'a pool ending exactly on a page boundary is complete',
    boundary.ok && boundary.data.length === 1500,
  );
  const partial = await collectAllRows(fetcherFor(makePool(1007)), 1007);
  check('a short final page is returned in full', partial.ok && partial.data.length === 1007);
  const small = await collectAllRows(fetcherFor(makePool(3)), 3, { pageSize: 10 });
  check('a pool smaller than one page works', small.ok && small.data.length === 3);
  const emptyTerminal = await collectAllRows(fetcherFor(makePool(0)), 0);
  check(
    'an empty terminal page yields an empty complete set',
    emptyTerminal.ok && emptyTerminal.data.length === 0,
  );

  check(
    'a verified EMPTY page is a terminal condition',
    /if \(batch\.length === 0\)/.test(dataCode),
  );
  // Pinned as an exact shape rather than "this substring is absent": the short
  // page must open a branch whose ONLY exit is corroboration by the separately
  // measured count. Any bare `return`/`break` under a short page fails this.
  check(
    'a short page ALONE never terminates the scan',
    /if \(batch\.length < pageSize\) \{\s*const floor = await expectedCount\(\);\s*if \(floor !== null && rows\.length >= floor\) return \{ ok: true, data: rows \};\s*\}/.test(
      dataCode,
    ),
  );

  /* ---- the count runs CONCURRENTLY with the first page, not before it ---- */

  {
    const order: string[] = [];
    const pending = new Promise<number | null>((resolve) =>
      setTimeout(() => {
        order.push('count');
        resolve(11);
      }, 15),
    );
    const inner = fetcherFor(makePool(11));
    const scan = await collectAllRows(async (afterId, pageSize) => {
      order.push('page');
      return inner(afterId, pageSize);
    }, pending);
    check('the first page is issued BEFORE the count resolves', order[0] === 'page', order);
    check('an in-flight count still proves completeness', scan.ok && scan.data.length === 11);
    check('the count is still consumed, not ignored', order.includes('count'));
  }
  // Scoped to the completeness floors (they alone name the error `countError`);
  // getCatScalePublishedCount is a standalone count with no scan to overlap.
  check(
    'no completeness read awaits its count before starting the scan',
    !/error: countError \} = await/.test(dataCode),
  );

  /* ------- OBJECTIVE 4/5: the corroborated stop costs one less round trip -- */

  // The build performs ~1,700 scans, most of them a single short page (an exit
  // holds a handful of rows). Confirming each with an extra empty-page request
  // was ~1,700 round trips of pure overhead on every build.
  {
    const c1 = counting(makePool(2454));
    const r1 = await collectAllRows(c1.fetch, 2454);
    check('2,454 rows with a count: complete', r1.ok && r1.data.length === 2454);
    check(
      '2,454 rows with a count: 5 requests, no confirming page',
      c1.state.calls === 5,
      c1.state,
    );

    const c2 = counting(makePool(2454));
    const r2 = await collectAllRows(c2.fetch, null);
    check('2,454 rows with NO count: complete', r2.ok && r2.data.length === 2454);
    check('2,454 rows with NO count: pays the confirming page', c2.state.calls === 6, c2.state);

    // The shape that dominates the build: one exit, a handful of rows.
    const c3 = counting(makePool(11));
    const r3 = await collectAllRows(c3.fetch, 11);
    check('an 11-row exit read with a count: complete', r3.ok && r3.data.length === 11);
    check('an 11-row exit read with a count: ONE request', c3.state.calls === 1, c3.state);

    const c4 = counting(makePool(11));
    const r4 = await collectAllRows(c4.fetch, null);
    check('an 11-row exit read with NO count: two requests', c4.state.calls === 2, c4.state);

    // A server cap must NOT be able to satisfy the corroborated stop.
    const c5 = counting(makePool(2454), { serverCap: 100 });
    const r5 = await collectAllRows(c5.fetch, 2454);
    check(
      'a server cap cannot trigger the corroborated stop early',
      r5.ok && r5.data.length === 2454 && c5.state.calls >= 25,
      c5.state,
    );

    // Count says MORE than the pool holds: the short page must not end it.
    const c6 = counting(makePool(2454));
    const r6 = await collectAllRows(c6.fetch, 3000);
    check(
      'a short page with an unmet count keeps scanning, then fails short_pool',
      !r6.ok && r6.reason === 'short_pool',
      r6,
    );
    check('the unmet-count scan paid for a verified empty page', c6.state.calls === 6, c6.state);
  }

  /* ------------------------- OBJECTIVE 1: backend cap cannot fake the end */

  // Every page comes back short while more data exists. Under the OLD rule
  // this looked like a clean last page. It must now be impossible.
  const cappedWithCount = await collectAllRows(
    fetcherFor(makePool(2454), { serverCap: 100 }),
    2454,
  );
  check(
    'server cap below page size still returns the COMPLETE set',
    cappedWithCount.ok && cappedWithCount.data.length === 2454,
  );

  // The decisive case: same cap, NO count available. The old implementation
  // returned 100 rows and called it success.
  const cappedNoCount = await collectAllRows(fetcherFor(makePool(2454), { serverCap: 100 }), null);
  check(
    'server cap with NO count still returns the complete set (not 100 rows)',
    cappedNoCount.ok && cappedNoCount.data.length === 2454,
    cappedNoCount.ok ? cappedNoCount.data.length : cappedNoCount,
  );
  check(
    'a short page can never terminate the scan',
    cappedNoCount.ok && cappedNoCount.data.length > 100,
  );

  const cappedTiny = await collectAllRows(fetcherFor(makePool(1001), { serverCap: 1 }), 1001, {
    maxPages: 2000,
  });
  check(
    'a 1-row server cap still walks the entire set',
    cappedTiny.ok && cappedTiny.data.length === 1001,
  );

  /* --------------------------- OBJECTIVE 12: failure modes --------------- */

  const firstFail = await collectAllRows(fetcherFor(makePool(2454), { failOnPage: 1 }), 2454);
  check('first-page failure fails closed', !firstFail.ok && firstFail.reason === 'query_error');
  check('first-page failure yields no data', !firstFail.ok && !('data' in firstFail));

  const midFail = await collectAllRows(fetcherFor(makePool(2454), { failOnPage: 3 }), 2454);
  check('middle-page failure fails closed', !midFail.ok && midFail.reason === 'query_error');
  check('middle-page failure yields no partial pool', !midFail.ok && !('data' in midFail));

  // With a count in hand the confirming page is never requested, so the
  // last-page failure is exercised on the uncounted path — the one that still
  // has to reach a verified empty page.
  const lastFail = await collectAllRows(fetcherFor(makePool(1200), { failLastPage: true }), null);
  check(
    'confirming-page failure fails closed (no count available)',
    !lastFail.ok && lastFail.reason === 'query_error',
    lastFail,
  );
  check('confirming-page failure yields no partial pool', !lastFail.ok && !('data' in lastFail));
  // And the counted path must still fail closed when its FINAL data page dies.
  const lastDataFail = await collectAllRows(fetcherFor(makePool(1200), { failOnPage: 3 }), 1200);
  check(
    'final DATA page failure fails closed even with a count',
    !lastDataFail.ok && lastDataFail.reason === 'query_error',
    lastDataFail,
  );

  const stuck = await collectAllRows(async (_a, pageSize) => ({ rows: makePool(pageSize) }), null, {
    pageSize: 10,
    maxPages: 5,
  });
  check('a cursor that does not advance is stopped', !stuck.ok && stuck.reason === 'no_progress');

  const runaway = await collectAllRows(fetcherFor(makePool(1000)), null, {
    pageSize: 10,
    maxPages: 3,
  });
  check(
    'runaway page guard fails, never quietly stops',
    !runaway.ok && runaway.reason === 'page_cap',
  );

  // Expected-count mismatch: the scan genuinely lost rows.
  const short = await collectAllRows(fetcherFor(makePool(900)), 2454);
  check('expected-count mismatch is refused', !short.ok && short.reason === 'short_pool');
  check('expected-count mismatch returns no data', !short.ok && !('data' in short));

  const grew = await collectAllRows(fetcherFor(makePool(1200), { growTo: 1500 }), 1200);
  check(
    'a pool that GREW mid-scan still succeeds (count is a floor)',
    grew.ok && grew.data.length >= 1200,
  );

  const noCount = await collectAllRows(fetcherFor(makePool(2454)), null);
  check('count-unavailable remains a supported mode', noCount.ok && noCount.data.length === 2454);

  /* ------------------- OBJECTIVE 3: build-phase memoization -------------- */

  const savedPhase = process.env.NEXT_PHASE;
  try {
    delete process.env.NEXT_PHASE;
    __resetBuildReadMemo();
    check('memo is INERT at runtime (no build phase)', isDirectoryBuildPhase() === false);
    check('runtime performs no memo bookkeeping', __buildReadMemoSize() === 0);

    process.env.NEXT_PHASE = 'phase-production-build';
    check('memo is ACTIVE during a production build', isDirectoryBuildPhase() === true);

    process.env.NEXT_PHASE = 'phase-production-server';
    check('a production SERVER phase does not enable the memo', isDirectoryBuildPhase() === false);
    process.env.NEXT_PHASE = 'phase-development-server';
    check('a development server does not enable the memo', isDirectoryBuildPhase() === false);
  } finally {
    if (savedPhase === undefined) delete process.env.NEXT_PHASE;
    else process.env.NEXT_PHASE = savedPhase;
    __resetBuildReadMemo();
  }

  check(
    'the memo is gated on the build phase constant only',
    /NEXT_PHASE === BUILD_PHASE/.test(dataCode) &&
      /const BUILD_PHASE = 'phase-production-build'/.test(dataCode),
  );
  check(
    'the memo stores promises so concurrent renders share one scan',
    /buildReadMemo\.set\(key, pending\)/.test(dataCode),
  );
  check(
    'a failed read is evicted, never memoized for the build',
    /buildReadMemo\.delete\(key\)/.test(dataCode),
  );
  check(
    'all five completeness reads are memoized under a stable memo key',
    (dataCode.match(/memoizeDuringBuild\(\s*memoKey\(/g) ?? []).length === 5 &&
      (dataCode.match(/function memoizeDuringBuild<T>/g) ?? []).length === 1,
  );
  check(
    'nothing calls the memo except those five reads and the test seam',
    (dataCode.match(/memoizeDuringBuild\(/g) ?? []).length === 6 &&
      /export function __memoizeDuringBuildForTest/.test(dataCode),
  );
  /* --------- OBJECTIVE 4: read amplification, measured behaviorally ------ */

  // The static build asks for the same complete reads thousands of times: an
  // exit page resolves facets three times (metadata, page guard, page body)
  // and there are 1,292 exit pages. Measured on a production-shaped build:
  // 25,765 complete-read calls collapsed to 1,681 scans (facets 8,283 -> 4,
  // one per static-generation worker process). These checks pin the mechanism
  // that produced that collapse.
  {
    const savedAmpPhase = process.env.NEXT_PHASE;
    try {
      process.env.NEXT_PHASE = 'phase-production-build';
      __resetBuildReadMemo();
      let scans = 0;
      const run = async () => {
        scans++;
        return { ok: true as const, data: [] };
      };
      // 3 calls per exit page x 1,292 exit pages: the real facet call volume.
      await Promise.all(
        Array.from({ length: 1292 * 3 }, () => __memoizeDuringBuildForTest('facets', run)),
      );
      check('build-phase: 3,876 facet calls collapse to ONE scan', scans === 1, scans);
      const stats = __buildReadStats();
      check('build-phase: every call is counted', stats.calls === 3876, stats);
      check('build-phase: exactly one scan is counted', stats.scans === 1, stats);
      check('build-phase: memo holds one entry per distinct read', __buildReadMemoSize() === 1);

      // Distinct keys must NOT collapse — per-exit reads are genuinely different.
      __resetBuildReadMemo();
      let distinctScans = 0;
      const runDistinct = async () => {
        distinctScans++;
        return { ok: true as const, data: [] };
      };
      await Promise.all(
        Array.from({ length: 200 }, (_, i) =>
          __memoizeDuringBuildForTest(`entries?exit=${i % 50}`, runDistinct),
        ),
      );
      check('build-phase: 200 calls over 50 keys scan exactly 50 times', distinctScans === 50);
      check('build-phase: memo holds one entry per key', __buildReadMemoSize() === 50);

      // A failed read must be re-attempted, never served from the memo.
      __resetBuildReadMemo();
      let failScans = 0;
      const runFail = async () => {
        failScans++;
        return { ok: false as const, reason: 'query_error' as const };
      };
      await __memoizeDuringBuildForTest('facets', runFail);
      await __memoizeDuringBuildForTest('facets', runFail);
      check('build-phase: a failed read is never reused from the memo', failScans === 2, failScans);
      check('build-phase: a failed read leaves no memo entry', __buildReadMemoSize() === 0);

      // At runtime the memo must be completely absent: N calls, N scans.
      delete process.env.NEXT_PHASE;
      __resetBuildReadMemo();
      let runtimeScans = 0;
      const runRuntime = async () => {
        runtimeScans++;
        return { ok: true as const, data: [] };
      };
      await Promise.all(
        Array.from({ length: 25 }, () => __memoizeDuringBuildForTest('facets', runRuntime)),
      );
      check('runtime: every call performs its own read (no caching)', runtimeScans === 25);
      check('runtime: nothing is retained between calls', __buildReadMemoSize() === 0);
      const runtimeStats = __buildReadStats();
      check(
        'runtime: calls and scans are equal',
        runtimeStats.calls === 25 && runtimeStats.scans === 25,
        runtimeStats,
      );
    } finally {
      if (savedAmpPhase === undefined) delete process.env.NEXT_PHASE;
      else process.env.NEXT_PHASE = savedAmpPhase;
      __resetBuildReadMemo();
    }
  }
  check(
    'amplification counters are integers only — never logged, never emitted',
    /let buildReadCalls = 0/.test(dataCode) &&
      /let buildReadScans = 0/.test(dataCode) &&
      !/console\.[a-z]+\([^)]*buildRead/.test(dataCode),
  );

  check('no revalidate policy is touched by the data layer', !/revalidate/.test(dataCode));
  check(
    'no unstable_cache / next cache primitive was introduced',
    !/unstable_cache|revalidateTag|next\/cache/.test(dataSrc),
  );

  /* --------------- OBJECTIVE 2: count/page filter parity ---------------- */

  // Parity used to be an audit obligation: two queries, written adjacently,
  // asserted to carry identical filters. It is now STRUCTURAL — the exact
  // count is requested on the page query itself, so there is no second query
  // to drift. These checks pin that property rather than the old duplication.
  check(
    'every completeness read takes its exact count ON the page query',
    (dataCode.match(/afterId === null \? \{ count: 'exact' \} : undefined/g) ?? []).length === 5,
  );
  check(
    'the count is never requested with a cursor applied (it would count the remainder)',
    !/gt\('id', afterId\)[\s\S]{0,200}count: 'exact'/.test(dataCode),
  );
  check(
    'no completeness read issues a separate head-count query',
    (dataCode.match(/count: 'exact', head: true/g) ?? []).length === 1,
  );
  check(
    'the surviving head-count is the standalone CAT Scale total, not a floor',
    /getCatScalePublishedCount[\s\S]{0,400}count: 'exact', head: true/.test(dataCode),
  );
  check(
    'the scan prefers the total the database reported on the first page',
    /if \(pages === 1 && typeof page\.total === 'number'\) reported = page\.total;/.test(
      dataCode,
    ) && /if \(reported !== null\) return reported;/.test(dataCode),
  );
  check(
    'the total is read from the query result, never derived from the batch',
    (dataCode.match(/total: typeof count === 'number' \? count : undefined/g) ?? []).length === 5 &&
      !/total: (rows|batch|data)\.length/.test(dataCode),
  );
  check(
    'published + soft-delete filters still guard every read',
    (dataCode.match(/\.eq\('is_published', true\)/g) ?? []).length >= 5 &&
      (dataCode.match(/\.is\('deleted_at', null\)/g) ?? []).length >= 5,
  );
  check(
    'map read still requires lat AND lng',
    /\.not\('lat', 'is', null\)/.test(dataCode) && /\.not\('lng', 'is', null\)/.test(dataCode),
  );
  check(
    'map read still applies its optional category / state / interstate filters ' +
      '(interstate now canonically: superset query + in-memory canonical match)',
    /filters\.category\) q = q\.eq\('category_slug'/.test(dataCode) &&
      /filters\.state\) q = q\.eq\('state', filters\.state\.toUpperCase\(\)\)/.test(dataCode) &&
      /q\.eq\('interstate', filters\.interstate\)/.test(dataCode) &&
      /canonicalDesignation\(row\.interstate\) === canonicalHwy/.test(dataCode),
  );
  check(
    'detail-slug read still requires detail_slug NOT NULL',
    /\.not\('detail_slug', 'is', null\)/.test(dataCode),
  );
  check(
    'route-facet read still applies its category set',
    /\.in\('category_slug', categories\)/.test(dataCode),
  );
  check(
    'entry read still applies every caller filter (canonical interstate/exit filters ' +
      'apply as superset query + in-memory canonical match; all others stay eq)',
    /for \(const \[column, value\] of serverFilters\) q = q\.eq\(column, value\)/.test(dataCode) &&
      /canonicalHwy \|\| canonicalExit/.test(dataCode),
  );

  /* ---------------- category C caps gone / A+B caps kept ---------------- */

  check('no .limit(5000) remains in the data layer', !/\.limit\(5000\)/.test(dataCode));
  check('no .limit(2000) remains in the data layer', !/\.limit\(2000\)/.test(dataCode));
  check(
    'every complete read pages by primary key',
    (dataCode.match(/\.gt\('id', afterId\)/g) ?? []).length === 5,
  );
  check(
    'every complete read orders deterministically',
    (dataCode.match(/\.order\('id', \{ ascending: true \}\)/g) ?? []).length === 5,
  );
  check(
    'presentation cap kept: recently-updated max 200',
    /Math\.min\(Math\.max\(limit, 1\), 200\)/.test(dataCode),
  );
  check(
    'presentation cap kept: newest-listings .range paging',
    /\.range\(from, to\)/.test(dataCode),
  );
  check('safety cap kept: corridor entries .limit(1000)', /\.limit\(1000\)/.test(dataCode));
  check('safety cap kept: CAT Scale map .limit(3000)', /\.limit\(3000\)/.test(dataCode));
  check('single-row lookup kept', /\.limit\(1\)/.test(dataCode));

  /* ------------- OBJECTIVE 6: Exit 369 through the generic path --------- */

  const knownExits = ['201', '369', '369A', '60'];
  check('i75 resolves to the I-75 corridor', interstateBySlug('i75')?.designation === 'I-75');
  check('Exit 369 resolves from its slug', exitFromSlug('exit-369', knownExits) === '369');
  check('Exit 369 slug round-trips', exitSlug('369') === 'exit-369');
  check(
    'Exit 369 URL is /directory/i75/exit-369',
    `/directory/${interstateSlug('I-75')}/${exitSlug('369')}` === '/directory/i75/exit-369',
  );
  check('Exit 201 control resolves', exitFromSlug('exit-201', knownExits) === '201');
  check(
    '369A does NOT collide with 369',
    exitSlug('369A') === 'exit-369a' && exitFromSlug('exit-369a', knownExits) === '369A',
  );
  check(
    'an exit absent from the facets stays unresolvable',
    exitFromSlug('exit-999', knownExits) === undefined,
  );
  check(
    'an exit number is never treated as a mile marker',
    resolveRoutePosition({ mileMarker: undefined, exitNumber: '369' })?.positionKind === 'exit',
  );
  check(
    'a verified mile marker is still labeled MM',
    resolveRoutePosition({ mileMarker: 71.5, exitNumber: '369' })?.positionKind === 'mile-marker',
  );
  check(
    'strict exit parser unchanged',
    parseExitPosition('369') === 369 && parseExitPosition('11/I-49, Exit 39') === null,
  );
  // Exit 369 may be NAMED in comments — it is the defect this work came from.
  // What must not exist is EXECUTABLE code that branches on it.
  const exit369CodeHits = (() => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (/\.(ts|tsx)$/.test(e.name) && /['"`]369['"`]|exit-369/.test(strip(read(rel)))) {
          hits.push(rel);
        }
      }
    };
    walk('src');
    return hits;
  })();
  check(
    'no Exit-369-specific branch exists in executable src',
    exit369CodeHits.length === 0,
    exit369CodeHits,
  );

  /* ------------- OBJECTIVE 7/9: facet + sitemap shape from a full set ---- */

  // Reproduce the facet reducer over a production-shaped 2,454-row set that
  // includes the 11 real I-75 / 369 rows, and prove they survive the scan.
  type FacetRow = {
    id: string;
    state: string;
    interstate: string | null;
    exit_number: string | null;
  };
  const facetPool: FacetRow[] = Array.from({ length: 2454 }, (_, i) => ({
    id: idFor(i),
    state: i % 2 ? 'GA' : 'TN',
    interstate: i % 3 === 0 ? 'I-75' : i % 3 === 1 ? 'I-95' : null,
    exit_number: i % 3 === 0 ? String(100 + (i % 400)) : null,
  }));
  // Force the 11 Exit 369 rows to the END of the id order — the position an
  // arbitrary first-1,000 sample would have dropped them from.
  for (let k = 0; k < 11; k++) {
    facetPool[2454 - 1 - k] = {
      id: idFor(2454 - 1 - k),
      state: 'TN',
      interstate: 'I-75',
      exit_number: '369',
    };
  }
  const facetSorted = [...facetPool].sort((a, b) => a.id.localeCompare(b.id));
  let fcalls = 0;
  const facetScan = await collectAllRows<FacetRow>(async (afterId, pageSize) => {
    fcalls++;
    const start = afterId === null ? 0 : facetSorted.findIndex((r) => r.id > afterId);
    if (start < 0) return { rows: [] };
    return { rows: facetSorted.slice(start, start + pageSize) };
  }, facetPool.length);
  check('production-shaped facet scan is complete', facetScan.ok && facetScan.data.length === 2454);

  if (facetScan.ok) {
    const exits = new Map<string, Set<string>>();
    const states = new Set<string>();
    for (const r of facetScan.data) {
      const st = r.state?.trim().toUpperCase();
      if (st) states.add(st);
      const hwy = r.interstate?.trim();
      if (!hwy) continue;
      const ex = r.exit_number?.trim();
      if (!ex) continue;
      if (!exits.has(hwy)) exits.set(hwy, new Set());
      exits.get(hwy)!.add(ex);
    }
    const i75 = exits.get('I-75') ?? new Set<string>();
    check('Exit 369 IS in the facet set even at the far end of the scan', i75.has('369'));
    check('Exit 201-shaped control is in the facet set', i75.size > 1);
    check('facet states survive the complete scan', states.size === 2);

    // Sitemap URL shape from those facets: no duplicates, correct slugs.
    const urls: string[] = [];
    for (const [hwy, set] of exits) {
      const slug = interstateSlug(hwy);
      if (!slug) continue;
      for (const ex of set) urls.push(`/directory/${slug}/${exitSlug(ex)}`);
    }
    check('sitemap exit URLs contain Exit 369', urls.includes('/directory/i75/exit-369'));
    check('sitemap exit URLs have no duplicates', new Set(urls).size === urls.length);
    check(
      'sitemap exit URLs are all well-formed',
      urls.every((u) => /^\/directory\/i\d{1,3}\/exit-[a-z0-9-]+$/.test(u)),
    );
  }

  // >1,000 detail URLs must survive (old cap was 1,000).
  const slugPool = Array.from({ length: 2454 }, (_, i) => ({
    id: idFor(i),
    detail_slug: `loc-${i}`,
  }));
  const slugSorted = [...slugPool].sort((a, b) => a.id.localeCompare(b.id));
  const slugScan = await collectAllRows<{ id: string; detail_slug: string }>(
    async (afterId, pageSize) => {
      const start = afterId === null ? 0 : slugSorted.findIndex((r) => r.id > afterId);
      if (start < 0) return { rows: [] };
      return { rows: slugSorted.slice(start, start + pageSize) };
    },
    slugPool.length,
  );
  check(
    'sitemap detail slugs exceed the old 1,000 cap',
    slugScan.ok && slugScan.data.length === 2454,
  );
  check(
    'sitemap detail slugs have no duplicates',
    slugScan.ok && new Set(slugScan.data.map((r) => r.detail_slug)).size === 2454,
  );

  /* ------------------ sitemap policy must NOT have changed --------------- */

  const sitemapSrc = read('src/lib/seo/sitemap-entries.ts');
  check(
    'sitemap still gates detail URLs on indexability',
    /isDetailIndexable\(entry\)/.test(sitemapSrc),
  );
  check(
    'sitemap still only walks published entries',
    /getAllPublishedEntries\(\)/.test(sitemapSrc),
  );
  check(
    'sitemap did not gain an unpublished source',
    !/is_published.*false|includeUnpublished/.test(sitemapSrc),
  );

  /* ---------------------- presentation order preserved ------------------- */

  const scan = await collectAllRows(fetcherFor(makePool(2454)), 2454);
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
      'name order ascends within each block',
      sorted.every(
        (r, i) => i === 0 || sorted[i - 1].featured !== r.featured || sorted[i - 1].name <= r.name,
      ),
    );
    check('ordering is applied to the COMPLETE set', sorted.length === 2454);
  }
  check(
    'presentation order is restored after paging, not requested from the DB',
    /Number\(b\.featured\) - Number\(a\.featured\) \|\| a\.name\.localeCompare\(b\.name\)/.test(
      dataCode,
    ),
  );

  /* ---------------------------- guards + hygiene ------------------------- */

  check('page size stays under any conventional server cap', DIRECTORY_PAGE_SIZE <= 1000);
  check(
    'runaway guard is far beyond directory size',
    DIRECTORY_PAGE_SIZE * DIRECTORY_MAX_PAGES >= 30000,
  );
  check(
    'parking categories unchanged',
    PARKING_CATEGORIES.join(',') === 'parking,truck-stops,rest-areas,hotels-truck-parking',
  );
  check(
    'facet normalization canonical (state upper; exits via shared canonicalizer)',
    /r\.state\?\.trim\(\)\.toUpperCase\(\)/.test(dataCode) &&
      /canonicalExitNumber\(r\.exit_number\)/.test(dataCode),
  );
  check(
    'numeric-aware exit sort unchanged',
    /localeCompare\(b, undefined, \{ numeric: true \}\)/.test(dataCode),
  );
  check(
    'no filter loosened beyond the paired canonical-interstate superset',
    !/\.or\(|\.neq\('is_published'/.test(dataCode) && !/\.ilike\((?!'interstate')/.test(dataCode),
  );
  check(
    'no credential or env value is read in the data layer',
    !/process\.env\.(?!NEXT_PHASE)/.test(dataCode),
  );
  check(
    'failure logging still exposes only safe fields',
    !/error\.message|error\.details|error\.hint/.test(dataCode),
  );
  check(
    'the #215 empty-vs-error contract is intact',
    /DirectoryReadResult/.test(dataCode) && /unwrapDirectoryRead/.test(dataCode),
  );

  /* -------- UNIFICATION ADDENDUM: audit-mandated cases (2026-08-04) ----- */

  // Server caps of 500 and 1000 rows. DIRECTORY_PAGE_SIZE is 500, so these
  // caps only bind when the scan asks for MORE than the cap per page — run
  // with pageSize 1500 so every page comes back short while data remains.
  // The guarantee under test is the same as the cap-100 case: a short page
  // proves nothing, and the scan still retrieves everything.
  for (const cap of [500, 1000]) {
    const withCount = await collectAllRows(fetcherFor(makePool(2454), { serverCap: cap }), 2454, {
      pageSize: 1500,
    });
    check(
      `server cap ${cap} with a count: complete anyway`,
      withCount.ok && withCount.data.length === 2454,
      withCount.ok ? withCount.data.length : withCount,
    );
    const noCount = await collectAllRows(fetcherFor(makePool(2454), { serverCap: cap }), null, {
      pageSize: 1500,
    });
    check(
      `server cap ${cap} with NO count: complete anyway (verified empty page)`,
      noCount.ok && noCount.data.length === 2454,
      noCount.ok ? noCount.data.length : noCount,
    );
  }

  // Rows REMOVED during the scan. The count was measured before the rows
  // vanished, so the floor check must refuse the pool — a deletion mid-scan
  // is indistinguishable from silent loss, and ISR retries shortly anyway.
  {
    let sorted = [...makePool(2454)].sort((a, b) => a.id.localeCompare(b.id));
    let calls = 0;
    const shrinking = async (afterId: string | null, pageSize: number) => {
      calls++;
      if (calls === 2) sorted = sorted.slice(0, 1200); // 1,254 rows deleted mid-scan
      const start = afterId === null ? 0 : sorted.findIndex((r) => r.id > afterId);
      if (start < 0) return { rows: [] };
      return { rows: sorted.slice(start, start + pageSize) };
    };
    const res = await collectAllRows(shrinking, 2454);
    check(
      'rows removed during scan: refused as short_pool, never a silent subset',
      !res.ok && res.reason === 'short_pool',
      res,
    );
  }

  // Memo eviction on a THROWN read (the ok:false path was already covered).
  {
    const savedPhase2 = process.env.NEXT_PHASE;
    try {
      process.env.NEXT_PHASE = 'phase-production-build';
      __resetBuildReadMemo();
      let runs = 0;
      const boom = () => {
        runs++;
        return Promise.reject(new Error('transient'));
      };
      await __memoizeDuringBuildForTest('throwing-read', boom).catch(() => undefined);
      check('a thrown read is not left in the memo', __buildReadMemoSize() === 0);
      await __memoizeDuringBuildForTest('throwing-read', boom).catch(() => undefined);
      check('the next call after a throw re-runs the read', runs === 2, runs);
    } finally {
      if (savedPhase2 === undefined) delete process.env.NEXT_PHASE;
      else process.env.NEXT_PHASE = savedPhase2;
      __resetBuildReadMemo();
    }
  }

  // The fail-soft reads must carry the Result SHAPE through the memo so the
  // ok===false eviction can actually see a failed scan; the [] / empty-facets
  // fail-soft happens OUTSIDE the memoized function. (Audit 2026-08-04: the
  // original wiring swallowed failure inside, so one transient blip was
  // cached as an empty success for the entire build.)
  check(
    'coords read: Result shape through the memo, fail-soft outside',
    /const result = await memoizeDuringBuild\(memoKey\('coords', filters\)/.test(dataCode) &&
      /async function getEntriesWithCoordinatesUncached[\s\S]{0,220}Promise<DirectoryReadResult</.test(
        dataCode,
      ),
  );
  check(
    'detail-slugs read: Result shape through the memo, fail-soft outside',
    /const result = await memoizeDuringBuild\(memoKey\('detail-slugs'\)/.test(dataCode) &&
      /async function getPublishedDetailSlugsUncached\(\): Promise<DirectoryReadResult</.test(
        dataCode,
      ),
  );
  check(
    'route-facets read: Result shape through the memo, fail-soft outside',
    /getRouteFacetsUncached\(\s*categories: string\[\],?\s*\): Promise<DirectoryReadResult</.test(
      dataCode,
    ) && /result\.ok \? result\.data : \{ states: \[\], interstatesByState: \{\} \}/.test(dataCode),
  );

  // memoKey: only ABSENT values may be dropped — an empty string is still a
  // filter the query applies, so folding it into the unfiltered key would
  // share one memo slot across two different queries. Values are encoded so
  // '&' / '=' in a value cannot masquerade as extra pairs.
  check(
    "memoKey drops only undefined/null — '' stays a distinct key",
    /\.filter\(\(\[, v\]\) => v !== undefined && v !== null\)/.test(dataCode) &&
      !/v !== undefined && v !== null && v !== ''/.test(dataCode),
  );
  check('memoKey encodes keys and values', /encodeURIComponent\(String\(v\)\)/.test(dataCode));

  console.log(`directory-complete-read: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
