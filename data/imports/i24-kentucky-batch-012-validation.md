# Batch 12 — I-24 Kentucky: Validation Report

All checks run 2026-07-13 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport` / `scripts/validate-import.ts`)

- Master + 2 parts: 100% clean (0 skipped / 0 duplicates / 0 errors / 0 invalid categories / 0 malformed URLs / 0 coordinates).

## Expansion Readiness (`assessExpansion` vs live)

- ready-to-publish 28 / import-unpublished 9 / manual-review 0 / reject 0; slug collisions 0.
- Per-row verdicts: `data/imports/i24-kentucky-batch-012-expansion-report.csv`.

## Duplicate detection (`classifyPair`)

- vs GA 0 / TN-I75 0 / KY 33 / OH 0 / MI 0 / FL 0 / IN 0 / AL 0 / TN-I65 0 / live 33; in-file co-location 12; in-batch slug duplicates 0.
- All are low-confidence (score 35) brand-multi-exit / shared-corporate-contact false positives; 0 exact duplicates, 0 slug collisions, 0 existing-TN duplicates dropped.

## Quality (`scoreCompleteness`)

- min 24 / median 72 / mean 61.5 / max 76; Incomplete 9, Needs work 3, Good 25.

## Slug-collision detection

- vs live production detail slugs: 0; in-batch: 0.
