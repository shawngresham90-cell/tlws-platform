# Batch 24 — I-20 Mississippi: Review Summary

CSV: `data/imports/i20-mississippi-batch-024.csv` · researched 2026-07-14 · dry-run validated against
the live import parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`). **Nothing has been imported to production.**

This batch continues the I-20 corridor eastward from Batch 23 (Louisiana), covering the Mississippi
crossing — ~165 interstate miles from the Louisiana line at Vicksburg through Jackson to the Alabama
line past Toomsuba. Mississippi has 0 existing production listings, so this batch has zero overlap
risk with anything already live.

**Concurrency note:** through Jackson, I-20 runs concurrent with I-55 (Exit 45); through Meridian,
I-20 runs concurrent with I-59 (Exits 150-151). Those stops are on the signed I-20 portion and are
labeled as such by the operators/directories.

## Totals

- Total rows in CSV: **14**
- Segments: West-central (7, Vicksburg-Jackson) · East-central (7, Lake-Meridian-Toomsuba)
- Published flag: all rows imported **unpublished**.
- Featured = yes: **0**; TruckParkingClub URLs: **0**; affiliate codes: **0**.
- Coordinates: **none supplied** — all 14 rows flagged `needs-geocoding`.

## Rows by category

| Category | Rows |
| --- | --- |
| truck-stops | 11 |
| roadside-service | 3 |

## Rows by city (west → east)

Vicksburg (3) · Clinton (1) · Jackson (2) · Flowood (1) · Lake (1) · Newton (1) · Meridian (4) · Toomsuba (1)

## Curation & accuracy decisions

- **Vicksburg Exit 15**: Love's #776 (with CAT scale) + co-located Speedco; plus RD's mobile road service.
- **Jackson Exit 45** (I-20/I-55 concurrency): Petro #328 and Pilot #77, both full-service with CAT scales.
- **Flowood Exit 47B**: Love's #420 (just east of the I-55 split).
- **Meridian Exits 150-165** (I-20/I-59 concurrency then split): Queen City (150), Pilot #388 (151),
  TA #047 (160), Love's #343 Toomsuba (165), plus Knight's Tire/Towing road service.
- **Omitted** Morton Exit 77 (no confirmable brand stop — "Morton Travel Plaza" hits were on I-77 in
  another state) and a "Love's #751 Exit 87" that turned out to be Elgin, SC, not MS.
- **No confirmable I-20 truck facility** at Edwards, Bolton, Brandon, Pelahatchie, Forest, Hickory, or
  Chunky, so none were fabricated.
- Blanks kept where sources conflict: SOS Truck Stop address/phone, Queen City street number (5502 vs
  20 N Frontage Rd — used the more recent 5502 and flagged it), and the two mobile services' exits.

## Staged import parts

| Part | Segment | Rows |
| --- | --- | --- |
| part1 | West-central (Vicksburg → Flowood) | 7 |
| part2 | East-central (Lake → Toomsuba) | 7 |

## Honest limitations

- **Coordinates deferred** — every row needs geocoding before map/near-me use.
- **Research-grade candidate set, not a verified import.** Nothing written to production.
