# Batch 47 — I-80 Utah: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean.
  - Master: total 18 / imported 18 / skipped 0 / duplicates 0 / errors 0.
  - part1 (west): 11 / 11 / 0 / 0 / 0. part2 (east): 7 / 7 / 0 / 0 / 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Utah production)
- Utah existing production listings: **0** (verified live). No dedup avoid-list required.
- In-batch name|city|state duplicates: **0**. West (Wendover→SLC Exit 118) and East (Coalville Exit 162→WY line) are geographically disjoint.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 8 / import-unpublished 10 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i80-utah-batch-047-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 43 / median 64 / mean 63.8 / max 76; Good 8, Needs work 10.
- Lower scores are the ports of entry, rest areas, and mobile repair providers (no street address/phone by nature) — deliberately blank.

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- The ~100-mile Wendover→Lake Point salt-flats stretch is genuinely near-serviceless (Delle Sinclair + two rest areas only) — reported honestly, not padded.
- The Grassy Mountain rest area (MM55) has no town; city recorded as **Clive** (nearest named I-80 locality, Tooele County) to satisfy the required city field.
- **I-80 status:** NV, UT covered as drafts. CA and WY next; then the eastern states.
