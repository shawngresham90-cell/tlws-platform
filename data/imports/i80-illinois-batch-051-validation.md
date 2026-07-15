# Batch 51 — I-80 Illinois: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean.
  - Master: total 34 / imported 34 / skipped 0 / duplicates 0 / errors 0.
  - part1 (west): 17 / 17 / 0 / 0 / 0. part2 (east): 17 / 17 / 0 / 0 / 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Illinois production)
- Illinois existing production listings: **12** — all on **I-24** (Metropolis/Vienna).
- Compiled against all 12 live `importDupKey(name, city, IL)` keys: **0 collisions**.
- In-batch name|city|state duplicates: **0**. The Ottawa Exit 90 Lotz truck wash (returned by both segment researchers) was reconciled to the East segment before compile.

## Expansion Readiness (`assessExpansion` vs live)
- Run with the 12 existing IL keys **and** 12 existing IL detail slugs loaded.
- ready-to-publish 23 / import-unpublished 11 / manual-review 0 / reject 0.
- slug collisions vs live production detail slugs: **0**; in-batch: 0. dup hits: **0**.
- Per-row verdicts: `data/imports/i80-illinois-batch-051-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 43 / median 71 / mean 66.3 / max 76; Good 23, Needs work 11.

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- Freight clusters at Morris/Minooka (Exits 112–122) and Joliet (Exit 132). The Chicago Southland Lincoln Oasis (South Holland) sits over the I-80/94/294 concurrency; blank numbered exit, noted in-description.
- Excluded stops on I-55/I-355/I-294/I-57/I-74/I-88/I-280 not on I-80.
- **I-80 status:** western states (CA/NV/UT/WY) + IL now covered as drafts. IA, NE ready/pending; IN/OH dedup states and PA/NJ to follow.
