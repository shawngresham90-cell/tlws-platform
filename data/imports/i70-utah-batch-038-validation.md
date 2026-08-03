# Batch 38 — I-70 Utah: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)

- Master + 2 parts: 100% clean.
  - Master: total 7 / imported 7 / skipped 0 / duplicates 0 / errors 0.
  - part1 (east / Green River): 4 / 4 / 0 / 0 / 0.
  - part2 (west / Salina–Richfield): 3 / 3 / 0 / 0 / 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit fields (schema ≤20 chars).

## Expansion Readiness (`assessExpansion` vs live)

- ready-to-publish 4 / import-unpublished 3 / manual-review 0 / reject 0; slug collisions 0.
- Per-row verdicts: `data/imports/i70-utah-batch-038-expansion-report.csv`.

## Duplicate detection

- Utah / I-70 existing production listings: **0** (first coverage of this state). vs live 0; in-batch name|city|state duplicates 0; in-batch slug duplicates 0.
- Internal cross-segment dedup (east / west): 0 dropped — disjoint (Green River 160 vs Salina/Richfield 40–56).

## Quality (`scoreCompleteness`)

- min 54 / median 71 / mean 65.7 / max 71; Needs work 3, Good 4.

## Slug-collision detection

- vs live production detail slugs: 0; in-batch: 0.

## Notes

- No coordinates supplied on any row (geocoding is a separate verified workflow), so 0 coordinate-validation issues by construction.
- Small row count is honest: Utah's I-70 has only three service towns; the San Rafael Swell and the ghost towns of Cisco/Thompson Springs genuinely have no truck services.
- **I-70 western half now complete as drafts:** MO, KS, CO, UT. Remaining eastern states: OH (95), IN (99), IL (12) need live dedup; WV, PA, MD are clean (0 rows).
