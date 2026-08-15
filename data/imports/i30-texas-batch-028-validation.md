# Batch 28 — I-30 Texas: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only. **Nothing imported.**

## Import parser (`prepareImport`)

- Master (`i30-texas-batch-028.csv`): total=13 imported=13 **skipped=0 duplicates=0 errors=0**.
- part1 (6) / part2 (7): each 100% clean.
- 20 columns; every row passes the same zod `listingSchema` gate the admin form and production
  import use.

## Expansion Readiness (`assessExpansion` vs live)

- Verdicts: **ready-to-publish 10 / import-unpublished 3 / manual-review 0 / reject 0**.
- Slug collisions (in-file + vs live detail slugs): **0**.
- Live duplicate hits: **0** — Texas / I-30 has **0** existing production listings.
- Geocoding: all **13 rows `needs-geocoding`**.
- Per-row verdicts: `data/imports/i30-texas-batch-028-expansion-report.csv`.

## Quality (`scoreCompleteness`)

- min 53 / median 71 / mean 69.1 / max 80.
- Labels: Good 10, Needs work 3.

## Duplicate detection

- In-file: **0** duplicate `importDupKey`s (asserted in the compile step).
- Cross-batch / vs live production: **0** — no prior batch or live row is on I-30. (Batch 22's
  Texas rows are on I-20 in different cities; no overlap.)
- The four same-exit co-locations (Rockwall 70, Royse City 77, Sulphur Springs 122, Mount Vernon 147)
  are distinct operators/categories, not duplicates.

## Data-integrity notes

- No coordinates fabricated; no addresses/phones/exits/ZIPs invented (blanks per `-sources.md`).
- **Interstate accuracy:** the dense DFW-core candidates on US-80 / I-635 / I-20 were excluded rather
  than mislabeled as I-30; the Texarkana Flying J on the Arkansas side (state ≠ TX) was excluded.
- No `published`, `featured`, `affiliatecode`, or `tpcurl` values set.

## What this batch does NOT do

- Does not import, merge, deploy, apply migrations, or modify production data.
