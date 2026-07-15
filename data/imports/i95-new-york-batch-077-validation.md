# Batch 77 — I-95 New York: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Single master file (corridor short/dense): 100% clean. total 9 / imported 9 / skipped 0 / duplicates 0 / errors 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live New York production)
- New York existing production listings: **0** (verified live via Supabase; the I-90 NY Thruway batch is an unmerged draft). No dedup avoid-list vs live required.
- In-batch name|city|state duplicates: **0**.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 5 / import-unpublished 4 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i95-new-york-batch-077-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 54 / median 70 / mean 67.2 / max 80; Good 5, Needs work 4. (Needs-work rows are tire/wash shops and mobile operators that legitimately lack full amenity data.)

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- **NY I-95 genuinely has no truck stops, CAT scales, weigh stations or truck parking** — the dense Bronx/Westchester corridor and the service-area-free New England Thruway mean coverage is tire/repair, heavy towing, a truck wash and CDL schools. None fabricated.
- **I-95 status:** FL, GA, SC, NC, VA, MD, DE, PA, NJ, NY now covered as drafts. Next northbound: Connecticut (Greenwich → Stamford → Bridgeport → New Haven → New London → RI line), then RI/MA/NH/ME to Maine.
