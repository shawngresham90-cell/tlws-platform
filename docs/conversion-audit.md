# CDL Pre-School — Conversion Optimization Audit & Report

> **Price update (2026-07-16):** the Founding Student price is now **$199** (changed from $149 in `src/lib/preschool/constants.ts`, the single source of truth). The $149 figures below are historical — they describe the offer as it stood when this audit was written.

Milestone: Conversion Optimization (post-launch). Branch
`feat/conversion-optimization`. Baseline: production `main` @ `e2ac34d`
(PR #49 live). Constraints honored: $149 unchanged, 20-spot limit unchanged,
Academy Founders Wall untouched, no migrations, no production data changes,
every number on the page comes from real production wall data.

## 1. Funnel audit — where a visitor can drop off

The paid funnel is: **entry page → /cdl-pre-school → Stan Store checkout →
(post-purchase) claim → wall.** Drop-off points found, worst first:

| # | Drop-off point | Baseline problem | Fix in this PR |
| - | --- | --- | --- |
| 1 | Homepage hero | Pre-School CTA was second (red secondary), no price shown — the money offer didn't lead | Pre-School is now the primary yellow CTA, first, with the price: "Start CDL Pre-School — $149" |
| 2 | Mobile scroll on the sales page | After the hero, the next purchase button was ~4 screens away (offer section); a convinced mobile reader had no button in reach | Sticky mobile CTA (always visible after the hero) + a new mid-page CTA after the curriculum — purchase is now never more than one screen away |
| 3 | Scarcity was words-only | "Limited to the first 20" was a sentence; no visual state, no live numbers | SpotsMeter: real filled/remaining from the production wall on the homepage card, sales hero, offer section, and final CTA. Zero-state is honest ("All 20 spots are open") — no fabricated counts, ever |
| 4 | Trust at the decision moment | No reassurance near the buy button (new brand, unknown checkout) | Factual trust badges under the hero CTA: secure Stan Store checkout, 17-year/zero-violation driver, working CDL instructor, mobile friendly |
| 5 | FAQ engagement invisible | FAQs were a static wall of text; no way to know what stops buyers | FAQs are now accessible disclosures with per-question open tracking |
| 6 | Shared links looked bare | No Open Graph image existed anywhere on the site — links pasted into texts/Facebook rendered without a card | Branded OG/Twitter image for /cdl-pre-school (generated from the same price/capacity constants). Root cause fixed site-wide: `metadataBase` was unset AND `images: undefined` suppressed file-convention images |
| 7 | Funnel blind spots | Only purchase clicks and claim events were tracked | Added scroll-depth (25/50/75/100), FAQ opens, and nav-click tracking for homepage card → sales → wall — the full path is now measurable |

Not changed (deliberate): the four-path structure, price presentation,
disclosure copy ("leaving for secure checkout"), the honest zero-state, and
the what-it-is-not section — honesty is the brand's differentiator.

## 2. What shipped, objective by objective

1. **Funnel audit** — table above.
2. **Homepage** — Pre-School leads the hero with price; FourPaths card now
   carries the live SpotsMeter; "See what's included" click-tracked. No fake
   urgency, no invented testimonials (none exist — verified in the source
   audit; social proof is the founder's real record).
3. **Sales page** — CTA frequency 3 → 4 server-rendered + sticky mobile
   (hero / after-curriculum / offer / final / sticky); SpotsMeter at hero,
   offer, and final CTA; trust badges in the hero; FAQ converted to
   scannable disclosures.
4. **Sticky mobile CTA** — "Start CDL Pre-School — $149", appears after the
   hero, always visible while scrolling, mobile only, exact URL + sponsored
   rel + tracked placement; page reserves bottom space so content is never
   covered (no CLS).
5. **Progress indicators** — SpotsMeter shows 20 total / filled / remaining
   from `getFoundingWall()` (live `preschool_founding_students` reads,
   clamped math). Pure presentational component — it cannot invent numbers.
6. **Trust** — Secure checkout powered by Stan Store · created by a veteran
   truck driver (17 years, zero violations — "veteran" as in road-veteran,
   backed by the stated record) · built by a working CDL instructor · mobile
   friendly. All verifiable; no ratings or guarantees.
7. **SEO** — first OG/Twitter image on the site (sales page); `metadataBase`
   fix benefits every page; titles/descriptions already verified last
   milestone; breadcrumbs + Course/Offer/FAQ schema unchanged and re-tested;
   no images on these pages lack alt (the only imagery is decorative emoji,
   aria-hidden).
8. **Performance** — sales page +0.7 kB page JS (1.34 → 2.03 kB; First Load
   97.8 → 98.5 kB) for six new components; all routes still static/ISR; the
   sticky bar is a fixed overlay + reserved spacer (no layout shift); scroll
   listeners are passive and self-removing; OG image renders at the edge on
   demand. LCP unchanged (text hero, no new above-fold assets).
9. **Accessibility** — SpotsMeter uses `role="meter"` with value attributes;
   FAQ/curriculum are native `<details>` (keyboard for free); sticky CTA is
   a plain anchor in the tab order; contrast uses existing passing tokens;
   focus styles inherited from house classes.
10. **Analytics** (all payloads non-personal): `preschool_purchase_cta_click`
    now covers placements hero / after-curriculum / offer / final /
    sticky-mobile / homepage-card / wall / wall-empty · `preschool_scroll_depth`
    (percent) · `preschool_faq_open` (question) · `preschool_nav_click`
    (target + placement, incl. wall/founder clicks) · existing page-view,
    curriculum-expand, claim-started, claim-submitted.

## 3. Before / after

Screenshots (mobile + desktop, homepage / sales / wall) captured from local
production builds of `main` and this branch are attached to the PR
conversation, since binary files aren't committed to the repo.

| Metric | Before | After |
| --- | --- | --- |
| Homepage hero Pre-School CTA | 2nd, red, no price | 1st, yellow, "— $149" |
| Sales-page purchase buttons (SSR) | 3 | 4 + sticky mobile |
| Live spots indicator | none | 4 placements, real data |
| Trust badges | none | 4, all factual |
| OG/Twitter image | none site-wide | branded card on /cdl-pre-school |
| Funnel events instrumented | 7 | 10 (+scroll, FAQ, nav) |
| Sales page First Load JS | 97.8 kB | 98.5 kB |
| Test checks (preschool suite) | 127 | 163 |

## 4. What was deliberately NOT done

- No fake urgency, timers, or "X people bought today" (rule + brand).
- No testimonials/reviews/AggregateRating — none exist to cite.
- No price anchoring ("normally $XXX") — no other price has ever existed.
- No exit-intent popups — hostile pattern, poor mobile fit.
- No migration — the wall tables already serve real data.

## 5. Recommended next levers (owner decisions)

1. Publish a refund policy — the single biggest missing conversion trust
   element (checkout-page objection).
2. Finish Module 4–7 videos → the page can then advertise "video lessons".
3. Real student results/testimonials once the first Founding Students finish
   Module 1 — with written permission, they become the social-proof section.
4. Connect an analytics backend (Plausible/GA4) — instrumentation is live
   but currently no-ops without a vendor script.
