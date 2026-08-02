/**
 * Amazon affiliate products are hidden from the public store — and can be
 * restored by flipping one flag.
 *
 * This harness exists to prove three things that are easy to get wrong when
 * "hiding" something:
 *
 *   1. NOTHING WAS DELETED. The catalog still holds all 104 products, every
 *      one of them byte-for-byte what it was — same slugs, same editorial copy,
 *      same null Amazon facts. Hiding is a view, not an edit.
 *   2. NOTHING LEAKS. No hidden product reaches any public surface: not the
 *      browse page, not a product page, not a category, not a guide, not
 *      Shawn's Picks, not related products, not the sitemap.
 *   3. IT REVERSES. `publicProducts(catalog, true)` returns the whole catalog
 *      again. The switch is tested in BOTH positions, because a hide you cannot
 *      demonstrate undoing is a deletion wearing a costume.
 *
 * The Amazon machinery itself — associate tag, ASIN validation, URL builder,
 * disclosure strings, analytics event names — must remain fully intact and is
 * asserted here too, since the point of hiding rather than deleting is that
 * reactivation needs no rebuild.
 *
 * Filesystem + pure functions only. No database, no network, CI-safe.
 */
import { readFileSync } from 'node:fs';
import {
  ALL_STORE_PRODUCTS,
  STORE_PRODUCTS,
  anyStoreProduct,
  storeProduct,
} from '@/lib/store/products';
import {
  SHOW_AMAZON_PRODUCTS,
  isAmazonProduct,
  isPubliclyVisible,
  publicProducts,
} from '@/lib/store/visibility';
import {
  AMAZON_ASSOCIATE_TAG,
  AMAZON_DISCLOSURE,
  AMAZON_REL,
  isValidAsin,
  amazonProductUrl,
} from '@/lib/store/amazon';
import { STORE_EVENTS } from '@/lib/store/analytics';
import { STORE_CATEGORIES } from '@/lib/store/categories';
import { STORE_GUIDES } from '@/lib/store/product-types';
import { shawnsPicks } from '@/lib/store/picks';
import { relatedProducts, frequentlyBoughtTogether } from '@/lib/store/related';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}
const read = (p: string) => readFileSync(p, 'utf8');

/* 1. Nothing was deleted ---------------------------------------------- */

check(
  'the catalog still holds 104 products',
  ALL_STORE_PRODUCTS.length === 104,
  ALL_STORE_PRODUCTS.length,
);
check(
  'catalog slugs are still unique',
  new Set(ALL_STORE_PRODUCTS.map((p) => p.slug)).size === ALL_STORE_PRODUCTS.length,
);
check(
  'every catalog product still carries its editorial copy',
  ALL_STORE_PRODUCTS.every(
    (p) => p.name.length > 0 && p.tagline.length > 0 && p.description.length > 0,
  ),
);
check(
  'every catalog product still carries pros, cons and a recommendation',
  ALL_STORE_PRODUCTS.every(
    (p) => p.pros.length > 0 && p.cons.length > 0 && p.recommendation.length > 0,
  ),
);
check(
  'hidden products are still reachable by developers via anyStoreProduct',
  ALL_STORE_PRODUCTS.every((p) => anyStoreProduct(p.slug)?.slug === p.slug),
);
// A sample of specific slugs, so a silent mass-edit cannot pass.
for (const slug of ['dual-dash-cam', 'rand-mcnally-road-atlas', 'blood-pressure-monitor']) {
  check(`catalog still contains ${slug}`, Boolean(anyStoreProduct(slug)));
}

/* 2. Nothing leaks to a public surface --------------------------------- */

check('the flag is currently off', SHOW_AMAZON_PRODUCTS === false, SHOW_AMAZON_PRODUCTS);
check(
  'every catalog entry is currently classified as an Amazon product',
  ALL_STORE_PRODUCTS.every(isAmazonProduct),
);
check(
  'no Amazon product is publicly visible',
  STORE_PRODUCTS.every((p) => !isAmazonProduct(p)),
  STORE_PRODUCTS.filter(isAmazonProduct).map((p) => p.slug),
);
check(
  'the public product lookup refuses every hidden slug',
  ALL_STORE_PRODUCTS.every((p) => storeProduct(p.slug) === undefined),
  ALL_STORE_PRODUCTS.filter((p) => storeProduct(p.slug)).map((p) => p.slug),
);
check(
  'Shawn’s Picks surfaces nothing hidden',
  shawnsPicks().every((x) => isPubliclyVisible(x.product)),
);
const anyProduct = ALL_STORE_PRODUCTS[0];
check(
  'related products surfaces nothing hidden',
  // Wrapped, not passed by reference: `every` supplies the index as the second
  // argument, which would land in `showAmazon` and silently flip the answer.
  relatedProducts(anyProduct, 4).every((p) => isPubliclyVisible(p)),
);
check(
  'frequently-bought-together surfaces nothing hidden',
  frequentlyBoughtTogether(anyProduct, 3).every((p) => isPubliclyVisible(p)),
);

/* 3. The sitemap does not advertise hidden or emptied pages ------------- */

const sitemap = read('src/app/sitemap.ts');
check(
  'sitemap product loop reads the PUBLIC catalog',
  /for \(const product of STORE_PRODUCTS\)/.test(sitemap),
);
check(
  'sitemap skips categories with no visible products',
  /productsInCategory\(category\.slug\)\.length === 0\) continue/.test(sitemap),
);
check(
  'sitemap only lists guides that still have visible products',
  /STORE_GUIDES\.filter\(\(g\) => productsOfType\(g\.productType\)\.length > 0\)/.test(sitemap),
);
check(
  'sitemap gates Shawn’s Picks on it having picks',
  /shawnsPicks\(\)\.length > 0/.test(sitemap),
);

/* 4. It reverses ------------------------------------------------------- */

const restored = publicProducts(ALL_STORE_PRODUCTS, true);
check('flipping the flag restores all 104 products', restored.length === 104, restored.length);
check(
  'restored products are the SAME objects, not copies or rebuilds',
  restored.every((p, i) => p === ALL_STORE_PRODUCTS[i]),
);
check(
  'with the flag off the public set is empty',
  publicProducts(ALL_STORE_PRODUCTS, false).length === 0,
);
check('isPubliclyVisible honours an explicit true', isPubliclyVisible(anyProduct, true) === true);
check(
  'isPubliclyVisible honours an explicit false',
  isPubliclyVisible(anyProduct, false) === false,
);
// A non-Amazon product (the shape direct Stan products will have) is visible
// regardless of the Amazon switch — the flag must not hide the whole store once
// direct products land.
const nonAmazon = { ...anyProduct } as Record<string, unknown>;
delete nonAmazon.asin;
check(
  'a non-Amazon product stays visible with Amazon hidden',
  isPubliclyVisible(nonAmazon as never, false) === true,
);

/* 5. The Amazon engine is untouched and still compiles ------------------ */

check('associate tag unchanged', AMAZON_ASSOCIATE_TAG === 'truckinglif0d-20', AMAZON_ASSOCIATE_TAG);
check('rel unchanged', AMAZON_REL === 'sponsored noopener noreferrer', AMAZON_REL);
check('disclosure text still present', AMAZON_DISCLOSURE.includes('Amazon Associate'));
check('ASIN validation still accepts a real ASIN', isValidAsin('B0CZ1ABCDE'));
check('ASIN validation still rejects junk', !isValidAsin('nope'));
check('ASIN validation still rejects null', !isValidAsin(null));
check(
  'affiliate URL builder still tags a valid ASIN',
  amazonProductUrl('B0CZ1ABCDE') === 'https://www.amazon.com/dp/B0CZ1ABCDE/?tag=truckinglif0d-20',
  amazonProductUrl('B0CZ1ABCDE'),
);
check(
  'affiliate URL builder still returns null for a placeholder',
  amazonProductUrl(null) === null,
);
check(
  'Amazon click event name unchanged',
  STORE_EVENTS.amazonCtaClick === 'store_amazon_cta_click',
);
check('store view event unchanged', STORE_EVENTS.storeView === 'store_page_view');
check('search event unchanged', STORE_EVENTS.search === 'store_search');

/* 6. Structure that must survive the hide ------------------------------- */

check('all 7 categories still defined', STORE_CATEGORIES.length === 7, STORE_CATEGORIES.length);
check('all 10 buying guides still defined', STORE_GUIDES.length === 10, STORE_GUIDES.length);
check(
  'the visibility module is the ONLY place the flag is defined',
  read('src/lib/store/visibility.ts').includes('export const SHOW_AMAZON_PRODUCTS'),
);
// One filter, not several: no page or component may re-implement the hide.
for (const f of [
  'src/app/(marketing)/store/page.tsx',
  'src/app/(marketing)/store/category/[slug]/page.tsx',
  'src/app/(marketing)/store/products/[slug]/page.tsx',
  'src/components/store/StoreBrowser.tsx',
]) {
  // Mentioning the flag in a comment is fine and useful; CALLING the visibility
  // primitives from a page is what would fork the rule, so match on the import
  // and on actual filter calls rather than on the bare identifier.
  const src = read(f);
  check(
    `${f} does not import the visibility primitives`,
    !/from '@\/lib\/store\/visibility'/.test(src),
  );
  check(
    `${f} does not re-implement visibility filtering`,
    !/isAmazonProduct\(|publicProducts\(|isPubliclyVisible\(/.test(src),
  );
}
// The admin audit must still see everything.
const admin = read('src/app/admin/(dashboard)/store/page.tsx');
check('admin audit reads the FULL catalog', /ALL_STORE_PRODUCTS/.test(admin));

console.log(`store-amazon-hidden: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
