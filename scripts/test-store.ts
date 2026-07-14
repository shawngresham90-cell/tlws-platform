/**
 * Trucking Life Store — compliance + unit tests.
 *
 * The store ships with 12 PLACEHOLDER products (no ASIN, no price, no Amazon
 * image). These tests are the guardrail that keeps it that way until the owner
 * fills in real values. They assert, above all:
 *
 *   - The Amazon associate tag is EXACTLY `truckinglif0d-20`, applied in one place.
 *   - NO active Amazon button/URL is ever produced for a placeholder ASIN.
 *   - NO price, ASIN, or Amazon image is fabricated in the catalog.
 *   - The Amazon Associates disclosure is present where links live.
 *   - JSON-LD emits an `offers` block ONLY for a genuinely live product.
 *   - Store URLs are wired into nav, footer, and the sitemap.
 *
 * Run:
 *   npx esbuild scripts/test-store.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-store.cjs && node /tmp/test-store.cjs
 */
import { readFileSync } from 'node:fs';
import {
  AMAZON_ASSOCIATE_TAG,
  AMAZON_DISCLOSURE,
  AMAZON_DISCLOSURE_SHORT,
  AMAZON_REL,
  isValidAsin,
  amazonProductUrl,
  amazonStorefrontUrl,
} from '@/lib/store/amazon';
import {
  STORE_PRODUCTS,
  storeProduct,
  productsInCategory,
  productHref,
  productReadiness,
  priceLabel,
} from '@/lib/store/products';
import { STORE_CATEGORIES, storeCategory, storeCategoryHref } from '@/lib/store/categories';
import { filterAndSortProducts } from '@/lib/store/search';
import { productSchema } from '@/lib/store/schema';
import { STORE_EVENTS } from '@/lib/store/analytics';
import type { StoreProduct } from '@/lib/store/types';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};
const read = (p: string) => readFileSync(p, 'utf8'); // resolved from repo root (test cwd)

// ── 1. Associate tag: exact, and the single source of truth ────────────────
check('associate tag is exactly truckinglif0d-20', AMAZON_ASSOCIATE_TAG === 'truckinglif0d-20', AMAZON_ASSOCIATE_TAG);
check('rel carries sponsored + noopener + noreferrer', AMAZON_REL === 'sponsored noopener noreferrer', AMAZON_REL);

// ── 2. No active URL for any placeholder ASIN ──────────────────────────────
for (const p of STORE_PRODUCTS) {
  check(`placeholder ${p.slug} has null asin`, p.asin === null, p.asin);
  check(`placeholder ${p.slug} has null price`, p.priceUsd === null, p.priceUsd);
  check(`placeholder ${p.slug} has null image`, p.imageUrl === null, p.imageUrl);
  check(`placeholder ${p.slug} yields NO affiliate url`, amazonProductUrl(p.asin) === null);
  check(`placeholder ${p.slug} is not "live"`, productReadiness(p).live === false);
  check(`placeholder ${p.slug} shows no price label`, priceLabel(p) === null, priceLabel(p));
}

// ── 3. ASIN validation ─────────────────────────────────────────────────────
check('valid ASIN B0XXXXXXXX accepted', isValidAsin('B0CZ1ABCDE') === true);
check('valid 10-digit ISBN accepted', isValidAsin('1234567890') === true);
check('null ASIN rejected', isValidAsin(null) === false);
check('empty ASIN rejected', isValidAsin('') === false);
check('short ASIN rejected', isValidAsin('B0CZ1') === false);
check('junk ASIN rejected', isValidAsin('not-an-asin') === false);

// ── 4. A real ASIN builds the correct tagged URL (single tag application) ───
const liveUrl = amazonProductUrl('B0CZ1ABCDE');
check('real ASIN builds a URL', liveUrl !== null);
check('URL carries the associate tag', !!liveUrl && liveUrl.includes(`tag=${AMAZON_ASSOCIATE_TAG}`), liveUrl);
check('URL uses canonical /dp/ form', liveUrl === 'https://www.amazon.com/dp/B0CZ1ABCDE/?tag=truckinglif0d-20', liveUrl);
check('URL carries the tag exactly once', !!liveUrl && liveUrl.split('tag=').length === 2, liveUrl);
check('storefront URL is tagged', amazonStorefrontUrl().includes(`tag=${AMAZON_ASSOCIATE_TAG}`));

// ── 5. Catalog shape ───────────────────────────────────────────────────────
check('exactly 12 products', STORE_PRODUCTS.length === 12, STORE_PRODUCTS.length);
const slugs = STORE_PRODUCTS.map((p) => p.slug);
check('product slugs are unique', new Set(slugs).size === 12);
check('storeProduct resolves a known slug', storeProduct('dual-dash-cam')?.name === 'Dual-Facing Dash Cam');
check('storeProduct returns undefined for unknown slug', storeProduct('nope') === undefined);
const catSlugs = new Set(STORE_CATEGORIES.map((c) => c.slug));
check('7 categories', STORE_CATEGORIES.length === 7, STORE_CATEGORIES.length);
for (const p of STORE_PRODUCTS) {
  check(`${p.slug} maps to a real category`, catSlugs.has(p.category), p.category);
  check(`${p.slug} has benefits`, Array.isArray(p.benefits) && p.benefits.length > 0);
}
for (const c of STORE_CATEGORIES) {
  check(`storeCategory resolves ${c.slug}`, storeCategory(c.slug)?.title === c.title);
}
// The 12-product catalog populates most categories; any category that launches
// empty must be handled by the category page, not rendered as a failed search.
const populated = STORE_CATEGORIES.filter((c) => productsInCategory(c.slug).length > 0);
check('at least 6 categories are populated', populated.length >= 6, populated.length);
const categoryPageSrc = read('src/app/(marketing)/store/category/[slug]/page.tsx');
check('category page handles an empty category', /products\.length === 0/.test(categoryPageSrc));

// ── 6. Readiness reports missing fields honestly ───────────────────────────
const r = productReadiness(STORE_PRODUCTS[0]);
check('readiness flags ASIN missing', r.missing.includes('ASIN'));
check('readiness flags price missing', r.missing.includes('price'));
check('readiness flags image missing', r.missing.includes('image'));

// ── 7. Schema: placeholders get NO offer / rating / image ──────────────────
for (const p of STORE_PRODUCTS) {
  const s = productSchema(p) as Record<string, unknown>;
  check(`schema ${p.slug} is a Product`, s['@type'] === 'Product');
  check(`schema ${p.slug} has NO offers`, !('offers' in s));
  check(`schema ${p.slug} has NO aggregateRating`, !('aggregateRating' in s));
  check(`schema ${p.slug} has NO review`, !('review' in s));
  check(`schema ${p.slug} has NO image (none licensed)`, !('image' in s));
}

// ── 8. Schema: a genuinely LIVE product DOES emit a truthful offer ─────────
const liveProduct: StoreProduct = {
  ...STORE_PRODUCTS[0],
  asin: 'B0CZ1ABCDE',
  priceUsd: 129.99,
  imageUrl: 'https://cdn.example.com/own-photo.jpg',
};
const ls = productSchema(liveProduct) as Record<string, unknown>;
check('live schema emits offers', 'offers' in ls);
const offer = (ls.offers ?? {}) as Record<string, unknown>;
check('live offer price is the confirmed price', offer.price === '129.99', offer.price);
check('live offer currency USD', offer.priceCurrency === 'USD');
check('live offer url carries the tag', typeof offer.url === 'string' && (offer.url as string).includes(`tag=${AMAZON_ASSOCIATE_TAG}`));
check('live schema keeps its own image', ls.image === 'https://cdn.example.com/own-photo.jpg');

// ── 9. Search / filter / sort ──────────────────────────────────────────────
check('filter by category returns only that category', filterAndSortProducts(STORE_PRODUCTS, { category: 'electronics' }).every((p) => p.category === 'electronics'));
check('query matches product text', filterAndSortProducts(STORE_PRODUCTS, { query: 'dash cam' }).some((p) => p.slug === 'dual-dash-cam'));
check('unmatched query returns none', filterAndSortProducts(STORE_PRODUCTS, { query: 'zzzznomatch' }).length === 0);
const byName = filterAndSortProducts(STORE_PRODUCTS, { sort: 'name' });
check('name sort is alphabetical', byName[0].name.localeCompare(byName[byName.length - 1].name) <= 0);
check('empty filter returns all 12', filterAndSortProducts(STORE_PRODUCTS, {}).length === 12);

// ── 10. Analytics event names are stable + namespaced ──────────────────────
check('storeView event name', STORE_EVENTS.storeView === 'store_page_view');
check('productView event name', STORE_EVENTS.productView === 'store_product_view');
check('categoryView event name', STORE_EVENTS.categoryView === 'store_category_view');
check('search event name', STORE_EVENTS.search === 'store_search');
check('amazonCtaClick event name', STORE_EVENTS.amazonCtaClick === 'store_amazon_cta_click');
check('all store events are store_-prefixed', Object.values(STORE_EVENTS).every((e) => e.startsWith('store_')));

// ── 11. Href helpers ───────────────────────────────────────────────────────
check('productHref shape', productHref('dual-dash-cam') === '/store/products/dual-dash-cam');
check('storeCategoryHref shape', storeCategoryHref('electronics') === '/store/category/electronics');

// ── 12. Disclosure text present where affiliate links live ─────────────────
check('long disclosure names Amazon Associate', /Amazon Associate/.test(AMAZON_DISCLOSURE));
check('short disclosure names Amazon Associate', /Amazon Associate/.test(AMAZON_DISCLOSURE_SHORT));
const disclosureSrc = read('src/components/store/AmazonDisclosure.tsx');
check('AmazonDisclosure renders the disclosure constant', /AMAZON_DISCLOSURE/.test(disclosureSrc));

// ── 13. AmazonCta source: active link ONLY via amazonProductUrl, correct rel ─
const ctaSrc = read('src/components/store/AmazonCta.tsx');
check('AmazonCta gates on amazonProductUrl', /amazonProductUrl\(/.test(ctaSrc));
check('AmazonCta applies AMAZON_REL', /AMAZON_REL/.test(ctaSrc));
check('AmazonCta opens Amazon in a new tab', /target="_blank"/.test(ctaSrc));
check('AmazonCta has a disabled/coming-soon fallback', /aria-disabled|coming soon/i.test(ctaSrc));

// ── 14. Sticky CTA renders nothing without a valid ASIN ────────────────────
const stickySrc = read('src/components/store/StickyAmazonCta.tsx');
check('StickyAmazonCta gates on amazonProductUrl', /amazonProductUrl\(/.test(stickySrc));
check('StickyAmazonCta can return null', /return null/.test(stickySrc));

// ── 15. No scraped/hotlinked Amazon image anywhere in store code ───────────
const storeFiles = [
  'src/lib/store/products.ts',
  'src/components/store/ProductImage.tsx',
  'src/components/store/ProductCard.tsx',
  'src/lib/store/schema.ts',
];
for (const f of storeFiles) {
  const src = read(f);
  check(`${f} has no media-amazon image host`, !/media-amazon\.com|images-amazon\.com|ssl-images-amazon/.test(src));
}

// ── 16. Nav, footer, sitemap wiring ────────────────────────────────────────
check('header nav links to /store', /href:\s*'\/store'/.test(read('src/components/layout/Header.tsx')));
check('footer links to /store', /href:\s*'\/store'/.test(read('src/components/layout/Footer.tsx')));
const sitemapSrc = read('src/app/sitemap.ts');
check('sitemap imports STORE_PRODUCTS', /STORE_PRODUCTS/.test(sitemapSrc));
check('sitemap imports STORE_CATEGORIES', /STORE_CATEGORIES/.test(sitemapSrc));
check('sitemap pushes /store hub', /\/store`/.test(sitemapSrc) || /\$\{SITE\.url\}\/store/.test(sitemapSrc));

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\nStore tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
