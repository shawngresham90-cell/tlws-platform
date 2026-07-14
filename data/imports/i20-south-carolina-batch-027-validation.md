# Batch 27 — I-20 South Carolina: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only. **Nothing imported.**

## Import parser (`prepareImport`)

- Master (`i20-south-carolina-batch-027.csv`): total=10 imported=10 **skipped=0 duplicates=0 errors=0**.
- part1 (7) / part2 (3): each 100% clean.
- 20 columns; every row passes the same zod `listingSchema` gate the admin form and production
  import use.

## Expansion Readiness (`assessExpansion` vs live)

- Verdicts: **ready-to-publish 8 / import-unpublished 2 / manual-review 0 / reject 0**.
- Slug collisions (in-file + vs live detail slugs): **0**.
- Live duplicate hits: **0** — South Carolina has **0** existing production listings.
- Geocoding: all **10 rows `needs-geocoding`**.
- Per-row verdicts: `data/imports/i20-south-carolina-batch-027-expansion-report.csv`.

## Quality (`scoreCompleteness`)

- min 60 / median 71 / mean 69.7 / max 80.
- Labels: Good 8, Needs work 2.

## Duplicate detection

- In-file: **0** duplicate `importDupKey`s (asserted in the compile step).
- Cross-batch / vs live production: **0** — South Carolina is a brand-new state.

## Data-integrity notes

- No coordinates fabricated; no addresses/phones/exits/ZIPs invented (blanks per `-sources.md`).
- **Interstate accuracy:** the Florence terminus stops (Pilot #337, TA #195, Petro #393) are signed on
  I-95, not I-20, and were excluded rather than mislabeled — they belong in a future I-95 SC batch.
  The West Columbia Pilot (I-26/I-77) was likewise excluded.
- No `published`, `featured`, `affiliatecode`, or `tpcurl` values set.

## What this batch does NOT do

- Does not import, merge, deploy, apply migrations, or modify production data.
