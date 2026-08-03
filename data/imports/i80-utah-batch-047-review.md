# Batch 47 — I-80 Utah: Review Summary

CSV: `data/imports/i80-utah-batch-047.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). Utah has **0** existing production rows
— first coverage of the state. **Nothing has been imported to production.**

Covers I-80 across **Utah**: West (Wendover at the Nevada line, across the
Bonneville Salt Flats through Delle, to the Lake Point/Tooele cluster and western
Salt Lake City) and East (SLC up Parley's Canyon to Coalville and Echo Canyon at
the Wyoming line).

## Totals
- Total rows in CSV: **18**
- ready-to-publish: **8** · import-unpublished (held): **10** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 5 |
| CAT Scales | 2 |
| Truck Washes | 1 |
| Weigh Stations | 2 |
| Truck Parking | 3 |
| Roadside Service | 3 |
| Tire & Repair | 1 |
| Hotels with Truck Parking | 1 |
| **Total** | **18** |

## Segments
- **A — West (11):** Sinclair Wendover (Exit 4), Sinclair Delle (Exit 70), TA Tooele (Lake Point Exit 99) + its CAT scale + Blue Beacon wash + Mastermind mobile repair, Love's #436 (SLC Exit 118) + its CAT scale, the Wendover Port of Entry, and the Salt Flats (MM10) & Grassy Mountain (MM55, Clive) rest areas.
- **B — East (7):** the Coalville cluster (Holiday Hills truck stop + Best Western with semi parking, Exit 164; Moore's Chevron & Towing and Burt Brothers Tire at Exit 162; Mark's mobile diesel repair) plus the Echo Port of Entry and Echo Canyon Rest Area/Welcome Center near the Wyoming line.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (Sinclair, TA/Petro, Love's, CAT Scale, UDOT, Blue Beacon) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- No field invented: port/rest-area addresses and several phones/exits left blank where unverified.
- **Omitted, not fabricated:** no national travel-center chain operates between SLC and the WY line on I-80 (nearest are on I-15/I-215); Park City / Kimball Junction had only resort/retail fuel, no genuine truck services.
- Grassy Mountain rest area city recorded as **Clive** (nearest named I-80 locality) — noted in `-sources.md`.
- **No coordinates** (separate geocoding workflow). No internal duplicates; no collision against the (empty) UT production set.
