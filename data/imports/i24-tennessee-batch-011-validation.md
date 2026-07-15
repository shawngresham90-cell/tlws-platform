# Batch 11 — I-24 Tennessee: Validation Report

All checks run 2026-07-13 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport` / `scripts/validate-import.ts`)

- Master + 2 parts: 100% clean (0 skipped / 0 duplicates / 0 errors / 0 invalid categories / 0 malformed URLs / 0 coordinates).

## Expansion Readiness (`assessExpansion` vs live)

- ready-to-publish 28 / import-unpublished 15 / manual-review 0 / reject 0; slug collisions 0.
- Per-row verdicts: `data/imports/i24-tennessee-batch-011-expansion-report.csv`.

## Duplicate detection (`classifyPair`)

- vs GA 0 / TN-I75 19 / KY 0 / OH 2 / MI 0 / FL 0 / IN 0 / AL 0 / TN-I65 22 / live 43; in-file co-location 17; in-batch slug duplicates 0.
- All are low-confidence (score 35) brand-multi-exit / shared-corporate-contact false positives; 0 exact duplicates, 0 slug collisions, 0 existing-TN duplicates dropped.

## Quality (`scoreCompleteness`)

- min 24 / median 68 / mean 59.3 / max 76; Incomplete 12, Needs work 5, Good 26.

## Slug-collision detection

- vs live production detail slugs: 0; in-batch: 0.
