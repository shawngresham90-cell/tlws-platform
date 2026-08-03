# Batch 29 — I-30 Arkansas: Review Summary

CSV: `data/imports/i30-arkansas-batch-029.csv` · researched 2026-07-14 · dry-run validated against
the live import parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`), both run with the REAL 127-row live Arkansas comparison set. **Nothing has been
imported to production.**

This batch **completes the I-30 corridor** (from Batch 28, Fort Worth TX, to the eastern terminus at
Little Rock, where I-30 ends at I-40). It covers the Arkansas crossing — ~140 interstate miles from
the Texas line at Texarkana through Arkadelphia and Benton to Little Rock. Arkansas's 127 existing
production listings are all on I-40; this batch was deduped against that full live set, with the I-40
North Little Rock cluster (Petro #326, Pilot #332, Love's #236) and all West Memphis / Russellville /
Clarksville I-40 stops explicitly excluded from research. **Result: 0 collisions.**

## Totals

- Total rows in CSV: **16**
- Segments: Southwest (8, Texarkana–Arkadelphia) · Central (8, Malvern–Little Rock)
- Published flag: all rows imported **unpublished**.
- Featured = yes: **0**; TruckParkingClub URLs: **0**; affiliate codes: **0**.
- Coordinates: **none supplied** — all 16 rows flagged `needs-geocoding`.

## Rows by category

| Category | Rows |
| --- | --- |
| truck-stops | 10 |
| cat-scales | 3 |
| tire-repair | 2 |
| roadside-service | 1 |

## Rows by city (west → east)

Texarkana (2) · Prescott (2) · Gurdon (2) · Arkadelphia (2) · Malvern (1) · Benton (3) · Bryant (1) ·
Alexander (1) · Little Rock (2)

## Curation & accuracy decisions

- **Southwest**: Camp I-30 (Texarkana AR side, Exit 2), Flying J #606 (Texarkana AR side, Exit 7 —
  the Arkansas-side store, distinct from the excluded TX-side location), Love's #277 + its Truck Care
  (Prescott, Exit 46), Southfork + its tire/road service (Gurdon, Exit 63), Pilot #492 + CAT scale
  (Arkadelphia/Caddo Valley, Exit 78).
- **Central**: Love's #779 (Malvern, Exit 97), Pilot #118 + CAT scale (Benton, Exit 121), Speedzone
  (Bryant, Exit 123), County Line Superstop (Alexander, Exit 126), Love's #457 + CAT scale (Little
  Rock, Exit 128), Firestone (Benton frontage road).
- **Excluded** the Texarkana TX-side Flying J (state ≠ AR) and all I-40 North Little Rock / West
  Memphis / Russellville / Clarksville stops.
- **Omitted Hope** — the primary Exit 31 Shell/Superstop is reported closed on Yelp and a replacement
  Speedway (Exit 30) was still under construction; not listed rather than risk a closed location.
- Blanks kept where sources conflict: Speedzone phone/website, County Line website, Firestone exit/ZIP,
  Love's Truck Care direct line; Little Rock Love's ZIP (72209 vs 72210 — used 72210).

## Co-location (expected, not duplicates)

- **Prescott Exit 46**: Love's #277 (truck-stop) + its Love's Truck Care (roadside-service).
- **Gurdon Exit 63**: Southfork (truck-stop) + its tire/road service (tire-repair).
- **Arkadelphia Exit 78 / Benton 121 / Little Rock 128**: each brand truck-stop + its CAT scale.

## Dedup against live Arkansas (127 rows, all I-40)

- Import-parser dedup vs 127 existing `importDupKey`s: **0 duplicates**.
- Detail-slug collision vs 127 existing AR detail slugs: **0**.

## Staged import parts

| Part | Segment | Rows |
| --- | --- | --- |
| part1 | Southwest (Texarkana → Arkadelphia) | 8 |
| part2 | Central (Malvern → Little Rock) | 8 |

## Honest limitations

- **Coordinates deferred** — every row needs geocoding before map/near-me use.
- **Research-grade candidate set, not a verified import.** Nothing written to production.
