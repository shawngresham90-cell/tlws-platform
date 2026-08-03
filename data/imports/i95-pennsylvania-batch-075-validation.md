# Batch 75 — I-95 Pennsylvania: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean. Master: total 21 / imported 21 / skipped 0 / duplicates 0 / errors 0. part1 (south) 10/10, part2 (north) 11/11.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Pennsylvania production)
- Pennsylvania existing production listings: **0** (verified live via Supabase; the I-70/I-80/I-90 PA batches are unmerged drafts). No dedup avoid-list vs live required.
- In-batch name|city|state duplicates: **0**. Cross-segment reconciliation: AAA School of Trucking (Philadelphia, 442 E Girard) kept once in the south; the north duplicate removed.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 15 / import-unpublished 6 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i95-pennsylvania-batch-075-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 44 / median 72 / mean 66.4 / max 76; Good 15, Needs work 6. (Needs-work rows are the milepost weigh station, mobile towing/wash operators and CDL schools that legitimately lack full address/amenity data.)

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- **One truck stop + one CAT scale on all of PA I-95:** Penn Jersey Diesel / Bensalem Travel Plaza (Exit 37), CAT Scale #1316. The Chester-to-Center-City stretch genuinely has neither — none fabricated.
- A TruckParkingClub-brokered private lot in Chester was excluded (0 TPC URLs / no affiliate codes, per standing standard).
- **I-95 status:** FL, GA, SC, NC, VA, MD, DE, PA now covered as drafts. Next northbound: New Jersey (Trenton → New Brunswick → Newark → GWB approach), then NY/CT/RI/MA/NH/ME to Maine.
