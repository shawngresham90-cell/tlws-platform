# Batch 41 — I-70 Ohio: Validation Report

All checks run 2026-07-14 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)

- Master + 2 parts: 100% clean.
  - Master: total 22 / imported 22 / skipped 0 / duplicates 0 / errors 0.
  - part1 (west + Columbus): 13 / 13 / 0 / 0 / 0.
  - part2 (east): 9 / 9 / 0 / 0 / 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit fields (schema ≤20 chars).

## Duplicate detection (vs live Ohio production)

- Ohio existing production listings: **95** — all on **I-75**.
- Compiled against all 95 live `importDupKey(name, city, OH)` keys: **0 collisions**.
- The Vandalia Flying J #97 (shared I-70/I-75 interchange) was deliberately not re-added — it stays in its existing I-75 listing.
- In-batch name|city|state duplicates: 0. The Columbus researcher's Flying J #699 and TA Hebron #39 duplicates were reconciled to the East segment before compile; the unique TA Truck Service - Hebron was moved to East.
- Internal cross-segment dedup (west / Columbus / east): disjoint after reconciliation (≤59, 79–118, 122–208).

## Expansion Readiness (`assessExpansion` vs live)

- Run with the 95 existing OH keys **and** 95 existing OH detail slugs loaded.
- ready-to-publish 13 / import-unpublished 9 / manual-review 0 / reject 0.
- slug collisions vs live production detail slugs: **0**; in-batch: 0.
- Per-row verdicts: `data/imports/i70-ohio-batch-041-expansion-report.csv`.

## Quality (`scoreCompleteness`)

- min 47 / median 65 / mean 64.2 / max 76; Needs work 9, Good 13.

## Notes

- No coordinates supplied on any row (geocoding is a separate verified workflow), so 0 coordinate-validation issues by construction.
- The New Paris state-line cluster carries a blank Ohio `exit_number` (reached via the Indiana Exit 156B / US-40 interchange) — a deliberate accuracy choice, not a data gap.
- **I-70 status:** MO, KS, CO, UT, IL, IN, OH now covered as drafts. Remaining: WV, PA, MD are clean (0 rows) and complete I-70 to the Baltimore eastern terminus.
