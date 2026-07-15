# Batch 53 — I-80 Ohio: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean.
  - Master: total 44 / imported 44 / skipped 0 / duplicates 0 / errors 0.
  - part1 (west): 20 / 20 / 0 / 0 / 0. part2 (east): 24 / 24 / 0 / 0 / 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Ohio production)
- Ohio existing production listings: **95** — all on **I-75**.
- Compiled against all 95 live `importDupKey(name, city, OH)` keys: **0 collisions**.
- In-batch name|city|state duplicates: **0**. West (IN line → Amherst/Elyria) and East (Broadview Heights → PA line) are disjoint across the I-90 split. The generic Perrysburg Pilot/Flying J were renamed with a city suffix.

## Expansion Readiness (`assessExpansion` vs live)
- Run with the 95 existing OH keys **and** 95 existing OH detail slugs loaded.
- ready-to-publish 26 / import-unpublished 18 / manual-review 0 / reject 0.
- slug collisions vs live production detail slugs: **0**; in-batch: 0. dup hits: **0**.
- Per-row verdicts: `data/imports/i80-ohio-batch-053-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 52 / median 69 / mean 66.5 / max 80; Good 26, Needs work 18.

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- I-80 in Ohio is the Ohio Turnpike (concurrent with I-90 to the Elyria split near Exit 142), then the Turnpike alone, then free I-80 east of Exit 218 (Youngstown/Girard/Hubbard). Interstate recorded as I-80; plazas use milepost labels.
- **Omitted, not fabricated:** Glacier Hills/Mahoning Valley plazas (MP237, on the I-76 portion, not I-80); no "Fallen Timbers" plaza exists on the current Turnpike list.
- **I-80 status:** CA/NV/UT/WY, NE, IA, IL, IN, OH, NJ now covered as drafts. Only PA remains to complete the full corridor.
