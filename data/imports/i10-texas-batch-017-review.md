# Batch 17 — I-10 Texas: Review Summary

CSV: `data/imports/i10-texas-batch-017.csv` · researched 2026-07-14 · dry-run validated
against the live import parser (`prepareImport`) **and** the Expansion Readiness
assessment (`assessExpansion`). **Nothing has been imported to production.**

This batch opens **two firsts** for the directory: the first listings in **Texas**
(the directory's largest new state) and the first coverage of **Interstate 10**. Prior
production data spans I-75 / I-65 / I-40 / I-24 across the Southeast and Midwest; Texas
and the I-10 corridor were entirely uncovered (0 existing rows), so this batch has zero
overlap risk with anything already live.

The corridor is enormous — roughly 880 interstate miles from El Paso to the Louisiana
line — so the research was fanned out across five geographic segments and every facility
was confirmed against an official brand locator and/or 2+ directory sources before
inclusion. Where a specific field (street address, ZIP, phone, exit number) could not be
independently confirmed, it was left blank rather than guessed.

## Totals

- Total rows in CSV: **32**
- Segments: far-west (1) · West TX (6) · Hill Country (6) · Central TX (8) · Houston/SE (11)
- Published flag: all rows imported **unpublished** (the CSV sets no `published` column) —
  owner reviews, geocodes, and publishes each row deliberately.
- Featured = yes: **0** (featuring requires explicit approval).
- TruckParkingClub URLs: **0**; affiliate codes: **0**.
- Coordinates: **none supplied** — geocoding is a separate verified workflow (all 32 rows
  are flagged `needs-geocoding`).

## Rows by category

| Category | Rows |
| --- | --- |
| truck-stops | 26 |
| cat-scales | 4 |
| tire-repair | 1 |
| roadside-service | 1 |

## Rows by city (west → east)

El Paso (1) · Van Horn (2) · Kent (1) · Fort Stockton (2) · Ozona (1) · Sonora (3) ·
Junction (1) · Comfort (2) · Seguin (1) · Luling (1) · San Antonio (2) · Flatonia (1) ·
Columbus (1) · Sealy (2) · Katy (1) · Brookshire (1) · Baytown (4) · Winnie (1) ·
Beaumont (4)

## Curation & de-duplication decisions

- **Dropped — "Love's Travel Stop - Van Horn"** (far-west research pass): the verified West
  Texas pass found a Pilot and an independent Chevron in Van Horn but **no** Love's; the
  low-confidence far-west hit could not be corroborated, so it (and its implied CAT scale)
  were removed rather than risk a phantom location.
- **De-duplicated — "Circle Bar Truck Corral" (Ozona, Exit 372)**: surfaced by both the West
  TX and Hill Country passes; kept a single verified row.
- **Dropped — "Pilot Travel Center - Van Horn" duplicate**: the far-west pass and the West TX
  pass both returned it; kept the West TX row (verified street address + exit).
- **Omitted Buc-ee's** (Luling, Sealy): confirmed to prohibit 18-wheeler fueling — not a
  truck stop, so excluded.
- **Omitted Kerrville / Boerne / Gonzales / Schulenburg**: no branded or independent truck
  stop with fuel + parking could be confirmed directly on I-10 at those exits.

## Staged import parts (for the owner's later, deliberate import)

| Part | Segment(s) | Rows |
| --- | --- | --- |
| part1 | far-west + West TX + Hill Country (El Paso → Comfort) | 13 |
| part2 | Central TX (San Antonio → Sealy) | 8 |
| part3 | Houston / Southeast (Katy → Beaumont) | 11 |

## Honest limitations

- **Coordinates deferred.** Every row needs geocoding before it can render on the map or
  power near-me. This is intentional and matches every prior batch.
- **Some addresses/phones blank.** Independent truck stops (Flatonia, Columbus, Sealy) and a
  few chain rows lack a source-confirmed street address, ZIP, or phone; these are blank by
  policy and will need owner/geocoding follow-up.
- **Exit numbers are single-source in a few cases** (noted per row in `-sources.md`); the
  owner should spot-check before publishing.
- **This is a research-grade candidate set, not a verified import.** It exists for owner
  review. Nothing here has been written to production.
