# Batch 74 — I-95 Delaware: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Single master file (corridor too short to split): 100% clean. total 10 / imported 10 / skipped 0 / duplicates 0 / errors 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Delaware production)
- Delaware existing production listings: **0** (verified live via Supabase). No dedup avoid-list required.
- In-batch name|city|state duplicates: **0**.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 6 / import-unpublished 4 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i95-delaware-batch-074-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 44 / median 65 / mean 61.5 / max 70; Good 6, Needs work 4. (Needs-work rows are the milepost weigh station, the mobile truck wash/towing operators and CDL schools that legitimately lack full amenity data.)

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- No CAT scale on DE I-95 (catscale.com lists none on this stretch) — none fabricated.
- The Biden Welcome Center (MM 5) is the only on-corridor travel plaza; the big Elkton MD travel centers (Batch 73) are not double-listed here.
- **I-95 status:** FL, GA, SC, NC, VA, MD, DE now covered as drafts. Next northbound: Pennsylvania (Philadelphia/Bucks County stretch to the NJ line at Trenton), then NJ/NY/CT/RI/MA/NH/ME to Maine.
