# Batch 27 — I-20 South Carolina: Review Summary

CSV: `data/imports/i20-south-carolina-batch-027.csv` · researched 2026-07-14 · dry-run validated
against the live import parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`). **Nothing has been imported to production.**

This batch **completes the I-20 corridor end-to-end** (from Batch 22, Kent/Pecos TX, through LA, MS,
AL, GA, and now to the eastern terminus at Florence, SC). It covers the South Carolina crossing —
~150 interstate miles from the Georgia line at North Augusta through Aiken and Columbia to Bishopville.
**South Carolina** is a new state for the directory (0 existing rows), so there is zero overlap risk
with anything already live.

**Terminus note:** I-20 ends at I-95 near Florence. The Florence truck-stop cluster (Pilot #337,
TA #195, Petro #393) is signed on **I-95** (Exits 164/169), NOT I-20, so those stops were deliberately
**excluded** from this I-20 batch and are deferred to a future I-95 South Carolina batch. Only stops
genuinely on I-20 are included here.

## Totals

- Total rows in CSV: **10**
- Segments: West-central (7, North Augusta–Columbia) · East-central (3, Elgin–Bishopville)
- Published flag: all rows imported **unpublished**.
- Featured = yes: **0**; TruckParkingClub URLs: **0**; affiliate codes: **0**.
- Coordinates: **none supplied** — all 10 rows flagged `needs-geocoding`.

## Rows by category

| Category | Rows |
| --- | --- |
| truck-stops | 9 |
| tire-repair | 1 |

## Rows by city (west → east)

North Augusta (2) · Aiken (1) · Lexington (2) · Columbia (2) · Elgin (1) · Lugoff (1) · Bishopville (1)

## Curation & accuracy decisions

- **West**: North Augusta Exit 5 (Circle K + independent S & S Truck Stop), Aiken Circle K #5377
  (Exit 22), Lexington Love's #424 + its Speedco (Exit 51), Columbia Flying J #712 (Exit 70) + TA
  Columbia North (Exit 71).
- **East**: Love's #751 (Elgin, Exit 87), Pilot #346 (Lugoff/Camden, Exit 92), Pilot #4581
  (Bishopville, Exit 116).
- **Excluded** the West Columbia Pilot (on I-26/I-77, not I-20) and the Florence cluster (on I-95).
- **Omitted** Bethune and Elliott — no confirmable truck stop directly on I-20.
- Blanks kept where sources conflict: S & S Truck Stop ZIP (29860 vs 29841), Aiken Circle K ZIP,
  TA Columbia North phone.

## Co-location (expected, not duplicates)

- **North Augusta Exit 5**: Circle K + S & S Truck Stop — two operators at the same exit.
- **Lexington Exit 51**: Love's #424 (truck-stop) + its Speedco (tire-repair).
- **Columbia Exits 70/71**: Flying J #712 + TA Columbia North — two operators.

## Staged import parts

| Part | Segment | Rows |
| --- | --- | --- |
| part1 | West-central (North Augusta → Columbia) | 7 |
| part2 | East-central (Elgin → Bishopville) | 3 |

## Honest limitations

- **Coordinates deferred** — every row needs geocoding before map/near-me use.
- **Research-grade candidate set, not a verified import.** Nothing written to production.
