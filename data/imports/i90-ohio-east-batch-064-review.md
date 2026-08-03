# Batch 64 — I-90 Ohio (east / Lake Erie lakefront): Review Summary

CSV: `data/imports/i90-ohio-east-batch-064.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`), with the **95-row live-OH avoid-list applied**.
**Nothing has been imported to production.**

Covers the **I-90-only Lake Erie lakefront stretch** of Ohio — where I-90 leaves the
I-80/90 Ohio Turnpike near Elyria/North Ridgeville and runs north into Cleveland, then
east along Lake Erie through Mentor, Geneva, Ashtabula/Austinburg, Kingsville and
Conneaut to the Pennsylvania line. This is distinct from the I-80/90 Turnpike (covered
in Batch 53). West (Avon Exit 151), East (Geneva → Conneaut/PA line).

## Totals
- Total rows in CSV: **21**
- ready-to-publish: **17** · import-unpublished (held): **4** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 8 |
| CAT Scales | 5 |
| Tire & Repair | 2 |
| Roadside Service | 2 |
| Truck Washes | 1 |
| Truck Parking (rest area) | 1 |
| Weigh Stations | 1 |
| Hotels with Truck Parking | 1 |
| **Total** | **21** |

## Rows by city
Austinburg 6 · Conneaut 5 · Avon 4 · Kingsville 3 · Geneva 2 · Ashtabula 1

## Segments
- **A — West (4):** Avon Exit 151 — the only genuine truck-services node between the Elyria split and Cleveland (the urban Shoreway/Innerbelt core has no on-highway truck stops). Pilot #4 + its CAT scale, Speedway, and Sylvester Truck & Tire.
- **B — East (17):** Geneva → Conneaut/PA line. The Geneva Exit 218 pair (Kwik Fill truck stop, Dale's truck wash); the Austinburg Exit 223 hub (Pilot #2 + CAT, Flying J #694 + CAT, Speedco #903, Red Roof Inn); TA Kingsville #029 + CAT + TA Truck Service (Exit 235); the Conneaut Exit 241 hub (Love's #389 + CAT + co-located Speedco, Truck World); the Conneaut WB welcome center + weigh station near the PA line; and Roc's TNT roadside (Ashtabula).

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (Pilot/Flying J, Love's/Speedco, TA/Petro, Truck World, CAT Scale, ODOT, Red Roof) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- **Dedup:** the 95 live-OH production rows (all on the I-75 corridor — Toledo/Findlay/Lima/Dayton/Cincinnati/Beaverdam) were applied as an avoid-list — 0 collisions, 0 dup hits, as expected (no lakefront overlap). Distinct from the I-80/90 Turnpike draft (Batch 53).
- Six distinct CAT scales corridor-wide (Avon Pilot #4; Austinburg Pilot #2 + Flying J #694; Kingsville TA; Conneaut Love's #389), each kept once. Austinburg Exit 223 genuinely has both a Pilot and a separate Flying J with distinct addresses. Rest area/weigh station near the PA line (MM 242) left exit blank with MM noted.
- **Omitted, not fabricated:** I-80/90 Turnpike facilities south of the Elyria split; Mentor/Painesville truck stops (none verifiable directly on I-90); urban-core Cleveland stops; Cleveland-metro tire/tow operators based well south of the segment.
- **No coordinates** (separate geocoding workflow). No internal duplicates; no collision against the live OH production set.
