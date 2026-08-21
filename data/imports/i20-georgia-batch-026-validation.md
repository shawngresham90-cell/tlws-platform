# Batch 26 — I-20 Georgia: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only, against the REAL 82-row live
Georgia comparison set. **Nothing imported.**

## Import parser (`prepareImport`, existingKeys = 82 live GA rows)

- Master (`i20-georgia-batch-026.csv`): total=14 imported=14 **skipped=0 duplicates=0 errors=0**.
- part1 (7) / part2 (7): each 100% clean.
- 20 columns; every row passes the same zod `listingSchema` gate the admin form and production
  import use.

## Expansion Readiness (`assessExpansion` vs REAL live GA)

- Fed the real comparison sets: **82 existing `importDupKey`s** and **82 existing detail slugs**.
- Verdicts: **ready-to-publish 10 / import-unpublished 4 / manual-review 0 / reject 0**.
- Slug collisions (in-file + vs 82 live GA detail slugs): **0**.
- Import-parser duplicates vs live GA: **0** — all 82 existing GA rows are on I-75 / I-24; this batch
  is entirely on I-20, in cities absent from the live set.
- Geocoding: all **14 rows `needs-geocoding`**.
- Per-row verdicts: `data/imports/i20-georgia-batch-026-expansion-report.csv`.

## Quality (`scoreCompleteness`)

- min 57 / median 71 / mean 67.9 / max 71.
- Labels: Good 10, Needs work 4.

## Duplicate detection

- In-file: **0** duplicate `importDupKey`s (asserted in the compile step).
- Vs live GA (82 rows): **0** — asserted in the compile step and re-confirmed by `assessExpansion`.
- The excluded Fulton Industrial Southern Tire Mart #165 and I-75 Atlanta stops were kept out at
  research time; QuikTrip #777 (5705 Fulton Industrial) is a distinct facility, not a duplicate.

## Data-integrity notes

- No coordinates fabricated; no addresses/phones/exits/ZIPs invented (blanks per `-sources.md`).
- Reconstructed amenities for three rows (Love's #311, Pilot #417, Flying J #634) from their verified
  descriptions where the research output omitted the array; no facts invented.
- Off-I-20 (Blue Beacon on I-285) and unconfirmed (Douglasville, Covington) candidates excluded.
- No `published`, `featured`, `affiliatecode`, or `tpcurl` values set.

## What this batch does NOT do

- Does not import, merge, deploy, apply migrations, or modify production data. The live Georgia read
  was strictly read-only (dedup snapshot).
