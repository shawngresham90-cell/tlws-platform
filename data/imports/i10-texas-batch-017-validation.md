# Batch 17 — I-10 Texas: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only. **Nothing imported.**

## Import parser (`prepareImport`)

- Master (`i10-texas-batch-017.csv`): total=32 imported=32 **skipped=0 duplicates=0 errors=0**.
- part1 (13) / part2 (8) / part3 (11): each 100% clean (0 skipped / 0 duplicates / 0 errors).
- 20 columns; every row passes the same zod `listingSchema` gate the admin form and
  production import use.

## Expansion Readiness (`assessExpansion` vs live)

- Verdicts: **ready-to-publish 14 / import-unpublished 18 / manual-review 0 / reject 0**.
- Slug collisions (in-file + vs live detail slugs): **0**.
- Live duplicate hits: **0** — Texas / I-10 has **0** existing production listings, so there
  is nothing to collide with. The comparison sets (existing keys, existing detail slugs,
  live rows) were empty by construction and this was asserted in the generator.
- Geocoding: all **32 rows `needs-geocoding`** (coordinates intentionally blank).
- Per-row verdicts: `data/imports/i10-texas-batch-017-expansion-report.csv`.

## Quality (`scoreCompleteness`)

- min 45 / median 64 / mean 62.8 / max 75.
- Labels: Good 14, Needs work 18. (The "Needs work" rows are chain/independent stops missing
  a source-confirmed address, ZIP, or phone — blanks kept by the no-fabrication policy.)

## Duplicate detection

- In-file: **0** duplicate `importDupKey`s (asserted in the compile step).
- Cross-batch / vs live production: **0** — no prior batch or live row is in Texas or on I-10.

## Data-integrity notes

- No coordinates fabricated; no addresses/phones/exits invented (blanks per `-sources.md`).
- No `published`, `featured`, `affiliatecode`, or `tpcurl` values set — those remain
  deliberate per-listing owner decisions.
- Associate tags / monetization untouched (this batch is directory data only).

## What this batch does NOT do

- Does not import, merge, deploy, apply migrations, or modify production data.
- Coordinates, publish decisions, and any owner spot-checks remain for a later, deliberate
  import pass — exactly as with prior corridor batches.
