# Batch 36 — I-70 Kansas: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)

- Master + 2 parts: 100% clean.
  - Master: total 24 / imported 24 / skipped 0 / duplicates 0 / errors 0.
  - part1 (west + central): 16 / 16 / 0 / 0 / 0.
  - part2 (east): 8 / 8 / 0 / 0 / 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit fields (schema ≤20 chars — the two Kansas Turnpike milepost service areas were normalized to blank `exit_number`, milepost kept in the description).

## Expansion Readiness (`assessExpansion` vs live)

- ready-to-publish 16 / import-unpublished 8 / manual-review 0 / reject 0; slug collisions 0.
- Per-row verdicts: `data/imports/i70-kansas-batch-036-expansion-report.csv`.

## Duplicate detection

- Kansas / I-70 existing production listings: **0** (first coverage of this state). vs live 0; in-batch name|city|state duplicates 0; in-batch slug duplicates 0.
- Internal cross-segment dedup (west / central / east): 0 dropped — disjoint exit ranges (17–76, 127–253, 272–298).
- Note: "24/7 Travel Store" appears in four cities (Russell, Hays, WaKeeney, Goodland); each is a distinct name|city|state key, so no false dedup.

## Quality (`scoreCompleteness`)

- min 45 / median 71 / mean 66.7 / max 80; Needs work 8, Good 16.

## Slug-collision detection

- vs live production detail slugs: 0; in-batch: 0.

## Notes

- No coordinates supplied on any row (geocoding is a separate verified workflow), so 0 coordinate-validation issues by construction.
- 8 held (import-unpublished) rows import cleanly but lack a verified address/exit (weigh stations, Turnpike mileposts, Shell address); blank was kept over any guess.
- I-70 state audit (for future batches): OH (95), IN (99), IL (12) have existing production rows and will require live dedup; MD, PA, WV, CO, UT are clean (0 rows). MO and KS now covered as drafts.
