# Batch 45 — I-80 California: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 3 parts: 100% clean.
  - Master: total 23 / imported 23 / skipped 0 / duplicates 0 / errors 0.
  - part1 (west/Bay Area): 5 / 5 / 0 / 0 / 0. part2 (central/Sacramento): 12 / 12 / 0 / 0 / 0. part3 (Sierra): 6 / 6 / 0 / 0 / 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live California production)
- California existing production listings: **0** (verified live). No dedup avoid-list required.
- In-batch name|city|state duplicates: **0**. Ramos Oil Dixon (Exit 66) cross-segment overlap reconciled before compile — kept once as Central's truck stop plus one clean co-located CAT-scale row; the West duplicate was dropped.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 10 / import-unpublished 13 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i80-california-batch-045-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 36 / median 64 / mean 61.8 / max 80; Good 10, Needs work 12, Incomplete 1.
- Lower scores are the CHP/Caltrans weigh stations, rest areas, and mobile tire/roadside providers (no street address/phone by nature) — deliberately blank.

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- The urban Bay Area stretch has essentially no true truck stops (first facilities appear at Fairfield/Vacaville); the Sierra/Donner Pass stretch is genuinely sparse — both reported honestly, not padded.
- Only mainline-I-80 facilities included; Sacramento-area stops on I-5/US-50/SR-99 excluded. Fabricated Love's locations from early search summaries were rejected.
- **I-80 status:** all four western states now covered as drafts — NV, UT, WY, CA. Remaining: NE, IA, IL, IN, OH, PA, NJ (IL/IN/OH will use the existing state-wide avoid-lists).
