# Directory Pages + Rendering — Architecture Audit (commit 881fb07)

All paths relative to `/home/user/tlws-platform`. Files read end-to-end: all 19 `page.tsx` files under `src/app/(directory)/directory/`, the 7 assigned components, plus the data layer (`src/lib/directory/data.ts`), browse/detail/seo/ranking helpers, and `src/lib/community/data.ts` where pages call into it.

**Route-group layout:** there is no `src/app/(directory)/layout.tsx` — only `src/app/layout.tsx` (root) and `src/app/(academy)/layout.tsx` exist, so every directory page renders under the root layout with no group-level shared data fetch.

## Page taxonomy (route, segment config, generateStaticParams size, data calls)

Every page exports `export const revalidate = 300` and nothing else (no `dynamic`, no `fetchCache`, no `dynamicParams` override — `dynamicParams` deliberately left at the default `true`, documented as a Netlify-purge workaround at `src/app/(directory)/directory/[category]/page.tsx:50-54`). All data reads go through the cookieless anon Supabase client `createStaticClient()` (`src/lib/supabase/static.ts:8-14`); reviews/aggregates use the admin client (`src/lib/community/data.ts:106,134`).

| Route | Config | generateStaticParams | Data calls at render (build & each ISR regen) |
|---|---|---|---|
| `/directory` (hub) | ISR 300 (`page.tsx:33`) | static route | `getDirectoryFacets()` (`page.tsx:42`) — 1 query |
| `/directory/[category]` — 3 page kinds in one segment: 8 engine categories, states, interstates (`[category]/page.tsx:65-79`) | ISR 300 (`:58`) | 8 `ENGINE_CATEGORIES` (`src/lib/directory/categories.ts:133`, 9 minus parking's `customHref`) + all states-with-data + interstates-with-data via `getDirectoryFacets()` (`:81-95`) | category branch: `getEntries` + `getDirectoryFacets` (`:133`) + `listingListSchemaWithReviews` → 2 review queries (`src/lib/directory/seo.ts:145-148`); state branch adds `buildFaqs`; interstate branch same + exit chips from facets (`:257,310`). `SponsorSlot` adds 1 `directory_sponsors` query on state/interstate (`src/components/directory/SponsorSlot.tsx:15`); `CatScaleFastFind` (cat-scales only) adds `getCatScaleFacets()` (`CatScaleFastFind.tsx:13`) |
| `/directory/[category]/[exit]` | ISR 300 (`[exit]/page.tsx:47`) | every (interstate, exit) pair in facets (`:49-61`) — data-dependent, unbounded | `resolveExit` → `getDirectoryFacetsResult` (`:81`); page `Promise.all`: `getEntriesByExitResult` + `getEntriesByInterstateResult` + `getDirectoryFacetsResult` (`:131-135`); + `listingListSchemaWithReviews` (`:155`). **generateMetadata independently re-runs `resolveExit` + `getEntriesByExitResult` (`:98,103`)** — see Caches |
| `/directory/[category]/truck-parking` (interstates only) | ISR 300 (`truck-parking/page.tsx:30`) | interstates in facets (`:49-55`) | `getEntriesByInterstate` + `getDirectoryFacets` (`:73-76`); parking filter + grouping in render (`:77-97`) |
| `/directory/[category]/top-truck-stops` (states only) | ISR 300 (`top-truck-stops/page.tsx:30`) | states in facets (`:38-44`) | `getEntriesByState` + `getDirectoryFacets` + `getReviewAggregates` (limit 10000 rows, aggregated in JS — `src/lib/community/data.ts:132-157`) (`:62-66`); `topRanked(..., limit 25)` (`:71`) |
| `/directory/location/[slug]` | ISR 300 (`location/[slug]/page.tsx:59`) | `getPublishedDetailSlugs()` — up to 5000 slugs (`:66-69`, `data.ts:390-408`) | `getEntry` (React-`cache`d, `:61`) shared with metadata; then `Promise.all`: `getEntriesByState` (≤1000 rows) + `getEntriesByInterstate` (≤1000) + `getApprovedReviewsForLocation(10)` + `getReviewStatsForLocation` (`:140-145`); `SponsorSlot` query (`:452`) |
| `/directory/parking` | ISR 300 (`parking/page.tsx:16`) | static route | `getEntries('parking')` + `getDirectoryFacets` + `getParkingFacets` (`:77-81`) + `listingListSchemaWithReviews` (2 review queries, `:82`) |
| `/directory/parking/[state]` | ISR 300 (`:9`) | **none** — all on-demand ISR | `getParkingFacets()` (5000-row scan, `data.ts:565-607`) |
| `/directory/parking/[state]/[interstate]` | ISR 300 (`:8`) | none | zero DB calls — pure registry lookups |
| `/directory/parking/[state]/[interstate]/[direction]` | ISR 300 (`:14`) | none | `getParkingCorridorEntries` (`data.ts:546-551`) |
| `/directory/cat-scales/near-me` | ISR 300 (`near-me/page.tsx:13`) | static route | `getCatScaleMapEntries` (≤3000 rows) + `getEntriesWithCoordinates()` (≤2000 rows, **all categories**) + `getCatScalePublishedCount` (`:29-33`) |
| `/directory/cat-scales/[state]` | ISR 300 (`:9`) | none | `getCatScaleFacets()` |
| `/directory/cat-scales/[state]/[interstate]` | ISR 300 (`:8`) | none | zero DB calls |
| `/directory/cat-scales/[state]/[interstate]/[direction]` | ISR 300 (`:14`) | none | `getCatScaleCorridorEntries` |
| `/directory/map` | ISR 300 (`map/page.tsx:25`) | static route | `getEntriesWithCoordinates()` (≤2000 full rows) + `getDirectoryFacets` (`:28`) |
| `/directory/recently-updated` | ISR 300 (`:18`) | static route | `getRecentlyUpdated(60)` (`:43`) |
| `/directory/new-locations` | **declares ISR 300 (`:16`) but reads `searchParams` (`:43-47`)** → dynamically rendered per request in Next 14; revalidate is inert here | n/a | `getNewestListings(PAGE_SIZE+1, offset)` per request (`:52`) |
| `/directory/reviews` | ISR 300 (`:18`) | static route | `getListingRefs()` (≤2000) + `getRecentApprovedReviews(20)` |
| `/directory/submit` | ISR 300 (`:17`) | static route | `getListingRefs()` (≤2000) |

Entries per page: all list reads are hard-capped at `limit(1000)` (`data.ts:213`), coordinates at 2000 (`data.ts:349`), cat-scale map at 3000 (`data.ts:645`). Category/state/interstate pages therefore render up to 1000 `EntryCard`s' worth of data server-side; the client browsers paint 30 initially (`DirectoryBrowser.tsx:22`) or 12 per group section (`MultiCategoryBrowser.tsx:23`).

## Server→client boundary inventory (component, props size class)

`'use client'` inventory in scope: `DirectoryBrowser`, `MultiCategoryBrowser`, `CorridorFlow`, `CatScaleFlow`, `CatScaleNearMe`, `DirectoryEvents`, `ListingFunnelCtas`, `ReportParkingSheet`, `TpcReserveCta`, `ViewBeacon`, plus `map/MapExplorer|MapPreview|MapCanvas|LeafletMap` and `community/ReviewForm|SubmitLocationForm|LocationPicker|Fields|StarRatingInput`. Server-only (no directive): `EntryCard`, `CategoryCardGrid`, `NearbySections`, `DetailNearbySections`, `DirectoryHero`, `FaqSection`, `RelatedLinks`, `SponsorSlot` (async), `CatScaleFastFind` (async), `GetFeaturedCta`, `DirectoryEmptyState`, `OfferTable`. Note `EntryCard` and `DirectoryEmptyState` are imported by the client browsers (`DirectoryBrowser.tsx:8-9`, `MultiCategoryBrowser.tsx:8-9`), so they ship in the client bundle and their instances inside browsers are client-rendered.

| Client component | Props crossing boundary | Size class |
|---|---|---|
| `DirectoryBrowser` (`DirectoryBrowser.tsx:24-30`) | `entries: DirectoryEntry[]` — full objects incl. `description`, amenities, timestamps; ≤1000 | **LARGE** (serialized into RSC payload/flight data on category + parking pages) |
| `MultiCategoryBrowser` (`MultiCategoryBrowser.tsx:74-86`) | `entries: DirectoryEntry[]` ≤1000 (state/interstate pages; exit pages small) | **LARGE** |
| `MapExplorer` (`MapExplorer.tsx:63-75`, fed at `map/page.tsx:62-67`) | `entries` ≤2000 full `DirectoryEntry` + facet arrays | **VERY LARGE** |
| `CatScaleNearMe` (`CatScaleNearMe.tsx:35-45`, fed at `near-me/page.tsx:68`) | `scales` ≤3000 + `searchPool` ≤2000 **full entries of all categories, used only to geocode a typed city/ZIP** (`:81`) | **VERY LARGE** — largest boundary in the subsystem |
| `CorridorList` (`CorridorFlow.tsx:116-126`) | corridor-scoped entries (one state × one interstate × parking categories) | Small–medium |
| `CatScaleCorridorList` | same shape | Small–medium |
| `ReviewForm` / `SubmitLocationForm` (reviews/submit pages) | `listings: ListingRef[]` ≤2000 slim refs (`community/data.ts:25-36`) | Medium (slim shape — the right pattern) |
| `DirectoryEvents`, `ListingFunnelCtas` (`location/[slug]/page.tsx:463,465`) | bounded `listingCtx` (6 scalar fields, `:129-136`) | Tiny |
| `ViewBeacon` (`:462`) | `id` string | Tiny |
| `MapPreview` (`:403`) | lat/lng/name | Tiny |
| `TpcReserveCta`, `ReportParkingButton` | strings | Tiny |

A second page-weight channel besides props: `listingListSchemaWithReviews` inlines JSON-LD `ItemList` with a full `listingSchema` per indexable entry plus up to 3 reviews each (`src/lib/directory/seo.ts:114-134,140-150`) into the HTML of category/state/interstate/exit/parking pages.

## Caches

- **Only cache in the subsystem:** React `cache()` around `getEntryByDetailSlug` on the location detail page (`location/[slug]/page.tsx:61`), deduping generateMetadata vs page. **Nothing else is request-memoized**: no `unstable_cache`, no other `cache()` anywhere in `src/lib/directory/` or `src/lib/community/` (verified by grep).
- **Consequence (VERIFIED duplication per regeneration):** on `/directory/[category]/[exit]`, `getDirectoryFacetsResult()` runs 3× (metadata's `resolveExit` at `:98→:81`, page's `resolveExit` at `:121→:81`, page's `Promise.all` at `:134`) and `getEntriesByExitResult` runs 2× (`:103` and `:132`). Supabase-js requests carry an `Authorization` header, and whether Next 14's fetch data-cache dedupes them is a HYPOTHESIS needing measurement; there is no code-level dedupe.
- **ISR is the effective cache:** every route is `revalidate = 300`, plus admin actions call `revalidatePath` (10 admin action files, e.g. `src/app/admin/(dashboard)/directory/actions.ts`). Client browsers do zero fetching — "Pure display over data the server already fetched" (`MultiCategoryBrowser.tsx:16`).
- **Exception:** `/directory/new-locations` reads `searchParams` (`new-locations/page.tsx:43-47`) → dynamic rendering; its `revalidate = 300` (`:16`) has no effect, so every hit (including bot crawls of `?page=N` up to `MAX_PAGE=50`, `:19`) runs a live Supabase query. Bounded but uncached.

## Failure modes

- **Fail-soft-to-empty everywhere except exit pages.** All list reads collapse errors to `[]` (`data.ts:222-226,298,322,352`), facets to `EMPTY_FACETS` (`data.ts:442-445`). A DB outage during an ISR regeneration therefore caches a *plausible-looking empty page* ("locations are being verified and loaded") for up to 300s on category/state/interstate/parking/map/top-truck-stops routes — an outage is indistinguishable from no data. VERIFIED code behavior; user impact is hypothesis.
- **Exit pages are the only route with the empty-vs-error distinction** (`data.ts:117-190`, `[exit]/page.tsx:125-146`), added after a documented production incident: a failed facet read collapsed to `[]` → `notFound()` → **ISR-cached 404** on `/directory/i75/exit-369` while 11 published rows existed (`data.ts:118-131`). The same collapse-to-404 remains structurally possible on `location/[slug]` (fail-soft `getEntryByDetailSlug` returning `null` on a DB error → `notFound()` at `:114-121`, cached by ISR) — VERIFIED code path, same shape as the incident.
- **`dynamicParams` locked to `false` previously caused Netlify to serve 404s after `revalidatePath` purges** — reproduced twice in production, hence the `true` default is load-bearing (`[category]/page.tsx:50-54`).
- **Build-time fail-soft is intentional:** `generateStaticParams` on a DB-unreachable build prerenders nothing and defers to on-demand ISR (`[exit]/page.tsx:50-53`, `data.ts:437-441`), never failing the build — but the first post-deploy requests then all miss.
- `generateMetadata` on exit pages never throws and never decides status (`[exit]/page.tsx:99-101`); the page component does.

## Bottleneck candidates

1. **VERIFIED — `/directory/cat-scales/near-me` serializes ≤5000 full entries to the client** (`near-me/page.tsx:29-33,68`): `scales` (≤3000, `data.ts:645`) + `searchPool` = *all-category* `getEntriesWithCoordinates()` (≤2000, `data.ts:349`), the latter used solely as a geocoding lookup (`CatScaleNearMe.tsx:81`). At current data volume this is the largest single flight payload in the subsystem. Actual byte size = HYPOTHESIS, needs measurement.
2. **VERIFIED — `/directory/map` serializes ≤2000 full entries** into `MapExplorer` props (`map/page.tsx:28,62-67`), including `description` text that the map UI may not need per pin.
3. **VERIFIED — exit-page query amplification:** 3× facets (a 5000-row scan aggregated in JS each time, `data.ts:451-498`) + 2× exit entries per regeneration (citations above). Cheap fix is `React.cache` on `getDirectoryFacetsResult`/`selectEntriesResult`.
4. **VERIFIED — JSON-LD `ItemList` embeds full per-entry schema + up to 3 reviews each for every indexable entry** on category/state/interstate/parking/exit pages (`seo.ts:128-133,72-78`) — HTML weight scales linearly with catalog size with no cap (only the `limit(1000)` query cap).
5. **VERIFIED — review-schema queries scan whole tables per page render:** `getReviewAggregates` pulls up to 10,000 rating rows and aggregates in JS (`community/data.ts:132-157`), `getApprovedReviewsForSeo` up to 2,000 rows (`:174-207`) — run on every category/state/interstate/exit/parking regeneration, and duplicated across those routes with no shared cache.
6. **VERIFIED — O(state×corridor) dedupe on every listing detail regeneration:** `corridorPool.filter((c) => !statePool.some(...))` (`location/[slug]/page.tsx:146`) is O(n·m) over two ≤1000-entry pools, followed by `nearbySections` ranking the merged pool (`detail.ts:115-144`). With ≤5000 detail pages × per-page state+corridor reads, full-site revalidation cost scales as pages × pool size. Wall-clock impact = HYPOTHESIS.
7. **HYPOTHESIS — client filter cost on large categories:** `filterAndSortEntries` rebuilds the `haystack` string for every entry on every keystroke-settled memo run (`browse.ts:35-66`; memoized only on input identity, `DirectoryBrowser.tsx:46-49`). At the 1000-entry cap this is likely fine; worth profiling before optimizing.
8. **VERIFIED (minor) — uncached derived work in client render:** `CorridorList` re-runs `buildCorridorList(entries)` and re-reverses on every render/toggle without `useMemo` (`CorridorFlow.tsx:128-129`); `MultiCategoryBrowser` recomputes `featured` unmemoized (`:108`); `truck-parking` page loops `parking.filter` once per chip type (`truck-parking/page.tsx:91-94`). All small-n; correctness fine.
9. **No unkeyed lists found** — every `.map` in the audited files carries a stable key (`e.id`, slug, code, or label).

## Simplification opportunities

- **Wrap `getDirectoryFacets`/`getDirectoryFacetsResult`, `getReviewAggregates`, `getApprovedReviewsForSeo`, `getEntriesByExitResult` in `React.cache()`** — mirrors the pattern already used at `location/[slug]/page.tsx:61`, eliminates all intra-request duplication with zero behavior change.
- **Slim the `searchPool` prop of `CatScaleNearMe`** to `{city,state,zip,lat,lng}` (the only fields `searchLocation` can need) — or geocode server-side via a route handler. Same for `MapExplorer`: a map-pin projection (id, name, lat/lng, category, detailSlug, a few chips) instead of full `DirectoryEntry`.
- **`/directory/new-locations` pagination via path segments** (`/new-locations/page/2` with `generateStaticParams`) or accept dynamic and drop the misleading `revalidate` — currently the only directory route that hits the DB per-request.
- **Duplicate direction-picker and state-picker pages:** `parking/[state]/*` and `cat-scales/[state]/*` are near-identical files (same `DIRECTION_ARROWS`, same structure — `parking/[state]/[interstate]/page.tsx` vs `cat-scales/[state]/[interstate]/page.tsx`); one parameterized component/route factory would halve the surface.
- **Cap or sample `ItemList` JSON-LD** on large list pages (e.g. first N indexable entries) to bound HTML weight.
- **`DirectoryBrowser` vs `MultiCategoryBrowser` overlap:** both implement search + featured-first + `EntryCard` grids over `filterAndSortEntries`; a shared core with grouping/sorting plugins would remove ~200 duplicated lines.

## Open questions

1. Does Next 14's fetch data-cache actually dedupe/cache supabase-js requests (Authorization header present) within a render, and across ISR windows? Needs a trace — determines whether the exit-page 3× facets read is 3 network round-trips or 1.
2. Real row counts today (locations, approved reviews): all caps (1000/2000/3000/5000/10000) are generous; whether any are near saturation decides whether the LARGE boundaries are a present or future problem, and when `limit(1000)` starts silently truncating a big state/category page.
3. Measured flight-payload sizes for `/directory/map` and `/directory/cat-scales/near-me` (bench scripts exist under `scripts/bench/**` on this branch — outside audit target).
4. ISR cache topology on Netlify: is `revalidate = 300` per-node or shared? Affects both the DB regeneration load (facets scan per route per 300s per node) and how long a fail-soft empty page can persist.
5. `generateStaticParams` for `[exit]` is unbounded in exits-with-data; at what catalog size does build-time prerender of all exit pages (each doing 3 facet reads + entries + corridor + 2 review scans) dominate build time?