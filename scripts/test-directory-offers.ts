/**
 * Directory offers — approved pricing, capacity, and honesty checks.
 *
 * Offline. The three offers are the only source of pricing in the app, so this
 * asserts the approved figures, that derived values (annual saving) cannot
 * contradict them, that every surface showing a price reads it from this module
 * rather than hard-coding one, and that no page invents scarcity, promises
 * results, or implies a purchase.
 *
 * Approved decisions being enforced:
 *   claim            free, manually reviewed, never auto-modifies a listing
 *   featured listing $99/month or $999/year, up to 3 per category/corridor page
 *   corridor sponsor $299/month or $2,999/year, 1 primary per corridor page
 *
 * Run:
 *   npx esbuild scripts/test-directory-offers.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-directory-offers.cjs && node /tmp/test-directory-offers.cjs
 */
import { readFileSync } from 'node:fs';
import {
  BILLING_LABEL,
  OFFERS,
  annualSavingsCents,
  formatPrice,
  getOffer,
  priceLabel,
} from '@/lib/directory/offers';
import { FUNNEL_INTEREST } from '@/lib/directory/funnel';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) passed++;
  else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ---- the approved numbers, exactly ----
const claim = getOffer('listing-claim');
const featured = getOffer('featured-listing');
const corridor = getOffer('corridor-sponsor');

check('three offers', OFFERS.length === 3, String(OFFERS.length));
check('claim is free (monthly)', claim.monthlyCents === null);
check('claim is free (annual)', claim.annualCents === null);
check('claim price label is Free', priceLabel(claim) === 'Free');
check('featured monthly = $99', featured.monthlyCents === 9900, String(featured.monthlyCents));
check('featured annual = $999', featured.annualCents === 99900, String(featured.annualCents));
check('corridor monthly = $299', corridor.monthlyCents === 29900, String(corridor.monthlyCents));
check('corridor annual = $2,999', corridor.annualCents === 299900, String(corridor.annualCents));

// ---- formatting is exact, including the thousands separator ----
check('formats $99', formatPrice(9900) === '$99', formatPrice(9900));
check('formats $999', formatPrice(99900) === '$999', formatPrice(99900));
check('formats $299', formatPrice(29900) === '$299', formatPrice(29900));
check('formats $2,999', formatPrice(299900) === '$2,999', formatPrice(299900));
check('featured label', priceLabel(featured) === '$99/month or $999/year', priceLabel(featured));
check('corridor label', priceLabel(corridor) === '$299/month or $2,999/year', priceLabel(corridor));

// ---- derived saving cannot contradict the prices ----
check('featured annual saves 12x99-999 = $189', annualSavingsCents(featured) === 9900 * 12 - 99900);
check(
  'corridor annual saves 12x299-2999 = $589',
  annualSavingsCents(corridor) === 29900 * 12 - 299900,
);
check('free offer has no saving', annualSavingsCents(claim) === null);
for (const o of OFFERS) {
  const s = annualSavingsCents(o);
  check(`${o.id}: annual is not dearer than monthly x12`, s === null || s >= 0, String(s));
}

// ---- approved capacity, stated as policy not availability ----
check('featured capacity is three per page', /three/i.test(featured.capacity ?? ''));
check(
  'featured capacity names category or corridor',
  /category|corridor/i.test(featured.capacity ?? ''),
);
check('corridor capacity is one primary', /one primary/i.test(corridor.capacity ?? ''));
check('claim has no capacity limit', claim.capacity === null);

// ---- offer ids double as the CRM tier_interest values ----
for (const o of OFFERS) {
  check(`${o.id} fits tier_interest (<=60)`, o.id.length <= 60);
  check(`${o.id} is a safe token`, /^[a-z][a-z0-9-]*$/.test(o.id));
}
check('funnel claim interest = offer id', FUNNEL_INTEREST.claim === claim.id);
check('funnel featured interest = offer id', FUNNEL_INTEREST.featured === featured.id);
check('funnel corridor interest = offer id', FUNNEL_INTEREST.corridor === corridor.id);
check('billing labels', BILLING_LABEL.monthly === 'Monthly' && BILLING_LABEL.annual === 'Annual');

// ---- claim safety: free, manual, never auto-applies ----
const claimText = [claim.summary, ...claim.includes].join(' ');
check('claim says free', /free/i.test(claimText));
check('claim says manual review', /manual|by hand|review/i.test(claimText));
check('claim disclaims automatic change', /does not transfer or change/i.test(claimText));

// ---- every surface reads pricing from this module ----
const files = {
  offerTable: 'src/components/directory/OfferTable.tsx',
  cta: 'src/components/directory/ListingFunnelCtas.tsx',
  sponsors: 'src/app/(marketing)/sponsors/page.tsx',
  form: 'src/components/sponsors/SponsorInquiryForm.tsx',
};
const src = Object.fromEntries(
  Object.entries(files).map(([k, p]) => [k, readFileSync(p, 'utf8')]),
) as Record<keyof typeof files, string>;

check('OfferTable derives prices', /priceLabel|formatPrice/.test(src.offerTable));
check('OfferTable hard-codes no dollar figure', !/\$\d/.test(src.offerTable));
check('CTA derives its price', /priceLabel\(getOffer\(/.test(src.cta));
check('CTA hard-codes no dollar figure outside the module', !/\$\d/.test(src.cta));
check('sponsors page renders the offer table', /<OfferTable/.test(src.sponsors));
check('sponsors page hard-codes no dollar figure', !/\$\d/.test(src.sponsors));

// The form's <select> labels are the one place a price is written inline, so
// assert they match the module exactly rather than allowing drift.
check(
  'form featured option matches the module price',
  src.form.includes(`Featured listing — ${priceLabel(featured)}`),
);
check(
  'form corridor option matches the module price',
  src.form.includes(`Corridor sponsor — ${priceLabel(corridor)}`),
);
check('form claim option says free', /Claim my directory listing \(free\)/i.test(src.form));

// ---- honesty: no guarantees, no fake scarcity, no purchase language ----
// Scanned against user-visible copy only: comments are stripped first, so a
// doc block that *documents* a banned phrase ("never say '1 spot left'")
// cannot fail the rule it is describing.
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
}
const surfaces = [src.offerTable, src.cta, src.sponsors, src.form].map(stripComments).join('\n');
const BANNED: [RegExp, string][] = [
  [/\bguarantee/i, 'guarantee'],
  [/\bspots? left\b/i, 'fake scarcity (spots left)'],
  [/\bonly \d+ (?:spot|place|slot)/i, 'fake scarcity (only N spots)'],
  [/\bhurry\b/i, 'urgency pressure'],
  [/\bsells? out\b/i, 'scarcity claim'],
  [/\bbuy now\b/i, 'purchase language'],
  [/\badd to cart\b/i, 'cart'],
  [/\bcheckout\b/i, 'checkout'],
  [/\bsubscribe now\b/i, 'subscription language'],
  [/\bwe promise\b/i, 'promise'],
  [/\bmore (?:leads|customers|traffic)\b/i, 'results promise'],
  [/\btop of (?:the )?(?:search|results|google)\b/i, 'ranking promise'],
];
for (const [re, label] of BANNED) {
  check(`no ${label} on any offer surface`, !re.test(surfaces), re.source);
}

// ---- inquiry framing is explicit ----
check('offer table says inquiry', /inquiry/i.test(src.offerTable));
check(
  'offer table denies payment/subscription',
  /does not take payment, start a\s*\n?\s*subscription/i.test(
    src.offerTable.replace(/\s+/g, ' '),
  ) || /does not take payment/i.test(src.offerTable),
);
check('offer table denies auto-approval', /approve a claim|turn on featured/i.test(src.offerTable));
check(
  'offer table states capacity is not a live count',
  /do not publish live spot counts/i.test(src.offerTable),
);
check(
  'offer table explains measurement is being set up',
  /measurement is\s+still being set up/i.test(src.offerTable.replace(/\s+/g, ' ')),
);

// ---- a paid placement must read as paid, everywhere it appears ----
// `locations.is_featured` is the switch a purchased featured listing turns on,
// and there is no second column distinguishing an editorial pick from a paid
// one. So every surface that renders it must disclose it as sponsored — an
// unqualified "Featured" badge on a placement someone paid for is undisclosed
// advertising.
const placementSurfaces = {
  card: 'src/components/directory/EntryCard.tsx',
  detail: 'src/app/(directory)/directory/location/[slug]/page.tsx',
  multi: 'src/components/directory/MultiCategoryBrowser.tsx',
  browser: 'src/components/directory/DirectoryBrowser.tsx',
};
for (const [name, path] of Object.entries(placementSurfaces)) {
  const text = stripComments(readFileSync(path, 'utf8'));
  check(`${name}: discloses paid placement as Sponsored`, /Sponsored/.test(text));
  check(
    `${name}: no bare "Featured" label on the paid badge`,
    !/>\s*Featured\s*</.test(text) && !/label="Featured"/.test(text),
  );
}
// The sort key itself stays `featured` — dashboards and saved URLs depend on
// the value; only the human label changed.
check(
  'sort value is still the stable `featured` token',
  /value="featured"/.test(readFileSync(placementSurfaces.browser, 'utf8')),
);

// ---- no payment integration anywhere in the funnel ----
for (const [name, text] of Object.entries(src)) {
  check(
    `${name}: no Stripe/checkout integration`,
    !/stripe|paymentIntent|checkout\.session/i.test(text),
  );
}

console.log(`directory-offers: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
