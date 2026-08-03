# Batch 25 — I-20 Alabama: Review Summary

CSV: `data/imports/i20-alabama-batch-025.csv` · researched 2026-07-14 · dry-run validated against
the live import parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`), both run with the REAL 64-row live Alabama comparison set. **Nothing has been
imported to production.**

This batch continues the I-20 corridor eastward from Batch 24 (Mississippi), covering the Alabama
crossing — ~210 interstate miles from the Mississippi line at Cuba through Tuscaloosa and the
Birmingham area to the Georgia line past Heflin. Alabama's 64 existing production listings are all
on I-65; this batch was deduped against that full live set (name+city+state AND detail slugs), with
the I-65 Birmingham stops (Pilot #602, Speedway Finley Blvd) explicitly excluded from research.
**Result: 0 collisions.**

**Concurrency note:** west of the Birmingham split, I-20 runs concurrent with I-59 (Exits 1-104);
those stops are on the signed I-20/I-59 corridor and labeled as such.

## Totals

- Total rows in CSV: **16**
- Segments: West/I-20-59 (7, Cuba–McCalla) · Central-East/I-20 (9, Moody–Heflin)
- Published flag: all rows imported **unpublished**.
- Featured = yes: **0**; TruckParkingClub URLs: **0**; affiliate codes: **0**.
- Coordinates: **none supplied** — all 16 rows flagged `needs-geocoding`.

## Rows by category

| Category | Rows |
| --- | --- |
| truck-stops | 15 |
| roadside-service | 1 |

## Rows by city (west → east)

Cuba (1) · Livingston (1) · Eutaw (1) · Cottondale/Tuscaloosa (2) · McCalla (2) · Moody (1) ·
Pell City (2) · Lincoln (2) · Oxford (1) · Heflin (3)

## Curation & accuracy decisions

- **West (I-20/59)**: Rocking Chair (Cuba, Exit 1), DNJ (Livingston, 17), Love's #773 (Eutaw, 40),
  TA #016 + Pilot/ONE9 (Cottondale/Tuscaloosa, 77), Love's #227 + Flying J #601 (McCalla, 100/104).
- **Central-East (I-20)**: Love's #530 (Moody, 147), QuikTrip + Henson's (Pell City, 156/158),
  TA #260 + Pilot #1549 (Lincoln, 168), Circle K (Oxford, 185), I-20 Texaco + Love's #818 + 205
  Truck Center (Heflin, 199/205).
- **Data correction surfaced**: Love's store **#530 is in Moody, AL (Exit 147)** — confirmed via
  loves.com/locations/530. Batch 22 (I-20 Texas, PR #61) mistakenly listed "Love's #530" in Midland,
  TX at the same exit number; that TX row is a mis-attribution and is being corrected on PR #61.
- **Excluded** all I-65 Alabama rows (Pilot #602, Speedway Finley Blvd, Clanton/Cullman/Hope Hull/
  Montgomery/Athens, etc.).
- **Omitted** a Vance/Mercedes-plant truck plaza (Exit 89 has fuel but no verifiable major stop) and
  the unconfirmed "Love's #310 Tuscaloosa."
- Blanks kept where sources conflict: DNJ address, Cottondale Pilot/ONE9 phone, QuikTrip and I-20
  Texaco phones.

## Co-location (expected, not duplicates)

- **Cottondale Exit 77**: TA #016 + Pilot/ONE9 — two operators at the same interchange.
- **Lincoln Exit 168**: TA #260 + Pilot #1549 — two operators.
- **Heflin Exit 205**: Love's #818 + 205 Truck Center — two operators.

## Dedup against live Alabama (64 rows, all I-65)

- Import-parser dedup vs 64 existing `importDupKey`s: **0 duplicates**.
- Detail-slug collision vs 64 existing AL detail slugs: **0**.

## Staged import parts

| Part | Segment | Rows |
| --- | --- | --- |
| part1 | West / I-20-59 (Cuba → McCalla) | 7 |
| part2 | Central-East / I-20 (Moody → Heflin) | 9 |

## Honest limitations

- **Coordinates deferred** — every row needs geocoding before map/near-me use.
- **Research-grade candidate set, not a verified import.** Nothing written to production.
