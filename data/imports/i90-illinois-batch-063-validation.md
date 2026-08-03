# Batch 63 — I-90 Illinois: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean. Master: total 17 / imported 17 / skipped 0 / duplicates 0 / errors 0. part1 (west) 13/13, part2 (east) 4/4.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Illinois production)
- Illinois existing production listings: **12** (verified live via Supabase), all in Metropolis/Vienna on the far-southern I-24 corridor. Applied as an avoid-list (12 keys + 12 slugs).
- In-batch name|city|state duplicates: **0**. Live dup hits: **0** (no city overlap with the northern I-90 corridor). Cross-segment: no duplicates (west's Pomp's is Rockford, east's is Elgin).
- Distinct from the I-80 IL draft (Joliet/south suburbs/south Chicago) and the I-70 IL work (St. Louis metro/Effingham).

## Expansion Readiness (`assessExpansion` vs live + avoid-list)
- ready-to-publish 13 / import-unpublished 4 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i90-illinois-batch-063-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 55 / median 69 / mean 66.4 / max 71; Good 13, Needs work 4. (The 4 Needs-work rows are the east-segment roadside/wash operators that legitimately lack exit numbers on the urban stretch.)

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- The dense Chicago urban stretch (Kennedy I-90/94 and the Chicago Skyway) has no verifiable on-highway truck stops, oases or fixed weigh stations — none fabricated. Real facilities concentrate at Hampshire Exit 42, South Beloit and Rockford.
- Off-corridor near-I-90 facilities reached via the US-20 freeway (south-Rockford Pilot, Pomp's, Meiborg, Rock Valley) noted in-description with exit blank; the Belvidere Oasis is an over-the-highway tollway plaza.
- **I-90 status:** WA, ID, MT, WY, SD, MN, WI, IL now covered as drafts. Remaining east: the I-90-only stretches of OH (Elyria→Cleveland→PA line), PA (Erie), NY (Thruway) and MA (Mass Pike) to Boston. (Indiana and OH-west skipped — covered under I-80 Batches 52–53 via the I-80/90 concurrency.)
