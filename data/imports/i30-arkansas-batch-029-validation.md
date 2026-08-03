# Batch 29 — I-30 Arkansas: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only, against the REAL 127-row live
Arkansas comparison set. **Nothing imported.**

## Import parser (`prepareImport`, existingKeys = 127 live AR rows)

- Master (`i30-arkansas-batch-029.csv`): total=16 imported=16 **skipped=0 duplicates=0 errors=0**.
- part1 (8) / part2 (8): each 100% clean.
- 20 columns; every row passes the same zod `listingSchema` gate the admin form and production
  import use.

## Expansion Readiness (`assessExpansion` vs REAL live AR)

- Fed the real comparison sets: **127 existing `importDupKey`s** and **127 existing detail slugs**.
- Verdicts: **ready-to-publish 12 / import-unpublished 4 / manual-review 0 / reject 0**.
- Slug collisions (in-file + vs 127 live AR detail slugs): **0**.
- Import-parser duplicates vs live AR: **0** — all 127 existing AR rows are on I-40; this batch is
  entirely on I-30, in cities absent from the live set.
- Geocoding: all **16 rows `needs-geocoding`**.
- Per-row verdicts: `data/imports/i30-arkansas-batch-029-expansion-report.csv`.

## Quality (`scoreCompleteness`)

- min 57 / median 69 / mean 68.0 / max 72.
- Labels: Good 12, Needs work 4.

## Duplicate detection

- In-file: **0** duplicate `importDupKey`s (asserted in the compile step).
- Vs live AR (127 rows): **0** — asserted in the compile step and re-confirmed by `assessExpansion`.
- The excluded I-40 North Little Rock cluster (Petro #326, Pilot #332, Love's #236) and West Memphis /
  Russellville / Clarksville stops were kept out at research time.

## Data-integrity notes

- No coordinates fabricated; no addresses/phones/exits/ZIPs invented (blanks per `-sources.md`).
- **Interstate accuracy:** the Texarkana TX-side Flying J (state ≠ AR) was excluded; the Arkansas-side
  Flying J #606 is a distinct facility that is included.
- Omitted the Hope stop (reported closed / replacement under construction) rather than list it.
- No `published`, `featured`, `affiliatecode`, or `tpcurl` values set.

## What this batch does NOT do

- Does not import, merge, deploy, apply migrations, or modify production data. The live Arkansas read
  was strictly read-only (dedup snapshot).
