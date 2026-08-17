# Crawl & indexing audit — August 17, 2026

Audit and blueprint only. No application code, data, Supabase, Netlify, DNS,
Search Console, robots, canonical, redirect, or sitemap behavior was changed.
Production database reads (read-only SQL) were used as evidence; nothing was
written.

Prior work this audit builds on (and does not re-litigate):
`docs/seo/directory-seo-audit-2026-07.md` (Milestone 18) and
`docs/seo/technical-seo-audit-2026-08.md` (PRs #284, #287, #289, #290, #291).
Decisions marked **[ACCEPTED]** there are treated as settled unless new GSC
evidence contradicts them; none did.

---

## 1. Executive summary

Google Search Console says: 4,890 sitemap URLs discovered, ~1,080 indexed,
3,810 "Discovered – currently not indexed" with `Last crawled: N/A`, 5
"Excluded by noindex," and important pages like `/academy/curriculum` showing
"Referring page: None detected."

After reconstructing the sitemap URL-by-URL from the code and the production
database, verifying the server-rendered HTML of the built site, and tracing
the noindex gate against every published row, the picture is:

**The site is technically healthy.** There is no crawl blocker, no robots
mistake, no client-side-only navigation, no sitemap/robots contradiction, and
no CDN cloaking. Every navigation surface (header, header menu, footer,
homepage, breadcrumbs, directory cross-links, academy subnav) emits real
anchors in the initial server HTML — verified by curling the production build,
not just reading components.

**The 3,810 not-indexed URLs are dominated by three real causes, in order:**

1. **Normal early processing.** The sitemap is 7 days old, the directory data
   itself is ~5 weeks old, and the database has not changed since July 29 —
   so the entire gap is Google-side pacing, not data churn. ~1,080 pages
   indexed in the first week of a 4,890-URL submission is a normal opening
   pace for a young domain. `Last crawled: N/A` on the examples means Google
   has queued but not yet fetched them; "Referring page: None detected" means
   it has not yet processed the pages that link to them. Neither is a defect
   signal by itself.
2. **91% of the sitemap is programmatic long-tail.** 2,439 listing detail
   pages + 1,292 exit pages + 717 parking-flow pages = 4,448 of 4,890. Of the
   1,292 exit pages, **954 (74%) have exactly one listing** and 210 more have
   two. The 448 direction pages are route-ordered re-sorts of their corridor
   lists. Google's crawl scheduler predicts value before crawling; a young
   domain offering this much long-tail gets crawled slowly. This is the main
   thing to manage — by prioritization and internal linking, not by assuming
   all 4,890 deserve indexing.
3. **The money pages are under-linked.** The academy sub-pages
   (`/academy/curriculum`, `/financing`, …) form a closed cluster: their only
   inbound anchors are from `/academy/*` pages themselves. Nothing in the
   header, footer, or homepage links to any academy sub-page. The
   parking/cat-scales flow trees each hang off a single hub block. The
   highest-revenue pages compete for crawl attention with 4,400 long-tail
   URLs while holding the weakest internal-link positions.

**One genuine defect was found and fully root-caused:** 13 published listing
pages (not 3 — GSC shows examples, not the population) carry `noindex`, every
one solely because `locations.address` is blank. Ten of the 13 are rest
areas, welcome centers, weigh stations, and mobile roadside services —
facility types that legitimately have no street address. The completeness
gate (`isDetailIndexable`) hard-requires a street address, so the site's own
core value proposition — rest-area truck parking — is structurally excluded
from search. The three GSC examples are all content-rich (details in §6).

Two smaller defects: sitemap `lastmod` is reset to "now" for ~2,390 URLs on
every hourly regeneration (teaches Google to distrust it), and `/terms` is
missing from the sitemap.

---

## 2. Verified facts vs. hypotheses

### Verified (from code, production DB reads, or the built site's HTML)

| # | Fact | Evidence |
|---|---|---|
| F1 | Baseline: `main` = `7f9c5f4`, tree clean; lint ✓, typecheck ✓, all 192 test harnesses ✓, production build exit 0. No pre-existing failures. | §3 |
| F2 | Sitemap reconstruction totals **4,888 URLs (±2)** vs GSC's 4,890 — a 99.96% match; composition in §5. | code + DB counts |
| F3 | Production `locations`: 2,830 rows, 2,454 published & non-deleted, all with `detail_slug`. Data frozen since 2026-07-29 (no inserts/updates/deletes since; 0 soft-deleted rows). | SQL |
| F4 | **13** published listing pages are noindex at runtime; **all 13 fail only the street-address precondition; zero fail the signal count.** | SQL mirroring `isDetailIndexable` |
| F5 | The "≥2 signals" bar is effectively "address + ≥1 stored signal": `toEntry` (`src/lib/directory/data.ts`) always injects an "Overnight unknown" chip into `entry.amenities`, so the `amenities.length >= 1` signal is always true for DB rows. | code trace |
| F6 | Sitemap ↔ directives contradictions: **zero.** The sitemap and the detail page share the same `isDetailIndexable` import; noindex families (`/knowledge/search`, practice-test app screens, navigator, admin) are all absent from the sitemap; every sitemap URL is self-canonical (per PR #287/#289 conventions, re-verified). | code trace |
| F7 | All internal navigation is server-rendered. Curling the local production build: `/academy/curriculum` HTML contains its self-canonical link tag, `robots: index, follow`, and all 7 academy subnav anchors. The header's grouped menu is a server-rendered `<details>` element — its anchors are in the HTML byte stream even while visually closed. | rendered HTML |
| F8 | The homepage HTML contains **zero** links to academy sub-pages (only `/academy` ×6 and `/academy/apply` ×5). Header and footer likewise link `/academy` but no sub-page. | rendered HTML |
| F9 | Exit pages: 1,292 total; 954 have one listing, 210 have two, 102 have 3–5, 26 have 6+. | SQL |
| F10 | Sitemap `lastmod`: `new Date()` at generation time for every family except listing details (`updated_at`) and KC articles (`updated_at`). The route revalidates hourly → ~2,390 URLs claim fresh modification every hour. | `src/app/sitemap.ts` |
| F11 | `/terms` exists, is indexable, is footer-linked, and is **not** in the sitemap. | code |
| F12 | robots.txt: allow all except `/admin`, `/api`, `/login`; sitemap + host declared. No middleware or Netlify rules vary responses by user agent; middleware gates Navigator paths only. | code |
| F13 | The store contributes only 15 URLs (hub, shipping-returns, 13 direct products): the 104-product Amazon catalog is hidden (`SHOW_AMAZON_PRODUCTS` off), and category/guide/picks pages gate themselves out of the sitemap when empty. | code + registry eval |
| F14 | All 46 state codes present in published data are valid US states → the sitemap's `stateByCode` filter drops nothing. | SQL |
| F15 | `buildMetadata({noindex:true})` emits `noindex, nofollow` — the 13 gated listing pages also stop passing link equity through their nearby/cross links. | code |
| F16 | Four admin pages export no metadata and inherit `index,follow` + a homepage canonical from the root layout (crawl-blocked by robots.txt, auth-gated, but worth closing). | route inventory |

### Hypotheses (plausible, not provable from the repo)

| # | Hypothesis | Confidence |
|---|---|---|
| H1 | "Referring page: None detected" reflects Google not yet having processed the linking pages, not missing links — the links demonstrably exist in server HTML (F7). Expect attribution to appear as crawl coverage grows. | High |
| H2 | "Alternate page with proper canonical tag: 9" is most likely `?page=N` pagination URLs crawled before PR #287 shipped per-page canonicals, and/or stray parameterized URLs now correctly consolidating. Harmless class; verify the 9 examples in GSC. | Medium |
| H3 | "Crawled – currently not indexed: 4" is routine quality-pass deferral for a young site. | High |
| H4 | Indexing pace is capped mainly by domain-level authority/history signals we cannot observe from the repo (backlinks, traffic). | Medium |

---

## 3. Baseline verification

- Branch `claude/truckinglifeshawn-seo-audit-ihncs3` created from
  `origin/main` at **`7f9c5f4`** ("Production execution package for
  migrations 047 (history repair) + 049-053 (#327)"); working tree clean.
- `npm ci` clean install (no packages added or upgraded).
- `npm run lint` — ✔ no warnings or errors.
- `npm run typecheck` — ✔.
- `npm test` — ✔ all **192 harnesses** pass (includes the existing
  `sitemap-contract` harness).
- `npm run build` — ✔ exit 0.
  - **Caveat:** this audit environment's egress policy blocks direct HTTPS to
    Supabase and to the production site, so the build exercised the
    documented fail-soft paths (DB-driven prerender lists empty, on-demand
    rendering at runtime). This matches the code's stated design
    ("a build that cannot reach the database should prerender nothing and
    let pages render on demand, not fail the build") and does not represent
    a Netlify production build's prerender coverage. Live-URL checks in this
    audit were therefore performed against a locally served production build,
    and production-data assertions via read-only SQL.
- Pre-existing failures: **none.**

---

## 4. URL-family inventory

Counts are from production data (frozen since Jul 29) and code registries at
`7f9c5f4`. "In sitemap" and "robots" verified from code; internal-link
sources verified in rendered HTML.

| Family | URLs | Value | Intended index? | Robots today | Sitemap | Server-rendered inbound links | Thin/dup risk | Recommended action |
|---|---:|---|---|---|---|---|---|---|
| Homepage `/` | 1 | High | Yes | index | ✓ | everywhere | — | index |
| Academy `/academy/*` | 9 | **Highest (applications)** | Yes | index | ✓ | header/footer/homepage → `/academy` only; sub-pages only from academy cluster | none | index + **strengthen inbound links** |
| CDL Pre-School (3) | 3 | **Highest** | Yes | index | ✓ | header, footer, homepage | none | index |
| Knowledge hub + categories + articles | 59 | High (informational) | Yes | index | ✓ | header/footer/homepage; article cross-links | low | index |
| `/knowledge/search` (+ `?q=`) | 1 (∞ params) | None | **No** | noindex ✓ | not listed ✓ | search box | — | keep excluded |
| Directory hub/static (map, submit, reviews, recently-updated, new-locations) | 6 | Medium | Yes | index | ✓ | header/footer/hub | — | index |
| Directory categories | 9 | High | Yes | index | ✓ | hub cards, footer (`/directory/parking`) | low | index |
| State pages `/directory/[state]` | 46 | High (local queries) | Yes | index | ✓ | hub chips, RelatedLinks, details | low | index + template lift |
| `/directory/[state]/top-truck-stops` | 46 | High | Yes | index | ✓ | state pages | medium | index + template lift |
| Corridor `/directory/i-XX` | 80 | High | Yes | index | ✓ | hub chips, RelatedLinks | low | index |
| `/directory/i-XX/truck-parking` | 80 | High (parking intent) | Yes | index | ✓ | corridor pages | medium | index + template lift |
| Exit pages `/directory/i-XX/exit-YY` | 1,292 | Long-tail | Selectively | index | ✓ | corridor exit nav, prev/next, details | **high (74% single-listing)** | index but deprioritize; monitor via segmented sitemap |
| Parking flow state/corridor | 269 | Medium | Yes | index | ✓ | `/directory/parking` tree only | medium | index; cross-link with engine pages |
| Parking flow direction pages | 448 | Low-medium | Provisional | index | ✓ | parent flow step only | **high (re-sorts of corridor lists)** | keep index, monitor; canonicalize to corridor step if they underperform (owner decision) |
| Cat-scales flow (13+18+36) + near-me | 68 | Medium | Yes | index | ✓ | `/directory/cat-scales` tree | medium | index |
| Listing details `/directory/location/[slug]` | 2,454 (2,441 indexable / 13 noindex) | High in aggregate; feeds Navigator | Yes (gated) | conditional | gate-passing only ✓ | EntryCards (first 30/12), NearbySections, exit/state/corridor pages | medium | fix gate (§6); index |
| Apps/tools (`/apps`, `/dot-tools`, `/tools/hos-calculator`) | 3 | High (product revenue) | Yes | index | ✓ | header menu, footer, homepage ×2 | none | index |
| Trip planner (2) | 2 | Medium-high | Yes | index | ✓ (classic not listed) | header menu, footer | — | index |
| Store (visible) | 15 | Medium | Yes | index | ✓ | header menu, footer | low | index |
| Practice tests landings | 7 | Medium-high | Yes | index | ✓ | header, homepage | — | index |
| Practice test app screens (study/timed/bookmarks/missed) | 14 | None (app) | **No** | noindex ✓ | not listed ✓ | test landings | — | keep excluded |
| Founders, sponsors, road-ahead, books, supply-the-classroom, legal | 8 | Medium | Yes | index | ✓ (`/terms` missing) | footer/homepage | — | index; add `/terms` to sitemap |
| Navigator/drive (4) | 4 | None (gated app) | **No** | noindex ✓ | not listed ✓ | none public | — | keep excluded |
| Admin (31) + `/api` (25) + `/go/[slug]` | — | None | **No** | noindex / robots-blocked / 302 | not listed ✓ | none | — | keep excluded; add missing noindex metadata to 4 admin pages |

**Which families deserve indexing:** everything above marked "Yes." The two
families that do *not* automatically deserve their current index-eligible
status at full scale are **single-listing exit pages** (954) and **direction
pages** (448) — keep them eligible for now, but measure them as their own
sitemap segments and be willing to consolidate (canonicalize direction →
corridor step; prune sitemap entries for zero-value exits) if 30–60-day data
shows Google ignoring them. Do not assume all 4,890 should be indexed.

---

## 5. Sitemap composition (the 4,890 reconstructed)

`src/app/sitemap.ts` at `7f9c5f4` against production data:

| Block | URLs |
|---|---:|
| Listing detail pages (gate-passing) | 2,439 |
| Exit pages (80 corridors × canonical exits) | 1,292 |
| Parking flow: 45 states + 224 state×corridor + 448 directions | 717 |
| Corridor pages + `/truck-parking` (80 × 2) | 160 |
| State pages + `/top-truck-stops` (46 × 2) | 92 |
| Cat-scales flow (13 + 18 + 36) + `/near-me` | 68 |
| Knowledge Center (6 categories + 52 articles) | 58 |
| Store (hub + shipping-returns + 13 direct products) | 15 |
| Directory static (hub, map, submit, reviews, recently-updated, new-locations) + 9 categories | 15 |
| Top-level statics (road-ahead, trip-planner, books, apps, sponsors, dot-tools, hos-calculator, supply-the-classroom, privacy, sms-terms) | 10 |
| Academy | 9 |
| Practice tests (hub + 6 landings) | 7 |
| Head block (/, /knowledge, /founders) + CDL Pre-School (3) | 6 |
| **Total** | **4,888** |

GSC reports 4,890 (±2 residual — a minor facet/registry edge; immaterial).

Findings:

- **No non-indexable, redirected, canonicalized-elsewhere, or parameterized
  URLs are present.** The detail-page block uses the same `isDetailIndexable`
  gate as the page's own metadata, so the sitemap cannot list a noindex
  detail page. Verified zero contradictions (F6).
- **`lastmod` is inaccurate for ~2,390 URLs** (F10): every non-detail,
  non-article entry stamps generation time, and the route regenerates hourly.
  Google's documented response to unreliable lastmod is to ignore it —
  which forfeits a real recrawl-prioritization signal. Listing details
  already carry true `updated_at`; the rest should carry a stable date or
  omit the field.
- **Missing URLs:** `/terms` (only gap found). `/trip-planner/classic`
  is also unlisted — acceptable (near-duplicate of `/trip-planner`), record
  as intentional.
- **Stale DB records / low-value combos:** none found; all rows are live
  (0 deleted) and facet-backed pairs only are listed.
- **One sitemap vs. an index:** 4,890 is nowhere near any protocol limit
  (50,000 URLs / 50 MB per file). The reason to split is **diagnostics**:
  today, "1,080 of 4,890 indexed" cannot be decomposed by family from GSC.
  A sitemap index with child sitemaps (core+academy+KC / states+corridors /
  exits / details / flows) makes GSC report Discovered/Indexed per family —
  which is exactly the measurement §14 needs. Recommended on those grounds
  alone.

---

## 6. Robots, noindex, and canonical findings

### The three GSC noindex examples — root cause, proven

`isDetailIndexable` (`src/lib/directory/detail.ts:154`) requires
`address && city && state`, a registry category, then ≥2 of 6 signals. Two
findings change how that reads in practice:

1. **The amenities signal is always true** for DB rows (F5): `toEntry`
   unconditionally appends an overnight-status chip ("Overnight unknown" when
   null) to `entry.amenities`. So the deployed gate is: **street address +
   any one real signal.**
2. Therefore **every one of the 13 noindexed pages fails on `address` alone**
   (SQL-verified: 13 missing-address failures, 0 low-signal failures).

The three GSC examples, with their actual production field values:

| Slug | Category | What it has | Why noindexed |
|---|---|---|---|
| `after-hours-road-service-inc-naples-fl` | roadside-service | phone, website, 290-char description, I-75 | **No street address** (mobile service — has none by nature) |
| `collier-county-rest-area-alligator-alley-milepost-63-alligator-alley-fl` | parking | 333-char description, amenity, I-75 | **No street address** (rest area at milepost 63 — has none) |
| `i-75-bay-city-rest-area-southbound-bay-city-mi` | parking | 33 truck spaces, 133-char description, I-75 | **No street address** (rest area — has none) |

The full affected population (13, not 3): 5 rest areas/welcome centers,
5 roadside/mobile services, and 3 fixed businesses whose address is simply
missing data (a Flying J CAT scale, a Days Inn, a TA truck service center —
plus `yellow-hammer-travel-center-brewton-al` and
`ta-truck-service-lake-city-lake-city-fl`). GSC lists 3 because it reports
examples, not the population; expect the count to grow toward 13 as coverage
completes.

**Verdict:** the three example pages *should* be indexed — they carry unique,
verifiable driver utility (a 33-space rest area on I-75 is precisely the
site's core content). The gate's street-address precondition is wrong for
facility types that are located by corridor + milepost/exit rather than by
street. Rest-area coverage is structurally suppressed: sampling the import
corpus shows ~31% of rest-area-named records pass the gate vs 96–97% for
truck stops and CAT scales.

**Keep excluded:** `/knowledge/search` and its `?q=` variants are correctly
noindexed (confirmed in rendered HTML: `noindex, nofollow`) and correctly
absent from the sitemap. No change.

### Other robots/canonical findings

- `buildMetadata` maps `noindex: true` → `noindex, nofollow` (F15). For app
  screens that's fine; for the 13 gated listing pages `follow` would let
  their internal links still pass equity. Minor; fold into the gate fix.
- Four admin pages lack metadata and inherit `index,follow` + homepage
  canonical from the root layout (F16). Robots.txt disallow + auth redirect
  make this near-zero exposure (a robots-blocked URL can still be indexed
  URL-only if externally linked); close it with explicit noindex metadata for
  hygiene.
- Parking/cat-scales flow `generateMetadata` builds indexable self-canonical
  metadata from raw params before the component 404s unknown states (unlike
  the engine/store/KC miss convention of returning `{}`). The response is
  still a 404, so nothing indexes; cosmetic inconsistency, worth aligning
  when touched.
- Redirects: the five `next.config.mjs` redirects and the DB-backed listing
  slug 301s are chain-free (enforced by `test-route-redirects.ts`). No
  redirected URL is in the sitemap.

---

## 7. Crawlability and internal-link findings

**Answer to "are important links crawlable in raw HTML": yes, everywhere.**
Verified two ways: component-level trace of every nav surface, and grep of
the served production HTML.

- Header: server component. Desktop nav (6 links) and the grouped
  `<details>` menu (18 links across School/Learn/Drive/More) are in the HTML
  stream regardless of open state. No mount gates, no hover-only rendering.
- Footer: server component, 17 internal links on every page.
- Academy subnav: `'use client'` but renders its `LINKS` array
  unconditionally — all 7 anchors present in `/academy/curriculum`'s served
  HTML (verified). `usePathname` only styles the active item.
- Directory: hub → state/corridor chips, breadcrumbs, RelatedLinks
  ("Keep exploring"), prev/next exits, NearbySections, and EntryCards' first
  30 (category) / 12 (grouped) cards are all server-rendered anchors.
  Entries beyond those cutoffs are reachable via nearby modules and the
  sitemap.
- `ssr: false` components (map explorer, near-me, road-ahead cinematics) are
  never the sole path to any route.
- No JS-only navigation, no crawl-relevant redirect chains, no bot-variant
  responses (middleware touches Navigator paths only), no query-parameter
  crawl traps (filters are client-state; paginated URLs carry per-page
  canonicals with a 50-page cap).

**The real topology weaknesses:**

1. **Academy sub-pages are a closed cluster** (F8): reachable only via
   `/academy` (header/footer/homepage link the hub, never the sub-pages).
   One crawl hop below a single parent, zero cross-cluster anchors. This —
   plus Google simply not having crawled the linking pages yet (H1) — is the
   full explanation of "Referring page: None detected." No rendering fix is
   needed; a linking fix is.
2. **Flow trees hang from single blocks** (`/directory/parking` and
   `/directory/cat-scales` hubs). No engine↔flow cross-links (recorded
   [ACCEPTED] in the Aug audit as a navigation-design item; the GSC
   examples `/directory/cat-scales/al`, `/directory/cat-scales/al/i-65`
   being un-crawled a week in says it's now worth doing).
3. **Link depth:** money pages sit at depth 1–2; exit pages at depth 3;
   direction pages at depth 4; details at depth 2–4. Sane, but the
   4,400-URL long tail outnumbers the ~90 high-value URLs 50:1 in the crawl
   frontier.
4. `cat-scales/near-me` is a crawl leaf (client-gated listing links) — known,
   accepted.

**Why are 3,810 URLs "known only through the sitemap"?** Because Google has
not yet crawled the pages that link to them (every example shows
`Last crawled: N/A`) — link attribution requires fetching the linking pages,
and a week into a 4,890-URL submission on a young domain, Google has fetched
only a fraction. The internal-link graph in the HTML is real; Google just
hasn't walked it yet. The fix is to make the walk shorter for pages that
matter (§10) and let time do the rest.

---

## 8. Page-quality findings by template

Sampled per family (code + rendered structure + production field coverage):

- **Academy (9 pages):** unique titles/descriptions/H1s, Course + FAQ schema,
  substantial hand-written copy. The conversion path (`/academy/apply`) is
  clean. Weaknesses: sub-pages under-linked (§7); the Aug audit's **[OWNER]**
  flag on operational claims stands (Course schema asserts an onsite Dalton
  CourseInstance while `/academy/facility` says the street address is TBA —
  a trust/YMYL risk if enrollment reality lags the copy).
- **State pages:** parameterized metadata, keyword H1, data-driven FAQ +
  "Keep exploring" blocks, ItemList schema. Good. Counts per state vary
  widely; low-coverage states (a handful of listings) read thin but honest.
- **Corridor + `/truck-parking` pages:** strongest templates (live counts,
  route-ordered states, FAQ). Good.
- **Exit pages:** unique count-and-city-bearing descriptions (July fix),
  prev/next linking, nearby modules, FAQ. But 74% have one listing — the
  unique value is the nearby module, which overlaps heavily between adjacent
  exits. Genuine utility, weak differentiation at scale.
- **Direction pages:** same corridor list re-sorted; honest labeling
  (approximate route order), ItemList + breadcrumbs (PR #289), but generic
  H1 ("Parking ahead") on every one, and content is a strict subset-reorder
  of the corridor step above it. Highest duplicate-risk family.
- **Listing details:** unique titles/descriptions composed from listing
  facts, LocalBusiness/Place schema with gated ratings, breadcrumbs, nearby
  sections, review module, correction paths, Navigator/funnel CTAs
  (`ListingFunnelCtas`), sponsor slots. Solid template; quality tracks data
  completeness. No AI-spun boilerplate anywhere — descriptions are stored
  per-listing facts (mean length verified >100 chars on the noindex set;
  spot-checked accurate).
- **Knowledge Center:** real articles with sources, FAQ schema,
  `reg_verified` flags. Good.
- **Conversion opportunities present:** detail pages → Navigator funnel +
  "Get featured"; academy → apply; parking pages → trip planner. **Gaps:**
  no email-capture on directory templates; state/corridor pages don't link
  the Academy (e.g., GA pages → Dalton school); exit pages don't pitch the
  trip planner.

No recommendation here involves mass-generating text. Template improvements
should surface more of the *stored, verified* data (spaces, overnight status,
mile markers when verified) and add real cross-links, not paragraphs.

---

## 9. Root causes, ranked by confidence × impact

| Rank | Cause | Confidence | Impact on the 3,810 | Fixable by us? |
|---|---|---|---|---|
| 1 | Normal early processing (7-day-old sitemap, young domain, stable DB) | High | ~60–70% of the gap will close on its own over 4–8 weeks | No — only measurable (§14) |
| 2 | Long-tail programmatic weight (74% single-listing exits, 448 re-sort direction pages) suppressing predicted crawl value | High | Slows everything, including money pages | Partly — prioritize, segment, consolidate |
| 3 | Weak internal-link topology to money pages (closed academy cluster, single-block flow trees) | High | Directly delays the ~90 highest-value URLs | **Yes — cheap** |
| 4 | Address-only noindex gate excluding 13 valuable pages incl. rest areas (structural for the category) | **Certain** | Small count today; large for parking-value as rest-area coverage grows | **Yes** |
| 5 | `lastmod` churn discarding a recrawl signal | High (defect), Medium (impact) | Marginal | **Yes — trivial** |
| 6 | noindex,nofollow on gated listings; `/terms` missing; 4 admin pages without metadata | Certain (defects), Low (impact) | Negligible | **Yes — trivial** |

---

## 10. Exact proposed changes (for the follow-up implementation PRs)

**PR-A — Contract hardening + sitemap hygiene (safest first slice; no
behavior change to any indexable page):**
1. Add `/terms` to `topLevelPaths` in `src/app/sitemap.ts`.
2. Stop stamping `now` as `lastmod`: omit `lastModified` for URLs with no
   real modification date; keep true `updated_at` for details and KC
   articles. (Omitting is Google-safe and honest.)
3. Extend the sitemap-contract test harness to lock today's verified
   invariants: no noindex family ever appears in the sitemap
   (`/knowledge/search`, practice app screens, navigator, admin); every
   detail entry passes the indexability gate; every emitted URL is
   self-canonical (path formats lowercase); `/terms` present; no duplicates.
4. Add explicit `noindex` metadata to the four metadata-less admin pages.

**PR-B — Fix the accidental noindex (the address gate):**
1. In `isDetailIndexable`, replace the hard `entry.address` requirement with
   a *location-identity* requirement: `address` **or** (`interstate` and
   (`exitNumber` or `mileMarker`)) **or** verified coordinates — plus the
   existing `city && state && category`.
2. Make the signal count honest: count **stored** amenities (not the
   rendered chip array) — or equivalently compute the gate on raw fields —
   and keep the bar at ≥2. Expected deltas, precomputed from production
   data: **+13 pages become indexable; −2 pages
   (`cat-scale-circle-k-pelham-pelham-al`, the Georgetown KY weigh station)
   drop to noindex** because their only real signal is a description. Owner
   sign-off on those two (or keep the bar at ≥1 real signal; then −0).
3. Change gated listings to `noindex, follow` semantics (add a `follow`
   option to `buildMetadata` or a second flag) so thin pages still pass
   equity.
4. Because sitemap + detail page + ItemList + ranking all import the same
   gate, this is a one-function change with wide, consistent effect.
5. Separately (owner, data-side, no code): backfill the 3 genuinely missing
   street addresses (Flying J Miami CAT scale, Days Inn Wildwood, TA Lake
   City, Yellow Hammer Brewton) via the admin editor.

**PR-C — Server-rendered links to money pages:**
1. `Header.tsx` `MENU_GROUPS` School group: add `/academy/curriculum` and
   `/academy/financing`.
2. `Footer.tsx` School column: add curriculum, financing, requirements.
3. Homepage Academy section cards: link curriculum + financing (not just
   `/academy` ×6).
4. Engine↔flow cross-links: state pages ⇄ `/directory/parking/[state]` and
   `/directory/cat-scales/[state]`; corridor pages ⇄ their flow corridor
   steps (extend `scope-links.ts` so links only render when facet-backed).
5. KC article templates: contextual links to `/academy/curriculum` and
   `/academy/financing` where category-appropriate (e.g. `trucking-careers`).

**PR-D — Sitemap segmentation (diagnostics):**
Split via Next's `generateSitemaps` into: `core` (statics + academy + CDL +
KC + store + tests), `directory-hubs` (categories/states/corridors/flows
steps), `directory-exits`, `directory-details`, `directory-directions`.
Submit the index in GSC after deploy. Justification is monitoring and
prioritization only — 4,890 is far below any sitemap limit.

**PR-E / PR-F — Template + conversion improvements** (academy/CDL content
depth per the Aug audit's [OWNER] items once resolved; state/corridor/detail
template data-surfacing; email capture on directory templates; trip-planner
CTAs on exit/corridor pages; Navigator funnel links from parking flows).

## 11. Files expected to change

| PR | Files |
|---|---|
| A | `src/app/sitemap.ts`; `scripts/test-sitemap-contract.ts` (or sibling new harness); 4 admin `page.tsx` files |
| B | `src/lib/directory/detail.ts`; `src/lib/seo/metadata.ts` (follow flag); `src/app/(directory)/directory/location/[slug]/page.tsx` (flag pass-through); gate tests (`scripts/test-*detail*`); sitemap-contract expectations |
| C | `src/components/layout/Header.tsx`, `Footer.tsx`; homepage academy section component; `src/lib/directory/scope-links.ts` + `RelatedLinks.tsx`; flow step pages; KC article template |
| D | `src/app/sitemap.ts` → `src/app/sitemap/[id]` or `generateSitemaps` in place; `robots.ts` sitemap pointer; sitemap-contract harness |
| E/F | academy pages, directory templates, CTA components |

## 12. Tests and acceptance criteria

- Every PR: `npm run lint && npm run typecheck && npm test` green; the
  sitemap-contract harness green.
- PR-A: snapshot test proving sitemap composition counts by family; test
  that no noindex-family URL is emitted; `/terms` present; no `lastModified`
  on undated entries.
- PR-B: unit tests for the new gate truth table (address-less rest area with
  spaces+description → indexable; address-less thin row → noindex; the two
  known downgrades asserted explicitly); test that sitemap and page metadata
  agree for every fixture; count-delta test pinned to +13/−2 (or +13/−0 per
  owner choice).
- PR-C: rendered-HTML tests (react-test-renderer, per existing harness
  style) asserting the new anchors exist in Header/Footer/homepage output.
- PR-D: contract test that the child sitemaps partition the same URL set
  (union = old set, pairwise disjoint).
- Production acceptance after each deploy batch: curl the live sitemap(s),
  spot-check 10 URLs per changed family for status 200 + expected
  robots/canonical in served HTML **before** any GSC action.

## 13. Rollback plan

Each PR is an independent, small, revertible commit; none touches data.
- PR-A/D: revert restores the single-sitemap output; GSC keeps accepting the
  old `/sitemap.xml` path (keep it emitting the index at the same URL so no
  GSC re-submission is needed on rollback).
- PR-B: revert restores the previous gate; pages flip back to their prior
  robots state on next revalidation (300 s) — no migration, no data change.
- PR-C: revert removes links; no crawl harm.
- The Netlify deploy history provides instant rollback of any batch
  independent of git revert.

## 14. Google Search Console actions (only after production verification)

1. After PR-A/D deploy + live spot-checks: submit the sitemap index; leave
   the old submission in place until child sitemaps show "Success," then
   remove it.
2. After PR-B deploy: URL-inspect the three example location pages, confirm
   "Indexing allowed: Yes," then Request Indexing for those three (and the
   other 10 affected once spot-checked). Only then press **Validate Fix** on
   the "Excluded by 'noindex'" report — with the expectation it validates
   only the location pages; the two `/knowledge/search` URLs will
   (correctly) remain excluded, so expect a "partial" validation outcome.
3. After PR-C deploy: Request Indexing for the ten priority pages (§16).
4. Weekly: export Pages report per child sitemap; no other GSC changes.

## 15. Measurement plan (7 / 14 / 30 / 60 days)

Guard against confusing normal Google processing with our effect:
**(a)** the segmented sitemaps make family-level Indexed/Discovered counts
observable; **(b)** hold back one family as a control — make no changes to
**exit pages** in the first 30 days, so their indexation velocity approximates
the "Google processing only" baseline; **(c)** annotate every deploy date
against the GSC charts.

| Checkpoint | Expect / decide |
|---|---|
| Day 7 | Sitemap index read; per-family baselines recorded; 13 location pages show "Indexing allowed" on inspection. No conclusions yet. |
| Day 14 | Money pages (academy sub-pages, CDL, flow hubs) move Discovered→Crawled at a faster rate than the exit-page control. "Referring page" starts populating for academy sub-pages. If not: investigate crawl stats report (fetch latency, host load). |
| Day 30 | Indexed counts by family vs control; decide direction-page question (keep vs canonicalize) and whether single-listing exits stay in the sitemap. Academy/CDL impressions trend in Performance report. |
| Day 60 | Full re-audit against this document; revenue-page rankings (academy terms, "truck parking I-75" class queries); prune or consolidate what Google has demonstrably declined to index. |

Success is **not** "all 4,890 indexed" — that outcome is neither promised nor
desirable. Success is: all ~90 money pages indexed; detail-page indexation
majority; exit/direction families consciously kept, pruned, or consolidated
on 30–60-day evidence.

## 16. Prioritized 60-engineer-hour implementation plan

Ordered per the mandated sequence; ranked within by expected revenue impact
(1. Academy/CDL applications → 2. parking/location discovery feeding
Navigator → 3. high-impression local/corridor pages → 4. KC informational →
5. long-tail directory combos).

| # | Work | Hours | Maps to |
|---|---|---:|---|
| 1 | Protect intentional exclusions + eliminate contradictions: PR-A (tests locking noindex families out of the sitemap, `/terms`, lastmod honesty, admin metadata) | 6 | PR-A |
| 2 | Fix accidental noindex: gate redesign + truth-table tests + follow semantics + address-backfill list for owner | 8 | PR-B |
| 3 | Server-rendered links to money pages: header/footer/homepage academy links; engine⇄flow cross-links; KC→academy contextual links; rendered-HTML tests | 8 | PR-C |
| 4 | Sitemap diagnostics/segmentation (justified in §5): index + 5 child sitemaps + partition test | 6 | PR-D |
| 5 | Academy + CDL page improvements: resolve [OWNER] copy/schema claims, deepen curriculum/financing content, FAQ expansion, apply-flow polish | 10 | PR-E |
| 6 | State/corridor/location template improvements: surface stored data (spaces, overnight status, mile markers), state→academy links for GA/TN corridor, top-truck-stops enrichment | 10 | PR-F |
| 7 | Conversion paths: email capture on directory templates; trip-planner CTAs on corridor/exit pages; Navigator funnel links on parking flows; CDL-apply banners on GA-relevant pages | 6 | PR-F |
| 8 | Automated SEO regression suite: consolidate the above assertions into `npm test` (metadata contracts per family, sitemap partition, link-presence) | 3 | A–F |
| 9 | Controlled batch deploys: A → B → C → D → E/F, each with live spot-check protocol (curl status/robots/canonical on 10 URLs per family) | 2 | ops |
| 10 | GSC validation pass per §14 only after production verification | 1 | ops |
| | **Total** | **60** | |

---

## 17. Acceptance-criteria answers (summary)

1. **Why are 3,810 URLs known only through the sitemap?** Google hasn't yet
   crawled the pages that link to them (all examples: `Last crawled: N/A`);
   the links exist in server HTML. Compounded by: 91% of the sitemap being
   long-tail programmatic URLs that depress predicted crawl value, and money
   pages holding weak link positions (closed academy cluster, single-block
   flow trees). Mostly normal early processing; partly topology.
2. **Are important navigation links crawlable in raw server HTML?** Yes —
   verified by curling the production build. Header, closed `<details>`
   menu, footer, subnav, breadcrumbs, cards, cross-links: all real anchors
   in initial HTML. No SSR gap exists.
3. **Why are the three location pages noindex?** The `isDetailIndexable`
   gate hard-requires a street address; all three (and 10 more — 13 total)
   have none. Two are rest areas and one is a mobile roadside service —
   types that legitimately lack street addresses. All three carry enough
   real signals to pass the rest of the gate. The "≥2 signals" clause is
   effectively "≥1" due to the always-present overnight chip; address is the
   only condition doing any work.
4. **How many sitemap URLs contradict their indexing directives?** Zero
   (verified: shared gate, noindex families absent, all self-canonical).
   PR-A locks this with tests.
5. **Which URL families deserve indexing and which do not?** See §4 table.
   Keep excluded: knowledge search, practice app screens, navigator, admin,
   API. Index everything else, with exit pages (74% single-listing) and
   direction pages (re-sorts) held under explicit 30–60-day review rather
   than assumed valuable.
6. **First ten pages for optimization + internal linking:**
   `/academy`, `/academy/curriculum`, `/academy/financing`,
   `/academy/requirements`, `/academy/cdl-school-dalton-ga`,
   `/cdl-pre-school`, `/directory/parking`, `/directory/i75/truck-parking`,
   `/directory/georgia`, `/apps`.
7. **Safest first implementation PR:** PR-A — tests + `/terms` + lastmod +
   admin noindex. Zero indexable-page behavior change, converts this
   audit's verified invariants into regression protection.
8. **How will we prove improvement vs. normal delay?** Segmented sitemaps
   for family-level GSC counts, an unchanged exit-page control cohort,
   deploy-date annotation, and the §15 decision gates.

## 18. Dangerous findings (owner attention)

- **Academy operational claims** (carried from the Aug audit, still open):
  Course schema + present-tense enrollment copy vs. an unannounced facility
  address. If FMCSA/ELDT registration isn't complete, this is a
  trust/compliance exposure on the site's highest-revenue pages — resolve
  before spending the PR-E hours promoting them.
- **Netlify cached-404 class on exit pages** (documented open defect:
  `/directory/i75/exit-369` once served a cached 404 with 11 published
  rows): if it recurs while Google crawls the 1,292 exit URLs, sitemap URLs
  returning 404 would damage crawl trust. The segmented exit sitemap makes
  this observable; treat any GSC 404 spike there as this defect resurfacing.
- **TikTok handle conflict** (site-wide `sameAs` vs. homepage deep links)
  remains unresolved — one is wrong; external verification blocked from this
  environment.

## 19. Decisions requiring owner approval

1. Gate redesign trade (PR-B): accept the two thin currently-indexed pages
   dropping to noindex, or keep the effective ≥1-signal bar.
2. Address backfill for the 3–4 fixed businesses (data change, admin UI).
3. Header/footer/homepage link additions (visible UI change).
4. Direction-page policy at day 30 (keep vs canonicalize-to-corridor).
5. Academy schema/copy claims (§18) before PR-E content investment.
6. GSC sitemap-index resubmission timing (§14).
