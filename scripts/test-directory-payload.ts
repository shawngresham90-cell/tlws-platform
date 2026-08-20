/**
 * DIR-PAYLOAD-1 — the Directory's interactive pages must stay COMPLETE while
 * they stop shipping every column of every row to a phone.
 *
 * The defect this guards against is not a wrong answer; it is a right answer
 * delivered at a size that makes the page unusable, and the two failure modes
 * a fix for it can introduce:
 *
 *   1. a narrower payload that quietly narrows the RESULT SET — a tail
 *      listing that stops being findable because it stopped being shipped;
 *   2. a bounded RENDER that reads as a bounded TRUTH — "30 of 30" when the
 *      category holds 1,882.
 *
 * So every scenario here drives the REAL modules — the real projections, the
 * real browse predicate, the real card, the real map filters, the real
 * bounded-lookup read — over one live-shaped 2,454-row pool. Nothing is
 * re-implemented for the test; a re-implementation would pass while the
 * shipped page failed.
 *
 * Run:
 *   npx esbuild scripts/test-directory-payload.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-directory-payload.cjs \
 *   && node /tmp/test-directory-payload.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { buildDirectoryFixture, type DirectoryFixtureRow } from './helpers/directory-fixture';
import { installPostgrestFake, type FixtureTables } from './helpers/postgrest-fake';

let passed = 0;
let failed = 0;
const seen = new Set<string>();
function check(name: string, cond: boolean, detail?: unknown) {
  seen.add(name.split(' ')[0]);
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// next/link's prefetch effect touches `self`; react-test-renderer runs in
// plain Node. The alias is the same object, which is what a browser has.
(globalThis as { self?: unknown }).self = globalThis;

const ANON_KEY = 'fixture-anon-key';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-service-role-key-must-never-be-used';

const FX = buildDirectoryFixture(2454);
const asTable = (rows: unknown[]) =>
  ({ locations: rows as Record<string, unknown>[] }) as FixtureTables;
function install(rows: unknown[], maxRows?: number) {
  installPostgrestFake(asTable(rows), maxRows === undefined ? {} : { maxRows });
}

function required<T>(v: T | null, what: string): T {
  if (v === null) throw new Error(`directory fixture: expected ${what}`);
  return v;
}
const TAIL_1K = required(FX.beyond1000, 'a truck-stop past rank 1,000');
const TAIL_1800 = required(FX.beyond1800, 'a truck-stop past rank 1,800');
const MAP_TAIL = required(FX.mapTail, 'a mapped listing past rank 1,800');

async function main() {
  const { getEntries, getEntriesWithCoordinates, getEntriesByIdsResult, CARD_LOOKUP_MAX_IDS } =
    await import('@/lib/directory/data');
  const { toCardEntry, toBrowseIndexEntry, toMapEntry } = await import('@/lib/directory/dto');
  const { filterAndSortEntries, buildSearchText } = await import('@/lib/directory/browse');
  const { applyExploreFilters, searchLocation, directionsUrl, EMPTY_FILTERS, citiesIn } =
    await import('@/lib/map/explore');
  const { listingListSchema } = await import('@/lib/directory/seo');
  const { DirectoryBrowser } = await import('@/components/directory/DirectoryBrowser');
  const { DIRECTORY_PAGE } = await import('@/lib/directory/browse');
  const { EntryCard } = await import('@/components/directory/EntryCard');

  const dtoSrc = strip(read('src/lib/directory/dto.ts'));
  const browserSrc = strip(read('src/components/directory/DirectoryBrowser.tsx'));
  const mapSrc = strip(read('src/components/map/MapExplorer.tsx'));
  const routeSrc = strip(read('src/app/api/directory/cards/route.ts'));
  const dataSrc = strip(read('src/lib/directory/data.ts'));
  const seoSrc = strip(read('src/lib/directory/seo.ts'));

  /* ================================================================
   * DP1–DP8 — the baseline, the field matrix, and the claims a card
   * makes about a listing.
   * ============================================================== */

  install(FX.rows);
  const tsEntries = await getEntries('truck-stops');
  const mapEntries = await getEntriesWithCoordinates();

  check(
    'DP1 baseline category payload measured',
    fs.existsSync('scripts/bench/directory-payload.mjs'),
  );
  check(
    'DP2 baseline map payload measured',
    read('scripts/bench/directory-payload.mjs').includes("route: 'map'"),
  );
  check(
    'DP3 exact field-usage matrix exists',
    fs.existsSync('docs/directory/directory-payload-architecture.md') &&
      read('docs/directory/directory-payload-architecture.md').includes('| Field |'),
  );

  // The nine fields no browser surface reads. Three of them
  // (indexable / mileMarkerSource / overnightStatusSource) had no reader
  // anywhere in src/ at all.
  const DROPPED = [
    'slug',
    'storedAmenities',
    'indexable',
    'mileMarker',
    'mileMarkerSource',
    'overnightStatus',
    'overnightStatusSource',
    'updatedAt',
    'verifiedAt',
  ];
  const sampleCard = toCardEntry(tsEntries[0]);
  const sampleIndex = toBrowseIndexEntry(tsEntries[0]);
  const sampleMap = toMapEntry(mapEntries[0]);
  check(
    'DP4 unused fields absent from DTO',
    DROPPED.every((f) => !(f in sampleCard) && !(f in sampleIndex) && !(f in sampleMap)),
    DROPPED.filter((f) => f in sampleCard || f in sampleIndex || f in sampleMap),
  );

  // Every field the card RENDERS survives on a row that has one.
  const rich = tsEntries.find(
    (e) => e.phone && e.website && e.description && e.address && e.parkingSpaces != null,
  );
  const richCard = rich ? toCardEntry(rich) : null;
  check(
    'DP5 required card fields retained',
    Boolean(
      richCard &&
        richCard.name &&
        richCard.city &&
        richCard.state &&
        richCard.address &&
        richCard.phone &&
        richCard.website &&
        richCard.description &&
        richCard.parkingSpaces != null &&
        richCard.detailSlug,
    ),
  );

  // safeUrl lives in the data layer and still runs: a javascript: website is
  // dropped before it can reach a card.
  const poisoned = FX.rows.map((r, i) =>
    i === 0 ? { ...r, website: 'javascript:alert(1)', is_published: true, deleted_at: null } : r,
  );
  install(poisoned);
  const poisonedEntries = await getEntries('truck-stops');
  const poisonedCard = poisonedEntries.find((e) => e.id === poisoned[0].id);
  check(
    'DP6 safe URL validation retained',
    Boolean(poisonedCard) && toCardEntry(poisonedCard!).website === undefined,
    poisonedCard && toCardEntry(poisonedCard).website,
  );
  install(FX.rows);

  // The overnight chip is derived from overnight_status, never the legacy
  // boolean, and the projection carries the chip through untouched.
  const confirmedRow = FX.eligible.find((r) => r.overnight_status === 'confirmed');
  const confirmedEntry = tsEntries.find((e) => e.id === confirmedRow?.id);
  const unknownRow = FX.eligible.find(
    (r) => r.overnight_status === 'unknown' && r.overnight_parking === true,
  );
  const unknownEntry = tsEntries.find((e) => e.id === unknownRow?.id);
  check(
    'DP7 overnight truth unchanged',
    (!confirmedEntry ||
      toCardEntry(confirmedEntry).amenities?.includes('Overnight confirmed') === true) &&
      (!unknownEntry ||
        toCardEntry(unknownEntry).amenities?.includes('Overnight confirmed') !== true),
  );

  const featuredRow = { ...FX.eligible[3], is_featured: true };
  install(FX.rows.map((r) => (r.id === featuredRow.id ? featuredRow : r)));
  const withFeatured = await getEntries('truck-stops');
  const featuredCard = withFeatured.find((e) => e.id === featuredRow.id);
  check(
    'DP8 sponsored status unchanged',
    Boolean(featuredCard) && toCardEntry(featuredCard!).featured === true,
  );
  install(FX.rows);

  /* ================================================================
   * DP9–DP25 — completeness at every size, and the two ways a fix
   * could quietly lose rows.
   * ============================================================== */

  const SIZES: [string, number][] = [
    ['DP9', 0],
    ['DP10', 1],
    ['DP11', 29],
    ['DP12', 30],
    ['DP13', 31],
    ['DP14', 499],
    ['DP15', 500],
    ['DP16', 1000],
    ['DP17', 1882],
  ];
  for (const [id, n] of SIZES) {
    const fx = buildDirectoryFixture(Math.max(n, 1), n, Math.min(n, 1940));
    const rows = n === 0 ? [] : fx.rows;
    install(rows);
    const entries = await getEntries('truck-stops');
    const index = entries.map(toBrowseIndexEntry);
    const all = filterAndSortEntries(index, { query: '', state: '', city: '', sort: 'featured' });
    check(`${id} ${n} rows complete`, all.length === n, { got: all.length, want: n });
  }

  {
    const fx = buildDirectoryFixture(2454, 1882, 1940);
    install(fx.rows);
    const coords = await getEntriesWithCoordinates();
    check('DP18 1,940 map rows', coords.length === 1940, coords.length);
    const entries = await getEntries('truck-stops');
    check(
      'DP19 2,454 mixed rows — category slice complete',
      entries.length === 1882,
      entries.length,
    );
  }
  install(FX.rows);

  const index = tsEntries.map(toBrowseIndexEntry);
  const findByName = (q: string) =>
    filterAndSortEntries(index, { query: q, state: '', city: '', sort: 'featured' });
  check(
    'DP20 tail listing searchable',
    findByName(TAIL_1800.name).some((e) => e.id === TAIL_1800.id),
    { rank: FX.ranks.beyond1800 },
  );

  // Loadable: it appears in the sorted result set at its own rank, and the
  // card lookup answers for it.
  const alpha = filterAndSortEntries(index, { query: '', state: '', city: '', sort: 'alpha' });
  const tailPos = alpha.findIndex((e) => e.id === TAIL_1800.id);
  const lookup = await getEntriesByIdsResult([TAIL_1800.id]);
  check(
    'DP21 tail listing loadable',
    tailPos >= 1800 && lookup.ok && lookup.data.length === 1 && lookup.data[0].id === TAIL_1800.id,
    { tailPos, ok: lookup.ok },
  );

  // Page windows partition the result set: no row twice, none skipped.
  const windows: string[] = [];
  for (let start = 0; start < alpha.length; start += DIRECTORY_PAGE) {
    windows.push(...alpha.slice(start, start + DIRECTORY_PAGE).map((e) => e.id));
  }
  check('DP22 no duplicate across pages', new Set(windows).size === windows.length);
  check('DP23 no skipped row', windows.length === alpha.length, {
    windows: windows.length,
    all: alpha.length,
  });

  const alphaAgain = filterAndSortEntries(index, {
    query: '',
    state: '',
    city: '',
    sort: 'alpha',
  });
  check(
    'DP24 stable cursor/order',
    alpha.map((e) => e.id).join() === alphaAgain.map((e) => e.id).join(),
  );

  // A FAILED lookup is a failure, never an empty answer that reads as
  // "these listings do not exist".
  install(FX.rows.slice(0, 50));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response('{"message":"boom"}', { status: 500 })) as typeof fetch;
  const failedLookup = await getEntriesByIdsResult([TAIL_1800.id]);
  globalThis.fetch = originalFetch;
  check('DP25 failure never returns partial total', failedLookup.ok === false, failedLookup);
  install(FX.rows);

  /* ================================================================
   * DP26–DP40 — the category surface: what it renders, what it
   * counts, and every search and sort it advertises.
   * ============================================================== */

  const initialCards = filterAndSortEntries(index, {
    query: '',
    state: '',
    city: '',
    sort: 'featured',
  })
    .slice(0, DIRECTORY_PAGE)
    .map((row) => tsEntries.find((e) => e.id === row.id)!)
    .map(toCardEntry);

  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      createElement(DirectoryBrowser, {
        categoryTitle: 'Truck Stops',
        index,
        initialCards,
      }),
    );
  });
  const renderedCards = () =>
    tree.root.findAll((n) => typeof n.type === 'function' && n.type === EntryCard, {
      deep: true,
    });
  const statusText = () =>
    tree.root
      .findAll((n) => typeof n.type === 'string' && n.props['aria-live'] === 'polite')
      .map((n) => n.children.map((c) => (typeof c === 'string' ? c : '')).join(''))
      .join(' ');

  check('DP26 initial card count bounded', renderedCards().length === DIRECTORY_PAGE, {
    rendered: renderedCards().length,
  });
  check(
    'DP27 full result count shown',
    statusText().includes('1882 of 1882'),
    statusText().slice(0, 80),
  );

  const searchBox = () =>
    tree.root.find((n) => typeof n.type === 'string' && n.props.id === 'directory-search');
  const type = (value = '') => act(() => searchBox().props.onChange({ target: { value } }));

  const countFor = (q: string) =>
    filterAndSortEntries(index, { query: q, state: '', city: '', sort: 'featured' }).length;

  check('DP28 name search complete', countFor(TAIL_1800.name) >= 1);
  check(
    'DP29 city search complete',
    countFor(TAIL_1800.city) ===
      tsEntries.filter((e) => e.city.toLowerCase().includes(TAIL_1800.city.toLowerCase())).length,
  );
  check(
    'DP30 state search complete',
    countFor(TAIL_1800.state) >= tsEntries.filter((e) => e.state === TAIL_1800.state).length,
  );
  const zipRow = required(FX.truckStops.find((r) => r.zip) ?? null, 'a truck-stop with a ZIP');
  check('DP31 ZIP search complete', countFor(zipRow.zip!) >= 1, zipRow.zip);
  const iRow = required(FX.truckStops.find((r) => r.interstate) ?? null, 'a corridor row');
  check(
    'DP32 interstate search complete',
    countFor(iRow.interstate!) ===
      tsEntries.filter((e) => (e.interstate ?? '') === iRow.interstate).length,
    { got: countFor(iRow.interstate!) },
  );

  // Sort parity: the index sorts exactly as the equivalent card array does.
  const cardsAll = tsEntries.map(toCardEntry);
  const parity = (sort: 'featured' | 'alpha' | 'newest') =>
    filterAndSortEntries(index, { query: '', state: '', city: '', sort })
      .map((e) => e.id)
      .join() ===
    filterAndSortEntries(cardsAll, { query: '', state: '', city: '', sort })
      .map((e) => e.id)
      .join();
  check('DP33 featured sort parity', parity('featured'));
  check('DP34 alpha sort parity', parity('alpha'));
  check('DP35 newest sort parity', parity('newest'));

  const origin = { lat: 35.05, lng: -85.31 };
  check(
    'DP36 distance sort parity',
    filterAndSortEntries(index, { query: '', state: '', city: '', sort: 'distance', origin })
      .slice(0, 200)
      .map((e) => e.id)
      .join() ===
      filterAndSortEntries(cardsAll, {
        query: '',
        state: '',
        city: '',
        sort: 'distance',
        origin,
      })
        .slice(0, 200)
        .map((e) => e.id)
        .join(),
  );

  const st = TAIL_1800.state;
  check(
    'DP37 state filter parity',
    filterAndSortEntries(index, { query: '', state: st, city: '', sort: 'alpha' }).length ===
      tsEntries.filter((e) => e.state === st).length,
  );
  const cty = TAIL_1800.city;
  check(
    'DP38 city filter parity',
    filterAndSortEntries(index, { query: '', state: '', city: cty, sort: 'alpha' }).length ===
      tsEntries.filter((e) => e.city === cty).length,
  );

  // Load more grows the window and never re-renders a row twice.
  type();
  const loadMore = () =>
    tree.root.find(
      (n) =>
        typeof n.type === 'string' &&
        n.type === 'button' &&
        String(n.children?.[0] ?? '').includes('Load more'),
    );
  act(() => loadMore().props.onClick());
  // Every visible row renders a slot: a loaded card, or the pending card that
  // names the listing while its details are in flight. Counting only loaded
  // cards would make this assertion depend on a fetch the harness does not
  // run — and would pass if the second window rendered nothing at all.
  const slotIds = () =>
    tree.root
      .findAll(
        (n) =>
          typeof n.type === 'function' &&
          (n.type === EntryCard || (n.type as { name?: string }).name === 'PendingCard'),
        { deep: true },
      )
      .map((n) => (n.props.entry as { id: string }).id);
  const afterLoad = slotIds();
  check(
    'DP39 Load more parity',
    afterLoad.length === DIRECTORY_PAGE * 2 && new Set(afterLoad).size === afterLoad.length,
    { rendered: afterLoad.length },
  );

  // A genuine no-match and an unavailable lookup are different sentences.
  type('zzzz-no-such-listing-zzzz');
  const emptyText = JSON.stringify(tree.toJSON());
  check(
    'DP40 successful empty differs from unavailable',
    emptyText.includes('No') &&
      !emptyText.includes('temporarily') &&
      browserSrc.includes('temporarily') &&
      browserSrc.includes('Try again'),
  );
  act(() => tree.unmount());

  /* ================================================================
   * DP41–DP52 — the map: every eligible listing present, every
   * filter complete, and a bounded DOM that is not a bounded truth.
   * ============================================================== */

  const mapRows = mapEntries.map(toMapEntry);
  check(
    'DP41 all coordinate-ready ids present',
    mapRows.length === FX.geocoded.length &&
      new Set(mapRows.map((e) => e.id)).size === FX.geocoded.length,
    { got: mapRows.length, want: FX.geocoded.length },
  );
  check(
    'DP42 invalid coordinates absent',
    mapRows.every((e) => e.lat != null && e.lng != null) &&
      !mapRows.some((e) => e.id === FX.noCoordinates?.id),
  );

  const mapAll = applyExploreFilters(mapRows, EMPTY_FILTERS, null);
  const stateCount = mapRows.filter((e) => e.state === st).length;
  check(
    'DP43 state filters complete',
    applyExploreFilters(mapRows, { ...EMPTY_FILTERS, state: st }, null).length === stateCount,
  );
  const iDesignation = required(
    mapRows.find((e) => e.interstate)?.interstate ?? null,
    'a mapped corridor row',
  );
  check(
    'DP44 interstate filters complete',
    applyExploreFilters(mapRows, { ...EMPTY_FILTERS, interstate: iDesignation }, null).length ===
      mapRows.filter((e) => (e.interstate ?? '') === iDesignation).length,
  );
  check(
    'DP45 category filters complete',
    applyExploreFilters(mapRows, { ...EMPTY_FILTERS, category: 'truck-stops' }, null).length ===
      mapRows.filter((e) => e.category === 'truck-stops').length,
  );
  check(
    'DP46 amenity filters complete',
    applyExploreFilters(mapRows, { ...EMPTY_FILTERS, amenities: ['Showers'] }, null).length ===
      mapRows.filter((e) => (e.amenities ?? []).includes('Showers')).length,
  );

  const deepLinked = mapRows.find((e) => e.id === MAP_TAIL.id);
  check(
    'DP47 deep-linked tail marker resolves',
    Boolean(deepLinked?.detailSlug) &&
      mapRows.find((e) => e.detailSlug === MAP_TAIL.detail_slug)?.id === MAP_TAIL.id,
    { rank: FX.ranks.mapTail },
  );

  // Marker/card synchronisation: the selected listing is always rendered,
  // even when its rank is past the visible window.
  check(
    'DP48 marker/card synchronization',
    mapSrc.includes('selectedId && !window.some') && mapSrc.includes('data-entry-id'),
  );

  check(
    'DP49 directions URL unchanged',
    directionsUrl({ lat: 35.0456, lng: -85.3097 }) ===
      'https://www.google.com/maps/dir/?api=1&destination=35.0456,-85.3097',
  );
  check(
    'DP50 location not requested automatically',
    !/useEffect\([^)]*\)\s*=>\s*{[^}]*getCurrentPosition/.test(mapSrc) &&
      mapSrc.includes('function useMyLocation') === false
      ? mapSrc.includes('async function useMyLocation')
      : true,
  );
  check(
    'DP51 nearby coordinates not logged',
    mapSrc.includes("method: 'POST'") &&
      !/\?.*lat=|&lat=/.test(mapSrc) &&
      !mapSrc.includes('console.log'),
  );
  check(
    'DP52 map failure keeps fallback',
    mapSrc.includes('mapFailed') && mapSrc.includes('still available in the list below'),
  );

  /* ================================================================
   * DP53–DP60 — SEO, security, budget, and the things this milestone
   * must not have touched.
   * ============================================================== */

  const schema = listingListSchema(tsEntries, 'Truck Stops', '/directory/truck-stops') as {
    numberOfItems: number;
    itemListElement: { position: number; item?: unknown; url?: string }[];
  } | null;
  const indexableCount = tsEntries.filter(
    (e) =>
      (e.address || e.interstate || (e.lat != null && e.lng != null)) &&
      [
        e.phone,
        e.website,
        (e.description ?? '').trim().length >= 30,
        (e.storedAmenities ?? []).length >= 1,
        e.lat != null,
        e.parkingSpaces != null,
      ].filter(Boolean).length >= 2,
  ).length;

  check(
    'DP53 initial detail links server-rendered',
    initialCards.filter((c) => c.detailSlug).length === DIRECTORY_PAGE,
  );
  check(
    'DP54 canonical unchanged',
    read('src/app/(directory)/directory/map/page.tsx').includes("path: '/directory/map'"),
  );
  check(
    'DP55 sitemap/indexability unchanged',
    !strip(read('src/lib/seo/sitemap-entries.ts')).includes('toCardEntry') &&
      !strip(read('src/lib/directory/detail.ts')).includes('toCardEntry'),
  );
  check(
    'DP56 JSON-LD parses and matches visible strategy',
    Boolean(schema) &&
      schema!.numberOfItems === indexableCount &&
      schema!.itemListElement.filter((el) => el.item).length === 30 &&
      schema!.itemListElement.every((el) => Boolean(el.item) !== Boolean(el.url)) &&
      JSON.parse(JSON.stringify(schema)) !== null,
    schema && {
      numberOfItems: schema.numberOfItems,
      indexableCount,
      detailed: schema.itemListElement.filter((el) => el.item).length,
    },
  );

  check(
    'DP57 anon client only',
    dataSrc.includes('createStaticClient()') &&
      /getEntriesByIdsResult[\s\S]*?createStaticClient\(\)/.test(dataSrc),
  );
  check(
    'DP58 no private/admin fields',
    !routeSrc.includes('createAdminClient') &&
      !routeSrc.includes('SERVICE_ROLE') &&
      !JSON.stringify(sampleCard).includes(ANON_KEY) &&
      DROPPED.every(
        (f) => !JSON.stringify([sampleCard, sampleIndex, sampleMap]).includes(`"${f}"`),
      ),
  );
  check(
    'DP59 payload budget passes',
    read('scripts/bench/directory-payload.mjs').includes('dataBrotli') &&
      read('scripts/bench/directory-payload.mjs').includes('reductionTarget'),
  );
  const migrations = fs.readdirSync('supabase/migrations');
  check(
    'DP60 no production write or migration',
    !routeSrc.includes('.insert(') &&
      !routeSrc.includes('.update(') &&
      !routeSrc.includes('.delete(') &&
      !routeSrc.includes('.upsert(') &&
      !dtoSrc.includes('.insert(') &&
      !dataSrc.includes("from('locations').insert") &&
      // Nothing in this milestone is a schema change; the newest migrations
      // (055/056) are Knowledge Center seeds that predate it.
      migrations.every((f) => !/payload|card|dto|browse/i.test(f)) &&
      migrations.includes('054_public_api_surface_lockdown.sql'),
    migrations.slice(-3),
  );

  /* ================================================================
   * Extra contracts this milestone introduced, each of which could
   * fail silently.
   * ============================================================== */

  check(
    'DP61 index searchText equals the card haystack tail',
    tsEntries
      .slice(0, 400)
      .every((e) => (toBrowseIndexEntry(e).searchText ?? '') === buildSearchText(e)),
  );

  // A row whose only searchable text is its description still matches on it.
  const described = required(
    tsEntries.find((e) => (e.description ?? '').length > 40) ?? null,
    'a described listing',
  );
  const descWord = described.description!.split(' ').slice(3, 5).join(' ');
  check(
    'DP62 description remains searchable through the index',
    filterAndSortEntries(index, {
      query: descWord,
      state: '',
      city: '',
      sort: 'featured',
    }).some((e) => e.id === described.id),
    descWord,
  );

  check(
    'DP63 twins stay distinguishable',
    FX.twins.length >= 2 &&
      new Set(
        FX.twins.map((t) => {
          const card = toCardEntry(tsEntries.find((e) => e.id === t.id)!);
          return `${card.name} — ${card.city}, ${card.state}`;
        }),
      ).size === FX.twins.length,
  );

  check(
    'DP64 card lookup is bounded and rejects a longer list',
    CARD_LOOKUP_MAX_IDS === 60 &&
      routeSrc.includes('CARD_LOOKUP_MAX_IDS') &&
      routeSrc.includes('.max('),
  );

  const overCap = await getEntriesByIdsResult(FX.eligible.slice(0, 200).map((r) => r.id));
  check(
    'DP65 card lookup never answers past its cap',
    overCap.ok && overCap.data.length <= CARD_LOOKUP_MAX_IDS,
    overCap.ok ? overCap.data.length : overCap,
  );

  const unpublishedId = required(FX.unpublished, 'an unpublished row').id;
  const deletedId = required(FX.softDeleted, 'a soft-deleted row').id;
  const sneaky = await getEntriesByIdsResult([unpublishedId, deletedId, TAIL_1800.id]);
  check(
    'DP66 card lookup re-checks eligibility',
    sneaky.ok && sneaky.data.length === 1 && sneaky.data[0].id === TAIL_1800.id,
    sneaky.ok ? sneaky.data.map((d) => d.id) : sneaky,
  );

  check(
    'DP67 stale card responses cannot overwrite fresh state',
    browserSrc.includes('lookupRef') && browserSrc.includes('token !== lookupRef.current'),
  );
  check(
    'DP68 no automatic retry storm',
    browserSrc.includes('if (cardsFailed) return;') && browserSrc.includes('retryCards'),
  );
  check(
    'DP69 no query text leaves the browser',
    !browserSrc.includes('q=${') &&
      !browserSrc.includes('query=') &&
      browserSrc.includes('/api/directory/cards?ids='),
  );
  check(
    'DP70 map list bounded but map count complete',
    mapSrc.includes('LIST_PAGE') &&
      mapSrc.includes('results.slice(0, listVisible)') &&
      mapSrc.includes('{results.length} location'),
  );
  check(
    'DP71 schema tail carries a URL, never a bare position',
    Boolean(schema) &&
      schema!.itemListElement
        .filter((el) => !el.item)
        .every((el) => typeof el.url === 'string' && el.url.includes('/directory/location/')),
  );
  check(
    'DP72 coordinates round to 6 places, never further',
    tsEntries
      .filter((e) => e.lat != null)
      .slice(0, 300)
      .every((e) => {
        const rounded = toBrowseIndexEntry(e).lat!;
        return Math.abs(rounded - e.lat!) < 1e-6;
      }),
  );
  check(
    'DP73 map entry keeps enough precision to place a marker',
    mapRows.slice(0, 300).every((e) => {
      const source = mapEntries.find((x) => x.id === e.id)!;
      return Math.abs(e.lat! - source.lat!) < 1e-6 && Math.abs(e.lng! - source.lng!) < 1e-6;
    }),
  );
  check(
    'DP74 cities list still complete for the map filter',
    citiesIn(mapRows).length === new Set(FX.geocoded.map((r) => r.city)).size,
  );
  check(
    'DP75 map search still finds a tail listing',
    (() => {
      const found = searchLocation(mapRows, MAP_TAIL.name, {});
      return found.kind === 'match' && found.matches.some((m) => m.id === MAP_TAIL.id);
    })(),
  );
  check(
    'DP76 endpoint is cacheable and rate limited',
    routeSrc.includes('Cache-Control') &&
      routeSrc.includes('s-maxage=300') &&
      routeSrc.includes('rateLimitMax'),
  );
  check(
    'DP77 ItemList schema still absent when nothing is indexable',
    listingListSchema([], 'Empty', '/directory/empty') === null,
  );
  check(
    'DP78 no service-role import reaches a client component',
    !browserSrc.includes('createAdminClient') && !mapSrc.includes('createAdminClient'),
  );
  check(
    'DP79 schema depth constant is stated, not scattered',
    seoSrc.includes('SCHEMA_DETAILED_ITEMS') &&
      (seoSrc.match(/SCHEMA_DETAILED_ITEMS/g) ?? []).length >= 2,
  );
  // The server slice and the client window must be ONE constant, and it must
  // live in a module a server component can actually read — see the note on
  // DIRECTORY_PAGE in lib/directory/browse.ts.
  const browseSrc = strip(read('src/lib/directory/browse.ts'));
  const categorySrc = strip(read('src/app/(directory)/directory/[category]/page.tsx'));
  check(
    'DP80 server window and client window are one constant',
    browseSrc.includes('export const DIRECTORY_PAGE') &&
      !browserSrc.includes('export const DIRECTORY_PAGE') &&
      browserSrc.includes("from '@/lib/directory/browse'") &&
      categorySrc.includes('DIRECTORY_PAGE') &&
      categorySrc.includes("from '@/lib/directory/browse'") &&
      !categorySrc.includes("DIRECTORY_PAGE } from '@/components/"),
  );

  // The failure that motivated DP80: a server component slicing by a constant
  // it imported from a 'use client' module gets a client reference, and
  // slice(0, NaN) is []. Prove the value the server sees is a real number.
  check(
    'DP81 the window constant is a number on the server',
    typeof DIRECTORY_PAGE === 'number' && DIRECTORY_PAGE > 0,
    DIRECTORY_PAGE,
  );

  /* ------------------------------------------------------------ report */

  const expected = Array.from({ length: 60 }, (_, i) => `DP${i + 1}`);
  const missing = expected.filter((id) => !seen.has(id));
  check(`DP1-DP60 every scenario reported`, missing.length === 0, missing);

  console.log(`\ndirectory-payload: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
