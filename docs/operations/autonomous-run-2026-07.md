# Autonomous platform run — July 2026

Work log for the autonomous improvement run on branch
`claude/tlws-platform-autonomous-run-wv9hqv` (draft PR #178), branched from
`main` at `e39ec2e`.

Companion to `platform-catch-up-audit-2026-07.md`, which inventoried the
platform read-only. This log records what was **changed**, the evidence behind
each change, and the exact commands used to verify it.

## Guard rails honoured

- PR #177 and branch `claude/census-geocode-calibration` untouched.
- No imported TA/Petro rows, Love's Florence, Sapp Bros, Pilot-network,
  Goasis/Thorntons, or manual-review location records modified.
- No Supabase migration added or applied; no live database write of any kind.
- Nothing merged, deployed, or published.
- No prices, discounts, testimonials, statistics, product availability, or
  business claims invented.

---

## M1 — Branded 404 and error boundaries

**Problem.** `src/app` had no `not-found.tsx`, `error.tsx`, or
`global-error.tsx`. Every unknown URL therefore fell through to Next.js's
built-in not-found page, which injects an inline
`body{color:#000;background:#fff}` rule. That override beats the dark theme, so
the page rendered as a full-height white void between the (still dark) `Header`
and `Footer`, offered the visitor no links out, and emitted a second `<title>`.
An uncaught render error was worse — Next's unstyled "Application error"
fallback with no route back into the site.

**Evidence.** Against `main`, `npm run build && npm run start`:

```
$ curl -s -o /dev/null -w '%{http_code}' localhost:3000/this-page-does-not-exist
404
titles: ['404: This page could not be found.',
         'Trucking Life Academy — CDL Training in Dalton, GA']
body style injection: True
```

**Change.**

| File | Role |
| --- | --- |
| `src/app/not-found.tsx` | On-brand 404. Keeps the theme, one `<title>`, `noindex/nofollow`, deliberately **no canonical** (a 404 answers at many URLs), and six recovery routes: Academy, CDL Pre-School, Practice Tests, Directory, Trip Planner, Knowledge Center. Still answers HTTP 404. |
| `src/app/error.tsx` | Route-segment boundary with a working `reset()`. Renders the digest only — never the raw message, which can carry internals. |
| `src/app/global-error.tsx` | Root-layout fallback. Ships its own `html`/`body` and inline design tokens, because Tailwind may not have loaded when the root layout is what failed. |
| `src/components/seo/NotFoundEvent.tsx` | Fires `page_not_found` with the dead path through the **existing** `trackEvent` dispatcher, so broken links become visible. Silent no-op while analytics is unconfigured. |
| `scripts/test-error-pages.ts` | 34-check regression harness. |

**After.**

```
titles: ['Page not found — Trucking Life with Shawn']
robots: ['noindex', 'noindex, nofollow']
body style injection: False        HTTP 404 preserved
```

Rendered and inspected at 1280×900 and 390×844.

---

## M2 — Formatting baseline, offline test runner, and PR CI

Three findings, one milestone, because each blocks the next.

### 2a. `format:check` failed on 103 files

The README lists `npm run format:check` as "Prettier check (CI)", but it exited
non-zero on `main` across 103 files — pure line-wrapping drift, no behaviour
change. It could not gate anything in that state.

Ran `npm run format`, then **reverted two classes of file and ignored them
instead**:

- `data/` — geocoding dry-run and import artifacts. Reformatting
  `directory-snapshot.json` alone rewrote 35,058 lines and would have destroyed
  the diffability of an import batch's provenance. These are dated evidence
  snapshots, not source. (This is also the guard-railed import territory.)
- `src/lib/road-ahead/asset-presence.generated.ts` — rewritten from scratch by
  `prebuild`; formatting it only guarantees the next build dirties the tree.

Both are now in `.prettierignore` with the reasoning inline.

### 2b. 51 test harnesses existed; nothing ran them

`scripts/test-*.ts` holds 51 offline harnesses (≈6,900 assertions), each
documenting its own `npx esbuild … && node …` invocation in a header comment.
Nothing ran them together and nothing ran them in CI, so a regression in any
one of them stayed invisible.

Added `scripts/run-tests.mjs` (`npm test`) — bundles and runs every harness with
that same invocation, prints one line per harness, and fails the run on the
first non-zero exit. Accepts name filters: `npm test -- go-links`.

### 2c. The runner immediately found a failing harness on `main`

```
$ npm test
▸ preschool … FAILED
FAIL: hero Pre-School CTA renders the single-source price constant
162 passed, 1 failed
```

Reproduced on a clean `main` checkout, so it predates this branch. Two distinct
problems in `scripts/test-preschool.ts`:

1. **Stale assertion.** The harness asserted the paid CDL Pre-School CTA lived
   in the homepage hero. Commit `d4e5e72` ("Cinematic homepage + academy
   storytelling polish", PR #164) moved it out, deliberately —
   `docs/design/homepage-story-framework.md` specifies beat 1 as "1 primary
   CTA", with the CDL door in THE FOUR DOORS pairing "the school CTA with the
   live Pre-School purchase". `FourPaths.tsx` does exactly that today:
   `PurchaseCta`, `SpotsMeter`, `PRESCHOOL_PRICE_LABEL`, real wall data. **The
   shipped design is correct; the assertion was stale.** No product change was
   made.
2. **A vacuously-passing assertion.** The neighbouring check was
   `heroSrc.indexOf('/cdl-pre-school') < heroSrc.indexOf('/academy')`. Once the
   string was removed, `indexOf` returned `-1` — and `-1 < 34` is true, so the
   ordering check passed *because* the thing it guarded was gone.

Both rewritten to assert the shipped design: the hero holds exactly one primary
CTA; the homepage's Pre-School price comes from the single-source constant with
no hard-coded dollar amount; and the money door renders before the free doors,
compared on **rendered JSX** (`<PurchaseCta` vs `FREE_DOORS.map`) so an import
line can never satisfy the ordering. Harness now: 166 passed, 0 failed.

### 2d. CI

`.github/workflows/ci.yml` runs on `pull_request`, on `push` to `main`, and on
dispatch: `format:check` → `lint` → `typecheck` → `npm test` → `build` →
`git diff --exit-code` (catches drift in the `prebuild`-generated manifest).
Offline and read-only: no database, no deploy, no secrets. The Supabase env vars
are syntactic placeholders so the client modules construct; nothing connects.

The three pre-existing workflows (`preview-crawl`, `preview-smoke`,
`prod-health-check`) are unchanged — they need a live preview URL and stay
manual.

---

## M3 — Lead forms dropped the campaign that produced them

**Problem.** `/go/<slug>` short links exist specifically so YouTube arrivals
segment in analytics — they 302 with
`utm_source=youtube&utm_medium=video&utm_campaign=<slug>`. `AttributionCapture`
persists that first touch site-wide, and `ApplyForm` reads it. But:

- `NewsletterForm` — the site's primary email capture — built its `utm` map
  from `window.location.search` **only**. A driver who arrives on
  `/go/academy`, reads the page, and then signs up on any untagged page
  submitted `utm: {}`. The campaign that produced the lead was gone.
- `BecomeFounderForm` sent `{ founder_tier }` and **no attribution at all**.

Repro (client trace, no database needed):

```
/go/academy  →  302 /academy?utm_source=youtube&utm_medium=video&utm_campaign=academy
AttributionCapture stores it in sessionStorage
visitor clicks "Home"  →  location.search === ''
collectUtm()  →  {}          ← the lead is stored untagged
```

**Change.** `src/lib/attribution.ts` gains `currentUrlUtm()` and
`leadAttribution(extra?)`. `leadAttribution` merges, in precedence order,
caller context > session first touch > current URL, then enforces the API's
`utm` contract (≤20 keys, key ≤40, value ≤200) with caller context pinned so it
can never be the entry dropped by the cap. `NewsletterForm` and
`BecomeFounderForm` now both post `leadAttribution()`; the founder tier still
rides along as `utm.founder_tier`.

No schema change, no migration, no new event, no server change — the API
already accepted this shape and `/admin/leads` already renders it through
`utmSummary`.

**Tests.** `scripts/test-newsletter.ts` replaces its `collectUtm` block with
`currentUrlUtm`/`leadAttribution` coverage: first touch survives navigation to
an untagged page, first touch beats a later tag, caller context is preserved,
storage-blocked sessions fall back to the current URL, and the 20-key cap keeps
caller context. `scripts/test-lead-funnel.ts` adds source-level guards that both
forms post `leadAttribution()` and neither reads `window.location.search`
directly again.

---

## M4 — Trip Planner quoted 42 hours for a 34-hour rule

**Problem.** `planDrive()` in `lib/trip-planner/hos-engine.ts` answered *every*
exhausted clock with a 10-hour reset. A 10-hour reset does nothing for the
rolling 60/70-hour cycle — §395.3(c) restores it only after **34 consecutive
hours** off duty. So a cycle-exhausted driver got 10-hour blocks chained until
they happened to add up past 34 hours.

Reachable straight from the UI: `TripPlannerApp` has a "Cycle used (of 70h)"
slider that runs to 70, and `clockStateFromSimple` sets `restStreakMin: 0`.

Repro through the real entry point (`clockStateFromSimple` → `planDrive`),
driver at 70/70 with fresh 11/14 clocks asking for a 2-hour drive:

```
before:  quoted total: 42.0 h
         rests: 10-hour-reset 600m @0 | 10-hour-reset 600m @600
              | 10-hour-reset 600m @1200 | 10-hour-reset 600m @1800
after:   quoted total: 36.0 h
         rests: 34-hour-restart 2040m @0
```

Six hours of phantom delay on the quote, and an itinerary of four back-to-back
10-hour resets that no driver would run.

**Change.** `planDrive` gains a `cycle` branch that emits a single
`34-hour-restart` rest sized to *complete* the restart —
`max(RESTART_MIN - restStreakMin, MIN_BREAK_MIN)` — so off-duty hours the
driver has already banked are credited instead of restarting the clock.
`DrivePlanRest['kind']` gains `'34-hour-restart'`; the only consumer of `rests`
is `optimizer.ts`, which counts them.

**Tests.** `scripts/test-hos-hardening.ts` gains a cycle-exhaustion block (11
new checks): exactly one rest and it is the restart, sized exactly 34 h, total
= 34 h + drive, cycle restored on arrival, no 10-hour resets stacked in,
`earliestArrivalMs` agrees, banked off-duty time credited, an 11-hour-*and*-
cycle-dry driver still takes the 10-hour reset first, and no restart is ever
injected when the cycle has room.

---

## M5 — Accessibility sweep (axe-core, 19 routes × 2 viewports)

Ran axe-core 4.10 (`wcag2a, wcag2aa, wcag21a, wcag21aa, best-practice`) against
the production build at 1280×900 and 375×812. Findings, all fixed:

### 5a. `bg-asphalt-900` is not a class — serious, and not only cosmetic

The asphalt ramp is `DEFAULT / 600 / 700 / 800`. There is **no 900**, so
Tailwind emitted no rule at all and every element using it fell back to the
browser default: **white**. Four occurrences:

| File | Element | Effect |
| --- | --- | --- |
| `trip-planner/AccountPanel.tsx` | sign-in email input | `text-ink` on white — axe measured **1.13:1**; what the driver types is invisible |
| `trip-planner/SavedTripsPanel.tsx` | rename-trip input | same |
| `directory/SponsorSlot.tsx` | sponsor card | white card inside a dark placard |
| `admin/directory/sponsors/page.tsx` | admin inputs | same |

All four → `bg-asphalt`, matching every other form input in the codebase
(`admin/founders/page.tsx`, `NewsletterForm`). Nothing in lint, typecheck, or
the build complains about a class that matches no rule, so
`scripts/test-design-tokens.ts` now does — it reads the colour families out of
`tailwind.config.ts` itself and fails on any `bg-/text-/border-/ring-…` utility
whose shade the theme does not define. Adding a shade to the config
automatically permits it.

### 5b. Two `main` landmarks on `/trip-planner`

The page wrapped itself in a second `main` inside the root layout's, producing
three violations (`landmark-no-duplicate-main`, `landmark-main-is-top-level`,
`landmark-unique`). Now a plain wrapper.

### 5c. `link-in-text-block` — links indistinguishable without colour

Sodium amber measures **1.25:1** against muted body copy (3:1 is the floor for
colour carrying the signal alone) and the links had `hover:underline`, i.e. no
underline at rest. The footer's Privacy Policy / SMS Terms links were worse —
`text-muted`, exactly the colour of the sentence around them.

Added a `.link-inline` utility (resting underline, same shape as the existing
`.legal-prose a` rule) and applied it to the eight links that genuinely sit
inside running text, plus the two footer legal links. Standalone links (cards,
nav, link lists) are not "in a text block" and keep the hover-only treatment.

### 5d. `heading-order` on `/practice-tests`

`TestCard` and the two saved-work cards used `h3` directly under the page `h1`.
Both are the first level under the `h1`, so both are now `h2` — styling is
unchanged (explicit classes, not heading defaults).

### 5e. Duplicate DOM ids on `/academy/faq`

`AcademyFaq` hard-coded `id="faq-heading"`, and the FAQ page renders one block
per topic group — four elements sharing one id, and four landmarks sharing one
accessible name. The id is now derived from the block's heading.

### 5f. `<aside>` nested inside the hero region

`HeroShirtPromo` used `<aside>`, which claims a top-level complementary
landmark it is not. Now a named `<section>`; the accessible name is unchanged.

**Result:** `axe-core` reports **0 violations** across all 19 routes at both
viewports (was 5 distinct rules / 13 nodes).

---

## M6 — Knowledge Center search box broke the page layout on small phones

**Problem.** `/knowledge` and `/knowledge/search` scrolled sideways on a 320px
screen. The Knowledge Center search box is `flex`, with the input `flex-1` and
the Search button beside it. A flex item defaults to `min-width: auto`, and a
text input's intrinsic width is ~200px, so the input refused to shrink: the
button was pushed off-screen and the whole document overflowed.

Measured (production build, Chromium):

| Viewport | `document.scrollWidth` overflow, before |
| --- | --- |
| 320 px | **+59 px** |
| 375 px | **+4 px** |

**Change.** `min-w-0` on the input (the canonical flex fix) and `shrink-0` on
the button so it keeps its label instead of collapsing.

**After.** A sweep of **36 routes × 7 viewport widths** (320, 360, 375, 414,
640, 768, 1024) reports **zero horizontal overflow** anywhere.

**Test.** `scripts/test-design-tokens.ts` gains a generic guard: any
`<input>`/`<select>`/`<textarea>` carrying `flex-1` must also carry `min-w-0`,
plus explicit checks on the search box itself.

---

## M7 — `/directory/parking` shipped twice in the sitemap

**Problem.** `sitemap.xml` carried 170 URLs, one of them duplicated:

```
$ node sitemap-check.mjs
sitemap entries: 170
duplicates: 1 [ [ 'https://truckinglifewithshawn.com/directory/parking', 2 ] ]
non-200 sitemap entries: 0
```

`/directory/parking` is the `parking` category's `customHref`, so the
`DIRECTORY_CATEGORIES` loop already emitted it. It was then added a second time
to the hand-maintained top-level path list (whose comment claims those paths
"had no sitemap entry" — true for the other eight, not for this one).

**Change.** Removed the redundant entry, and — because entries come from a
static list, four registries, and two database queries, so any of them can
collide again — the generator now dedupes by URL before returning, first writer
wins.

**Test.** `scripts/test-sitemap.ts` (21 checks) runs the generator offline (its
Supabase reads are already inside a try/catch, so it yields the static entries).
Asserts no duplicate URL, `/directory/parking` exactly once, every URL on the
canonical origin with no query/fragment/trailing slash, priorities in range,
both `noindex` practice-test tools excluded, no `/admin`, `/api`, or `/login`
URL listed, and every directory category reachable.

Both layers were verified to bite: with the dedupe removed **and** the duplicate
reinstated, the harness fails on exactly the original defect
(`every URL appears exactly once → [/directory/parking, 2]`); with the dedupe in
place, a reinstated duplicate is absorbed.

Also confirmed clean, no change needed: all 170 sitemap URLs answer 200; every
page's JSON-LD parses, and `/academy/cdl-school-dalton-ga`'s two
`EducationalOrganization` nodes are correctly disambiguated by `@id` +
`parentOrganization`; `robots.txt` disallows `/admin`, `/api`, `/login`.

---

## M8 — Keyboard focus + workflow hygiene

### 8a. No focus indicator on date/time fields (WCAG 2.4.7)

Tabbed through 11 routes (up to full wrap of the tab order) checking that every
stop paints an outline or a box-shadow. Everything passed except the Trip
Planner's departure field:

```
/trip-planner    48 stops, 1 without a focus indicator
                 input "tp-depart" (type=datetime-local)
```

Chromium delegates focus inside a `date`/`datetime-local`/`time` input to its
internal sub-fields, so the **host element never matches `:focus-visible`** —
the `input:focus-visible` ring in `globals.css` did not apply. The field's own
`focus:outline-none` removed the browser's ring too, so tabbing to it left no
indicator at all.

Extended the `globals.css` focus rule to also match `:focus` for `date`,
`datetime-local`, `month`, `time`, and `week`. The ring is a box-shadow, so the
codebase's usual `focus:outline-none` field styling cannot cancel it (the same
reasoning the original rule already documents). Verified by keyboard-tabbing to
the field and screenshotting the ring.

Also checked and clean, no change needed: no positive `tabindex` anywhere, no
click handler on a non-focusable element, and every other tab stop on those 11
routes paints an indicator.

### 8b. `preview-crawl.yml` pointed at a finished pull request

The workflow's `base_url` input defaulted to
`deploy-preview-161--…netlify.app`, and its only `push` trigger was pinned to a
long-finished branch with a two-file path filter. Dispatching it without an
explicit URL therefore crawled a **stale, unrelated deploy** and reported a
meaningless pass. `base_url` is now required with no default, validated as an
`https` URL, and the dead push trigger is gone — the crawl needs a per-PR
preview URL, so dispatch-only is the honest shape.

---

## M9 — `/login` was a dead-end sign-in, live in production

**Problem.** `/login` served a working Supabase email+password form. On success
its server action redirected to `/admin`. But the dashboard is not gated by
Supabase: `admin/(dashboard)/layout.tsx` calls `requireAdmin()` from
`lib/admin/auth.ts`, which checks the shared-password HMAC cookie set only by
`/admin/login`. A Supabase session never sets it.

So a correctly-authenticated admin was bounced straight back out and asked for
a different credential — with no explanation, from a page whose own comment
claimed "middleware routes to /admin" (middleware only refreshes the Supabase
session; it performs no redirects at all).

Observed on the running build:

```
/login        200      ← live Supabase sign-in form
/admin        307  →  /admin/login      ← where a successful /login lands
/admin/login  200      ← the gate that actually opens the dashboard
```

`lib/admin/auth.ts` already documents the split: *"intentionally separate from
the Supabase-auth system in src/lib/auth.ts, which the dashboard does not
use."* The Supabase path was superseded in Milestone 10; `/login` was left
behind.

**Change.**

- `next.config.mjs`: `/login → /admin/login`, permanent. Old bookmarks keep
  working and land on the sign-in that opens the dashboard.
- Deleted `src/app/login/page.tsx` and `src/app/auth/actions.ts`. The action
  file existed only for that page, and a dangling `'use server'` export is a
  surface with no purpose.
- **Kept** `src/lib/auth.ts` — nothing imports it, but it is the role model that
  migrations 013/014 provision. It now carries a `DORMANT` header explaining the
  split and pointing a future implementer at
  `admin/(dashboard)/layout.tsx`, and its own redirects go straight to
  `/admin/login` rather than relying on the hop. **No migration, table, or RLS
  policy was touched.**

After: `/login` → 308 → `/admin/login` → 200.

**Test.** `scripts/test-route-redirects.ts` (33 checks) imports the real
`next.config.mjs` table and resolves every destination against the App Router
tree on disk (route groups collapsed, `[param]` segments treated as wildcards):
no self-redirect, no redirect whose source is shadowed by a real page, no
redirect pointing at another redirect's source, external destinations https
only, and every internal destination resolves to a route that exists. Plus the
specific case: `/login` is permanent, points at `/admin/login`, no page shadows
it, and the orphaned action directory is gone.

---

## M10 — The "Buy on Amazon" CTA was not disclosed as an affiliate link

**Problem.** `/books` rendered its primary money CTA as:

```tsx
<Button href={book.href}>Buy on Amazon</Button>
```

`Button` only emits an anchor with `target="_blank"` and a `rel` when it is
given `external`. Without it the affiliate URL — which carries
`?tag=truckinglif0d-20` — went out through a Next `<Link>`, so the
highest-intent link on the page carried **no `rel="sponsored"`** and navigated
the reader off the site entirely. The "read reviews on Amazon →" link three
sections up on the same page had it right, which is how the inconsistency
stayed invisible.

`rel="sponsored"` on paid links is required by Google and assumed throughout
this codebase: `lib/store/amazon.ts` exports `AMAZON_REL =
'sponsored noopener noreferrer'`, `AmazonCta` applies it, `shop/ProductCard`
auto-detects external hrefs and applies it, and the README states paid links
render `rel="sponsored"`. Three CTAs missed it.

Rendered evidence, before:

```
https://a.co/d/03cOB4V3                                  rel=(none) target=(none)   /books
https://www.amazon.com/DOT-Survival-Guide-…?tag=…        rel=(none) target=(none)   /books
https://www.amazon.com/Discipline-Over-Everything-…?tag=… rel=(none) target=(none)  /books
https://stan.store/TRUCKINGLIFEWITHSHAWN                 rel=(none) target=(none)   /books, /apps
```

After:

```
… all four →  rel="sponsored noopener"  target="_blank"
```

**Change.** Passed `external rel="sponsored"` to the three `<Button>`s
(`/books` Buy on Amazon, `/books` Visit the Stan Store, `/apps` Browse the full
Stan Store). `Button` appends `noopener` and deliberately keeps the referrer,
which Amazon Associates needs for attribution — the same contract `AMAZON_REL`
already encodes. **No price, product, ASIN, or claim was added or changed.**

**Test.** `scripts/test-outbound-links.ts` (9 checks): every off-site
`<Button>` is marked `external`, every paid link carries `rel="sponsored"`, the
three specific CTAs are correct, and the `AMAZON_REL` / `amazonProductUrl`
contract holds (tag applied exactly once, invalid ASIN yields no link).
Verified to bite — reverting the `/books` CTA fails three checks naming the
exact line.

**Noted, not changed:** the Founding Supporter shirt link on the home page uses
`rel="noopener noreferrer"` without `sponsored`, while the CDL Pre-School link
to the same Stan Store uses `sponsored`. Both are the owner's own store rather
than a paid placement, so which is "right" is a business call, not a defect —
flagging it rather than deciding it.

---

## M11 — Five forms could never be retried after a failed submit

**Problem.** A Turnstile token is single-use, and `guardedPost` verifies it
*before* the handler runs — so once a submit reaches the handler the token is
spent. If the handler then fails (500, database error, anything
post-verification), the widget is still holding the dead token. In "managed"
mode it has already auto-solved and will not re-issue on its own, so **every
retry answers 403 "Verification failed. Reload and try again."** The driver is
stuck until they manually reload, losing whatever they typed.

Three forms handled this — clear the token, bump a React `key` on the widget so
the retry gets a fresh challenge. `NewsletterForm` even documents why:

> Turnstile tokens are single-use and verified server-side before the handler
> runs, so after ANY failed submit the held token is spent. Bumping this key
> remounts the widget for a fresh challenge.

Five did not:

| Form | Path it blocks |
| --- | --- |
| `ApplyForm` (step 1) | **the Academy application** — the primary enrollment funnel |
| `ClaimForm` | **CDL Pre-School Founding Student claim** — a paid product |
| `BecomeFounderForm` | Founders funding |
| `SubmitLocationForm` | driver location submissions |
| `ReviewForm` | driver reviews |

The two most valuable conversions on the site were in that list.

**Change.** Applied the existing pattern to all five: `setToken('')` plus a
`challengeKey` bump on both the error-response leg and the `catch` leg, and
`key={challengeKey}` on the widget. `ApplyForm` step 2 sends no token (the
server owns that leg — `applicationStep2Schema` has no `turnstileToken`), so it
is deliberately left alone.

**Test.** `scripts/test-turnstile-recovery.ts` (67 checks) enumerates every
component that renders `<TurnstileWidget>` — no hard-coded list, so a new form
is covered the day it is written — and for each: the widget carries a `key`
driven by React state, and inside the submit handler that actually *sends* a
token, every `!res.ok` branch either resets or rethrows, and every `catch` leg
resets. `TestResults` throws into a single catch rather than resetting inline;
that is equally correct and the test accepts it. Verified to bite — removing
the `ApplyForm` step-1 reset fails the check naming the exact branch.

---

## M12 — The map's search box collapsed to 26 pixels on a small phone

**Problem.** On `/directory/map`, the search field shares a `flex-wrap` toolbar
row with the "📍 Use my location" button. `flex-wrap` only wraps an item that
asks for the full width, and `flex-1` (basis 0) never does — so instead of
wrapping onto its own line, the input just shrank.

Measured on the production build:

| Viewport | `#map-search` width |
| --- | --- |
| 320 px | **26 px** |
| 390 px | 89 px |

26 px is narrower than a single character of its own placeholder ("City, state,
ZIP, or business…"). This is the primary control for finding a stop on the map.

**Change.** The form is `w-full` below `sm` (so it wraps to its own line) and
`sm:w-auto sm:flex-1` from `sm` up (unchanged behaviour on wider screens). Also
confirms the earlier `min-w-0` sweep was necessary but not sufficient — that
lets a control shrink; this stops it having to.

**After.** No control under 120 px on any of 11 routes at 320 px or 390 px,
except two `<select>`s at ~102–107 px, which are sized to their own content and
fully usable.

**Test.** `scripts/test-design-tokens.ts` asserts the map search form claims a
full row below `sm` and still shares the toolbar row from `sm` up.

---

## Checked and found clean (no change made)

Recording these so the next pass does not re-investigate them.

- **Runtime errors.** 32 routes loaded at 390×844 with console + `pageerror`
  capture: zero application errors. The only console output is the deliberate
  `[Turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set` diagnostic and
  sandbox-only network/WebGL noise.
- **Performance.** LCP 124–668 ms, **CLS 0.000 on all 11 routes measured**,
  114–141 KB transferred, ≤3 long tasks. `three`, `@react-three/fiber`, `gsap`,
  and `leaflet` are all behind `next/dynamic` or dynamic `import()` and never
  reach a route-initial bundle. There is no evidence-supported performance work
  to do, so none was invented.
- **API boundary.** Every guarded POST route answers malformed JSON with 400,
  an empty object / array / null body with 422, over-length and malformed
  fields with 422, and burst traffic with 429 — all through the shared envelope,
  nothing leaking internals. Turnstile fails closed in production.
- **Structured data.** Every page's JSON-LD parses. `/academy/cdl-school-dalton-ga`
  emits two `EducationalOrganization` nodes, correctly disambiguated by `@id` +
  `parentOrganization`.
- **Admin auth.** HMAC session cookie, constant-time compare, fails closed when
  either env var is missing.
- **Placeholder endpoints.** `/api/revalidate` and `/api/stripe/webhook` both
  no-op safely when their secret is unset and never act on an unverified body.
- **Header menu.** Closes on route change, on Escape (returning focus to the
  trigger), and on an outside tap.
- **Empty states.** Practice-test runners and the map both render honest,
  branded empty states without a database ("This test isn't open yet", "No
  mapped locations match these filters" + Clear filters).

---

## Validation

Every command below was run on this branch, from a clean `npm ci`.

| Command | Result |
| --- | --- |
| `npm run format:check` | All matched files use Prettier code style |
| `npm run lint` | No ESLint warnings or errors |
| `npm run typecheck` | pass |
| `npm test` | All 56 harnesses passed |
| 36 routes × 7 viewport widths (320–1024) | 0 horizontal overflow |
| `npm run build` | pass |
| `WARN_ONLY_PREFIXES=/knowledge,/directory node scripts/crawl-links.mjs http://localhost:3000` | No broken internal links (3 warn-only 404s under `/knowledge`, all DB-backed and expected without a database) |
| axe-core 4.10, 19 routes × {1280×900, 375×812} | 0 violations (was 5 rules / 13 nodes) |

## Known limitations

- The sandbox cannot reach `*.netlify.app`, so the deploy preview was not
  crawled from here. `preview-crawl.yml` remains the authoritative check for
  DB-backed routes.
- Without database credentials, `/knowledge/*` and DB-backed `/directory/*`
  pages could only be exercised as fail-soft empty states, not with real rows.
