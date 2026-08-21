# Batch 26 — I-20 Georgia: Review Summary

CSV: `data/imports/i20-georgia-batch-026.csv` · researched 2026-07-14 · dry-run validated against
the live import parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`), both run with the REAL 82-row live Georgia comparison set. **Nothing has been
imported to production.**

This batch continues the I-20 corridor eastward from Batch 25 (Alabama), covering the Georgia
crossing — ~200 interstate miles from the Alabama line at Tallapoosa through the west Atlanta metro
to Augusta at the South Carolina line. Georgia's 82 existing production listings are on I-75 and
I-24; this batch was deduped against that full live set (name+city+state AND detail slugs), with the
Fulton Industrial Southern Tire Mart #165, America's Truck Stop (I-75), and all I-75 Atlanta-area
stops explicitly excluded from research. **Result: 0 collisions.**

## Totals

- Total rows in CSV: **14** (all truck-stops on this corridor)
- Segments: West/west-Atlanta (7, Tallapoosa–Fulton Industrial) · East (7, Madison–Augusta)
- Published flag: all rows imported **unpublished**.
- Featured = yes: **0**; TruckParkingClub URLs: **0**; affiliate codes: **0**.
- Coordinates: **none supplied** — all 14 rows flagged `needs-geocoding`.

## Rows by city (west → east)

Tallapoosa (1) · Waco (1) · Temple (2) · Villa Rica (1) · Lithia Springs (1) · Atlanta/Fulton Industrial (1) ·
Madison (3) · Greensboro (1) · Thomson (1) · Augusta (2)

## Curation & accuracy decisions

- **West/Atlanta**: Newborn Truck Stop (Tallapoosa, Exit 5), Love's #311 (Waco, 9), Pilot #417 +
  Flying J #634 (Temple, 19), Pilot #4559 (Villa Rica, 26), RaceTrac (Lithia Springs, 44),
  QuikTrip #777 (Fulton Industrial/Atlanta, 49).
- **East**: the Madison Exit 113/114 cluster (Love's #781, Pilot #420, TA #45), Flying J #633
  (Greensboro, 138), Love's #354 (Thomson, 172), Pilot #65 + Circle K Trux Stop (Augusta, 194).
- **QuikTrip #777 (5705 Fulton Industrial)** is a distinct facility from the excluded Southern Tire
  Mart #165 (4600 Fulton Industrial) already in the directory.
- **Excluded** Blue Beacon "Atlanta West" (on I-285, not I-20) and all I-75 Atlanta-area stops.
- **Omitted** a Douglasville-proper truck plaza (Exit 36) — directories hint at a Huddle House/CAT
  scale stop but no confident name/address could be confirmed; and Covington (Exit 92) whose
  on-highway Circle K/Shell showed conflicting closed/open status.
- Blanks kept where sources conflict: several ZIPs (Augusta stops), a couple of phones (Flying J
  #634, RaceTrac), RaceTrac/Newborn websites.

## Co-location (expected, not duplicates)

- **Temple Exit 19**: Pilot #417 + Flying J #634 — two operators at the same interchange.
- **Madison Exit 114**: Pilot #420 + TA #45 — two operators.
- **Augusta Exit 194**: Pilot #65 + Circle K Trux Stop — two operators.

## Dedup against live Georgia (82 rows, I-75 / I-24)

- Import-parser dedup vs 82 existing `importDupKey`s: **0 duplicates**.
- Detail-slug collision vs 82 existing GA detail slugs: **0**.

## Staged import parts

| Part | Segment | Rows |
| --- | --- | --- |
| part1 | West / west-Atlanta (Tallapoosa → Fulton Industrial) | 7 |
| part2 | East (Madison → Augusta) | 7 |

## Honest limitations

- **Coordinates deferred** — every row needs geocoding before map/near-me use.
- **Research-grade candidate set, not a verified import.** Nothing written to production.
