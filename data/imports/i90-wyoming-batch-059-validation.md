# Batch 59 — I-90 Wyoming: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean. Master: total 24 / imported 24 / skipped 0 / duplicates 0 / errors 0. part1 (west) 10/10, part2 (east) 14/14.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Wyoming production)
- Wyoming existing production listings: **0** (verified live via Supabase). No dedup avoid-list required.
- In-batch name|city|state duplicates: **0**. Cross-segment reconciliation: Love's #965 (Buffalo Exit 58) and CAT Scale #3528 each returned by both segments under differently-normalized names — each kept once (West part).
- Separate from the I-80 Wyoming draft (Batch 48), which covers the southern cities (Evanston/Rock Springs/Rawlins/Cheyenne); no city overlap with this NE-corner corridor.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 6 / import-unpublished 18 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i90-wyoming-batch-059-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 43 / median 58 / mean 59.1 / max 76; Good 6, Needs work 18. (Lower median reflects the many rest-area/weigh-station/hotel rows that legitimately lack phone/address; truck stops score well.)

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- Only two CAT Scales verified corridor-wide (Love's Buffalo #3528, Flying J Gillette #762); an unconfirmed Common Cents Sheridan CAT claim was omitted.
- Wyoming ports of entry captured: Sheridan (~mile 16) and Sundance (Exit 189, westbound). No separate Beulah/SD-line POE building verified; the Beulah row is the Travel Wyoming welcome center.
- **Omitted, not fabricated:** no verifiable commercial truck wash on the corridor; closed Big Horn Travel Plaza (Buffalo); several Gillette oilfield tire/towing outfits without verifiable address+phone.
- **I-90 status:** WA, ID, MT, WY (western/northern states) now covered as drafts. Remaining east: SD, MN, WI, IL (Jane Addams tollway), and the I-90-only OH-east/PA-Erie/NY (Thruway)/MA (Mass Pike) stretches to Boston. (Indiana and OH-west skipped — already covered under I-80 Batches 52–53 via the I-80/90 concurrency.)
