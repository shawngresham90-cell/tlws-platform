# Batch 30 — I-40 Oklahoma: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)

- Master + 2 parts: 100% clean.
  - Master: total 26 / imported 26 / skipped 0 / duplicates 0 / errors 0.
  - part1 (east + OKC metro): 17 / 17 / 0 / 0 / 0.
  - part2 (west): 9 / 9 / 0 / 0 / 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit fields (schema ≤20 chars).

## Expansion Readiness (`assessExpansion` vs live)

- ready-to-publish 15 / import-unpublished 11 / manual-review 0 / reject 0; slug collisions 0.
- Per-row verdicts: `data/imports/i40-oklahoma-batch-030-expansion-report.csv`.

## Duplicate detection

- Oklahoma / I-40 existing production listings: **0** (first coverage of this state). vs live 0; in-batch name|city|state duplicates 0; in-batch slug duplicates 0.
- Internal dedup across the three research segments (east / OKC-metro / west): 0 collisions.

## Quality (`scoreCompleteness`)

- min 45 / median 67 / mean 64.8 / max 76; Needs work 11, Good 15.

## Slug-collision detection

- vs live production detail slugs: 0; in-batch: 0.

## Notes

- No coordinates supplied on any row (geocoding is a separate verified workflow), so 0 coordinate-validation issues by construction.
- 11 held (import-unpublished) rows are complete enough to import but lack a verified address/ZIP/phone/exit and are held rather than published; blank was kept over any guess.
