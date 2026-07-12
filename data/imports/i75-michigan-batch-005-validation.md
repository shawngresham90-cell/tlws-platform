# Batch 5 — I-75 Michigan: Validation Report

All checks run 2026-07-12 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)

- Master + 3 parts: 100% clean (0 skipped / 0 duplicates / 0 errors). See parts-validation below.

## Expansion Readiness (`assessExpansion` vs live)

- ready-to-publish 44 / import-unpublished 29 / manual-review 0 / reject 0; slug collisions 0.
- Per-row verdicts: `data/imports/i75-michigan-batch-005-expansion-report.csv`.

## Duplicate detection (`classifyPair`)

- vs GA 0 / TN 0 / KY 0 / OH 0 / live 0; in-file co-location 25.

## Quality (`scoreCompleteness`)

- min 32 / median 68 / mean 63.6 / max 80; Incomplete 4, Needs work 29, Good 40.
