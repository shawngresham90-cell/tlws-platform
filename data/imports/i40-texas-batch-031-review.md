# Batch 31 — I-40 Texas Panhandle: Review Summary

CSV: `data/imports/i40-texas-batch-031.csv` · verified 2026-07-14 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). **Nothing has been imported to
production.**

This batch continues I-40 west out of Oklahoma across the **Texas Panhandle** —
the Oklahoma line at Shamrock (I-40/US-83), through McLean, Groom and Conway, the
**Amarillo** freight hub (the Lakeside Drive / Whitaker Road travel-center
cluster), and west through Vega (I-40/US-385) and Adrian to the New Mexico line
at Glenrio. It connects the I-40 Oklahoma batch (draft PR #69) to a future I-40
New Mexico batch. Texas had **0** existing I-40 production rows — this is first
Panhandle coverage and does not overlap the separate southern I-10 Texas corridor
(different cities; no name/city/state collisions).

## Totals

- Total rows in CSV: **20**
- Expansion verdict — ready-to-publish: **13**
- Expansion verdict — import-unpublished (held, documented): **7**
- manual-review / reject: **0 / 0**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by state

| State | Rows | Ready | Held |
| --- | --- | --- | --- |
| TX | 20 | 13 | 7 |

## Rows by category

| Category | Rows | Ready | Held |
| --- | --- | --- | --- |
| Truck Stops & Travel Centers | 11 | 7 | 4 |
| CAT Scales | 3 | 2 | 1 |
| Truck Washes | 2 | 1 | 1 |
| Roadside Service | 2 | 1 | 1 |
| Tire Repair | 1 | 1 | 0 |
| Weigh Stations | 1 | 1 | 0 |
| **Total** | **20** | **13** | **7** |

Held rows are import-unpublished because a source did not confirm a street
address or exit number and blank was kept over a guess (e.g. Midway Truck &
Travel with no verified street number, and the two truck washes / Southern Tire
Mart whose exact I-40 exit was not confirmed). They import cleanly and can be
published once a field is verified.

## Corridor coverage (OK line → Amarillo → NM line)

- Distinct I-40 exits represented: **11** — 22, 36, 60, 74, 75, 76, 96, 112, 142, 163, 164

## Rows by city (east → west)

| City | Rows |
| --- | --- |
| Shamrock | 2 |
| McLean | 1 |
| Groom | 1 |
| Conway | 1 |
| Amarillo | 11 |
| Vega | 3 |
| Adrian | 1 |

## Segments

- **A — East (7):** OK line at Shamrock (Exit 163/164) → eastern Amarillo approach (Exit 76): Shamrock weigh station, Midway Truck & Travel (I-40/US-83), Country Corner McLean, Larry's Diesel Service Groom, Love's #229 Conway, Flying J #723 + its CAT Scale.
- **B — Amarillo metro (9):** the Lakeside/Whitaker travel-center cluster (Exits 74–76) plus west Amarillo (Exit 60): Petro Amarillo, TA Amarillo, Love's #250 (Exit 60, w/ CAT Scale), Love's #200 (Exit 74), Toot'n Totum #99, Blue Beacon & Eagle truck washes, Southern Tire Mart #491, and the CAT Scale at Love's Exit 60. (Flying J #723 appears here too but is de-duplicated against segment A.)
- **C — West (4):** Vega (Exit 36) → Adrian (Exit 22): Pilot #1027 + its CAT Scale, the independent Vega Truck Stop & Indian Kitchen (formerly Kevin's Texas Quick Stop), and Rose Punjab truck repair / road service at Adrian.

## Accuracy & exclusions

- Every row web-verified 2026-07-14 against official brand locators (Love's, Pilot/Flying J, TA/Petro, CAT Scale, Toot'n Totum, Blue Beacon, Southern Tire Mart) with directory/review sites as secondary confirmation. Per-row sources in `-sources.md`.
- No field invented: unverifiable address/ZIP/phone/exit values are blank (e.g. Midway's street number, Love's #200 ZIP where sources split 79118/79120).
- **Cross-segment de-duplication:** Flying J #723 (Exit 76) was returned by both the East and Amarillo researchers — kept once. Love's #250 (Exit 60) was returned by both the Amarillo and West researchers under slightly different names; merged to the canonical "Love's Travel Stop #250," and the West duplicate dropped. Its CAT Scale (a separate cat-scales row) is retained on the strength of a CAT Scale Co. announcement that the West researcher simply could not independently confirm.
- No confident Texas port-of-entry / weigh station exists on I-40 at the Glenrio/NM line (the nearest POE is on the New Mexico side, out of scope), so none was fabricated. Towns with no verified I-40 facility (Alanreed, Bushland, Wildorado) were omitted.
