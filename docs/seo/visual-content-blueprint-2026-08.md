# TLWS VISUAL SEO BLUEPRINT

Audit + strategy only — nothing in this document is implemented. Produced by the
SEO Visual Content session, 2026-08-19, from main @ `c15a4bd`. Companion to
`technical-seo-audit-2026-08.md` (Blocks A–J) and the KC content batches
(migrations 037/038/040/042/045/055).

**Scope note.** YouTube is egress-blocked from this environment, so the video
audit rests entirely on repository references. Every "existing video" claim
below cites where the repo names it; whether the channel holds additional
relevant explainers is an owner/content-session verification step.

**House rules this blueprint obeys** (already encoded in the repo):

- No stock photography, no AI-generated people, real people/places only on
  trust surfaces (`cinematic-photography-guide.md` hard rule 1;
  `owner-assets-needed.md` "explicitly NOT needed").
- AI-generated **scene/diagram** art with no people, owner-approved, is
  established precedent — the six KC category banners shipped that way
  (PR #322: generated in the image workspace, approved, committed
  byte-for-byte as 1672×941 WebP ≤ 200 KB).
- ≤ 200 KB per image, WebP, explicit width/height, descriptive alt required,
  captions are verified facts only.
- No fake CDL cards, no government seals, no implied FMCSA endorsement, no
  unsupported salary/pass-rate/outcome claims — same doctrine as the content
  batches (055 header) and the JSON-LD audit.
- Homepage stays video-free; THE ROAD AHEAD owns ambient video; video
  elsewhere plays only on user action.
- Text belongs in HTML, not baked into images (banner precedent). Diagram
  labels are the narrow exception; every fact in a graphic must also exist as
  on-page text (the 055 harness's P20 already enforces the list-built
  comparison — graphics supplement, never replace).

---

## Priority 1 — Class A vs Class B CDL

**Page:** `/knowledge/getting-your-cdl/class-a-vs-class-b-cdl` (published
2026-08-19, migration 055, reg-verified)

**Recommendation: B — INFOGRAPHIC / DIAGRAM** (side-by-side vehicle
comparison). Upgrade path to **E** when a Shawn explainer exists (see New
Video Opportunities #1) — the graphic ships first and does not wait on
filming.

**Why B.** This is a two-way *decision* page whose core distinction is
physical — combination vehicle vs heavy single vehicle — and the article
itself says the at-a-glance section was "built as a list so it reads cleanly
on a phone." A diagram is the one format that makes the trailer-draws-the-line
rule land in two seconds, it targets image-pack results for "class a vs class
b cdl" (a query with strong diagram intent — state CDL manuals answer it with
side-view vehicle silhouettes, so the visual language is already familiar to
searchers), and it gives the page a real `og:image`/`Article.image` where
today it falls back to the generic Knowledge Center text card. No original
photo exists of both vehicle types side by side (the training-fleet photo
shows two tractors, no straight truck), and video alone can't serve image
search.

### Visual blueprint — the comparison graphic

**Concept.** One frame, two panels on the house asphalt background, divided by
a vertical rule.

- **Left panel — CLASS A.** Side-view silhouette of a tractor coupled to a
  53-foot dry-van trailer. Two threshold chips, **both** highlighted:
  "COMBINATION RATED 26,001 LB OR MORE" and "TOWED UNIT RATED OVER
  10,000 LB" — with the second chip's leader line pointing at the **trailer**,
  and the coupling point visually emphasized (sodium-amber ring at the fifth
  wheel). A small "BOTH LINES MUST BE CROSSED" tag preserves the rule's real
  shape — a heavy truck pulling a light trailer is *not* Group A, and the
  graphic must not collapse into "big truck = Class A."
- **Right panel — CLASS B.** Side-view silhouettes of a dump truck and a box
  truck (two typical vehicles, conveying that this is the straight-truck
  class). One chip: "SINGLE VEHICLE RATED 26,001 LB OR MORE." A second,
  quieter element: a small towed unit rendered in outline with "MAY TOW
  10,000 LB OR LESS" — Class B *can* tow, just light; omitting this
  oversimplifies the regulation.
- **Bottom strip — the one-way door.** A solid arrow from A toward B/C
  labeled "CLASS A ALSO COVERS GROUP B & C VEHICLES — WITH ANY REQUIRED
  ENDORSEMENTS," and a struck-through arrow from B toward A labeled "CLASS B
  NEVER COVERS CLASS A." The endorsement qualifier stays — it is the
  regulation's own condition.
- **Source line (small, bottom corner):** "Source: 49 CFR 383.91." A citation
  in text form only — no FMCSA logo, no DOT seal, no eagle, no license-card
  mockup anywhere in the frame.

**Exclusions (hard):** no CDL card imagery, no government seals or agency
logos, no salary or pay text of any kind, no "best choice" judgment language,
no people, no readable carrier livery on the vehicles (matches the banner
alt-text convention: "no frame carries readable signage or branding").

**Style.** House tokens so the figure reads native inside the article column:
asphalt `#141414` background, ink `#F5F5F5` line work and type, sodium amber
`#F5A623` (the `signal` token) reserved for the thresholds and the dividing
rule, muted gray for secondary labels. Condensed uppercase display type in the
site's Anton voice. Flat diagram silhouettes, no photorealism. In-image text
minimal and ≥ 48 px at master size (it must survive a 360 px-wide phone
render); every fact in the frame already exists as body text, so Google's text
extraction loses nothing.

**Renditions and specs.**

| Property     | Desktop / master                                                                | Mobile companion                             |
| ------------ | ------------------------------------------------------------------------------- | -------------------------------------------- |
| Dimensions   | **1600×900** (2× the ~750 px article column — retina-sharp, inside the 1920 cap) | **1080×1350** (4:5), panels stacked A over B |
| Aspect ratio | 16:9                                                                             | 4:5                                          |
| File         | `public/images/knowledge/articles/class-a-vs-class-b-cdl-comparison.webp`        | `…/class-a-vs-class-b-cdl-comparison-mobile.webp` |
| Budget       | ≤ 200 KB WebP                                                                    | ≤ 200 KB WebP                                |

**Mobile crop.** Don't crop — swap. Serve the 4:5 stacked rendition below
`sm` via an art-directed `<picture>`, exactly the pattern the homepage hero
already uses (`getImageProps`, one `<picture>`, browser downloads one frame).
A 16:9 side-by-side at 360 px gives each class ~180 px — the stacked variant
keeps every label legible without shrinking type.

**Alt text** (descriptive, per the category-visuals convention — never the
bare title):

> "Side-by-side diagram: a Class A CDL covers a combination — a tractor and
> trailer rated 26,001 pounds or more together, with the trailer rated over
> 10,000 pounds — while a Class B CDL covers a single straight truck, such as
> a dump truck or box truck, rated 26,001 pounds or more and towing no more
> than 10,000 pounds."

**Caption** (HTML `<figcaption>`, verified-fact voice):

> "The trailer draws the line: Class A requires both thresholds — the
> combination's rating and the towed unit's rating (49 CFR 383.91)."

**Placement.** Directly under the `## Class A vs Class B at a glance` heading,
above the row-by-row list. The list stays untouched — P20 in
`test-kc-class-a-vs-b.ts` requires the comparison to remain list-built; the
figure supplements it. (Mechanically this needs the article-figure slot from
the Implementation Plan — the markdown renderer cannot emit images, so the
page splits the rendered body at the heading anchor and renders the figure as
a React component between the halves.)

**OG suitability: yes — same master, designed for it.** Compose the 1600×900
with a 1.91:1 center-safe zone (nothing load-bearing in the top/bottom
~5.5 %), then set it as the article's image so one asset serves all three
discovery surfaces: inline `<img>` (image search), `Article.image` (rich
results), and `og:image`/`twitter:image` (social cards) — replacing the
generic Knowledge Center text card on this page. A dedicated 1200×630 export
is optional polish, not required.

---

## Priority 2 — How Long Does CDL Training Take?

**Page:** upcoming (does not exist on main — no slug in any seed migration;
the topic currently lives only as one FAQ inside
`/knowledge/getting-your-cdl/how-to-get-your-cdl`). The SEO Content session
owns the article; this session owns the asset call.

**Recommendation: BOTH — timeline infographic at publish, Shawn explainer as
fast-follow.** If forced to one: **B — the timeline infographic.**

**Why this order.** "How long does CDL training take" is a
duration/featured-snippet query where a labeled timeline directly answers the
search — and the graphic can ship with the article on day one with no
dependency on filming. The Shawn video (New Video Opportunities #2) adds what
a graphic can't — the instructor saying "here's what actually moves your
date" — and upgrades the page to E, but an article held for a recording
schedule is an article not ranking.

**The honesty constraint shapes the design.** The site's own published
position (how-to-get-your-cdl FAQ) is "there is no universal timeline," and
the content rules ban invented figures. So the graphic is **not** "CDL school
takes 4 weeks." It is **"your CDL timeline: what's fixed and what varies"** —
a horizontal segmented bar:

1. Study + knowledge tests — *variable, your pace* (hatched gray)
2. CLP issued — milestone marker
3. **Minimum 14-day permit hold — fixed federal floor** (solid sodium amber,
   cited "49 CFR 383.25(e)")
4. ELDT theory + behind-the-wheel — *program-dependent* (hatched), with the
   two real published examples as reference rows: "TLWS weekend program —
   8 weekends" and "TLWS weekday program — approx. 3–4 weeks" (both facts
   already published on `/academy` and read from `lib/academy/program`)
5. Skills-test scheduling — *varies by state backlog* (hatched)

Fixed segments in solid amber; variable segments hatched with "varies"
labels. No invented average, no total, no competitor comparisons. Master
1600×900 + 1080×1350 vertical-timeline mobile rendition, same file/style/alt
conventions as Priority 1; filename
`cdl-training-timeline.webp` under the article's final slug directory once the
content session fixes it. Placement: immediately after the quick-answer
paragraph. OG-suitable with the same center-safe design.

---

## Priorities 3–10 — ranked by visual opportunity

Letters: A original image · B infographic/diagram · C existing Shawn embed ·
D new Shawn video · E image + video · F none.

| #   | Page                                                       | Rec   | Asset concept                                                                                                                                                | SEO purpose                                                                                          | User purpose                                                                     | Effort                                              |
| --- | ---------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------- |
| 3   | `/knowledge/hours-of-service/cdl-hours-of-service-rules`   | B     | The HOS "clock" diagram — 11-hour driving / 14-hour window / 70-hour cycle / 30-minute break as one dial-plus-bar graphic                                    | Image-pack presence for "HOS rules chart"-type queries on the category pillar; real `Article.image`  | The four interlocking limits are near-impossible to hold in prose alone           | M — one graphic, content already reg-verified       |
| 4   | `/knowledge/cdl-training/cdl-pre-trip-inspection-guide`    | E     | Walkaround-sequence diagram (numbered stations around a top-view tractor-trailer) + Shawn pre-trip video (see video opportunities #5)                        | Pre-trip is the most-searched visual CDL topic; video Key Moments potential                          | Students memorize the pre-trip spatially — sequence is the whole game             | M graphic now; L video later                        |
| 5   | `/knowledge/getting-your-cdl/how-to-get-your-cdl`          | B     | Seven-step path diagram (license → medical → knowledge tests → CLP → ELDT → 14-day hold → skills test), fixed vs variable steps distinguished                | The pillar for the whole cluster; step-diagram intent on "how to get a CDL"; og:image for the page most likely to earn links | One glance shows the whole sequence the article walks through                     | S–M — mirrors the article's existing structure      |
| 6   | `/knowledge/hours-of-service/split-sleeper-berth-rules`    | B     | The 8/2 and 7/3 split-pairing timelines — two worked example bars showing which hours pause the 14-hour window                                                | Split-sleeper diagrams earn links/saves; almost nobody explains it honestly                          | The single hardest HOS concept; in-house verified spec exists (`docs/compliance/split-sleeper-*`) | M–L — precision matters; verify against the spec    |
| 7   | `/knowledge/getting-your-cdl/cdl-skills-test`              | B     | Three-part test structure diagram (vehicle inspection → basic control → road test), what each part covers, in test order                                     | Diagram intent on "CDL skills test parts"; strengthens the getting-your-cdl cluster's visual coverage | Reduces test-day anxiety by making the structure concrete                        | S                                                   |
| 8   | `/knowledge/dot-compliance/dot-inspection-levels-compared` | B     | Inspection-levels ladder — Levels I–VIII with what's examined at each (driver docs / vehicle / under-vehicle), Level I–III emphasized                        | "DOT inspection levels" is a comparison query; the page already owns the table intent in text        | Drivers want "which level is this and what will they touch" at a glance          | M                                                   |
| 9   | `/academy/curriculum`                                      | A     | Real photography: shot-list #3 (pre-trip, hands on the rig) and #6 (range backing practice) placed per phase — no generation, the shot list already assigns them | Local/commercial page E-E-A-T: real equipment photos where competitors use stock                     | "Is this school real?" answered visually, phase by phase                          | S engineering; owner shoots per existing guide      |
| 10  | `/knowledge/getting-your-cdl/cdl-classes-compared`         | B     | Companion trio graphic — A/B/C silhouettes in one frame, same design system as Priority 1 so the two pages visually cross-reference                          | Owns the three-class taxonomy query as P1 owns the two-way decision; shared system halves the cost   | The full taxonomy map for readers the decision page hands off                     | S once Priority 1's system exists                   |

**Explicit F calls** (visuals would be decoration, not understanding —
the SEO rule in this session's brief): `/academy/faq`, `/academy/financing`,
`/academy/requirements`, `/academy/apply` (conversion surface), and the
careers/money articles (`cdl-truck-driver-pay`, `what-is-a-good-cpm-rate`,
etc.) — pay graphics would invite exactly the unsupported-figures problem the
content rules exist to prevent. Revisit the money cluster only if a graphic
can be built entirely from cited BLS-class sources.

---

## Existing YouTube Reuse

Everything the repository knows about Shawn's channel (`@TruckingLifewithShawn`,
84K+ subscribers per homepage copy):

**Public videos referenced (homepage `FeaturedVideos.tsx` — outbound cards,
deliberately not embeds):**

| Video                                        | ID            | Embed candidate page                                                                              | Notes                                                                                                             |
| -------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| "17 Years, Zero Violations — Here's How"     | `PDeJF0CMoUw` | `/knowledge/dot-compliance/csa-scores-sms-explained` (primary) or the careers cluster              | **Strongest reuse candidate** — evergreen title, embodies the site's load-bearing E-E-A-T claim                   |
| "FMCSA Just Changed DOT Inspections"         | `UlW-GlLugUg` | `/knowledge/dot-compliance/dot-inspection-levels-compared` or `annual-dot-inspection`              | News-style title — confirm content still current before embedding on an evergreen page                            |
| "DOT Officers Are Quietly Doing This"        | `vXtKQs6we_s` | `/knowledge/hours-of-service/level-1-dot-inspection` or `cvsa-out-of-service-criteria`             | Same currency check                                                                                                |

**Unlisted footage (Road Ahead manifests):** 7 clips live as cinematic B-roll
(night drives, a pre-trip Short `Okpkg_xjwX8`, a truck walkaround
`UgB8CPtzjSg`, sunrise, driving-away) plus 13 pending unassigned IDs. **Do not
embed these in articles** — they are ambient footage without instructional
audio, and they belong to THE ROAD AHEAD's scene system. The walkaround clips
are, however, evidence Shawn already shoots this material — relevant to video
opportunity #5.

**Coverage verdict against the target topics** (repo evidence only —
channel-inventory check is an owner step, YouTube unreachable from this
environment): no repository reference covers **Class A vs Class B**, **getting
a CDL (sequence)**, **ELDT**, **CDL school duration**, or the **Georgia CDL
process**. If the channel check finds existing strong videos on any of these,
embed them instead of recording new — an existing Shawn video always beats a
new production, and both always beat a manufactured AI video (which this
blueprint does not propose under any circumstance).

**Embed mechanics for any reuse** (applies to all embeds in this blueprint):
click-to-load facade (thumbnail + play affordance, iframe injected on
interaction, `youtube-nocookie.com` host — consistent with the repo's existing
zero-third-party-JS-on-load discipline), plus `VideoObject` JSON-LD naming the
watch URL, thumbnail, and upload date. Neither the facade component nor any
`VideoObject` builder exists yet — see Technical Audit.

---

## New Video Opportunities

At most five, in priority order. All are **new recordings by Shawn** unless
the channel check surfaces an existing equivalent; every spec below assumes
the embed facade + `VideoObject` schema from the Technical Audit gaps.
Thumbnails: real Shawn on camera, sodium-amber text panel, consistent series
framing — no CDL-card props, no seals, no salary text.

1. **Class A vs Class B — which CDL should you get?**
   Page: `/knowledge/getting-your-cdl/class-a-vs-class-b-cdl` (upgrades P1 to E).
   Title: "Class A vs Class B CDL: Which One Should You Get?" (mirrors the
   ranking page's H1 — the page and video reinforce each other).
   Hook: "The trailer — not the truck — decides which license you need. Let me
   show you on real equipment."
   Length: 4–6 min. Chapters: The rule in plain English (0:00) → Walk the
   combination (Class A) → Walk the straight truck (Class B) → The one-way
   door → Upgrading later, what it really costs you → Which one fits your job.
   Placement: after "The jobs each license supports," where readers shift from
   definitions to deciding. Thumbnail: split frame — tractor-trailer left,
   dump/box truck right, Shawn center, "A or B?" in house type.
   Schema: VideoObject with chapter markup (`hasPart`/Clip) for Key Moments.
   Production note: TLWS has a tractor + 53' trailer and a day cab on the lot
   (fleet photo) — a straight truck for the B side needs sourcing or the video
   leans on cutaway diagrams (reuse the P1 graphic on screen).

2. **How long does CDL training actually take?**
   Page: the P2 article (upgrades it to E).
   Title: "How Long Does CDL Training REALLY Take?"
   Hook: "Anyone who gives you one number is selling you something. Here's
   what's actually fixed — and what you control."
   Length: 3–5 min. Chapters: The 14-day federal floor → What your school's
   format changes (weekend vs weekday, with TLWS's published examples) → The
   waits nobody mentions (testing backlog) → How to shorten what you can.
   Placement: beside the timeline graphic, after the quick answer.
   Thumbnail: Shawn + calendar motif, "14 DAYS IS THE ONLY RULE."
   Schema: VideoObject; the article's FAQ schema already carries the question.

3. **How to get your CDL in Georgia — the actual DDS process.**
   Page: `/knowledge/getting-your-cdl/how-to-get-your-cdl` (Georgia section)
   and cross-embedded on `class-a-vs-class-b-cdl`'s Georgia section if
   chaptered timestamps allow deep-linking.
   Title: "Getting Your CDL in Georgia: Every Step at the DDS."
   Hook: "Georgia does a few things differently — miss one and you're driving
   back to the DDS twice."
   Length: 6–8 min. Chapters follow the seeded article's Georgia list: regular
   GA license → age rule and the under-21 intrastate restriction → medical
   cert (examiner e-transmits since June 2025) → knowledge tests + CLP → ELDT
   registry verification → 14-day hold → skills test in your class of vehicle.
   Placement: within the Georgia H2. Thumbnail: Shawn + Georgia outline (state
   silhouette is fine; no DDS logo). Schema: VideoObject + chapters.
   Strong local-SEO fit with the Dalton pages' areaServed strategy.

4. **ELDT, explained by an instructor.**
   Page: `/knowledge/getting-your-cdl/eldt-requirements`.
   Title: "ELDT: What the Federal Training Rule Means for You."
   Hook: "Since 2022 you can't just show up and test — here's the registry
   rule schools won't explain."
   Length: ~4 min. Chapters: Who ELDT applies to (first CDL, B-to-A upgrades,
   H/P/S) → theory vs behind-the-wheel → the Training Provider Registry → how
   to verify a school is listed.
   Placement: after the article's applicability section. Thumbnail: Shawn +
   "ELDT" large type. Schema: VideoObject.
   Caution: the video must not claim TLWS registry status — the JSON-LD audit
   already flags that no TPR number is published anywhere in the repo.

5. **The full CDL pre-trip inspection, chaptered.**
   Page: `/knowledge/cdl-training/cdl-pre-trip-inspection-guide` + reusable on
   `/academy/curriculum` Phase 2.
   Title: "Full CDL Pre-Trip Inspection Walkthrough (Follow Along)."
   Hook: "Examiners fail more students on the pre-trip than the driving. Walk
   it with me once a day until test day."
   Length: 10–15 min, heavily chaptered (each station = a chapter → Key
   Moments in search). Placement: top of the guide, above the sequence
   diagram. Thumbnail: Shawn at the open hood, station number overlay.
   Schema: VideoObject + Clip chapters. Highest production effort, highest
   evergreen value; the unlisted walkaround B-roll proves the footage
   workflow already exists.

---

## Image Generation Queue

At most five original graphics. Production pipeline = the proven banner
pipeline (PR #322): generated in the image workspace → **owner approval** →
committed byte-for-byte, WebP ≤ 200 KB, registered in a single-authority
visuals module with enforced tests. All five share one "TLWS diagram" system
(asphalt ground, ink line work, sodium-amber accents, Anton-voice labels,
no people, no seals, no fake documents, minimal in-image text, 1.91:1
center-safe composition) so they read as one family in image results.

| #   | Asset                                                   | For                                        | Renditions                            | Filename stem                          |
| --- | ------------------------------------------------------- | ------------------------------------------ | ------------------------------------- | -------------------------------------- |
| 1   | Class A vs Class B comparison (full spec in Priority 1) | P1 page + its og:image                     | 1600×900 + 1080×1350 stacked          | `class-a-vs-class-b-cdl-comparison`    |
| 2   | CDL training timeline, fixed-vs-variable (P2 spec)      | P2 article at publish                      | 1600×900 + 1080×1350 vertical         | `cdl-training-timeline`                |
| 3   | HOS clock — 11 / 14 / 70 + 30-minute break              | HOS pillar (Priority 3)                    | 1600×900 + square 1200×1200 mobile    | `hos-limits-clock`                     |
| 4   | How-to-get-your-CDL seven-step path                     | Cluster pillar (Priority 5)                | 1600×900 + 1080×1350 vertical         | `how-to-get-your-cdl-steps`            |
| 5   | CDL classes A/B/C trio                                  | `cdl-classes-compared` (Priority 10)       | 1600×900 + 1080×1350 stacked          | `cdl-classes-a-b-c-compared`           |

All under `public/images/knowledge/articles/`. Queue items 3–5 do not start
until the Priority 1 asset has established the approved design system.
(The split-sleeper diagrams — Priority 6 — deliberately stay out of this
first queue: they need line-by-line verification against
`docs/compliance/split-sleeper-*` and deserve their own focused pass.)

---

## Technical Audit

What the current implementation supports today, verified in code on main:

**Image SEO — strong foundations, one structural blocker.**

- **Crawlable, stable image URLs: YES.** All shipped images are repo assets
  under `/images/...` with descriptive kebab-case names; `next/image` serves
  crawlable optimizer URLs wrapping those stable sources. No hashed
  filenames, no CSS-background-only content imagery on KC/Academy surfaces
  (the category hero renders the banner as a true `<img>`, decorative by
  design with the descriptive alt carried on the landing cards).
- **Descriptive alt text: YES, enforced as culture.** `CinematicStill`
  requires alt at the type level; `category-visuals.ts` documents and
  `test-kc-category-banners.ts` enforces the "describe the frame, never the
  bare category name" convention.
- **Responsive images: YES, mature.** `sizes` everywhere, art-directed
  `<picture>` with per-orientation frames on the homepage hero, explicit
  width/height (no CLS), `priority` on LCP images, lazy below the fold,
  ≤ 200 KB WebP budget.
- **THE BLOCKER — article bodies cannot contain images at all.**
  `lib/kc/mdx.ts` renders only h2/h3, paragraphs, bold/em, links, and
  unordered lists. No `![alt](src)` support, no HTML passthrough, no figure,
  no embed. The article template has no figure slot either. Every Priority
  1–10 recommendation lands behind this gap.

**Article schema: wired, empty.** `articleSchema()` emits headline,
description, section, keywords, dates, author, publisher `@id`, and
`image: hero_image_url ?? undefined` — but `hero_image_url` is NULL for all
~51 seeded articles (every seed omits it; harness fixtures pin it null). Even
if set, the image would appear only in meta/schema, never on the page — a
mismatch with the "marked-up images should be visible on the page" principle.
Secondary: the publisher Organization node carries **no `logo`** and the
Person node no `image` — Article rich results want a publisher logo.

**OG support: complete coverage, brand-text tier.** `buildMetadata()` emits
OG + `twitter:summary_large_image` on every page; edge-generated brand cards
exist at root and for `/academy`, `/directory`, `/knowledge`,
`/practice-tests`, `/store`, `/cdl-pre-school`. By design no photography is in
them ("upgrade here first when real imagery lands" — owner-flagged in the
August audit). Unused opportunities: KC **category** pages don't pass their
own approved banners as `og:image` (they fall back to the generic Knowledge
card), and articles have no image to pass. Minor drift: `og-card.tsx` uses
`#FFEB00` while the site's `signal` token is `#F5A623`.

**Video embed support: ambient only.** The only embed path in the codebase is
THE ROAD AHEAD's `CinematicVideo`/`YouTubeCinema` (muted, controls-off,
segment-looped B-roll via nocookie IFrame API — explicitly not an
article-grade player). The homepage `FeaturedVideos` deliberately uses
outbound cards, not embeds, to keep third-party JS off page load; the cards
show a generic play glyph, not real thumbnails. There is **no click-to-load
embed component** suitable for Knowledge/Academy articles.

**VideoObject support: none.** Zero `VideoObject` emissions repo-wide, no
video sitemap, no chapter markup. `/videos` 307s to the channel (owner-flagged
choice). Related owner flag still open: the TikTok handle mismatch between
`site.ts` (`@truckinglifewithshawn`) and the homepage cards
(`@trucking.life.with.shawn`) — worth resolving before `sameAs` starts
supporting video schema.

**Other gaps, minor:** no image sitemap (optional — on-page markup suffices
once images exist); `images.remotePatterns` allows only `**.supabase.co` and
`**.netlify.app`, so repo-local paths (not remote hero URLs) are the safe
pattern for article visuals; article list cards are text-only (fine —
thumbnails become an option once article visuals exist).

**Page-speed implications of this blueprint:** every recommended asset is one
≤ 200 KB WebP rendered through `next/image` with reserved dimensions —
comparable to the category banners already shipping on KC category pages
(LCP-positive there, as the priority image). Inline article figures sit
below the first screen (after the at-a-glance heading) so they lazy-load and
cannot regress LCP. Video embeds cost nothing at load behind a facade; the
existing "no live embeds = zero third-party JS" rule stays intact.

---

## IMPLEMENTATION PLAN

**One bounded first milestone — KC-VIS-1: the article visual slot, proven on
Class A vs Class B.** (Not implemented here; recorded for the next session.)

Scope:

1. **`src/lib/kc/article-visuals.ts`** — a slug-keyed registry modeled
   line-for-line on `category-visuals.ts` (the repo's proven single-authority
   pattern; no DB migration, no renderer change): `{ src, mobileSrc?, alt,
   caption?, width, height, afterHeadingId? }`.
2. **`ArticleFigure` component** — art-directed `<picture>` (per the homepage
   hero pattern) when `mobileSrc` exists, `next/image` otherwise, with an
   HTML `<figcaption>`.
3. **Article page wiring** — split the rendered body HTML at
   `afterHeadingId` (fallback: render above the body) and place the figure
   between the halves; when a registry visual exists and `hero_image_url` is
   null, pass its absolute URL through `buildMetadata({ image })` and
   `articleSchema` so inline, `Article.image`, and `og:image` all emit the
   same asset.
4. **Assets** — the two approved renditions of the Priority 1 comparison
   graphic (Image Generation Queue #1), owner-approved before commit.
5. **Tests** — extend the banner-harness pattern: registry ↔ disk, real WebP,
   exact dimensions, ≤ 200 KB, non-generic alt, the heading anchor exists in
   the 055 body, metadata + JSON-LD emit the image URL, and the existing
   `test-kc-class-a-vs-b.ts` P-suite stays green (P20's list survives).

Explicitly **out** of this milestone: video embeds and the facade component,
`VideoObject`, any renderer change, category og:image reuse, Organization
`logo`, and graphics 2–5 of the queue. Each is a clean later milestone once
the slot exists and the first asset proves the pipeline.

Acceptance: `/knowledge/getting-your-cdl/class-a-vs-class-b-cdl` renders the
comparison graphic under its at-a-glance heading on desktop and phone, the
page's `og:image`, `twitter:image`, and `Article.image` all point at the
graphic's stable URL, and every KC harness passes.

**STOP.** Nothing beyond this document was changed: no images generated, no
pages edited, no PR opened.
