All reads and grep verifications are complete. Here is the report.

---

# Directory Support Layer — Audit Report

Scope: `src/lib/directory/{seo,faq,categories,amenities,offers,sponsors,sponsors-data,placements,trust,funnel,tpc,scope-links,redirects,detail-slug,parking-disclosure,issues}.ts` at commit 881fb07 (working tree src/ identical to origin/main). All 16 files read end-to-end.

## Per-module role table

| Module | Pure / DB | Callers (representative) | Per-request cost |
|---|---|---|---|
| `seo.ts` (150 ln) | Pure builders + **one async DB wrapper** `listingListSchemaWithReviews` (seo.ts:140–150) which awaits `getReviewAggregates()` + `getApprovedReviewsForSeo()` from `@/lib/community/data` (seo.ts:145–148) | List pages: `[category]/page.tsx:134,188,260`, `[category]/[exit]/page.tsx:155`, `parking/page.tsx:82`; plain `listingListSchema` on `new-locations/page.tsx:55`, `recently-updated/page.tsx:44`, `top-truck-stops/page.tsx:73`, `truck-parking/page.tsx:99`; `listingDetailSchema` on `location/[slug]/page.tsx:258` | Pure part: O(n) map over indexable entries (seo.ts:120,128). DB part: **2 unscoped queries per page regeneration** — `location_reviews` `status='approved'` ratings, `.limit(10000)` (community/data.ts:135–139) and full approved reviews ordered by `created_at` desc, `.limit(2000)` (community/data.ts:177–182), both via `createAdminClient`, both fetch the whole table regardless of which entries are on the page, no cache wrapper |
| `faq.ts` (130 ln) | Pure. Uses `groupByCategory` (related.ts) and `isConfirmedOvernight` (overnight.ts) | `buildFaqs` at `[category]/page.tsx:187,259`, `[category]/[exit]/page.tsx:151`; `FaqSection.tsx:1` imports only `type Faq` | O(n) filters/group over the page's entry set (faq.ts:43–129); trivial |
| `categories.ts` (142 ln) | Pure static registry, 9 entries (categories.ts:8–130) | 18 files: engine page, hub, detail page, sitemap, map components, admin pages/actions | `getCategory` = linear find over 9 (categories.ts:135–137); negligible |
| `amenities.ts` (22 ln) | Pure constants, zero imports by design (amenities.ts:1–9) | Client form `SubmitLocationForm.tsx`, `community/schemas.ts`, `MapExplorer.tsx`, admin ListingForm/import/export | Zero |
| `offers.ts` (115 ln) | Pure constants + formatters (offers.ts:32–75, 79–115) | `OfferTable.tsx` (rendered on `/sponsors` marketing page), `ListingFunnelCtas.tsx` (detail page), admin placements page | Negligible |
| `sponsors.ts` (114 ln) | Pure: types, URL validation (sponsors.ts:58–66), window/targeting filter `activeSponsorsFor` (sponsors.ts:97–114) | `SponsorSlot.tsx:2`, `sponsors-data.ts:2–7`, `/sponsors` page (SPONSOR_PLACEMENTS, sponsors/page.tsx:5,118), admin sponsors page/actions | Filter+sort over ≤100 rows; trivial |
| `sponsors-data.ts` (72 ln) | **DB reader**: `directory_sponsors`, `.eq('active', true)`, `.limit(100)`, cookieless anon client (sponsors-data.ts:51–58); fails soft to `[]` (sponsors-data.ts:59–62) | Only `SponsorSlot.tsx:15`; SponsorSlot rendered on hub `directory/page.tsx`, `[category]/page.tsx:223,294`, `top-truck-stops`, `truck-parking`, `location/[slug]/page.tsx:452` | **1 DB query per SponsorSlot per page regeneration** (1 slot/page). No cache wrapper. `sponsorContext()` helper (sponsors-data.ts:67–72) is dead |
| `placements.ts` (295 ln) | Pure capacity/window/audit rules (placements.ts:21–295) | Admin only: `directory/placements/{page,actions}.ts`, `AdminNav.tsx`; plus `scripts/test-placements.ts`, `scripts/e2e-directory-revenue.mjs` | Never on user path |
| `trust.ts` (63 ln) | Pure status derivation (trust.ts:47–63) | Admin only: `directory/quality/page.tsx`; `issues.ts:6` imports `STALE_DAYS` | Never on user path (public pages show only the verified-date fact per header comment trust.ts:1–7) |
| `funnel.ts` (225 ln) | Pure bounding/URL/event helpers | User-facing: `DirectoryBrowser.tsx`, `DirectoryEvents.tsx`, `ListingFunnelCtas.tsx`, `SponsorInquiryForm.tsx`, `/sponsors` page (sponsors/page.tsx:3) | String ops per event/CTA; negligible |
| `tpc.ts` (357 ln) | Pure, but imports `zod` + `./csv` at module scope (tpc.ts:1–2) | Constants (tpc.ts:24–33) → **client components** `TpcReserveCta.tsx:1–10` ('use client'), `TpcReserveBand.tsx:1–11` ('use client', used by TripPlannerApp); CSV/batch machinery (tpc.ts:181–357) → admin `directory/tpc/{page,actions}.ts` only | Runtime negligible; bundle-weight concern (see Bottlenecks) |
| `scope-links.ts` (156 ln) | Pure link-graph builders (scope-links.ts:57,74,109,150) | `[category]/page.tsx:165,237,331`, `[exit]/page.tsx:202`, `top-truck-stops:136`, `truck-parking:194`, `parking/page.tsx:231` | O(states + interstates + entries) per regen; trivial. Note: lib imports `COMMUNITY_LINKS` from a component (scope-links.ts:7–8) — layering inversion, harmless |
| `redirects.ts` (103 ln) | `resolveSlugRedirect` = **DB read**: `directory_slug_redirects` joined `locations!inner`, `.eq('old_slug')`, `.limit(1).maybeSingle()` (redirects.ts:29–33), fails soft to null; `planSlugRedirect` pure (redirects.ts:77–103) | Resolve: `location/[slug]/page.tsx:118` — **only on the miss path** (entry lookup already failed); plan: admin `directory/actions.ts` | 1 query only for unknown/retired slugs; zero cost on the happy path |
| `detail-slug.ts` (41 ln) | Pure: slug base/uniquify/validate/href (detail-slug.ts:11,22,34,39) | Detail page (`isValidDetailSlug` guard at location/[slug]/page.tsx:112 avoids a DB round trip for garbage params), sitemap, EntryCard, map components, admin pages | Regex per call; negligible |
| `parking-disclosure.ts` (32 ln) | Pure (parking-disclosure.ts:12,23,31) | Only `location/[slug]/page.tsx:303,318,232` | Negligible |
| `issues.ts` (395 ln) | Pure detectors over the full listing set; `detectIssues` (issues.ts:270–354) runs per-row checks + bucketed `findDuplicatePairs` (duplicates.ts:50–77, capped 200 pairs / 50 per bucket) | **Admin only**: `directory/quality/page.tsx:12,152`; quality page loads all locations via `getListingsForExport` + `getReviewAggregates` (quality/page.tsx:120–124) | Never on user path |

## Hot-path vs admin-only classification

All public directory routes are ISR (`export const revalidate = 300` on every page under `src/app/(directory)/`, e.g. `[category]/page.tsx:58`, `location/[slug]/page.tsx:59`) with `dynamicParams` true — so "per request" here means "per path regeneration, at most every 5 min per path, plus first render of unknown params."

**Hot-path modules (user-facing renders):** seo.ts, faq.ts, categories.ts, amenities.ts, offers.ts, sponsors.ts, sponsors-data.ts, funnel.ts, tpc.ts (constants only), scope-links.ts, redirects.ts (resolve only), detail-slug.ts, parking-disclosure.ts.

**Admin-only among assigned files:** placements.ts, trust.ts, issues.ts, tpc.ts's CSV half, redirects.ts's `planSlugRedirect`.

**The 15 modules to scope out** — grep evidence (`git grep -ln "directory/<mod>"` repo-wide plus relative `from './<mod>'` within src/lib/directory):

| Module | src importers | Verdict |
|---|---|---|
| `geocode-pipeline.ts` | lib-internal (backfill-stages.ts, census-geocoder.ts); `trip-planner/providers.ts:21` — but that is `export type { ExternalGeocoderAdapter as GeocodingPort }`, **type-only, erased at compile**, and providers.ts itself is imported only by `scripts/test-*.ts` | OUT of hot path (runtime consumers: scripts only) |
| `import.ts` | `admin/(dashboard)/directory/actions.ts`, `expansion/actions.ts`, `lib/admin/directory.ts`, admin `DirectoryToolsNav.tsx` | ADMIN-ONLY ✔ |
| `csv.ts` | admin `directory/export/csv/route.ts`; lib-internal deps of tpc.ts/issues.ts/etc. | ADMIN-ONLY for its own callers, **but** it is in the module graph of `tpc.ts:2`, which client components import — see Bottlenecks |
| `backfill-stages.ts` | **none in src** — only `scripts/geocode-stage-report.ts`, `scripts/test-phase2b.ts` | OUT; dead within src |
| `expansion.ts` | admin expansion page/actions/tool only | ADMIN-ONLY ✔ |
| `overnight.ts` | **NOT admin-only**: `faq.ts:3`, `data.ts`, `corridor.ts`, user-facing `trip-planner/TripPlannerApp.tsx`, `lib/trip-planner/directory-{layer,loader}.ts`, admin parking-reports | ON HOT PATH — but 70 lines of pure constants/predicates (overnight.ts:39–70); zero cost |
| `corrections.ts` | admin corrections page/actions/tool only | ADMIN-ONLY ✔ |
| `duplicates.ts` | admin `directory/actions.ts`, `DirectoryToolsNav.tsx`; lib-internal (issues, import, expansion, colocation — all admin-reached) | ADMIN-ONLY ✔ |
| `interpolation.ts` | lib-internal (calibration, concurrency, geocode-pipeline) + scripts | OUT |
| `census-geocoder.ts` | lib-internal (backfill-stages) + scripts; appears in providers.ts only as a **comment** (providers.ts:12) | OUT |
| `coordinate-verification.ts` | lib-internal only + scripts | OUT |
| `review-enrichment.ts` | admin `directory/geocoding/actions.ts`, admin `GeocodingTool.tsx` | ADMIN-ONLY ✔ |
| `calibration.ts` | **none in src** — only `scripts/{build-calibration,geocode-stage-report,test-*}.ts` | OUT; dead within src |
| `concurrency.ts` | lib-internal (backfill-stages, calibration, geocode-pipeline) + scripts | OUT |
| `geocoding.ts` | admin geocoding actions + admin components only | ADMIN-ONLY ✔ |
| `admin.ts` | admin actions **plus `src/lib/community/schemas.ts:2`** (`CATEGORY_SLUGS`), and schemas is imported by public `api/directory/{review,submission}/route.ts` and client forms `SubmitLocationForm.tsx`/`ReviewForm.tsx` | **NOT strictly admin-only.** Its docstring "Shared by the admin server actions only" (admin.ts:11) is stale. Cost is negligible (constant + pure fns), but it drags zod schema construction (admin.ts:36+) into the community-schemas module graph |

## Caches

- **VERIFIED: no data caching anywhere in this layer.** No `unstable_cache`, no `react` `cache()` in `sponsors-data.ts`, `seo.ts`, `lib/directory/data.ts`, or `lib/community/data.ts` (grep for `cache(`/`unstable_cache` returns nothing in those files). The only cache is the detail page's request-scoped `cache((slug) => getEntryByDetailSlug(slug))` (location/[slug]/page.tsx:61), which dedupes generateMetadata vs page within one render.
- The effective cache is ISR itself (`revalidate = 300` per path). Every regeneration re-runs every query listed above from scratch, per path.
- `createStaticClient` constructs a new Supabase client per call (supabase/static.ts:8–14) — no client reuse.

## Failure modes

- **Fail-soft-to-empty is the house style, and it can mask outages:** `getSponsorsFor` returns `[]` on any error including a missing table (sponsors-data.ts:59–62; migration 024 documented as unapplied, sponsors-data.ts:10–14) — sponsor slots silently vanish. `resolveSlugRedirect` returns null on any error (redirects.ts:44–46) — during a DB outage a retired slug 404s (and with ISR that 404 can be cached for up to 5 min). `getReviewAggregates`/`getApprovedReviewsForSeo` return `{}` on error (community/data.ts:154–156, 204–206) — JSON-LD silently loses AggregateRating/Review. All deliberate per comments (seo.ts:137–139), but nothing logs.
- **Non-deterministic sponsor truncation:** `getSponsorsFor` applies `.limit(100)` with **no `.order()`** (sponsors-data.ts:57–58). With >100 active sponsor rows, which rows are considered is Postgres-arbitrary. Low likelihood, silent wrongness.
- **Invalid date strings widen windows:** `sponsors.withinWindow` ignores unparseable `startsAt`/`endsAt` (`Number.isNaN` guard, sponsors.ts:80–90) → a sponsor with a garbage date shows *always*. Same shape in `placements.windowStatus` — invalid `endsAt` parses to null → `'open-ended'` (placements.ts:89–96, 104–108). `windowBlockers` catches this at activation time (placements.ts:111–120) but not for rows edited/imported by other means.
- **Detail page hard 404 vs soft states:** garbage slugs are rejected by regex before any query (`isValidDetailSlug`, detail-slug.ts:34–36; location/[slug]/page.tsx:112) — good defense.
- `issues.slugIssues` builds a RegExp from `detailSlugBase` output (issues.ts:205); safe because the base is sanitized to `[a-z0-9-]` (detail-slug.ts:12–17) — no regex-injection risk. Admin-only anyway.
- `seo.listingSchema` trusts `entry.website`/`entry.phone` verbatim into JSON-LD (seo.ts:56–57); malformed-website detection exists only as an admin quality issue (issues.ts:160–167), not a render-time guard. JSON-LD is JSON-escaped downstream, so this is a data-quality issue, not injection.

## Bottleneck candidates

1. **VERIFIED (code) / HYPOTHESIS (magnitude): full review-table fetch per list-page regeneration.** `listingListSchemaWithReviews` (seo.ts:140–150) runs two unscoped `location_reviews` queries — up to 10,000 rating rows (community/data.ts:139) and 2,000 full review rows (community/data.ts:182) — on every regeneration of every category/state/interstate/exit/parking page, regardless of how many entries the page shows. With N states + M corridors + E exits each on a 5-min ISR clock, this is the layer's dominant repeated DB work. Cheap today if the review table is small (needs measurement); scales linearly with reviews × page count. Obvious fix: wrap both readers in `unstable_cache` (they're global, not page-scoped) or filter by the page's location ids.
2. **VERIFIED: one `directory_sponsors` query per SponsorSlot per regeneration** (sponsors-data.ts:52–58), always fetching all active rows then filtering in JS (sponsors-data.ts:60). Trivial per query; a shared cached fetch would eliminate it entirely (comment says the table doesn't even exist in prod yet, sponsors-data.ts:12–13).
3. **VERIFIED (import graph) / HYPOTHESIS (bytes): `tpc.ts` ships its admin CSV pipeline toward client bundles.** `TpcReserveCta.tsx` and `TpcReserveBand.tsx` are `'use client'` and import five string constants from `tpc.ts` (TpcReserveCta.tsx:1–10), but `tpc.ts` imports `zod` and `./csv` at module scope and constructs `tpcRowSchema` at module init (tpc.ts:1–2, 196–206). Unless tree-shaking removes the side-effectful schema construction, the trip-planner and parking-page client bundles carry zod + the CSV parser for constants. Needs a bundle-analyzer measurement.
4. **VERIFIED: pure computation in this layer is NOT a bottleneck.** `buildFaqs`, `scope-links`, `listingListSchema`, `activeSponsorsFor`, `trustStatus`, funnel helpers are all O(n) over already-fetched arrays with small constants. Memoizing them would buy nothing; the DB reads around them dominate.
5. Adjacent observation (pages subsystem, noted for cross-reference): the exit page runs `resolveExit` + `getEntriesByExitResult` in both `generateMetadata` and the page body with no `cache()` dedupe ([exit]/page.tsx:98–104 vs 119–135), unlike the detail page which dedupes (location/[slug]/page.tsx:61).

## Dead code

- **`sponsorContext()`** (sponsors-data.ts:67–72) — imported nowhere in src/ or scripts/. VERIFIED dead export.
- **`ReviewSeo` type** (seo.ts:19–22) — exported, referenced only inside seo.ts. Dead export (type-only, zero runtime weight).
- **Whole modules dead within src/** (alive only in `scripts/`): `backfill-stages.ts`, `calibration.ts` (no src importers at all); `interpolation.ts`, `census-geocoder.ts`, `coordinate-verification.ts`, `concurrency.ts`, `geocode-pipeline.ts` (src importers are only each other). They form a scripts-only geocoding toolchain cluster.
- `trip-planner/providers.ts` itself is imported by no src file — only scripts (grep evidence above); its one link to this subsystem is a type re-export (providers.ts:21).
- Exports used only by test scripts (kept alive by `scripts/test-*.ts`, not by the app): `BILLING_LABEL`, `intentLabel`, `FUNNEL_INTEREST` (also used internally, funnel.ts:118), `termEnd`, `isThinListing` (also internal, issues.ts:279), `tpcUrlsEqual` (also internal, tpc.ts:311), `corridorSponsorConflicts`/`isWithinWindow`/`windowBlockers` (also internal to placements.ts).

## Simplification opportunities

1. **Split `tpc.ts` into a constants leaf + admin CSV module.** The five partner constants (tpc.ts:24–33) are the only things client components need; the other ~320 lines (zod, CSV, batch validation) are admin-only. Mirrors what `amenities.ts` already does deliberately ("zero imports so it is safe in every context", amenities.ts:4–8).
2. **Wrap `getReviewAggregates`/`getApprovedReviewsForSeo`/`getSponsorsFor` in `unstable_cache`** (or React `cache` at minimum) — all three are global reads shared by every page; a 5-min server cache matches the ISR window exactly and removes ~3 queries per regeneration.
3. **Delete `sponsorContext`** (sponsors-data.ts:67–72) and the `ReviewSeo` export qualifier.
4. **Fix the stale claim in `admin.ts:11`** ("admin server actions only") or move `CATEGORY_SLUGS` into `categories.ts` so `community/schemas.ts` stops importing an admin module into public API routes and client forms.
5. **Add `.order()` before `.limit(100)`** in `getSponsorsFor` (sponsors-data.ts:57–58) for deterministic truncation.
6. `scope-links.ts:7–8` importing `COMMUNITY_LINKS` from `@/components/directory/RelatedLinks` is a lib→component dependency; moving the constant into the lib (or a shared constants file) restores layering.

## Open questions

1. How large is `location_reviews` in production, and how many distinct list-page paths regenerate per 5-min window? That product determines whether bottleneck #1 is measurable or theoretical (HYPOTHESIS — needs `scripts/bench` or DB stats).
2. Does the production bundler actually tree-shake `tpc.ts`'s zod schema out of the `TpcReserveCta`/`TpcReserveBand` client chunks? (HYPOTHESIS — needs bundle analysis.)
3. Migrations 023 (`directory_slug_redirects`) and 024 (`directory_sponsors`) are described in comments as committed-but-unapplied (redirects.ts:6–8, sponsors-data.ts:11–14). Is that still true in prod? If applied since, the fail-soft paths change from "always empty" to "real queries," making bottleneck #2 and the redirect-outage failure mode live.
4. `getReviewAggregates`/`getApprovedReviewsForSeo` use `createAdminClient` (service role, community/data.ts:134,176) inside publicly-triggered ISR renders, while `sponsors-data`/`redirects` use the anon static client. Whether approved-review reads could move to the anon client (RLS permitting) is a security-posture question for the community-layer auditor.
5. The scripts-only geocoding cluster (backfill-stages, calibration, interpolation, census-geocoder, coordinate-verification, concurrency, geocode-pipeline — ~1,900 lines) lives under `src/lib/directory` but has no app consumers. Whether it should relocate to `scripts/lib` to keep the app source tree honest is a repo-organization decision, not a runtime one.