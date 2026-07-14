# Batch 18 — I-10 Louisiana: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only. **Nothing imported.**

## Import parser (`prepareImport`)

- Master (`i10-louisiana-batch-018.csv`): total=30 imported=30 **skipped=0 duplicates=0 errors=0**.
- part1 (16) / part2 (14): each 100% clean (0 skipped / 0 duplicates / 0 errors).
- 20 columns; every row passes the same zod `listingSchema` gate the admin form and production
  import use.

## Expansion Readiness (`assessExpansion` vs live)

- Verdicts: **ready-to-publish 16 / import-unpublished 14 / manual-review 0 / reject 0**.
- Slug collisions (in-file + vs live detail slugs): **0**.
- Live duplicate hits: **0** — Louisiana / I-10 has **0** existing production listings, so there
  is nothing to collide with. The comparison sets (existing keys, existing detail slugs, live
  rows) were empty by construction and this was asserted in the generator.
- Geocoding: all **30 rows `needs-geocoding`** (coordinates intentionally blank).
- Per-row verdicts: `data/imports/i10-louisiana-batch-018-expansion-report.csv`.

## Quality (`scoreCompleteness`)

- min 48 / median 68.5 / mean 66.5 / max 80.
- Labels: Good 16, Needs work 14. (The "Needs work" rows are independents / mobile services
  missing a source-confirmed ZIP, phone, or exit — blanks kept by the no-fabrication policy.)

## Duplicate detection

- In-file: **0** duplicate `importDupKey`s (asserted in the compile step).
- Cross-batch / vs live production: **0** — no prior batch or live row is in Louisiana. The
  three same-exit co-locations (Egan 76, Port Allen 151, LaPlace 209) are distinct
  category rows, not duplicates.

## Data-integrity notes

- No coordinates fabricated; no addresses/phones/exits/ZIPs invented (blanks per `-sources.md`).
- Corrected one suspect field at source: the Duson Love's ZIP (source gave Rayne's 70578) was
  blanked rather than kept wrong.
- No `published`, `featured`, `affiliatecode`, or `tpcurl` values set.
- Associate tags / monetization untouched (directory data only).

## What this batch does NOT do

- Does not import, merge, deploy, apply migrations, or modify production data.
- Coordinates, publish decisions, and owner spot-checks remain for a later, deliberate import
  pass — exactly as with prior corridor batches.
