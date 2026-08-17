/**
 * JSON-LD contracts (offline). Guards the structured-data fixes from the
 * August 2026 technical SEO audit:
 *
 *  - jsonLdPayload escapes `<`, so user-influenced strings (approved review
 *    bodies, DB article text) can never close the script tag early.
 *  - The directory ItemList gate is the DETERMINISTIC completeness gate
 *    (isDetailIndexable) — not the manual locations.is_indexable flag, which
 *    is false on every current row and silently emitted no ItemList anywhere.
 *  - KC articles omit `keywords` instead of emitting "" when tagless.
 *  - Direct (Stan) products emit a Product node ONLY with an owner-confirmed
 *    price and no purchase block — the phantom-offer doctrine, per product.
 *  - The six corridor-flow pages emit BreadcrumbList (and the two direction
 *    pages the gated ItemList) — they previously shipped zero structured data.
 *
 * Run:
 *   npx esbuild scripts/test-jsonld-contracts.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --loader:.css=empty \
 *     --outfile=/tmp/test-jsonld-contracts.cjs && node /tmp/test-jsonld-contracts.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  jsonLdPayload,
  organizationSchema,
  personSchema,
  websiteSchema,
  breadcrumbSchema,
  faqSchema,
} from '@/lib/seo/schema';
import { listingListSchema } from '@/lib/directory/seo';
import { articleSchema } from '@/lib/kc/schema';
import { directProductSchema } from '@/lib/store/schema';
import { SITE } from '@/lib/seo/site';
import type { DirectoryEntry } from '@/lib/directory/types';
import type { DirectProduct } from '@/lib/store/direct';
import type { KcArticle, KcCategory } from '@/lib/kc/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

/* ------------------------------------------------------ script-tag safety */

const hostile = {
  '@type': 'Review',
  reviewBody: 'Nice showers</script><script>alert(1)</script> would stop again',
};
const serialized = jsonLdPayload(hostile);
check('payload contains no literal "<" at all', !serialized.includes('<'), serialized.slice(0, 80));
check(
  'escaping is lossless — parses back to the exact input',
  JSON.stringify(JSON.parse(serialized)) === JSON.stringify([hostile]),
);
check('single object is wrapped into an array', JSON.parse(jsonLdPayload({ a: 1 })).length === 1);

/* ------------------------------------------------------------ core nodes */

const org = organizationSchema() as Record<string, any>;
const person = personSchema() as Record<string, any>;
const site = websiteSchema() as Record<string, any>;
check('organization @id is stable', org['@id'] === `${SITE.url}/#organization`);
check('person @id is stable', person['@id'] === `${SITE.url}/#founder`);
check('website @id is stable', site['@id'] === `${SITE.url}/#website`);
check(
  'organization sameAs mirrors the SITE social config exactly',
  JSON.stringify(org.sameAs) ===
    JSON.stringify([SITE.social.youtube, SITE.social.facebook, SITE.social.tiktok]),
);
check(
  'no node serializes an undefined/null field',
  !jsonLdPayload([org, person, site]).includes('null') &&
    !jsonLdPayload([org, person, site]).includes('undefined'),
);

const crumbs = breadcrumbSchema([
  { name: 'Home', path: '/' },
  { name: 'Directory', path: '/directory' },
]) as Record<string, any>;
check(
  'breadcrumb positions are 1-based and items absolute',
  crumbs.itemListElement[0].position === 1 &&
    crumbs.itemListElement[1].item === `${SITE.url}/directory`,
);
check('faqSchema is null on empty input', faqSchema([]) === null);
check(
  'faqSchema mirrors visible Q/A pairs',
  (faqSchema([{ question: 'Q?', answer: 'A.' }]) as Record<string, any>).mainEntity[0].name ===
    'Q?',
);

/* --------------------------------------- directory ItemList gate (fixed) */

const completeEntry: DirectoryEntry = {
  id: 'e1',
  category: 'truck-stops',
  name: 'Fixture Travel Stop',
  state: 'GA',
  city: 'Dalton',
  slug: 'fixture-travel-stop',
  address: '1 Fixture Way',
  phone: '706-555-0100',
  amenities: ['Overnight confirmed', 'Showers'],
  // The row's actual stored amenity — the rendered chips above are
  // presentation and don't count as gate evidence (PR-B).
  storedAmenities: ['Showers'],
  // The manual flag stays FALSE — the gate must not consult it.
  indexable: false,
  overnightStatus: 'confirmed',
};
const thinEntry: DirectoryEntry = {
  id: 'e2',
  category: 'truck-stops',
  name: 'Thin Fixture Stop',
  state: 'GA',
  city: 'Dalton',
  slug: 'thin-fixture-stop',
  // No location identity (no address, corridor, or coordinates) → fails the
  // indexability gate regardless of anything else.
  indexable: false,
  overnightStatus: 'unknown',
};

const list = listingListSchema(
  [completeEntry, thinEntry],
  'Fixture list',
  '/directory/georgia',
) as Record<string, any> | null;
check('ItemList emits from the deterministic gate, not the manual flag', list !== null);
check('ItemList carries only gate-passing entries', list?.numberOfItems === 1, list?.numberOfItems);
check(
  'gate-passing entry is a LocalBusiness with its own name',
  list?.itemListElement[0].item.name === 'Fixture Travel Stop',
);
check(
  'all-thin input still yields no ItemList at all',
  listingListSchema([thinEntry], 'Fixture list', '/directory/georgia') === null,
);

/* ------------------------------------------------------- KC keywords fix */

const kcCat: KcCategory = {
  id: 'c1',
  slug: 'dot-compliance',
  name: 'DOT Compliance',
  description: null,
  intro_md: null,
  icon: null,
  sort_order: 1,
  meta_title: null,
  meta_description: null,
};
const kcArticle = (tags: string[]): KcArticle =>
  ({
    id: 'a1',
    slug: 'eld-basics',
    category_id: 'c1',
    title: 'ELD Basics',
    excerpt: 'What the mandate requires.',
    body_mdx: 'Body.',
    meta_title: null,
    meta_description: null,
    hero_image_url: null,
    author_name: 'Shawn Gresham',
    author_bio: null,
    sources: [],
    faqs: [],
    tags,
    reading_time_min: 4,
    featured: false,
    reg_verified: false,
    reg_verified_date: null,
    published_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
  }) as unknown as KcArticle;

const tagged = articleSchema(kcArticle(['eld', 'hos']), kcCat, `${SITE.url}/knowledge/x/y`) as any;
const tagless = articleSchema(kcArticle([]), kcCat, `${SITE.url}/knowledge/x/y`) as any;
check('article keywords join real tags', tagged.keywords === 'eld, hos');
check('tagless article omits keywords entirely', !('keywords' in tagless), Object.keys(tagless));

/* -------------------------------------------- direct-product Offer gate */

const directBase: DirectProduct = {
  slug: 'fixture-guide',
  name: 'Fixture Guide',
  type: 'digital',
  category: 'Guides',
  tagline: 'A fixture.',
  description: 'A fixture product for schema tests.',
  priceUsd: 35,
  stanUrl: 'https://stan.store/TRUCKINGLIFEWITHSHAWN/p/fixture-guide',
  fulfillment: 'digital',
  badge: null,
  image: '/store/products/fixture.png',
  featured: false,
  purchaseBlockedReason: null,
};

const priced = directProductSchema(directBase) as Record<string, any> | null;
check('confirmed price emits a Product node', priced !== null);
check('offer price is the confirmed price', priced?.offers?.price === '35.00');
check('offer URL is the Stan checkout', priced?.offers?.url === directBase.stanUrl);
check(
  'image is absolute on the canonical origin',
  priced?.image === `${SITE.url}${directBase.image}`,
);
check('no availability is asserted', priced !== null && !('availability' in (priced.offers ?? {})));
check(
  'no rating is ever asserted for a direct product',
  priced !== null && !('aggregateRating' in priced),
);
check(
  'free (confirmed $0) is a real offer',
  (directProductSchema({ ...directBase, priceUsd: 0 }) as any)?.offers?.price === '0.00',
);
check(
  'unconfirmed price emits nothing',
  directProductSchema({ ...directBase, priceUsd: null }) === null,
);
check(
  'purchase-blocked product emits nothing',
  directProductSchema({ ...directBase, purchaseBlockedReason: 'Awaiting disclaimer.' }) === null,
);

/* -------------------------------------- flow pages actually emit schema */

const FLOW_PAGES = [
  'src/app/(directory)/directory/parking/[state]/page.tsx',
  'src/app/(directory)/directory/parking/[state]/[interstate]/page.tsx',
  'src/app/(directory)/directory/parking/[state]/[interstate]/[direction]/page.tsx',
  'src/app/(directory)/directory/cat-scales/[state]/page.tsx',
  'src/app/(directory)/directory/cat-scales/[state]/[interstate]/page.tsx',
  'src/app/(directory)/directory/cat-scales/[state]/[interstate]/[direction]/page.tsx',
];
for (const p of FLOW_PAGES) {
  const src = read(p);
  check(
    `${p} renders JsonLd breadcrumbs`,
    src.includes('<JsonLd') && src.includes('breadcrumbSchema'),
  );
}
for (const p of FLOW_PAGES.filter((f) => f.includes('[direction]'))) {
  check(`${p} emits the gated corridor ItemList`, read(p).includes('listingListSchema'));
}

/* ------------------------------- /apps price flows from one constant */

const appsSrc = read('src/app/(marketing)/apps/page.tsx');
check(
  '/apps JSON-LD price derives from the shared constant',
  appsSrc.includes('DOT_SYSTEM_PRICE_USD.toFixed(2)') && !appsSrc.includes("'49.00'"),
);
check(
  '/apps visible price derives from the same constant',
  appsSrc.includes('price: `$${DOT_SYSTEM_PRICE_USD}`'),
);

console.log(`\njsonld-contracts: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
