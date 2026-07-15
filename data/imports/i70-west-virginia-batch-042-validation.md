# Batch 42 — I-70 West Virginia: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)

- Master + part1: 100% clean.
  - Master: total 2 / imported 2 / skipped 0 / duplicates 0 / errors 0.
  - part1 (whole panhandle): 2 / 2 / 0 / 0 / 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit fields (schema ≤20 chars).
- Column width 20 on every row (header + data).

## Duplicate detection (vs live West Virginia production)

- West Virginia existing production listings: **0** (verified live via `select count(*) ... where state='WV'`).
- No dedup avoid-list required — clean state.
- In-batch name|city|state duplicates: **0**.

## Expansion Readiness (`assessExpansion` vs live)

- ready-to-publish 1 / import-unpublished 1 / manual-review 0 / reject 0.
- slug collisions vs live production detail slugs: **0**; in-batch: 0.
- dup hits: **0**.
- Per-row verdicts: `data/imports/i70-west-virginia-batch-042-expansion-report.csv`.

## Quality (`scoreCompleteness`)

- min 52 / median 71 / mean 61.5 / max 71; Needs work 1, Good 1.
- The Dallas Pike Fuel Center is "Needs work" only because its exact street address/ZIP could not be verified — deliberately blank, not a data gap.

## Notes

- No coordinates supplied on any row (geocoding is a separate verified workflow), so 0 coordinate-validation issues by construction.
- I-70 traverses only West Virginia's ~14-mile northern panhandle through Wheeling; truck services cluster at a single interchange, Exit 11 (Dallas Pike). Both rows are on that exit.
- No Pilot/Love's/Petro/Flying J operate on this stretch, and no staffed weigh station could be confirmed — none were invented.
- **I-70 status:** MO, KS, CO, UT, IL, IN, OH, WV now covered as drafts. Remaining: PA and MD (both clean, 0 rows) complete I-70 to the Baltimore eastern terminus.
