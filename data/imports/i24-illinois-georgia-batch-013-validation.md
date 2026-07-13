# Batch 13 — I-24 Illinois + Georgia: Validation Report

All checks run 2026-07-13 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)

- Master + 1 parts: 100% clean (0 skipped / 0 duplicates / 0 errors / 0 invalid categories / 0 malformed URLs / 0 coordinates).

## Expansion Readiness (`assessExpansion` vs live)

- ready-to-publish 6 / import-unpublished 10 / manual-review 0 / reject 0; slug collisions 0.
- Per-row verdicts: `data/imports/i24-illinois-georgia-batch-013-expansion-report.csv`.

## Duplicate detection (`classifyPair`)

- vs GA 10 / TN-I75 0 / KY-I75 0 / OH 0 / MI 0 / FL 0 / IN 0 / AL 0 / TN-I65 0 / pending-KY-I65 0 / pending-TN-I24 0 / pending-KY-I24 0 / live 10; in-file co-location 1; in-batch slug duplicates 0.
- Cross-batch/live hits reviewed individually; brand-multi-exit / shared-corporate-contact matches at a different city, exit and street address are false positives. 0 slug collisions, 0 existing-production duplicates retained.

## Quality (`scoreCompleteness`)

- min 24 / median 27 / mean 43.3 / max 80; Incomplete 10, Needs work 1, Good 5.

## Slug-collision detection

- vs live production detail slugs: 0; in-batch: 0.

## Live snapshot verification

- `live.json` (670 rows) verified current against production (`select count(*) ... group by state` matched exactly: 670 total, IL 0, GA 78) before the dedup passes ran.
