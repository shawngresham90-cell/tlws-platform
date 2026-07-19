# Batch 81 — I-95 New Hampshire: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Single master file (corridor short): 100% clean. total 10 / imported 10 / skipped 0 / duplicates 0 / errors 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live New Hampshire production)
- New Hampshire existing production listings: **0** (verified live via Supabase). No dedup avoid-list required.
- In-batch name|city|state duplicates: **0**. TA Greenland (Greenland) and Exit 3 Travel Stop (Portsmouth) are distinct facilities at the same interchange.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 5 / import-unpublished 5 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i95-new-hampshire-batch-081-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 55 / median 65 / mean 67.7 / max 80; Good 5, Needs work 5. (Needs-work rows are the milepost weigh station, the state rest areas and independent stops with limited published amenity data.)

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- TA Greenland is the only full truck stop with a CAT scale on NH I-95. The Hampton rest areas currently have no fuel/food (planned redevelopment not yet built) — listed as parking, not fabricated as truck stops.
- **I-95 status:** completing the corridor — only Maine remains after this batch.
