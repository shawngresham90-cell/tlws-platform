# Batch 40 — I-70 Indiana: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)

- Master + 2 parts: 100% clean.
  - Master: total 20 / imported 20 / skipped 0 / duplicates 0 / errors 0.
  - part1 (west + Indianapolis): 12 / 12 / 0 / 0 / 0.
  - part2 (east): 8 / 8 / 0 / 0 / 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit fields (schema ≤20 chars; e.g. "149B" is within limit).

## Duplicate detection (vs live Indiana production)

- Indiana existing production listings: **99** — all on **I-65**.
- Compiled against all 99 live `importDupKey(name, city, IN)` keys: **0 collisions**.
- In-batch name|city|state duplicates: 0 (the Indianapolis researcher's Greenfield Pilot #30 duplicate was reconciled to the East segment before compile).
- Internal cross-segment dedup (west / Indianapolis / east): disjoint exit ranges (1–59, 77–91, 96–149B).

## Expansion Readiness (`assessExpansion` vs live)

- Run with the 99 existing IN keys **and** 99 existing IN detail slugs loaded.
- ready-to-publish 11 / import-unpublished 9 / manual-review 0 / reject 0.
- slug collisions vs live production detail slugs: **0**; in-batch: 0.
- Per-row verdicts: `data/imports/i70-indiana-batch-040-expansion-report.csv`.

## Quality (`scoreCompleteness`)

- min 53 / median 71 / mean 67.5 / max 76; Needs work 9, Good 11.

## Notes

- No coordinates supplied on any row (geocoding is a separate verified workflow), so 0 coordinate-validation issues by construction.
- **I-70 status:** MO, KS, CO, UT, IL, IN now covered as drafts. Remaining: OH (95) needs live dedup; WV, PA, MD are clean (0 rows) and complete the corridor to the Baltimore terminus.
