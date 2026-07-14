# Batch 25 — I-20 Alabama: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only, against the REAL 64-row live
Alabama comparison set. **Nothing imported.**

## Import parser (`prepareImport`, existingKeys = 64 live AL rows)

- Master (`i20-alabama-batch-025.csv`): total=16 imported=16 **skipped=0 duplicates=0 errors=0**.
- part1 (7) / part2 (9): each 100% clean.
- 20 columns; every row passes the same zod `listingSchema` gate the admin form and production
  import use.

## Expansion Readiness (`assessExpansion` vs REAL live AL)

- Fed the real comparison sets: **64 existing `importDupKey`s** and **64 existing detail slugs**.
- Verdicts: **ready-to-publish 9 / import-unpublished 7 / manual-review 0 / reject 0**.
- Slug collisions (in-file + vs 64 live AL detail slugs): **0**.
- Import-parser duplicates vs live AL: **0** — all 64 existing AL rows are on I-65; this batch is
  entirely on I-20 (or the signed I-20/I-59 concurrency), in cities absent from the live set.
- Geocoding: all **16 rows `needs-geocoding`**.
- Per-row verdicts: `data/imports/i20-alabama-batch-025-expansion-report.csv`.

## Quality (`scoreCompleteness`)

- min 56 / median 71 / mean 66.4 / max 72.
- Labels: Good 9, Needs work 7.

## Duplicate detection

- In-file: **0** duplicate `importDupKey`s (asserted in the compile step).
- Vs live AL (64 rows): **0** — asserted in the compile step and re-confirmed by `assessExpansion`.
- The excluded I-65 Birmingham stops (Pilot #602, Speedway Finley Blvd) were kept out at research
  time and confirmed absent from the batch.

## Data-integrity notes

- No coordinates fabricated; no addresses/phones/exits/ZIPs invented (blanks per `-sources.md`).
- Cross-batch consistency: Love's #530 is correctly placed in Moody, AL here (loves.com/locations/530);
  the mis-attributed Midland, TX copy is being removed from Batch 22 (PR #61).
- No `published`, `featured`, `affiliatecode`, or `tpcurl` values set.

## What this batch does NOT do

- Does not import, merge, deploy, apply migrations, or modify production data. The live Alabama read
  was strictly read-only (dedup snapshot).
