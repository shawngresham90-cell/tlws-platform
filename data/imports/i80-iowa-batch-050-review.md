# Batch 50 — I-80 Iowa: Review Summary

CSV: `data/imports/i80-iowa-batch-050.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). Iowa has **0** existing production rows
— first coverage of the state. **Nothing has been imported to production.**

Covers I-80 across **Iowa**, from Council Bluffs at the Nebraska line east through
the Des Moines metro, Newton, Iowa City, and Walcott (home of the Iowa 80
Truckstop) to Davenport at the Illinois line.

## Totals
- Total rows in CSV: **36**
- ready-to-publish: **21** · import-unpublished (held): **15** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 16 |
| CAT Scales | 6 |
| Truck Washes | 4 |
| Tire & Repair | 1 |
| Roadside Service | 2 |
| Weigh Stations | 2 |
| Truck Parking | 4 |
| Hotels with Truck Parking | 1 |
| **Total** | **36** |

## Segments
- **A — West (23):** Council Bluffs (I-80/I-29 concurrency: TA, Pilot #329, Sapp Bros + Speedco + Blue Beacon + Sapp Bros service center), Love's #426 (Shelby Exit 34), Casey's (Stuart Exit 93), the Des Moines metro (Love's #411 Clive, Pilot #373, Flying J #913 Altoona + Blue Beacon), Kum & Go (Colfax), Love's #361 (Newton Exit 168), their CAT scales, the Van Meter/Jasper weigh stations, and the Adair rest areas.
- **B — East (13):** the Walcott Iowa 80 complex (Exit 284: World's Largest Truckstop + its CAT scale, Truckomat + Blue Beacon washes, TA truck-service center, Days Inn), two Walcott Pilots (disambiguated by address), Love's #476 + Flying J #636 (Davenport Exit 292), Kum & Go (Coralville), and the Wilton rest areas.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (Iowa 80, Love's, Pilot/Flying J, TA, Sapp Bros, Casey's, CAT Scale, Blue Beacon, Iowa DOT/511) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- No field invented: several phones/ZIPs and the TA Grand Island-style unlisted fields left blank where unverified.
- Cross-segment reconciliation at Newton (Exit 168) — Love's #361 and its CAT scale kept once (West). Two same-named Walcott Pilots disambiguated by street address so both survive as distinct listings.
- **Omitted, not fabricated:** Wings America (Avoca, flagged closed Jan 2026); Grinnell Kum & Go (closed/unverifiable); no permanent fixed weigh house beyond Van Meter (EB) and Jasper (WB); no hotel with verified dedicated truck parking beyond the Walcott Days Inn.
- **No coordinates** (separate geocoding workflow). No internal duplicates; no collision against the (empty) IA production set.
