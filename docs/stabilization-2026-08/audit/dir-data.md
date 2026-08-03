All files read end-to-end and callers traced. Here is the deliverable.

# Directory Data Layer (queries) — Architecture Audit

Audit target: commit 881fb07 (`origin/main`; working tree `src/` identical). Row scale: ~2,454 published locations, truck-stops ~1,882 (corroborated in-repo by PR #216's branch comment, `claude/directory-complete-read-pagination:src/lib/directory/data.ts:215-222`: "truck-stops category holds 1,882 published rows (882 dropped) … unfiltered sitemap read covers 2,454, of which 2,439 pass the indexability gate").

## Architecture

- **One fetch module.** All public directory Supabase reads live in `src/lib/directory/data.ts`, plus one RPC wrapper in `src/lib/directory/nearby.ts:67-99`. Every read uses the cookieless anon client created fresh per call (`src/lib/supabase/static.ts:8-14`); RLS (published + not-deleted) is the enforcement boundary (`data.ts:9-13`).
- **Everything else in the assigned set is pure.** `browse.ts` (client-side search/sort), `corridor.ts` (route-position engine), `detail.ts` (nearby ranking + indexability gate), `related.ts` (exit-window nearby), `ranking.ts` (deterministic scoring), `colocation.ts` (duplicate-pair classification, admin-side), `completeness.ts` (scoring), `states.ts`/`interstates.ts` (static registries), `types.ts` (shapes). None of them issue queries — they post-process arrays fetched by pages.
- **Fetch pattern:** pages fetch broad slices (a whole category, state, or corridor, all 33 `COLUMNS`, `data.ts:108-113`), then filter/sort/rank in Node memory and often serialize the full slice into client components (`DirectoryBrowser`, `MapExplorer`, `CatScaleNearMe`). SQL does equality filters only; all ranking, grouping, faceting, windowing is in-memory.
- **Empty-vs-error contract** (2026-07-30): `selectEntriesResult`/`getDirectoryFacetsResult` report `query_error`/`unavailable` distinctly so 404-gating pages (exit page) don't turn a DB blip into a cached 404 (`data.ts:117-190`); fail-soft `[]` wrappers remain for render-only callers (`data.ts:222-226`).

## Query inventory

All on table `public.locations` unless noted. "COLUMNS" = the 33-column list at `data.ts:108-113`.

| # | Function (data.ts) | Columns | Filters | Order | Limit / count | Callers (pages) |
|---|---|---|---|---|---|---|
| 1 | `selectEntriesResult` (`:199-220`) base for `getEntries`, `getAllPublishedEntries`, `getEntriesByState`, `getEntriesByInterstate`, `getEntriesByExit` + `*Result` variants (`:228-280`) | COLUMNS | `is_published=true`, `deleted_at is null`, + dynamic eq filters | `is_featured desc, name asc` | `.limit(1000)`, no count | `[category]/page.tsx:133,183,254` (category/state/interstate pages); exit page `[category]/[exit]/page.tsx:103,132-133` (Result variants); `location/[slug]/page.tsx:141-142` (state+interstate pools); `top-truck-stops/page.tsx:63`; `truck-parking/page.tsx:74`; `parking/page.tsx:78`; `sitemap.ts:300` (`getAllPublishedEntries`) |
| 2 | `getRecentlyUpdated` (`:287-303`) | COLUMNS | published, not deleted, `updated_at not null` | `updated_at desc` (no tiebreaker) | `.limit(clamp 1-200)` | `recently-updated/page.tsx:43` (limit 60) |
| 3 | `getNewestListings` (`:310-327`) | COLUMNS | published, not deleted | `created_at desc, nullsFirst:false` (no tiebreaker) | `.range(offset, offset+limit-1)`, limit clamp 100 | `new-locations/page.tsx:52` (PAGE_SIZE+1, offset paging) |
| 4 | `getEntriesWithCoordinates` (`:334-355`) | COLUMNS | published, not deleted, `lat/lng not null`, optional category/state/interstate eq | `name asc` | `.limit(2000)` | `map/page.tsx:28`; `cat-scales/near-me/page.tsx:31` (unfiltered, as `searchPool`); `lib/map/data.ts:99` (`getMapDataset`) |
| 5 | `getEntryByDetailSlug` (`:363-379`) | COLUMNS | published, not deleted, `detail_slug eq` | none | `.limit(1).maybeSingle()` | `location/[slug]/page.tsx:61` (React-`cache`d, metadata + page) |
| 6 | `getPublishedDetailSlugs` (`:390-408`) | `detail_slug, updated_at` | published, not deleted, `detail_slug not null` | **none** | `.limit(5000)` | `location/[slug]/page.tsx:67` (generateStaticParams) |
| 7 | `getDirectoryFacetsResult` (`:448-498`) | `state, interstate, exit_number` | published, not deleted | **none** | `.limit(5000)` | Hub `directory/page.tsx:42`; `[category]/page.tsx:85,133,184,255`; exit page ×3 per render (`[exit]/page.tsx:53,81,134`); `map/page.tsx:28`; `top-truck-stops:39,64`; `truck-parking:50,75`; `parking/page.tsx:79`; `sitemap.ts:249` |
| 8 | `getCorridorEntriesForCategories` (`:518-540`) → `getParkingCorridorEntries`, `getCatScaleCorridorEntries` | COLUMNS | published, not deleted, `state eq`, `interstate eq`, `category_slug in (…)` | `name asc` | `.limit(1000)` | `parking/[state]/[interstate]/[direction]/page.tsx:39`; `cat-scales/[state]/[interstate]/[direction]/page.tsx:38` |
| 9 | `getRouteFacetsForCategories` (`:565-607`) → `getParkingFacets`, `getCatScaleFacets` | `state, interstate, category_slug` | published, not deleted, `category_slug in (…)` | **none** | `.limit(5000)` | `parking/page.tsx:80`; `parking/[state]/page.tsx:27`; `cat-scales/[state]/page.tsx:27`; `CatScaleFastFind.tsx:13` (rendered inside `/directory/cat-scales`, `[category]/page.tsx:162`) |
| 10 | `getCatScaleMapEntries` (`:633-651`) | COLUMNS | published, not deleted, `category_slug in ('cat-scales')`, lat/lng not null | `name asc` | `.limit(3000)` | `cat-scales/near-me/page.tsx:30` |
| 11 | `getCatScalePublishedCount` (`:654-668`) | `id`, `count:'exact', head:true` | published, not deleted, cat-scales | — | head count | `cat-scales/near-me/page.tsx:32` |
| 12 | `getNearbyListings` (`nearby.ts:67-99`) | RPC `nearby_locations` (migration 021) | lat/lng/radius/category | nearest-first (in RPC) | RPC-capped 100 rows / 500 mi | `api/directory/nearby/route.ts:31` (POST, rate-limited 30) |

Adjacent reads pulled in by directory pages (context, table `location_reviews`, admin client): `getReviewAggregates` — `location_id, rating`, `status='approved'`, **no order**, `.limit(10000)` (`src/lib/community/data.ts:132-157`); `getApprovedReviewsForSeo` — 6 cols, ordered `created_at desc`, `.limit(2000)` (`:174-204`). Both run via `listingListSchemaWithReviews` (`src/lib/directory/seo.ts:140-150`) on every category/state/interstate/exit page render. Detail page adds per-location `getApprovedReviewsForLocation` (limit 10) and `getReviewStatsForLocation` (unordered `.limit(10000)`) (`community/data.ts:214-258`).

Per-render query counts (VERIFIED from page code):
- **Exit page** `/directory/i75/exit-201`: facets ×3 (metadata `resolveExit` at `[exit]/page.tsx:98→81`, page `resolveExit` at `:121`, page `Promise.all` at `:134`), exit entries ×2 (`:103` and `:132`), full corridor read ×1 (`:133`), plus 2 review-table scans (`:155` → `seo.ts:145-149`) = **8 queries**, five of which scan the whole published table or corridor.
- **Detail page**: 1 (cached entry) + state pool + corridor pool + 2 review queries = 5 (`location/[slug]/page.tsx:140-145`).
- **`/directory/cat-scales`**: `getEntries('cat-scales')` + facets + `getCatScaleFacets` (duplicate scan of the same cat-scales rows) + 2 review scans = 5.
- **`/directory/cat-scales/near-me`**: cat-scale entries + ALL coordinate entries + head count = 3, with both entry sets serialized to the client (`near-me/page.tsx:29-33,68`).

## Caches

- **ISR only.** Every directory route sets `export const revalidate = 300` (e.g. `[category]/page.tsx:58`, `[exit]/page.tsx:47`, `location/[slug]/page.tsx:59`, `map/page.tsx:25`). `dynamicParams` stays true deliberately (Netlify purge bug, `[category]/page.tsx:50-54`).
- **The only request-scoped memo is** `cache(getEntryByDetailSlug)` on the detail page (`location/[slug]/page.tsx:61`), deduping metadata + page. No other data function is wrapped in React `cache()` — hence the exit page's triple facet read.
- **No module-level or cross-request cache** exists in the data layer on main. PR #216's branch adds build-phase memoization (`memoizeDuringBuild`, branch file) — not merged.
- HYPOTHESIS: Next 14 (`next ^14.2.35`, `package.json`) patches global fetch and memoizes identical GETs within a render pass; supabase-js 2.45 select() is a GET through global fetch, so some of the duplicate reads (e.g. the two identical facet GETs) may be deduped/data-cached transparently. Needs measurement — do not rely on it, and the interaction with admin `revalidatePath()` purges is unverified.

## Failure modes

- **Silent truncation is the headline defect.** `selectEntriesResult`'s `.limit(1000)` is binding today: `getEntries('truck-stops')` drops ~882 of 1,882 rows (`data.ts:213`; measured note in PR #216 branch `data.ts:218-221`), and `getAllPublishedEntries()` (same cap) feeds the sitemap (`sitemap.ts:300`) — ~1,439 indexable detail URLs missing. A truncated read is neither an error nor empty, so the empty-vs-error contract can't see it (PR #216 branch `data.ts:232-236`).
- **Unordered LIMIT = arbitrary sample.** `getPublishedDetailSlugs` (`data.ts:393-399`), `getDirectoryFacetsResult` (`:451-456`), `getRouteFacetsForCategories` (`:568-574`) have `.limit(5000)` with no ORDER BY. Not binding at 2,454 rows, but the day they bind the loss is arbitrary — and facets decide which exit/state pages exist at all (`[exit]/page.tsx:86-89` turns a missing facet exit into 404).
- **Unstable pagination sort.** `getNewestListings` orders by `created_at desc` with no unique tiebreaker and paginates by `.range()` (`data.ts:320-321`). Bulk imports share timestamps, so page N and N+1 can duplicate/skip rows (VERIFIED absence of tiebreaker; skew magnitude is data-dependent).
- **Fail-soft `[]` still hides errors** on render-only paths: category/state/interstate pages render "no listings" hero copy on a DB outage (`selectEntries` → `[]`, `data.ts:223-226`; `[category]/page.tsx:219` prints "being verified and loaded"). Only exit pages use the strict Result contract.
- **`maybeSingle` on `detail_slug`** with no order (`data.ts:371-373`) — safe only while `detail_slug` is unique (migration 022 per `types.ts:66`).
- **RPC path is well-capped**: `nearby_locations` re-clamps radius/limit server-side (`nearby.ts:7-13,74-76`), invalid origins return `[]` (`nearby.ts:68`).

## Bottleneck candidates

1. **VERIFIED — exit-page fan-out.** 8 queries per revalidation, including 3 identical full-table facet scans and a full-corridor COLUMNS read used only for a ±25-exit window (`[exit]/page.tsx:98,121,131-135,152`; window logic `related.ts:34-55`). The corridor read for I-75 pulls every corridor row with description/amenities to render at most a handful of nearby cards.
2. **VERIFIED — detail-page pool overfetch.** Each detail page fetches its whole state + whole corridor with full COLUMNS (`location/[slug]/page.tsx:140-146`) to build ≤4-card nearby sections (`detail.ts:25,115-144`). At GA/TN row counts this approaches the 1000 cap per pool; could be one `nearby_locations` RPC call (already exists, migration 021) or a trimmed column list.
3. **VERIFIED — review scans discarded.** `listingListSchemaWithReviews` runs two `location_reviews` scans per category/state/interstate/exit render (`seo.ts:145-149`), but `listingListSchema` filters `entries.filter((e) => e.indexable)` (`seo.ts:120`) and code comments state `locations.is_indexable` is false on every current row (`ranking.ts:163-165`, `detail.ts:158`). If the comments are accurate (DB-state HYPOTHESIS), the ItemList is always `null` and both review scans are wasted on every list page.
4. **VERIFIED — client payload, not DB, is the map/near-me cost.** `map/page.tsx:62-63` and `cat-scales/near-me/page.tsx:68` serialize up to 2,000+ full `DirectoryEntry` objects into the RSC payload; `searchPool` is used only to resolve city/ZIP → coordinates (`CatScaleNearMe.tsx:81`), needing 5 of the 30+ fields. Same for `DirectoryBrowser` on `/directory/truck-stops` (1,882 rows, minus the 882 the cap eats).
5. **HYPOTHESIS — in-memory faceting scales fine but repeats.** `getDirectoryFacets` fetches 2,454 × 3-column rows and aggregates in JS on essentially every directory render (`data.ts:451-493`); a SQL `GROUP BY` view/RPC would cut transfer ~50× and drop the 5000-cap risk. At current scale the wall-clock cost is probably network RTT, not CPU — measure before optimizing.
6. **VERIFIED — index support is adequate**: `locations_pub_cat_featured` (`019_directory_bulk.sql:33`), `locations_interstate` (`:29`), `locations_created_at` (`:31`), coords partial index (`021:17`), corridor position index (`047:78`). At 2,454 rows nothing here is a Postgres-side bottleneck.

## Unordered/capped reads NOT fixed by PR #216

PR #216 (branch `claude/directory-complete-read-pagination`) converts to keyset pagination: `selectEntries*`, `getEntriesWithCoordinates`, `getPublishedDetailSlugs`, `getDirectoryFacets`, `getRouteFacets` (branch file lines ~494, 656, 726, 810, 965). Reads with the same latent defect it does NOT touch:

1. **`getCorridorEntriesForCategories` — `.limit(1000)`** (`data.ts:534`; still `.limit(1000)` at branch line 898). Ordered by name, so truncation would silently drop the alphabetical tail of a state+corridor parking list. Not binding today; latent.
2. **`getCatScaleMapEntries` — `.limit(3000)`** (`data.ts:645`; branch line 1042 unchanged). The near-me search pool would silently lose scales past 3,000.
3. **`getNewestListings`** — `.range()` over non-unique `created_at` (`data.ts:320-321`): skip/duplicate across pages on timestamp ties; needs an `id` tiebreaker regardless of pagination style.
4. **`getRecentlyUpdated`** — `updated_at desc` without tiebreaker (`data.ts:296`): nondeterministic tail within the 60-row window when timestamps tie (bulk updates do this).
5. **`getReviewAggregates` — unordered `.limit(10000)`** (`community/data.ts:135-139`): the aggregate-rating source for every list page becomes an arbitrary sample past 10k approved reviews.
6. **`getApprovedReviewsForSeo` — `.limit(2000)`**, ordered but no tiebreaker (`community/data.ts:177-182`).
7. **`sitemap.ts` knowledge-center reads — no `.limit()` at all** (`sitemap.ts:316-331`); they fall to PostgREST's server default max-rows (typically 1000), and `kc_categories`/`kc_articles` are unordered — silent, arbitrary sitemap truncation at scale.

## Simplification opportunities

- **Wrap the hot readers in React `cache()`** (`getDirectoryFacetsResult`, `getEntriesByExitResult`) — removes the exit page's 3×/2× duplicate reads with a one-line change each, independent of PR #216 (`[exit]/page.tsx:81,121,134`).
- **Facets as a SQL view/RPC** (`GROUP BY state / interstate / exit_number`) replaces four in-memory aggregators (`data.ts:448-498,565-607`) and removes cap risk permanently.
- **Deduplicate the parking-category constant**: `PARKING_FLOW_CATEGORIES` (`data.ts:511`) vs `PARKING_CATEGORIES` (`corridor.ts:31`) vs another local `PARKING_CATEGORIES` set (`truck-parking/page.tsx:33`, `completeness.ts:31`) — same list, four declarations, drift-prone.
- **Drop `overnight_parking` from `COLUMNS`** — selected (`data.ts:110`) and typed (`:33`) but never read by `toEntry` (`:62-106`); the legacy boolean is explicitly banned from claims (`corridor.ts:16-17`). One column of pure overfetch on every read.
- **Slim `searchPool`** on near-me to `{city,state,zip,lat,lng}` (`CatScaleNearMe.tsx:81` is its only consumer) and derive the cat-scale facet block on `/directory/cat-scales` from the already-fetched entries instead of the extra `getCatScaleFacets` scan (`CatScaleFastFind.tsx:13`).
- **Gate `listingListSchemaWithReviews`** behind `entries.some(e => e.indexable)` before issuing its two review scans (`seo.ts:140-150`) — or switch the filter to `isDetailIndexable` to match the sitemap's gate, which is what the comments say was intended (`ranking.ts:160-166`).

## Open questions

1. Does Next 14's patched-fetch memoization/data cache actually dedupe identical supabase-js GETs in this deployment (Netlify runtime)? Determines how much of the exit-page fan-out is real round trips. Needs a request-count measurement (the `scripts/bench` mock-PostgREST harness on the working branch looks purpose-built for this).
2. How many published rows currently carry coordinates? If > 2,000, `getEntriesWithCoordinates`'s cap (`data.ts:349`) is already binding on the map and near-me pools (PR #216 branch says "NOT binding at this row count" as of 2026-07-31 — re-verify after recent import batches).
3. Is `locations.is_indexable` still false on every row (comments at `ranking.ts:163-165`)? If yes, every ItemList JSON-LD on list pages is dead code and finding #3 above applies in full.
4. The `/directory/i75/exit-369` cached-404 root cause is explicitly still unidentified (PR #216 branch `data.ts:226-230`) — neither the empty-vs-error contract nor pagination explains it; the Netlify ISR/revalidatePath interaction (`[category]/page.tsx:50-54`) remains the untested suspect.
5. Per-state row counts (GA/TN post-import) vs the 1000 cap for `getEntriesByState` — the detail-page nearby pool and state pages truncate next wherever a state crosses 1,000 published rows.