# Batch 68 — I-95 Florida: Review Summary (first I-95 batch)

CSV: `data/imports/i95-florida-batch-068.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`), with the **73-row live-FL avoid-list applied**.
**Nothing has been imported to production.**

Covers I-95 the length of **Florida's east coast** — from Miami north through Fort
Lauderdale, West Palm Beach, Fort Pierce, Vero Beach, Cocoa, Daytona/Ormond Beach,
St. Augustine, and the Jacksonville freight node to the Georgia line at Yulee. This is
the **first batch of the I-95 corridor** (the East Coast). South (Miami → Fort Pierce),
North (Fort Pierce → Jacksonville/GA line).

## Totals
- Total rows in CSV: **54**
- ready-to-publish: **29** · import-unpublished (held): **25** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 16 |
| CAT Scales | 9 |
| Truck Parking (rest areas / welcome center) | 7 |
| Roadside Service | 7 |
| Tire & Repair | 5 |
| CDL Schools | 4 |
| Weigh Stations | 3 |
| Truck Washes | 2 |
| Hotels with Truck Parking | 1 |
| **Total** | **54** |

## Rows by city (top)
Jacksonville 15 · Fort Pierce 11 · Saint Augustine 4 · Saint Johns 4 · Vero Beach 3 · West Palm Beach 3 · Yulee 3 · (others 1–2)

## Segments
- **A — South (19):** Miami → Fort Pierce. The dense SE-Florida urban stretch (Miami/Fort Lauderdale/West Palm) has essentially no on-highway truck stops; the real cluster is Fort Pierce Exits 129 (Pilot #90, Love's #415) and 131 (Love's #467, Flying J #622) — each with a CAT scale — plus the Love's truck wash, Days Inn, the Martin County weigh station and two rest areas; corridor mobile tire/towing (Miami→Fort Pierce).
- **B — North (35):** Fort Pierce → GA line. Vero Beach TA #197, Cocoa Pilot #88, Ormond Beach Love's #316, the St. Augustine Exit 305 pair (Flying J #626 + Love's #894), the Jacksonville freight node (Pilot #91 + TA #248 at Exit 329, Love's #603/#828, Pilot #1047, Blue Beacon, tire/towing, four CDL schools), five FDOT rest areas, and the Yulee weigh + agricultural-inspection stations + Florida Welcome Center at the GA line.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (Pilot/Flying J, Love's, TA/Petro, Blue Beacon, CAT Scale, FDOT/FDACS, Wyndham) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- **Dedup:** the 73 live-FL production rows (all on the I-75 corridor — Miami-NW/Naples/Fort Myers/Ocala/Wildwood/Lake City) were applied as an avoid-list — 0 collisions, 0 dup hits, as expected (no I-95 east-coast overlap).
- Cross-segment reconciliation at Fort Pierce (Exit 129, the boundary): Pilot #90, Love's #415 and their two CAT scales consolidated once (South). Nine distinct CAT scales corridor-wide.
- I-95/I-295 Jacksonville junction stops (Love's #828 at I-295 Exit 33, Pilot #1047 at I-295 Exit 25) kept as I-95 with the I-295 exit noted. FDOT rest areas/weigh stations use nearest named I-95 locality; milepost sites left exit blank.
- **Omitted, not fabricated:** I-75/Palmetto (Medley/Hialeah Gardens) and Florida Turnpike facilities; no verifiable truck stops through the Miami/Fort Lauderdale/WPB city core; WPB/Fort Lauderdale CDL schools not verifiably on I-95.
- **No coordinates** (separate geocoding workflow). No internal duplicates; no collision against the live FL production set.
