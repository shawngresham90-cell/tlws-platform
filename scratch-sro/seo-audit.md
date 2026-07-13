# SEO Completeness Audit — tlws-platform (`feat/search-revenue-optimization`)

Audited: 2026-07-13, commit `383865c`. Read-only audit; no source files modified.

Helpers reviewed: `src/lib/seo/metadata.ts` (buildMetadata: title/description/canonical/OG/Twitter/robots in one call), `src/lib/seo/schema.tsx` (Org/Person/WebSite/Breadcrumb/FAQ + JsonLd renderer), `src/lib/directory/seo.ts` (listing/ItemList/detail schema), `src/lib/directory/detail.ts` (indexability gate + meta copy), `src/app/sitemap.ts`, `src/app/robots.ts`.

---

## 1. Coverage matrix

Legend: Y = present · N = missing · (…) = caveat. "Canonical/OG/Twitter" are Y wherever `buildMetadata()` is used (it emits all three together).

| Route | Title | Meta desc | Canonical | OG/Twitter | JSON-LD types | BreadcrumbList schema | Visible breadcrumbs | In sitemap.ts | Robots/noindex | Internal links in/out |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` (home) | Y (default) | Y (default) | Y | Y (no image) | Org+Person+WebSite (layout), BreadcrumbList | Y | n/a | Y | index | Header/Footer sitewide; sections link to academy, knowledge, directory, books, apps, founders. **5 nav links 404** (gap 3) |
| `/directory` (hub) | Y | Y | Y | Y (no image) | BreadcrumbList, ItemList (category links — hand-built, always emitted) | Y | **N** (Eyebrow only) | Y (0.8) | index | Out: all 9 categories, map, submit, reviews, new/updated, states, interstates. In: header/footer, home |
| `/directory/[category]` (category kind, 8 engine cats) | Y (genMeta) | Y | Y | Y | BreadcrumbList, ItemList of LocalBusiness/Place+reviews (**suppressed — gap 1**) | Y | Y (DirectoryHero) | Y (0.7) | index | Out: hub, map, detail pages (EntryCard), RelatedLinks scopes. In: hub, footer, detail pages |
| `/directory/[state]` (e.g. /directory/georgia) | Y | Y | Y | Y | BreadcrumbList, ItemList (**suppressed**), FAQPage | Y | Y | Y (0.7) | index | Out: top-truck-stops, detail pages, RelatedLinks, map, hub. In: hub chips, detail pages, sitemap |
| `/directory/[interstate]` (e.g. /directory/i75) | Y | Y | Y | Y | BreadcrumbList, ItemList (**suppressed**), FAQPage | Y | Y | Y (0.7) | index | Out: truck-parking, exit pages, RelatedLinks, map, hub. In: hub chips, detail pages |
| `/directory/[i]/[exit]` (exit pages) | Y (genMeta, data-driven desc) | Y | Y | Y | BreadcrumbList, ItemList (**suppressed**), FAQPage | Y | Y | Y (0.6) | index; empty exits 404 (good) | Out: corridor page, hub, RelatedLinks, detail pages. In: corridor "Jump to an exit", detail Exit fact |
| `/directory/[state]/top-truck-stops` | Y | Y | Y | Y | BreadcrumbList, ItemList (**suppressed**) | Y | Y | Y (0.6) | index | Out: state page, map, RelatedLinks. In: state page promo link, sitemap |
| `/directory/[i]/truck-parking` | Y | Y | Y | Y | BreadcrumbList, ItemList (**suppressed**) | Y | Y | Y (0.6) | index | Out: corridor, state pages, map, /directory/parking. In: corridor promo link |
| `/directory/location/[slug]` (detail) | Y (detailTitle) | Y (detailDescription) | Y | Y (no image) | BreadcrumbList, LocalBusiness/Place + AggregateRating + Review (NOT suppressed — bypasses `indexable` flag) | Y | Y | Y **only if `isDetailIndexable`** (0.6); capped at 1000 rows (gap 6) | `noindex,nofollow` when gate fails (gap 4: should be follow) | Out: category, state, interstate, exit, map, hub, reviews, submit. In: EntryCards on every list page |
| `/directory/map` | Y | Y | Y | Y | BreadcrumbList only | Y | **N** | Y (0.8) | index | Out: hub, OSM. In: hub, every directory page footer, detail pages |
| `/directory/parking` (hand-built category) | Y | Y | Y | Y | BreadcrumbList, ItemList (**suppressed**) | Y | **N** | Y (via `categoryHref` customHref) | index | Out: map, hub, RelatedLinks, TPC (rel=sponsored ✓). In: header/footer "Truck Parking", hub, i-parking pages |
| `/directory/new-locations` | Y | Y | Y (**always page 1 — gap 8**) | Y | BreadcrumbList, ItemList (**suppressed**) | Y | Y | Y (0.6) | index (incl. ?page=N duplicates) | Out: recently-updated, hub, detail pages, prev/next (rel attrs ✓). In: hub chip |
| `/directory/recently-updated` | Y | Y | Y | Y | BreadcrumbList, ItemList (**suppressed**) | Y | Y | Y (0.6) | index | Out: new-locations, hub, detail pages. In: hub chip |
| `/directory/reviews` | Y | Y | Y (?listing= variants canonicalize here ✓) | Y | BreadcrumbList only | Y | **N** | Y (0.7) | index | Out: submit, hub (crumb schema only). In: hub, detail pages ("Leave a review") |
| `/directory/submit` | Y | Y | Y (?listing=&kind= variants canonicalize ✓) | Y | BreadcrumbList only | Y | **N** | Y (0.6) | index | Out: reviews. In: hub, detail pages ("Report incorrect information") |
| `/knowledge` | Y | Y | Y | Y | BreadcrumbList | Y | Y | Y (0.9) | index | Out: categories, articles, search. In: header/footer, home |
| `/knowledge/[category]` | Y (genMeta) | Y | Y | Y | BreadcrumbList | Y | Y | Y (DB-driven, 0.7) | index; unknown slug 404s (but see gap 11) | Out: hub, articles. In: hub, articles |
| `/knowledge/[category]/[slug]` | Y (meta_title fallback) | Y | Y | Y + hero image + type article | BreadcrumbList, Article, FAQPage (conditional) | Y | Y | Y (DB-driven, 0.6) | index | Out: hub, category, related articles. In: hub, category, home LatestArticles |
| `/knowledge/search` | Y | Y | Y (base path, no ?q ✓) | Y | none | N (fine for noindex page) | Y | Correctly excluded | **noindex ✓** | Out: hub, articles |
| `/founders` | Y | Y | Y | Y | BreadcrumbList only (**visible FAQ has no FAQPage schema — gap 10**) | Y | Y (PageHero) | Y (0.8) | index | Out: form/tiers. In: header/footer, home FoundersWall |
| `/academy` | Y | Y | Y | Y | BreadcrumbList, Course | Y | Y | Y (0.9) | index | In/out: header/footer, home, all academy subpages |
| `/academy/curriculum` | Y | Y | Y | Y | BreadcrumbList, Course | Y | Y | Y (0.7) | index | hub-and-spoke with /academy |
| `/academy/requirements` | Y | Y | Y | Y | BreadcrumbList | Y | Y | Y (0.7) | index | " |
| `/academy/financing` | Y | Y | Y | Y | BreadcrumbList | Y | Y | Y (0.7) | index | " |
| `/academy/facility` | Y | Y | Y | Y | BreadcrumbList | Y | Y | Y (0.7) | index | " |
| `/academy/instructors` | Y | Y | Y | Y | BreadcrumbList (Person deliberately site-wide) | Y | Y | Y (0.7) | index | " |
| `/academy/faq` | Y | Y | Y | Y | BreadcrumbList, FAQPage | Y | Y | Y (0.7) | index | " |
| `/academy/cdl-school-dalton-ga` | Y | Y | Y | Y | BreadcrumbList, EducationalOrganization (local), Course | Y | Y | Y (0.7) | index | " |
| `/academy/apply` | Y | Y | Y | Y | BreadcrumbList | Y | Y | Y (0.7) | index (conversion page — consider whether it should rank; currently fine) | " |
| `/apps` | Y | Y | Y | Y (no image) | BreadcrumbList, Product+Offer ($49) | Y | **N** | **N — missing (gap 2)** | index | Out: Stan store (external). In: header/footer, home Apps section |
| `/books` | Y | Y | Y | Y + cover image ✓ | BreadcrumbList, ItemList of Book+Offer | Y | **N** | **N — missing (gap 2)** | index | Out: Amazon (tagged). In: header/footer, home Books section |
| `/login` | Y (bare `{title}`) | **N** | **N** | **N** | none | N | N | Correctly excluded | **No noindex meta (gap 7)**; robots.ts only `Disallow: /login` | none (correct) |
| `/admin/**`, `/api/**` | — | — | — | — | — | — | — | excluded ✓ | robots.ts Disallow ✓; admin behind auth | — |
| `/llms.txt` | n/a | n/a | n/a | n/a | plain-text AI brief ✓ | — | — | — | — | — |

`robots.ts` is correct in shape (allow all, disallow /admin, /api, /login, sitemap + host declared).

---

## 2. `is_indexable` — current behavior (as asked)

- **Import** (`src/lib/directory/import.ts:182`) and **submission approval** (`src/app/admin/(dashboard)/submissions/actions.ts:74`) hard-code `is_indexable: false` on every row — "SEO inclusion stays a deliberate per-listing admin decision". The only way it becomes true is the manual checkbox in `src/components/admin/directory/ListingForm.tsx:390`.
- **Mapping** (`src/lib/directory/data.ts:83`): `indexable: row.is_indexable ?? false` → `entry.indexable` is `false` for essentially the whole catalog.
- **Where `entry.indexable` is actually consumed**: exactly one place — `listingListSchema()` at `src/lib/directory/seo.ts:120` (`entries.filter((e) => e.indexable)`; returns `null` when the filter empties). Consequence: **every list page's ItemList/LocalBusiness JSON-LD is silently suppressed** on category, state, interstate, exit, top-truck-stops, i-truck-parking, /directory/parking, new-locations, and recently-updated pages. Only the hub's hand-built category ItemList and the detail page's schema survive.
- **Detail pages do NOT use `is_indexable`.** Noindex on `/directory/location/[slug]` is decided by the deterministic completeness gate `isDetailIndexable()` (`src/lib/directory/detail.ts:153` — address+city+state plus ≥2 substance signals). The page emits `robots: noindex` via `buildMetadata({ noindex: !isDetailIndexable(entry) })` (`.../location/[slug]/page.tsx:72`), and `sitemap.ts:155` uses the same gate. `detail.ts:149` and `ranking.ts:163` both document `locations.is_indexable` as an *unused manual override*.
- **Net effect**: detail pages index correctly (complete ones index + sitemap; thin ones render with noindex), but the structured-data layer on every listing hub is dead because it keys off the abandoned flag instead of the gate. Two "indexability" concepts coexist and disagree.

---

## 3. Numbered gaps

1. **ItemList/LocalBusiness schema suppressed on all listing pages** — HIGH
   `src/lib/directory/seo.ts:120` filters on `e.indexable` (always false per `import.ts:182`, `data.ts:83`). Every `listingListSchemaWithReviews`/`listingListSchema` call site (`[category]/page.tsx:136,188,260`, `[category]/[exit]/page.tsx:111`, `[category]/top-truck-stops/page.tsx:67`, `[category]/truck-parking/page.tsx:86`, `parking/page.tsx:78`, `new-locations/page.tsx:53`, `recently-updated/page.tsx:42`) currently renders no listing schema, and the review-enrichment work (AggregateRating/Review) never ships.
   **Fix**: in `seo.ts:120`, replace the filter with the same gate the detail pages and sitemap use: `entries.filter((e) => isDetailIndexable(e))` (import from `@/lib/directory/detail`). One-line change; keeps thin rows out of schema while making complete rows visible. Alternatively (product decision), backfill `is_indexable=true` where `isDetailIndexable()` passes.

2. **`/apps` and `/books` missing from sitemap** — HIGH
   `src/app/sitemap.ts` (static entries, lines 20–46) lists home, /knowledge, /founders, academy, and directory routes but never `/apps` or `/books` — two revenue pages with full metadata and Product/Book schema.
   **Fix**: add both to the static entries block in `sitemap.ts` (e.g. after line 24): `{ url: \`${SITE.url}/apps\`, ... priority: 0.7 }` and the same for `/books`.

3. **Sitewide header/footer links to five nonexistent routes (404s)** — HIGH
   `src/components/layout/Header.tsx:8-16` and `Footer.tsx:11-30` link `/dot-guide`, `/practice-tests`, `/sponsors`, `/contact`, `/videos`; none exists under `src/app` and there are no redirects (`next.config.mjs`, `netlify.toml`, `middleware.ts` checked). Every page ships 5 crawlable 404 links — wasted crawl budget and a soft quality signal against the whole site.
   **Fix**: remove (or comment out) the unshipped items from both NAV arrays until the pages exist, or point them at nearest real equivalents (`/sponsors`→`/founders`, `/dot-guide`→`/knowledge/dot-compliance` if that category exists). Placeholder nav is called out in the Header comment ("Links are placeholders until each module ships") — ship the pruning.

4. **`noindex` also sets `nofollow`** — MEDIUM
   `src/lib/seo/metadata.ts:37`: `robots: opts?.noindex ? { index: false, follow: false } : ...`. Thin listing detail pages (the majority, until data fills in) therefore don't pass link equity to their category/state/exit/nearby links, weakening the internal mesh the detail pages were built to create. Same applies to `/knowledge/search`.
   **Fix**: change to `{ index: false, follow: true }`.

5. **No default OG/Twitter image, no favicon/app icons** — MEDIUM
   `buildMetadata` (`metadata.ts:29,35`) emits `images: undefined` unless a caller passes one; only `/books` does. `public/` contains only `covers/` and `fonts/`; there is no `favicon.ico`, `icon.*`, `apple-icon.*`, or `opengraph-image.*` anywhere under `src/app`. Twitter card is declared `summary_large_image` with no image — shares render bare on every page but /books.
   **Fix**: add a branded 1200×630 default (e.g. `public/og-default.png`), fall back to it in `buildMetadata` (`images: [{ url: opts?.image ?? '/og-default.png' }]`), and add `src/app/icon.png` + `favicon.ico`.

6. **Sitemap detail-URL source capped at 1000 rows** — MEDIUM
   `sitemap.ts:153` uses `getAllPublishedEntries()` → `selectEntries({})` → `.limit(1000)` (`data.ts:114`), ordered featured-then-name. Meanwhile `getPublishedDetailSlugs()` caps at 5000 (`data.ts:266`). Once the catalog passes 1000 published rows, indexable detail pages beyond the first 1000 alphabetical silently vanish from the sitemap while still being prerendered.
   **Fix**: give `getAllPublishedEntries` its own higher cap (match the 5000) or page through results; at minimum align the two caps and leave a comment tying them together.

7. **`/login` is crawl-blocked but not noindex, and has bare metadata** — MEDIUM
   `src/app/login/page.tsx:10`: `metadata = { title: 'Sign in' }` — no description/canonical, and no `robots: noindex`. `robots.ts` `Disallow: /login` prevents crawling but not indexing of the URL if it's linked externally (Google can index the bare URL).
   **Fix**: `export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: false } };`.

8. **`/directory/new-locations?page=N` duplicates canonicalize to page 1** — LOW/MEDIUM
   `new-locations/page.tsx:21-29` — `generateMetadata()` ignores `searchParams`, so pages 2–50 (MAX_PAGE) all declare `canonical: /directory/new-locations` while serving different content. `rel="prev/next"` exist only as anchor attributes (line 101,113), which Google ignores. Canonical-to-page-1 is a tolerated consolidation pattern for a discovery surface, but it's inconsistent to keep 50 crawlable variants.
   **Fix (pick one)**: make `generateMetadata` accept `searchParams` and emit `noindex` for `page > 1`; or self-referencing canonicals per page. Note: `generateMetadata` on searchParams may force dynamic rendering — the noindex-for-page>1 variant is the cheaper call.

9. **BreadcrumbList JSON-LD without visible breadcrumbs on 7 pages** — LOW
   `/directory` (hub), `/directory/map`, `/directory/parking`, `/directory/reviews`, `/directory/submit`, `/apps`, `/books` emit `breadcrumbSchema` but render only an `Eyebrow`, no `Breadcrumbs` component (contrast: every DirectoryHero/PageHero/KC page shows them). Google's guidance is that structured data must reflect visible page content.
   **Fix**: these pages already import from `@/components/ui` — add `<Breadcrumbs crumbs={...}/>` (from `@/components/kc/Breadcrumbs`) above the Eyebrow in each hero block, mirroring the schema crumbs.

10. **`/founders` visible FAQ has no FAQPage schema** — LOW
    `founders/page.tsx:30-47` defines FAQS rendered via `<AcademyFaq faqs={FAQS}/>` (line 142) but the JsonLd (line 56) carries only breadcrumbSchema. The generic `faqSchema()` helper in `src/lib/seo/schema.tsx:69` exists for exactly this (Q/A keys differ: helper wants `{question, answer}`, page uses `{q, a}` — map them, or use `academy-schema.ts`'s faqPageSchema which takes `{q,a}`).
    **Fix**: add `faqPageSchema(FAQS)` (from `@/lib/seo/academy-schema`) to the JsonLd array.

11. **Knowledge not-found branches return indexable metadata** — LOW
    `knowledge/[category]/page.tsx:18` and `[category]/[slug]/page.tsx:32-35` return `buildMetadata({ title: 'Category/Article not found', ... })` without `noindex` before the page body 404s. Next.js still attaches this metadata to the 404 response in some render paths.
    **Fix**: add `noindex: true` to both not-found `buildMetadata` calls (or `return {}` like the directory pages do).

12. **Map page has schema/content asymmetry (informational)** — LOW
    `/directory/map` emits only BreadcrumbList; given the content is a client island, that's reasonable. No action strictly required; a `WebPage`/`Map`-type schema is optional polish.

---

## 4. SAFE TO APPLY NOW (mechanical, no product decisions, no data migration)

1. `sitemap.ts`: add `/apps` and `/books` static entries (gap 2).
2. `metadata.ts:37`: `follow: false` → `follow: true` under noindex (gap 4).
3. `login/page.tsx`: add `robots: { index: false, follow: false }` to metadata (gap 7).
4. `seo.ts:120`: filter with `isDetailIndexable(e)` instead of `e.indexable` (gap 1) — aligns list schema with the gate already trusted by detail noindex + sitemap; pure-function, unit-testable.
5. `founders/page.tsx`: add `faqPageSchema(FAQS)` to the JsonLd array (gap 10).
6. `knowledge/[category]/page.tsx:18` and `[slug]/page.tsx:32`: add `noindex: true` to not-found metadata (gap 11).
7. Add visible `<Breadcrumbs>` to `/directory`, `/directory/map`, `/directory/parking`, `/directory/reviews`, `/directory/submit`, `/apps`, `/books` (gap 9).

Needs a decision first (not in the shortlist): pruning the 404 nav links (gap 3 — which pages are imminent?), default OG image + favicon assets (gap 5 — needs a designed asset), sitemap row-cap alignment (gap 6 — pick the cap), pagination noindex (gap 8 — rendering-mode tradeoff).
