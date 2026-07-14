# Batch 19 — I-10 Mississippi: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only. **Nothing imported.**

## Import parser (`prepareImport`)

- Master (`i10-mississippi-batch-019.csv`): total=12 imported=12 **skipped=0 duplicates=0 errors=0**.
- part1 (6) / part2 (6): each 100% clean (0 skipped / 0 duplicates / 0 errors).
- 20 columns; every row passes the same zod `listingSchema` gate the admin form and production
  import use.

## Expansion Readiness (`assessExpansion` vs live)

- Verdicts: **ready-to-publish 8 / import-unpublished 4 / manual-review 0 / reject 0**.
- Slug collisions (in-file + vs live detail slugs): **0**.
- Live duplicate hits: **0** — Mississippi / I-10 has **0** existing production listings. The
  comparison sets were empty by construction and this was asserted in the generator.
- Geocoding: all **12 rows `needs-geocoding`** (coordinates intentionally blank).
- Per-row verdicts: `data/imports/i10-mississippi-batch-019-expansion-report.csv`.

## Quality (`scoreCompleteness`)

- min 56 / median 71 / mean 69.1 / max 80.
- Labels: Good 8, Needs work 4.

## Duplicate detection

- In-file: **0** duplicate `importDupKey`s (asserted in the compile step).
- Cross-batch / vs live production: **0** — no prior batch or live row is in Mississippi. The
  three same-exit co-locations (Gulfport 28, Gulfport 31, Moss Point 69) are distinct rows.

## Data-integrity notes

- No coordinates fabricated; no addresses/phones/exits/ZIPs invented (blanks per `-sources.md`).
- No `published`, `featured`, `affiliatecode`, or `tpcurl` values set.
- Associate tags / monetization untouched (directory data only).

## What this batch does NOT do

- Does not import, merge, deploy, apply migrations, or modify production data.
- Coordinates, publish decisions, and owner spot-checks remain for a later, deliberate import pass.
