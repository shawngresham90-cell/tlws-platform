# Directory monetization — recommended structure (read-only proposal)

Prepared after the nationwide publication pass. **Nothing here is implemented.**
No payments, pricing, runtime features, or schema changes were built, and no
business was contacted. Prices are deliberately omitted — they are a business
decision, not something to infer.

## What already exists in the platform (no new capability assumed)

| Capability | Where it lives today |
|---|---|
| Per-listing "featured" flag | `locations.is_featured` (boolean, unused so far) |
| Sponsor records + rendering | `src/lib/directory/sponsors.ts`, `sponsors-data.ts` |
| Affiliate/partner link handling | `locations.tpc_url`, `affiliate_code`, `src/lib/directory/tpc.ts` |
| Listing quality signal | `locations.completeness_score` |
| Verification signals | `verified_at`, `manually_verified_at/by`, `src/lib/directory/trust.ts` |
| Owner corrections intake | `src/lib/directory/corrections.ts`, `issues.ts` |
| Lead capture with first-touch attribution | existing lead forms + `leadAttribution()` |
| Payments (dormant placeholder) | Stripe env keys, gated on EIN → bank → Stripe |

The recommendation below composes these; it does not require new subsystems.

## Recommended structure — three tiers

### 1. Claimed listing (free)
The owner verifies the listing and can submit corrections through the existing
corrections flow. Sets `manually_verified_at/by` and lifts
`completeness_score`. Free tier exists to build the claim funnel and improve
data quality — the claim itself is the acquisition channel for tiers 2–3.

### 2. Enhanced listing (paid, recurring)
Richer detail content the directory already models — hours, amenities, photo,
phone, website — plus a verified badge via the existing trust signals. Sold to
the operator of a single location. Natural fit for independents in
tire-repair, roadside-service, truck-washes and independent truck stops.

### 3. Sponsored placement (paid, recurring, inventory-limited)
Priority position on a **specific** corridor page (`/directory/i75`), exit page
(`/directory/i75/exit-29`) or category page (`/directory/tire-repair`), driven
by `is_featured` plus the existing sponsors module. Inventory is naturally
scarce — one or two slots per corridor/exit — which is what makes it sellable.

## Why this ordering

Sponsorship value tracks **purchase intent at the moment of search**, so the
categories this pass unlocked rank in this order:

1. **roadside-service / tire-repair** — breakdown intent; the driver buys now
   and picks the nearest listing. 28 newly published rows.
2. **truck-washes** — repeat, route-planned spend. 12 rows.
3. **independent truck stops** — competing with national chains for fuel and
   parking. 32 rows, of which 20 are independents.
4. **parking** — operators monetise reservations directly; scarcity is real.
   29 rows.
5. **cdl-schools** — high value per enrollment lead. 6 rows.
6. **cat-scales** — strong search intent, best sold as an upsell to the host
   site rather than standalone. 6 rows.
7. **hotels-truck-parking** — only the 15 with verified structured truck
   parking; weakest intent of the set.

## Guardrails to keep the directory trustworthy

- Sponsored placement must be **visibly labelled** and must never reorder a
  result set in a way that hides a closer or better-matched location.
- A paid tier must never change the facts of a listing (coordinates, category,
  amenities) — only presentation and priority.
- Held networks stay excluded from the directory regardless of willingness to
  pay; that policy is upstream of monetization.
- No claim about traffic, impressions, or conversion should be made to a
  prospect until analytics exist to substantiate it. The platform currently
  ships zero analytics unless `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set.

## Sequencing (each step separately authorized)

1. Turn on analytics so inventory can be described honestly.
2. Ship the free **claim** flow on top of the existing corrections intake.
3. Define enhanced-listing content fields (all already modelled).
4. Only then wire payments (Stripe is already gated on EIN → bank → Stripe).
5. Introduce sponsored placement last, once traffic per corridor is measurable.

## Companion file

`OUTREACH-CANDIDATES.csv` — 75 independent, newly published businesses ranked
by category priority, each with its live directory URL, corridor/category page,
why it is commercially valuable, and the tier that fits. It contains **no
contact details** — none were invented, and none were looked up.
