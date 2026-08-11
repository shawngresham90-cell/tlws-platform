/**
 * Pagination + not-found metadata contracts (offline, fixture-backed).
 *
 * The defects this guards (found in the post-sitemap technical SEO audit,
 * 2026-08-10):
 *
 *  - /directory/new-locations?page=2..50 and /knowledge/[category]?page=N are
 *    real, linked, indexable URLs, but every page shipped page 1's canonical
 *    and an identical <title> — a parameterized duplicate cluster whose
 *    canonical hint Google is free to ignore. Pages 2+ must carry their own
 *    ?page= canonical and a distinct title, from the SAME page parser the
 *    component uses, so metadata and content can never disagree.
 *
 *  - Not-found branches emitted wrong metadata: the store slugs canonicalized
 *    an arbitrary 404 URL to the homepage (buildMetadata's default path), and
 *    the Knowledge Center emitted indexable self-canonical metadata for URLs
 *    that then 404. A miss branch returns {} — no canonical, no robots — the
 *    convention the directory pages already follow.
 *
 * Run:
 *   npx esbuild scripts/test-seo-pagination.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --alias:next/headers=./scripts/shims/next-headers.ts \
 *     --loader:.css=empty \
 *     --outfile=/tmp/test-seo-pagination.cjs && node /tmp/test-seo-pagination.cjs
 */
import type { Metadata } from 'next';
import { generateMetadata as newLocationsMetadata } from '@/app/(directory)/directory/new-locations/page';
import { generateMetadata as kcCategoryMetadata } from '@/app/(marketing)/knowledge/[category]/page';
import { generateMetadata as kcArticleMetadata } from '@/app/(marketing)/knowledge/[category]/[slug]/page';
import { generateMetadata as storeCategoryMetadata } from '@/app/(marketing)/store/category/[slug]/page';
import { generateMetadata as storeGuideMetadata } from '@/app/(marketing)/store/guides/[slug]/page';
import { generateMetadata as storeProductMetadata } from '@/app/(marketing)/store/products/[slug]/page';
import { STORE_CATEGORIES, storeCategoryHref } from '@/lib/store/categories';
import { SITE } from '@/lib/seo/site';
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

const canonicalOf = (m: Metadata): string | undefined =>
  typeof m.alternates?.canonical === 'string' ? m.alternates.canonical : undefined;
const titleOf = (m: Metadata): string => (typeof m.title === 'string' ? m.title : '');
const isIndexable = (m: Metadata): boolean =>
  typeof m.robots === 'object' &&
  m.robots !== null &&
  (m.robots as { index?: boolean }).index === true;
/** A miss branch must say nothing at all — no canonical, no robots, no OG. */
const isEmpty = (m: Metadata): boolean => Object.keys(m).length === 0;

/* ---------------------------------------------------------------- fixtures */

const KC_CATEGORIES = [
  {
    id: 'cat-1',
    slug: 'dot-compliance',
    name: 'DOT Compliance',
    description: 'Rules of the road, explained by a driver.',
    intro_md: null,
    icon: null,
    sort_order: 1,
    meta_title: null,
    meta_description: null,
  },
];

const KC_ARTICLES = [
  {
    id: 'art-1',
    slug: 'eld-basics',
    category_id: 'cat-1',
    title: 'ELD Basics',
    excerpt: 'What the mandate actually requires.',
    body_mdx: 'Body.',
    meta_title: null,
    meta_description: null,
    hero_image_url: null,
    author_name: null,
    author_bio: null,
    sources: [],
    faqs: [],
    tags: [],
    reading_time_min: 4,
    featured: false,
    reg_verified: false,
    reg_verified_date: null,
    published_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
  },
];

/* ------------------------------------------------------------------ tests */

async function main() {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://placeholder.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'placeholder-anon-key';
  installPostgrestFake({ kc_categories: KC_CATEGORIES, kc_articles: KC_ARTICLES });

  /* ----------------------------------------- /directory/new-locations */
  const NL = `${SITE.url}/directory/new-locations`;

  const nlDefault = newLocationsMetadata({ searchParams: undefined });
  check('new-locations: page 1 canonical is the clean path', canonicalOf(nlDefault) === NL);
  check('new-locations: page 1 title carries no page marker', !titleOf(nlDefault).includes('Page'));
  check('new-locations: page 1 is indexable', isIndexable(nlDefault));

  const nlExplicit1 = newLocationsMetadata({ searchParams: { page: '1' } });
  check(
    'new-locations: explicit ?page=1 canonicalizes to the clean path',
    canonicalOf(nlExplicit1) === NL,
  );

  const nl3 = newLocationsMetadata({ searchParams: { page: '3' } });
  check(
    'new-locations: page 3 canonical carries its own page param',
    canonicalOf(nl3) === `${NL}?page=3`,
  );
  check('new-locations: page 3 title is distinct', titleOf(nl3).includes('Page 3'), titleOf(nl3));
  check('new-locations: page 3 stays indexable', isIndexable(nl3));
  check(
    'new-locations: og:url agrees with the canonical',
    nl3.openGraph?.url === canonicalOf(nl3),
    nl3.openGraph?.url,
  );

  const nlJunk = newLocationsMetadata({ searchParams: { page: 'abc' } });
  check('new-locations: junk page param falls back to page 1', canonicalOf(nlJunk) === NL);
  const nlNegative = newLocationsMetadata({ searchParams: { page: '-4' } });
  check('new-locations: negative page clamps to page 1', canonicalOf(nlNegative) === NL);
  const nlHuge = newLocationsMetadata({ searchParams: { page: '999' } });
  check(
    'new-locations: page clamps to the same hard cap the component uses',
    canonicalOf(nlHuge) === `${NL}?page=50`,
    canonicalOf(nlHuge),
  );

  /* ----------------------------------------------- /knowledge/[category] */
  const KC = `${SITE.url}/knowledge/dot-compliance`;

  const kc1 = await kcCategoryMetadata({ params: { category: 'dot-compliance' } });
  check('kc category: page 1 canonical is the clean path', canonicalOf(kc1) === KC);
  check('kc category: page 1 title has no page marker', !titleOf(kc1).includes('Page'));

  const kc2 = await kcCategoryMetadata({
    params: { category: 'dot-compliance' },
    searchParams: { page: '2' },
  });
  check(
    'kc category: page 2 canonical carries its own page param',
    canonicalOf(kc2) === `${KC}?page=2`,
  );
  check('kc category: page 2 title is distinct', titleOf(kc2).includes('Page 2'), titleOf(kc2));
  check('kc category: page 2 stays indexable', isIndexable(kc2));

  const kcJunk = await kcCategoryMetadata({
    params: { category: 'dot-compliance' },
    searchParams: { page: '0' },
  });
  check('kc category: page 0 clamps to the clean path', canonicalOf(kcJunk) === KC);

  const kcMiss = await kcCategoryMetadata({ params: { category: 'no-such-category' } });
  check('kc category: unknown slug emits no metadata at all', isEmpty(kcMiss), kcMiss);

  /* ---------------------------------------- /knowledge/[category]/[slug] */
  const art = await kcArticleMetadata({
    params: { category: 'dot-compliance', slug: 'eld-basics' },
  });
  check(
    'kc article: canonical is the article path',
    canonicalOf(art) === `${KC}/eld-basics`,
    canonicalOf(art),
  );

  const artMiss = await kcArticleMetadata({
    params: { category: 'dot-compliance', slug: 'no-such-article' },
  });
  check('kc article: unknown slug emits no metadata at all', isEmpty(artMiss), artMiss);
  const artCatMiss = await kcArticleMetadata({
    params: { category: 'no-such-category', slug: 'eld-basics' },
  });
  check('kc article: unknown category emits no metadata at all', isEmpty(artCatMiss));

  /* ------------------------------------------------------ store misses */
  check(
    'store category: unknown slug emits no metadata (no homepage canonical)',
    isEmpty(storeCategoryMetadata({ params: { slug: 'no-such-category' } })),
  );
  check(
    'store guide: unknown slug emits no metadata (no homepage canonical)',
    isEmpty(storeGuideMetadata({ params: { slug: 'no-such-guide' } })),
  );
  check(
    'store product: unknown slug emits no metadata (no homepage canonical)',
    isEmpty(storeProductMetadata({ params: { slug: 'no-such-product' } })),
  );

  // The success path still self-canonicalizes — the miss fix must not have
  // touched it.
  const firstCat = STORE_CATEGORIES[0];
  const storeOk = storeCategoryMetadata({ params: { slug: firstCat.slug } });
  check(
    'store category: known slug still self-canonicalizes',
    canonicalOf(storeOk) === `${SITE.url}${storeCategoryHref(firstCat.slug)}`,
    canonicalOf(storeOk),
  );

  console.log(`\nseo-pagination: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

void main();
