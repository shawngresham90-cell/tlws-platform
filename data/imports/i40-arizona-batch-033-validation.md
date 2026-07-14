# Batch 33 — I-40 Arizona: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)

- Master + 2 parts: 100% clean.
  - Master: total 22 / imported 22 / skipped 0 / duplicates 0 / errors 0.
  - part1 (east + Flagstaff): 15 / 15 / 0 / 0 / 0.
  - part2 (west): 7 / 7 / 0 / 0 / 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit fields (schema ≤20 chars).

## Expansion Readiness (`assessExpansion` vs live)

- ready-to-publish 13 / import-unpublished 9 / manual-review 0 / reject 0; slug collisions 0.
- Per-row verdicts: `data/imports/i40-arizona-batch-033-expansion-report.csv`.

## Duplicate detection

- Arizona / I-40 existing production listings: **0** (first coverage of this state). vs live 0; in-batch name|city|state duplicates 0; in-batch slug duplicates 0.
- Internal cross-segment dedup (east / Flagstaff / west): 0 dropped — the segments cover disjoint exit ranges (255+, 185–198, 44–163).

## Quality (`scoreCompleteness`)

- min 47 / median 71 / mean 66.4 / max 76; Needs work 9, Good 13.

## Slug-collision detection

- vs live production detail slugs: 0; in-batch: 0.

## Notes

- No coordinates supplied on any row (geocoding is a separate verified workflow), so 0 coordinate-validation issues by construction.
- 9 held (import-unpublished) rows import cleanly but lack a verified address/exit (both ports of entry, Flagstaff tire/wash, etc.); blank was kept over any guess.
