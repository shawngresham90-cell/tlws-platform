# THE LAST STOP ENGINE — Product Definition & Implementation Sequence

Owner decision of record (July 2026): the Trip Planner's core product is
the **Last Stop Engine** — answering *"where do I safely stop before I run
out of hours?"* Everything else is supporting cast. We are **finishing what
exists, not rebuilding**: the audit found the HOS engine, HERE truck
routing, corridor discovery, stop ranking with reachability deadlines,
saved trips, parking flags, and the TPC reserve-link path already live.

Priority order (owner-set, non-negotiable): 1 driver safety · 2 HOS
planning · 3 reachability · 4 revenue · 5 free parking always available ·
6 reservable parking highly visible · 7 organic ranking never manipulated
for commission.

## 1. The driver promise

Input: current location, destination, remaining driving hours (optional:
window remaining, parking preference, safety buffer — default 30 min).
Press **PLAN MY TRIP**. In under 30 seconds the driver understands where
to stop: truck-safe route, ETA, and the named stop slots below, plus
stops/rest areas/weigh stations along the corridor and parking filters.

## 2. The named slots (all selections over the organically-scored set)

| Slot | Definition | Source machinery |
|---|---|---|
| **Best overall stop** | Highest composite score inside the stop window | existing `rankCandidates` — unchanged |
| **Last free stop** | Furthest-along candidate with free/overnight parking flags inside usable drive | existing candidates + parking booleans (loader gap: select `free_parking`/`paid_parking` — code-only, columns exist) |
| **Best reachable reservable stop** | Highest-scored `reservationUrl` candidate whose arrival fits window − buffer | existing scoring + new selection fn |
| **Last reachable reservable stop** | Furthest-along such candidate before the buffer | new selection fn; reason: "Last reservable parking option before your 30-minute HOS safety buffer." |
| **Backup stop** | Best candidate 15–45 min before the chosen primary, capacity-weighted | existing `maxAlternates` machinery |
| *Emergency fallback* | First candidate past expiry — visually distinct warning card, never counted as a recommendation | existing virtual-stop path, new rendering |

**Safety invariant (tested, not just stated):** reachability is a *filter*,
never a weight. No reservable slot can contain a stop whose projected
arrival exceeds `min(drive, window) − buffer`. Commission cannot outrank
safety by construction. Degradation is honest: "No verified free parking
before your window closes — last free option is 38 min past your buffer."

## 3. Truck Parking Club presentation (MVP, Tier A link-out)

Prominent labeled band near the top of results — after the summary strip
and HOS timeline, before the all-stops list:

> **RESERVE YOUR PARKING BEFORE YOUR CLOCK RUNS OUT**

Up to three cards: best reservable · last reachable reservable · earlier
backup reservable. Each renders **only verified fields**: name,
highway/exit or address, detour minutes, projected arrival, HOS remaining
at arrival, parking type, known amenities, templated reason line,
**Reserve Parking** CTA, "Powered by Truck Parking Club," disclosure line.
No pricing, no availability, no space counts, no "guaranteed" — those
render only if a future tier supplies partner-sourced data. This is the
platform's sponsor boundary applied: premium placement in a separated,
labeled unit; the organic list is never entered or reordered.

Parking Mode chips: Best · Free · Reservable · Truck Parking Club · Big
lots · Closest ahead · Near my HOS limit. Free parking is one tap and
clearly labeled, always.

## 4. Reuse map (what we are NOT rebuilding)

`hos-engine.ts` (49 CFR 395.3 model + planDrive) · `here-routing.ts`
(truck-attributed routing, server key, cache, no car fallback) ·
`optimizer.ts` (`nextNeed` deadline-mile reachability, `selectStop`,
alternates, virtual-stop fallback) · `directory-layer/loader` (corridor
candidates, scoring, `tpc_url → reservationUrl`) · `saved-trips-store` +
cloud sync (migration 044) · parking flag columns (migration 018) ·
`lib/directory/tpc.ts` validator + `/admin/directory/tpc` workbench ·
`Reserve↗` rendering + `rel="sponsored"` conventions · `trackEvent`
dispatcher.

## 5. Implementation sequence (each PR flag-gated, independently rollback-able)

- **PR 1 (this PR — docs only):** this file + partner/attribution audit
  (`docs/partners/truck-parking-club.md`) + HOS verification record
  (`docs/compliance/hos-verification.md`).
- **PR 2 — loader gap + attribution adapter (dormant):** loader selects
  free/paid/reserved + `verified_at`; `ParkingPort` seam + Tier-A
  attribution decoration (server env); disclosure constants; flag
  `NEXT_PUBLIC_TPC_PLANNER_ENABLED`. *Gate: partner doc §4 inputs 1–2.
  Acceptance: flag-off byte-identical; attribution idempotent,
  approved-hosts-only; adapter failure ⇒ warning, organic untouched.*
- **PR 3 — five-slot selection layer + analytics (hidden):** selection
  functions + templated reasons; `plan_*`/`laststop_*`/`tpc_*` events with
  bucketed, PII-free payloads. *Gate: HOS verification human row complete.
  Acceptance: arrival ≤ window − buffer property test; organic ranking
  unchanged flag-on; offline fixture corridors.*
- **PR 4 — results UI (hidden):** slot cards (rank label, three tabular
  numbers, confidence dots at true data rungs, reason, source footer),
  TPC band, emergency-fallback variant, safety statement every results
  screen. *Acceptance: ≤10-tap core journey at 375px; no render path for
  price/availability exists; a11y floor; flag-off identical.*
- **PR 5 — Parking Mode + filters (hidden):** high-stress surface,
  staleness stamps, culprit-filter empty states, primary/backup selection.
  *Acceptance: 3 taps to actionable parking; claims render at-or-below
  data rung (automated).*
- **PR 6 — reference trips + founder road test + flag-on:** 15
  hand-planned corridor trips validated by Shawn (his sign-off is the
  acceptance test), one real attributed reservation verified, then enable.
  Two kill switches remain: UI flag, attribution env.

## 6. Owner inputs & open decisions

Partner inputs: `docs/partners/truck-parking-club.md` §4 (items 1–2 + 7
unblock PR 2). Decisions: pilot corridors (recommend I-75 + owner's pick) ·
buffer default confirmation (30 min) · disclaimer legal review before
public launch · product naming ("Last Stop — the TLWS Trip Planner") ·
the Census/import un-parking question (blocks corridor *coverage* and the
~10 staged TPC lots, not the engine work).

## 7. Standing exclusions

No Directory/Census imports, no production data changes, no Live Radio /
Marketplace / Connect / CDL-School / homepage work under this effort. No
ELD-adjacent behavior ever: no log reconstruction, no background clock
countdown, no legal verdicts, no in-motion interaction patterns.
