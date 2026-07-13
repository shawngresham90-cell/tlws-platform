# Performance Audit — tlws-platform (branch `feat/search-revenue-optimization`)

Date: 2026-07-13 · Next.js 14.2.35 · READ-ONLY audit (no source files modified).
Build method: `npx next build` from repo root. First attempt failed typechecking on
`scratch-b11/assess-b11.ts:97` (tsconfig `include: ["**/*.ts"]` picks up scratch dirs);
scratch-* dirs were moved to /tmp/sh for the build and restored afterward. Second build: exit 0,
65 static pages generated. Full log: build artifacts in `.next/`.

**Scope note — concurrent development:** while this audit ran, two commits landed on the branch
(`72bb9be` browse hub + stats page, `d685e93` tracked revenue CTAs + SEO/a11y fixes). The build
snapshot and route table below correspond to commit `383865c`. The cited findings were re-checked
against the new HEAD: none were invalidated (the changes to `DirectoryBrowser.tsx` /
`MultiCategoryBrowser.tsx` / `seo.ts` were a11y/SEO-only; the F7 review queries, F10/F11 caching
issues, and F1 zod imports are untouched — cited line numbers may drift by a few lines). NOT
covered by this audit: the brand-new routes `/directory/browse/*`, `/directory/stats`, and
`src/lib/directory/brands.ts`, `src/lib/directory/stats.ts`, `src/lib/analytics.ts`,
`TrackedCta.tsx` — re-run the bundle step after that work settles.

---

## 1. BUNDLE SIZE

Shared first-load baseline: **87.7 kB** (framework: `fd9d1056` 53.6 kB gz = React/react-dom,
`2117` 31.7 kB gz = Next App Router/flight runtime — normal for Next 14, no app code inside).

Per-route First Load JS (from build output):

| Route | First Load JS | Notes |
|---|---|---|
| /directory/submit | **121 kB** | ⚠ over 120 kB — zod chunk (see F1) |
| /directory/reviews | 119 kB | zod chunk (see F1) |
| /admin/directory/corrections | 118 kB | admin-only, zod chunk |
| /admin/directory/geocoding | 117 kB | admin-only |
| /admin/directory/expansion | 117 kB | admin-only |
| /directory/location/[slug] | 105 kB | |
| /directory, /directory/[category], [exit], top-truck-stops, truck-parking, map, parking, recently-updated, new-locations | 104 kB | |
| /academy/*, /founders, /books, /knowledge/*, / | 96.7–102 kB | |

Heavy chunks identified:
- `d0deef33` = **Leaflet, 148 K raw** — correctly code-split: loaded only via `dynamic(..., {ssr:false})`
  in `src/components/map/MapExplorer.tsx:35` and an in-effect `import('leaflet')` in
  `src/components/map/MapPreview.tsx:51`. It is NOT in any route's First Load JS. Good.
- `5867` = **zod, 56 K raw (~15 kB gz)** — shipped to the two public form pages (see F1).
- `4906` = Turnstile widget code — appropriate for form pages.

### Findings

**F1. zod ships to public pages that only need two constant arrays — MED**
- `src/components/community/ReviewForm.tsx:7` imports `TRUCK_TYPES` and
  `src/components/community/SubmitLocationForm.tsx:9` imports `SUBMISSION_KINDS` from
  `src/lib/community/schemas.ts`, whose line 1 is `import { z } from 'zod'` (and line 2 pulls
  `@/lib/directory/admin`, which itself imports zod). Value imports drag the whole module graph —
  the entire zod library (~15 kB gz, chunk `5867`) — into the client bundles of `/directory/submit`
  (121 kB, the only route over the 120 kB threshold) and `/directory/reviews` (119 kB).
- **Fix (safe):** create `src/lib/community/constants.ts` containing only `SUBMISSION_KINDS` and
  `TRUCK_TYPES` (plain `as const` arrays, zero imports); re-export from `schemas.ts` for the server
  routes; point the two client components at the new module. Expected: both routes drop to ~105 kB.

**F2. Admin tool routes at 117–118 kB — LOW**
- `src/components/admin/directory/CorrectionsTool.tsx` etc. pull `src/lib/directory/corrections.ts`
  (zod) into client bundles. Admin-only, low traffic — acceptable. Same constants-extraction
  pattern applies if desired.

**F3. tsconfig includes scratch dirs, breaking/slowing builds — LOW (build perf)**
- `tsconfig.json:24` `"include": [..., "**/*.ts", "**/*.tsx"]` typechecks `scratch-*/**` (the
  build failed on `scratch-b11/assess-b11.ts:97` until they were moved aside).
- **Fix (safe):** add `"scratch-*"` to the `"exclude"` array (`tsconfig.json:25`).

---

## 2. DATABASE QUERIES

Data layers: `src/lib/directory/data.ts` (anon cookieless client), `src/lib/community/data.ts`
(anon + service-role), `src/lib/kc/queries.ts` (cookie-bound client — see F10),
`src/lib/admin/*` (admin, force-dynamic). No `select('*')` on any hot public path; the public
`COLUMNS` list (`data.ts:95-99`) is explicit. All reads are `.limit()`-capped.

**F4. Exit page fires the same queries 2–3× per request — HIGH**
- `src/app/(directory)/directory/[category]/[exit]/page.tsx`: `resolveExit()` (line 57 calls
  `getDirectoryFacets()`, a 5,000-row scan) runs once in `generateMetadata` (line 70) and again in
  the page body (line 95); the page body then calls `getDirectoryFacets()` a **third** time in its
  `Promise.all` (line 100). `getEntriesByExit()` also runs twice (generateMetadata line 71 + page
  line 98). generateMetadata and the page render in the same request, so every ISR regeneration of
  every exit page does ~5 queries where 3 suffice.
- **Fix (safe):** wrap the exported readers in React `cache()` inside `src/lib/directory/data.ts`
  (e.g. `export const getDirectoryFacets = cache(async () => {...})`, same for `getEntries*`).
  Per-request dedup only — zero behavior change. Precedent already exists in the codebase:
  `src/app/(directory)/directory/location/[slug]/page.tsx:50` does exactly this for
  `getEntryByDetailSlug`.

**F5. Knowledge pages duplicate queries between generateMetadata and page — MED**
- `src/app/(marketing)/knowledge/[category]/page.tsx`: `getCategoryBySlug` at line 16
  (generateMetadata) and line 32 (page body) — 2× per request.
- `src/app/(marketing)/knowledge/[category]/[slug]/page.tsx`: `getArticle` at line 30 and line 51 —
  2× per request (full article row incl. `body_mdx`).
- **Fix (safe):** wrap `getCategoryBySlug` / `getArticle` in React `cache()` in
  `src/lib/kc/queries.ts`.

**F6. Listing detail page pulls up to 2,000 full rows to compute "nearby" — MED**
- `src/app/(directory)/directory/location/[slug]/page.tsx:119-124` fetches `getEntriesByState`
  (cap 1,000 full-column rows, `data.ts:114`) plus `getEntriesByInterstate` (another 1,000) for
  every detail-page render, only to pick a handful of nearby cards. Cost scales linearly with the
  directory and repeats for every one of the (eventually thousands of) detail slugs on each ISR
  cycle.
- **Fix:** add a narrowed variant (`selectEntries` with a reduced column list — nearby cards don't
  need `description`/`tpc_url`/etc.), or better, a lat/lng bounding-box filter
  (`.gte('lat', …).lte('lat', …)`) / the existing nearby RPC. Column-narrowing is safe now; the
  geo filter needs a quick check of `nearbySections()` expectations in `src/lib/directory/detail.ts`.

**F7. Review-schema enrichment scans the whole review table per page — MED**
- `src/lib/directory/seo.ts:145-149` (`listingListSchemaWithReviews`) runs on every category,
  state, interstate, and exit page render and calls `getReviewAggregates()`
  (`src/lib/community/data.ts:132-139`, up to 10,000 rating rows) and `getApprovedReviewsForSeo()`
  (`data.ts:174-183`, up to 2,000 review rows) — unfiltered, even when the page's `entries` are a
  dozen listings.
- **Fix (safe):** pass the page's entry ids and add `.in('location_id', ids)` to both queries;
  additionally wrap both in React `cache()` so multi-section pages dedupe.

**F8. 2,000 listing refs serialized into client props on the form pages — MED**
- `src/app/(directory)/directory/submit/page.tsx:21` and `.../reviews/page.tsx:23` call
  `getListingRefs()` (`src/lib/community/data.ts:36`, cap 2,000 rows) and pass the whole array to
  the client `LocationPicker` (`SubmitLocationForm` / `ReviewForm` props). RSC payload is ~20 kB
  today and grows linearly with the table — at the 2,000-row cap this is a few hundred kB of HTML
  + flight data on a form page.
- **Fix:** typeahead against a small search endpoint (the `/api/directory/nearby` handler pattern),
  or at minimum trim `ListingRef` fields. Not a zero-risk change; schedule it before the next big
  import batch.

**F9. Admin `select('*')` usages — LOW (acceptable)**
- `src/app/admin/(dashboard)/submissions/actions.ts:100,294`,
  `src/app/admin/(dashboard)/submissions/[id]/page.tsx:143`,
  `src/app/admin/(dashboard)/directory/actions.ts:301`. All are single-row (or two-row) fetches
  used to build fill-only patches across every column — the wildcard is semantically required.
  No action needed; admin routes are force-dynamic and low-traffic.

Per-public-page revalidate values — see section 3 table.

---

## 3. CACHING / ISR

`export const revalidate` inventory (src/app):

| File | Value |
|---|---|
| sitemap.ts:16 | 3600 |
| (community)/founders/page.tsx:28 | 60 |
| (directory)/directory/page.tsx:28 | 300 |
| (directory)/directory/[category]/page.tsx:56 | 300 |
| (directory)/directory/[category]/[exit]/page.tsx:39 | 300 |
| (directory)/directory/[category]/top-truck-stops/page.tsx:24 | 300 |
| (directory)/directory/[category]/truck-parking/page.tsx:24 | 300 |
| (directory)/directory/location/[slug]/page.tsx:48 | 300 |
| (directory)/directory/map/page.tsx:25 | 300 |
| (directory)/directory/new-locations/page.tsx:16 | 300 — **ignored, page is dynamic (F12)** |
| (directory)/directory/recently-updated/page.tsx:18 | 300 |
| (directory)/directory/reviews/page.tsx:18 | 300 |
| (directory)/directory/submit/page.tsx:17 | 300 |
| (directory)/directory/parking/page.tsx:14 | 300 |
| (marketing)/knowledge/page.tsx:10 | 300 — **ignored, page is dynamic (F10)** |
| (marketing)/knowledge/[category]/page.tsx:13 | 300 — **ignored (F10 + F12)** |
| (marketing)/knowledge/[category]/[slug]/page.tsx:22 | 300 |
| llms.txt/route.ts:8 | force-static |
| admin/* | force-dynamic (correct) |
| knowledge/search/page.tsx:8 | force-dynamic (correct — query-string results) |

**F10. Homepage renders fully dynamic — no ISR at all — HIGH**
- Build output: `ƒ /` (server-rendered on demand). Cause: the `FoundersWall` section
  (`src/components/sections/FoundersWall.tsx:3,16`) uses the cookie-bound client from
  `src/lib/supabase/server.ts` — `cookies()` opts the whole route out of static/ISR rendering. The
  `export const revalidate = 60` at `FoundersWall.tsx:5` is a **no-op**: route-segment config only
  works in page/layout/route files, not components. Net effect: every homepage view = a Supabase
  round-trip (plus the middleware round-trip, F11) before first byte.
- Same root cause makes the whole Knowledge Center dynamic: `src/lib/kc/queries.ts` uses the
  cookie client at lines 13, 22, 33, 45, 59, 72, 90, 122 (only line 133 uses the static client),
  so `ƒ /knowledge` and `ƒ /knowledge/[category]` ignore their declared `revalidate = 300`.
- **Fix (safe):** these are all public, RLS-guarded, anonymous reads — switch them to
  `createStaticClient()` from `src/lib/supabase/static.ts` (the exact pattern already used by
  `src/lib/directory/data.ts` and `src/lib/community/founders.ts`), then add
  `export const revalidate = 60` to `src/app/page.tsx`. Anonymous visitors already exercise the
  anon-key path today, so behavior is identical; pages become static+ISR.

**F11. Middleware makes a Supabase Auth network call on every request — HIGH**
- `src/lib/supabase/middleware.ts:34` `await supabase.auth.getUser()` runs for every matched
  request; the matcher (`src/middleware.ts:10-12`) covers every page and API route. For the ~100%
  of traffic that is anonymous (public directory/academy/knowledge pages), this adds a blocking
  auth round-trip per request for a session that does not exist. Middleware bundle is 55.8 kB.
- **Fix (safe):** short-circuit at the top of `updateSession`: if
  `request.cookies.getAll().every(c => !c.name.startsWith('sb-'))`, return `NextResponse.next()`
  immediately — no session cookies means nothing to refresh, so behavior for anonymous users is
  unchanged and logged-in refresh still works. Optionally also narrow the matcher to
  `/admin/:path*`, `/login`, `/auth/:path*` and the APIs that read sessions.

**F12. `searchParams` pagination silently disables ISR — MED**
- `src/app/(directory)/directory/new-locations/page.tsx:40-47` reads `searchParams.page`, which
  forces `ƒ` dynamic rendering; the `revalidate = 300` at line 16 (and its comment "Static with
  periodic refresh") is dead. Every hit — including page 1, the only one most users see — queries
  Supabase. `src/app/(marketing)/knowledge/[category]/page.tsx:36` has the same pattern (compounded
  by F10).
- **Fix:** move pagination into the path (`/directory/new-locations/page/2` route segment with
  `generateStaticParams`), or accept dynamic and delete the misleading `revalidate`. The
  path-segment change is behavior-visible (URLs change) — not in the zero-risk list.

Positive: `/directory/map` is fully static + ISR with all interactivity in a client island;
`dynamicParams: true` is deliberately kept (documented Netlify purge bug,
`[category]/page.tsx:48-52`); admin surface is uniformly `force-dynamic` — all correct.

---

## 4. IMAGES

Clean overall — **zero `<img>` tags in src/**.
- Only `next/image` user: `src/app/(marketing)/books/page.tsx:83-91` — local `/public/covers/*`
  asset with explicit width/height and `priority` on the featured cover. Correct.
- `next.config.mjs` `remotePatterns` allows `**.supabase.co` / `**.netlify.app`, but no component
  currently renders a remote image (`kc_articles.hero_image_url` is used only as OpenGraph metadata,
  `knowledge/[category]/[slug]/page.tsx:40`; sponsor `logo` renders as emoji text,
  `SponsorSlot.tsx:37`). No unoptimized remote images today.

**F13. Leaflet CSS loaded eagerly on listing detail pages — LOW**
- `src/components/map/MapPreview.tsx:4` and `src/components/map/LeafletMap.tsx:4` import
  `leaflet/dist/leaflet.css` at module top level, so the CSS (~15 kB raw) is included in the page
  CSS even though the JS is lazy/IntersectionObserver-gated. Minor; acceptable. (OSM tile images
  are third-party by design and cannot go through `next/image`.)

---

## 5. UNNECESSARY RENDERS / CLIENT COMPONENTS

`'use client'` under `src/components/directory`: `DirectoryBrowser.tsx`,
`MultiCategoryBrowser.tsx`, `ViewBeacon.tsx` — all three legitimately need state/effects.
Everything else on directory pages (`EntryCard`, `DirectoryHero`, `FaqSection`, `RelatedLinks`,
`NearbySections`, `DetailNearbySections`, `SponsorSlot`, `CategoryCardGrid`) is a server
component. No page file under `src/app/(directory)` is a client component. Split is correct — no
client components that should be server components.

**F14. Fuzzy search runs un-deferred and un-indexed on every keystroke — MED**
(New in this branch — commit 383865c "search understanding".)
- `src/components/directory/DirectoryBrowser.tsx:44-47` and
  `src/components/directory/MultiCategoryBrowser.tsx:98-106` recompute
  `filterAndSortEntries → rankEntries` on each keystroke. Inside,
  `src/lib/directory/search.ts:124-136` (`fieldsOf`) rebuilds and re-lowercases a 6-field array
  **per entry per keystroke**, and `scoreEntry` (lines 144-186) runs Levenshtein fallback per
  token per field word. With the 1,000-entry cap and multi-token alias-expanded queries this is
  millions of ops per keystroke on a category page, executed synchronously in the input handler's
  render — plus a full re-render of the visible card grid.
- **Fix (safe):** (a) feed the memos a deferred query — `const dq = useDeferredValue(query)` and
  use `dq` in the `useMemo` deps — keeps typing responsive with zero behavior change; (b) hoist
  the per-entry haystack: precompute `fieldsOf` results once per `entries` array (a
  `useMemo`/`Map` keyed by entry id, or accept a prebuilt index in `rankEntries`). Both are pure
  perf changes with identical results.

**F15. Map result list re-renders every card on marker selection — MED**
- `src/components/map/MapExplorer.tsx:428-435`: clicking a marker calls `setSelectedId`, which
  re-renders all `MapResultCard`s (up to the 2,000-entry pool after filters), each re-deriving
  `getCategory`/`directionsUrl` (`MapExplorer.tsx:442-452`).
- **Fix (safe):** `const MapResultCard = memo(function MapResultCard(...){...})` and pass a stable
  `onSelect` (`useCallback`). Only the previously/newly selected cards re-render.

**F16. `faqSchema(faqs)` computed twice per page — LOW**
- `src/app/(directory)/directory/[category]/page.tsx:203` and again at line 275:
  `...(faqSchema(faqs) ? [faqSchema(faqs)!] : [])`. Compute once into a local. Trivial CPU, but
  free to fix.

**F17. New Supabase client instantiated per query call — LOW**
- `src/lib/supabase/static.ts:8` builds a fresh `createSupabaseClient` on every call; a single
  page render calls it 3–6 times (entries + facets + sponsors + refs...). It's stateless
  (`persistSession: false`), so a module-level singleton (`let client; return (client ??= ...)`)
  is safe and removes repeated client construction.

**F18. `LocationPicker` filters 2,000 refs per keystroke — LOW**
- `src/components/community/LocationPicker.tsx:40-45` is memoized but not deferred; fine at
  current scale, revisit together with F8.

---

## SAFE TO APPLY NOW (zero behavior risk)

1. **F4/F5** — Wrap `getDirectoryFacets`, `getEntries`, `getEntriesByState`, `getEntriesByInterstate`,
   `getEntriesByExit` (`src/lib/directory/data.ts`) and `getCategoryBySlug`, `getArticle`
   (`src/lib/kc/queries.ts`) in React `cache()`. Per-request dedup only; pattern already used at
   `location/[slug]/page.tsx:50`. Removes 2–3 redundant DB round-trips per exit/knowledge page render.
2. **F1** — Extract `SUBMISSION_KINDS` / `TRUCK_TYPES` into a zod-free
   `src/lib/community/constants.ts`; update the two client imports. Drops ~15 kB gz from
   `/directory/submit` (only route over 120 kB) and `/directory/reviews`.
3. **F11 (short-circuit only)** — In `src/lib/supabase/middleware.ts`, return early when the request
   carries no `sb-*` cookies. Anonymous requests skip a blocking Supabase Auth round-trip; logged-in
   flows unchanged.
4. **F14a** — `useDeferredValue` on the search query in `DirectoryBrowser.tsx` and
   `MultiCategoryBrowser.tsx`; **F14b** memoized per-entry search haystack.
5. **F15** — `React.memo` on `MapResultCard` + `useCallback` for `onSelect` in `MapExplorer.tsx`.
6. **F16** — Compute `faqSchema(faqs)` once in `[category]/page.tsx`.
7. **F17** — Singleton in `src/lib/supabase/static.ts`.
8. **F3** — Add `"scratch-*"` to `tsconfig.json` `exclude` so `next build` passes without moving dirs.

Near-zero risk (one review each, then apply): **F10** — switch `FoundersWall` and
`src/lib/kc/queries.ts` public reads to `createStaticClient()` and add `revalidate = 60` to
`src/app/page.tsx` (verify anon RLS covers `campaign_progress` and `kc_*` — it must already, since
anonymous visitors read them today); **F7** — add `.in('location_id', ids)` to the two SEO review
queries.
