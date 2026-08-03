# Batch 28 — I-30 Texas: Review Summary

CSV: `data/imports/i30-texas-batch-028.csv` · researched 2026-07-14 · dry-run validated against the
live import parser (`prepareImport`) **and** the Expansion Readiness assessment (`assessExpansion`).
**Nothing has been imported to production.**

This batch opens the **I-30 connector corridor**, which links I-20 (Fort Worth) to I-40 (Little Rock)
via Texarkana. It covers the Texas crossing — ~220 interstate miles from the DFW metro east through
Sulphur Springs and Mount Pleasant to Texarkana at the Arkansas line. Texas has 0 existing production
listings and no prior I-30 coverage, so this batch has zero overlap risk with anything already live.

## Totals

- Total rows in CSV: **13**
- Segments: DFW-to-Greenville (6, Rockwall–Greenville) · Northeast Texas (7, Sulphur Springs–Texarkana)
- Published flag: all rows imported **unpublished**.
- Featured = yes: **0**; TruckParkingClub URLs: **0**; affiliate codes: **0**.
- Coordinates: **none supplied** — all 13 rows flagged `needs-geocoding`.

## Rows by category

| Category | Rows |
| --- | --- |
| truck-stops | 11 |
| cat-scales | 1 |
| tire-repair | 1 |

## Rows by city (west → east)

Rockwall (2) · Royse City (2) · Caddo Mills (1) · Greenville (1) · Sulphur Springs (2) ·
Mount Vernon (2) · Mount Pleasant (1) · New Boston (1) · Texarkana (1)

## Curation & accuracy decisions

- **DFW-to-Greenville**: Love's #283 + its CAT scale (Rockwall, Exit 70), Quick Track #9 + Royse City
  Tires (Royse City, Exits 77A/B), Pilot #367 (Caddo Mills, Exit 87), ONE9/Exxon dealer (Greenville).
- **Northeast TX**: the Sulphur Springs pair (Love's #738 + Pilot #157, Exit 122), the Mount Vernon
  pair (TA Express #286 + Love's #279, Exit 147), Youngs (Mount Pleasant, 165), Road Ranger
  (New Boston, 201), Love's #473 (Texarkana/Leary, 213).
- **Dense DFW core** (Fort Worth, Arlington, Grand Prairie, Dallas, Mesquite, Balch Springs) yielded
  **no** dedicated truck stops verifiably on I-30 — most candidates there (e.g., Fuel City Mesquite)
  sit on US-80 / I-635 / I-20 and were excluded per the interstate-accuracy rule.
- **Excluded** the Texarkana Flying J at Exit 7 (Arkansas side, state ≠ TX) and the Hooks (Exit 208)
  independent that couldn't be confidently verified.
- Blanks kept where sources conflict: Love's #279 address, Youngs ZIP/phone, Road Ranger local phone,
  ONE9 exit number (96 vs 97).

## Co-location (expected, not duplicates)

- **Rockwall Exit 70**: Love's #283 (truck-stop) + its CAT scale (cat-scales).
- **Royse City Exit 77**: Quick Track #9 (truck-stop) + Royse City Tires (tire-repair).
- **Sulphur Springs Exit 122**: Love's #738 + Pilot #157 — two operators.
- **Mount Vernon Exit 147**: TA Express #286 + Love's #279 — two operators.

## Staged import parts

| Part | Segment | Rows |
| --- | --- | --- |
| part1 | DFW-to-Greenville (Rockwall → Greenville) | 6 |
| part2 | Northeast Texas (Sulphur Springs → Texarkana) | 7 |

## Honest limitations

- **Coordinates deferred** — every row needs geocoding before map/near-me use.
- **Research-grade candidate set, not a verified import.** Nothing written to production.
