# Batch 20 — I-10 Alabama: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only, against the REAL 64-row live
Alabama comparison set. **Nothing imported.**

## Import parser (`prepareImport`, existingKeys = 64 live AL rows)

- Master (`i10-alabama-batch-020.csv`): total=12 imported=12 **skipped=0 duplicates=0 errors=0**.
- part1 (6) / part2 (6): each 100% clean.
- 20 columns; every row passes the same zod `listingSchema` gate the admin form and production
  import use.

## Expansion Readiness (`assessExpansion` vs REAL live AL)

- Fed the real comparison sets: **64 existing `importDupKey`s** and **64 existing detail slugs**.
- Verdicts: **ready-to-publish 8 / import-unpublished 4 / manual-review 0 / reject 0**.
- Slug collisions (in-file + vs 64 live AL detail slugs): **0**.
- Import-parser duplicates vs live AL: **0** — all 64 existing AL rows are on I-65; this batch is
  entirely on I-10, in Mobile-area cities absent from the live set.
- Geocoding: all **12 rows `needs-geocoding`**.
- Per-row verdicts: `data/imports/i10-alabama-batch-020-expansion-report.csv`.

## Quality (`scoreCompleteness`)

- min 54 / median 70 / mean 68.0 / max 76.
- Labels: Good 8, Needs work 4.

## Duplicate detection

- In-file: **0** duplicate `importDupKey`s (asserted in the compile step).
- Vs live AL (64 rows): **0** — asserted in the compile step and re-confirmed by `assessExpansion`.
- The excluded I-65 Mobile-area stops (Love's #624 Prichard, Pilot #75 Satsuma, Qualawash Saraland)
  were kept out at research time and confirmed absent from the batch.

## Data-integrity notes

- No coordinates fabricated; no addresses/phones/exits/ZIPs invented (blanks per `-sources.md`).
- Reconstructed the Oasis Travel Center amenities from its verified description (the research row
  omitted the array); no facts invented.
- No `published`, `featured`, `affiliatecode`, or `tpcurl` values set.

## What this batch does NOT do

- Does not import, merge, deploy, apply migrations, or modify production data. The live Alabama
  read was strictly read-only (dedup snapshot).
