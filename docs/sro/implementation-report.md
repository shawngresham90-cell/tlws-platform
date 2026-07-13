# Search & Revenue Optimization — Implementation Report (2026-07-13)

One-PR milestone over the existing 971-location / 11-state production data. No migrations, no data changes, no coordinate changes, no imports, no fabricated content.

## 1. Search (implemented, 47 tests)
- `lib/directory/search.ts`: query normalization (I40 / I-40 / Interstate 40 → i-40; ex 81 / exit81 → exit 81), brand aliases (loves→Love's, flyingj, qt→QuikTrip, catscale, ta, one9, weigels, stm…), ft/mt/st city-word aliases, edit-distance-1 fuzzy matching (5+ letter tokens only), field-weighted relevance (name > city > exit > interstate > category/amenities > description; featured tie-boost).
- `browse.ts` delegates matching; default sort = relevance when a query is present; explicit A–Z/newest/distance sorts unchanged. Input deferred with `useDeferredValue`.

## 2. Browse pages (implemented)
- `/directory/browse` hub (5 dimensions) · `/directory/browse/brands` + 16 brand pages (derived from listing names — independents never mislabeled) · `/directory/browse/cities` + per-city pages (city+state slugs) · state/interstate/category link to existing hubs. All data-backed; no thin synthetic pages.

## 3. Location statistics (implemented, tested)
- `/directory/stats`: largest truck stops by verified spaces, states-with-most (CAT scales, parking, hotels, tire shops, washes), verified-space totals, corridor coverage, category totals. Pure derivations (`lib/directory/stats.ts`).

## 4. SEO (audit: docs/sro/seo-audit.md; fixes applied)
- FIXED: list-page JSON-LD was dead (filtered on the always-false DB `is_indexable`); now uses the same `isDetailIndexable()` gate as detail pages/sitemap.
- FIXED: `/apps`, `/books`, and all new pages added to the sitemap; `noindex` now keeps `follow`; 5 crawlable-404 placeholder nav links removed from Header/Footer (restore when those modules ship).
- All new pages ship title/description/canonical/OG/breadcrumb schema/visible breadcrumbs/ItemList + internal links.
- REMAINING (owner input needed): site has no OG image or favicon (needs brand artwork); detail-page sitemap source caps at 1,000 rows (fine today at 971; needs pagination when the catalog grows).

## 5. Performance (audit: docs/sro/perf-audit.md; fixes applied)
- FIXED: homepage now ISR (FoundersWall reads via cookie-free static client; `revalidate=60` moved to the page where it works).
- FIXED: middleware skips the blocking `auth.getUser()` round-trip for anonymous requests (no `sb-*` cookies).
- FIXED: hot directory readers + facets wrapped in React `cache()` (exit page was running the facets scan 3×/render). Supersedes draft PR #37, which can be closed.
- FIXED: zod removed from the public form bundle — `/directory/submit` First Load **121 kB → 104 kB**.
- REMAINING: `/knowledge` queries still use the cookie client (same pattern applies; separate module, recommended follow-up); `/directory/new-locations` pagination via searchParams disables its ISR.

## 6. Monetization (implemented)
- `TrackedCta` fires vendor-agnostic analytics events (existing Plausible/dataLayer/Vercel dispatcher) on every affiliate + sponsor click: `affiliate_click` (EntryCard TPC link, with listing id + placement) and `sponsor_click` (SponsorSlot, with placement + sponsor). `rel="sponsored noopener noreferrer"` unchanged everywhere.
- REMAINING (needs a future migration — data change, out of scope): first-party click persistence; `sponsor_touches` is a CRM log and was correctly not misused.

## 7. Accessibility (audit: docs/sro/a11y-audit.md; fixes applied)
- Error text moved from 2.8:1 `text-diesel` to new `diesel-300` (6.5:1) across all forms/map.
- Search/filter inputs got the repo-standard 2px focus ring.
- `StarRatingInput` now implements the real radio pattern (roving tabindex, arrow keys, Home/End, aria-describedby error).
- `LocationPicker`: invalid listbox/option ARIA removed (plain button list); focus no longer drops to `<body>` on selection.
- `EntryCard` heading level is a prop; brand/city pages pass `h2` (no skipped levels).
- Fixed nonexistent `bg-asphalt-900` token usages.
- REMAINING: input-border non-text contrast (1.43:1) and placeholder contrast (3.4:1) are design-token decisions; flagged in the audit for the owner.

## Verification
- Tests: **248 checks green** across 7 suites (search 47, browse 19, brands/stats 25, csv-geo 46, linking 27, interstates 49, coordinate-verification 35).
- `tsc --noEmit` ✅ · `next lint` ✅ · `next build` ✅ — **85 static pages (was 65)**.
- Production untouched: no migrations, no data writes, no deploys.
