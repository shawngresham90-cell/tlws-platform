# Batch 56 — I-90 Washington: Review Summary

CSV: `data/imports/i90-washington-batch-056.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). Washington has **0** existing production
rows — first coverage of the state. **Nothing has been imported to production.**

Covers I-90 across **Washington**, from Seattle east over Snoqualmie Pass and
across the Columbia Basin to Spokane and the Idaho line. West (Seattle → North Bend
→ Ellensburg) and East (Moses Lake → Ritzville → Spokane).

## Totals
- Total rows in CSV: **31**
- ready-to-publish: **18** · import-unpublished (held): **13** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 11 |
| CAT Scales | 7 |
| Truck Washes | 3 |
| Tire & Repair | 3 |
| Weigh Stations | 3 |
| Truck Parking | 4 |
| **Total** | **31** |

## Segments
- **A — West (16):** TA Seattle East (North Bend Exit 34, the first stop east of Seattle) + its CAT scale, Love's Cle Elum + Speedco, the Ellensburg cluster (Love's #413, Pilot #1195 at Exit 106; Broadway Flying J #965 at Exit 109) with CAT scales, Speedco/Love's Truck Care, Gibson & Cascade truck washes, the North Bend & Cle Elum weigh stations, and the Indian John Hill rest areas.
- **B — East (15):** Love's #827 + Ernie's (Moses Lake Exits 174/179), Love's #514 + Jake's (Ritzville Exits 220/221), the two Broadway Flying J plazas (Spokane #963 Exit 276, Spokane Valley #967 Exit 286) with CAT scales, Blue Beacon Spokane, Love's Ritzville tire care, the Tokio weigh station, and the Schrag & Sprague Lake rest areas.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (TA/Petro, Love's, Pilot/Flying J, Broadway Group, CAT Scale, Blue Beacon, WSDOT) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- Cross-segment reconciliation at Ellensburg — shared stops/scales kept once (West).
- Two blank-city rest areas assigned nearest named locality (Ritzville / Sprague).
- **Omitted, not fabricated:** the old Ellensburg Pilot at 1512 Hwy 97 (now the Love's); Ryegrass Rest Area (no truck parking per WSDOT); Spokane facilities on US-2/US-395 (not I-90); no hotel with source-verified dedicated truck parking.
- **No coordinates** (separate geocoding workflow). No internal duplicates; no collision against the (empty) WA production set.
