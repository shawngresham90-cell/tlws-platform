# Batch 22 — I-20 Texas: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only. **Nothing imported.**

## Import parser (`prepareImport`)

- Master (`i20-texas-batch-022.csv`): total=30 imported=30 **skipped=0 duplicates=0 errors=0**.
- part1 (15) / part2 (15): each 100% clean.
- 20 columns; every row passes the same zod `listingSchema` gate the admin form and production
  import use.

## Expansion Readiness (`assessExpansion` vs live)

- Verdicts: **ready-to-publish 22 / import-unpublished 8 / manual-review 0 / reject 0**.
- Slug collisions (in-file + vs live detail slugs): **0**.
- Live duplicate hits: **0** — Texas / I-20 has **0** existing production listings, so there is
  nothing to collide with. The comparison sets were empty by construction and this was asserted in
  the generator.
- Geocoding: all **30 rows `needs-geocoding`** (coordinates intentionally blank).
- Per-row verdicts: `data/imports/i20-texas-batch-022-expansion-report.csv`.

## Quality (`scoreCompleteness`)

- min 52 / median 71 / mean 67.6 / max 76.
- Labels: Good 22, Needs work 8. (The chain travel centers on this corridor are well-documented, so
  completeness runs high; "Needs work" rows are independents missing a source-confirmed address or phone.)

## Duplicate detection

- In-file: **0** duplicate `importDupKey`s (asserted in the compile step).
- Cross-batch / vs live production: **0** — no prior batch or live row is on I-20. (Batches 17–21 are
  I-10; the earlier production data is I-75 / I-65 / I-40 / I-24.)
- The two same-exit co-locations (Sweetwater 242, Van 540) are distinct category rows, not duplicates.

## Data-integrity notes

- No coordinates fabricated; no addresses/phones/exits/ZIPs invented (blanks per `-sources.md`).
- Off-I-20 candidates (Grand Prairie Pilot on TX-161, Fort Worth STM on I-35) and unconfirmed sites
  (Longview "Love's", Waskom) were excluded rather than guessed.
- No `published`, `featured`, `affiliatecode`, or `tpcurl` values set.

## What this batch does NOT do

- Does not import, merge, deploy, apply migrations, or modify production data.
- Coordinates, publish decisions, and owner spot-checks remain for a later, deliberate import pass.
