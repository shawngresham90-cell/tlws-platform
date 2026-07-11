# Directory SEO audit — July 2026 (Milestone 18)

Scope: every public directory surface — hub, 8 engine category pages, the
Truck Parking foundation page, state pages, interstate corridor pages, exit
pages, `/directory/submit`, `/directory/reviews` — plus site-wide schema and
the sitemap. Findings first; what this PR changes is marked **[FIXED]**,
recommendations left for later are marked **[RECOMMEND]**.

## 1. Metadata

| check | result |
|---|---|
| Pages missing metadata | **None.** Every directory route uses `buildMetadata()` (title, description, canonical, OG, Twitter, robots). |
| Duplicate titles | **None.** All titles are parameterized (category title / state name / designation / exit number) and mutually distinct. |
| Duplicate descriptions | **One near-duplicate class.** Exit-page descriptions differed only by the exit number — 42 nearly identical descriptions. **[FIXED]** exit descriptions now embed the live listing count and the exit's own cities ("6 verified driver services at I-75 Exit 296 (Cartersville, GA): …"), making each unique. |
| Canonicals | Present and self-referential on every page. No parameterized URLs are indexable. |

## 2. Headings

- Every page renders exactly one `<h1>` (via `DirectoryHero` or the page hero).
- **Weak H1 found:** exit pages used `Everything at Exit {n}` — no corridor
  keyword, and identical H1s would collide across future interstates sharing
  exit numbers. **[FIXED]** now `{designation} Exit {n}, truck stop to scale`.
- State H1 (`{State}, stop by stop`) and interstate H1 (`{designation}, end to
  end`) carry their primary keyword. Category H1s are brand-voice hero lines
  ("Know the exit before you take it") that do NOT contain the category
  keyword — the keyword lives in the title/eyebrow/intro instead.
  **[RECOMMEND]** consider `<h1>` variants that lead with the category term
  if category rankings lag; left unchanged to preserve brand voice.

## 3. Internal linking

Before: state pages linked only to the hub; exit pages only to their corridor
+ hub; category pages only to the hub; no page linked to the driver-community
pages except the hub. Link equity pooled at the hub and died there.

**[FIXED]** — every directory page now carries a data-driven "Keep exploring"
block (only links with listings behind them are emitted):

- **State pages** → corridors crossing the state, per-category links with
  in-state counts, every other covered state, submit + reviews
- **Interstate pages** → the corridor state-by-state (in route order),
  per-category links with on-corridor counts, other corridors, submit + reviews
- **Exit pages** → previous/next two exits with coverage, the corridor, the
  exit's state page(s), submit + reviews
- **Category + parking pages** → every covered state with counts, every
  corridor with counts, submit + reviews

Plus "Around {scope}" nearby-listing modules (section 4) which add dozens of
deep contextual links per page.

## 4. Thin pages

11 of 42 exit pages have a single listing (the long tail of the corridor).
**[FIXED]** exit pages now pull in "Around {exit}" modules — Nearby Truck
Stops / Truck Parking / CAT Scales / Truck Washes drawn from the same
corridor and state within a ±25-mile exit window — plus a data-driven FAQ
block, so even one-listing exits render substantial, unique, useful content.

## 5. Schema

| type | state |
|---|---|
| Organization / Person / WebSite | Emitted once, site-wide, from the root layout with stable `@id`s. **Found one duplicate:** `/academy/instructors` emitted a second `Person` object. **[FIXED]** removed (layout copy remains). |
| BreadcrumbList | Every directory page, one per page, matching the visible trail. |
| ItemList → LocalBusiness / Place | Category/state/interstate/exit/parking pages; only `indexable` entries; weigh stations typed `Place`. AggregateRating + Review objects attach per-listing from APPROVED driver reviews only (Milestone 16). No duplicates — one `ItemList` per page, entries appear once. |
| FAQPage | **Was missing entirely. [FIXED]** state/interstate/exit pages now emit `FAQPage` mirroring the visible FAQ accordions (Google requires visible parity — satisfied by construction: schema and UI render from the same `buildFaqs()` output). |
| Duplicate objects | None remaining after the instructors fix; each page emits a single JSON-LD script. |

## 6. FAQ system (new)

`buildFaqs()` generates up to five Q/As per state/interstate/exit page purely
from that page's listing data — parking availability (overnight-OK stops +
dedicated lots, by name), CAT scales, showers, repair/roadside options, and a
coverage overview. Questions are only asked when the data can answer them,
and answers name real listings, so no two pages share an FAQ block.

## 7. Sitemap

Verified `src/app/sitemap.ts` includes: hub, all 9 category pages (parking via
`categoryHref`), every state page, every corridor, every exit page (from live
facets), `/directory/submit`, `/directory/reviews`, plus Academy/KC/founders
surfaces. **No gaps found; no changes needed.** Community pages were added in
Milestone 16.

## 8. Recommendations (not in this PR)

1. **Per-listing detail pages** — the single biggest remaining SEO lever:
   139 indexable long-tail URLs (`/directory/truck-stops/ga/adel/adel-truck-plaza`)
   with full LocalBusiness schema, reviews, history, and map once coordinates land.
2. City hub pages (`/directory/georgia/valdosta`) once listing density justifies them.
3. Category H1 keyword variants (see §2) if category-term rankings lag.
4. `dateModified`/`lastmod` per URL in the sitemap from listing `updated_at`.
5. Approve driver reviews promptly once they arrive — AggregateRating stars in
   SERPs are already wired and waiting on approved content.
