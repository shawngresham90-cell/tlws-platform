# Batch 52 — I-80 Indiana: Review Summary

CSV: `data/imports/i80-indiana-batch-052.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`), including **deduplication against the 99
existing Indiana production rows**. **Nothing has been imported to production.**

Covers I-80 across **Indiana**, which never runs on its own alignment: it is
concurrent with **I-94 (the Borman Expressway)** from the Illinois line at Hammond
through Gary to the Lake Station split, then with **I-90 (the Indiana Toll Road)**
across northern Indiana through South Bend and Elkhart to the Ohio line. Indiana
already has **99** production rows — all on **I-65** — so the compile hard-drops any
name|city collision. Result: **0 collisions**.

## Totals
- Total rows in CSV: **32**
- ready-to-publish: **22** · import-unpublished (held): **10** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 19 |
| CAT Scales | 8 |
| Truck Washes | 2 |
| Tire & Repair | 1 |
| Roadside Service | 2 |
| **Total** | **32** |

## Segments
- **A — Borman I-80/94 (19):** the Gary clusters at Exit 6 (TA Gary #010 + Pilot #271) and Exit 9 (Love's #417 + Petro #369), and the dense Lake Station Exit 15B cluster (Flying J #650, TA Lake Station, Mr. Fuel, Road Ranger), their seven CAT scales, the Blue Beacon Lake Station wash, Speedco Gary, and the TA/Petro truck-service shops.
- **B — Toll Road I-80/90 (13):** the four Indiana Toll Road service-plaza pairs (Portage MM22, Rolling Prairie MM56, Elkhart MM90, Howe MM126), Pilot #35 + its CAT scale and a Speedway at South Bend Exit 72, and Yoder Truck Stop + Marv's truck wash near Elkhart Exit 92.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (Love's, Pilot/Flying J, TA/Petro, Road Ranger, Indiana Toll Road/turnpikeinfo, CAT Scale, Blue Beacon) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- **Dedup:** compiled against all 99 live IN `importDupKey` keys and 99 detail slugs — **0 collisions, 0 slug collisions**.
- Cross-segment reconciliation at the Lake Station split (Blue Beacon returned by both) — kept once in Borman.
- **Omitted, not fabricated:** Love's Elkhart and Gallop's Goshen (both on the US-20 bypass, not the toll road); no verifiable state weigh station on the electronically-tolled toll-road concurrency.
- **No coordinates** (separate geocoding workflow). No internal duplicates.
