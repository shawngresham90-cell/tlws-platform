# Batch 21 — I-10 Florida Panhandle: Review Summary

CSV: `data/imports/i10-florida-batch-021.csv` · researched 2026-07-14 · dry-run validated against
the live import parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`), both run with the REAL 73-row live Florida comparison set. **Nothing has been
imported to production.**

This batch **completes the I-10 corridor coast to coast** — from Batch 17 (Texas, El Paso) through
Louisiana, Mississippi, Alabama, and now Florida to the eastern terminus at Jacksonville. It covers
the ~360-mile Florida crossing from the Alabama line at Pensacola to the I-10/I-95 terminus.

Florida already has 73 production listings, **all on I-75.** This batch was deduped against that
full live set (name+city+state keys AND detail slugs). The existing Lake City rows sit at the I-75
Exit 414 cluster and were explicitly excluded; the single Lake City row here (S & S Food Store) is
at the separate I-10 Exit 303. **Result: 0 collisions.**

## Totals

- Total rows in CSV: **24**
- Segments: West panhandle (8, Pensacola–DeFuniak) · Central/Big Bend (7, Bonifay–Tallahassee) · East (9, Madison–Baldwin)
- Published flag: all rows imported **unpublished**.
- Featured = yes: **0**; TruckParkingClub URLs: **0**; affiliate codes: **0**.
- Coordinates: **none supplied** — all 24 rows flagged `needs-geocoding`.

## Rows by category

| Category | Rows |
| --- | --- |
| truck-stops | 18 |
| parking | 2 |
| cat-scales | 1 |
| tire-repair | 1 |
| roadside-service | 1 |
| hotels-truck-parking | 1 |

## Rows by city (west → east)

Pensacola (2) · Milton (1) · Crestview (1) · Mossy Head (1) · DeFuniak Springs (3) · Bonifay (1) ·
Cottondale (2) · Marianna (2) · Midway (2) · Madison (2) · Lee (1) · Live Oak (2) · Lake City (1) ·
Macclenny (1) · Baldwin (2)

## Curation & accuracy decisions

- **Confirmed anchors**: Pensacola Fleet Travel Center #319/#320 (Exits 5/10B, CAT scales), Milton
  Love's #802 (Exit 26), Cottondale Love's #453 (Exit 130), Marianna TA #178 (Exit 142), Midway
  Flying J #623 + Pilot #425 (Exit 192, near Tallahassee), Lee Love's #379 (Exit 262), Live Oak
  Busy Bee #25 (Exit 283), Baldwin Pilot #087 + TA (Exit 343).
- **Love's #379 (Lee, FL, Exit 262)** — the same store the Mississippi batch (Batch 19) correctly
  excluded as out-of-state; now placed in its real Florida home.
- **S & S Food Store (Lake City, I-10 Exit 303)** is distinct from the existing I-75 Exit 414 Lake
  City cluster (Love's #724, TA #288, Speedco), which were excluded.
- **Omitted "Sapp Bros Tallahassee"** — appears in blog listicles but not on Sapp Bros' official
  (Midwest-only) location list; unconfirmed, so excluded.
- **Omitted Blue Beacon Jacksonville** — it is on I-295 (Pritchard Rd), not I-10.
- No Buc-ee's included (none with confirmed dedicated truck diesel on this corridor).
- Blanks kept where sources conflict: several ZIPs (Pensacola Exit 5, Mossy Head, Madison stops,
  Macclenny, Lake City) and a few phones.

## Co-location (expected, not duplicates)

- **Cottondale Exit 130**: Love's #453 (truck-stop) + its Love's Truck Care (tire-repair).
- **Marianna Exit 142**: TA #178 (truck-stop) + its CAT scale (cat-scales).
- **Midway Exit 192**: Flying J #623 and Pilot #425 — two separate operators at the same interchange.
- **Live Oak Exit 283**: Busy Bee #25 (truck-stop) + Penn Oil (parking).
- **Madison Exit 258**: Jimmies + Johnson & Johnson — two separate independents.
- **Baldwin Exit 343**: Pilot #087 and TA — two separate operators.

## Dedup against live Florida (73 rows, all I-75)

- Import-parser dedup vs 73 existing `importDupKey`s: **0 duplicates**.
- Detail-slug collision vs 73 existing FL detail slugs: **0**.

## Staged import parts

| Part | Segment(s) | Rows |
| --- | --- | --- |
| part1 | West + Central panhandle (Pensacola → Tallahassee) | 15 |
| part2 | East to Jacksonville (Madison → Baldwin) | 9 |

## Honest limitations

- **Coordinates deferred** — every row needs geocoding before map/near-me use.
- **Research-grade candidate set, not a verified import.** Nothing written to production.
