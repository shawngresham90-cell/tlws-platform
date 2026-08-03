# Batch 51 — I-80 Illinois: Review Summary

CSV: `data/imports/i80-illinois-batch-051.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`), including **deduplication against the 12
existing Illinois production rows**. **Nothing has been imported to production.**

Covers I-80 across **Illinois**, from the Iowa line at the Quad Cities east through
the LaSalle-Peru area, Ottawa, the Morris/Minooka and Joliet freight clusters, to
the Chicago south suburbs at the Indiana line. Illinois already has **12** production
rows — all on **I-24** (Metropolis/Vienna) — so the compile hard-drops any name|city
collision. Result: **0 collisions**.

## Totals
- Total rows in CSV: **34**
- ready-to-publish: **23** · import-unpublished (held): **11** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 13 |
| CAT Scales | 10 |
| Truck Washes | 2 |
| Tire & Repair | 1 |
| Truck Parking | 4 |
| Weigh Stations | 3 |
| Roadside Service | 1 |
| **Total** | **34** |

## Segments
- **A — West (17):** Iowa line → LaSalle/Utica. Beck's Oil (Geneseo Exit 19), Love's #766 + Atkinson Plaza (Atkinson Exit 27), Road Ranger #541 (Princeton Exit 56), Sapp Bros (Peru Exit 73), Flying J #644 (LaSalle Exit 77), Love's #351 (Utica Exit 81), their CAT scales, Diamond Truck Wash (Peru), Princeton Tire Service, the Mississippi Rapids & Great Sauk Trail rest areas, and the Quad Cities weigh station.
- **B — East (17):** Ottawa → Chicago south suburbs. The Lotz truck wash + shop (Ottawa Exit 90), the Morris/Minooka cluster (Love's #859, Pilot #483, TA Morris, Pilot #236 at Exits 112–122) with CAT scales, Pilot #1024 + Joliet CAT scale (Exit 132), the Chicago Southland Lincoln Oasis (South Holland), the Three Rivers rest areas, and the Frankfort weigh stations.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (Love's, Pilot/Flying J, TA, Road Ranger, Sapp Bros, CAT Scale, Illinois Tollway, IDOT) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- **Dedup:** compiled against all 12 live IL `importDupKey` keys and 12 detail slugs — **0 collisions, 0 slug collisions**.
- Cross-segment reconciliation at Ottawa Exit 90 (Lotz truck wash returned by both) — kept once in East.
- **Omitted, not fabricated:** stops on I-55/I-355/I-294/I-57/I-74/I-88/I-280 not on I-80; no Blue Beacon on the I-80 IL segments; Quad Cities Exits 1–18 had no verifiable standalone truck stop.
- **No coordinates** (separate geocoding workflow). No internal duplicates.
