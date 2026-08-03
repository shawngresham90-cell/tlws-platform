# Batch 64 — I-90 Ohio (east / lakefront): Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean. Master: total 21 / imported 21 / skipped 0 / duplicates 0 / errors 0. part1 (west) 4/4, part2 (east) 17/17.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Ohio production)
- Ohio existing production listings: **95** (verified live via Supabase), all on the I-75 corridor (Toledo/Findlay/Lima/Dayton/Cincinnati/Beaverdam/North Baltimore). Applied as an avoid-list (95 keys + 95 slugs).
- In-batch name|city|state duplicates: **0**. Live dup hits: **0** (no lakefront overlap). Cross-segment: no duplicates (west is Avon Exit 151; east is Geneva→Conneaut Exits 218–241).
- Distinct from the I-80/90 Ohio Turnpike draft (Batch 53) — this is the I-90-only lakefront north/east of the Elyria split.

## Expansion Readiness (`assessExpansion` vs live + avoid-list)
- ready-to-publish 17 / import-unpublished 4 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i90-ohio-east-batch-064-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 43 / median 70 / mean 67.7 / max 76; Good 17, Needs work 4.

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- Six distinct CAT scales verified corridor-wide (Avon Pilot #4; Austinburg Pilot #2 + Flying J #694; Kingsville TA; Conneaut Love's #389), each kept once. Austinburg Exit 223 genuinely has both a Pilot and a separate Flying J.
- The urban Cleveland core (Shoreway/Innerbelt) has no verifiable on-highway truck stops — none fabricated; the single west node is the Avon Exit 151 cluster.
- **Omitted, not fabricated:** I-80/90 Turnpike facilities south of the Elyria split; Mentor/Painesville truck stops; urban-core Cleveland stops.
- **I-90 status:** WA, ID, MT, WY, SD, MN, WI, IL, OH (lakefront) now covered as drafts. Remaining east: PA (Erie), NY (Thruway) and MA (Mass Pike) to the Boston terminus. (Indiana and the OH-west Turnpike skipped — covered under I-80 Batches 52–53 via the I-80/90 concurrency.)
