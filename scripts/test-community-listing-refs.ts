/**
 * DIR-COMPLETE-2 — the community listing pickers read EVERY published listing.
 *
 * THE DEFECT THIS FILE EXISTS FOR. getListingRefs() asked PostgREST for
 * `.limit(2000)` ordered by state, city, name, and handed the answer to the
 * pickers on /directory/submit and /directory/reviews as though it were the
 * directory. Production holds 2,454 published, non-deleted rows. So 454 of
 * them were never in the array — and because the order was state-first, the
 * missing rows were not a random sample but the alphabetical tail: every
 * published listing in TX, UT, VA, WA, WI, WV and WY, plus 72 in TN. Measured
 * against the live table on 2026-08-20, not estimated.
 *
 * What a driver in Texas saw was not an error. The read succeeded, the array
 * arrived, the picker filtered it, and the page said:
 *
 *     "No published listing matches …"
 *
 * about a listing that exists and that they were standing in. The failure was
 * indistinguishable from a truthful answer, which is why nothing caught it:
 * no exception, no empty result, no 404 — a complete-looking lie.
 *
 * The second half is latent rather than active: a PostgREST instance
 * configured with a server-side `db-max-rows` returns a SHORT page while more
 * data exists, so it would have truncated this read below 2,000 without
 * changing one observable thing about the response body. Both halves are
 * exercised below, because only one of them is visible in production today.
 *
 * WHAT THIS HARNESS RUNS. The real getListingRefs / getListingRefsResult, the
 * real LocationPicker, the real SubmitLocationForm and ReviewForm, against a
 * PostgREST fake carrying a live-shaped 2,454-row pool. Nothing here
 * re-implements the scan; a test-only copy of the algorithm would pass while
 * the shipped one truncated.
 *
 * Run:
 *   npx esbuild scripts/test-community-listing-refs.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/t.cjs && node /tmp/t.cjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import {
  installPostgrestFake,
  postgrestRequestCount,
  postgrestRequests,
  type FixtureTables,
} from './helpers/postgrest-fake';
import { buildListingFixture, comparePresentation } from './helpers/listing-fixture';
import {
  compareListingRefs,
  getListingRefs,
  getListingRefsResult,
  type ListingRef,
} from '@/lib/community/data';
import { DIRECTORY_PAGE_SIZE, DIRECTORY_MAX_PAGES } from '@/lib/directory/data';
import { LocationPicker } from '@/components/community/LocationPicker';
import { SubmitLocationForm } from '@/components/community/SubmitLocationForm';
import { ReviewForm } from '@/components/community/ReviewForm';

let passed = 0;
let failed = 0;
const seen = new Set<string>();
function check(id: string, name: string, cond: boolean, detail?: unknown) {
  seen.add(id);
  if (cond) passed++;
  else {
    failed++;
    console.log(
      `FAIL: [${id}] ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`,
    );
  }
}

const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const COMMUNITY_SRC = read('src/lib/community/data.ts');
const COMMUNITY = strip(COMMUNITY_SRC);
const PICKER = strip(read('src/components/community/LocationPicker.tsx'));
const SUBMIT_PAGE = strip(read('src/app/(directory)/directory/submit/page.tsx'));
const REVIEWS_PAGE = strip(read('src/app/(directory)/directory/reviews/page.tsx'));
const SUBMIT_FORM = strip(read('src/components/community/SubmitLocationForm.tsx'));
const REVIEW_FORM = strip(read('src/components/community/ReviewForm.tsx'));

const ANON_KEY = 'fixture-anon-key';
const SERVICE_KEY = 'fixture-service-role-key-must-never-be-used';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;

/** The live-shaped pool every behavioral scenario runs against. */
const FX = buildListingFixture(2454);

/** A shape the live-sized fixture must have; absent means the fixture broke. */
function required<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`listing fixture: expected a ${what}`);
  return value;
}
const TAIL_1K = required(FX.beyond1000, 'listing past rank 1,000');
const TAIL_2K = required(FX.beyond2000, 'listing past rank 2,000');
const NULL_CATEGORY = required(FX.nullCategory, 'row with a null category_slug');
const NULL_SLUG = required(FX.nullDetailSlug, 'row with a null detail_slug');
const asTable = (rows: unknown[]) =>
  ({ locations: rows as Record<string, unknown>[] }) as FixtureTables;

function install(rows: unknown[], maxRows?: number) {
  installPostgrestFake(asTable(rows), maxRows === undefined ? {} : { maxRows });
}

/* ====================================================================
 * LC1–LC13 — the scan returns the COMPLETE set at every size, including
 * the sizes that straddle the old caps and the page boundary.
 * ================================================================== */

async function sizes() {
  const CASES: [string, number][] = [
    ['LC1', 0],
    ['LC2', 1],
    ['LC3', 499],
    ['LC4', 500],
    ['LC5', 501],
    ['LC6', 999],
    ['LC7', 1000],
    ['LC8', 1001],
    ['LC9', 1999],
    ['LC10', 2000],
    ['LC11', 2001],
    ['LC12', 2454],
    ['LC13', 3000],
  ];
  for (const [id, n] of CASES) {
    const fx = buildListingFixture(n);
    install(fx.rows);
    const result = await getListingRefsResult();
    const ids = result.ok ? new Set(result.data.map((r) => r.id)) : new Set<string>();
    const complete =
      result.ok &&
      result.data.length === n &&
      fx.eligible.every((row) => ids.has(row.id)) &&
      // The excluded rows are excluded at EVERY size, not only the small ones.
      !ids.has(fx.unpublished.id) &&
      !ids.has(fx.softDeleted.id);
    check(id, `${n} published rows all arrive`, complete, {
      ok: result.ok,
      got: result.ok ? result.data.length : result.reason,
      want: n,
    });
  }
}

/* ====================================================================
 * LC14–LC19 — the two tail targets, a server cap, and the three ways the
 * exact count participates in ending a scan.
 * ================================================================== */

async function tailsAndCaps() {
  install(FX.rows);
  const full = await getListingRefsResult();
  const ids = full.ok ? new Set(full.data.map((r) => r.id)) : new Set<string>();

  check(
    'LC14',
    `listing at presentation rank ${FX.ranks.beyond1000} survives (a 1,000-row cap dropped it)`,
    ids.has(TAIL_1K.id),
  );
  check(
    'LC15',
    `listing at presentation rank ${FX.ranks.beyond2000} survives (.limit(2000) dropped it)`,
    ids.has(TAIL_2K.id),
  );

  // LC16: the server hands back fewer rows than asked for, on every page. A
  // short page is evidence of nothing, so the scan must keep going.
  install(FX.rows, 137);
  const capped = await getListingRefsResult();
  check(
    'LC16',
    'server cap far below the requested page size still yields the complete set',
    capped.ok && capped.data.length === FX.eligible.length,
    { ok: capped.ok, got: capped.ok ? capped.data.length : capped.reason },
  );

  // LC17: with a count available, the final SHORT page ends the scan — no
  // extra confirming round trip. 2,454 rows at 500/page = 5 requests.
  install(FX.rows);
  await getListingRefsResult();
  const expectedPages = Math.ceil(FX.eligible.length / DIRECTORY_PAGE_SIZE);
  check(
    'LC17',
    'exact count corroborates the short final page and terminates the scan',
    postgrestRequestCount() === expectedPages,
    { requests: postgrestRequestCount(), expected: expectedPages },
  );

  // LC18: no count at all. The ONLY way out is a request positioned after the
  // last row coming back empty — one more request than LC17.
  installNoCount(FX.rows);
  const noCount = await getListingRefsResult();
  check(
    'LC18',
    'with no count, the scan ends only on a confirmed-empty page',
    noCount.ok &&
      noCount.data.length === FX.eligible.length &&
      postgrestRequestCount() === expectedPages + 1,
    { ok: noCount.ok, requests: postgrestRequestCount(), expected: expectedPages + 1 },
  );

  // LC19: the count says there are MORE rows than the pages can produce. The
  // scan must not accept the short page as complete; it keeps going and then
  // refuses, because the pool it holds is provably short.
  installInflatedCount(FX.rows, FX.eligible.length + 50);
  const inflated = await getListingRefsResult();
  check(
    'LC19',
    'a count above the rows gathered keeps the scan going and then fails closed',
    !inflated.ok && inflated.reason === 'short_pool',
    inflated.ok ? { ok: true, len: inflated.data.length } : inflated.reason,
  );
}

/** Fake that never reports a count, whatever Prefer asks for. */
function installNoCount(rows: unknown[]) {
  install(rows);
  const inner = globalThis.fetch;
  globalThis.fetch = (async (i: RequestInfo | URL, x?: RequestInit) => {
    const res = await inner(i, x);
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

/** Fake whose Content-Range total is larger than the rows it can serve. */
function installInflatedCount(rows: unknown[], total: number) {
  install(rows);
  const inner = globalThis.fetch;
  globalThis.fetch = (async (i: RequestInfo | URL, x?: RequestInit) => {
    const res = await inner(i, x);
    const body = await res.text();
    const headers = new Headers(res.headers);
    if (headers.has('content-range')) {
      const [range] = headers.get('content-range')!.split('/');
      headers.set('content-range', `${range}/${total}`);
    }
    return new Response(body, { status: res.status, headers });
  }) as typeof fetch;
}

/* ====================================================================
 * LC20–LC26 — failure is reported. A partial pool is never a success.
 * ================================================================== */

/** Fail the Nth request (1-based) with a PostgREST-shaped error. */
function installFailingOn(rows: unknown[], failAt: number, code = '57014') {
  install(rows);
  const inner = globalThis.fetch;
  let n = 0;
  globalThis.fetch = (async (i: RequestInfo | URL, x?: RequestInit) => {
    n += 1;
    if (n === failAt) {
      return new Response(JSON.stringify({ code, message: 'canceling statement', hint: null }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }
    return inner(i, x);
  }) as typeof fetch;
}

async function failures() {
  for (const [id, at, label] of [
    ['LC20', 1, 'first page'],
    ['LC21', 3, 'middle page'],
  ] as const) {
    installFailingOn(FX.rows, at);
    const result = await getListingRefsResult();
    const soft = await (async () => {
      installFailingOn(FX.rows, at);
      return getListingRefs();
    })();
    check(
      id,
      `a ${label} failure returns no partial success`,
      !result.ok && result.reason === 'query_error' && result.code === '57014' && soft.length === 0,
      { ok: result.ok, reason: result.ok ? null : result.reason, softLen: soft.length },
    );
  }

  // LC22: everything succeeded except the LAST request — the one that would
  // have confirmed the end. Without a count there is no other way to finish,
  // so the pool in hand must be refused however complete it looks.
  installNoCount(FX.rows);
  const inner = globalThis.fetch;
  let n = 0;
  const finalPage = Math.ceil(FX.eligible.length / DIRECTORY_PAGE_SIZE) + 1;
  globalThis.fetch = (async (i: RequestInfo | URL, x?: RequestInit) => {
    n += 1;
    if (n === finalPage) {
      return new Response(JSON.stringify({ code: '08006', message: 'connection failure' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }
    return inner(i, x);
  }) as typeof fetch;
  const confirm = await getListingRefsResult();
  check(
    'LC22',
    'a failure on the confirming request refuses the rows already gathered',
    !confirm.ok && confirm.reason === 'query_error',
    confirm.ok ? { ok: true, len: confirm.data.length } : confirm.reason,
  );

  // LC23: a backend that ignores the cursor would re-serve page one forever.
  // Refusing to advance beats spinning, and beats returning duplicates.
  install(FX.rows);
  const base = globalThis.fetch;
  globalThis.fetch = (async (i: RequestInfo | URL, x?: RequestInit) => {
    const href = typeof i === 'string' ? i : i instanceof URL ? i.href : i.url;
    const url = new URL(href);
    url.searchParams.delete('id'); // drop the `id=gt.<cursor>` filter
    return base(url.href, x);
  }) as typeof fetch;
  const stuck = await getListingRefsResult();
  check(
    'LC23',
    'a cursor that never advances fails closed rather than looping',
    !stuck.ok && stuck.reason === 'no_progress',
    stuck.ok ? { ok: true, len: stuck.data.length } : stuck.reason,
  );

  // LC24: one row per response. The scan advances legitimately but cannot
  // finish inside the runaway guard, so it must fail rather than truncate.
  install(FX.rows, 1);
  const capExhausted = await getListingRefsResult();
  check(
    'LC24',
    'exhausting the page-cap guard fails closed, never returns a short pool',
    !capExhausted.ok && capExhausted.reason === 'page_cap',
    capExhausted.ok ? { ok: true, len: capExhausted.data.length } : capExhausted.reason,
  );

  // LC25: even if pages were to overlap, one id may appear once.
  install(FX.rows);
  const full = await getListingRefsResult();
  const list = full.ok ? full.data : [];
  check(
    'LC25',
    'no id appears twice in the final pool',
    list.length === new Set(list.map((r) => r.id)).size && list.length === FX.eligible.length,
    { len: list.length, unique: new Set(list.map((r) => r.id)).size },
  );

  // LC26: rows published WHILE the scan runs. The count is a floor on the way
  // out — growth pushes the real total above it, so the scan ends on a
  // verified empty page and returns MORE rows than the count promised, rather
  // than failing or silently dropping the newcomer.
  const growing = [...FX.rows];
  install(growing);
  const grower = globalThis.fetch;
  let calls = 0;
  const newcomer = {
    id: '00000000-0000-4000-8000-fffffffffff1',
    name: 'Published Mid Scan',
    city: 'Latecomer',
    state: 'WY',
    category_slug: 'truck-stops',
    detail_slug: 'published-mid-scan-latecomer-wy',
    is_published: true,
    deleted_at: null,
  };
  globalThis.fetch = (async (i: RequestInfo | URL, x?: RequestInit) => {
    calls += 1;
    if (calls === 2) growing.push(newcomer);
    return grower(i, x);
  }) as typeof fetch;
  const grew = await getListingRefsResult();
  check(
    'LC26',
    'a row published mid-scan is kept, and the count stays a floor rather than a ceiling',
    grew.ok &&
      grew.data.length === FX.eligible.length + 1 &&
      grew.data.some((r) => r.id === newcomer.id),
    { ok: grew.ok, len: grew.ok ? grew.data.length : grew.reason },
  );
}

/* ====================================================================
 * LC27–LC35 — what the query asks the database for, on every page.
 * ================================================================== */

async function queryShape() {
  install(FX.rows);
  const result = await getListingRefsResult();
  const reqs = postgrestRequests();

  check(
    'LC27',
    'is_published=true is applied on EVERY page, not just the first',
    reqs.length > 1 && reqs.every((r) => r.url.includes('is_published=eq.true')),
    reqs.map((r) => r.url.includes('is_published=eq.true')),
  );
  check(
    'LC28',
    'deleted_at is null is applied on EVERY page',
    reqs.length > 1 && reqs.every((r) => r.url.includes('deleted_at=is.null')),
  );

  const ids = result.ok ? new Set(result.data.map((r) => r.id)) : new Set<string>();
  check('LC29', 'the unpublished row never reaches the pool', !ids.has(FX.unpublished.id));
  check('LC30', 'the soft-deleted row never reaches the pool', !ids.has(FX.softDeleted.id));

  check(
    'LC31',
    'the cookieless ANON key authenticates every listing request',
    reqs.length > 0 && reqs.every((r) => r.apikey === ANON_KEY),
  );
  check(
    'LC32',
    'the service-role client is never used for listing refs',
    reqs.every((r) => r.apikey !== SERVICE_KEY) &&
      /getListingRefsResult[\s\S]{0,600}createStaticClient\(\)/.test(COMMUNITY) &&
      !/getListingRefsResult[\s\S]{0,600}createAdminClient/.test(COMMUNITY),
  );

  // LC33: exactly the five columns a ListingRef is built from. Not "at least"
  // — a widened select is payload every browser pays for.
  const selects = reqs.map((r) => new URL(r.url).searchParams.get('select'));
  check(
    'LC33',
    'exactly the slim columns are selected, on every page',
    selects.length > 0 &&
      selects.every(
        (s) => s === 'id, name, city, state, detail_slug' || s === 'id,name,city,state,detail_slug',
      ),
    selects[0],
  );

  const list = result.ok ? result.data : [];
  const nullCat = list.find((r) => r.id === NULL_CATEGORY.id);
  check(
    'LC34',
    'a null category maps honestly — the field is gone, so nothing is invented',
    Boolean(nullCat) &&
      !('category' in (nullCat as object)) &&
      !/category/.test(JSON.stringify(list.slice(0, 50))),
    nullCat,
  );
  const nullSlug = list.find((r) => r.id === NULL_SLUG.id);
  check(
    'LC35',
    'a null detail_slug stays ABSENT rather than becoming a string',
    Boolean(nullSlug) && nullSlug!.detailSlug === undefined,
    nullSlug,
  );
}

/* ====================================================================
 * LC36–LC37 — the visible order, over the COMPLETE set.
 * ================================================================== */

async function ordering() {
  install(FX.rows);
  const result = await getListingRefsResult();
  const list = result.ok ? result.data : [];

  const expected = FX.ordered.map((r) => r.id);
  check(
    'LC36',
    'final order is state, then city, then name, then id — deterministic to the last row',
    JSON.stringify(list.map((r) => r.id)) === JSON.stringify(expected),
    { firstMismatch: list.findIndex((r, i) => r.id !== expected[i]) },
  );

  // Order must not depend on the order the scan happened to see rows in.
  install([...FX.rows].reverse());
  const reversed = await getListingRefsResult();
  check(
    'LC36-stable',
    'reversing the storage order changes nothing about the rendered order',
    reversed.ok && JSON.stringify(reversed.data.map((r) => r.id)) === JSON.stringify(expected),
  );

  // LC37: three rows share state, city AND name. They must all be present and
  // remain individually selectable — the label alone cannot tell them apart,
  // so the id is what keeps them distinct.
  const twinIds = FX.twins.map((t) => t.id);
  const twinsInPool = twinIds.filter((id) => list.some((r) => r.id === id));
  const twinPositions = twinIds
    .map((id) => list.findIndex((r) => r.id === id))
    .sort((a, b) => a - b);
  check(
    'LC37',
    'byte-identical state/city/name rows all survive and stay individually addressable',
    twinsInPool.length === 3 &&
      new Set(twinPositions).size === 3 &&
      twinPositions[2] - twinPositions[0] === 2 &&
      // ordered among themselves by id, the only thing that differs
      JSON.stringify(twinPositions.map((p) => list[p].id)) ===
        JSON.stringify([...twinIds].sort((a, b) => a.localeCompare(b))),
    { twinsInPool: twinsInPool.length, twinPositions },
  );

  /* The rule, exercised directly on SHUFFLED input.
   *
   * Through the pipeline the tie-breaker is invisible: the scan hands the
   * sort an id-ascending array and Array.prototype.sort is stable, so ties
   * come out id-ordered whether or not the comparator says so. Sorting a
   * deliberately shuffled set is the only way to tell a stated rule apart
   * from an accident of the plumbing — and it is what fails if the `id`
   * clause is ever dropped. */
  const tie = (id: string): ListingRef => ({
    id,
    name: 'Twin Pines Truck Plaza',
    city: 'Springfield',
    state: 'TN',
  });
  const shuffled = ['id-c', 'id-a', 'id-d', 'id-b'].map(tie);
  check(
    'LC36-tiebreak',
    'rows identical but for id sort by id, from ANY starting order',
    JSON.stringify([...shuffled].sort(compareListingRefs).map((r) => r.id)) ===
      JSON.stringify(['id-a', 'id-b', 'id-c', 'id-d']),
    [...shuffled].sort(compareListingRefs).map((r) => r.id),
  );

  // Collation: the DB ordered under ICU en_US, and these are the live cases
  // where code-unit comparison and ICU disagree.
  const icuOrder = ['a-1 Truck', 'ACME Truck & Trailer', 'acme truck and trailer', 'Zeta'];
  const scrambled = ['Zeta', 'acme truck and trailer', 'a-1 Truck', 'ACME Truck & Trailer'];
  check(
    'LC36-collation',
    'presentation sort reproduces the database ICU en_US order, not code-unit order',
    JSON.stringify(
      scrambled
        .map((name, i) => ({ id: `id-${i}`, name, city: 'Dalton', state: 'GA' }))
        .sort(compareListingRefs)
        .map((r) => r.name),
    ) === JSON.stringify(icuOrder) &&
      // and the shipped read is what uses it
      /refs\.sort\(compareListingRefs\)/.test(COMMUNITY),
  );
}

/* ====================================================================
 * LC38–LC47 — the pickers and forms, rendered.
 * ================================================================== */

type Rendered = TestRenderer.ReactTestRenderer;

/** Render with a controlled ?query, the way a deep link arrives. */
function withSearch<T>(search: string, run: () => T): T {
  const prior = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = { location: { search } };
  try {
    return run();
  } finally {
    if (prior === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = prior;
  }
}

/** Every rendered option row (role="option") in a tree. */
function optionLabels(tree: Rendered): string[] {
  return tree.root
    .findAll((n) => typeof n.type === 'string' && n.props.role === 'option', { deep: true })
    .map((n) =>
      n.children
        .map((c) => (typeof c === 'string' ? c : ''))
        .join('')
        .trim(),
    );
}

function textOf(tree: Rendered): string {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string') out.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object' && 'children' in (node as object)) {
      walk((node as { children: unknown }).children);
    }
  };
  walk(tree.toJSON());
  return out.join(' ');
}

/** Click one of the "What are you reporting?" radios, as a driver would. */
function chooseKind(tree: Rendered, value: string): void {
  const radio = tree.root.find((n) => n.props.type === 'radio' && n.props.value === value);
  act(() => radio.props.onChange({ target: { value } }));
}

/**
 * Type into the picker's search box and return what it renders. A whole form
 * has many text inputs, so the picker's own id is what identifies it.
 */
function search(tree: Rendered, query: string, inputId = 'pick'): string[] {
  const input = tree.root.find(
    (n) => n.type === 'input' && n.props.type === 'text' && n.props.id === inputId,
  );
  act(() => {
    input.props.onChange({ target: { value: query } });
  });
  return optionLabels(tree);
}

async function pickerBehavior() {
  install(FX.rows);
  const result = await getListingRefsResult();
  const listings: ListingRef[] = result.ok ? result.data : [];

  let selectedId = '';
  const render = (props: Partial<Parameters<typeof LocationPicker>[0]> = {}) => {
    let tree!: Rendered;
    act(() => {
      tree = TestRenderer.create(
        createElement(LocationPicker, {
          id: 'pick',
          label: 'Which listing?',
          required: true,
          listings,
          value: '',
          onChange: (id: string) => {
            selectedId = id;
          },
          ...props,
        }),
      );
    });
    return tree;
  };

  // LC41–LC43: the tail listing is reachable by each of the three fields the
  // picker searches. Before this milestone it was in none of them.
  const byName = search(render(), 'Tailwatch Beyond Two Thousand');
  check(
    'LC41',
    'the tail listing is findable by name',
    byName.length === 1 && byName[0].includes('Tailwatch Beyond Two Thousand'),
    byName,
  );

  const byCity = search(render(), TAIL_2K.city);
  check(
    'LC42',
    'the tail listing is findable by city',
    byCity.length === 1 && byCity[0].includes(TAIL_2K.name) && byCity[0].includes(TAIL_2K.city),
    byCity.slice(0, 3),
  );

  const tailState = TAIL_2K.state;
  const byState = search(render(), tailState);
  check(
    'LC43',
    `the tail listing's state (${tailState}) returns results at all`,
    byState.length > 0 && byState.every((l) => l.includes(`, ${tailState}`)),
    byState.slice(0, 3),
  );

  // LC44: a broad query matches thousands. Twelve render.
  const broad = search(render(), 'Pilot');
  const broadMatches = listings.filter((l) =>
    `${l.name} ${l.city} ${l.state}`.toLowerCase().includes('pilot'),
  ).length;
  check(
    'LC44',
    'a query matching hundreds renders at most 12 rows',
    broad.length === 12 && broadMatches > 12,
    { rendered: broad.length, matching: broadMatches },
  );

  // LC45: no query renders NOTHING — not the whole directory.
  const idle = render();
  check(
    'LC45',
    'an empty query renders zero result rows, never the full pool',
    optionLabels(idle).length === 0 && !textOf(idle).includes(listings[0].name),
  );

  // Selection still carries the id the API validates.
  const tree = render();
  search(tree, 'Tailwatch Beyond Two Thousand');
  const option = tree.root.find((n) => n.props.role === 'option');
  act(() => option.props.onClick());
  check(
    'LC44-select',
    'selecting a tail result reports its internal id to the form',
    selectedId === TAIL_2K.id,
    { selectedId, want: TAIL_2K.id },
  );

  // LC46: the read failed. The picker must NOT say "no published listing
  // matches" — that sentence is a claim about the directory's contents.
  const down = render({
    unavailable: true,
    listings: [],
    unavailableAction: 'Do the other thing.',
  });
  const downText = textOf(down);
  check(
    'LC46',
    'a failed read renders "temporarily unavailable", never a no-match claim',
    downText.includes('temporarily unavailable') &&
      !downText.includes('No published listing matches') &&
      down.root.findAll((n) => n.props.role === 'status').length === 1,
    downText.slice(0, 140),
  );
  check(
    'LC46-empty',
    'a GENUINELY empty directory still says no match — the two states stay distinct',
    (() => {
      const empty = render({ listings: [] });
      const t = search(empty, 'anything at all');
      return t.length === 0 && textOf(empty).includes('No published listing matches');
    })(),
  );
}

async function formsBehavior() {
  install(FX.rows);
  const result = await getListingRefsResult();
  const listings: ListingRef[] = result.ok ? result.data : [];

  const renderSubmit = (searchStr: string, unavailable = false) =>
    withSearch(searchStr, () => {
      let tree!: Rendered;
      act(() => {
        tree = TestRenderer.create(
          createElement(SubmitLocationForm, {
            siteKey: '',
            listings,
            listingsUnavailable: unavailable,
          }),
        );
      });
      return tree;
    });

  // LC38: the deep link the DETAIL PAGE emits, for a listing that used to be
  // past the cap. Before this milestone the slug resolved to nothing and the
  // form silently stayed on "new".
  const slug = TAIL_2K.detail_slug ?? '';
  const deep = renderSubmit(`?listing=${slug}&kind=correction`);
  const deepText = textOf(deep);
  check(
    'LC38',
    'a deep link to a formerly-omitted listing selects it and switches report kind',
    deepText.includes(TAIL_2K.name) &&
      deepText.includes(TAIL_2K.city) &&
      deep.root.findAll((n) => n.props.type === 'radio' && n.props.checked === true).length >= 0 &&
      // the picker shows the SELECTED state (a Change control), not a search box
      deep.root.findAll((n) => typeof n.type === 'string' && n.props.children === 'Change')
        .length === 1,
    deepText.slice(0, 160),
  );

  const reviewDeep = withSearch(`?listing=${slug}`, () => {
    let tree!: Rendered;
    act(() => {
      tree = TestRenderer.create(createElement(ReviewForm, { siteKey: '', listings }));
    });
    return tree;
  });
  check(
    'LC38-review',
    'the reviews page resolves the same deep link to the same listing',
    textOf(reviewDeep).includes(TAIL_2K.name),
  );

  // LC39: an unknown slug leaves the form exactly as it loads by default.
  const unknown = renderSubmit('?listing=not-a-real-listing&kind=correction');
  const plain = renderSubmit('');
  check(
    'LC39',
    'an unknown deep-link slug leaves the default form untouched',
    !textOf(unknown).includes(TAIL_2K.name) &&
      unknown.root.findAll((n) => typeof n.type === 'string' && n.props.children === 'Change')
        .length === 0,
  );
  check(
    'LC39-hidden',
    'an unpublished or deleted listing is not resolvable by deep link',
    (() => {
      const hidden = renderSubmit(`?listing=${FX.unpublished.detail_slug}&kind=correction`);
      const gone = renderSubmit(`?listing=${FX.softDeleted.detail_slug}&kind=correction`);
      return (
        !textOf(hidden).includes(FX.unpublished.name) && !textOf(gone).includes(FX.softDeleted.name)
      );
    })(),
  );

  // LC40: slugs go in URLs; internal ids never do — on either side.
  const noIdInUrls =
    !/searchParams\.get\('listing'\)[\s\S]{0,120}\.id ===/.test(SUBMIT_FORM) &&
    /l\.detailSlug && l\.detailSlug === params\.get\('listing'\)/.test(SUBMIT_FORM) &&
    /l\.detailSlug === slug/.test(REVIEW_FORM) &&
    !/history\.(replace|push)State|router\.(replace|push)/.test(SUBMIT_FORM + REVIEW_FORM);
  check(
    'LC40',
    'deep links are keyed on the public slug, and no internal id is ever written to a URL',
    noIdInUrls && !textOf(plain).includes(listings[0].id),
  );

  // LC47: with the lookup down, reporting a NEW location is untouched — that
  // path never needed the picker, and blocking it would lose real reports.
  const downSubmit = renderSubmit('', true);
  const downText = textOf(downSubmit);
  check(
    'LC47',
    'a lookup failure never blocks new-location submission',
    downText.includes('Business name') &&
      downSubmit.root.findAll((n) => n.type === 'button' && /Send/i.test(String(n.props.children)))
        .length >= 0 &&
      // 'new' is the default kind, and it renders no picker at all
      !downText.includes('temporarily unavailable'),
    downText.slice(0, 120),
  );

  // Choosing a kind that DOES need the picker states the real reason. The
  // driver clicks the radio — `?kind=correction` alone cannot select it,
  // because the form only honours a kind param that came with a listing.
  const correction = renderSubmit('', true);
  chooseKind(correction, 'correction');
  const correctionText = textOf(correction);
  check(
    'LC47-blocked',
    'a picker-requiring report kind explains the outage instead of claiming no match',
    correctionText.includes('temporarily unavailable') &&
      !correctionText.includes('No published listing matches') &&
      correctionText.includes('submit this place as a new location'),
    correctionText.slice(-260),
  );

  // The same kind, with the lookup HEALTHY, still offers a working search box
  // — the unavailable state must not be what a correction always looks like.
  const healthy = renderSubmit('');
  chooseKind(healthy, 'correction');
  check(
    'LC47-healthy',
    'the same report kind searches normally when the read succeeded',
    !textOf(healthy).includes('temporarily unavailable') &&
      search(healthy, 'Tailwatch Beyond Two Thousand', 'submission_location').length === 1,
  );
}

/* ====================================================================
 * LC48–LC55 — contracts this milestone must NOT have moved.
 * ================================================================== */

function guardrails() {
  const SUBMISSION_ROUTE = strip(read('src/app/api/directory/submission/route.ts'));
  const REVIEW_ROUTE = strip(read('src/app/api/directory/review/route.ts'));
  const SCHEMAS = strip(read('src/lib/community/schemas.ts'));

  check(
    'LC48',
    'correction/closure/review still require a live PUBLISHED listing, server-side',
    /\.from\('locations'\)[\s\S]{0,220}\.eq\('is_published', true\)[\s\S]{0,120}\.is\('deleted_at', null\)/.test(
      SUBMISSION_ROUTE,
    ) &&
      /\.from\('locations'\)[\s\S]{0,220}\.eq\('is_published', true\)[\s\S]{0,120}\.is\('deleted_at', null\)/.test(
        REVIEW_ROUTE,
      ),
  );
  check(
    'LC49',
    'the intake validation contract is unchanged (uuid location_id, same kinds)',
    /location_id: optional\(z\.string\(\)\.uuid\(/.test(SCHEMAS) &&
      /'new',\s*'correction',\s*'closure',\s*'missing-info',\s*'amenity-change',/.test(SCHEMAS),
  );
  check(
    'LC50',
    'the listing read adds no write path — select only, no insert/update/delete/rpc',
    !/\.(insert|update|upsert|delete|rpc)\(/.test(
      COMMUNITY.slice(
        COMMUNITY.indexOf('getListingRefsResult'),
        COMMUNITY.indexOf('ApprovedReview'),
      ),
    ),
  );

  const migrations = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql'));
  /**
   * Migrations that arrived AFTER this milestone and belong to another one.
   *
   * The original form of this check was "056 is the highest", which said the
   * right thing and aged badly: the next milestone to add a migration for its
   * own reasons broke a guard about THIS milestone's scope. Naming them keeps
   * the teeth — an unexplained new migration still trips it — without the
   * assertion becoming a lie the moment the repository moves on.
   */
  const LATER_MILESTONE_MIGRATIONS: Record<string, string> = {
    '057_featured_listing_term.sql': 'REVENUE-2 — adds locations.featured_until',
  };
  const unexplained = migrations
    .filter((f) => /^0(5[7-9]|[6-9]\d)/.test(f))
    .filter((f) => !(f in LATER_MILESTONE_MIGRATIONS));
  check(
    'LC51',
    'this milestone added no migration, and every later one is accounted for',
    unexplained.length === 0,
    unexplained,
  );
  // And the later ones must not disturb what this path reads. 057 adds a column
  // to `public.locations`, which this milestone selects from — so "it is
  // additive" is a claim worth checking rather than asserting.
  check(
    'LC51a',
    'no later migration drops or renames anything the listing-ref read selects',
    Object.keys(LATER_MILESTONE_MIGRATIONS).every((f) => {
      const sql = read(`supabase/migrations/${f}`)
        .split('\n')
        .filter((l) => !l.trimStart().startsWith('--'))
        .join('\n');
      const touched = /\b(drop column|rename column|drop table|alter column)\b/i.test(sql);
      const selected = ['id', 'name', 'city', 'state', 'detail_slug'];
      return (
        !touched &&
        !selected.some((c) => new RegExp(`\\b(drop|rename)\\s+\\w*\\s*${c}\\b`, 'i').test(sql))
      );
    }),
  );
  check(
    'LC52',
    'the sitemap layer is untouched by the listing-ref path',
    !/sitemap/i.test(COMMUNITY) && !/getListingRef/.test(read('src/lib/seo/sitemap-entries.ts')),
  );
  check(
    'LC53',
    'no indexability gate is referenced or altered by the listing-ref path',
    !/is_indexable|indexable/.test(COMMUNITY),
  );
  check(
    'LC54',
    'Navigator and Trip Planner are not in this change set',
    !/navigator|trip-planner/i.test(COMMUNITY) &&
      !/navigator|trip-planner/i.test(PICKER) &&
      !/navigator|trip-planner/i.test(SUBMIT_PAGE + REVIEWS_PAGE),
  );
  check(
    'LC55',
    'RLS migration 054 is present and intact',
    existsSync('supabase/migrations/054_public_api_surface_lockdown.sql') &&
      /LOCK DOWN THE PUBLIC DATA-API SURFACE/.test(
        read('supabase/migrations/054_public_api_surface_lockdown.sql'),
      ),
  );

  /* --- the contracts this milestone establishes, held in source ---------- */

  check(
    'LC-CAP',
    'no capped listing read remains: .limit(2000) is gone from the community layer',
    !/\.limit\(2000\)/.test(COMMUNITY.slice(0, COMMUNITY.indexOf('getRecentApprovedReviews'))) &&
      /collectAllRows</.test(COMMUNITY),
  );
  check(
    'LC-ONE-TRUTH',
    'the complete-read algorithm is reused, not duplicated',
    /import \{[^}]*collectAllRows[^}]*\} from '@\/lib\/directory\/data'/.test(COMMUNITY) &&
      !/while \(pages < maxPages\)/.test(COMMUNITY),
  );
  check(
    'LC-PAGES',
    'both pages read result-aware and pass availability through',
    /getListingRefsResult\(\)/.test(SUBMIT_PAGE) &&
      /listingsUnavailable=\{!listingRefs\.ok\}/.test(SUBMIT_PAGE) &&
      /getListingRefsResult\(\)/.test(REVIEWS_PAGE) &&
      /listingsUnavailable=\{!listingRefs\.ok\}/.test(REVIEWS_PAGE),
  );
  check(
    'LC-ISR',
    'both pages keep periodic revalidation, so imports appear without a redeploy',
    /export const revalidate = 300/.test(SUBMIT_PAGE) &&
      /export const revalidate = 300/.test(REVIEWS_PAGE),
  );
  check(
    'LC-NO-CACHE',
    'no process-global cache was introduced for the listing pool',
    !/new Map\(|globalThis\.|unstable_cache|revalidateTag/.test(
      COMMUNITY.slice(0, COMMUNITY.indexOf('getRecentApprovedReviews')),
    ),
  );
  check(
    'LC-NO-COORDS',
    'no coordinates, and no reviewer or submitter data, are in the picker payload',
    !/\blat\b|\blng\b|latitude|longitude|reviewer|submitter/.test(
      COMMUNITY.slice(COMMUNITY.indexOf('ListingRef = {'), COMMUNITY.indexOf('ApprovedReview')),
    ),
  );
  check(
    'LC-NO-RAW-ERROR',
    'no raw driver message reaches the browser — codes only',
    !/error\.message|error\.details|error\.hint/.test(COMMUNITY),
  );
  check(
    'LC-GUARD-SANE',
    'the runaway guard still sits an order of magnitude above the directory',
    DIRECTORY_PAGE_SIZE * DIRECTORY_MAX_PAGES >= 30000 && DIRECTORY_PAGE_SIZE <= 1000,
  );
}

/* ==================================================================== */

async function main() {
  const realFetch = globalThis.fetch;
  try {
    await sizes();
    await tailsAndCaps();
    await failures();
    await queryShape();
    await ordering();
    await pickerBehavior();
    await formsBehavior();
    guardrails();
  } finally {
    globalThis.fetch = realFetch;
  }

  // A scenario that silently never ran would read as a pass.
  const expected = Array.from({ length: 55 }, (_, i) => `LC${i + 1}`);
  const missing = expected.filter((id) => !seen.has(id));
  check('LC-COVERAGE', 'every LC1–LC55 scenario ran', missing.length === 0, missing);

  console.log(`community-listing-refs: ${passed} passed, ${failed} failed`);
  // react-test-renderer keeps the loop alive; exit explicitly.
  process.exit(failed > 0 ? 1 : 0);
}

void main();
