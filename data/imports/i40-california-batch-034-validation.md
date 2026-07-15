# Batch 34 — I-40 California: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)

- Master + 2 parts: 100% clean.
  - Master: total 10 / imported 10 / skipped 0 / duplicates 0 / errors 0.
  - part1 (east): 5 / 5 / 0 / 0 / 0.
  - part2 (west): 5 / 5 / 0 / 0 / 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit fields (schema ≤20 chars).

## Expansion Readiness (`assessExpansion` vs live)

- ready-to-publish 1 / import-unpublished 9 / manual-review 0 / reject 0; slug collisions 0.
- The high import-unpublished count is expected: this remote desert corridor is served mostly by independent fuel/repair stops with no website and thin published detail, which lowers their completeness scores below the auto-publish threshold. All rows still import cleanly.
- Per-row verdicts: `data/imports/i40-california-batch-034-expansion-report.csv`.

## Duplicate detection

- California / I-40 existing production listings: **0** (first coverage of this state). vs live 0; in-batch name|city|state duplicates 0; in-batch slug duplicates 0.
- Internal cross-segment dedup (east / west): 0 dropped — disjoint exit ranges (50–144 vs 1–23).

## Quality (`scoreCompleteness`)

- min 40 / median 64 / mean 59.3 / max 65; Needs work 9, Good 1.

## Slug-collision detection

- vs live production detail slugs: 0; in-batch: 0.

## Notes

- No coordinates supplied on any row (geocoding is a separate verified workflow), so 0 coordinate-validation issues by construction.
- The four major Barstow travel centers (TA, Love's #374, Pilot, Flying J) were excluded as I-15 (Lenwood/Fisher), not I-40 — a scope decision, not a data gap.
