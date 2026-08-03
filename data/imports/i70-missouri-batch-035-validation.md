# Batch 35 — I-70 Missouri: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)

- Master + 2 parts: 100% clean.
  - Master: total 25 / imported 25 / skipped 0 / duplicates 0 / errors 0.
  - part1 (west + central): 18 / 18 / 0 / 0 / 0.
  - part2 (east): 7 / 7 / 0 / 0 / 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit fields (schema ≤20 chars).

## Expansion Readiness (`assessExpansion` vs live)

- ready-to-publish 16 / import-unpublished 9 / manual-review 0 / reject 0; slug collisions 0.
- Per-row verdicts: `data/imports/i70-missouri-batch-035-expansion-report.csv`.

## Duplicate detection

- Missouri / I-70 existing production listings: **0** (first coverage of this state). vs live 0; in-batch name|city|state duplicates 0; in-batch slug duplicates 0.
- Internal cross-segment dedup (west / central / east): 0 dropped — disjoint exit ranges (28–101, 121–188, 198–222).

## Quality (`scoreCompleteness`)

- min 36 / median 69 / mean 65.8 / max 76; Incomplete 1, Needs work 8, Good 16.

## Slug-collision detection

- vs live production detail slugs: 0; in-batch: 0.

## Notes

- No coordinates supplied on any row (geocoding is a separate verified workflow), so 0 coordinate-validation issues by construction.
- 9 held (import-unpublished) rows import cleanly but lack a verified address/ZIP/exit (Break Time, rest area, MSHP scale house, co-located Speedco/CAT phones); blank was kept over any guess.
- I-70 state audit (for future batches): OH (95), IN (99), IL (12) have existing production rows and will require live dedup; MD, PA, WV, KS, CO, UT are clean (0 rows).
