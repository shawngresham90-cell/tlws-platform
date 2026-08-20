/**
 * Listing-detail read semantics — empty vs. error on the 404-gating surface
 * that still had the defect (2026-08-20).
 *
 * `/directory/i75/exit-369` served a cached 404 while 11 published rows sat in
 * the table. PR #215 gave the directory a three-outcome read contract and
 * rewired the EXIT page onto it; the 2026-08-04 adversarial audit then
 * recorded, under "known limitations, deliberately not fixed here", that
 * `getEntryByDetailSlug` still "collapses query errors into `null` (a
 * detail-page false-404 vector of the same class #215 fixed for exits)".
 *
 * That surface is the larger one: every published listing has a detail page
 * (2,454 of them, all sitemap members), the route is ISR at
 * `revalidate = 300`, and the anon role carries a 3 s `statement_timeout`
 * (SQLSTATE 57014) — so one slow regeneration used to mint a 404 over a real,
 * indexed page and serve it until something purged it.
 *
 * WHY THIS HARNESS DRIVES THE PAGE INSTEAD OF GREPPING IT. The navigator
 * technical-debt audit's process note is the reason: "Text pins are excellent
 * at freezing what the file says; they cannot attest what the component
 * does." Finding 1 there was an unsatisfiable condition that a regex pin
 * matched happily. So the 404-vs-500-vs-301-vs-200 decision here is proved by
 * CALLING the real page function against a controlled PostgREST and reading
 * which terminal it reaches (`notFound()` and `permanentRedirect()` are
 * observable — they throw carrying a `digest`). Source pins are used only for
 * the things a run cannot show: which client is constructed, and what may be
 * logged.
 *
 * Run:
 *   npx esbuild scripts/test-directory-detail-false-404.ts --bundle \
 *     --platform=node --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --alias:next/headers=./scripts/shims/next-headers.ts \
 *     --alias:next/cache=./scripts/shims/next-cache.ts --loader:.css=empty \
 *     --outfile=/tmp/test-detail-404.cjs && node /tmp/test-detail-404.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isValidElement, type ReactElement } from 'react';
import {
  DirectoryUnavailableError,
  getEntryByDetailSlug,
  getEntryByDetailSlugResult,
  type DirectoryReadResult,
} from '@/lib/directory/data';
import { resolveSlugRedirect, resolveSlugRedirectResult } from '@/lib/directory/redirects';
import { isDetailIndexable } from '@/lib/directory/detail';
import type { Metadata } from 'next';

/**
 * The page module is loaded LAZILY, after the shim below.
 *
 * `request-cache.ts` calls React's `cache()` at module scope. That function
 * only exists in the `react-server` build Next selects for server components;
 * the plain React this offline bundle resolves does not export it, so a
 * static import of the page would crash on require. The shim is an identity
 * passthrough — which is exactly what `cache()` degrades to outside a render,
 * and is the documented posture in `request-cache.ts` itself ("`cache()`
 * outside a React render is a no-op passthrough at best"). Each call below
 * therefore performs its own read, which is what these assertions want: the
 * dedupe property is a separate claim, pinned structurally further down.
 */
type PageModule = {
  default: (props: { params: { slug: string } }) => Promise<unknown>;
  generateMetadata: (props: { params: { slug: string } }) => Promise<Metadata>;
};
let ListingDetailPage: PageModule['default'];
let listingMetadata: PageModule['generateMetadata'];

async function loadPageModule(): Promise<void> {
  const react = require('react') as Record<string, unknown>;
  if (typeof react.cache !== 'function') react.cache = <T>(fn: T): T => fn;
  const mod = (await import(
    '@/app/(directory)/directory/location/[slug]/page'
  )) as unknown as PageModule;
  ListingDetailPage = mod.default;
  listingMetadata = mod.generateMetadata;
}

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
/** Executable source only — the headers document the old bug by name. */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const pageSrc = read('src/app/(directory)/directory/location/[slug]/page.tsx');
const pageCode = strip(pageSrc);
const dataSrc = read('src/lib/directory/data.ts');
const redirectSrc = read('src/lib/directory/redirects.ts');
const redirectCode = strip(redirectSrc);

/* ======================================================================
 * A controllable PostgREST. Each table answers either with rows or with a
 * failure, so a read can be made to fail exactly the way production fails.
 * ==================================================================== */

type TableAnswer = (
  | { kind: 'rows'; rows: Record<string, unknown>[] }
  /** PostgREST replied, with an error body — what a statement timeout looks like. */
  | { kind: 'pgError'; status: number; code: string }
  /** The request never completed — DNS, TLS, socket. `fetch` rejects. */
  | { kind: 'throw'; message: string }
) & {
  /** Hold the answer open, so two reads genuinely overlap in flight. */
  delayMs?: number;
};

/** A table answers either the same way every time, or per request. */
type Answerer = TableAnswer | ((url: URL) => TableAnswer);

type Wiring = Record<string, Answerer>;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let wiring: Wiring = {};
let requestLog: string[] = [];

function applyFilter(rows: Record<string, unknown>[], col: string, raw: string) {
  if (raw.startsWith('eq.')) return rows.filter((r) => String(r[col]) === raw.slice(3));
  if (raw === 'is.null') return rows.filter((r) => r[col] == null);
  if (raw === 'not.is.null') return rows.filter((r) => r[col] != null);
  if (raw.startsWith('gt.')) return rows.filter((r) => String(r[col]) > raw.slice(3));
  if (raw.startsWith('in.(') && raw.endsWith(')')) {
    const values = raw
      .slice(4, -1)
      .split(',')
      .map((s) => s.trim().replace(/^"(.*)"$/, '$1'));
    return rows.filter((r) => values.includes(String(r[col])));
  }
  // Unsupported filters fail loudly rather than returning a wrong answer.
  throw new Error(`stub: unsupported filter ${col}=${raw}`);
}

function installStub(w: Wiring): void {
  wiring = w;
  requestLog = [];
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://placeholder.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'placeholder-anon-key';
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href);
    if (!url.pathname.startsWith('/rest/v1/')) {
      throw new Error(`stub: unexpected request ${url.pathname}`);
    }
    const table = url.pathname.split('/').pop() ?? '';
    requestLog.push(table);
    const wired = wiring[table];
    if (!wired) throw new Error(`stub: no wiring for table ${table}`);
    const answer = typeof wired === 'function' ? wired(url) : wired;
    if (answer.delayMs) await sleep(answer.delayMs);
    if (answer.kind === 'throw') throw new Error(answer.message);
    if (answer.kind === 'pgError') {
      return new Response(
        JSON.stringify({ code: answer.code, message: 'stub failure', details: null, hint: null }),
        { status: answer.status, headers: { 'content-type': 'application/json' } },
      );
    }
    let rows = [...answer.rows];
    let order: string | null = null;
    let limit: number | null = null;
    for (const [key, value] of url.searchParams.entries()) {
      if (key === 'select' || key === 'apikey') continue;
      if (key === 'order') order = value;
      else if (key === 'limit') limit = parseInt(value, 10);
      else rows = applyFilter(rows, key, value);
    }
    const total = rows.length;
    if (order) {
      const [col] = order.split('.');
      rows.sort((a, b) => String(a[col]).localeCompare(String(b[col])));
      if (order.split('.').includes('desc')) rows.reverse();
    }
    if (limit != null) rows = rows.slice(0, limit);
    const headers = new Headers({ 'content-type': 'application/json' });
    const prefer = new Headers(
      init?.headers ?? (typeof input === 'object' && 'headers' in input ? input.headers : {}),
    ).get('prefer');
    if (prefer && /count=exact/.test(prefer)) {
      headers.set(
        'content-range',
        rows.length === 0 ? `*/${total}` : `0-${rows.length - 1}/${total}`,
      );
    }
    return new Response(JSON.stringify(rows), { status: 200, headers });
  }) as typeof fetch;
}

/* ---------------------------------------------------------- fixtures */

const SLUG = 'petro-knoxville-knoxville-tn';
const RETIRED_SLUG = 'petro-knoxville-tn';

/** Production-shaped row: the one this page exists to serve. */
const LISTING = {
  id: '11111111-1111-4111-8111-111111111111',
  is_published: true,
  deleted_at: null,
  name: 'Petro Knoxville',
  category_slug: 'truck-stops',
  state: 'TN',
  city: 'Knoxville',
  slug: 'petro-knoxville',
  address: '803 Watt Rd',
  zip: '37932',
  phone: null,
  website: null,
  description: 'Full-service travel center at I-75 Exit 369.',
  parking_spaces: 300,
  amenities: ['Showers', 'Restaurant'],
  free_parking: true,
  paid_parking: true,
  reserved_parking: true,
  overnight_parking: true,
  tpc_url: null,
  is_featured: false,
  is_indexable: true,
  lat: 35.9,
  lng: -84.2,
  interstate: 'I-75',
  exit_number: '369',
  mile_marker: 369,
  mile_marker_source: 'operator',
  overnight_status: 'confirmed',
  overnight_status_source: 'operator',
  created_at: '2026-07-01T00:00:00Z',
  detail_slug: SLUG,
  updated_at: '2026-08-01T00:00:00Z',
  verified_at: '2026-08-01T00:00:00Z',
};

const REDIRECT_ROW = {
  old_slug: RETIRED_SLUG,
  location_id: LISTING.id,
  locations: { detail_slug: SLUG, is_published: true, deleted_at: null },
};

const rows = (r: Record<string, unknown>[]): TableAnswer => ({ kind: 'rows', rows: r });
/** Anon `statement_timeout` — 3 s on this database, the likeliest real trigger. */
const TIMEOUT: TableAnswer = { kind: 'pgError', status: 500, code: '57014' };
const TRANSPORT: TableAnswer = { kind: 'throw', message: 'socket hang up' };
/** Migration 023 not applied: the relation genuinely does not exist. */
const NO_RELATION: TableAnswer = { kind: 'pgError', status: 404, code: '42P01' };
const NO_RELATION_CACHED: TableAnswer = { kind: 'pgError', status: 404, code: 'PGRST205' };

/** Everything the detail page reads beyond the listing itself. */
function supporting(locations: TableAnswer, redirects: TableAnswer): Wiring {
  return {
    locations,
    directory_slug_redirects: redirects,
    location_reviews: rows([]),
    directory_sponsors: rows([]),
  };
}

/* ======================================================================
 * 1. The read itself: three outcomes, never two.
 * ==================================================================== */

async function readContract() {
  installStub(supporting(rows([LISTING]), rows([])));
  const hit = await getEntryByDetailSlugResult(SLUG);
  check('normal path: a published listing resolves ok with an entry', hit.ok && hit.data !== null);
  check(
    'normal path: the entry carries the row it was built from',
    hit.ok && hit.data?.name === 'Petro Knoxville' && hit.data?.state === 'TN',
  );

  installStub(supporting(rows([LISTING]), rows([])));
  const miss = await getEntryByDetailSlugResult('no-such-listing-nowhere-zz');
  check(
    'a slug with no row resolves ok with null — a SUCCESSFUL empty',
    miss.ok && miss.data === null,
  );

  installStub(supporting(rows([{ ...LISTING, is_published: false }]), rows([])));
  const unpublished = await getEntryByDetailSlugResult(SLUG);
  check(
    'an unpublished row is a successful null, not an error',
    unpublished.ok && unpublished.data === null,
  );

  installStub(supporting(rows([{ ...LISTING, deleted_at: '2026-08-01T00:00:00Z' }]), rows([])));
  const deleted = await getEntryByDetailSlugResult(SLUG);
  check(
    'a soft-deleted row is a successful null, not an error',
    deleted.ok && deleted.data === null,
  );

  installStub(supporting(TIMEOUT, rows([])));
  const timedOut = await getEntryByDetailSlugResult(SLUG);
  check(
    'THE DEFECT: a statement timeout is a FAILURE, not "no such listing"',
    timedOut.ok === false,
  );
  check(
    'the timeout is reported as query_error and carries only its SQLSTATE',
    timedOut.ok === false && timedOut.reason === 'query_error' && timedOut.code === '57014',
  );

  installStub(supporting(TRANSPORT, rows([])));
  const dropped = await getEntryByDetailSlugResult(SLUG);
  check('a dropped connection is a FAILURE, not "no such listing"', dropped.ok === false);
  // supabase-js catches a rejected fetch and hands it back as an error object
  // rather than throwing, so it arrives on the `error` branch. What matters is
  // that it is a failure at all; the exact class is recorded, not asserted at.
  check(
    'a dropped connection is classified as a read failure with no row data',
    dropped.ok === false && (dropped.reason === 'query_error' || dropped.reason === 'unavailable'),
  );

  // The `unavailable` branch — a read that could not even be attempted. A
  // missing env var is the real shape of this: the client constructor throws
  // before any request is made.
  const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  installStub(supporting(rows([LISTING]), rows([])));
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  const unconstructable = await getEntryByDetailSlugResult(SLUG);
  process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
  check(
    'a client that cannot be constructed is unavailable, never "no such listing"',
    unconstructable.ok === false && unconstructable.reason === 'unavailable',
  );

  // Malformed input still reaches the query (the grammar check lives on the
  // route); what matters is that a weird slug cannot be answered from a
  // failed read either.
  installStub(supporting(TIMEOUT, rows([])));
  const weird = await getEntryByDetailSlugResult("../../etc/passwd' or 1=1--");
  check('a malformed slug over a failed read is still a failure, never a null', weird.ok === false);

  installStub(supporting(rows([LISTING]), rows([])));
  const weirdOk = await getEntryByDetailSlugResult("../../etc/passwd' or 1=1--");
  check(
    'a malformed slug over a healthy read is a successful null',
    weirdOk.ok && weirdOk.data === null,
  );
  check(
    'the malformed slug was sent as a filter value, never spliced into the path',
    requestLog.every((t) => t === 'locations'),
  );
}

/* ======================================================================
 * 2. The fail-soft wrapper is UNCHANGED for callers that want it.
 * ==================================================================== */

async function failSoftContract() {
  installStub(supporting(rows([LISTING]), rows([])));
  check(
    'fail-soft wrapper still returns the entry',
    (await getEntryByDetailSlug(SLUG))?.name === 'Petro Knoxville',
  );

  installStub(supporting(rows([LISTING]), rows([])));
  check(
    'fail-soft wrapper still returns null for an unknown slug',
    (await getEntryByDetailSlug('nope-zz')) === null,
  );

  installStub(supporting(TIMEOUT, rows([])));
  check(
    'fail-soft wrapper still returns null on failure (no caller broken)',
    (await getEntryByDetailSlug(SLUG)) === null,
  );

  installStub(supporting(TRANSPORT, rows([])));
  check(
    'fail-soft wrapper swallows a transport failure exactly as before',
    (await getEntryByDetailSlug(SLUG)) === null,
  );

  // The sitemap's gate is the one legitimate fail-soft consumer: a failed read
  // omits a URL, it never decides a response status.
  installStub(supporting(rows([LISTING]), rows([])));
  const gated = await getEntryByDetailSlug(SLUG);
  check(
    'the sitemap gate still evaluates a real entry',
    gated !== null && isDetailIndexable(gated),
  );
}

/* ======================================================================
 * 3. The redirect lookup — the other read on the 404 branch.
 * ==================================================================== */

async function redirectContract() {
  installStub(supporting(rows([LISTING]), rows([REDIRECT_ROW])));
  const found = await resolveSlugRedirectResult(RETIRED_SLUG);
  check(
    'a retired slug resolves ok to the current canonical slug',
    found.ok && found.data?.currentSlug === SLUG,
  );

  installStub(supporting(rows([LISTING]), rows([])));
  const none = await resolveSlugRedirectResult(RETIRED_SLUG);
  check('no redirect row is a SUCCESSFUL null', none.ok && none.data === null);

  installStub(supporting(rows([LISTING]), rows([{ ...REDIRECT_ROW, old_slug: SLUG }])));
  const selfLoop = await resolveSlugRedirectResult(SLUG);
  check(
    'the self-loop guard still returns a successful null',
    selfLoop.ok && selfLoop.data === null,
  );

  installStub(
    supporting(
      rows([LISTING]),
      rows([
        {
          ...REDIRECT_ROW,
          locations: { detail_slug: SLUG, is_published: false, deleted_at: null },
        },
      ]),
    ),
  );
  const unpublishedDest = await resolveSlugRedirectResult(RETIRED_SLUG);
  check(
    'an unpublished destination is a successful null, never a redirect',
    unpublishedDest.ok && unpublishedDest.data === null,
  );

  installStub(supporting(rows([LISTING]), NO_RELATION));
  const preMigration = await resolveSlugRedirectResult(RETIRED_SLUG);
  check(
    '42P01 (table absent, pre-023) stays a successful null — documented behaviour kept',
    preMigration.ok && preMigration.data === null,
  );

  installStub(supporting(rows([LISTING]), NO_RELATION_CACHED));
  const preMigrationCached = await resolveSlugRedirectResult(RETIRED_SLUG);
  check(
    "PGRST205 (PostgREST's own 'no such relation') stays a successful null",
    preMigrationCached.ok && preMigrationCached.data === null,
  );

  installStub(supporting(rows([LISTING]), TIMEOUT));
  const redirectTimeout = await resolveSlugRedirectResult(RETIRED_SLUG);
  check(
    'a timeout on the redirect table is a FAILURE, not "no redirect"',
    redirectTimeout.ok === false,
  );
  check(
    'the redirect failure carries only its SQLSTATE',
    redirectTimeout.ok === false && redirectTimeout.code === '57014',
  );

  installStub(supporting(rows([LISTING]), TRANSPORT));
  const redirectDropped = await resolveSlugRedirectResult(RETIRED_SLUG);
  check(
    'a dropped connection on the redirect table is a failure, never "no redirect"',
    redirectDropped.ok === false,
  );

  const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  installStub(supporting(rows([LISTING]), rows([REDIRECT_ROW])));
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  const redirectUnconstructable = await resolveSlugRedirectResult(RETIRED_SLUG);
  process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
  check(
    'a redirect client that cannot be constructed is unavailable, never "no redirect"',
    redirectUnconstructable.ok === false && redirectUnconstructable.reason === 'unavailable',
  );

  // An invalid slug is answerable without any read at all.
  installStub({ ...supporting(rows([LISTING]), TIMEOUT) });
  requestLog = [];
  const invalid = await resolveSlugRedirectResult('NOT A SLUG!!');
  check(
    'an invalid slug resolves without touching the database',
    invalid.ok && invalid.data === null,
  );
  check('…and issued no request even though the table was failing', requestLog.length === 0);

  installStub(supporting(rows([LISTING]), TIMEOUT));
  check(
    'the fail-soft redirect wrapper is unchanged (null on failure)',
    (await resolveSlugRedirect(RETIRED_SLUG)) === null,
  );
}

/* ======================================================================
 * 4. THE PAGE. Which terminal does the real component reach?
 * ==================================================================== */

type Terminal =
  | { kind: '200' }
  | { kind: '404' }
  | { kind: '301'; to: string }
  | { kind: '500'; operation: string };

async function runPage(slug: string): Promise<Terminal> {
  try {
    await ListingDetailPage({ params: { slug } });
    return { kind: '200' };
  } catch (e) {
    if (e instanceof DirectoryUnavailableError) return { kind: '500', operation: e.operation };
    const digest = String((e as { digest?: unknown })?.digest ?? '');
    if (digest === 'NEXT_NOT_FOUND') return { kind: '404' };
    if (digest.startsWith('NEXT_REDIRECT')) return { kind: '301', to: digest.split(';')[2] ?? '' };
    throw e;
  }
}

/**
 * Read what the page COMPOSED without evaluating any component: collect the
 * string children, every `href`/`path` prop, whether a JsonLd element is
 * present, and any `entry`-shaped prop handed to a child.
 */
type Walked = {
  text: string[];
  paths: string[];
  /** JSON-LD payloads, serialized — they are plain JSON by construction. */
  schema: string[];
  hasJsonLd: boolean;
  entries: { id?: string; name?: string }[];
};

function walkTree(node: unknown, acc?: Walked): Walked {
  const out: Walked = acc ?? { text: [], paths: [], schema: [], hasJsonLd: false, entries: [] };
  if (node == null || typeof node === 'boolean') return out;
  if (typeof node === 'string') {
    out.text.push(node);
    return out;
  }
  if (typeof node === 'number') {
    out.text.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) walkTree(child, out);
    return out;
  }
  if (!isValidElement(node)) return out;
  const el = node as ReactElement<Record<string, unknown>>;
  const typeName =
    typeof el.type === 'string' ? el.type : ((el.type as { name?: string })?.name ?? '');
  if (typeName === 'JsonLd') {
    out.hasJsonLd = true;
    // The schema prop is already plain JSON — the page built it from the entry
    // before creating the element, so this is what a crawler would receive.
    try {
      out.schema.push(JSON.stringify((el.props as { schema?: unknown }).schema ?? null));
    } catch {
      /* a non-serializable schema would be a defect of its own, not of this walk */
    }
  }
  for (const [key, value] of Object.entries(el.props ?? {})) {
    if (key === 'children') continue;
    if ((key === 'href' || key === 'path') && typeof value === 'string') out.paths.push(value);
    if (typeof value === 'string') out.text.push(value);
    if (value && typeof value === 'object') {
      const maybe = value as { id?: unknown; name?: unknown };
      if (typeof maybe.id === 'string' && typeof maybe.name === 'string') {
        out.entries.push({ id: maybe.id, name: maybe.name });
      }
      // Breadcrumb/related arrays carry their own href/path entries.
      if (Array.isArray(value)) {
        for (const item of value) {
          const rec = item as { href?: unknown; path?: unknown; name?: unknown; id?: unknown };
          if (typeof rec?.href === 'string') out.paths.push(rec.href);
          if (typeof rec?.path === 'string') out.paths.push(rec.path);
          if (typeof rec?.name === 'string') out.text.push(rec.name);
          if (typeof rec?.id === 'string' && typeof rec?.name === 'string') {
            out.entries.push({ id: rec.id, name: rec.name });
          }
        }
      }
    }
  }
  walkTree((el.props as { children?: unknown })?.children, out);
  return out;
}

async function pageDecisions() {
  installStub(supporting(rows([LISTING]), rows([])));
  check('200: a published listing renders', (await runPage(SLUG)).kind === '200');

  installStub(supporting(rows([LISTING]), rows([])));
  check(
    '404: a slug the read did not match',
    (await runPage('no-such-listing-nowhere-zz')).kind === '404',
  );

  installStub(supporting(rows([{ ...LISTING, is_published: false }]), rows([])));
  check('404: an unpublished listing', (await runPage(SLUG)).kind === '404');

  installStub(supporting(rows([{ ...LISTING, deleted_at: '2026-08-01T00:00:00Z' }]), rows([])));
  check('404: a soft-deleted listing', (await runPage(SLUG)).kind === '404');

  installStub({ ...supporting(TIMEOUT, TIMEOUT) });
  requestLog = [];
  check(
    '404: an invalid slug, with no read at all',
    (await runPage('NOT A SLUG!!')).kind === '404',
  );
  check('…and the invalid slug issued zero database requests', requestLog.length === 0);

  installStub(supporting(rows([LISTING]), rows([REDIRECT_ROW])));
  const redirected = await runPage(RETIRED_SLUG);
  check('301: a retired slug still redirects to the canonical one', redirected.kind === '301');
  check(
    '301: to the CURRENT canonical detail URL',
    redirected.kind === '301' && redirected.to === `/directory/location/${SLUG}`,
  );

  /* --- the defect, at the page --- */
  installStub(supporting(TIMEOUT, rows([])));
  const timedOut = await runPage(SLUG);
  check('THE DEFECT AT THE PAGE: a timed-out entry read is 500, NOT 404', timedOut.kind === '500');
  check(
    'the 500 names the operation that failed',
    timedOut.kind === '500' && timedOut.operation === 'listing_detail.entry',
  );

  installStub(supporting(TRANSPORT, rows([])));
  check(
    'a dropped connection on the entry read is 500, not 404',
    (await runPage(SLUG)).kind === '500',
  );

  installStub(supporting(rows([LISTING]), TIMEOUT));
  const redirectTimedOut = await runPage(RETIRED_SLUG);
  check('a timed-out REDIRECT lookup is 500, not 404', redirectTimedOut.kind === '500');
  check(
    'the 500 names the redirect operation',
    redirectTimedOut.kind === '500' && redirectTimedOut.operation === 'listing_detail.redirect',
  );

  installStub(supporting(rows([LISTING]), TRANSPORT));
  check(
    'a dropped connection on the redirect lookup is 500, not 404',
    (await runPage('nope-nope-zz')).kind === '500',
  );

  // Pre-023 remains a 404, because there the answer really is "no redirects".
  installStub(supporting(rows([LISTING]), NO_RELATION));
  check(
    'pre-023 (no redirect table) still 404s an unknown slug',
    (await runPage('nope-nope-zz')).kind === '404',
  );

  /* --- the supporting reads stay fail-soft: a nearby-section blip must not
         take down a page whose own subject resolved --- */
  installStub({
    locations: rows([LISTING]),
    directory_slug_redirects: rows([]),
    location_reviews: TIMEOUT,
    directory_sponsors: TIMEOUT,
  });
  check(
    'a failed reviews/sponsors read still renders the page (200)',
    (await runPage(SLUG)).kind === '200',
  );

  /* --- NO-REGRESSION: the 200 path still composes the page it always did.
         This change moves no markup, so nothing here is new behaviour — the
         point is that fixing the 404 decision did not disturb the page a
         driver actually sees. The tree is WALKED rather than rendered:
         `renderToStaticMarkup` cannot evaluate the async server components
         nested inside it (SponsorSlot, DetailNearbySections), and forcing it
         to would test React, not this page. Walking reads the props the page
         itself computed, which is exactly the part this change could break.
         No markup means no width-dependent behaviour to re-bench. --- */
  installStub(supporting(rows([LISTING]), rows([])));
  const tree = (await ListingDetailPage({ params: { slug: SLUG } })) as ReactElement;
  check('the healthy path returns a React tree, not null', isValidElement(tree));
  const walked = walkTree(tree);
  const composedText = walked.text.join(' | ');
  check('the composed page names the listing', composedText.includes('Petro Knoxville'));
  check(
    'the composed page carries its city and state',
    composedText.includes('Knoxville') && composedText.includes('TN'),
  );
  // Links reach the tree two ways: as `href`/`path` props, and folded into the
  // JSON-LD a crawler reads. Both are things this page computed from the entry.
  const composedAll = [...walked.text, ...walked.paths, ...walked.schema].join(' | ');
  check(
    'the composed page carries the canonical detail path',
    composedAll.includes(`/directory/location/${SLUG}`),
  );
  check(
    'the composed page still links the covering exit page',
    composedAll.includes('/directory/i75/exit-369'),
  );
  check(
    'the composed page still carries breadcrumbs to /directory',
    walked.paths.includes('/directory') || composedAll.includes('/directory'),
  );
  check('the composed page still emits JSON-LD schema', walked.hasJsonLd);
  check(
    'the composed page still carries the entry it resolved, not a placeholder',
    walked.entries.some((e) => e.id === LISTING.id && e.name === 'Petro Knoxville'),
  );
}

/* ======================================================================
 * 5. Metadata never decides the status.
 * ==================================================================== */

async function metadataContract() {
  installStub(supporting(rows([LISTING]), rows([])));
  const meta = await listingMetadata({ params: { slug: SLUG } });
  check(
    'metadata: a real listing gets a title',
    typeof meta.title === 'string' && meta.title.length > 0,
  );

  for (const [label, answer] of [
    ['a timeout', TIMEOUT],
    ['a dropped connection', TRANSPORT],
  ] as const) {
    installStub(supporting(answer, rows([])));
    let threw = false;
    let empty = false;
    try {
      empty = Object.keys(await listingMetadata({ params: { slug: SLUG } })).length === 0;
    } catch {
      threw = true;
    }
    check(`metadata: ${label} returns {} and never throws`, !threw && empty);
  }

  installStub(supporting(rows([LISTING]), rows([])));
  check(
    'metadata: an unknown slug returns {}',
    Object.keys(await listingMetadata({ params: { slug: 'nope-nope-zz' } })).length === 0,
  );
}

/* ======================================================================
 * 6. Races. Two renders in flight cannot borrow each other's answer.
 * ==================================================================== */

async function raceContract() {
  /**
   * These reads hold no module-level state, so two renders in flight must each
   * report their own outcome. Proved by answering PER REQUEST and holding each
   * answer open long enough that the flights genuinely overlap — flipping a
   * shared switch between two calls would prove nothing, because neither call
   * has reached `fetch` yet when the switch flips.
   */
  const SLUG_B = 'ta-knoxville-west-knoxville-tn';
  const LISTING_B = {
    ...LISTING,
    id: '22222222-2222-4222-8222-222222222222',
    name: 'TA Knoxville West',
    slug: 'ta-knoxville-west',
    detail_slug: SLUG_B,
  };
  const wantsB = (url: URL) => url.searchParams.get('detail_slug') === `eq.${SLUG_B}`;

  // The FAILING read settles first, while the healthy one is still open.
  installStub({
    ...supporting(rows([LISTING]), rows([])),
    locations: (url) =>
      wantsB(url)
        ? { ...TIMEOUT, delayMs: 5 }
        : { kind: 'rows', rows: [LISTING, LISTING_B], delayMs: 25 },
  });
  const [slowOk, fastFail] = await Promise.all([
    getEntryByDetailSlugResult(SLUG),
    getEntryByDetailSlugResult(SLUG_B),
  ]);
  check(
    'a failure settling mid-flight never turns an open healthy read into a failure',
    slowOk.ok && slowOk.data?.name === 'Petro Knoxville',
    slowOk,
  );
  check('…and the failing read still reports its own failure', fastFail.ok === false, fastFail);

  // …and the other way round: the healthy read settles first.
  installStub({
    ...supporting(rows([LISTING]), rows([])),
    locations: (url) =>
      wantsB(url)
        ? { ...TIMEOUT, delayMs: 25 }
        : { kind: 'rows', rows: [LISTING, LISTING_B], delayMs: 5 },
  });
  const [fastOk, slowFail] = await Promise.all([
    getEntryByDetailSlugResult(SLUG),
    getEntryByDetailSlugResult(SLUG_B),
  ]);
  check('a success settling mid-flight never rescues an open failing read', slowFail.ok === false);
  check(
    '…and the healthy read is unaffected',
    fastOk.ok && fastOk.data?.name === 'Petro Knoxville',
  );

  // A whole page's worth of overlapping renders: every one gets its own answer.
  installStub({
    ...supporting(rows([LISTING]), rows([])),
    locations: (url) =>
      wantsB(url)
        ? { ...TIMEOUT, delayMs: 1 + (Date.now() % 7) }
        : { kind: 'rows', rows: [LISTING, LISTING_B], delayMs: 1 + (Date.now() % 5) },
  });
  const mixed = await Promise.all(
    Array.from({ length: 20 }, (_, i) => getEntryByDetailSlugResult(i % 2 === 0 ? SLUG : SLUG_B)),
  );
  check(
    'ten healthy reads interleaved with ten failing ones all resolve correctly',
    mixed.every((r, i) =>
      i % 2 === 0 ? r.ok && r.data?.name === 'Petro Knoxville' : r.ok === false,
    ),
  );
  check(
    'no interleaved failure was ever reported as a successful null',
    mixed.filter((r) => r.ok && r.data === null).length === 0,
  );

  // The same interleaving through the PAGE: a failing render cannot 404 while
  // a healthy one renders, and vice versa.
  installStub({
    ...supporting(rows([LISTING]), rows([])),
    locations: (url) =>
      wantsB(url)
        ? { ...TIMEOUT, delayMs: 15 }
        : { kind: 'rows', rows: [LISTING, LISTING_B], delayMs: 3 },
    location_reviews: rows([]),
    directory_sponsors: rows([]),
  });
  const [okPage, failPage] = await Promise.all([runPage(SLUG), runPage(SLUG_B)]);
  check('concurrent renders: the healthy listing still renders 200', okPage.kind === '200', okPage);
  check(
    'concurrent renders: the failing listing is 500, never 404',
    failPage.kind === '500',
    failPage,
  );
}

/* ======================================================================
 * 7. Security boundary + structure (what a run cannot show).
 * ==================================================================== */

function securityAndStructure() {
  check(
    'the entry read uses the cookieless ANON client, never the service role',
    /getEntryByDetailSlugResult[\s\S]{0,600}createStaticClient\(\)/.test(dataSrc) &&
      !/getEntryByDetailSlugResult[\s\S]{0,600}createAdminClient/.test(dataSrc),
  );
  check(
    'the entry read keeps its published + not-deleted filters',
    /getEntryByDetailSlugResult[\s\S]{0,800}\.eq\('is_published', true\)[\s\S]{0,200}\.is\('deleted_at', null\)/.test(
      dataSrc,
    ),
  );
  check(
    'no credential is read in the redirect module',
    !/SERVICE_ROLE|ANON_KEY|apikey|SUPABASE_[A-Z_]*KEY|SECRET|TOKEN|PASSWORD/i.test(redirectCode),
  );
  check(
    'the redirect module reads no environment value at all',
    !/process\.env/.test(redirectCode),
  );
  check(
    'the redirect failure surfaces only a short SQLSTATE via the shared helper',
    /failureCode\(error\)/.test(redirectCode) &&
      !/error\.message|error\.details|error\.hint|JSON\.stringify\(error/.test(redirectCode),
  );
  check(
    'the page logs nothing itself — failures go through the shared logger',
    !/console\.|log\.(info|warn|error)\(/.test(pageCode),
  );
  const failureCalls = pageCode.match(/throwDirectoryUnavailable\([^)]*\)/g) ?? [];
  check('the page has exactly two failure terminals', failureCalls.length === 2, failureCalls);
  check(
    'neither failure terminal carries row data — only an operation name, the path, and the result',
    failureCalls.every((c) =>
      /^throwDirectoryUnavailable\('listing_detail\.(entry|redirect)', path, (result|redirect)\)$/.test(
        c,
      ),
    ),
    failureCalls,
  );

  /* --- structure: every 404 on this route is guarded by a successful read --- */
  const notFoundCalls = (pageCode.match(/notFound\(\)/g) ?? []).length;
  check(
    'the page calls notFound() exactly twice (invalid slug, successful miss)',
    notFoundCalls === 2,
    notFoundCalls,
  );
  check(
    'an invalid slug 404s from the PURE grammar check, with no read',
    /if \(!isValidDetailSlug\(params\.slug\)\) notFound\(\)/.test(pageCode),
  );
  check(
    'a failed entry read throws instead of 404ing',
    /if \(!result\.ok\) throwDirectoryUnavailable\('listing_detail\.entry'/.test(pageCode),
  );
  check(
    'a failed redirect lookup throws instead of 404ing',
    /if \(!redirect\.ok\) throwDirectoryUnavailable\('listing_detail\.redirect'/.test(pageCode),
  );
  check(
    'the surviving 404 is reached only through a SUCCESSFUL null entry',
    /if \(entry === null\) \{[\s\S]{0,600}notFound\(\);/.test(pageCode),
  );
  check(
    'the render path takes no fail-soft entry or redirect read',
    !/[^a-zA-Z]getEntryByDetailSlug\(/.test(pageCode) &&
      !/[^a-zA-Z]resolveSlugRedirect\(/.test(pageCode),
  );
  check(
    'the page reads the entry through the request-scoped strict wrapper',
    /cachedEntryByDetailSlugResult\(/.test(pageCode),
  );
  check(
    'the wrapper binds exactly the strict variant via React cache()',
    /cachedEntryByDetailSlugResult = cache\(getEntryByDetailSlugResult\)/.test(
      read('src/lib/directory/request-cache.ts'),
    ),
  );
  check(
    'metadata still returns {} rather than deciding a status',
    /if \(!result\.ok \|\| !result\.data\) return \{\};/.test(pageCode),
  );
  check(
    'generateStaticParams stays fail-soft so a DB-less build cannot bake 404s',
    /generateStaticParams\(\)[\s\S]{0,200}await getPublishedDetailSlugs\(\)/.test(pageCode),
  );
  check(
    'the route is still ISR at 300s (the reason a false 404 persists)',
    /export const revalidate = 300/.test(pageCode),
  );

  /* --- no scope creep --- */
  check(
    'no migration was added for this change',
    !fs.existsSync(path.join(process.cwd(), 'supabase/migrations/057_directory_detail_read.sql')),
  );
  check(
    'the category page is untouched (still fail-soft on purpose)',
    !/unwrapDirectoryRead|throwDirectoryUnavailable/.test(
      read('src/app/(directory)/directory/[category]/page.tsx'),
    ),
  );
  check(
    'the exit page still owns its own three-outcome resolution',
    /status: 'unavailable'/.test(read('src/app/(directory)/directory/[category]/[exit]/page.tsx')),
  );
}

/* ======================================================================
 * 8. The contract type itself still separates the three outcomes.
 * ==================================================================== */

function contractShape() {
  const okEntry: DirectoryReadResult<string | null> = { ok: true, data: 'entry' };
  const okNull: DirectoryReadResult<string | null> = { ok: true, data: null };
  const err: DirectoryReadResult<string | null> = {
    ok: false,
    reason: 'query_error',
    code: '57014',
  };
  check(
    'a successful null and a failure are distinguishable',
    okNull.ok === true && err.ok === false,
  );
  check(
    'a successful null is not a successful entry',
    okNull.ok && okEntry.ok && okNull.data !== okEntry.data,
  );
  check(
    'the failure carries a reason and a short code only',
    err.ok === false && err.reason === 'query_error' && (err.code ?? '').length <= 12,
  );
}

async function main() {
  const realFetch = globalThis.fetch;
  await loadPageModule();
  try {
    contractShape();
    securityAndStructure();
    await readContract();
    await failSoftContract();
    await redirectContract();
    await pageDecisions();
    await metadataContract();
    await raceContract();
  } finally {
    globalThis.fetch = realFetch;
  }
  console.log(`directory-detail-false-404: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
