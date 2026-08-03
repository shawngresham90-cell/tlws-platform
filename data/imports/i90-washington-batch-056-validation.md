# Batch 56 — I-90 Washington: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean. Master: total 31 / imported 31 / skipped 0 / duplicates 0 / errors 0. part1 (west) 16/16, part2 (east) 15/15.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Washington production)
- Washington existing production listings: **0** (verified live). No dedup avoid-list required.
- In-batch name|city|state duplicates: **0**. Ellensburg (Exits 106-109) cross-segment overlap reconciled — Love's #413, Pilot #1195, Broadway Flying J #965 kept once (West); East begins at Moses Lake.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 18 / import-unpublished 13 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i90-washington-batch-056-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 43 / median 69 / mean 63.8 / max 76; Good 18, Needs work 13.

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- The Seattle/Bellevue/Issaquah urban stretch has no true truck stops (big stops are on I-5/I-405); the first is TA Seattle East (North Bend Exit 34). Snoqualmie Pass is sparse.
- Two WSDOT rest areas with no town (Schrag MP198, Sprague Lake MP241) were assigned their nearest named locality (Ritzville / Sprague), noted in-description.
- **Omitted, not fabricated:** the old Ellensburg Pilot at 1512 Hwy 97 (now the Love's, not double-listed); Ryegrass Rest Area (no truck parking); Spokane stops on US-2/US-395.
- **I-90 status:** ID, WA covered as drafts. MT in progress; then east through WY/SD/MN/WI/IL and the I-90-only OH/PA-Erie/NY/MA stretches.
