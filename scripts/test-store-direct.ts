/**
 * The Trucking Life direct storefront — the 13 products the store actually
 * sells while the Amazon catalog is hidden.
 *
 * What this guards, in order of how much it would hurt to get wrong:
 *
 *   1. NO INVENTED PRICE, AND NO WAY TO PAY FOR ONE. A product whose price the
 *      owner has not confirmed must render no number and no purchase button.
 *      This is the whole reason `ctaState()` exists, so it is tested per
 *      product and per state, not once.
 *   2. NO UNAPPROVED DESTINATION. Every checkout link must sit under the one
 *      approved Stan account prefix. A typo'd or foreign host here sends
 *      customers and money somewhere nobody authorised.
 *   3. THE LEGAL GATES HOLD. The four products awaiting disclaimer copy, and
 *      the shirt awaiting return/shipping copy, are listed but not sellable.
 *   4. THE STORE IS NOT EMPTY. 13 direct products public, 0 Amazon products
 *      public, 104 Amazon products preserved.
 *   5. STOCK HAS ONE SOURCE. The shirt's "N left" comes from
 *      shirt-inventory.ts and is never written at a call site.
 *
 * Filesystem + pure functions only. No database, no network, CI-safe.
 */
import { readFileSync, existsSync } from 'node:fs';
import {
  DIRECT_PRODUCTS,
  STAN_ACCOUNT_PREFIX,
  ctaState,
  directCategories,
  directPriceLabel,
  directProduct,
  directProductHref,
  filterDirectProducts,
  fulfillmentLabel,
  shirtStockLabel,
} from '@/lib/store/direct';
import { ALL_STORE_PRODUCTS, STORE_PRODUCTS } from '@/lib/store/products';
import { SHIRTS_LEFT, SHIRTS_TOTAL_RUN } from '@/lib/store/shirt-inventory';
import { STORE_EVENTS } from '@/lib/store/analytics';

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

/* 1. The approved 13, exactly ------------------------------------------ */

const APPROVED = [
  'drivers-mind',
  'free-dot-mistakes',
  'first-72-hours',
  'dot-inspection-cheat-sheet',
  'freedom-we-haul',
  'founding-member-shirt',
  '17-years-zero-violations',
  'carnivore-trucker-health-system',
  'save-your-cdl-sap-guide',
  'cdl-crusher-guide',
  'hos-bible',
  'owner-operator-money',
  'coaching-call',
];

check('exactly 13 direct products', DIRECT_PRODUCTS.length === 13, DIRECT_PRODUCTS.length);
check(
  'the catalog is exactly the approved set',
  APPROVED.every((s) => Boolean(directProduct(s))) &&
    DIRECT_PRODUCTS.every((p) => APPROVED.includes(p.slug)),
  DIRECT_PRODUCTS.map((p) => p.slug).filter((s) => !APPROVED.includes(s)),
);
check(
  'direct slugs are unique',
  new Set(DIRECT_PRODUCTS.map((p) => p.slug)).size === DIRECT_PRODUCTS.length,
);
check(
  'direct slugs are kebab-case',
  DIRECT_PRODUCTS.every((p) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)),
);

const byType = (t: string) => DIRECT_PRODUCTS.filter((p) => p.type === t);
check('5 free products', byType('free').length === 5, byType('free').length);
check('1 merch product', byType('merch').length === 1, byType('merch').length);
check('6 digital products', byType('digital').length === 6, byType('digital').length);
check('1 coaching product', byType('coaching').length === 1, byType('coaching').length);

/* 2. No unapproved destination ----------------------------------------- */

for (const p of DIRECT_PRODUCTS) {
  check(
    `${p.slug}: checkout URL is on the approved Stan account`,
    p.stanUrl.startsWith(STAN_ACCOUNT_PREFIX),
    p.stanUrl,
  );
  check(`${p.slug}: checkout URL is https`, p.stanUrl.startsWith('https://'));
  check(
    `${p.slug}: checkout URL has a product path`,
    p.stanUrl.length > STAN_ACCOUNT_PREFIX.length,
  );
}
check(
  'no direct product links to Amazon',
  DIRECT_PRODUCTS.every((p) => !p.stanUrl.includes('amazon.')),
);

/* 3. Price honesty ------------------------------------------------------ */

for (const p of DIRECT_PRODUCTS) {
  check(
    `${p.slug}: price is a confirmed number or explicitly null`,
    p.priceUsd === null || (typeof p.priceUsd === 'number' && p.priceUsd >= 0),
    p.priceUsd,
  );
  if (p.priceUsd === null) {
    check(`${p.slug}: unconfirmed price renders NO label`, directPriceLabel(p) === null);
  }
}
check(
  'free products are priced 0',
  byType('free').every((p) => p.priceUsd === 0),
);
check(
  'free products label as Free',
  byType('free').every((p) => directPriceLabel(p) === 'Free'),
);
check(
  'the shirt is the approved $35',
  directProduct('founding-member-shirt')?.priceUsd === 35,
  directProduct('founding-member-shirt')?.priceUsd,
);
check(
  'the shirt labels as $35',
  directPriceLabel(directProduct('founding-member-shirt')!) === '$35',
);
// The six blank-price products are exactly the ones expected to be blank.
const blank = DIRECT_PRODUCTS.filter((p) => p.priceUsd === null).map((p) => p.slug);
check(
  'exactly the 7 unpriced products are unpriced',
  blank.length === 7 &&
    !blank.includes('founding-member-shirt') &&
    !blank.some((s) => byType('free').some((f) => f.slug === s)),
  blank,
);

/* 4. THE CTA GATE — no purchase path without a confirmed price ---------- */

for (const p of DIRECT_PRODUCTS) {
  const cta = ctaState(p);
  const actionable = cta.kind !== 'details';
  if (p.priceUsd === null) {
    check(`${p.slug}: null price ⇒ NO purchase or booking CTA`, !actionable, cta);
  }
  if (p.purchaseBlockedReason) {
    check(`${p.slug}: policy blocker ⇒ NO purchase CTA`, !actionable, cta);
    check(
      `${p.slug}: the blocker states a reason`,
      cta.kind === 'details' && cta.reason.length > 0,
    );
  }
  if (actionable) {
    check(
      `${p.slug}: an actionable CTA points at its Stan URL`,
      'href' in cta && cta.href === p.stanUrl,
    );
    check(
      `${p.slug}: an actionable CTA only exists with a confirmed price`,
      p.priceUsd !== null,
      p.priceUsd,
    );
  }
  check(
    `${p.slug}: CTA label is never a bare "Buy now" over an unknown price`,
    !(cta.label === 'Buy now' && p.priceUsd === null),
  );
}

// Free products: the ONLY group that should be freely actionable today.
for (const p of byType('free')) {
  const cta = ctaState(p);
  check(`${p.slug}: free product offers a working free CTA`, cta.kind === 'get-free');
  check(`${p.slug}: free CTA says it is free`, cta.label.toLowerCase().includes('free'));
  check(`${p.slug}: free CTA uses its approved Stan URL`, 'href' in cta && cta.href === p.stanUrl);
}

const actionableSlugs = DIRECT_PRODUCTS.filter((p) => ctaState(p).kind !== 'details').map(
  (p) => p.slug,
);
check(
  'exactly the 5 free products are purchasable/actionable right now',
  actionableSlugs.length === 5 &&
    actionableSlugs.every((s) => byType('free').some((f) => f.slug === s)),
  actionableSlugs,
);

/* 5. Legal gates -------------------------------------------------------- */

for (const slug of [
  'save-your-cdl-sap-guide',
  'hos-bible',
  'cdl-crusher-guide',
  'carnivore-trucker-health-system',
]) {
  const p = directProduct(slug)!;
  check(`${slug} is listed`, Boolean(p));
  check(`${slug} is NOT purchasable pending disclaimer copy`, ctaState(p).kind === 'details');
}
const shirt = directProduct('founding-member-shirt')!;
check(
  'the shirt is blocked pending return/shipping copy, despite having a price',
  ctaState(shirt).kind === 'details' && Boolean(shirt.purchaseBlockedReason),
);
check(
  'no returns or shipping page exists yet, which is why the shirt is blocked',
  !existsSync('src/app/(marketing)/returns/page.tsx') &&
    !existsSync('src/app/(marketing)/shipping/page.tsx'),
);

/* 6. Type invariants ---------------------------------------------------- */

check(
  'merch ships physically',
  byType('merch').every((p) => p.fulfillment === 'physical'),
);
check(
  'coaching is a scheduled service, never a download',
  byType('coaching').every((p) => p.fulfillment === 'scheduled-service'),
);
check(
  'digital products are delivered digitally',
  byType('digital').every((p) => p.fulfillment === 'digital'),
);
check(
  'coaching copy does not imply a download',
  byType('coaching').every((p) => /not a (digital )?download/i.test(p.description)),
);
check(
  'digital copy does not imply shipping',
  byType('digital').every((p) => !/\bshipped\b|\bshipping\b/i.test(p.tagline)),
);
check(
  'fulfillment wording is distinct per mode',
  new Set(['digital', 'physical', 'scheduled-service'].map((f) => fulfillmentLabel(f as never)))
    .size === 3,
);

/* 7. Shirt stock has ONE source ---------------------------------------- */

check(
  'shirt stock label reads from shirt-inventory',
  shirtStockLabel() === `${SHIRTS_LEFT} of ${SHIRTS_TOTAL_RUN} left`,
);
check(
  'the catalog hard-codes no shirt count',
  !/only 100|100 made|\b49\b/i.test(
    read('src/lib/store/direct.ts').replace(/SHIRTS_(LEFT|TOTAL_RUN)/g, ''),
  ),
);
for (const f of [
  'src/components/store/DirectProductCard.tsx',
  'src/components/store/DirectProductView.tsx',
]) {
  check(`${f} reads stock through shirtStockLabel()`, /shirtStockLabel\(\)/.test(read(f)));
  check(`${f} hard-codes no stock number`, !/only 100|\b49 (left|of)\b/i.test(read(f)));
}

/* 8. Images exist ------------------------------------------------------- */

for (const p of DIRECT_PRODUCTS) {
  check(`${p.slug}: image path is under /store/products/`, p.image.startsWith('/store/products/'));
  check(`${p.slug}: image file exists`, existsSync(`public${p.image}`), `public${p.image}`);
  check(`${p.slug}: image is a webp`, p.image.endsWith('.webp'));
}

/* 9. Search + category filtering --------------------------------------- */

const cats = directCategories();
check(
  'categories are derived, non-empty and unique',
  cats.length > 0 && new Set(cats).size === cats.length,
  cats,
);
check(
  'every product’s category is offered by the filter',
  DIRECT_PRODUCTS.every((p) => cats.includes(p.category)),
);
check('empty filter returns all 13', filterDirectProducts(DIRECT_PRODUCTS, {}).length === 13);
check(
  'category filter narrows correctly',
  filterDirectProducts(DIRECT_PRODUCTS, { category: 'Coaching' }).every(
    (p) => p.category === 'Coaching',
  ),
);
check(
  'search matches a known product',
  filterDirectProducts(DIRECT_PRODUCTS, { query: 'hos' }).some((p) => p.slug === 'hos-bible'),
);
check(
  'search is case-insensitive',
  filterDirectProducts(DIRECT_PRODUCTS, { query: 'COACHING' }).length > 0,
);
check(
  'unmatched search returns none',
  filterDirectProducts(DIRECT_PRODUCTS, { query: 'zzzznomatch' }).length === 0,
);
check(
  'featured products sort first',
  (() => {
    const r = filterDirectProducts(DIRECT_PRODUCTS, {});
    const lastFeatured = r.map((p) => p.featured).lastIndexOf(true);
    const firstUnfeatured = r.map((p) => p.featured).indexOf(false);
    return firstUnfeatured === -1 || lastFeatured < firstUnfeatured;
  })(),
);

/* 10. The store is not empty, and Amazon is preserved but hidden -------- */

check(
  '104 Amazon products are preserved',
  ALL_STORE_PRODUCTS.length === 104,
  ALL_STORE_PRODUCTS.length,
);
check('0 Amazon products are public', STORE_PRODUCTS.length === 0, STORE_PRODUCTS.length);
check('13 direct products are public', DIRECT_PRODUCTS.length === 13);
check('the public store is NOT empty', DIRECT_PRODUCTS.length > 0);

const storePage = read('src/app/(marketing)/store/page.tsx');
check('the store page renders the direct catalog', /DirectStoreBrowser/.test(storePage));
check('the store page no longer claims "100+ picks"', !/100\+ picks/.test(storePage));
check(
  'the store page no longer claims every buy link goes to Amazon',
  !/every buy link goes to Amazon/i.test(storePage),
);
check(
  'no temporarily-unavailable empty state remains',
  !/temporarily unavailable/i.test(storePage),
);

/* 11. Routes + sitemap -------------------------------------------------- */

check(
  'direct hrefs use the existing product route',
  DIRECT_PRODUCTS.every((p) => directProductHref(p.slug) === `/store/products/${p.slug}`),
);
check(
  'no .html route is introduced',
  DIRECT_PRODUCTS.every((p) => !directProductHref(p.slug).includes('.html')),
);
const route = read('src/app/(marketing)/store/products/[slug]/page.tsx');
check(
  'the product route resolves direct products first',
  /directProduct\(params\.slug\)/.test(route),
);
check('the product route prerenders direct slugs', /DIRECT_PRODUCTS/.test(route));
const sitemap = read('src/app/sitemap.ts');
check('sitemap lists direct products', /for \(const product of DIRECT_PRODUCTS\)/.test(sitemap));
check(
  'sitemap still gates Amazon products on visibility',
  /for \(const product of STORE_PRODUCTS\)/.test(sitemap),
);
check(
  'no duplicate privacy page was introduced',
  !existsSync('src/app/(marketing)/store/privacy/page.tsx'),
);

/* 12. Privacy: nothing personal in the catalog -------------------------- */

const catalogSrc = read('src/lib/store/direct.ts');
check('no email address in the catalog', !/[\w.+-]+@[\w-]+\.[\w.]+/.test(catalogSrc));
check('no phone number in the catalog', !/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/.test(catalogSrc));
check('no API key or token in the catalog', !/(api[_-]?key|secret|token)\s*[:=]/i.test(catalogSrc));

/* 13. Analytics --------------------------------------------------------- */

check('Stan click event exists', STORE_EVENTS.stanClick === 'store_stan_click');
check('free-guide click event exists', STORE_EVENTS.freeGuideClick === 'store_free_guide_click');
check('coaching click event exists', STORE_EVENTS.coachingClick === 'store_coaching_click');
check(
  'the Amazon click event is untouched',
  STORE_EVENTS.amazonCtaClick === 'store_amazon_cta_click',
);
check(
  'event names are unique',
  new Set(Object.values(STORE_EVENTS)).size === Object.values(STORE_EVENTS).length,
);
const cta = read('src/components/store/DirectCta.tsx');
check('direct CTAs open safely', /rel="noopener noreferrer"/.test(cta));
// Match the rel ATTRIBUTE, not the bare word — the component's own comment
// explains why `sponsored` is absent, and that explanation should not fail it.
check(
  'direct CTAs are not marked sponsored (they are first-party products)',
  !/rel="[^"]*sponsored[^"]*"/.test(cta),
  cta.match(/rel="[^"]*"/g),
);

console.log(`store-direct: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
