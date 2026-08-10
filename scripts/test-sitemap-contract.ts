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
 * the canonical origin, that lastModified is a real date (and comes from
 * updated_at where the row has one), and that robots.ts advertises the
 * sitemap while no emitted URL falls under a robots disallow rule.
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
 * Six locations exercising every gate the sitemap applies:
 *  - loc-001/002: GA on I-75 (exits 333/320), complete rows → detail pages,
 *    state + corridor + exit URLs, parking-flow GA/I-75.
 *  - loc-003: TN CAT scale on I-40 exit 7B → cat-scales flow TN/I-40 and the
 *    lettered-exit slug; null updated_at → lastModified falls back safely.
 *  - loc-004: TX, published but THIN (no address) → its state/flow URLs exist,
 *    its detail page must NOT.
 *  - loc-005: FL, unpublished → invisible everywhere.
 *  - loc-006: CA, soft-deleted → invisible everywhere.
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

/* ------------------------------------------------------- PostgREST fake */

/**
 * Just enough PostgREST semantics for the generator's reads: eq / is.null /
 * not.is.null / in.(…) / gt / ilike filters, order=<col>.asc|desc, limit,
 * and the exact count via Content-Range when `Prefer: count=exact` is sent
 * (which is how collectAllRows corroborates a complete scan). Anything the
 * data layer starts using that this fake doesn't speak fails loudly.
 */
function applyFilter(rows: Record<string, unknown>[], col: string, raw: string) {
  if (raw.startsWith('eq.')) {
    const v = raw.slice(3);
    return rows.filter((r) => String(r[col]) === v);
  }
  if (raw === 'is.null') return rows.filter((r) => r[col] == null);
  if (raw === 'not.is.null') return rows.filter((r) => r[col] != null);
  if (raw.startsWith('in.(') && raw.endsWith(')')) {
    const values = raw
      .slice(4, -1)
      .split(',')
      .map((s) => s.trim().replace(/^"(.*)"$/, '$1'));
    return rows.filter((r) => values.includes(String(r[col])));
  }
  if (raw.startsWith('gt.')) {
    const v = raw.slice(3);
    return rows.filter((r) => String(r[col]) > v);
  }
  if (raw.startsWith('ilike.')) {
    const pattern = raw.slice(6).replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^${pattern.replace(/[%*]/g, '.*')}$`, 'i');
    return rows.filter((r) => r[col] != null && re.test(String(r[col])));
  }
  throw new Error(`PostgREST fake: unsupported filter ${col}=${raw}`);
}

function fakeRest(url: URL, prefer: string): Response {
  const table = url.pathname.split('/').pop() ?? '';
  const fixture = TABLES[table];
  if (!fixture) throw new Error(`PostgREST fake: unknown table ${table}`);

  let rows = [...fixture];
  let order: string | null = null;
  let limit: number | null = null;
  for (const [key, value] of url.searchParams.entries()) {
    if (key === 'select' || key === 'apikey') continue;
    if (key === 'order') order = value;
    else if (key === 'limit') limit = parseInt(value, 10);
    else if (key === 'offset') throw new Error('PostgREST fake: offset unsupported');
    else rows = applyFilter(rows, key, value);
  }
  const total = rows.length;
  if (order) {
    const [col, dir] = order.split('.');
    rows.sort((a, b) => String(a[col]).localeCompare(String(b[col])));
    if (dir === 'desc') rows.reverse();
  }
  if (limit != null) rows = rows.slice(0, limit);

  const headers = new Headers({ 'content-type': 'application/json' });
  if (/count=exact/.test(prefer)) {
    headers.set(
      'content-range',
      rows.length === 0 ? `*/${total}` : `0-${rows.length - 1}/${total}`,
    );
  }
  return new Response(JSON.stringify(rows), { status: 200, headers });
}

function installFake(): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href);
    if (!url.pathname.startsWith('/rest/v1/')) {
      throw new Error(`PostgREST fake: unexpected request ${url.pathname}`);
    }
    const preferInit = new Headers(
      init?.headers ?? (typeof input === 'object' && 'headers' in input ? input.headers : {}),
    ).get('prefer');
    return fakeRest(url, preferInit ?? '');
  }) as typeof fetch;
}

/* ------------------------------------------------------------------ tests */

async function main() {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://placeholder.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'placeholder-anon-key';
  installFake();

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
  ]) {
    check(`static route ${path} present`, has(path));
  }
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
    'thin listing excluded (renders noindex)',
    !urlSet.has(detailOf('amarillo-roadside-stop-amarillo-tx')),
  );
  check('unpublished listing excluded', !urlSet.has(detailOf('unpublished-fuel-plaza-ocala-fl')));
  check('soft-deleted listing excluded', !urlSet.has(detailOf('deleted-weigh-station-barstow-ca')));

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
        (parsed.pathname !== '/' && parsed.pathname.endsWith('/'))
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
  const nullUpdated = entries.find(
    (e) => e.url === detailOf('cat-scale-knoxville-west-knoxville-tn'),
  );
  check(
    'null updated_at still yields a valid lastModified',
    nullUpdated?.lastModified !== undefined &&
      !Number.isNaN(new Date(nullUpdated.lastModified as string | Date).getTime()),
  );

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
