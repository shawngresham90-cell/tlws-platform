# Truck Parking Club — Partner & Attribution Audit (PR 1)

Status: **AUDIT — no integration is live.** This document records what exists,
what is confirmed, and what the owner must confirm before any revenue wiring
ships. Nothing in this file grants permission to render pricing,
availability, or attribution that is not confirmed below.

## 1. Relationship summary (confirmed by owner)

- Truck Parking Club (TPC) is an **active TLWS revenue partner** (owner
  directive, July 2026) and the Trip Planner's MVP reservable-parking
  partner. Negotiations continue; **Phase 1 (promo-code link-out) is
  owner-approved** and does not wait on the final agreement.
- **Confirmed revenue model (owner, July 2026): first-time TPC users who
  book with promo code SHAWN20 generate $20 for TLWS.** Phase 1 therefore
  displays the code prominently and links out — no URL-parameter
  attribution is wired until TPC confirms one (§4 item 2).
- Phase 1 kill switch: `NEXT_PUBLIC_TPC_PLANNER_ENABLED=false` removes the
  planner band; constants live in `src/lib/directory/tpc.ts`.
- Contacts (Blueprint §22/§26): **Michael Lombard** (existing partner
  contact) · **Colin Schlick** (API credentials — pending since a prior
  project's Epic 2; not MVP-blocking, Phase-2-blocking).

## 2. Infrastructure that already exists in this repo (reuse, don't rebuild)

| Asset | Location | State |
|---|---|---|
| `locations.tpc_url` column | migration `018_directory_admin.sql` | Live schema; **null on all production rows** |
| `locations.affiliate_code` column | same | Live schema; stored via admin form; appended to nothing |
| Strict URL validator (https, `truckparkingclub.com`/`www` only, query preserved for affiliate params) | `src/lib/directory/tpc.ts` | Live |
| Admin bulk workbench (candidates, warnings, CSV set/clear, history-first apply) | `/admin/directory/tpc` | Live |
| Planner data path: `tpc_url` → `StopCandidate.reservationUrl` → `Reserve↗` link (`rel="sponsored"`) in the stop timeline | `directory-loader.ts` · `directory-layer.ts` · `TripPlannerApp.tsx` | Live, renders whenever a listing has a URL |
| Directory Reserve CTAs (EntryCard, location detail, parking page, map popup) | four surfaces | Live, untracked |
| Staged TPC location URLs (~10 lots, I-75 TN/GA/FL + I-65 IN) | `data/imports/*.csv` | **Not imported — Directory imports are parked by standing owner order** |

## 3. What does NOT exist (verified — do not assume otherwise)

- No TPC API, credentials, feed, or export anywhere in the repo or env.
- No pricing data. No live availability data. No TPC-supplied coordinates
  or space counts.
- No attribution wiring: SHAWN20 appears once, in a comment; no link
  carries a promo/ref parameter; the public parking page says
  "Affiliate link coming soon."
- No analytics on any TPC CTA (zero `trackEvent` call sites exist
  repo-wide today).

## 4. Owner inputs required (the PR 2 gate)

Provide these to unblock attribution wiring. **Do not paste secrets into
chat or commit them — API keys and tokens go directly into Netlify env.**

| # | Input | Why | Status |
|---|---|---|---|
| 1 | The partner agreement / terms (doc or summary of attribution + brand-use clauses) | Defines what we may render and how commissions attribute | ☐ |
| 2 | SHAWN20 mechanism: checkout promo code, URL parameter, or both — with **one example link exactly as TPC issued it** | The adapter decorates URLs only with a confirmed format | ☐ |
| 3 | Commission conditions (what counts as a converted booking; any cookie window) | Defines the revenue-verification test in PR 6 | ☐ |
| 4 | Whether drivers receive a discount via SHAWN20 | Card copy may only claim a discount if true | ☐ |
| 5 | Deep-link support: are per-location URLs stable/constructible, or is search-page linking the approved fallback? | Determines Tier A link shape + graceful fallback | ☐ |
| 6 | Brand-asset permissions (name/logo on cards) | "Powered by Truck Parking Club" label needs contractual cover | ☐ |
| 7 | Required disclosure wording, if the agreement specifies any | Otherwise the §6 draft applies | ☐ |
| 8 | API credentials **only if TPC issues them** (Colin Schlick) → straight to Netlify env | Unlocks Tier C (availability/pricing) — Phase 2 | ☐ |

## 5. Integration tiers (one adapter seam, three data realities)

- **Tier A — link-out (MVP):** stored per-listing `tpc_url` + confirmed
  attribution decoration. No availability, no pricing rendered. Ships
  revenue with zero TPC engineering dependency.
- **Tier B — partner dataset:** official location feed/export synced on an
  agreed cadence. Adds coverage; still link-out booking.
- **Tier C — API:** live availability/pricing/deep links; enables
  `tpc_booking_returned` only if a supported callback exists.

The UI is identical across tiers; fields render only when their data
source exists. Rule 4 of the confidence ladder ("reservable now") is
impossible by construction until Tier C.

## 6. Disclosure (draft — owner approves or replaces in input #7)

> Trucking Life earns a commission on reservations made through Truck
> Parking Club links. Partnerships never change organic rankings.

Placement mirrors the Amazon precedent (`AmazonDisclosure`): an inline
variant on every surface carrying a Reserve CTA, plus the "Powered by
Truck Parking Club" label on each partner card. All TPC links keep
`rel="sponsored noopener noreferrer"` (already enforced).

## 7. Revenue attribution — how we will verify it actually pays

1. PR 2 wires the confirmed attribution into every planner/directory
   Reserve link (server env, flag-gated, dormant).
2. Analytics events (PR 3): `tpc_results_shown`, `tpc_location_selected`,
   `tpc_reserve_clicked`, `tpc_deep_link_opened`, `tpc_no_results`,
   `tpc_service_unavailable` (+ `tpc_booking_returned` only if input #8
   yields a callback). Payloads bucketed (corridor, HOS bucket, detour
   bucket, position) — never precise location, never PII.
3. PR 6 acceptance includes **one real attributed test reservation**
   confirmed on TPC's side (or via the partner contact) before the flag
   turns on. Click counts without confirmed attribution do not count as
   revenue verification.

## 8. Hard boundaries (restated as the contract for every future PR)

- Organic ranking is never manipulated for commission — reachability and
  safety filters gate every reservable recommendation (arrival must fit
  inside the HOS window minus the driver's buffer).
- No invented pricing, availability, space counts, API access, or
  "guaranteed" language. Reservation is confirmed only inside TPC's flow.
- Free-parking discovery remains available and clearly labeled — one tap
  in Parking Mode, never demoted for revenue.
- Directory/Census imports remain parked; the staged TPC CSVs load only
  when the owner explicitly un-parks imports.
