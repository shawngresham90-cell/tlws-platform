# Batch 7 — I-65 Indiana: Validation Report

All checks run 2026-07-12 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport` / `scripts/validate-import.ts`)

- Master + 4 parts: 100% clean (0 skipped / 0 duplicates / 0 errors / 0 invalid categories / 0 malformed URLs / 0 coordinates).

## Expansion Readiness (`assessExpansion` vs live)

- ready-to-publish 74 / import-unpublished 25 / manual-review 0 / reject 0; slug collisions 0.
- Per-row verdicts: `data/imports/i65-indiana-batch-007-expansion-report.csv`.

## Duplicate detection (`classifyPair`)

- vs GA 0 / TN 0 / KY 0 / OH 0 / MI 0 / FL 0 / live 0; in-file co-location 28; in-batch slug duplicates 0.

## Quality (`scoreCompleteness`)

- min 36 / median 69 / mean 66 / max 80; Incomplete 1, Needs work 40, Good 58.

## Slug-collision detection

- vs live production detail slugs: 0; in-batch: 0.
