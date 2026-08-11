# Technical SEO audit — August 2026 (post-sitemap, Blocks A–J)

Scope: the full public surface after PR #284 shipped the complete ~4,890-URL
sitemap. Audit-first per the Master Blueprint: findings below are either
**[FIXED — PR #N]** (a focused draft PR: #287 pagination canonicals, #289 structured data, #290 Open Graph, #291 redirect/link hygiene), **[OWNER]** (a decision or action
only the owner can take), or **[ACCEPTED]** (real but low-exposure, documented
so it isn't rediscovered — with the reason it wasn't changed).

Baseline verified before anything was touched: main `b47d646`, #284 merged,
sitemap harnesses green, no SEO-surface change since #284 (Navigator work only).

## A. Canonicals / noindex / query strings

All 60 public pages build metadata through `buildMetadata()` — no page misses
a canonical on its success path, no `path` mismatches its route, and the
case-insensitive slug resolvers all emit lowercase canonicals, so case
variants can't split index signals. `/knowledge/search` (noindex), practice
runners (noindex), `/directory/map` and `/sponsors` (params stripped by
canonical) are all correct. Trailing slashes 308 to the clean form (Next
default; no `trailingSlash` override).

Defects found and fixed **[FIXED — PR #287]**:

1. `/directory/new-locations?page=2..50` — up to 50 real, linked, indexable
   URLs all carried page 1's canonical and one identical title. Pages 2+ now
   carry their own `?page=N` canonical and a `— Page N` title, parsed by the
   same function the component uses.
2. `/knowledge/[category]?page=N` — same defect, with numbered pagination
   links exposing every page from page 1. Same fix.
3. Store `category`/`guides`/`products` unknown-slug branches emitted
   `noindex` metadata whose canonical (the `buildMetadata` default path)
   pointed at the **homepage**. Now `{}` — no canonical, no robots — matching
   the directory pages' miss convention.
4. KC category/article miss branches emitted **indexable self-canonical**
   metadata for URLs that then 404. Now `{}`.

**[ACCEPTED]** Out-of-range pages (`?page=40` past the data) still 200 with an
empty shell rather than 404. Nothing links to them (pagination stops at the
content edge), so exposure is a soft-404 Google drops on its own. A hard 404
would require strict (non-fail-soft) reads to avoid caching a false 404 on a
DB blip — the exact incident class the directory's read contract exists to
prevent. Not worth that risk for unlinked URLs.

## B. Open Graph / social cards

Already in place: `buildMetadata()` emits OG title/description/url/siteName +
Twitter `summary_large_image` on every page; a root `opengraph-image.tsx`
(brand card, edge-generated from SITE constants) covers every route without a
more specific card; `/cdl-pre-school` has its own segment card; KC articles
pass `hero_image_url` through when set.

**[FIXED — PR #290]** Segment-level brand cards for the major route
families (`/academy`, `/directory`, `/knowledge`, `/practice-tests`,
`/store`), following the existing root/pre-school card pattern. Brand-driven
only — the Blueprint's preferred real photography is not in the repository,
so none was faked. **[OWNER]** When real Shawn/trucking photography lands,
these cards are the place to upgrade first (drop-in replacement per segment).

## C. Structured data / JSON-LD

Already strong: site-wide Organization/Person/WebSite with stable `@id`s from
the root layout; BreadcrumbList on effectively every public page; Article +
FAQ on KC articles; Course + FAQ on Academy pages; LocalBusiness/Place with
gated ratings on listing detail pages; Product schema properly gated on
verified data in the (currently hidden) Amazon store; Quiz on test landings;
Book on `/books`; Course+Offer on `/cdl-pre-school` with a documented price
constant. No fabricated dates, prices, or ratings reach JSON-LD.

Fixed **[FIXED — PR #289]**:

1. `JsonLd` serialized user-influenced strings (approved review bodies, DB
   article text) into `<script>` without escaping `<` — a script-breakout
   risk. Now escaped (`<`).
2. `ItemList` on every directory list page was dead code: it filtered on the
   manual `locations.is_indexable` column, which is false on every row (two
   in-repo comments say so), while detail pages/sitemap use the deterministic
   `isDetailIndexable()` gate. Lists now use the same deterministic gate, so
   the July audit's documented intent ("only indexable entries") actually
   emits.
3. The six corridor-flow pages emitted zero structured data; they now emit
   BreadcrumbList (matching their visible eyebrow trail), and the two
   `[direction]` pages emit the same gated ItemList as other list pages.
4. `/apps` hard-coded `price: '49.00'` in JSON-LD separate from the visible
   price — unified to one constant so they cannot drift.
5. KC articles with no tags emitted `keywords: ""` — now omitted.

**[OWNER — decisions required, no code changed]**:

- **Academy operational claims.** `courseSchema` asserts an onsite
  CourseInstance in Dalton while `/academy/facility` says "street address to
  be announced"; the Dalton landing FAQ speaks in the present tense ("is a
  Class A CDL school… offers ELDT-compliant training") while tuition and
  address are unpublished; `educationalCredentialAwarded` implies ELDT
  delivery but no FMCSA Training Provider Registry number appears anywhere in
  the repo. If the school is not yet enrolling/registered, this language (and
  schema) should move to future tense until it is. Copy and regulated claims
  are the owner's call — flagged, not changed.
- `SITE.founder.credential` ("17 years driving, zero violations") is the
  site's load-bearing E-E-A-T claim, emitted site-wide in Person schema. Keep
  a source document (MVR/PSP) on file.
- `/books` visible badge "Bestseller · 4.8★ on Amazon" is unsourced (correctly
  NOT in schema); `bookFormat: Paperback` is asserted for all three titles —
  verify each has a paperback edition.
- Directory FAQ copy says "Every listing is human-verified" and counts all
  entries, including ones the site itself gates out of schema as incomplete.
  Copy decision.

**[ACCEPTED]** `courseSchema` is emitted on three URLs sharing one `@id`
(resolves to one entity — harmless); Organization/Person render on noindex
pages via the root layout (harmless); `preschoolCourseSchema` price flows from
the documented `PRESCHOOL_PRICE_USD` constant.

## D. Directory template quality

Engine pages (category/state/corridor/exit/detail) are in good shape: unique
parameterized titles/descriptions (the exit page is the strongest — live
counts and place names), single keyword-bearing H1s, correct canonicals,
Breadcrumb+ItemList+FAQ schema, dense internal linking, and the exit page
hard-404s when empty with the three-way empty/error distinction.

Flow pages (parking + cat-scales trees) have correct, unique titles and
canonicals but were built without the engine's SEO scaffolding:

- Structured data + ItemList: **[FIXED — PR #289]** (above).
- Generic duplicated H1s ("Which interstate?" on every state page of both
  flows) while titles are fully parameterized. **[OWNER]** — H1s are visible
  driver-first copy; changing them is a copy decision the Blueprint reserves.
  Recommendation recorded: fold the state/corridor into the H1.
- No links into the engine pages (`/directory/georgia`, `/directory/i75`,
  `/directory/i75/truck-parking`) and none back. **[ACCEPTED]** for this
  sprint: navigation design, not a crawlability defect (Block E confirmed
  full crawl paths); recorded as a natural-linking enhancement candidate.
- No existence gate: `/directory/parking/ga/i-999/northbound` (and engine
  `/directory/i999`) return 200, indexable, empty. **[ACCEPTED]** — nothing
  links to synthesized corridors and the sitemap only advertises facet-backed
  pairs, so Google has no path to them; a hard 404 would need strict reads to
  avoid the cached-false-404 class. Recorded for a future sprint with the
  proper `*Result` plumbing.

No listing data was touched; no programmatic copy was spun.

## E. Internal link discovery

No gaps. Both flow families are fully reachable through server-rendered
anchors: header/footer/homepage → `/directory` → hubs → state → interstate →
direction → listing details; sitemap and rendered links gate on the same
facet reads, so facet mismatch can't orphan URLs. Two fragilities recorded:
each flow hangs off a single entry block (delete it and the family orphans
while staying in the sitemap), and `cat-scales/near-me` is a crawl leaf (its
listing links are client-gated behind geolocation) — fine, but it passes no
link equity.

## G. Legacy URLs / redirects

Five redirects in `next.config.mjs`, no Netlify redirects, no middleware URL
rewriting (middleware gates Navigator only), DB-backed listing-slug redirects
collapse to one hop and 308 correctly. No chains, no loops (enforced by
`test-route-redirects.ts`).

- `/contact → /academy/faq` was 307 (temporary) with no internal traffic —
  external bookmarks only. **[FIXED — PR #291]** now 308.
- `/videos → YouTube` stays 307 **[OWNER]** — off-site destination the owner
  may re-point; permanence is a business call.
- `robots.ts` disallows `/login`, so crawlers never see its 308 to
  `/admin/login`. **[ACCEPTED]** — the destination is also disallowed; we
  don't want either crawled. Google will simply drop `/login` over time.
- Legacy origins inventoried in-repo: the standalone DOT-Tools app (8 routes
  mapped in `docs/dot-tools/inventory.md` §8 — its Phase-5 redirect map can't
  ship yet because 7 of 8 target routes don't exist on the platform), the CDL
  Pre-School portal (`cdl-preschool.netlify.app` — blanket 301 explicitly
  rejected to protect enrolled students), and
  `truckinglifewithshawn-website.netlify.app` (named once, **no URL inventory
  exists**). **[OWNER]** Export the legacy sites' Netlify analytics referrer
  lists and the GSC "indexed pages" list for the old properties before any
  redirect decision; without that evidence no redirect map should be built.

## H. Social authority (repo-controlled surfaces)

- **TikTok handle conflict — the one real defect**: `SITE.social.tiktok` (and
  all schema `sameAs`, and the footer) point at `@truckinglifewithshawn`,
  while the homepage Featured Videos cards deep-link
  `@trucking.life.with.shawn`. One of these is wrong; external verification
  is blocked from this environment. **[OWNER]** confirm the real handle; then
  a one-line fix in `site.ts` or `FeaturedVideos.tsx`.
- Footer identity links (`rel="me"`) opened in-tab without
  `noopener noreferrer` while every other outbound link carries them.
  **[FIXED — PR #291]** (keeps `rel="me"`).
- `rel="sponsored"` inconsistency on the owner's own Stan links is documented
  as a deliberate business call (autonomous-run log) — untouched.
- No Instagram/X/LinkedIn URLs exist in the repo; whether that's a gap depends
  on which accounts exist. **[OWNER]** — see the social checklist doc.

## I. Crawl efficiency / generation reliability

The sitemap route revalidates hourly; each regeneration performs the facet
scan, two flow-facet scans, one full published-entries scan, and two KC
queries — all keyset-paginated complete reads with exact-count corroboration,
memoized during builds (`NEXT_PHASE` gate), fail-soft on error. Build-time
read amplification was already solved on main (memo: ~1,700 scans requested →
deduplicated). No premature optimization warranted; one measured note: the
sitemap's full-entry scan pulls all columns to run the indexability gate —
correct as designed (the gate needs those fields), revisit only if the
catalog grows an order of magnitude.

## J. Test hardening delivered this sprint

- `test-seo-pagination.ts` — pagination canonical/title contracts + miss-branch
  contracts (25 checks), sharing a PostgREST fake extracted to
  `scripts/helpers/postgrest-fake.ts`.
- `next/headers` shim so harnesses can exercise real page `generateMetadata`
  functions offline.
- Structured-data and OG contracts land with their PRs.
