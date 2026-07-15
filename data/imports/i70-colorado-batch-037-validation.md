# Batch 37 — I-70 Colorado: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)

- Master + 2 parts: 100% clean.
  - Master: total 20 / imported 20 / skipped 0 / duplicates 0 / errors 0.
  - part1 (east + Denver): 13 / 13 / 0 / 0 / 0.
  - part2 (west): 7 / 7 / 0 / 0 / 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit fields (schema ≤20 chars).

## Expansion Readiness (`assessExpansion` vs live)

- ready-to-publish 15 / import-unpublished 5 / manual-review 0 / reject 0; slug collisions 0.
- Per-row verdicts: `data/imports/i70-colorado-batch-037-expansion-report.csv`.

## Duplicate detection

- Colorado / I-70 existing production listings: **0** (first coverage of this state). vs live 0; in-batch name|city|state duplicates 0; in-batch slug duplicates 0.
- Internal cross-segment dedup (east / Denver / west): 0 dropped — disjoint exit ranges (359–437, 278–304, 15–90) with empty high-mountain gaps between.

## Quality (`scoreCompleteness`)

- min 45 / median 71 / mean 68.8 / max 80; Needs work 5, Good 15.

## Slug-collision detection

- vs live production detail slugs: 0; in-batch: 0.

## Notes

- No coordinates supplied on any row (geocoding is a separate verified workflow), so 0 coordinate-validation issues by construction.
- The Idaho Springs → Glenwood Springs high-mountain stretch has no interstate truck stops (terrain) and was intentionally left empty — a coverage fact, not a data gap.
- I-70 state audit (for future batches): OH (95), IN (99), IL (12) have existing production rows and will require live dedup; UT, MD, PA, WV are clean (0 rows). MO, KS, CO now covered as drafts.
