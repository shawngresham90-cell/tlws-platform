# Batch 31 — I-40 Texas Panhandle: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)

- Master + 2 parts: 100% clean.
  - Master: total 20 / imported 20 / skipped 0 / duplicates 0 / errors 0.
  - part1 (east + Amarillo): 16 / 16 / 0 / 0 / 0.
  - part2 (west): 4 / 4 / 0 / 0 / 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit fields (schema ≤20 chars).

## Expansion Readiness (`assessExpansion` vs live)

- ready-to-publish 13 / import-unpublished 7 / manual-review 0 / reject 0; slug collisions 0.
- Per-row verdicts: `data/imports/i40-texas-batch-031-expansion-report.csv`.

## Duplicate detection

- Texas / I-40 existing production listings: **0** (first Panhandle coverage; no overlap with the southern I-10 Texas corridor). vs live 0; in-batch name|city|state duplicates 0; in-batch slug duplicates 0.
- Internal cross-segment dedup (east / Amarillo / west): **1 dropped** — Flying J #723 Amarillo (Exit 76), returned by two researchers, kept once.

## Quality (`scoreCompleteness`)

- min 56 / median 71 / mean 68.0 / max 76; Needs work 7, Good 13.

## Slug-collision detection

- vs live production detail slugs: 0; in-batch: 0.

## Notes

- No coordinates supplied on any row (geocoding is a separate verified workflow), so 0 coordinate-validation issues by construction.
- 7 held (import-unpublished) rows import cleanly but lack a verified address/exit; blank was kept over any guess.
