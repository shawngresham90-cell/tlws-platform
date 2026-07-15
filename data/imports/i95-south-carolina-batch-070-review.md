# Batch 70 — I-95 South Carolina: Review Summary

CSV: `data/imports/i95-south-carolina-batch-070.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). South Carolina has **0** existing production
rows — first coverage of the state. **Nothing has been imported to production.**

Covers I-95 the length of **South Carolina** — from the Georgia line at Hardeeville
north through Ridgeland, Yemassee, Walterboro, St. George, Santee, Manning, the Florence
freight hub, Latta, and Dillon (South of the Border) to the North Carolina line at Hamer.
South (GA line → Santee), North (Santee → NC line).

## Totals
- Total rows in CSV: **47**
- ready-to-publish: **23** · import-unpublished (held): **24** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 16 |
| CAT Scales | 10 |
| Truck Parking (rest areas / welcome centers) | 5 |
| Roadside Service | 5 |
| Hotels with Truck Parking | 4 |
| Tire & Repair | 3 |
| Truck Washes | 2 |
| Weigh Stations | 1 |
| CDL Schools | 1 |
| **Total** | **47** |

## Rows by city (top)
Florence 12 · Hardeeville 5 · Walterboro 5 · Santee 4 · Latta 3 · Saint George 3 · Yemassee 3 · (others 1–2)

## Segments
- **A — South (20):** GA line → Santee. Pilot #4569 (Hardeeville Exit 5) + Southern Tire Mart, Love's #740 (Yemassee Exit 38), Flying J #493 (St. George Exit 77) — each with a CAT scale; Circle K Walterboro, the independent I-95 Truck Stop (Santee Exit 93); the SC Welcome Center + weigh station near the GA line; Circle C wash/repair, Tommie's and Wayne's towing; four hotels advertising truck parking.
- **B — North (27):** Santee → NC line. The Florence I-95/US-52 freight hub (Pilot #337 + Petro/TA #195 at Exit 164, Love's #420 at 169, Pilot #62 at 170) each with a CAT scale; Love's Summerton #790, TA Manning #179, the Latta Exit 181 pair (Flying J #713 + Pilot #4584), Love's Dillon #371, Pedro's/Porky's at South of the Border (Exit 193); Blue Beacon Florence, Snider tire, Florence towing, FDTC CDL and four SCDOT rest areas/welcome centers.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (Pilot/Flying J, Love's/Speedco, TA/Petro, Blue Beacon, CAT Scale, SCDOT, Southern of the Border) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- Cross-segment reconciliation at Santee (MM 99): the south's combined rest-area/welcome-center row was dropped in favor of the north's two granular rows (NB rest area + SB welcome center). St. George Exit 77 confirmed as Flying J #493 (not a stale directory "Love's #412"); Point South Exit 33 has no branded truck stop (hotels/campground only) — none fabricated.
- Twelve distinct CAT scales corridor-wide, each kept once. SCDOT rest areas/welcome centers and the Hardeeville weigh station are milepost facilities (exit blank, nearest named locality for city).
- **Omitted, not fabricated:** no verifiable Santee Exit 98 branded truck stop; no fixed staffed I-95 weigh station in the north segment (SC uses virtual/WIM enforcement); conflicting Southern Tire Mart/McCarthy Florence addresses (kept only Snider with a solid address).
- **No coordinates** (separate geocoding workflow). No internal duplicates; no collision against the (empty) SC production set.
