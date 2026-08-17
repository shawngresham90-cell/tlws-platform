/**
 * Sitemap tests (offline).
 *
 * The bug this guards: `/directory/parking` shipped **twice**. It is the
 * `parking` category's `customHref`, so the DIRECTORY_CATEGORIES loop already
 * emitted it, and a later change added it again to the hand-maintained
 * top-level list. Entries come from a static list, four registries, and two
 * database queries, so any of those can collide — the generator now dedupes by
 * URL and this asserts it stays that way.
 *
 * Runs without a database: the generator wraps its Supabase reads in
 * try/catch, so offline it yields the static entries only. That is exactly the
 * surface worth asserting here — the DB-backed URLs are covered by
 * preview-crawl against a real deploy.
 *
 * Run:
 *   npx esbuild scripts/test-sitemap.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-sitemap.cjs && node /tmp/test-sitemap.cjs
 */
import { allSitemapEntries as sitemap } from '@/lib/seo/sitemap-entries';
import { SITE } from '@/lib/seo/site';
import { DIRECTORY_CATEGORIES, categoryHref } from '@/lib/directory/categories';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

async function main() {
  // The Supabase client reads these when it is constructed, inside the
  // generator's try/catch. Syntactic placeholders keep construction from
  // throwing before the catch can swallow the (expected) offline failure.
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://placeholder.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'placeholder-anon-key';

  const entries = await sitemap();
  const urls = entries.map((e) => e.url);

  // Non-trivial, not a specific count. This threshold used to be 100 because
  // the 104 store products were unconditionally present; they are now gated on
  // visibility (lib/store/visibility.ts), so the store contributes a variable
  // number. What still matters here is that the generator produces a healthy
  // static sitemap rather than an empty or broken one.
  check('sitemap: produces entries', urls.length > 40, urls.length);
  check('sitemap: still lists the store hub', urls.includes(`${SITE.url}/store`));

  /* -------------------------------------------------- no duplicate <url> */
  const counts = new Map<string, number>();
  for (const u of urls) counts.set(u, (counts.get(u) ?? 0) + 1);
  const dupes = [...counts].filter(([, n]) => n > 1);
  check('sitemap: every URL appears exactly once', dupes.length === 0, dupes.slice(0, 5));

  /* ------------------------------------- the specific collision that shipped */
  const parking = DIRECTORY_CATEGORIES.find((c) => c.slug === 'parking');
  check('sitemap: the parking category exists', Boolean(parking));
  check(
    'sitemap: parking is reached through a customHref (the collision source)',
    parking?.customHref === '/directory/parking',
    parking?.customHref,
  );
  check(
    'sitemap: /directory/parking is present exactly once',
    counts.get(`${SITE.url}/directory/parking`) === 1,
    counts.get(`${SITE.url}/directory/parking`),
  );

  /* --------------------------------------------- every URL is well formed */
  check(
    'sitemap: all URLs are on the canonical origin',
    urls.every((u) => u === SITE.url || u.startsWith(`${SITE.url}/`)),
    urls.filter((u) => u !== SITE.url && !u.startsWith(`${SITE.url}/`)).slice(0, 3),
  );
  check(
    'sitemap: no URL carries a query string or fragment',
    urls.every((u) => !u.includes('?') && !u.includes('#')),
    urls.filter((u) => u.includes('?') || u.includes('#')).slice(0, 3),
  );
  check(
    'sitemap: no trailing slash except the origin',
    urls.every((u) => u === SITE.url || !u.endsWith('/')),
    urls.filter((u) => u !== SITE.url && u.endsWith('/')).slice(0, 3),
  );
  check(
    'sitemap: priorities are within range',
    entries.every((e) => e.priority === undefined || (e.priority >= 0 && e.priority <= 1)),
  );

  /* ------------------------------- noindex pages must not be advertised */
  // Both are device-local personal tools rendered client-side; they carry
  // noindex, so listing them would ask Google to crawl a page it must not index.
  for (const path of ['/practice-tests/bookmarks', '/practice-tests/missed']) {
    check(`sitemap: ${path} (noindex) is excluded`, !urls.includes(`${SITE.url}${path}`));
  }

  /* -------------------------------- admin / api surfaces are never listed */
  check(
    'sitemap: no /admin, /api, or /login URLs',
    !urls.some((u) => /\/(admin|api|login)(\/|$)/.test(new URL(u).pathname)),
    urls.filter((u) => /\/(admin|api|login)(\/|$)/.test(new URL(u).pathname)).slice(0, 3),
  );

  /* -------------------------------- every directory category is reachable */
  for (const category of DIRECTORY_CATEGORIES) {
    const href = categoryHref(category);
    check(`sitemap: category "${category.slug}" listed`, urls.includes(`${SITE.url}${href}`), href);
  }

  console.log(`\nsitemap: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

void main();
