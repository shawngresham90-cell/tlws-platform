# Batch 50 — I-80 Iowa: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean.
  - Master: total 36 / imported 36 / skipped 0 / duplicates 0 / errors 0.
  - part1 (west): 23 / 23 / 0 / 0 / 0. part2 (east): 13 / 13 / 0 / 0 / 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Iowa production)
- Iowa existing production listings: **0** (verified live). No dedup avoid-list required.
- In-batch name|city|state duplicates: **0**. Newton (Exit 168) cross-segment overlap reconciled — Love's #361 and its CAT scale kept once (West). The two same-named Walcott Pilots were disambiguated by street address (3500 vs 2975 N Plainview Rd).

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 21 / import-unpublished 15 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i80-iowa-batch-050-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 46 / median 71 / mean 65.7 / max 76; Good 21, Needs work 15.

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- Home of the Iowa 80 Truckstop at Walcott (Exit 284) — captured with its CAT scale, Truckomat + Blue Beacon washes, TA truck-service center, and adjacent Days Inn.
- Council Bluffs / Des Moines clusters sit on the I-80/I-29 and I-80/I-35 concurrencies; exit designations note the shared routing.
- **Omitted, not fabricated:** Wings America (Avoca, closed Jan 2026); Grinnell Kum & Go (closed/unverifiable); only the Van Meter (EB) and Jasper (WB) I-80 scales verified.
- **I-80 status:** CA/NV/UT/WY, IL, IA now covered as drafts. NE, IN ready; OH dedup + PA/NJ to follow.
