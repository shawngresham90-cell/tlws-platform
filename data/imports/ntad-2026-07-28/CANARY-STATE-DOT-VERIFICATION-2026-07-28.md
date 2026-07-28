# NTAD canary — state-DOT verification worksheet (2026-07-28, read-only)

Method: domain-restricted web search against official state sources only
(direct page fetches remain 403-blocked by the environment's egress proxy).
Search-level confirmation is the ceiling here; each row lists the exact
official page for the human click-through. NO database writes performed.

| # | Canary (NTAD 2019) | State source | Verdict | Notes |
|---|---|---|---|---|
| VT | Guilford Welcome Center, I-91 N MM 5.6, 19 spots (SWAPPED IN for the unconfirmed MM-1 "Guilford North Parking Area") | informationcenter.vermont.gov/centers/guilford | **CONFIRMED ACTIVE** | Official VT Information Centers page: open, truck/bus parking area present. Construction advisory: overnight ramp-paving closures (9pm–7am windows); car lot under construction — trucks currently use the truck/bus area. MM-1 Guilford North Parking Area NOT individually confirmable from official pages → dropped from canary. |
| ME | NTAD Facility 17 = Kennebunk Service Plaza (Northbound), I-95 N MM 25, 43.41038,-70.55824, 37 spots (SWAPPED IN for anonymized "Facility 9") | maineturnpike.com/Traveler-Services/Service-Plazas/Kennebunk-Service-Plaza-(Northbound).aspx | **CONFIRMED ACTIVE** | MTA: 24-hr fuel/food, "spaces for long-haul operators to park." Coordinate-identified (NTAD 17/18 = Kennebunk NB/SB; 13 = West Gardiner; 15/16 = Cumberland). Original "Facility 9" (York, 75 spots) identity unresolved → needs MaineDOT/MTA confirmation, dropped from canary. |
| DE | Smyrna Rest Area, US 13 / DE-1 Exit 119, 28 spots | deldot.gov/Programs/restareas (SmyrnaRestArea) | **CONFIRMED ACTIVE** | DelDOT: open 24 hours; visitor information center on site. |
| CT | Darien Service Plaza SB, I-95 S MM 10, 70 spots | portal.ct.gov/dot rest-areas page + 2024/2025 CTDOT advisories naming Darien plazas | **CONFIRMED ACTIVE** | CTDOT rest-area/service-plaza program page lists I-95 plazas; 2024 press release + 2025 construction advisory reference Darien plaza signage replacement (facility current). SB truck-space count not quoted on ct.gov → count stays NTAD-sourced pending click-through. |
| CA | Gold Run (Eastbound) SRRA, I-80 E, Placer Co., NTAD 24 spots | dot.ca.gov D3 news release 23-027 "Gold Run Rest Areas Have Reopened"; Caltrans SRRA dataset (data.ca.gov / caltrans-gis FeatureServer) | **CONFIRMED ACTIVE — COUNT CONFLICT** | Caltrans current data: 51 auto + **7 truck** spaces vs NTAD 2019's 24. Caltrans is newer + official → its count must win at import; NTAD count quarantined for this row. Caltrans publishes a full statewide SRRA GIS dataset — the superior CA source for the whole-state import. |
| AL | Grand Bay Welcome Center, I-10 E MM 0.485, 90 spots | dot.state.al.us/welcomeCenters.html + tourism.alabama.gov welcome-centers | **CONFIRMED LISTED** | Present on ALDOT's current welcome-centers page with phone (251-865-2418). Real-time status check: ALGOtraffic.com (human step). |

## Outcome

- 6 of 6 canary slots now point at facilities confirmed on official state
  sources; two slots were SWAPPED to confirmed facilities (VT MM-5.6 Welcome
  Center; ME Kennebunk NB) because the originals could not be individually
  confirmed — exactly the failure mode this verification exists to catch.
- One material count conflict found (CA Gold Run: 7 truck spaces current vs
  24 in NTAD 2019) — the canary import must carry the Caltrans figure, and
  the NTAD count for that row goes to quarantine notes.
- Two rows produced for the identity-hold list: VT "Guilford North Parking
  Area" (MM 1) and ME "Facility 9" (York, 75 spots) — no action without
  state confirmation.
- Discovery: Caltrans SRRA GIS dataset (official, current, statewide) —
  recommended as the authoritative CA source, superseding NTAD's CA rows.

## Human click-through checklist (before the canary write authorization)

1. VT: informationcenter.vermont.gov/centers/guilford — confirm truck
   parking open despite construction; note date.
2. ME: maineturnpike.com Kennebunk NB plaza page — confirm long-haul
   parking; note date.
3. DE: deldot.gov/Programs/restareas — Smyrna 24-hr status; note date.
4. CT: portal.ct.gov/dot rest-areas — Darien SB plaza listed; note date.
5. CA: dot.ca.gov QuickMap / SRRA dataset — Gold Run EB open + current
   truck-space count; note date.
6. AL: ALGOtraffic.com — Grand Bay Welcome Center open; note date.
