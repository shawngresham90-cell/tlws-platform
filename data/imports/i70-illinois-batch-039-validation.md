# Batch 39 — I-70 Illinois: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)

- Master + 2 parts: 100% clean.
  - Master: total 17 / imported 17 / skipped 0 / duplicates 0 / errors 0.
  - part1 (west): 8 / 8 / 0 / 0 / 0.
  - part2 (east): 9 / 9 / 0 / 0 / 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit fields (schema ≤20 chars).

## Duplicate detection (vs live Illinois production)

- Illinois existing production listings: **12** — all on **I-24** in Metropolis/Vienna (southern IL).
- Compiled against all 12 live `importDupKey(name, city, IL)` keys: **0 collisions** (no city overlap with the I-70 corridor).
- In-batch name|city|state duplicates: 0. In-batch slug duplicates: 0.
- Internal cross-segment dedup (west / east): 0 dropped — disjoint exit ranges (18–61, 119–160).

## Expansion Readiness (`assessExpansion` vs live)

- Run with the 12 existing IL keys **and** 12 existing IL detail slugs loaded.
- ready-to-publish 13 / import-unpublished 4 / manual-review 0 / reject 0.
- slug collisions vs live production detail slugs: **0**; in-batch: 0.
- Per-row verdicts: `data/imports/i70-illinois-batch-039-expansion-report.csv`.

## Quality (`scoreCompleteness`)

- min 47 / median 71 / mean 68.4 / max 80; Needs work 4, Good 13.

## Notes

- No coordinates supplied on any row (geocoding is a separate verified workflow), so 0 coordinate-validation issues by construction.
- One researcher row (TA Effingham) arrived missing its `amenities` array; reconstructed conservatively from its own description before persisting (no fabrication).
- **I-70 status:** western half complete as drafts (MO, KS, CO, UT); IL now added. Remaining: IN (99) and OH (95) need live dedup; WV, PA, MD are clean (0 rows).
