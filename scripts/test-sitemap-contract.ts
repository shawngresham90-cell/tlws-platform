/**
 * Sitemap + robots contract (offline, fixture-backed).
 *
 * scripts/test-sitemap.ts covers the static half of the generator — the DB
 * reads fail soft offline, so everything data-driven (state pages, corridors,
 * exits, corridor-flow steps, per-listing detail pages, Knowledge Center)
 * was only ever checked by crawling a live deploy. This harness closes that
 * gap: a minimal PostgREST fake answers the generator's real Supabase reads
 * from fixtures, so the full data-driven contract runs offline and in CI.
 *
 * What is asserted is the CONTRACT, not the spelling: which route families
 * appear, that every indexable published listing is represented exactly once,
 * that thin/unpublished/deleted rows stay out, that URLs are well formed on
 * the canonical origin, that lastModified is emitted ONLY from a persisted
 * source date (locations.updated_at / kc_articles.updated_at — never the
 * clock, so hourly regeneration cannot make unchanged URLs look modified),
 * and that robots.ts advertises the sitemap while no emitted URL falls under
 * a robots disallow rule.
 *
 * Run:
 *   npx esbuild scripts/test-sitemap-contract.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-sitemap-contract.cjs && node /tmp/test-sitemap-contract.cjs
 */
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import { SITE } from '@/lib/seo/site';
import { getEntryByDetailSlug } from '@/lib/directory/data';
import { isDetailIndexable } from '@/lib/directory/detail';
import { installPostgrestFake } from './helpers/postgrest-fake';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

/* ---------------------------------------------------------------- fixtures */

/**
 * Eight locations exercising every gate the sitemap applies:
 *  - loc-001/002: GA on I-75 (exits 333/320), complete rows → detail pages,
 *    state + corridor + exit URLs, parking-flow GA/I-75.
 *  - loc-003: TN CAT scale on I-40 exit 7B → cat-scales flow TN/I-40 and the
 *    lettered-exit slug; null updated_at → NO lastModified (never the clock).
 *  - loc-004: TX, published but NO location identity (no address, corridor,
 *    or coordinates) → its state/flow URLs exist, its detail page must NOT.
 *  - loc-005: FL, unpublished → invisible everywhere.
 *  - loc-006: CA, soft-deleted → invisible everywhere.
 *  - loc-007: GA welcome center — corridor identity ONLY (interstate, no
 *    address, no exit, no coords) + two real signals → detail page present
 *    (PR-B: rest areas are located by corridor, not street address).
 *  - loc-008: GA, address + ONE real signal; raw amenities empty, so only
 *    the synthetic overnight chip could rescue it — its detail page must be
 *    absent (PR-B: rendered chips are not evidence).
 */
const LOCATIONS = [
  {
    id: 'loc-001',
    name: "Love's Travel Stop #333",
    category_slug: 'truck-stops',
    state: 'GA',
    city: 'Dalton',
    slug: 'loves-333-dalton',
    address: '100 Connector 3',
    zip: '30720',
    phone: '706-555-0101',
    website: 'https://example.com/loves-333',
    description: 'Full-service truck stop off I-75 with overnight parking and showers.',
    parking_spaces: 80,
    amenities: ['Showers'],
    free_parking: true,
    paid_parking: false,
    reserved_parking: false,
    overnight_parking: true,
    tpc_url: null,
    is_featured: false,
    is_indexable: false,
    lat: 34.77,
    lng: -84.97,
    interstate: 'I-75',
    exit_number: '333',
    mile_marker: null,
    mile_marker_source: null,
    overnight_status: 'confirmed',
    overnight_status_source: 'site-visit',
    created_at: '2026-05-01T00:00:00Z',
    detail_slug: 'love-s-travel-stop-333-dalton-ga',
    updated_at: '2026-06-15T12:00:00Z',
    verified_at: null,
    is_published: true,
    deleted_at: null,
  },
  {
    id: 'loc-002',
    name: 'Carbondale Truck Lot',
    category_slug: 'parking',
    state: 'GA',
    city: 'Dalton',
    slug: 'carbondale-lot',
    address: '55 Carbondale Rd',
    zip: '30721',
    phone: null,
    website: null,
    description: 'Gravel overnight lot at exit 320 with room for twenty trucks and easy reentry.',
    parking_spaces: 20,
    amenities: [],
    free_parking: true,
    paid_parking: false,
    reserved_parking: false,
    overnight_parking: true,
    tpc_url: null,
    is_featured: false,
    is_indexable: false,
    lat: 34.66,
    lng: -84.99,
    interstate: 'I-75',
    exit_number: '320',
    mile_marker: null,
    mile_marker_source: null,
    overnight_status: 'confirmed',
    overnight_status_source: 'driver-report',
    created_at: '2026-05-02T00:00:00Z',
    detail_slug: 'carbondale-truck-lot-dalton-ga',
    updated_at: '2026-07-01T09:30:00Z',
    verified_at: null,
    is_published: true,
    deleted_at: null,
  },
  {
    id: 'loc-003',
    name: 'CAT Scale — Knoxville West',
    category_slug: 'cat-scales',
    state: 'TN',
    city: 'Knoxville',
    slug: 'cat-knoxville-west',
    address: '900 Watt Rd',
    zip: '37932',
    phone: '865-555-0100',
    website: null,
    description: null,
    parking_spaces: null,
    amenities: [],
    free_parking: null,
    paid_parking: null,
    reserved_parking: null,
    overnight_parking: null,
    tpc_url: null,
    is_featured: false,
    is_indexable: false,
    lat: 35.88,
    lng: -84.15,
    interstate: 'I-40',
    exit_number: '7B',
    mile_marker: null,
    mile_marker_source: null,
    overnight_status: null,
    overnight_status_source: null,
    created_at: '2026-05-03T00:00:00Z',
    detail_slug: 'cat-scale-knoxville-west-knoxville-tn',
    updated_at: null,
    verified_at: null,
    is_published: true,
    deleted_at: null,
  },
  {
    id: 'loc-004',
    name: 'Amarillo Roadside Stop',
    category_slug: 'truck-stops',
    state: 'TX',
    city: 'Amarillo',
    slug: 'amarillo-roadside',
    address: null,
    zip: null,
    phone: null,
    website: null,
    description: null,
    parking_spaces: null,
    amenities: [],
    free_parking: null,
    paid_parking: null,
    reserved_parking: null,
    overnight_parking: null,
    tpc_url: null,
    is_featured: false,
    is_indexable: false,
    lat: null,
    lng: null,
    interstate: null,
    exit_number: null,
    mile_marker: null,
    mile_marker_source: null,
    overnight_status: null,
    overnight_status_source: null,
    created_at: '2026-05-04T00:00:00Z',
    detail_slug: 'amarillo-roadside-stop-amarillo-tx',
    updated_at: '2026-07-10T08:00:00Z',
    verified_at: null,
    is_published: true,
    deleted_at: null,
  },
  {
    id: 'loc-005',
    name: 'Unpublished Fuel Plaza',
    category_slug: 'truck-stops',
    state: 'FL',
    city: 'Ocala',
    slug: 'unpublished-plaza',
    address: '1 Hidden Way',
    zip: '34470',
    phone: '352-555-0100',
    website: 'https://example.com/hidden',
    description: 'Should never appear anywhere public until it is published.',
    parking_spaces: 50,
    amenities: ['Showers'],
    free_parking: true,
    paid_parking: false,
    reserved_parking: false,
    overnight_parking: true,
    tpc_url: null,
    is_featured: false,
    is_indexable: false,
    lat: 29.19,
    lng: -82.14,
    interstate: 'I-75',
    exit_number: '352',
    mile_marker: null,
    mile_marker_source: null,
    overnight_status: 'confirmed',
    overnight_status_source: 'site-visit',
    created_at: '2026-05-05T00:00:00Z',
    detail_slug: 'unpublished-fuel-plaza-ocala-fl',
    updated_at: '2026-07-11T08:00:00Z',
    verified_at: null,
    is_published: false,
    deleted_at: null,
  },
  {
    id: 'loc-006',
    name: 'Deleted Weigh Station',
    category_slug: 'weigh-stations',
    state: 'CA',
    city: 'Barstow',
    slug: 'deleted-weigh',
    address: '2 Gone St',
    zip: '92311',
    phone: '760-555-0100',
    website: null,
    description: 'Soft-deleted row — must be invisible to every public read.',
    parking_spaces: null,
    amenities: [],
    free_parking: null,
    paid_parking: null,
    reserved_parking: null,
    overnight_parking: null,
    tpc_url: null,
    is_featured: false,
    is_indexable: false,
    lat: 34.89,
    lng: -117.02,
    interstate: 'I-15',
    exit_number: '184',
    mile_marker: null,
    mile_marker_source: null,
    overnight_status: null,
    overnight_status_source: null,
    created_at: '2026-05-06T00:00:00Z',
    detail_slug: 'deleted-weigh-station-barstow-ca',
    updated_at: '2026-07-12T08:00:00Z',
    verified_at: null,
    is_published: true,
    deleted_at: '2026-07-20T00:00:00Z',
  },
  {
    id: 'loc-007',
    name: 'Georgia Welcome Center — Ringgold',
    category_slug: 'parking',
    state: 'GA',
    city: 'Ringgold',
    slug: 'ga-welcome-center-ringgold',
    address: null,
    zip: null,
    phone: null,
    website: null,
    description:
      'State welcome center on I-75 southbound with dedicated truck parking rows and staffed restrooms.',
    parking_spaces: null,
    amenities: ['Restrooms'],
    free_parking: null,
    paid_parking: null,
    reserved_parking: null,
    overnight_parking: null,
    tpc_url: null,
    is_featured: false,
    is_indexable: false,
    lat: null,
    lng: null,
    interstate: 'I-75',
    exit_number: null,
    mile_marker: null,
    mile_marker_source: null,
    overnight_status: null,
    overnight_status_source: null,
    created_at: '2026-05-07T00:00:00Z',
    detail_slug: 'georgia-welcome-center-ringgold-ga',
    updated_at: null,
    verified_at: null,
    is_published: true,
    deleted_at: null,
  },
  {
    id: 'loc-008',
    name: 'Chip Trap Stop',
    category_slug: 'truck-stops',
    state: 'GA',
    city: 'Dalton',
    slug: 'chip-trap-stop',
    address: '1 Chip Way',
    zip: '30720',
    phone: null,
    website: null,
    description:
      'Has an address and a description but nothing else — one real signal is not enough.',
    parking_spaces: null,
    amenities: [],
    free_parking: null,
    paid_parking: null,
    reserved_parking: null,
    overnight_parking: null,
    tpc_url: null,
    is_featured: false,
    is_indexable: false,
    lat: null,
    lng: null,
    interstate: null,
    exit_number: null,
    mile_marker: null,
    mile_marker_source: null,
    overnight_status: null,
    overnight_status_source: null,
    created_at: '2026-05-08T00:00:00Z',
    detail_slug: 'chip-trap-stop-dalton-ga',
    updated_at: '2026-07-13T08:00:00Z',
    verified_at: null,
    is_published: true,
    deleted_at: null,
  },
];

const KC_CATEGORIES = [
  { slug: 'regulations', is_active: true },
  { slug: 'retired-topic', is_active: false },
];

const KC_ARTICLES = [
  {
    slug: 'eld-basics',
    updated_at: '2026-06-01T00:00:00Z',
    status: 'published',
    kc_categories: { slug: 'regulations' },
  },
  {
    slug: 'unfinished-draft',
    updated_at: '2026-06-02T00:00:00Z',
    status: 'draft',
    kc_categories: { slug: 'regulations' },
  },
];

const TABLES: Record<string, Record<string, unknown>[]> = {
  locations: LOCATIONS,
  kc_categories: KC_CATEGORIES,
  kc_articles: KC_ARTICLES,
};

/* ------------------------------------------------------------------ tests */

/**
 * Pin the no-argument Date constructor (and Date.now) to a fixed instant, so
 * two sitemap generations can run under different "clocks". Argument-ful
 * constructions (new Date(updated_at)) keep their real behavior — those are
 * the only Date uses the honest-lastmod contract permits.
 */
const RealDate = Date;
function withFakeClock(iso: string): () => void {
  const fixed = new RealDate(iso).getTime();
  class FakeDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(fixed);
      else super(...(args as [string | number | Date]));
    }
    static now(): number {
      return fixed;
    }
  }
  (globalThis as { Date: DateConstructor }).Date = FakeDate as DateConstructor;
  return () => {
    (globalThis as { Date: DateConstructor }).Date = RealDate;
  };
}

async function main() {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://placeholder.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'placeholder-anon-key';
  installPostgrestFake(TABLES);

  const entries = await sitemap();
  const urls = entries.map((e) => e.url);
  const urlSet = new Set(urls);
  const has = (path: string) => urlSet.has(`${SITE.url}${path}`);

  check('generation succeeds with data-backed reads', entries.length > 0, entries.length);

  /* ------------------------------------------------ required static routes */
  for (const path of [
    '/academy',
    '/academy/apply',
    '/cdl-pre-school',
    '/directory',
    '/knowledge',
    '/practice-tests',
    '/store',
    '/founders',
    '/trip-planner',
    // Legal pages — /terms was the one indexable footer-linked page missing
    // from the sitemap (2026-08-17 audit).
    '/privacy',
    '/terms',
    '/sms-terms',
  ]) {
    check(`static route ${path} present`, has(path));
  }
  check('/terms appears exactly once', urls.filter((u) => u === `${SITE.url}/terms`).length === 1);
  check('homepage present', urlSet.has(SITE.url));

  /* ------------------------------------- state pages, from published rows */
  for (const path of [
    '/directory/georgia',
    '/directory/georgia/top-truck-stops',
    '/directory/tennessee',
    '/directory/texas',
  ]) {
    check(`state route ${path} present`, has(path));
  }
  check('unpublished-only state absent (/directory/florida)', !has('/directory/florida'));
  check('deleted-only state absent (/directory/california)', !has('/directory/california'));

  /* ------------------------------------------------ corridors and exits */
  for (const path of [
    '/directory/i75',
    '/directory/i75/truck-parking',
    '/directory/i40',
    '/directory/i75/exit-333',
    '/directory/i75/exit-320',
    '/directory/i40/exit-7b',
  ]) {
    check(`corridor route ${path} present`, has(path));
  }
  check(
    'deleted-only corridor absent (/directory/i15)',
    !has('/directory/i15') && !has('/directory/i15/exit-184'),
  );

  /* --------------------------------------------- corridor-flow pages */
  for (const path of [
    '/directory/cat-scales/near-me',
    '/directory/parking/ga',
    '/directory/parking/tx',
    '/directory/parking/ga/i-75',
    '/directory/parking/ga/i-75/northbound',
    '/directory/parking/ga/i-75/southbound',
    '/directory/cat-scales/tn',
    '/directory/cat-scales/tn/i-40',
    '/directory/cat-scales/tn/i-40/eastbound',
    '/directory/cat-scales/tn/i-40/westbound',
  ]) {
    check(`corridor-flow route ${path} present`, has(path));
  }
  // Odd interstates run north–south: the two invalid directions are not URLs.
  check(
    'no invalid direction pages emitted',
    !has('/directory/parking/ga/i-75/eastbound') &&
      !has('/directory/cat-scales/tn/i-40/northbound'),
  );
  check(
    'flow pages only exist where listings exist (no TX interstate step)',
    !urls.some((u) => u.startsWith(`${SITE.url}/directory/parking/tx/`)),
  );

  /* ------------------------------------ per-listing detail representation */
  const detailOf = (slug: string) => `${SITE.url}/directory/location/${slug}`;
  for (const slug of [
    'love-s-travel-stop-333-dalton-ga',
    'carbondale-truck-lot-dalton-ga',
    'cat-scale-knoxville-west-knoxville-tn',
  ]) {
    check(`indexable listing ${slug} represented`, urlSet.has(detailOf(slug)));
  }
  check(
    'no-identity listing excluded (renders noindex)',
    !urlSet.has(detailOf('amarillo-roadside-stop-amarillo-tx')),
  );
  check('unpublished listing excluded', !urlSet.has(detailOf('unpublished-fuel-plaza-ocala-fl')));
  check('soft-deleted listing excluded', !urlSet.has(detailOf('deleted-weigh-station-barstow-ca')));
  // PR-B: corridor identity — a rest-area-style row with an interstate but
  // no address, exit, or coordinates is a real place with real signals.
  check(
    'corridor-identity listing represented (no address/exit/coords)',
    urlSet.has(detailOf('georgia-welcome-center-ringgold-ga')),
  );
  // PR-B: the synthetic overnight chip must not count as a second signal.
  check(
    'one-real-signal listing excluded (chip is not evidence)',
    !urlSet.has(detailOf('chip-trap-stop-dalton-ga')),
  );

  /* ------------------- sitemap ↔ page-gate parity (PR-B) ------------------- */
  // The sitemap's inclusion decision and the detail page's robots decision
  // must be the same function over the same data-layer entry — for EVERY
  // fixture, including unpublished/deleted rows (null entry → gated → absent).
  for (const row of LOCATIONS) {
    const slug = row.detail_slug as string;
    const e = await getEntryByDetailSlug(slug);
    const gate = e !== null && isDetailIndexable(e);
    const inSitemap = urlSet.has(detailOf(slug));
    check(`parity: ${slug} sitemap inclusion matches the page gate`, inSitemap === gate, {
      inSitemap,
      gate,
    });
  }

  /* -------------------------------------------------- knowledge center */
  check('active KC category present', has('/knowledge/regulations'));
  check('inactive KC category absent', !has('/knowledge/retired-topic'));
  check('published KC article present', has('/knowledge/regulations/eld-basics'));
  check('draft KC article absent', !has('/knowledge/regulations/unfinished-draft'));

  /* ------------------------------------------------- URL well-formedness */
  const dupes = urls.filter((u, i) => urls.indexOf(u) !== i);
  check('no duplicate URLs', dupes.length === 0, [...new Set(dupes)].slice(0, 5));

  const origin = new URL(SITE.url).origin;
  const malformed = urls.filter((u) => {
    try {
      const parsed = new URL(u);
      return (
        parsed.origin !== origin ||
        parsed.protocol !== 'https:' ||
        parsed.search !== '' ||
        parsed.hash !== '' ||
        /\/\//.test(parsed.pathname) ||
        /\s/.test(u) ||
        (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) ||
        // Canonical paths are lowercase; a cased URL would split signals
        // with its lowercase canonical.
        parsed.pathname !== parsed.pathname.toLowerCase()
      );
    } catch {
      return true;
    }
  });
  check(
    'every URL is well formed on the canonical origin',
    malformed.length === 0,
    malformed.slice(0, 5),
  );

  /* ------------------------------------------------------- lastModified */
  const badDates = entries.filter(
    (e) =>
      e.lastModified !== undefined &&
      Number.isNaN(new Date(e.lastModified as string | Date).getTime()),
  );
  check(
    'lastModified is a valid date wherever emitted',
    badDates.length === 0,
    badDates.slice(0, 3),
  );

  const loves = entries.find((e) => e.url === detailOf('love-s-travel-stop-333-dalton-ga'));
  check(
    'detail lastModified comes from the row updated_at',
    loves?.lastModified !== undefined &&
      new Date(loves.lastModified as string | Date).getTime() ===
        new Date('2026-06-15T12:00:00Z').getTime(),
    loves?.lastModified,
  );
  // The old contract here accepted a clock-time fallback for rows without an
  // updated_at ("null updated_at still yields a valid lastModified"). That
  // codified the false-freshness defect: hourly regeneration stamped every
  // such URL as newly modified. The honest contract is the inverse — no
  // source date, no <lastmod>.
  const nullUpdated = entries.find(
    (e) => e.url === detailOf('cat-scale-knoxville-west-knoxville-tn'),
  );
  check(
    'null updated_at yields NO lastModified (never the clock)',
    nullUpdated !== undefined && nullUpdated.lastModified === undefined,
    nullUpdated?.lastModified,
  );
  const kcArticle = entries.find((e) => e.url === `${SITE.url}/knowledge/regulations/eld-basics`);
  check(
    'KC article lastModified comes from the row updated_at',
    kcArticle?.lastModified !== undefined &&
      new Date(kcArticle.lastModified as string | Date).getTime() ===
        new Date('2026-06-01T00:00:00Z').getTime(),
    kcArticle?.lastModified,
  );
  // Only persisted source dates may carry <lastmod>: with these fixtures that
  // is exactly two detail rows (loc-001, loc-002) and one KC article. Every
  // other family — statics, academy, store, tests, states, corridors, exits,
  // flow steps, KC categories — must omit the field.
  const dated = entries.filter((e) => e.lastModified !== undefined);
  check(
    'lastModified appears on exactly the source-dated fixtures',
    dated.length === 3 &&
      dated.every(
        (e) =>
          e.url === detailOf('love-s-travel-stop-333-dalton-ga') ||
          e.url === detailOf('carbondale-truck-lot-dalton-ga') ||
          e.url === `${SITE.url}/knowledge/regulations/eld-basics`,
      ),
    dated.map((e) => e.url).slice(0, 6),
  );

  /* --------------------------------- clock independence / determinism */
  // Two generations under different clocks must be byte-identical for
  // unchanged fixtures: no entry may derive anything from "now".
  const restoreT1 = withFakeClock('2026-08-17T00:00:00Z');
  const runA = JSON.stringify(await sitemap());
  restoreT1();
  const restoreT2 = withFakeClock('2027-03-01T12:34:56Z');
  const runB = JSON.stringify(await sitemap());
  restoreT2();
  check('sitemap output is identical across different clock times', runA === runB);

  /* --------------------------------------------------- robots contract */
  const r = robots();
  check(
    'robots references the canonical sitemap',
    r.sitemap === `${SITE.url}/sitemap.xml`,
    r.sitemap,
  );
  const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
  const wildcard = rules.find((rule) =>
    Array.isArray(rule?.userAgent) ? rule.userAgent.includes('*') : rule?.userAgent === '*',
  );
  check('robots has a wildcard rule allowing public crawl', wildcard !== undefined);
  const disallow = rules.flatMap((rule) =>
    Array.isArray(rule?.disallow) ? rule.disallow : rule?.disallow ? [rule.disallow] : [],
  );
  for (const path of ['/admin', '/api']) {
    check(`robots keeps ${path} disallowed`, disallow.includes(path), disallow);
  }
  const blocked = urls.filter((u) =>
    disallow.some((d) => new URL(u).pathname === d || new URL(u).pathname.startsWith(`${d}/`)),
  );
  check(
    'no sitemap URL falls under a robots disallow rule',
    blocked.length === 0,
    blocked.slice(0, 5),
  );

  /* ------------------------------------ private/noindex surfaces excluded */
  for (const path of [
    '/knowledge/search',
    '/drive',
    '/navigator',
    '/practice-tests/bookmarks',
    '/practice-tests/missed',
  ]) {
    check(`noindex surface ${path} excluded`, !has(path));
  }
  check(
    'no study/timed app screens in the sitemap',
    !urls.some((u) => /\/practice-tests\/[^/]+\/(study|timed)$/.test(new URL(u).pathname)),
  );
  check(
    'no /admin, /api, or /login URLs',
    !urls.some((u) => /^\/(admin|api|login)(\/|$)/.test(new URL(u).pathname)),
  );

  console.log(`\nsitemap-contract: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

void main();
