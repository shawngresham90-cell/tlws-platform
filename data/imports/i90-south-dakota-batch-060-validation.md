# Batch 60 — I-90 South Dakota: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 3 parts: 100% clean. Master: total 60 / imported 60 / skipped 0 / duplicates 0 / errors 0. part1 (west) 21/21, part2 (central) 22/22, part3 (east) 17/17.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live South Dakota production)
- South Dakota existing production listings: **0** (verified live via Supabase). No dedup avoid-list required.
- In-batch name|city|state duplicates: **0**. Cross-segment reconciliation: Kadoka Discount Fuel (Exit 150) kept once (West); the Mitchell Cubby's (Exit 330), I-90 Travel Center (Exit 332) and its CAT scale each kept once (Central); the distinct co-located I-90 TC truck wash, Larry's I-90 Service and Super 8 Mitchell kept in East.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 23 / import-unpublished 37 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i90-south-dakota-batch-060-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 36 / median 64 / mean 60.7 / max 76; Good 23, Needs work 36, Incomplete 1. (The single Incomplete and the Needs-work rows are mostly rest areas / weigh stations / hotels that legitimately lack phone/address; branded truck stops score well.)

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- Seven distinct CAT scales verified corridor-wide (Bosselman + Flying J Rapid City, Love's Box Elder, Pilot Murdo, I-90 TC Mitchell, Love's + Flying J Sioux Falls); each kept once after cross-segment dedup.
- Ports of entry: Tilford (EB, ~MP 39) and Valley Springs (Exit 410, MN line). No central-segment POE. Flying J #716 + its CAT scale + Jim & Ron's sit at I-29 Exit 83 (I-90/I-29 junction), interstate kept I-90 with the junction noted in-description.
- **Omitted, not fabricated:** no verifiable TA/Petro on SD I-90 (the Exit 399 facility is a Love's); Sioux Falls stops deep on I-29/I-229; Alexandria/Kennebec small-town stations without verifiable truck parking; the permanently-closed Tilford information center.
- **I-90 status:** WA, ID, MT, WY, SD now covered as drafts. Remaining east: MN, WI, IL (Jane Addams tollway), and the I-90-only OH-east/PA-Erie/NY (Thruway)/MA (Mass Pike) stretches to Boston. (Indiana and OH-west skipped — covered under I-80 Batches 52–53 via the I-80/90 concurrency.)
