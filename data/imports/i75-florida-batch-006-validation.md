# Batch 6 — I-75 Florida: Validation Report

All checks run 2026-07-12 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)

- Master + 3 parts: 100% clean (0 skipped / 0 duplicates / 0 errors). See parts-validation below.

## Expansion Readiness (`assessExpansion` vs live)

- ready-to-publish 58 / import-unpublished 15 / manual-review 0 / reject 0; slug collisions 0.
- Per-row verdicts: `data/imports/i75-florida-batch-006-expansion-report.csv`.

## Duplicate detection (`classifyPair`)

- vs GA 0 / TN 0 / KY 0 / OH 0 / MI 0 / live 0; in-file co-location 25.

## Quality (`scoreCompleteness`)

- min 36 / median 72 / mean 68.8 / max 76; Incomplete 1, Needs work 20, Good 52.
