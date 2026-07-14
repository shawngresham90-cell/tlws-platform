# Batch 24 — I-20 Mississippi: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only. **Nothing imported.**

## Import parser (`prepareImport`)

- Master (`i20-mississippi-batch-024.csv`): total=14 imported=14 **skipped=0 duplicates=0 errors=0**.
- part1 (7) / part2 (7): each 100% clean.
- 20 columns; every row passes the same zod `listingSchema` gate the admin form and production
  import use.

## Expansion Readiness (`assessExpansion` vs live)

- Verdicts: **ready-to-publish 10 / import-unpublished 4 / manual-review 0 / reject 0**.
- Slug collisions (in-file + vs live detail slugs): **0**.
- Live duplicate hits: **0** — Mississippi / I-20 has **0** existing production listings.
- Geocoding: all **14 rows `needs-geocoding`**.
- Per-row verdicts: `data/imports/i20-mississippi-batch-024-expansion-report.csv`.

## Quality (`scoreCompleteness`)

- min 48 / median 71 / mean 66.6 / max 71.
- Labels: Good 10, Needs work 4.

## Duplicate detection

- In-file: **0** duplicate `importDupKey`s (asserted in the compile step).
- Cross-batch / vs live production: **0** — no prior batch or live row is on I-20 in Mississippi.
  The two Jackson stops (Exit 45) and four Meridian-area stops are distinct operators, not duplicates.

## Data-integrity notes

- No coordinates fabricated; no addresses/phones/exits/ZIPs invented (blanks per `-sources.md`).
- Off-corridor / mis-attributed candidates (Morton Exit 77, "Love's #751" which is in SC) excluded.
- Concurrency-segment stops (I-20/I-55 in Jackson, I-20/I-59 in Meridian) are genuinely on the signed
  I-20 portion.
- No `published`, `featured`, `affiliatecode`, or `tpcurl` values set.

## What this batch does NOT do

- Does not import, merge, deploy, apply migrations, or modify production data.
