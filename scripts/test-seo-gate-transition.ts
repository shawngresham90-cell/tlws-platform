/**
 * PR-B gate-transition contract (offline, production-mirror fixtures).
 *
 * The 2026-08-17 crawl/indexing audit found 13 published listings noindexed
 * solely because the old gate hard-required a street address — rest areas,
 * welcome centers, and mobile roadside services legitimately have none — and
 * 2 listings held in the index only by the synthetic "Overnight unknown"
 * chip. The owner-approved redesign (Option A, corrected after read-only
 * production measurement): location identity = address OR a legitimate
 * stored corridor designation OR verified coordinates, plus city + state +
 * known category, plus ≥2 REAL stored quality signals.
 *
 * The fixtures below mirror the 15 affected production rows field-for-field
 * (slugs, categories, cities, signal presence, description lengths and
 * amenity counts as read from production on 2026-08-17; description text is
 * length-preserving filler). The full-population before/after —
 * 2,441 → 2,452 indexable — was measured read-only against production and
 * cannot run in CI; this harness pins the exact +13/−2 transition
 * population, which implies the same +11 net on any production-compatible
 * dataset.
 *
 * Requirement 15's other half (the four PR-A admin routes stay
 * noindex,nofollow) is enforced by scripts/test-admin-noindex.ts.
 *
 * Run:
 *   npx esbuild scripts/test-seo-gate-transition.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --alias:next/headers=./scripts/shims/next-headers.ts \
 *     --alias:next/cache=./scripts/shims/next-cache.ts \
 *     --loader:.css=empty \
 *     --outfile=/tmp/test-seo-gate-transition.cjs && node /tmp/test-seo-gate-transition.cjs
 */
import { readFileSync } from 'node:fs';
import { allSitemapEntries as sitemap } from '@/lib/seo/sitemap-entries';
import { generateMetadata as knowledgeSearchMetadata } from '@/app/(marketing)/knowledge/search/page';
import { getAllPublishedEntries } from '@/lib/directory/data';
import { isDetailIndexable } from '@/lib/directory/detail';
import { getCategory } from '@/lib/directory/categories';
import { buildMetadata } from '@/lib/seo/metadata';
import { SITE } from '@/lib/seo/site';
import type { DirectoryEntry } from '@/lib/directory/types';
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

/* ---------------------------------------------------------------- fixtures */

/** Length-preserving filler for a production description of `len` chars. */
const desc = (len: number) => 'x'.repeat(len);

type MirrorSpec = {
  slug: string;
  category: string;
  state: string;
  city: string;
  interstate: string;
  exit: string | null;
  address: string | null;
  phone: boolean;
  website: boolean;
  descLen: number;
  amenities: string[];
  spaces: number | null;
};

/** The 13 pages the redesign must rescue — production field values, 2026-08-17. */
const RESCUED: MirrorSpec[] = [
  // prettier-ignore
  { slug: 'after-hours-road-service-inc-naples-fl', category: 'roadside-service', state: 'FL', city: 'Naples', interstate: 'I-75', exit: null, address: null, phone: true, website: true, descLen: 290, amenities: ['Repair'], spaces: null },
  // prettier-ignore
  { slug: 'cat-scale-flying-j-miami-miami-fl', category: 'cat-scales', state: 'FL', city: 'Miami', interstate: 'I-75', exit: '2', address: null, phone: false, website: true, descLen: 157, amenities: ['CAT Scale'], spaces: null },
  // prettier-ignore
  { slug: 'collier-county-rest-area-alligator-alley-milepost-63-alligator-alley-fl', category: 'parking', state: 'FL', city: 'Alligator Alley', interstate: 'I-75', exit: null, address: null, phone: false, website: false, descLen: 333, amenities: ['Restrooms'], spaces: null },
  // prettier-ignore
  { slug: 'days-inn-by-wyndham-wildwood-i-75-wildwood-fl', category: 'hotels-truck-parking', state: 'FL', city: 'Wildwood', interstate: 'I-75', exit: '329', address: null, phone: false, website: true, descLen: 151, amenities: [], spaces: null },
  // prettier-ignore
  { slug: 'diesel-down-llc-auburn-hills-mi', category: 'roadside-service', state: 'MI', city: 'Auburn Hills', interstate: 'I-75', exit: null, address: null, phone: true, website: false, descLen: 266, amenities: ['Repair'], spaces: null },
  // prettier-ignore
  { slug: 'i-75-bay-city-rest-area-southbound-bay-city-mi', category: 'parking', state: 'MI', city: 'Bay City', interstate: 'I-75', exit: null, address: null, phone: false, website: false, descLen: 133, amenities: ['Restrooms'], spaces: 33 },
  // prettier-ignore
  { slug: 'keep-it-rolling-semi-truck-trailer-repair-detroit-mi', category: 'roadside-service', state: 'MI', city: 'Detroit', interstate: 'I-75', exit: null, address: null, phone: true, website: true, descLen: 264, amenities: ['Repair'], spaces: null },
  // prettier-ignore
  { slug: 'lp-mobile-tire-bradenton-area-bradenton-fl', category: 'roadside-service', state: 'FL', city: 'Bradenton', interstate: 'I-75', exit: null, address: null, phone: true, website: true, descLen: 228, amenities: ['Repair'], spaces: null },
  // prettier-ignore
  { slug: 'michigan-welcome-center-mackinaw-city-i-75-mackinaw-city-mi', category: 'parking', state: 'MI', city: 'Mackinaw City', interstate: 'I-75', exit: null, address: null, phone: false, website: true, descLen: 111, amenities: ['Restrooms'], spaces: null },
  // prettier-ignore
  { slug: 'michigan-welcome-center-sault-ste-marie-i-75-sault-ste-marie-mi', category: 'parking', state: 'MI', city: 'Sault Ste. Marie', interstate: 'I-75', exit: null, address: null, phone: false, website: true, descLen: 173, amenities: ['Restrooms'], spaces: null },
  // prettier-ignore
  { slug: 't-t-mobile-repair-birch-run-birch-run-mi', category: 'roadside-service', state: 'MI', city: 'Birch Run', interstate: 'I-75', exit: '136', address: null, phone: true, website: true, descLen: 92, amenities: ['Repair'], spaces: null },
  // prettier-ignore
  { slug: 'ta-truck-service-lake-city-lake-city-fl', category: 'tire-repair', state: 'FL', city: 'Lake City', interstate: 'I-75', exit: '414', address: null, phone: false, website: true, descLen: 180, amenities: ['Repair'], spaces: null },
  // prettier-ignore
  { slug: 'yellow-hammer-travel-center-brewton-al', category: 'truck-stops', state: 'AL', city: 'Brewton', interstate: 'I-65', exit: '69', address: null, phone: true, website: true, descLen: 171, amenities: ['Fuel', 'Food'], spaces: null },
];

/**
 * The 2 pages that were held in the index only by the synthetic overnight
 * chip: an address plus ONE real signal (their description).
 */
const DEMOTED: MirrorSpec[] = [
  // prettier-ignore
  { slug: 'cat-scale-circle-k-pelham-pelham-al', category: 'cat-scales', state: 'AL', city: 'Pelham', interstate: 'I-65', exit: '246', address: '715 Cahaba Valley Rd', phone: false, website: false, descLen: 111, amenities: [], spaces: null },
  // prettier-ignore
  { slug: 'kentucky-weigh-station-i-75-northbound-scott-county-georgetown-ky', category: 'weigh-stations', state: 'KY', city: 'Georgetown', interstate: 'I-75', exit: null, address: 'I-75 Northbound', phone: false, website: false, descLen: 241, amenities: [], spaces: null },
];

function toRow(spec: MirrorSpec, i: number): Record<string, unknown> {
  return {
    id: `mirror-${String(i).padStart(3, '0')}`,
    name: spec.slug,
    category_slug: spec.category,
    state: spec.state,
    city: spec.city,
    slug: spec.slug,
    address: spec.address,
    zip: null,
    phone: spec.phone ? '555-555-0100' : null,
    website: spec.website ? 'https://example.com/mirror' : null,
    description: desc(spec.descLen),
    parking_spaces: spec.spaces,
    amenities: spec.amenities,
    free_parking: null,
    paid_parking: null,
    reserved_parking: null,
    overnight_parking: null,
    tpc_url: null,
    is_featured: false,
    is_indexable: false,
    lat: null,
    lng: null,
    interstate: spec.interstate,
    exit_number: spec.exit,
    mile_marker: null,
    mile_marker_source: null,
    overnight_status: null,
    overnight_status_source: null,
    created_at: '2026-07-10T00:00:00Z',
    detail_slug: spec.slug,
    updated_at: '2026-07-12T00:00:00Z',
    verified_at: null,
    is_published: true,
    deleted_at: null,
  };
}

const ROWS = [...RESCUED, ...DEMOTED].map(toRow);

/**
 * Frozen reference implementation of the PRE-PR-B gate, chip behavior
 * included: address required, and the rendered amenities array (which always
 * carries an overnight chip for DB rows) counted as a signal. Kept here so
 * the transition is asserted against what production actually did, not
 * against a description of it.
 */
function prePrBGate(e: DirectoryEntry): boolean {
  if (!e.address || !e.city || !e.state) return false;
  if (!getCategory(e.category)) return false;
  let signals = 0;
  if (e.phone) signals += 1;
  if (e.website) signals += 1;
  if ((e.description ?? '').trim().length >= 30) signals += 1;
  if ((e.amenities ?? []).length >= 1) signals += 1;
  if (e.lat != null && e.lng != null) signals += 1;
  if (e.parkingSpaces != null) signals += 1;
  return signals >= 2;
}

/* ------------------------------------------------------------------ tests */

async function main() {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://placeholder.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'placeholder-anon-key';
  installPostgrestFake({ locations: ROWS, kc_categories: [], kc_articles: [] });

  // Entries come through the REAL data layer (toEntry), so the synthetic
  // overnight chip and storedAmenities behave exactly as in production.
  const entries = await getAllPublishedEntries();
  check('all 15 mirror rows load through the data layer', entries.length === 15, entries.length);
  const bySlug = new Map(entries.map((e) => [e.detailSlug, e]));

  const rescuedSlugs = RESCUED.map((s) => s.slug);
  const demotedSlugs = DEMOTED.map((s) => s.slug);

  /* --------------------- the exact +13 / −2 transition --------------------- */
  for (const slug of rescuedSlugs) {
    const e = bySlug.get(slug);
    check(`rescued: ${slug} was noindex under the old gate`, e !== undefined && !prePrBGate(e));
    check(
      `rescued: ${slug} is indexable under the new gate`,
      e !== undefined && isDetailIndexable(e),
    );
  }
  for (const slug of demotedSlugs) {
    const e = bySlug.get(slug);
    check(`demoted: ${slug} was indexable under the old gate`, e !== undefined && prePrBGate(e));
    check(
      `demoted: ${slug} is noindex under the new gate`,
      e !== undefined && !isDetailIndexable(e),
    );
  }
  const oldCount = entries.filter(prePrBGate).length;
  const newCount = entries.filter(isDetailIndexable).length;
  check('net transition over the mirror population is exactly +11', newCount - oldCount === 11, {
    oldCount,
    newCount,
  });
  check(
    'exactly 13 pages enter the index',
    newCount - oldCount === RESCUED.length - DEMOTED.length &&
      RESCUED.every((s) => isDetailIndexable(bySlug.get(s.slug)!)),
  );
  check(
    'exactly 2 pages leave the index',
    DEMOTED.every((s) => !isDetailIndexable(bySlug.get(s.slug)!)),
  );

  /* ----------------------- sitemap ↔ gate parity ----------------------- */
  const urls = new Set((await sitemap()).map((e) => e.url));
  const detailOf = (slug: string) => `${SITE.url}/directory/location/${slug}`;
  for (const slug of rescuedSlugs) {
    check(`sitemap: rescued ${slug} is listed`, urls.has(detailOf(slug)));
  }
  for (const slug of demotedSlugs) {
    check(`sitemap: demoted ${slug} is NOT listed`, !urls.has(detailOf(slug)));
  }

  /* ------------------------- metadata behavior ------------------------- */
  // The builder: gated pages may pass follow, indexable pages ignore it,
  // and the default noindex stays nofollow.
  const gated = buildMetadata({ path: '/x', noindex: true, follow: true });
  check(
    'buildMetadata noindex+follow → noindex, follow',
    JSON.stringify(gated.robots) === JSON.stringify({ index: false, follow: true }),
    gated.robots,
  );
  const indexable = buildMetadata({ path: '/x', noindex: false, follow: true });
  check(
    'buildMetadata indexable → index, follow',
    JSON.stringify(indexable.robots) === JSON.stringify({ index: true, follow: true }),
    indexable.robots,
  );
  const legacyNoindex = buildMetadata({ path: '/x', noindex: true });
  check(
    'buildMetadata noindex default stays nofollow',
    JSON.stringify(legacyNoindex.robots) === JSON.stringify({ index: false, follow: false }),
    legacyNoindex.robots,
  );

  // The detail page's call site wires the gate and follow:true together.
  // (Importing the page module needs React.cache, which react 18.3 doesn't
  // export outside Next — so this asserts the source contract, the same way
  // test-directory-complete-read.ts pins the sitemap's gate usage.)
  const detailPageSrc = readFileSync(
    'src/app/(directory)/directory/location/[slug]/page.tsx',
    'utf8',
  );
  check(
    'detail page metadata gates on isDetailIndexable',
    /noindex:\s*!isDetailIndexable\(entry\)/.test(detailPageSrc),
  );
  check('detail page metadata passes follow: true', /follow:\s*true/.test(detailPageSrc));

  // Intentional exclusions keep noindex, NOFOLLOW.
  const search = knowledgeSearchMetadata({ searchParams: {} });
  check(
    'knowledge search stays noindex, nofollow',
    JSON.stringify(search.robots) === JSON.stringify({ index: false, follow: false }),
    search.robots,
  );

  console.log(`\nseo-gate-transition: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

void main();
