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
  SHIPPING_RETURNS_HREF,
  SHIRT_SUPPORT_EMAIL,
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
import { LEGAL } from '@/lib/legal/company';

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
// Owner-approved prices (2026-08-02). Pinned to the exact figure so a typo or
// a silent edit fails here rather than on a customer-facing page. Integers, so
// the label is a plain `$N` with no rounding or float formatting in the path.
const APPROVED_PRICES: Array<[string, number, string]> = [
  ['founding-member-shirt', 35, '$35'],
  ['17-years-zero-violations', 19, '$19'],
  ['owner-operator-money', 19, '$19'],
  ['coaching-call', 20, '$20'],
];
for (const [slug, price, label] of APPROVED_PRICES) {
  const p = directProduct(slug)!;
  check(`${slug}: price is the approved ${label}`, p.priceUsd === price, p.priceUsd);
  check(`${slug}: renders exactly "${label}"`, directPriceLabel(p) === label, directPriceLabel(p));
  check(`${slug}: price is an integer, not a float`, Number.isInteger(p.priceUsd), p.priceUsd);
  check(`${slug}: label carries no decimals or stray zeros`, /^\$\d+$/.test(directPriceLabel(p)!));
}

// The blank-price products are exactly the ones still awaiting a decision.
// After the 2026-08-02 pricing approval that is the four disclaimer-blocked
// guides and nothing else.
const blank = DIRECT_PRODUCTS.filter((p) => p.priceUsd === null).map((p) => p.slug);
check(
  'exactly the 4 unpriced products are unpriced',
  blank.length === 4 &&
    !blank.includes('founding-member-shirt') &&
    !blank.some((s) => byType('free').some((f) => f.slug === s)) &&
    !blank.some((s) => APPROVED_PRICES.some(([a]) => a === s)),
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
// The 5 free guides + the Founder Shirt + the three products priced on
// 2026-08-02. Enumerated rather than counted, so adding a product without a
// price decision cannot slip in behind a passing total.
const EXPECTED_ACTIONABLE = [
  ...byType('free').map((f) => f.slug),
  'founding-member-shirt',
  '17-years-zero-violations',
  'owner-operator-money',
  'coaching-call',
];
check(
  'exactly the 5 free guides, the Founder Shirt, and the 3 newly priced products are actionable',
  actionableSlugs.length === EXPECTED_ACTIONABLE.length &&
    EXPECTED_ACTIONABLE.every((s) => actionableSlugs.includes(s)),
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
/* 5b. The Founder Shirt is UNBLOCKED, and the policy that unblocked it exists */

const shirt = directProduct('founding-member-shirt')!;
const shirtCta = ctaState(shirt);
check('the shirt has no remaining policy blocker', shirt.purchaseBlockedReason === null);
check('the shirt offers an active purchase CTA', shirtCta.kind === 'buy', shirtCta);
check('the shirt CTA says Buy now', shirtCta.label === 'Buy now', shirtCta.label);
check(
  'the shirt CTA points at the approved Stan URL',
  'href' in shirtCta && shirtCta.href === shirt.stanUrl,
  shirtCta,
);
check('the shirt price is still $35', shirt.priceUsd === 35, shirt.priceUsd);

// The policy page must EXIST and must be reachable, or the CTA is live over
// nothing — the exact situation the blocker was protecting against.
const POLICY_PAGE = 'src/app/(marketing)/store/shipping-returns/page.tsx';
check('the shipping & returns page exists', existsSync(POLICY_PAGE));
check(
  'its route matches SHIPPING_RETURNS_HREF',
  SHIPPING_RETURNS_HREF === '/store/shipping-returns',
);
// Comments stripped: the page's own docblock explains WHY it avoids the
// forbidden claims, and that explanation must not trip the forbidden-claim
// scan below. Only shipped copy is tested.
const policy = read(POLICY_PAGE)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/^\s*\/\/[^\n]*$/gm, '');

// Each owner-confirmed fact appears, verbatim in substance.
for (const [label, re] of [
  ['made and shipped by Trucking Life With Shawn', /made and shipped by Trucking Life With Shawn/i],
  ['checkout occurs through Stan Store', /Checkout occurs through Stan Store/i],
  [
    'Stan shows charges before payment',
    /shows shipping charges and estimated\s+delivery information before payment/i,
  ],
  ['dispatch within 10 business days', /dispatched within 10 business days/i],
  ['case-by-case review', /reviewed on a case-by-case basis/i],
  ['14-day report window', /within 14 days of delivery or the expected delivery date/i],
  ['returns are not accepted', /Returns are not accepted/i],
  ['size exchanges are not accepted', /Size exchanges are not accepted/i],
  ['physical product', /physical product/i],
] as const) {
  check(`policy states: ${label}`, re.test(policy));
}

// And each forbidden claim is ABSENT. These are the ways a merch policy goes
// wrong: promising delivery, inventing a vendor, or offering remedies nobody
// agreed to.
for (const [label, re] of [
  ['free shipping', /free shipping/i],
  ['guaranteed delivery', /guarantee/i],
  ['an unconfirmed vendor', /printful|printify|gelato|teespring|shopify/i],
  ['refunds', /\brefund/i],
  ['exchanges being offered', /exchanges are accepted|we will exchange/i],
  ['a warranty', /\bwarrant/i],
  ['a free-shipping threshold', /\$\d+\s*(free|threshold)/i],
] as const) {
  check(`policy does NOT claim: ${label}`, !re.test(policy), policy.match(re)?.[0]);
}

check('policy uses the owner-designated support email', policy.includes('SHIRT_SUPPORT_EMAIL'));
check(
  'order support is NOT routed to the privacy address',
  (SHIRT_SUPPORT_EMAIL as string) !== (LEGAL.contactEmail as string),
  { support: SHIRT_SUPPORT_EMAIL, privacy: LEGAL.contactEmail },
);
check(
  'the product page links the policy for physical products',
  /product\.fulfillment === 'physical'/.test(read('src/components/store/DirectProductView.tsx')) &&
    /SHIPPING_RETURNS_HREF/.test(read('src/components/store/DirectProductView.tsx')),
);
check(
  'the sitemap lists the policy page',
  read('src/lib/seo/sitemap-entries.ts').includes('SHIPPING_RETURNS_HREF'),
);

// What remains blocked, and why. After the 2026-08-02 pricing approval the
// only products without a purchase path are the four whose blocker is a
// missing DISCLAIMER, not a missing price — so a future pricing decision must
// not quietly unblock them. That is asserted directly below.
const stillBlocked = DIRECT_PRODUCTS.filter((p) => ctaState(p).kind === 'details').map(
  (p) => p.slug,
);
const DISCLAIMER_BLOCKED = [
  'carnivore-trucker-health-system',
  'save-your-cdl-sap-guide',
  'cdl-crusher-guide',
  'hos-bible',
];
check('exactly 4 products remain non-purchasable', stillBlocked.length === 4, stillBlocked);
check('the shirt is NOT among the blocked', !stillBlocked.includes('founding-member-shirt'));
for (const slug of DISCLAIMER_BLOCKED) {
  check(`${slug} remains non-purchasable`, stillBlocked.includes(slug));
  check(
    `${slug} is held by a disclaimer blocker, not merely an absent price`,
    Boolean(directProduct(slug)!.purchaseBlockedReason),
  );
}
check(
  'the blocked set is exactly the disclaimer-pending four',
  stillBlocked.every((s) => DISCLAIMER_BLOCKED.includes(s)),
  stillBlocked,
);

// The three newly priced products are actionable, and each keeps the CTA kind
// its type demands — a coaching call books, a digital guide buys.
const NEWLY_ACTIVE: Array<[string, 'buy' | 'book']> = [
  ['17-years-zero-violations', 'buy'],
  ['owner-operator-money', 'buy'],
  ['coaching-call', 'book'],
];
for (const [slug, kind] of NEWLY_ACTIVE) {
  const p = directProduct(slug)!;
  const cta = ctaState(p);
  check(`${slug}: now actionable`, cta.kind !== 'details', cta);
  check(`${slug}: CTA kind is "${kind}"`, cta.kind === kind, cta.kind);
  check(`${slug}: no policy blocker remains`, p.purchaseBlockedReason === null);
  check(`${slug}: CTA points at its approved Stan URL`, 'href' in cta && cta.href === p.stanUrl);
  check(
    `${slug}: Stan URL is on the approved account`,
    p.stanUrl.startsWith('https://stan.store/TRUCKINGLIFEWITHSHAWN/p/'),
  );
}
check(
  'exactly 9 direct products are actionable',
  DIRECT_PRODUCTS.filter((p) => ctaState(p).kind !== 'details').length === 9,
  DIRECT_PRODUCTS.filter((p) => ctaState(p).kind !== 'details').map((p) => p.slug),
);

// Narrow-viewport safety, argued from string length rather than a rendered
// browser. Pricing a product swaps two strings: the price slot goes from
// "Price coming soon" to "$N", and the CTA from "Details coming soon" to
// "Buy now" / "Book your call". Both replacements are SHORTER than what they
// replace, in the same containers, so no width that fitted before can overflow
// now. (The price also renders at text-3xl vs base — 3 characters against 17
// still wins comfortably.) This is a bound, not a screenshot.
const PRICE_PLACEHOLDER = 'Price coming soon';
const CTA_PLACEHOLDER = 'Details coming soon';
for (const [slug] of NEWLY_ACTIVE) {
  const p = directProduct(slug)!;
  const label = directPriceLabel(p)!;
  const cta = ctaState(p);
  check(
    `${slug}: price label "${label}" is shorter than the placeholder it replaces`,
    label.length < PRICE_PLACEHOLDER.length,
    { label: label.length, placeholder: PRICE_PLACEHOLDER.length },
  );
  check(
    `${slug}: CTA label "${cta.label}" is no longer than the placeholder it replaces`,
    cta.label.length <= CTA_PLACEHOLDER.length,
    { label: cta.label.length, placeholder: CTA_PLACEHOLDER.length },
  );
  check(`${slug}: price label is short enough for a 320px column`, label.length <= 8, label);
}

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
const sitemap = read('src/lib/seo/sitemap-entries.ts');
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
// The owner-designated order-support address is intentional and public. Any
// OTHER address in the catalog would be a leak.
const emails = [...new Set(catalogSrc.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? [])];
check(
  'the only email in the catalog is the designated support address',
  emails.every((e) => e === SHIRT_SUPPORT_EMAIL),
  emails,
);
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
