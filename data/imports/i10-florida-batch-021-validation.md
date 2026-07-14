# Batch 21 — I-10 Florida Panhandle: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only, against the REAL 73-row live
Florida comparison set. **Nothing imported.**

## Import parser (`prepareImport`, existingKeys = 73 live FL rows)

- Master (`i10-florida-batch-021.csv`): total=24 imported=24 **skipped=0 duplicates=0 errors=0**.
- part1 (15) / part2 (9): each 100% clean.
- 20 columns; every row passes the same zod `listingSchema` gate the admin form and production
  import use.

## Expansion Readiness (`assessExpansion` vs REAL live FL)

- Fed the real comparison sets: **73 existing `importDupKey`s** and **73 existing detail slugs**.
- Verdicts: **ready-to-publish 12 / import-unpublished 12 / manual-review 0 / reject 0**.
- Slug collisions (in-file + vs 73 live FL detail slugs): **0**.
- Import-parser duplicates vs live FL: **0** — all 73 existing FL rows are on I-75; this batch is
  entirely on I-10, in panhandle cities absent from the live set.
- Geocoding: all **24 rows `needs-geocoding`**.
- Per-row verdicts: `data/imports/i10-florida-batch-021-expansion-report.csv`.

## Quality (`scoreCompleteness`)

- min 49 / median 65.5 / mean 66.1 / max 80.
- Labels: Good 12, Needs work 12.

## Duplicate detection

- In-file: **0** duplicate `importDupKey`s (asserted in the compile step).
- Vs live FL (73 rows): **0** — asserted in the compile step and re-confirmed by `assessExpansion`.
- The excluded I-75 Lake City stops (Love's #724, TA #288, Speedco) were kept out at research time;
  the one Lake City row here (S & S Food Store) is the distinct I-10 Exit 303 facility.

## Data-integrity notes

- No coordinates fabricated; no addresses/phones/exits/ZIPs invented (blanks per `-sources.md`).
- No `published`, `featured`, `affiliatecode`, or `tpcurl` values set.
- Associate tags / monetization untouched (directory data only).

## What this batch does NOT do

- Does not import, merge, deploy, apply migrations, or modify production data. The live Florida read
  was strictly read-only (dedup snapshot).
