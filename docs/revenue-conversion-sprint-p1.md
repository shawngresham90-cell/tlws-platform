# Revenue Conversion Sprint — Phase 1 audit

**Date:** 2026-08-02 · **Base:** `main` @ `9673576` · **Status:** audit complete, one improvement shipped, everything else awaiting owner decisions.

Read this before approving anything below. Three of the six tasks turned up a premise that did not match the code, and in each case the correction changes what the right next step is.

---

## Task 1 — Practice test → Academy CTA

### The CTA already exists

The brief assumed it might not. It does, and has for some time. `src/components/test/TestResults.tsx` is shared by both runners (Study Mode and Timed Test), so every graded sitting ends on the same screen, and that screen already carries **two** next-step cards:

| Card | Headline | Action | Destination |
|---|---|---|---|
| Academy | `Ready for the real thing?` (pass) / `Want hands-on help?` (fail) | Apply to the Academy | `/academy/apply` |
| CDL Pre-School | `Still before the permit?` | See CDL Pre-School | `PRESCHOOL_PATH` |

Pass/fail variants: **already implemented.** Placement: **already optimal** — directly under the score panel, above the per-question review.

### What was actually missing: the measurement

`practice_test_completed` fired on every sitting, but **neither CTA fired anything on click.** So the funnel could report how many students finished a test and what they scored, and nothing at all about what they did next — the single most valuable decision point was the only one with no instrumentation.

### What shipped

Click events only. **No copy was written, changed, or moved.**

```ts
// src/lib/tests/analytics.ts
TEST_EVENTS.completed          = 'practice_test_completed'          // was inline, now registry
TEST_EVENTS.academyCtaClick    = 'practice_test_academy_cta_click'  // new
TEST_EVENTS.preschoolCtaClick  = 'practice_test_preschool_cta_click' // new
```

Payload: `{ test, mode, variant, placement }`. No email, no score, no identifiers — asserted by test.

`variant` is `pass` / `fail` / **`drill`**. Drill is its own value rather than being folded into pass or fail: a saved-work drill runs a hand-picked subset and deliberately shows *no* pass/fail verdict, so reporting one would invent a distinction the student never saw.

### One shared-component change, and why it was necessary

`Button` swept `onClick` into `...rest`, which only reached the `<button>` branch. Passing `onClick` alongside `href` therefore did nothing — silently. `onClick` is now forwarded to the link branches too.

Two things make this safe: no caller passed both props before, so no existing render changes; and the `<button>` branch still receives `onClick` explicitly, which is what the **Retake** control depends on. Both directions are asserted in `scripts/test-practice-test-cta.ts`, because breaking Retake would be far worse than missing an analytics event.

### Copy still requiring owner approval — placeholder IDs

Nothing below is implemented. These are the insertion points that would need **new** words, with IDs to approve against.

| ID | Location | What it needs | Why it's blocked |
|---|---|---|---|
| `PT-CTA-01` | Results, Academy card — fail variant | A stronger recovery line than the current shared body copy | Current body text is identical for pass and fail; a fail-specific line would likely convert better but is new marketing copy |
| `PT-CTA-02` | Test overview page (`/practice-tests/[slug]`), below the mode picker | A pre-attempt Academy line | No Academy CTA exists before the test, only after |
| `PT-CTA-03` | Practice-tests hub (`/practice-tests`) | A hub-level Academy or Pre-School line | Hub currently routes only to tests |

**Recommendation:** approve `PT-CTA-01` first. It is one sentence, it targets the students most likely to need paid training, and it is the only one of the three that does not add a new interruption to a page.

---

## Task 2 — Academy lead system (planning only)

### Premise correction: most of this already exists

The brief asks to design a lead-capture system. A working one is already in production. Designing a new schema would have duplicated it and split the funnel across two tables.

**Already built** (migration `008_leads.sql`, plus `046_sms_consents.sql`):

```
leads(id, email UNIQUE, first_name, phone, sms_consent, source, utm jsonb, created_at, updated_at)
lead_magnets(id, slug UNIQUE, title, file_url, is_active, created_at)
lead_magnet_claims(lead_id, magnet_id, claimed_at)   PK(lead_id, magnet_id)
sms_consents(...)   append-only TCPA/10DLC evidence log
```

Already working: `/api/lead` (upsert by email, UTM capture, fail-closed SMS consent), `/api/tests/attempt` (email-only save, Turnstile-verified), `src/lib/leads/funnel.ts` (source → segment mapping), and a read-only admin list at `/admin/leads` with per-segment counts.

Registered sources today: `newsletter`, `founder`, `practice-test`.

### So the real work is not a new system

It is four gaps in the existing one.

**Gap 1 — there is no `academy` lead source.** `LEAD_SOURCES` has three values and none is Academy. An Academy enquiry today either becomes an application (a different table) or is not captured at all. There is no soft-intent capture between "read the Academy page" and "fill in a full application."

*Recommended:* add `'academy'` to `LEAD_SOURCES` and a segment `{ key: 'students-academy', label: 'Students — Academy' }`. This is a TypeScript change only — `leads.source` is already free-text, so **no migration is required.**

**Gap 2 — no export.** `/admin/leads` is deliberately read-only: no mutation, no sends, no export. Getting a list out today means a manual database query.

*Recommended:* a server-side CSV export behind `requireAdmin()`, streaming `email, first_name, source, segment, utm_source, utm_campaign, created_at`. Deliberately **exclude phone** unless a matching `sms_consents` row exists — the consent log is the authority on who may be contacted, and an export that leaks phone numbers past that boundary is how a TCPA problem starts.

**Gap 3 — no consent capture for email.** `sms_consent` is rigorously evidenced. Email consent is not; the practice-test form's promise ("study tips and new tests… unsubscribe anytime") is copy, not a stored record.

*Recommended:* before any email is actually sent, record email consent with the same append-only evidence pattern as `sms_consents`. **This does need a migration and is not proposed for this phase.**

**Gap 4 — first-touch attribution is lost.** The upsert overwrites `utm` on repeat submission, so a lead who arrives from YouTube and later converts from search reports search. `funnel.ts` explicitly notes it does not do first-touch merge.

*Recommended:* preserve first-touch UTM and record last-touch separately. Needs a migration; not this phase.

### Recommended field set (for a future Academy form)

| Field | Required | Validation | Note |
|---|---|---|---|
| `email` | yes | RFC-shaped, lowercased, ≤254 | The identity key; already `UNIQUE` |
| `first_name` | no | ≤80, trimmed | Personalization only |
| `phone` | no | E.164 after normalization | **Only** store with a consent row |
| `state` | no | 2-letter USPS | Relevant — the Academy is Dalton, GA |
| `timeline` | no | enum: `now` / `3-months` / `exploring` | Drives follow-up priority |
| `has_permit` | no | boolean | Routes to Academy vs Pre-School |
| `source` | server-set | `'academy'` | Never client-supplied |
| `utm` | server-set | jsonb | From query params |

**Spam protection:** Turnstile (already integrated via `TurnstileWidget`), same-origin check, and the existing IP rate limiter — the exact stack `/api/tests/attempt` already uses. No new vendor.

**Admin workflow:** list → filter by segment → mark contacted → export. Only the export is proposed near-term; "mark contacted" implies a status column and therefore a migration.

**Retention:** 24 months from last activity for un-converted leads, then delete. Consent evidence rows are compliance artifacts and must **outlive** the lead record — never cascade-delete them.

**Privacy:** the existing `/privacy` page must be checked against any new field before it ships. Adding `state`, `timeline`, or `has_permit` may require a privacy-copy update, which is **owner-approved text**, not something to draft here.

### Where forms belong

1. `/academy` — below the fold, soft intent ("send me details"). Highest traffic, lowest commitment.
2. `/academy/financing` — highest-intent Academy page that is not the application itself.
3. `/cdl-pre-school` — already has a claim flow; align its source tagging rather than adding a form.

**Not** on `/academy/apply` — that page already has the full application, and a competing lower-commitment form would cannibalize it.

---

## Task 3 — Product activation audit (13 direct products)

Six are purchasable. Seven are not. **No prices are invented below.**

| # | Product | Type | Visible | Purchase state | Missing | What activates Buy Now |
|---|---|---|---|---|---|---|
| 1 | The Driver's Mind | free | yes | **Active** — Get it free | — | n/a |
| 2 | 7 DOT Inspection Mistakes | free | yes | **Active** — Get it free | — | n/a |
| 3 | The First 72 Hours | free | yes | **Active** — Get it free | — | n/a |
| 4 | DOT Inspection Cheat Sheet | free | yes | **Active** — Get it free | — | n/a |
| 5 | The Freedom We Haul | free | yes | **Active** — Get it free | — | n/a |
| 6 | Founding Member Shirt | merch | yes | **Active** — Buy now ($35) | — | n/a |
| 7 | 17 Years. Zero Violations. | digital | yes | Blocked — "Details coming soon" | **price** | Owner confirms price |
| 8 | Keep More of Your Money | digital | yes | Blocked — "Details coming soon" | **price** | Owner confirms price |
| 9 | Book a 1:1 Call With Shawn | coaching | yes | Blocked — "Details coming soon" | **price** | Owner confirms price |
| 10 | Carnivore Trucker Health System | digital | yes | Blocked — "View details" | **price + disclaimer** | Approved disclaimer, then price |
| 11 | Save Your CDL: SAP Guide | digital | yes | Blocked — "View details" | **price + disclaimer** | Approved disclaimer, then price |
| 12 | The Crusher Guide | digital | yes | Blocked — "View details" | **price + disclaimer** | Approved disclaimer, then price |
| 13 | The HOS Bible | digital | yes | Blocked — "View details" | **price + disclaimer** | Approved disclaimer, then price |

**No additional implementation is required for any of them.** `ctaState()` already resolves a confirmed price plus a cleared blocker into a live Buy Now. Products 7–9 need one number each. Products 10–13 need owner-approved disclaimer copy *and* a number.

**Highest-value unblock: #9, the coaching call.** It is the highest-margin item in the catalog, needs only a price, and has no regulatory copy in its path.

---

## Task 4 — Conversion map

| Path | CTA exists? | Tracked? | Measurable? | Owner decision? | Recommendation |
|---|---|---|---|---|---|
| Knowledge Center → Store | Yes (1 link) | No | No | No | Wire a store-CTA event; consider contextual product links per article cluster |
| Knowledge Center → Academy | **No** | n/a | No | **Yes — copy** | Largest untapped path. KC is SEO traffic with zero Academy route |
| Practice Tests → Academy | Yes | **Yes (shipped)** | **Yes** | No | Done this sprint |
| Directory → Academy | **No** | n/a | No | **Yes — copy** | Directory traffic is working drivers, not students. Lowest fit of the gaps |
| Directory → Sponsorship | Yes (`/sponsors` ×2, claim ×10) | No | No | No | Wire claim + sponsor-inquiry events. Revenue-bearing and currently blind |
| Academy → Application | Yes (4 links) | Partial | Partial | No | `application_started` / `application_submitted` fire **inside** the form; the CTA clicks that lead there are untracked, so drop-off before the form is invisible |
| Academy → Products | **No** | n/a | No | **Yes — copy** | Academy students are a natural fit for the CDL guides |
| Store → Academy | **No** | n/a | No | **Yes — copy** | Store buyers already trust the brand |

**Analytics baseline:** the whole platform fires only six non-store events — `app_error`, `application_started`, `application_submitted`, `newsletter_lead_captured`, `page_not_found`, `practice_test_completed` — plus a well-wired 10-event store registry. Every other funnel is unmeasured.

**The pattern:** four of eight paths have no CTA at all, and every one of those four needs owner-approved copy. Three of the four paths that *do* have a CTA are untracked, and **wiring those needs no copy at all.**

---

## Task 5 — Amazon curation

### Premise correction: there is nothing to un-hide

The catalog is not a hidden storefront. Measured across all 104 Amazon rows:

- rows with a non-empty ASIN: **0**
- rows with a non-placeholder image: **0**

Every one of the 104 is a well-written product write-up — name, tagline, description, benefits, pros — with **no actual Amazon product behind it**. `productActive()` returns false for all 104, so even with `SHOW_AMAZON_PRODUCTS` flipped to `true` the store would render 104 pages with no working affiliate link.

**Flipping the flag would not generate one cent.** The real work is sourcing ASINs and images, product by product.

The flag was not changed. Catalog spread: electronics 43, cab-kitchen 18, tools-maintenance 14, comfort-sleep 12, safety-emergency 7, health-wellness 7, apparel-gear 3.

### Recommended first 15 to source

Ranked by relevance to the audience, educational tie-in, trust (nothing where a bad pick causes harm), expected conversion, and overlap with existing content.

| # | Slug | Category | Why first |
|---|---|---|---|
| 1 | `dual-dash-cam` | electronics | Highest-intent trucker purchase; protects against false claims; ties to DOT/inspection content |
| 2 | `tire-pressure-gauge` | tools | Cheap, universal, pre-trip inspection tie-in — direct overlap with practice-test content |
| 3 | `roadside-emergency-kit` | safety | DOT-adjacent, high trust, clear need |
| 4 | `reflective-warning-triangles` | safety | Literally required equipment; strongest compliance tie-in |
| 5 | `hi-vis-safety-vest` | safety | Same — required, cheap, high conversion |
| 6 | `led-work-light` | tools | Universal, low price point, frequent replacement |
| 7 | `rand-mcnally-road-atlas` | electronics | Iconic trucker item; pairs with the directory and trip planner |
| 8 | `12v-cooler-fridge` | cab-kitchen | High ticket, high margin, strong lifestyle fit |
| 9 | `12v-lunchbox-cooker` | cab-kitchen | Low price, high volume, health/food-cost angle |
| 10 | `memory-foam-seat-cushion` | comfort | Back pain is near-universal in this audience |
| 11 | `gel-seat-cushion` | comfort | Same need, alternative price point |
| 12 | `power-inverter` | electronics | Core cab-power item, high ticket |
| 13 | `usb-fast-charger` | electronics | Cheapest possible entry purchase |
| 14 | `over-ear-trucker-headset` | electronics | Daily-use item, hands-free legal angle |
| 15 | `compression-socks` | health | Genuine occupational-health fit, low price |

**Deliberately excluded from the first pass:**

- **All 7 GPS units.** TLWS has its own Trip Planner. Promoting competing navigation hardware undercuts the platform's own tool.
- **All CPAP items** (`travel-cpap-machine`, `cpap-battery-pack`, `cpap-cleaning-supplies`) and `blood-pressure-monitor`. These sit next to DOT-medical certification. Recommending medical devices to drivers whose livelihood depends on a medical card is a category that needs owner and possibly professional review — not an affiliate ranking decision.
- **All 7 CB radios** — declining relevance, and 7 slots is disproportionate.

---

## Task 6 — Quick wins, ranked

### Under 1 hour

1. **Wire the three untracked existing CTAs** — directory claim, sponsor inquiry, and Academy-apply clicks. No copy, no design, no owner decision. Turns three blind revenue paths into measured ones. *Effort: ~45 min. Direct revenue: none. Enables every decision below.*
2. **Confirm the coaching-call price.** One number activates the highest-margin product in the catalog. *Effort: an owner decision, then zero code.*
3. **Confirm prices for #7 and #8** — two more products go live with no code change.

### Under 1 day

4. **Approve `PT-CTA-01`** (fail-variant Academy line) and ship it. Now measurable against the baseline this sprint just created. *Effort: ~1 h after copy approval.*
5. **Admin CSV lead export.** Unlocks every email campaign; the list already exists and is currently trapped. *Effort: ~3 h. No migration.*
6. **Add the `academy` lead source + segment.** TypeScript only, no migration. Prerequisite for any Academy capture. *Effort: ~1 h.*
7. **Approve disclaimer copy for the four blocked guides.** Four products at once, zero code. *Effort: owner + review time.*

### Under 1 week

8. **Knowledge Center → Academy CTA.** The single largest untapped path — SEO traffic with no route to the highest-value product. Needs approved copy plus a reusable component. *Effort: ~1 day after copy.*
9. **Academy soft-intent form** on `/academy` and `/academy/financing`, writing to the existing `leads` table with `source='academy'`. No migration if limited to existing columns. *Effort: ~2 days.*
10. **Source ASINs + images for the 15 products above.** The only path to any Amazon revenue. *Effort: ~1–2 days of sourcing; then the flag decision becomes real.*

**Ordering rationale:** items 1–3 cost almost nothing and either unlock revenue directly or make everything after them measurable. Item 8 has the largest ceiling but is gated on copy. Item 10 has real revenue potential but is the most labor per dollar, and until it is done the Amazon flag is a decision about nothing.

---

## What this sprint did *not* touch

No database write. No migration. No Store catalog change. No `SHOW_AMAZON_PRODUCTS` change. No HERE routing, HOS, Trip Planner, Founder Wall, Directory logic, Navigator, or PWA work. No deployment.
