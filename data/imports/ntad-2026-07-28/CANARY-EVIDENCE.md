# NTAD canary — six-row evidence worksheet (2026-07-28)

Method: domain-restricted web search against official state-DOT /
toll-authority domains only (this environment's egress proxy blocks direct
page fetches with HTTP 403, so search-level confirmation against official
domains is the ceiling; each row names the exact page for the human
click-through). Fact labels: **STATE-CONFIRMED (2026)** · **NTAD-2019** ·
**UNKNOWN**. NTAD-2019 facts are never represented as current.

---

## 1. VT — Guilford Welcome Center — **APPROVED (insert unpublished)**

| Field | Value | Label |
|---|---|---|
| Official name | Guilford Welcome Center (Vermont Information Centers Division) | STATE-CONFIRMED (2026) |
| Route / direction | I-91 **North**, MM 5.6, before Exit 1, Guilford VT 05301 | STATE-CONFIRMED (2026) |
| Operating status | Open; **construction advisory**: Welcome Center building closed up to four nights for ramp paving, 9 p.m.–7 a.m. Sun–Thu windows; car lot under construction — visitors directed to the truck/bus area | STATE-CONFIRMED (2026) |
| Facility type | State welcome/information center | STATE-CONFIRMED (2026) |
| Truck-parking evidence | Official page describes a dedicated **truck/bus parking area** | STATE-CONFIRMED (2026) |
| Coordinates | 42.81201702, −72.56620015 | NTAD-2019 (plausible for MM 5.6; click-through to confirm) |
| Parking-space count | 19 | **NTAD-2019 — NOT current; inserted as NULL** |
| Overnight access | — | UNKNOWN (inserted as false = not confirmed) |
| Source URL | <https://informationcenter.vermont.gov/centers/guilford> | accessed 2026-07-28 |

## 2. ME — Kennebunk Service Plaza (Northbound) — **APPROVED (insert unpublished)**

| Field | Value | Label |
|---|---|---|
| Official name | **Kennebunk Service Plaza (Northbound)** — Maine Turnpike Authority (publishable official identity; NTAD's anonymized "NHS Rest Stop or Truck Facility 17" resolved to it by coordinate: 43.4104, −70.5582 = I-95 MM 25 NB) | STATE-CONFIRMED (2026) |
| Route / direction | I-95 (Maine Turnpike) **Northbound**, Mile 25, Kennebunk | STATE-CONFIRMED (2026) |
| Operating status | Open; C-store/fuel 24 hours | STATE-CONFIRMED (2026) |
| Facility type | Toll-road service plaza | STATE-CONFIRMED (2026) |
| Truck-parking evidence | MTA: plazas provide "spaces for long-haul operators to park" | STATE-CONFIRMED (2026) |
| Coordinates | 43.41037851, −70.55823999 | NTAD-2019 (consistent with MM 25; click-through) |
| Parking-space count | 37 | **NTAD-2019 — NOT current; inserted as NULL** |
| Overnight access | — | UNKNOWN (false) |
| Source URL | <https://www.maineturnpike.com/Traveler-Services/Service-Plazas/Kennebunk-Service-Plaza-(Northbound).aspx> | accessed 2026-07-28 |

## 3. DE — Smyrna Rest Area — **APPROVED (insert unpublished)**

| Field | Value | Label |
|---|---|---|
| Official name | Smyrna Rest Area (DelDOT) | STATE-CONFIRMED (2026) |
| Route / direction | US 13 / DE-1 Exit 119, 5500 DuPont Pkwy, Smyrna (single facility serving both directions — no directional suffix) | STATE-CONFIRMED (2026) |
| Operating status | **Open 24 hours** | STATE-CONFIRMED (2026) |
| Facility type | State rest area + visitor information center | STATE-CONFIRMED (2026) |
| Truck-parking evidence | DelDOT freight program documents the truck parking area (anti-idle hookups); **posted truck-parking limit: 10 hours maximum** | STATE-CONFIRMED (2026) |
| Coordinates | 39.3235, −75.6175 | NTAD-2019 (click-through) |
| Parking-space count | 28 | **NTAD-2019 — NOT current; inserted as NULL** |
| Overnight access | Restricted — 10-hour maximum stay | STATE-CONFIRMED (2026) → `overnight_parking=false` is the correct current value, not just a default |
| Source URLs | <https://deldot.gov/Programs/restareas/> · DelDOT "Truck Parking in Delaware" flyer (deldot.gov/Business/freight) · DelDOT Statewide Truck Parking Study data update | accessed 2026-07-28 |

## 4. CT — Darien Service Plaza (I-95 Southbound) — **APPROVED (insert unpublished)**

| Field | Value | Label |
|---|---|---|
| Official name | Darien Service Plaza, I-95 Southbound (CTDOT service-plaza program) | STATE-CONFIRMED (2026) |
| Route / direction | I-95 **Southbound**, ~MM 10, Darien (between Exits 11 & 13 corridor) | STATE-CONFIRMED (2026) |
| Operating status | Active — CTDOT 2024 press release and 2025 construction advisory name the Darien plazas (mainline sign replacement) | STATE-CONFIRMED (2026) |
| Facility type | Service plaza | STATE-CONFIRMED (2026) |
| Truck-parking evidence | CTDOT rest-area/service-plaza program: I-95/I-395 plazas provide truck parking areas | STATE-CONFIRMED (2026) |
| Coordinates | 41.068057, −73.504342 | NTAD-2019 (click-through) |
| Parking-space count | 70 | **NTAD-2019 — NOT current; inserted as NULL** |
| Overnight access | — | UNKNOWN (false) |
| Source URLs | <https://portal.ct.gov/dot/travel-gateway/roads-and-highways/rest-areas> · CTDOT press release 2024 (Darien/Madison/Montville/Plainfield sign replacement) | accessed 2026-07-28 |

## 5. CA — Gold Run Safety Roadside Rest Area (I-80 Eastbound) — **APPROVED (insert unpublished)**

| Field | Value | Label |
|---|---|---|
| Official name | Gold Run Safety Roadside Rest Area (Caltrans SRRA), eastbound side | STATE-CONFIRMED (2026) |
| Route / direction | I-80 **Eastbound**, Placer County (PM ~41.4), near Dutch Flat / Exit 144 | STATE-CONFIRMED (2026) |
| Operating status | Open — Caltrans D3 news release 23-027 "Gold Run Rest Areas Have Reopened on Interstate 80" (both directions) | STATE-CONFIRMED (2026, reopening release; click-through QuickMap for today's status) |
| Facility type | Safety Roadside Rest Area | STATE-CONFIRMED (2026) |
| Truck-parking evidence | Caltrans SRRA program provides truck parking; Caltrans materials describe Gold Run as a stop for motorists **and truck drivers** | STATE-CONFIRMED (2026) |
| Coordinates | 39.17545, −120.85773 | NTAD-2019 (click-through vs SRRA dataset) |
| Parking-space count | **CONFLICT — inserted as NULL.** NTAD-2019 says 24; Caltrans rest-area content surfaced "51 auto / 7 truck" for Gold Run, but the 7-truck figure could not be direction-attributed to the EB side from this environment. Per the owner rule ("use the Caltrans figure only if directly confirmed; never use both"), **neither figure is stored** | NTAD-2019 vs Caltrans-2026, unresolved |
| Overnight access | — | UNKNOWN (false); Caltrans SRRAs generally permit up to 8-hour stays — NOT stored, needs click-through |
| Source URLs | <https://dot.ca.gov/caltrans-near-me/district-3/d3-news/d3-news-release-23-027> · Caltrans SRRA dataset (data.ca.gov / caltrans-gis Rest_Areas FeatureServer / quickmap srra.kml) | accessed 2026-07-28 |

## 6. AL — Grand Bay Welcome Center — **HELD (no SQL)**

| Field | Value | Label |
|---|---|---|
| Official name | Grand Bay Welcome Center | STATE-CONFIRMED (2026) — listed on ALDOT welcome-centers page with phone 251-865-2418 |
| Route / direction | I-10 **Eastbound**, Grand Bay (NTAD mp 0.485) | Listing: STATE-CONFIRMED; milepost: NTAD-2019 |
| Operating status | **Listed only** — no real-time/open-status confirmation obtained (ALDOT directs to ALGOtraffic.com for live status) | UNKNOWN |
| Truck-parking evidence | **NONE current.** ALDOT/Tourism pages list restrooms, picnic, vending — no truck-parking statement found on any official page | NTAD-2019 only (90 spots) |
| Hold reasons | (1) no current official truck-parking evidence; (2) operating status not confirmed | — |

---

## Identity holds carried forward (never in SQL)

- **VT "Guilford North Parking Area"** (NTAD, I-91 N MM 1, 8 spots) — not
  individually identifiable on any official VT page; possibly distinct from
  the Welcome Center, possibly decommissioned. HOLD.
- **ME "NHS Rest Stop or Truck Facility 9"** (NTAD, I-95 N, York, 75
  spots) — anonymized; no official publishable identity resolved (not a
  named MTA plaza; nearest named candidates unverified). HOLD.
- **AL Grand Bay Welcome Center** — row 6 above. HOLD.

## What remains NTAD-2019-only across the approved five

Coordinates (all five — plausible and collision-free, but the click-through
should sanity-check each against the official page/map) and every
parking-space count (stored as NULL, never displayed). Everything else
stored on the approved rows is STATE-CONFIRMED (2026) or a safe false/NULL.
