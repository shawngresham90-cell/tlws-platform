/**
 * Trucking Life Store — compliance + unit tests (M54: 100-product catalog).
 *
 * The store ships 100 EDITORIAL products with EVERY Amazon-specific fact blank
 * (asin, price, rating, reviewCount, image all null). These tests are the
 * guardrail that keeps it honest until the owner supplies verified data. Above
 * all they assert:
 *
 *   - The Amazon associate tag is EXACTLY `truckinglif0d-20`, applied in one place.
 *   - NO active Amazon button/URL is ever produced for a placeholder ASIN.
 *   - NO price, ASIN, rating, review count, or Amazon image is fabricated.
 *   - No fabricated Amazon claims (price/rating/reviews/Prime/best-seller/sale)
 *     appear anywhere in the catalog copy.
 *   - JSON-LD emits `offers` only for a live product and `aggregateRating` only
 *     for a verified rating + review count.
 *   - Guides, Shawn's Picks, related, and FBT resolve to real products.
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
  productsOfType,
  productHref,
  productReadiness,
  productActive,
  priceLabel,
  ratingLabel,
  displayName,
} from '@/lib/store/products';
import { STORE_CATEGORIES, storeCategory, storeCategoryHref } from '@/lib/store/categories';
import { PRODUCT_TYPES, STORE_GUIDES, storeGuide, guideHref } from '@/lib/store/product-types';
import { shawnsPicks } from '@/lib/store/picks';
import { relatedProducts, frequentlyBoughtTogether } from '@/lib/store/related';
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
const read = (p: string) => readFileSync(p, 'utf8');

// ── 1. Associate tag + rel: exact, single source ───────────────────────────
check('associate tag is exactly truckinglif0d-20', AMAZON_ASSOCIATE_TAG === 'truckinglif0d-20', AMAZON_ASSOCIATE_TAG);
check('rel carries sponsored + noopener + noreferrer', AMAZON_REL === 'sponsored noopener noreferrer', AMAZON_REL);

// ── 2. Catalog shape: exactly 104, unique slugs ────────────────────────────
check('exactly 104 products', STORE_PRODUCTS.length === 104, STORE_PRODUCTS.length);
check('product slugs are unique', new Set(STORE_PRODUCTS.map((p) => p.slug)).size === 104);
check('slugs are kebab-case', STORE_PRODUCTS.every((p) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)));

// The 4 owner-requested "first 12" additions exist as editorial placeholders.
for (const slug of ['rand-mcnally-road-atlas', 'bungee-ratchet-strap-set', 'windshield-sunshade', 'blood-pressure-monitor']) {
  const p = storeProduct(slug);
  check(`new product ${slug} exists`, Boolean(p));
  check(`new product ${slug} is a placeholder`, !!p && p.asin === null && p.imageUrl === null);
}

// ── 3. THE COMPLIANCE CORE: every Amazon fact blank, no active link ────────
for (const p of STORE_PRODUCTS) {
  check(`${p.slug}: asin null`, p.asin === null, p.asin);
  check(`${p.slug}: verifiedTitle blank`, !p.verifiedTitle, p.verifiedTitle);
  check(`${p.slug}: price null`, p.priceUsd === null, p.priceUsd);
  check(`${p.slug}: rating null`, p.rating === null, p.rating);
  check(`${p.slug}: reviewCount null`, p.reviewCount === null, p.reviewCount);
  check(`${p.slug}: image null`, p.imageUrl === null, p.imageUrl);
  check(`${p.slug}: NO affiliate url`, amazonProductUrl(p.asin) === null);
  check(`${p.slug}: not live`, productReadiness(p).live === false);
  check(`${p.slug}: not active`, productActive(p) === false);
  check(`${p.slug}: no price label`, priceLabel(p) === null);
  check(`${p.slug}: no rating label`, ratingLabel(p) === null);
  check(`${p.slug}: displayName falls back to editorial name`, displayName(p) === p.name);
}

// ── 4. Every product has full editorial content ────────────────────────────
for (const p of STORE_PRODUCTS) {
  check(`${p.slug}: has benefits`, Array.isArray(p.benefits) && p.benefits.length >= 2);
  check(`${p.slug}: has pros`, Array.isArray(p.pros) && p.pros.length >= 2);
  check(`${p.slug}: has cons`, Array.isArray(p.cons) && p.cons.length >= 2);
  check(`${p.slug}: has recommendation`, typeof p.recommendation === 'string' && p.recommendation.length > 0);
}

// ── 5. No fabricated Amazon claims anywhere in the copy ────────────────────
const FAB: [RegExp, string][] = [
  [/\$\s?\d/, 'price ($)'],
  [/\bASIN\b/i, 'ASIN'],
  [/\bprime\b/i, 'Prime'],
  [/\bbest[\s-]?seller/i, 'best-seller'],
  [/#\s?1\b/, '#1'],
  [/\b\d+\s*reviews?\b/i, 'review count'],
  [/\b[0-5](\.\d)?\s*stars?\b/i, 'star rating'],
  [/\bout of 5\b/i, 'X out of 5'],
  [/\bon sale\b/i, 'on sale'],
  [/\bdiscount(ed)?\b/i, 'discount'],
  [/\b\d+%\s*off\b/i, '% off'],
];
for (const p of STORE_PRODUCTS) {
  const blob = [p.name, p.tagline, p.description, p.recommendation, ...p.benefits, ...p.pros, ...p.cons].join('  ');
  for (const [re, label] of FAB) {
    check(`${p.slug}: no fabricated ${label}`, !re.test(blob), blob.match(re)?.[0]);
  }
}

// ── 6. ASIN validation + a real ASIN builds the tagged URL ─────────────────
check('valid ASIN accepted', isValidAsin('B0CZ1ABCDE') === true);
check('null ASIN rejected', isValidAsin(null) === false);
check('junk ASIN rejected', isValidAsin('not-an-asin') === false);
const liveUrl = amazonProductUrl('B0CZ1ABCDE');
check('real ASIN builds tagged /dp/ url', liveUrl === 'https://www.amazon.com/dp/B0CZ1ABCDE/?tag=truckinglif0d-20', liveUrl);
check('url carries the tag exactly once', !!liveUrl && liveUrl.split('tag=').length === 2);
check('storefront url is tagged', amazonStorefrontUrl().includes(`tag=${AMAZON_ASSOCIATE_TAG}`));

// ── 7. Categories (7) + product types (19), all populated ──────────────────
check('7 categories', STORE_CATEGORIES.length === 7, STORE_CATEGORIES.length);
for (const c of STORE_CATEGORIES) {
  check(`category ${c.slug} populated`, productsInCategory(c.slug).length > 0);
  check(`storeCategory resolves ${c.slug}`, storeCategory(c.slug)?.title === c.title);
}
const typeKeys = Object.keys(PRODUCT_TYPES);
check('22 product types', typeKeys.length === 22, typeKeys.length);
for (const p of STORE_PRODUCTS) {
  check(`${p.slug}: productType valid`, typeKeys.includes(p.productType), p.productType);
  const meta = PRODUCT_TYPES[p.productType];
  check(`${p.slug}: type maps to product's category`, meta.category === p.category, `${meta.category} vs ${p.category}`);
}

// ── 8. Buying guides: 10, each backed by real products ─────────────────────
check('10 buying guides', STORE_GUIDES.length === 10, STORE_GUIDES.length);
check('guide slugs unique', new Set(STORE_GUIDES.map((g) => g.slug)).size === 10);
for (const g of STORE_GUIDES) {
  check(`guide ${g.slug} resolves`, storeGuide(g.slug)?.title === g.title);
  check(`guide ${g.slug} has >=3 picks`, productsOfType(g.productType).length >= 3);
  check(`guide ${g.slug} has intro`, g.intro.length > 0);
  check(`guide ${g.slug} href`, guideHref(g.slug) === `/store/guides/${g.slug}`);
}
// The 10 owner-requested guide types are all present.
const REQUIRED_GUIDE_SLUGS = [
  'best-dash-cams', 'best-bluetooth-headsets', 'best-truck-gps', 'best-trucking-fridges',
  'best-seat-cushions', 'best-electric-skillets', 'best-flashlights', 'best-power-inverters',
  'best-cb-radios', 'best-dot-gear',
];
for (const s of REQUIRED_GUIDE_SLUGS) check(`guide exists: ${s}`, Boolean(storeGuide(s)));

// ── 9. Schema: placeholders get NO offer / rating; live+rating DOES ────────
for (const p of STORE_PRODUCTS) {
  const s = productSchema(p) as Record<string, unknown>;
  check(`schema ${p.slug} is Product`, s['@type'] === 'Product');
  check(`schema ${p.slug} NO offers`, !('offers' in s));
  check(`schema ${p.slug} NO aggregateRating`, !('aggregateRating' in s));
  check(`schema ${p.slug} NO image`, !('image' in s));
}
const liveProduct: StoreProduct = {
  ...STORE_PRODUCTS[0],
  asin: 'B0CZ1ABCDE',
  verifiedTitle: 'Real Verified Amazon Title',
  priceUsd: 129.99,
  rating: 4.6,
  reviewCount: 1234,
  imageUrl: 'https://cdn.example.com/own-photo.jpg',
};
const ls = productSchema(liveProduct) as Record<string, unknown>;
check('live schema emits offers', 'offers' in ls);
check('live offer price is confirmed price', (ls.offers as Record<string, unknown>).price === '129.99');
check('live offer url tagged', String((ls.offers as Record<string, unknown>).url).includes(`tag=${AMAZON_ASSOCIATE_TAG}`));
check('live schema emits aggregateRating', 'aggregateRating' in ls);
check('aggregateRating uses verified rating', (ls.aggregateRating as Record<string, unknown>).ratingValue === '4.6');
check('aggregateRating uses verified count', (ls.aggregateRating as Record<string, unknown>).reviewCount === 1234);
check('live schema name uses verified title', ls.name === 'Real Verified Amazon Title');
// rating without review count → still no rating (never half-fabricated)
const ratingOnly = productSchema({ ...STORE_PRODUCTS[0], rating: 4.6 } as StoreProduct) as Record<string, unknown>;
check('rating without reviewCount → no aggregateRating', !('aggregateRating' in ratingOnly));

// ── 9b. Activation gate: requires ASIN + verified title + image (price optional)
check('fully-filled product is active', productActive(liveProduct) === true);
check('ASIN + title but NO image → NOT active', productActive({ ...STORE_PRODUCTS[0], asin: 'B0CZ1ABCDE', verifiedTitle: 'T' } as StoreProduct) === false);
check('ASIN + image but NO title → NOT active', productActive({ ...STORE_PRODUCTS[0], asin: 'B0CZ1ABCDE', imageUrl: 'x' } as StoreProduct) === false);
check('active WITHOUT price is allowed (price optional)', productActive({ ...STORE_PRODUCTS[0], asin: 'B0CZ1ABCDE', verifiedTitle: 'T', imageUrl: 'x' } as StoreProduct) === true);
check('offers NOT emitted without price even when active', !('offers' in (productSchema({ ...STORE_PRODUCTS[0], asin: 'B0CZ1ABCDE', verifiedTitle: 'T', imageUrl: 'x' } as StoreProduct) as Record<string, unknown>)));

// ── 10. Shawn's Picks resolve to real products ─────────────────────────────
const picks = shawnsPicks();
check("Shawn's Picks non-empty", picks.length >= 8, picks.length);
check("every pick resolves to a real product", picks.every((x) => storeProduct(x.product.slug)));
check("every pick has a reason", picks.every((x) => x.why.length > 0));

// ── 11. Related + Frequently Bought Together ───────────────────────────────
const sample = storeProduct('dual-dash-cam')!;
const rel = relatedProducts(sample, 3);
check('related excludes the product itself', rel.every((p) => p.slug !== sample.slug));
check('related returns up to limit', rel.length > 0 && rel.length <= 3);
const fbt = frequentlyBoughtTogether(sample, 3);
check('fbt excludes the product itself', fbt.every((p) => p.slug !== sample.slug));
check('fbt returns distinct products', new Set(fbt.map((p) => p.slug)).size === fbt.length);

// ── 12. Search / filter / sort ─────────────────────────────────────────────
check('filter by category', filterAndSortProducts(STORE_PRODUCTS, { category: 'electronics' }).every((p) => p.category === 'electronics'));
check('query matches text', filterAndSortProducts(STORE_PRODUCTS, { query: 'dash cam' }).some((p) => p.productType === 'dash-cam'));
check('unmatched query returns none', filterAndSortProducts(STORE_PRODUCTS, { query: 'zzzznomatch' }).length === 0);
check('empty filter returns all 104', filterAndSortProducts(STORE_PRODUCTS, {}).length === 104);

// ── 13. Analytics event names ──────────────────────────────────────────────
check('storeView', STORE_EVENTS.storeView === 'store_page_view');
check('productView', STORE_EVENTS.productView === 'store_product_view');
check('categoryView', STORE_EVENTS.categoryView === 'store_category_view');
check('guideView', STORE_EVENTS.guideView === 'store_guide_view');
check('picksView', STORE_EVENTS.picksView === 'store_picks_view');
check('amazonCtaClick', STORE_EVENTS.amazonCtaClick === 'store_amazon_cta_click');
check('all events store_-prefixed', Object.values(STORE_EVENTS).every((e) => e.startsWith('store_')));

// ── 14. Href helpers ───────────────────────────────────────────────────────
check('productHref shape', productHref('dual-dash-cam') === '/store/products/dual-dash-cam');
check('storeCategoryHref shape', storeCategoryHref('electronics') === '/store/category/electronics');

// ── 15. Disclosure present where affiliate links live ──────────────────────
check('long disclosure names Amazon Associate', /Amazon Associate/.test(AMAZON_DISCLOSURE));
check('short disclosure names Amazon Associate', /Amazon Associate/.test(AMAZON_DISCLOSURE_SHORT));
check('AmazonDisclosure renders the constant', /AMAZON_DISCLOSURE/.test(read('src/components/store/AmazonDisclosure.tsx')));

// ── 16. CTA components gate on the full activation rule ────────────────────
const ctaSrc = read('src/components/store/AmazonCta.tsx');
check('AmazonCta gates on amazonProductUrl', /amazonProductUrl\(/.test(ctaSrc));
check('AmazonCta gates on productActive', /productActive\(/.test(ctaSrc));
check('AmazonCta applies AMAZON_REL', /AMAZON_REL/.test(ctaSrc));
check('AmazonCta opens new tab', /target="_blank"/.test(ctaSrc));
check('AmazonCta has coming-soon fallback', /coming soon/i.test(ctaSrc));
const stickySrc = read('src/components/store/StickyAmazonCta.tsx');
check('StickyAmazonCta gates on amazonProductUrl', /amazonProductUrl\(/.test(stickySrc));
check('StickyAmazonCta gates on productActive', /productActive\(/.test(stickySrc));
check('StickyAmazonCta can return null', /return null/.test(stickySrc));

// ── 17. No scraped/hotlinked Amazon image host in store code ───────────────
for (const f of [
  'src/lib/store/products.ts',
  'src/components/store/ProductImage.tsx',
  'src/components/store/ProductCard.tsx',
  'src/components/store/ComparisonTable.tsx',
  'src/lib/store/schema.ts',
]) {
  check(`${f}: no media-amazon host`, !/media-amazon\.com|images-amazon\.com|ssl-images-amazon/.test(read(f)));
}

// ── 18. Nav / footer / sitemap wiring ──────────────────────────────────────
check('header links to /store', /href:\s*'\/store'/.test(read('src/components/layout/Header.tsx')));
const footer = read('src/components/layout/Footer.tsx');
check('footer links to /store', /href:\s*'\/store'/.test(footer));
check('footer links to guides', /\/store\/guides/.test(footer));
check('footer links to shawns-picks', /\/store\/shawns-picks/.test(footer));
const sitemap = read('src/app/sitemap.ts');
check('sitemap imports STORE_PRODUCTS', /STORE_PRODUCTS/.test(sitemap));
check('sitemap imports STORE_GUIDES', /STORE_GUIDES/.test(sitemap));
check('sitemap includes /store/guides', /\/store\/guides/.test(sitemap));
check('sitemap includes /store/shawns-picks', /\/store\/shawns-picks/.test(sitemap));

// ── 19. Owner-fill CSV template exists and is complete ─────────────────────
const csv = read('docs/store/owner-fill-template.csv').trim().split('\n');
check('csv has header + 104 rows', csv.length === 105, csv.length);
for (const col of ['slug', 'asin', 'verified_title', 'price_usd', 'rating', 'review_count', 'image_path']) {
  check(`csv header has ${col}`, csv[0].includes(col));
}

// ── 20. First-12 activation artifacts: input CSV blank + validator present ─
const first12 = read('docs/store/first-12-product-input.csv').trim().split('\n');
check('first-12 CSV has header + 12 rows', first12.length === 13, first12.length);
check('first-12 header has product_id + asin + verified_amazon_title', /product_id/.test(first12[0]) && /asin/.test(first12[0]) && /verified_amazon_title/.test(first12[0]));
for (let i = 1; i < first12.length; i++) {
  const cols = first12[i].split(',');
  // columns after product_id(0)+product_name(1) up through notes: asin(2)..alt_image_2(10) must be blank
  check(`first-12 row ${i}: Amazon fields blank`, cols.slice(2, 11).every((c) => c.trim() === ''));
}
check('validator script present', /isValidAsin/.test(read('scripts/validate-first-12.ts')));
check('activation-rules doc present', /activate/i.test(read('docs/store/activation-rules.md')));

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\nStore tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
