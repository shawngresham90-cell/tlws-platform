# Batch 38 — I-70 Utah: Review Summary

CSV: `data/imports/i70-utah-batch-038.csv` · verified 2026-07-14 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). **Nothing has been imported to
production.**

This batch completes the **western half of I-70** at the corridor's western
terminus. Utah's I-70 (which ends at I-15 near Cove Fort) is one of the most
remote interstate corridors in the US: the ~110-mile San Rafael Swell has no
services at all, and only three towns — **Green River**, **Salina**, and
**Richfield** — have truck facilities. Utah had **0** existing I-70 production
rows — first coverage of the state and corridor.

## Totals

- Total rows in CSV: **7**
- Expansion verdict — ready-to-publish: **4**
- Expansion verdict — import-unpublished (held, documented): **3**
- manual-review / reject: **0 / 0**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by state

| State | Rows | Ready | Held |
| --- | --- | --- | --- |
| UT | 7 | 4 | 3 |

## Rows by category

| Category | Rows | Ready | Held |
| --- | --- | --- | --- |
| Truck Stops & Travel Centers | 6 | 4 | 2 |
| Tire Repair | 1 | 0 | 1 |
| **Total** | **7** | **4** | **3** |

## Corridor coverage (CO line → Green River → Cove Fort/I-15 terminus)

- Distinct I-70 exits represented: **3** — 40, 56, 160

## Rows by city (east → west)

| City | Rows |
| --- | --- |
| Green River | 4 |
| Salina | 2 |
| Richfield | 1 |

## Segments

- **A — East (4):** the Green River cluster (Exit 160) — the only truck-services town before the San Rafael Swell: Love's #792, Pilot #892 (with CAT Scale + repair), the Sinclair truck stop, and West Winds/Patriot truck & tire repair.
- **B — West (3):** Salina (Exit 56: Love's #581 + TA Express) and Richfield (Exit 40: Flying J #773).

## Accuracy & exclusions

- Every row web-verified 2026-07-14 against official brand locators (Love's, Pilot/Flying J, TA, Sinclair) with directory/review sites as secondary confirmation. Per-row sources in `-sources.md`.
- No field invented: unverifiable exit/phone values are blank (Sinclair & West Winds exit numbers, West Winds/Sinclair phones).
- **Terrain-honest coverage:** Cisco and Thompson Springs are confirmed ghost towns with only derelict stations; the San Rafael Swell has no services. None were fabricated. The Cove Fort terminus fuel/parking (a Chevron) sits on **I-15 Exit 135, not I-70**, and no active Utah port of entry could be confirmed on eastern I-70 (the Thompson Springs port was only a 2011 proposal; the nearest I-70 port is Loma on the Colorado side) — so neither was invented.
- **No cross-segment duplicates:** east (Green River, Exit 160) and west (Salina/Richfield, Exits 40–56) are disjoint; 0 rows deduped.
