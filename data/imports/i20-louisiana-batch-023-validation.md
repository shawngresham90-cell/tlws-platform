# Batch 23 — I-20 Louisiana: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only. **Nothing imported.**

## Import parser (`prepareImport`)

- Master (`i20-louisiana-batch-023.csv`): total=14 imported=14 **skipped=0 duplicates=0 errors=0**.
- part1 (6) / part2 (8): each 100% clean.
- 20 columns; every row passes the same zod `listingSchema` gate the admin form and production
  import use.

## Expansion Readiness (`assessExpansion` vs live)

- Verdicts: **ready-to-publish 7 / import-unpublished 7 / manual-review 0 / reject 0**.
- Slug collisions (in-file + vs live detail slugs): **0**.
- Live duplicate hits: **0** — Louisiana / I-20 has **0** existing production listings.
- Geocoding: all **14 rows `needs-geocoding`**.
- Per-row verdicts: `data/imports/i20-louisiana-batch-023-expansion-report.csv`.

## Quality (`scoreCompleteness`)

- min 45 / median 67.5 / mean 65.9 / max 71.
- Labels: Good 7, Needs work 7.

## Duplicate detection

- In-file: **0** duplicate `importDupKey`s (asserted in the compile step).
- Cross-batch / vs live production: **0** — no prior batch or live row is on I-20 in Louisiana.
  The three Tallulah stops at Exit 171 are distinct operators/addresses, not duplicates.

## Data-integrity notes

- No coordinates fabricated; no addresses/phones/exits/ZIPs invented (blanks per `-sources.md`).
- Off-corridor "I-220 Travel Plaza" excluded (it is on I-220, not I-20).
- No `published`, `featured`, `affiliatecode`, or `tpcurl` values set.

## What this batch does NOT do

- Does not import, merge, deploy, apply migrations, or modify production data.
