# Batch 67 — I-90 Massachusetts (Mass Pike): Review Summary — COMPLETES I-90

CSV: `data/imports/i90-massachusetts-batch-067.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). Massachusetts has **0** existing production rows
— first coverage of the state. **Nothing has been imported to production.**

Covers I-90 across **Massachusetts** — the Massachusetts Turnpike, the eastern terminus
of I-90 — from the New York line at West Stockbridge east through Lee, Blandford,
Westfield, Springfield, Chicopee, Ludlow, Sturbridge (I-84), Charlton, Worcester,
Framingham and Natick to metro Boston. **This batch completes the entire I-90
corridor (WA → MA).** West (NY line → Sturbridge), East (Sturbridge → Boston).

## Totals
- Total rows in CSV: **26**
- ready-to-publish: **12** · import-unpublished (held): **14** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Parking (Mass Pike service plazas) | 9 |
| Truck Stops & Travel Centers | 4 |
| Roadside Service | 3 |
| Hotels with Truck Parking | 3 |
| CAT Scales | 2 |
| Tire & Repair | 2 |
| CDL Schools | 2 |
| Truck Washes | 1 |
| **Total** | **26** |

## Segments
- **A — West (16):** NY line → Sturbridge. The Lee, Blandford (EB/WB) and Ludlow (EB/WB) service plazas; the Chicopee/I-291 interchange node (Pilot #1327 + CAT, Pride Travel Center + truck wash, United CDL school); West Springfield tire/towing (Commercial Truck Tire Center, Red's Towing); Westfield roadside + Hampton Inn; the Publick House (Sturbridge); and Tri-State CDL (Springfield).
- **B — East (10):** Sturbridge → Boston. Pilot #222 Sturbridge (I-90/I-84) + CAT, New England Truck Stop, Super 8 Sturbridge; the Charlton (EB/WB), Framingham (WB) and Natick (EB) service plazas; the Worcester Commercial Truck Tire Center and Matthews heavy-duty towing (Sterling). Metro Boston (Newton→Logan) has no on-highway truck stops.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (Pilot, Pride, CAT Scale, MassDOT/Applegreen service plazas, Hilton, TravelCenters) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- Cross-segment reconciliation at Sturbridge (the boundary): Pilot #222, New England Truck Stop and the Pilot CAT scale each kept once (East). The two "Commercial Truck Tire Center" entries are distinct locations (West Springfield vs Worcester) — both kept, disambiguated by city.
- Four distinct on-segment CAT scales at Pilot hosts (Chicopee #1327, Sturbridge #222 — only two Pilot hosts carry CAT scales here). Service plazas use milepost identifiers.
- **Omitted, not fabricated:** no verifiable fixed MassDOT/State Police weigh station on I-90 (mobile/WIM enforcement only); the recurring unverified "Petro #371 Westfield" directory listing (no address/phone, not in TA/Petro's network); the M&L truck wash (on I-95/I-93 in Woburn, off I-90); no truck stops in the metro-Boston urban/tunnel stretch.
- **No coordinates** (separate geocoding workflow). No internal duplicates; no collision against the (empty) MA production set.

## I-90 corridor complete
With Massachusetts, I-90 is fully drafted coast-to-coast: **WA, ID, MT, WY, SD, MN, WI, IL, OH (lakefront), PA, NY, MA** (Batches 56–67). Indiana and the OH-west Ohio Turnpike were intentionally skipped — they are the I-80/90 concurrency already covered in I-80 Batches 52–53.
