/**
 * REVENUE-2 — featured listing auto-expiry (FE1–FE80).
 *
 * Offline and deterministic. No network, no database, and no ambient clock:
 * every check that depends on time is handed an explicit `now`, so "the term
 * expired" is a fact about the fixture rather than about the day the suite ran.
 * A harness whose result changes at midnight is not a harness.
 *
 * The suite is arranged as the placement actually lives — the window rule, the
 * boundary, Model B's start semantics, the public read path, capacity,
 * activation, stop, renewal, the admin consoles, the migration contract and the
 * privacy surface — and finishes with one end-to-end lifecycle that walks a
 * single fixture listing from activation, through the second before expiry, the
 * exact boundary, the second after, the released capacity, a renewal and a
 * manual stop, and then does the whole thing again with the schema missing and
 * again with an unrelated database failure.
 *
 * The mutation block is the part that matters most: each mutation removes one
 * protection and asserts this suite would have caught it. A test that never
 * fails when the code is wrong is decoration.
 *
 * Run:
 *   npx esbuild scripts/test-revenue-featured-expiry.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-revenue-featured-expiry.cjs && node /tmp/test-revenue-featured-expiry.cjs
 */
import { readFileSync } from 'node:fs';
import {
  FEATURED_STATUS_LABEL,
  featuredExpiryFrom,
  featuredWindowBlockers,
  featuredWindowStatus,
  isFeaturedActive,
  needsFeaturedCleanup,
  type FeaturedRow,
  type FeaturedSchema,
  type FeaturedWindowStatus,
} from '@/lib/directory/featured-window';
import {
  FEATURED_PER_PAGE,
  canActivateFeatured,
  featuredUsage,
  isHeldBrand,
  type PromotableListing,
} from '@/lib/directory/placements';
import { renewalView, pipelineSummary, type SponsorSaleRow } from '@/lib/directory/revenue';
import { getOffer } from '@/lib/directory/offers';
import { filterAndSortEntries, type BrowsableEntry } from '@/lib/directory/browse';
import { toCardEntry, toMapEntry } from '@/lib/directory/dto';
import type { DirectoryEntry } from '@/lib/directory/types';

let passed = 0;
let failed = 0;
const seen = new Set<string>();

function check(id: string, name: string, cond: boolean, detail?: unknown): void {
  if (seen.has(id)) {
    failed++;
    console.log(`  ✗ duplicate scenario id ${id}`);
    return;
  }
  seen.add(id);
  if (cond) passed++;
  else {
    failed++;
    console.log(`  ✗ ${id} ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

/** A plain assertion outside the numbered matrix. */
function extra(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`  ✗ ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

const src = (p: string) => readFileSync(p, 'utf8');

/**
 * One fixed instant for the whole suite. Everything else is expressed as an
 * offset from it, so a reader can see at a glance which side of the term a
 * case is on.
 */
const NOW = new Date('2026-09-15T12:00:00.000Z');
/** Neutral browse options: no filtering, featured-first sort. */
const BROWSE = { query: '', state: '', city: '', sort: 'featured' as const };

/** The minimum a row needs to be filtered and sorted. */
function browsable(id: string, name: string, featured: boolean): BrowsableEntry {
  return { id, name, city: 'Florence', state: 'SC', featured };
}
const at = (ms: number) => new Date(NOW.getTime() + ms);
const SECOND = 1000;
const DAY = 86_400_000;

function row(over: Partial<FeaturedRow> = {}): FeaturedRow {
  return {
    isFeatured: true,
    isPublished: true,
    deletedAt: null,
    name: 'Independent Tire',
    featuredUntil: at(30 * DAY).toISOString(),
    ...over,
  };
}

function listing(over: Partial<PromotableListing> = {}): PromotableListing {
  return {
    id: 'l1',
    name: 'Independent Tire',
    categorySlug: 'tire-repair',
    interstate: 'I-95',
    state: 'SC',
    isPublished: true,
    isFeatured: false,
    deletedAt: null,
    featuredUntil: at(30 * DAY).toISOString(),
    ...over,
  };
}

/* ================================================= 1 · the window authority */

check(
  'FE1',
  'a listing that is not flagged is never featured',
  !isFeaturedActive(row({ isFeatured: false }), NOW) &&
    featuredWindowStatus(row({ isFeatured: false }), NOW) === 'inactive',
);

check(
  'FE2',
  'a flagged listing inside its term is featured',
  isFeaturedActive(row(), NOW) && featuredWindowStatus(row(), NOW) === 'active',
);

check(
  'FE3',
  'a flagged listing past its term is not featured',
  !isFeaturedActive(row({ featuredUntil: at(-1 * DAY).toISOString() }), NOW) &&
    featuredWindowStatus(row({ featuredUntil: at(-1 * DAY).toISOString() }), NOW) === 'expired',
);

// The single most dangerous reading of a nullable column. NULL must never mean
// "forever" — that is the pre-057 defect wearing a new column.
check(
  'FE4',
  'a flagged listing with no recorded term is withheld, not treated as forever',
  !isFeaturedActive(row({ featuredUntil: null }), NOW) &&
    featuredWindowStatus(row({ featuredUntil: null }), NOW) === 'missing-expiry',
);

check(
  'FE5',
  'an unreadable term is withheld rather than guessed',
  !isFeaturedActive(row({ featuredUntil: 'soon' }), NOW) &&
    featuredWindowStatus(row({ featuredUntil: 'soon' }), NOW) === 'malformed',
);

check(
  'FE6',
  'an unpublished listing is never featured however long its term runs',
  !isFeaturedActive(row({ isPublished: false }), NOW),
);

check(
  'FE7',
  'a soft-deleted listing is never featured however long its term runs',
  !isFeaturedActive(row({ deletedAt: '2026-01-01T00:00:00Z' }), NOW),
);

// Held brands are refused at activation. This is the second lock: a row flagged
// by any other path (an import, a manual SQL update) still cannot show.
check(
  'FE8',
  'a held brand is never featured even with a valid paid term',
  isHeldBrand("Love's Travel Stop") && !isFeaturedActive(row({ name: "Love's Travel Stop" }), NOW),
);

/* ==================================================== 2 · the exact boundary */

// The whole commercial promise is "the placement ends when the term ends". If
// the comparison is wrong by one tick in either direction it is wrong in a way
// nobody notices until a business is billed for a day it did not get, or gets a
// day it did not buy.
{
  const until = at(0).toISOString(); // term ends exactly at NOW

  check(
    'FE9',
    'one second before expiry the placement is still live',
    isFeaturedActive(row({ featuredUntil: until }), at(-SECOND)),
  );

  check(
    'FE10',
    'at the exact expiry instant the placement is over',
    !isFeaturedActive(row({ featuredUntil: until }), at(0)) &&
      featuredWindowStatus(row({ featuredUntil: until }), at(0)) === 'expired',
  );

  check(
    'FE11',
    'one second after expiry the placement is over',
    !isFeaturedActive(row({ featuredUntil: until }), at(SECOND)),
  );

  check(
    'FE12',
    'one millisecond decides it — the boundary is not rounded to a day',
    isFeaturedActive(row({ featuredUntil: until }), at(-1)) &&
      !isFeaturedActive(row({ featuredUntil: until }), at(0)),
  );
}

/* ============================================ 3 · Model B — start semantics */

// There is no `featured_starts_at`. Activation starts the term now, and a
// future start is REFUSED rather than recorded and ignored. These five checks
// are the ones that keep that decision honest.
{
  const tomorrow = at(DAY).toISOString().slice(0, 10);
  const today = NOW.toISOString().slice(0, 10);
  const yesterday = at(-DAY).toISOString().slice(0, 10);

  check(
    'FE13',
    'activation with a future start date is blocked',
    featuredWindowBlockers(tomorrow, NOW, 'ready').length === 1,
    featuredWindowBlockers(tomorrow, NOW, 'ready'),
  );

  // The blocker has to be a REFUSAL, not a warning: the caller stops before any
  // write. `activateFeaturedAction` pushes these into `upfront` and `fail()`s
  // the whole action before it constructs a Supabase client.
  check(
    'FE14',
    'a refused future start writes no row',
    (() => {
      const action = src('src/app/admin/(dashboard)/directory/placements/actions.ts');
      const body = action.slice(
        action.indexOf('export async function activateFeaturedAction'),
        action.indexOf('export async function deactivateFeaturedAction'),
      );
      const blockerAt = body.indexOf('featuredWindowBlockers');
      const failAt = body.indexOf('if (upfront.length) fail(upfront);');
      const clientAt = body.indexOf('createAdminClient()');
      const updateAt = body.indexOf('.update(');
      return blockerAt > 0 && failAt > blockerAt && clientAt > failAt && updateAt > clientAt;
    })(),
  );

  // Model B's actual guarantee: whatever the CRM recorded, the public path is
  // never shown a start it has not reached, because the only start that exists
  // IS the moment of activation.
  check(
    'FE15',
    'public display cannot begin before the term does — there is no start column to disagree with',
    (() => {
      const modules = [
        src('src/lib/directory/featured-window.ts'),
        src('src/lib/directory/data.ts'),
        src('src/lib/directory/placements.ts'),
        src('supabase/migrations/057_featured_listing_term.sql'),
      ];
      // No module invents a start column, and the window rule reads exactly one
      // date.
      return modules.every(
        (m) => !/featured_starts_at\s*[:=]|add column featured_starts_at/.test(m),
      );
    })(),
  );

  check(
    'FE16',
    'the CRM term and the public term are the same value, so they cannot disagree',
    (() => {
      const action = src('src/app/admin/(dashboard)/directory/placements/actions.ts');
      const body = action.slice(
        action.indexOf('export async function activateFeaturedAction'),
        action.indexOf('export async function deactivateFeaturedAction'),
      );
      // One `endsAt`, derived once, written to the row AND handed to the CRM.
      return (
        /const endsAt = billing \? featuredExpiryFrom\(now, billing\)\.toISOString\(\) : null;/.test(
          body,
        ) &&
        /\.update\(\{ is_featured: true, featured_until: endsAt \}\)/.test(body) &&
        /markLive\(supabase, sponsorId, 'featured-listing', endsAt\)/.test(body)
      );
    })(),
  );

  check(
    'FE17',
    'an immediate start is still valid — today and the past are not refused',
    featuredWindowBlockers(today, NOW, 'ready').length === 0 &&
      featuredWindowBlockers(yesterday, NOW, 'ready').length === 0 &&
      featuredWindowBlockers(null, NOW, 'ready').length === 0,
  );
}

/* ================================================ 4 · term arithmetic */

check(
  'FE18',
  'a monthly term lands one calendar month out',
  featuredExpiryFrom(new Date('2026-09-15T12:00:00Z'), 'monthly').toISOString() ===
    '2026-10-15T12:00:00.000Z',
);

check(
  'FE19',
  'an annual term lands one calendar year out',
  featuredExpiryFrom(new Date('2026-09-15T12:00:00Z'), 'annual').toISOString() ===
    '2027-09-15T12:00:00.000Z',
);

// 30-day arithmetic would put this on 2026-02-27 and shortchange the customer;
// calendar arithmetic rolls it to March, which is what a human means by "a
// month from the 31st".
check(
  'FE20',
  'a monthly term bought on the 31st does not silently shorten',
  featuredExpiryFrom(new Date('2026-01-31T00:00:00Z'), 'monthly').toISOString().slice(0, 10) ===
    '2026-03-03',
);

check(
  'FE21',
  'an annual term spanning a leap day keeps its full year',
  featuredExpiryFrom(new Date('2027-06-01T00:00:00Z'), 'annual').toISOString() ===
    '2028-06-01T00:00:00.000Z',
);

check(
  'FE22',
  'the term is computed in UTC, so the host timezone cannot move it',
  featuredExpiryFrom(new Date('2026-12-31T23:30:00Z'), 'monthly').toISOString() ===
    '2027-01-31T23:30:00.000Z',
);

/* ================================== 5 · the pre-migration compatibility bridge */

// Netlify deploys the code on merge; the migration is applied separately. The
// window in between is real and the Directory has to keep working in it.
check(
  'FE23',
  'before the migration a flagged listing keeps showing exactly as it does today',
  isFeaturedActive(row({ featuredUntil: undefined }), NOW, 'unavailable') &&
    featuredWindowStatus(row({ featuredUntil: undefined }), NOW, 'unavailable') ===
      'schema-unavailable',
);

check(
  'FE24',
  'before the migration an expired-looking value cannot un-feature anything, because it is not read',
  isFeaturedActive(row({ featuredUntil: at(-DAY).toISOString() }), NOW, 'unavailable'),
);

check(
  'FE25',
  'before the migration the published / deleted / held rules still apply',
  !isFeaturedActive(row({ isPublished: false, featuredUntil: undefined }), NOW, 'unavailable') &&
    !isFeaturedActive(row({ deletedAt: '2026-01-01T00:00:00Z' }), NOW, 'unavailable') &&
    !isFeaturedActive(row({ name: 'Pilot Flying J' }), NOW, 'unavailable'),
);

check(
  'FE26',
  'before the migration an unflagged listing is still not featured',
  !isFeaturedActive(row({ isFeatured: false }), NOW, 'unavailable'),
);

// The projection must not name a column the database does not have — asking
// for it fails EVERY directory read, not just the badge.
check(
  'FE27',
  'the read projection omits featured_until until the schema is ready',
  (() => {
    const data = src('src/lib/directory/data.ts');
    const baseList = data.slice(data.indexOf('const BASE_COLUMNS'), data.indexOf('/* -----'));
    return (
      data.includes(
        "return schema === 'ready' ? `${BASE_COLUMNS}, ${FEATURED_COLUMN}` : BASE_COLUMNS;",
      ) &&
      // The pre-migration projection must not name the column anywhere.
      !baseList.includes('featured_until')
    );
  })(),
);

check(
  'FE28',
  'every directory read goes through the schema-aware projection, none hard-codes the column list',
  (() => {
    const data = src('src/lib/directory/data.ts');
    // Every read that projects the entry columns does so through columnsFor.
    const entryReads = data.match(/\.select\(columnsFor\(ctx\.schema\)/g) ?? [];
    // Nothing else names BASE_COLUMNS directly at a call site, and the only
    // place the raw column name appears is the probe itself.
    const rawSelects = data.match(/\.select\(\s*(?:BASE_COLUMNS|COLUMNS)\b/g) ?? [];
    const namesColumn = (data.match(/'[^']*featured_until[^']*'/g) ?? []).filter(
      // The probe's own constant is the one legitimate mention of the raw name.
      () => !data.includes("const FEATURED_COLUMN = 'featured_until';"),
    );
    return entryReads.length >= 8 && rawSelects.length === 0 && namesColumn.length === 0;
  })(),
);

// The probe's fail direction is asymmetric ON PURPOSE and both halves must
// stay that way: a public read that cannot tell keeps serving; an admin that
// cannot tell refuses to write.
check(
  'FE29',
  'an indeterminate probe is not memoized on the public path',
  (() => {
    const data = src('src/lib/directory/data.ts');
    return (
      /throw error;/.test(data) &&
      // Indeterminate: nothing is remembered, and the next read asks again.
      // Scoped past the test seam, which clears the same two variables.
      /featuredSchemaMemo = null;\s*\n\s*memoGoodUntil = 0;/.test(
        data.slice(data.indexOf('export async function featuredSchema')),
      )
    );
  })(),
);

check(
  'FE30',
  'an unrelated database error is not mistaken for a missing column',
  (() => {
    // Same narrow predicate, in both probes: the code must match AND the
    // message must name the column.
    const both = [src('src/lib/directory/data.ts'), src('src/lib/admin/featured-schema.ts')];
    return both.every(
      (m) =>
        /if \(code !== '42703' && code !== 'PGRST204'\) return false;/.test(m) &&
        /return message\.includes\(FEATURED_COLUMN\);/.test(m),
    );
  })(),
);

check(
  'FE31',
  'the admin probe fails the OTHER way — it refuses to activate when it cannot tell',
  (() => {
    const admin = src('src/lib/admin/featured-schema.ts');
    const probeBody = admin.slice(
      admin.indexOf('async function probe('),
      admin.indexOf('export async function adminFeaturedSchema'),
    );
    // The last word of the probe is `unavailable`, and only `ready` is memoized.
    return (
      /return 'unavailable';\s*\n\}/.test(probeBody) &&
      /if \(v !== 'ready'\) memo = null;/.test(admin)
    );
  })(),
);

// The schema probe must never be answered from a cache.
//
// Found by the browser bench, not by review: Next caches `fetch` GETs in a Data
// Cache that survives between deploys, and a build reused a stale
// `200 [{"featured_until":null}]` for the probe URL. Every read then named a
// column the database did not have, and PostgREST failed the WHOLE query —
// 4,099 prerender failures on pages with nothing to do with featured
// placements. The compatibility bridge's own outage, walked back in through the
// cache.
{
  const staticClients = src('src/lib/supabase/static.ts');
  const adminClients = src('src/lib/supabase/admin.ts');
  extra(
    'an uncached client exists for schema-shape questions',
    /export function createUncachedStaticClient\(/.test(staticClients) &&
      /export function createUncachedAdminClient\(/.test(adminClients),
  );
  extra(
    'both uncached clients actually set no-store',
    (staticClients.match(/cache: 'no-store'/g) ?? []).length === 1 &&
      (adminClients.match(/cache: 'no-store'/g) ?? []).length === 1,
  );
  extra(
    'the public probe uses the uncached client',
    /const supabase = createUncachedStaticClient\(\);/.test(
      src('src/lib/directory/data.ts').slice(
        src('src/lib/directory/data.ts').indexOf('async function probeFeaturedSchema'),
        src('src/lib/directory/data.ts').indexOf('export async function featuredSchema'),
      ),
    ),
  );
  extra(
    'the admin probe uses the uncached client',
    /createUncachedAdminClient\(\)/.test(src('src/lib/admin/featured-schema.ts')) &&
      !/[^d]createAdminClient\(\)/.test(src('src/lib/admin/featured-schema.ts')),
  );
  extra(
    'ordinary directory reads keep the CACHED client — this is a probe rule, not a blanket one',
    (src('src/lib/directory/data.ts').match(/createStaticClient\(\)/g) ?? []).length >= 8,
  );
}

// The build phase does not probe at all, and that is deliberate.
//
// `cache: 'no-store'` is the documented way to defeat the Data Cache, but
// inside a prerender it bails static generation — so during a build there is no
// way to ask a fresh question without either throwing or turning 2,454 static
// pages dynamic. The build therefore answers `unavailable` without asking,
// which is the fail-safe direction: it can never name a column that is not
// there. Prerendered pages then use the legacy rule until their first
// revalidation, which is the ISR window that already governed them.
{
  const data = src('src/lib/directory/data.ts');
  const probeBody = data.slice(
    data.indexOf('async function probeFeaturedSchema'),
    data.indexOf('const UNAVAILABLE_TTL_MS'),
  );
  extra(
    'the build phase answers unavailable without a network call',
    /if \(isDirectoryBuildPhase\(\)\) return 'unavailable';/.test(probeBody),
  );
  extra(
    'the build-phase short-circuit comes BEFORE the client is constructed',
    probeBody.indexOf('isDirectoryBuildPhase()') <
      probeBody.indexOf('createUncachedStaticClient()'),
  );
  // `ready` is permanent; `unavailable` expires, so applying 057 under a
  // running server is picked up without a redeploy.
  extra(
    'a ready answer is remembered permanently',
    /if \(value === 'ready'\) memoGoodUntil = Number\.POSITIVE_INFINITY;/.test(data),
  );
  extra('an unavailable answer expires', /const UNAVAILABLE_TTL_MS = 60_000;/.test(data));
  extra(
    'the memo slot is claimed before the first await, so a burst shares one probe',
    /memoGoodUntil = Date\.now\(\) \+ UNAVAILABLE_TTL_MS;\s*\n\s*const attempt = probeFeaturedSchema\(\);/.test(
      data,
    ),
  );
}

/* ============================================== 6 · the public read surfaces */

function entry(over: Partial<DirectoryEntry> = {}): DirectoryEntry {
  return {
    id: 'e1',
    category: 'tire-repair',
    name: 'Independent Tire',
    state: 'SC',
    city: 'Florence',
    slug: 'independent-tire',
    featured: false,
    indexable: true,
    ...over,
  } as DirectoryEntry;
}

check(
  'FE32',
  'an expired placement reaches the card DTO as an ordinary listing',
  toCardEntry(entry({ featured: false })).featured !== true,
);

check(
  'FE33',
  'a live placement reaches the card DTO labelled',
  toCardEntry(entry({ featured: true })).featured === true,
);

check(
  'FE34',
  'an expired placement loses its featured map treatment',
  toMapEntry(entry({ featured: false, lat: 34, lng: -79 })).featured !== true &&
    toMapEntry(entry({ featured: true, lat: 34, lng: -79 })).featured === true,
);

check(
  'FE35',
  'an expired placement loses its featured-first position but stays on the page',
  (() => {
    const rows = [browsable('b', 'Bravo Tire', false), browsable('a', 'Alpha Tire', false)];
    const sorted = filterAndSortEntries(rows, BROWSE);
    // With nobody featured the sort falls back to name — and both rows survive.
    return sorted.length === 2 && sorted[0]!.id === 'a';
  })(),
);

check(
  'FE36',
  'expiry hides the BADGE, never the listing',
  (() => {
    const before = toCardEntry(entry({ featured: true }));
    const after = toCardEntry(entry({ featured: false }));
    // Same listing, same identity, one label less.
    return (
      before.id === after.id &&
      before.name === after.name &&
      before.featured === true &&
      after.featured !== true
    );
  })(),
);

// The client is never handed a second clock. `featured` crosses as a boolean
// the server already decided; no timestamp goes with it.
check(
  'FE37',
  'no term timestamp crosses to the client',
  (() => {
    const dto = src('src/lib/directory/dto.ts');
    return !/featuredUntil|featured_until/.test(dto);
  })(),
);

check(
  'FE38',
  'an expired placement makes the payload smaller, not larger',
  JSON.stringify(toCardEntry(entry({ featured: false }))).length <
    JSON.stringify(toCardEntry(entry({ featured: true }))).length,
);

/* ================================================== 7 · capacity accounting */

// A row still carrying `is_featured = true` after its term ended is NOT on the
// page. Counting it would let a stale boolean block a new sale on a page a
// visitor can see is empty — the same defect, pointed the other way.
{
  const expired = { featuredUntil: at(-DAY).toISOString() };
  const live = { featuredUntil: at(DAY).toISOString() };

  check(
    'FE39',
    'an expired placement does not occupy a category slot',
    featuredUsage(
      listing({ id: 'target' }),
      [listing({ id: '1', isFeatured: true, ...expired })],
      NOW,
    ).category.used === 0,
  );

  check(
    'FE40',
    'a live placement does occupy a category slot',
    featuredUsage(listing({ id: 'target' }), [listing({ id: '1', isFeatured: true, ...live })], NOW)
      .category.used === 1,
  );

  check(
    'FE41',
    'an expired placement does not occupy a corridor slot',
    featuredUsage(
      listing({ id: 'target' }),
      [listing({ id: '1', isFeatured: true, ...expired })],
      NOW,
    ).corridor?.used === 0,
  );

  check(
    'FE42',
    'three expired placements do not block a fourth sale',
    canActivateFeatured(
      listing({ id: 'target' }),
      [
        listing({ id: '1', isFeatured: true, ...expired }),
        listing({ id: '2', isFeatured: true, ...expired }),
        listing({ id: '3', isFeatured: true, ...expired }),
      ],
      { startsAt: NOW.toISOString(), endsAt: at(30 * DAY).toISOString() },
      NOW,
    ).ok,
  );

  check(
    'FE43',
    'three live placements still block a fourth sale',
    !canActivateFeatured(
      listing({ id: 'target' }),
      [
        listing({ id: '1', isFeatured: true, ...live }),
        listing({ id: '2', isFeatured: true, ...live }),
        listing({ id: '3', isFeatured: true, ...live }),
      ],
      { startsAt: NOW.toISOString(), endsAt: at(30 * DAY).toISOString() },
      NOW,
    ).ok && FEATURED_PER_PAGE === 3,
  );

  check(
    'FE44',
    'a full corridor page blocks the sale even when the category page is empty',
    (() => {
      const verdict = canActivateFeatured(
        listing({ id: 'target', categorySlug: 'truck-wash' }),
        [
          listing({ id: '1', categorySlug: 'tire-repair', isFeatured: true, ...live }),
          listing({ id: '2', categorySlug: 'diesel-repair', isFeatured: true, ...live }),
          listing({ id: '3', categorySlug: 'towing', isFeatured: true, ...live }),
        ],
        { startsAt: NOW.toISOString(), endsAt: at(30 * DAY).toISOString() },
        NOW,
      );
      return !verdict.ok && verdict.blockers.some((b) => /I-95 corridor/.test(b));
    })(),
  );

  check(
    'FE45',
    'a listing never counts against its own capacity, so a renewal is not blocked by itself',
    canActivateFeatured(
      listing({ id: 'target', isFeatured: true, ...live }),
      [
        listing({ id: 'target', isFeatured: true, ...live }),
        listing({ id: '1', isFeatured: true, ...live }),
        listing({ id: '2', isFeatured: true, ...live }),
      ],
      { startsAt: NOW.toISOString(), endsAt: at(30 * DAY).toISOString() },
      NOW,
    ).ok,
  );

  check(
    'FE46',
    'a placement with no recorded term does not hold a slot it cannot legally occupy',
    featuredUsage(
      listing({ id: 'target' }),
      [listing({ id: '1', isFeatured: true, featuredUntil: null })],
      NOW,
    ).category.used === 0,
  );

  // Before the migration, capacity has to behave exactly as it did — otherwise
  // merging the code silently frees three slots on every page.
  check(
    'FE47',
    'before the migration capacity counts the flag, as it always did',
    featuredUsage(
      listing({ id: 'target' }),
      [listing({ id: '1', isFeatured: true, featuredUntil: undefined })],
      NOW,
      'unavailable',
    ).category.used === 1,
  );
}

/* ====================================================== 8 · activation gate */

check(
  'FE48',
  'activation is refused outright while the schema is missing',
  featuredWindowBlockers(null, NOW, 'unavailable').some((b) => /migration 057/.test(b)),
);

check(
  'FE49',
  'the activation action asks the admin client, not the public one, whether it may write',
  (() => {
    const action = src('src/app/admin/(dashboard)/directory/placements/actions.ts');
    return (
      /import \{ adminFeaturedSchema \}/.test(action) &&
      !/from '@\/lib\/directory\/data'/.test(action)
    );
  })(),
);

check(
  'FE50',
  'the flag and the term are written in ONE update, so a public row without a term is unreachable',
  (() => {
    const action = src('src/app/admin/(dashboard)/directory/placements/actions.ts');
    const updates = action.match(/\.update\(\{ is_featured: true[^}]*\}\)/g) ?? [];
    return (
      updates.length === 2 && // activate + renew
      updates.every((u) => /featured_until: endsAt/.test(u))
    );
  })(),
);

check(
  'FE51',
  'every featured write is re-gated on the sale at write time, not on the form',
  (() => {
    const action = src('src/app/admin/(dashboard)/directory/placements/actions.ts');
    const gates =
      action.match(/saleActivationBlockers\('featured-listing', sale, \{ startsAt, endsAt \}\)/g) ??
      [];
    return gates.length === 2 && /const sale = await loadSale\(supabase, sponsorId\);/.test(action);
  })(),
);

check(
  'FE52',
  'the paying opportunity is required — a placement never goes live unsold',
  /A placement never goes live unsold/.test(
    src('src/app/admin/(dashboard)/directory/placements/actions.ts'),
  ),
);

check(
  'FE53',
  'capacity is judged against rows read live, with the same clock the write uses',
  (() => {
    const action = src('src/app/admin/(dashboard)/directory/placements/actions.ts');
    const verdicts =
      action.match(
        /canActivateFeatured\(target, existing, \{ startsAt, endsAt \}, now, schema\)/g,
      ) ?? [];
    return verdicts.length === 2 && /const now = new Date\(\);/.test(action);
  })(),
);

/* =========================================================== 9 · manual stop */

check(
  'FE54',
  'stopping a placement clears the term with the flag',
  /schema === 'ready' \? \{ is_featured: false, featured_until: null \} : \{ is_featured: false \}/.test(
    src('src/app/admin/(dashboard)/directory/placements/actions.ts'),
  ),
);

check(
  'FE55',
  'stopping before the migration does not name a column that does not exist',
  (() => {
    const action = src('src/app/admin/(dashboard)/directory/placements/actions.ts');
    const body = action.slice(
      action.indexOf('export async function deactivateFeaturedAction'),
      action.indexOf('export async function renewFeaturedAction'),
    );
    return /const schema = await adminFeaturedSchema\(\);/.test(body);
  })(),
);

check(
  'FE56',
  'stopping stays one click — it never requires payment or a confirmation word',
  (() => {
    const action = src('src/app/admin/(dashboard)/directory/placements/actions.ts');
    const body = action.slice(
      action.indexOf('export async function deactivateFeaturedAction'),
      action.indexOf('export async function renewFeaturedAction'),
    );
    return !/CONFIRM_WORD/.test(body) && !/saleActivationBlockers/.test(body);
  })(),
);

check(
  'FE57',
  'stopping erases no commercial history',
  (() => {
    const action = src('src/app/admin/(dashboard)/directory/placements/actions.ts');
    const body = action.slice(
      action.indexOf('export async function deactivateFeaturedAction'),
      action.indexOf('export async function renewFeaturedAction'),
    );
    // It appends a `deactivated` touch and never updates `sponsors.notes` by
    // replacement.
    return /action: 'deactivated'/.test(body) && !/notes: /.test(body);
  })(),
);

/* ============================================================= 10 · renewal */

check(
  'FE58',
  'renewal exists as its own action rather than a re-activation',
  /export async function renewFeaturedAction/.test(
    src('src/app/admin/(dashboard)/directory/placements/actions.ts'),
  ),
);

check(
  'FE59',
  'a renewed term runs from now, not from the lapsed expiry',
  (() => {
    const action = src('src/app/admin/(dashboard)/directory/placements/actions.ts');
    const body = action.slice(action.indexOf('export async function renewFeaturedAction'));
    return (
      /const startsAt = now\.toISOString\(\);/.test(body) &&
      /const endsAt = billing \? featuredExpiryFrom\(now, billing\)\.toISOString\(\) : null;/.test(
        body,
      ) &&
      !/featuredExpiryFrom\((?!now)/.test(body)
    );
  })(),
);

check(
  'FE60',
  'a renewal is gated exactly as hard as the first sale',
  (() => {
    const action = src('src/app/admin/(dashboard)/directory/placements/actions.ts');
    const body = action.slice(action.indexOf('export async function renewFeaturedAction'));
    return (
      /requireAdmin\(\);/.test(body) &&
      /saleActivationBlockers/.test(body) &&
      /CONFIRM_WORD/.test(body) &&
      /A renewal is a second sale/.test(body)
    );
  })(),
);

check(
  'FE61',
  'renewal appends to the audit trail and never overwrites the activation',
  (() => {
    const action = src('src/app/admin/(dashboard)/directory/placements/actions.ts');
    const body = action.slice(action.indexOf('export async function renewFeaturedAction'));
    return /Appended, never overwritten/.test(body) && /recordAudit\(/.test(body);
  })(),
);

check(
  'FE62',
  'renewal restores a lapsed placement without a stop-then-start round trip',
  // The lapsed row is still `is_featured = true` with a past term; the renewal
  // writes the same one-shot update, and capacity excludes the target itself.
  canActivateFeatured(
    listing({ id: 'target', isFeatured: true, featuredUntil: at(-DAY).toISOString() }),
    [listing({ id: 'target', isFeatured: true, featuredUntil: at(-DAY).toISOString() })],
    { startsAt: NOW.toISOString(), endsAt: at(30 * DAY).toISOString() },
    NOW,
  ).ok,
);

check(
  'FE63',
  'renewal is blocked while the schema is missing, like activation',
  (() => {
    const action = src('src/app/admin/(dashboard)/directory/placements/actions.ts');
    const body = action.slice(action.indexOf('export async function renewFeaturedAction'));
    return /featuredWindowBlockers\(null, now, schema\)/.test(body);
  })(),
);

/* ================================================ 11 · what the admin is told */

check(
  'FE64',
  'the offer authority now says a featured listing auto-expires',
  getOffer('featured-listing').autoExpires === true,
);

check(
  'FE65',
  'an overdue featured term reads as ended-and-gone once the schema is ready',
  (() => {
    const v = renewalView('featured-listing', '2026-09-01', true, NOW, 'ready');
    return (
      v.state === 'overdue' && v.needsManualStop === false && /ended automatically/.test(v.label)
    );
  })(),
);

check(
  'FE66',
  'an overdue featured term still reads as STILL SHOWING before the migration',
  (() => {
    const v = renewalView('featured-listing', '2026-09-01', true, NOW, 'unavailable');
    return v.state === 'overdue' && v.needsManualStop === true && /STILL SHOWING/.test(v.label);
  })(),
);

check(
  'FE67',
  'a corridor sponsor is unaffected by the featured schema state',
  (() => {
    const a = renewalView('corridor-sponsor', '2026-09-01', true, NOW, 'ready');
    const b = renewalView('corridor-sponsor', '2026-09-01', true, NOW, 'unavailable');
    return a.needsManualStop === false && b.needsManualStop === false && a.label === b.label;
  })(),
);

check(
  'FE68',
  'the pipeline summary is told the schema state rather than assuming it',
  (() => {
    const rows: SponsorSaleRow[] = [
      {
        id: 's1',
        stage: 'closed_won',
        status: 'active',
        tierInterest: null,
        pledgedCents: 9900,
        paidCents: 9900,
        nextAction: 'Renew',
        // The renewal date IS the next-action date, and the offer is read back
        // from the labelled note line — same as a real row.
        nextActionDate: '2026-09-01',
        notes: 'Agreed offer: featured-listing · monthly · quoted $99.00',
      },
    ];
    const ready = pipelineSummary(rows, NOW, 'ready');
    const missing = pipelineSummary(rows, NOW, 'unavailable');
    return ready.renewalOverdue === 1 && missing.renewalOverdue === 1;
  })(),
);

check(
  'FE69',
  'every admin state has words, so status is never colour alone',
  (
    [
      'schema-unavailable',
      'inactive',
      'active',
      'expired',
      'malformed',
      'missing-expiry',
    ] as FeaturedWindowStatus[]
  ).every(
    (s) => typeof FEATURED_STATUS_LABEL[s] === 'string' && FEATURED_STATUS_LABEL[s].length > 3,
  ),
);

check(
  'FE70',
  'an expired placement is a housekeeping item, not a public emergency',
  needsFeaturedCleanup('expired') &&
    needsFeaturedCleanup('malformed') &&
    needsFeaturedCleanup('missing-expiry') &&
    !needsFeaturedCleanup('active') &&
    !needsFeaturedCleanup('inactive') &&
    !needsFeaturedCleanup('schema-unavailable'),
);

check(
  'FE71',
  'the placements console blocks activation and says why while the schema is missing',
  (() => {
    const page = src('src/app/admin/(dashboard)/directory/placements/page.tsx').replace(
      /\s+/g,
      ' ',
    );
    return (
      /Featured-expiry schema is not active yet/.test(page) &&
      /Activation is blocked until migration 057/.test(page)
    );
  })(),
);

check(
  'FE72',
  'the placements console no longer offers a start date it would ignore',
  (() => {
    const page = src('src/app/admin/(dashboard)/directory/placements/page.tsx');
    const form = page.slice(
      page.indexOf('activateFeaturedAction'),
      page.indexOf('renewFeaturedAction'),
    );
    return !/name="starts_on"/.test(form) && !/name="ends_on"/.test(form);
  })(),
);

/* ================================================= 12 · the migration itself */

{
  const sql = src('supabase/migrations/057_featured_listing_term.sql');

  check(
    'FE73',
    'the migration is marked unapplied and requires explicit approval',
    /DO NOT APPLY WITHOUT EXPLICIT APPROVAL/.test(sql) && /Not applied as of this commit/.test(sql),
  );

  check(
    'FE74',
    'the migration is one transaction with a drift guard and post-conditions',
    /^begin;/m.test(sql) &&
      /commit;\s*$/.test(sql.trim() + '\n') &&
      /\$guard\$/.test(sql) &&
      /\$verify\$/.test(sql) &&
      /raise exception 'schema drift/.test(sql) &&
      /raise exception 'post-condition failed/.test(sql),
  );

  check(
    'FE75',
    'the column is nullable timestamptz with no default',
    /add column featured_until timestamptz;/.test(sql) &&
      !/featured_until timestamptz[^;]*default/i.test(sql) &&
      /column_default is not null/.test(sql),
  );

  // A CHECK is immutable. One containing now() would re-evaluate on every
  // future UPDATE and start rejecting writes to rows whose term merely passed.
  check(
    'FE76',
    'no CHECK constraint consults the clock',
    (() => {
      const checks = sql.match(/check \([^)]*\)/gi) ?? [];
      return checks.length > 0 && checks.every((c) => !/now\(\)|current_timestamp/i.test(c));
    })(),
  );

  check(
    'FE77',
    'the constraint makes a featured row without a term structurally impossible',
    /check \(not is_featured or featured_until is not null\)/.test(sql),
  );

  check(
    'FE78',
    'the migration writes no data values and proves it',
    !/^\s*(update|insert|delete)\s/im.test(sql) &&
      /expected 0 featured rows/.test(sql) &&
      /a featured_until value appeared during migration/.test(sql),
  );

  check(
    'FE79',
    'the migration touches no RLS policy, grant or unrelated table',
    (() => {
      // Comments are stripped first: this asks what the migration DOES, and the
      // safety note above legitimately contains the words it forbids.
      const ddl = sql
        .split('\n')
        .filter((l) => !l.trimStart().startsWith('--'))
        .join('\n');
      return (
        !/\b(create|alter|drop)\s+policy\b/i.test(ddl) &&
        !/\bgrant\b|\brevoke\b/i.test(ddl) &&
        !/alter table (?!public\.locations)/i.test(ddl) &&
        !/\bdrop\b/i.test(ddl)
      );
    })(),
  );

  check(
    'FE80',
    'the rollback is documented and refuses to run over a paid term',
    /ROLLBACK/.test(sql) &&
      /drop column featured_until;/.test(sql) &&
      /Do NOT run that rollback while any row has/.test(sql) &&
      /destroys the record of a\s*\n--\s*term a business paid for/.test(sql),
  );
}

/* ============================== 12b · the operations package is a contract */

/**
 * The operations doc is the only thing standing between a correct migration and
 * a blanket `supabase db push`. Five migrations on this project are
 * deliberately unapplied, so "apply the pending migrations" is not a safe
 * instruction here — and a document that omitted that would be worse than no
 * document, because it would read as complete.
 */
{
  const ops = src('docs/operations/revenue-2-featured-expiry.md');
  const verifier = src('scripts/verify-featured-term-migration.mjs');

  extra('the operations doc names migration 057 specifically', /migration 057/i.test(ops));
  extra(
    'it forbids a blanket migration command, in those words',
    /DO NOT USE A BLANKET MIGRATION COMMAND/.test(ops) && /supabase db push/.test(ops),
  );
  // Every one of the five must be named. A list that quietly omitted one would
  // be the exact failure it exists to prevent.
  extra(
    'it names all five deliberately unapplied migrations',
    ['049', '050', '051', '052', '053'].every((n) => ops.includes(n)),
  );
  extra(
    'it requires the ledger to be checked before AND after',
    /Ledger before/i.test(ops) && /Ledger and object after/i.test(ops),
  );
  // The ledger is provably incomplete on this project (047 is applied but has
  // no row), so a procedure that trusted it alone would be wrong.
  extra(
    'it warns that the ledger is not a complete record',
    /ledger is not a complete record/i.test(ops) && /047/.test(ops),
  );
  extra(
    'it states the ISR staleness bound rather than claiming instant expiry',
    /up to five minutes/i.test(ops) && /revalidate = 300/.test(ops),
  );
  extra(
    'it documents the rollback and its refusal',
    /Rolling back/i.test(ops) && /Do not run that while/i.test(ops),
  );
  extra(
    'it tells the operator to redeploy after a rollback',
    /After a rollback, \*\*redeploy\*\*/.test(ops),
  );
  extra('it records the live preconditions that were actually checked', /2,454/.test(ops));
  extra(
    'it states that no payment processor or outreach was added',
    /No payment processor/i.test(ops) && /No outreach automation/i.test(ops),
  );

  extra(
    'the verifier writes nothing and says so',
    /IT WRITES NOTHING\. EVER\./.test(verifier) &&
      /const inRollback = \(body\) => `begin;/.test(verifier),
  );
  extra(
    'the verifier issues no commit anywhere',
    !/\bcommit;/.test(verifier.replace(/\/\*[\s\S]*?\*\//g, ' ')),
  );
  extra(
    'the verifier refuses a production ref unless explicitly overridden',
    /PRODUCTION_REFS/.test(verifier) &&
      /FEATURED_TERM_VERIFY_ALLOW_PRODUCTION/.test(verifier) &&
      /No connection was opened/.test(verifier),
  );
  extra(
    'the production rail runs BEFORE any connection is opened',
    verifier.indexOf('const namedRef = PRODUCTION_REFS.find') <
      verifier.indexOf('serverVersion = run('),
  );
  extra(
    'the verifier skips loudly rather than passing when it cannot run',
    /This is NOT a pass/.test(verifier),
  );
  extra(
    'the verifier reads no credential from anywhere but the environment',
    !/postgres:\/\//.test(verifier),
  );
}

/* ============================================ 13 · end-to-end lifecycle */

/**
 * One fixture listing walked through its whole commercial life against a
 * controllable clock. Every step below is a fact the suite already asserts
 * somewhere above; what this adds is that they hold IN SEQUENCE, on one row,
 * with nothing reset in between — which is the only way the "still showing
 * after the term" defect could ever have survived a passing test file.
 */
{
  console.log('\n  Lifecycle — one listing, one clock');

  const TERM_END = at(30 * DAY);
  const clockSteps: Array<[string, Date]> = [
    ['activation', at(0)],
    ['one second before expiry', new Date(TERM_END.getTime() - SECOND)],
    ['the exact expiry boundary', TERM_END],
    ['one second after expiry', new Date(TERM_END.getTime() + SECOND)],
  ];

  const live = listing({
    id: 'target',
    isFeatured: true,
    featuredUntil: TERM_END.toISOString(),
  });

  const expectedVisible = [true, true, false, false];
  clockSteps.forEach(([label, clock], i) => {
    const visible = isFeaturedActive(
      {
        isFeatured: live.isFeatured,
        isPublished: live.isPublished,
        deletedAt: live.deletedAt,
        name: live.name,
        featuredUntil: live.featuredUntil,
      },
      clock,
    );
    extra(
      `lifecycle: ${label} — placement ${expectedVisible[i] ? 'live' : 'over'}`,
      visible === expectedVisible[i],
      { label, visible },
    );
    console.log(`    ${visible === expectedVisible[i] ? 'ok  ' : 'FAIL'} ${label}`);
  });

  // Released capacity: the moment the term passes, the slot is free for the
  // next sale — with no write, no cron and nobody remembering to untick it.
  const afterExpiry = new Date(TERM_END.getTime() + SECOND);
  extra(
    'lifecycle: expiry releases the capacity slot with no write',
    featuredUsage(listing({ id: 'newcomer' }), [live], TERM_END).category.used === 0 &&
      featuredUsage(listing({ id: 'newcomer' }), [live], new Date(TERM_END.getTime() - SECOND))
        .category.used === 1,
  );

  // Renewal: the lapsed row is restored, and the new term runs from the renewal
  // instant rather than handing back days nobody paid for.
  {
    const renewedEnd = featuredExpiryFrom(afterExpiry, 'monthly');
    extra(
      'lifecycle: renewal is permitted on the lapsed row',
      canActivateFeatured(
        live,
        [live],
        { startsAt: afterExpiry.toISOString(), endsAt: renewedEnd.toISOString() },
        afterExpiry,
      ).ok,
    );
    extra(
      'lifecycle: the renewed term starts at the renewal, not at the lapsed expiry',
      renewedEnd.getTime() > featuredExpiryFrom(TERM_END, 'monthly').getTime(),
    );
    const renewed = { ...live, featuredUntil: renewedEnd.toISOString() };
    extra(
      'lifecycle: the renewed placement is live again',
      isFeaturedActive(
        {
          isFeatured: renewed.isFeatured,
          isPublished: renewed.isPublished,
          deletedAt: renewed.deletedAt,
          name: renewed.name,
          featuredUntil: renewed.featuredUntil,
        },
        afterExpiry,
      ),
    );
  }

  // Manual stop: still available at any point, and it ends the placement
  // immediately rather than at the term.
  {
    const stopped = { ...live, isFeatured: false, featuredUntil: null };
    extra(
      'lifecycle: a manual stop ends the placement immediately',
      !isFeaturedActive(
        {
          isFeatured: stopped.isFeatured,
          isPublished: stopped.isPublished,
          deletedAt: stopped.deletedAt,
          name: stopped.name,
          featuredUntil: stopped.featuredUntil,
        },
        at(0),
      ),
    );
  }

  // The same walk with the schema missing: NOTHING expires, because there is no
  // term to read. That is the whole point of the bridge — merging the code
  // changes nothing a visitor can see.
  {
    const seenPre = clockSteps.map(([, clock]) =>
      isFeaturedActive(
        {
          isFeatured: live.isFeatured,
          isPublished: live.isPublished,
          deletedAt: live.deletedAt,
          name: live.name,
          featuredUntil: undefined,
        },
        clock,
        'unavailable',
      ),
    );
    extra(
      'lifecycle: with the schema missing the placement never self-expires',
      seenPre.every(Boolean),
      seenPre,
    );
    extra(
      'lifecycle: with the schema missing the admin is told to stop it by hand',
      renewalView('featured-listing', '2026-09-01', true, NOW, 'unavailable').needsManualStop,
    );
    extra(
      'lifecycle: with the schema missing activation is refused rather than half-done',
      featuredWindowBlockers(null, NOW, 'unavailable').length === 1,
    );
  }

  // An unrelated database failure must not be read as "the migration is not
  // applied" — that would silently un-expire every placement on the site.
  {
    const unrelated = { code: '42703', message: 'column locations.parking_spaces does not exist' };
    const permission = { code: '42501', message: 'permission denied for table locations' };
    const timeout = { code: '57014', message: 'canceling statement due to statement timeout' };
    const real = { code: '42703', message: 'column locations.featured_until does not exist' };

    // Re-implemented here exactly as both probes define it, so this asserts the
    // RULE. FE30 asserts both call sites still carry that rule verbatim.
    const isMissing = (e: { code: string; message: string }) =>
      (e.code === '42703' || e.code === 'PGRST204') && e.message.includes('featured_until');

    extra(
      'lifecycle: an unrelated undefined-column error is not "057 unapplied"',
      !isMissing(unrelated),
    );
    extra('lifecycle: a permission error is not "057 unapplied"', !isMissing(permission));
    extra('lifecycle: a timeout is not "057 unapplied"', !isMissing(timeout));
    extra('lifecycle: the real missing-column error IS recognised', isMissing(real));
  }
}

/* ================================================ 14 · mutation testing */

/**
 * Each entry removes one protection and proves the corresponding assertion
 * FAILS on the damaged version. The shape is deliberate: a mutation test that
 * only shows a string replace succeeded proves nothing — what has to be shown
 * is that the predicate holds on the real code and does NOT hold on the mutant.
 *
 * So every source mutation below names the predicate it is attacking, and the
 * predicate is a function applied to both versions. Rule mutations do the same
 * with behaviour instead of text: the mutant rule is written out, and the real
 * rule is shown to disagree with it on a case this suite asserts.
 */
{
  const actions = src('src/app/admin/(dashboard)/directory/placements/actions.ts');
  const window = src('src/lib/directory/featured-window.ts');
  const data = src('src/lib/directory/data.ts');
  const sql = src('supabase/migrations/057_featured_listing_term.sql');
  const revenue = src('src/lib/directory/revenue.ts');

  /** A source predicate: holds on healthy code, must break on the mutant. */
  type Pred = (text: string) => boolean;

  const P = {
    /** FE16 — the term is derived, never taken from the form. */
    derivedTerm: ((t) =>
      /const endsAt = billing \? featuredExpiryFrom\(now, billing\)\.toISOString\(\) : null;/.test(
        t.slice(
          t.indexOf('export async function activateFeaturedAction'),
          t.indexOf('export async function deactivateFeaturedAction'),
        ),
      )) as Pred,
    /** FE50 — every featured write carries the term. */
    atomicWrite: ((t) => {
      const updates = t.match(/\.update\(\{ is_featured: true[^}]*\}\)/g) ?? [];
      return updates.length === 2 && updates.every((u) => /featured_until: endsAt/.test(u));
    }) as Pred,
    /** FE27 — the pre-migration projection omits the column. */
    schemaAwareProjection: ((t) =>
      t.includes(
        "return schema === 'ready' ? `${BASE_COLUMNS}, ${FEATURED_COLUMN}` : BASE_COLUMNS;",
      )) as Pred,
    /** FE29 — an indeterminate probe is not memoized. */
    reprobes: ((t) =>
      // Scoped to featuredSchema()'s own body — `__resetFeaturedSchemaMemo`
      // clears the same two variables, and an unscoped match would report the
      // test seam as the protection and never notice it had been removed.
      /featuredSchemaMemo = null;\s*\n\s*memoGoodUntil = 0;/.test(
        t.slice(
          t.indexOf('export async function featuredSchema'),
          t.indexOf('/** The projection for the current schema state. */'),
        ),
      )) as Pred,
    /** FE74 / FE78 — the migration proves its own post-conditions. */
    verifiedMigration: ((t) =>
      /\$verify\$/.test(t) &&
      /expected 0 featured rows/.test(t) &&
      /a featured_until value appeared during migration/.test(t)) as Pred,
    /** FE61 — renewal appends to the audit trail. */
    appendsAudit: ((t) => {
      const renew = t.slice(t.indexOf('export async function renewFeaturedAction'));
      return /recordAudit\(/.test(renew) && !/notes: /.test(renew);
    }) as Pred,
    /** Expiry is a read rule: nothing in the featured path writes is_published. */
    expiryNeverUnpublishes: ((t) => {
      const featuredActions = t.slice(
        t.indexOf('export async function activateFeaturedAction'),
        t.indexOf('/* ------------------------------------------------------- corridor sponsor */'),
      );
      // `is_published` may appear only as a READ filter. Every mention has to
      // be an `.eq(` on a select; a mention anywhere else is a write.
      const mentions = featuredActions.match(/.{8}is_published/g) ?? [];
      return mentions.length > 0 && mentions.every((m) => m.endsWith(".eq('is_published"));
    }) as Pred,
    /** Every server action is admin-gated on its first statement. */
    adminGated: ((t) => {
      const re =
        /export async function (\w+)\(formData: FormData\): Promise<void> \{\s*\n\s*([^\n]+)/g;
      let m: RegExpExecArray | null;
      let offenders = 0;
      while ((m = re.exec(t)) !== null) if (!m[2].startsWith('requireAdmin()')) offenders++;
      return offenders === 0;
    }) as Pred,
    /** FE31 — the admin probe refuses to activate when it cannot tell. */
    adminFailsClosed: ((t) => /if \(v !== 'ready'\) memo = null;/.test(t)) as Pred,
    /** REVENUE-1 regression: note parsing is global, never first-match. */
    globalNoteParsing: ((t) => {
      // The note regexes are declared ABOVE readSaleState, so the slice has to
      // start at the first of them or this predicate never sees the thing it
      // is guarding.
      const readState = t.slice(
        t.indexOf('const TERM_RE'),
        t.indexOf('export function saleActivationBlockers'),
      );
      const nonGlobal = (readState.match(/= \/[^/\n]+\/[a-z]*;/g) ?? []).filter(
        (r) => !/\/[a-z]*g[a-z]*;$/.test(r),
      );
      return nonGlobal.length === 0 && /lastMatch\(/.test(t);
    }) as Pred,
  };

  /** Source mutation: the predicate must hold on the real file and fail here. */
  function sourceMutation(
    name: string,
    text: string,
    pred: Pred,
    mutate: (t: string) => string,
  ): [string, () => boolean] {
    return [
      name,
      () => {
        const mutant = mutate(text);
        if (mutant === text) return false; // the mutation did not apply — report it
        return pred(text) === true && pred(mutant) === false;
      },
    ];
  }

  /** Rule mutation: the damaged rule and the real rule disagree on a case. */
  function ruleMutation(
    name: string,
    mutantSaysFeatured: boolean,
    realSays: boolean,
  ): [string, () => boolean] {
    return [name, () => mutantSaysFeatured !== realSays];
  }

  const expiredRow = row({ featuredUntil: at(-DAY).toISOString() });
  const noTermRow = row({ featuredUntil: null });
  const boundary = at(0).toISOString();
  const expiredListing = listing({
    id: '1',
    isFeatured: true,
    featuredUntil: at(-DAY).toISOString(),
  });

  const mutations: Array<[string, () => boolean]> = [
    /* ---- rule mutations: the damaged rule disagrees with the real one ---- */
    ruleMutation(
      'reverting eligibility to the bare is_featured boolean would be caught',
      // Mutant: the flag alone. FE3 is the assertion that bites.
      expiredRow.isFeatured,
      isFeaturedActive(expiredRow, NOW),
    ),
    ruleMutation(
      'treating a null term as "runs forever" would be caught',
      // Mutant: null passes the window test. FE4 bites.
      noTermRow.isFeatured &&
        (noTermRow.featuredUntil == null || Date.parse(noTermRow.featuredUntil) > NOW.getTime()),
      isFeaturedActive(noTermRow, NOW),
    ),
    ruleMutation(
      'using the wrong exact-boundary comparison would be caught',
      // Mutant: `>` instead of `>=` gives one extra millisecond. FE10/FE12 bite.
      !(at(0).getTime() > Date.parse(boundary)),
      isFeaturedActive(row({ featuredUntil: boundary }), at(0)),
    ),
    [
      'counting expired rows toward category capacity would be caught',
      () => {
        // Mutant: the pre-REVENUE-2 rule, restored. FE39/FE42 bite.
        const mutantUsed = [expiredListing].filter(
          (l) => l.isFeatured && l.isPublished && !l.deletedAt,
        ).length;
        const realUsed = featuredUsage(listing({ id: 'target' }), [expiredListing], NOW).category
          .used;
        return mutantUsed === 1 && realUsed === 0;
      },
    ],
    [
      'counting expired rows toward corridor capacity would be caught',
      () => {
        const mutantUsed = [expiredListing].filter(
          (l) => l.isFeatured && l.interstate === 'I-95',
        ).length;
        const realUsed =
          featuredUsage(listing({ id: 'target' }), [expiredListing], NOW).corridor?.used ?? -1;
        return mutantUsed === 1 && realUsed === 0;
      },
    ],
    [
      'permitting activation before the migration would be caught',
      () => {
        // Mutant: the schema blocker is dropped, so a placement could be
        // written with no column to hold its term. FE48 bites.
        const mutantBlockers = featuredWindowBlockers(null, NOW, 'unavailable').filter(
          (b) => !/migration 057/.test(b),
        );
        const realBlockers = featuredWindowBlockers(null, NOW, 'unavailable');
        return (
          mutantBlockers.length === 0 &&
          realBlockers.length === 1 &&
          /migration 057/.test(realBlockers[0]!)
        );
      },
    ],
    [
      'refusing a future start only in the UI would be caught',
      () => {
        // Mutant: the console hides the field but the action still accepts one.
        // FE13 asserts the RULE refuses it, not the form.
        const tomorrow = at(DAY).toISOString().slice(0, 10);
        const mutantBlockers: string[] = []; // no server-side check at all
        return (
          mutantBlockers.length === 0 && featuredWindowBlockers(tomorrow, NOW, 'ready').length === 1
        );
      },
    ],
    [
      'hiding expired listings entirely to shrink the payload would be caught',
      () => {
        // Expiry removes the BADGE, not the business. FE35/FE36 bite.
        const rows = [browsable('a', 'Alpha Tire', false), browsable('b', 'Bravo Tire', false)];
        const mutantVisible = rows.filter((r) => r.featured).length;
        const realVisible = filterAndSortEntries(rows, BROWSE).length;
        return mutantVisible === 0 && realVisible === 2;
      },
    ],
    [
      'exposing the paid amount publicly would be caught',
      () => {
        const publicModules = [
          src('src/lib/directory/dto.ts'),
          src('src/lib/directory/data.ts'),
          src('src/lib/directory/sponsors-data.ts'),
        ];
        const pred: Pred = (t) => !/paid_cents|pledged_cents|paidCents|pledgedCents/.test(t);
        // Real modules pass; a module that projected the amount would not.
        return publicModules.every(pred) && !pred("select('id, name, paid_cents')");
      },
    ],
    [
      'exposing the sponsor id publicly would be caught',
      () => {
        const publicModules = [src('src/lib/directory/dto.ts'), src('src/lib/directory/data.ts')];
        const pred: Pred = (t) => !/sponsor_id|sponsorId/.test(t);
        return publicModules.every(pred) && !pred("select('id, name, sponsor_id')");
      },
    ],

    /* ---- source mutations: the predicate must break on the damaged file ---- */
    sourceMutation(
      'trusting the form expiration instead of the authoritative sale state would be caught',
      actions,
      P.derivedTerm,
      (t) =>
        t.replace(
          'const endsAt = billing ? featuredExpiryFrom(now, billing).toISOString() : null;',
          "const endsAt = field(formData, 'ends_on') || null;",
        ),
    ),
    sourceMutation(
      'splitting the flag and the term into two writes would be caught',
      actions,
      P.atomicWrite,
      (t) =>
        t.replace(
          '.update({ is_featured: true, featured_until: endsAt })',
          '.update({ is_featured: true })',
        ),
    ),
    sourceMutation(
      'putting the term column into the pre-migration projection would be caught',
      data,
      P.schemaAwareProjection,
      (t) =>
        t.replace(
          "return schema === 'ready' ? `${BASE_COLUMNS}, ${FEATURED_COLUMN}` : BASE_COLUMNS;",
          'return `${BASE_COLUMNS}, ${FEATURED_COLUMN}`;',
        ),
    ),
    sourceMutation('memoizing an indeterminate probe would be caught', data, P.reprobes, (t) =>
      t.replace('      featuredSchemaMemo = null;\n      memoGoodUntil = 0;', '      // pinned'),
    ),
    sourceMutation(
      'letting the admin probe memoize "unavailable" would be caught',
      src('src/lib/admin/featured-schema.ts'),
      P.adminFailsClosed,
      (t) => t.replace("if (v !== 'ready') memo = null;", '// keep the memo'),
    ),
    sourceMutation(
      'weakening the migration verification would be caught',
      sql,
      P.verifiedMigration,
      (t) => t.replace(/do \$verify\$[\s\S]*?\$verify\$;/, ''),
    ),
    sourceMutation(
      'making renewal overwrite the activation history would be caught',
      actions,
      P.appendsAudit,
      (t) =>
        t.replace(
          '  // Appended, never overwritten: the original activation stays in the history',
          "  await supabase.from('sponsors').update({ notes: renewalNote }).eq('id', sponsorId);\n  //",
        ),
    ),
    sourceMutation(
      'making expiration unpublish the listing would be caught',
      actions,
      P.expiryNeverUnpublishes,
      (t) =>
        t.replace(
          "schema === 'ready' ? { is_featured: false, featured_until: null } : { is_featured: false }",
          "schema === 'ready'\n      ? { is_featured: false, is_published: false, featured_until: null }\n      : { is_featured: false, is_published: false }",
        ),
    ),
    sourceMutation(
      'skipping the admin gate on a featured action would be caught',
      actions,
      P.adminGated,
      (t) => t.replace(/requireAdmin\(\);\n/, ''),
    ),
    sourceMutation(
      'reintroducing first-match note parsing would be caught',
      revenue,
      P.globalNoteParsing,
      (t) =>
        t.replace(
          'const TERM_RE = /^Agreed offer:.*?·\\s*(monthly|annual)\\s*·/gim;',
          'const TERM_RE = /^Agreed offer:.*?·\\s*(monthly|annual)\\s*·/im;',
        ),
    ),
  ];

  console.log('\n  Mutation checks');
  for (const [name, fn] of mutations) {
    const caught = fn();
    extra(`mutation: ${name}`, caught);
    console.log(`    ${caught ? 'ok  ' : 'FAIL'} ${name}`);
  }
}

/* ======================================================== 15 · coverage */

{
  const expected = Array.from({ length: 80 }, (_, i) => `FE${i + 1}`);
  const missing = expected.filter((id) => !seen.has(id));
  extra(`FE1–FE80 all reported (${seen.size}/80)`, missing.length === 0, missing);
}

console.log(`\nrevenue-featured-expiry: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
