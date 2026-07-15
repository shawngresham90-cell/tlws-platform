# Batch 69 — I-95 Georgia: Review Summary

CSV: `data/imports/i95-georgia-batch-069.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`), with the **82-row live-GA avoid-list applied**.
**Nothing has been imported to production.**

Covers I-95 the length of the **Georgia coast** — from the Florida line at Kingsland
north through Woodbine, Brunswick (Golden Isles), Darien, Midway, Richmond Hill, the
Savannah port area, and Port Wentworth to the South Carolina line. South (FL line →
Midway), North (Midway → SC line).

## Totals
- Total rows in CSV: **41**
- ready-to-publish: **21** · import-unpublished (held): **20** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 15 |
| CAT Scales | 9 |
| Tire & Repair | 4 |
| Truck Parking (welcome centers / rest areas) | 4 |
| Roadside Service | 3 |
| Weigh Stations | 3 |
| Truck Washes | 2 |
| CDL Schools | 1 |
| **Total** | **41** |

## Rows by city (top)
Brunswick 9 · Port Wentworth 7 · Kingsland 5 · Richmond Hill 5 · Savannah 4 · Garden City 2 · Pooler 2 · St. Marys 2 · Townsend 2 · (others 1)

## Segments
- **A — South (21):** FL line → Midway. The Kingsland Exit 1/3 border cluster (Pilot #4562, Pilot #575, Petro #344) each with a CAT scale + the northbound Georgia Welcome Center; the Brunswick Exit 29 hub (Love's #405, Flying J #627, TA Brunswick — each with a CAT scale — plus Blue Beacon, Love's Speedco #906, Dynamic Diesel); Woodbine, Darien and Midway independents; the Townsend weigh stations and Glynn County rest area.
- **B — North (20):** Midway → SC line. The Savannah port node — TA Savannah #177 (Exit 87), Love's #338 (90), Love's #893 (94, Garden City), Parker's Pooler, Pilot #71 (Port Wentworth Exit 109) — each with a CAT scale; Southern Tire Mart Pooler + Port Wentworth, Snider Savannah, CMJ truck wash; the Port Wentworth weigh station, the southbound Georgia Welcome Center + Carson rest area; Savannah towing and Savannah Tech CDL.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (Pilot/Flying J, Love's/Speedco, TA/Petro, Southern Tire Mart, Blue Beacon, CAT Scale, GDOT/ExploreGeorgia) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- **Dedup:** the 82 live-GA production rows (all on the I-75 corridor + Atlanta metro + I-24 Wildwood) were applied as an avoid-list — 0 collisions, 0 dup hits, as expected (no I-95 coast overlap).
- No cross-segment duplicates (south ends at Midway Exit 76, north starts at Richmond Hill Exit 87). Georgia has welcome centers at both ends (Kingsland NB, Port Wentworth SB), listed separately. Ten distinct CAT scales corridor-wide, each kept once.
- Pilot #575 St. Marys website blanked (the real URL contains apostrophes that would fail URL validation); milepost welcome centers/weigh stations/rest areas left exit blank with the nearest named I-95 locality for city.
- **Omitted, not fabricated:** I-75 Georgia and Atlanta-metro facilities; Sapp Bros (I-80 chain, no GA location); the unverified planned Darien "JP Travel Center"; the Brunswick Exit 36/38 Shell (parking unconfirmed); Pooler/Port Wentworth hotels not verifiably offering truck parking.
- **No coordinates** (separate geocoding workflow). No internal duplicates; no collision against the live GA production set.
