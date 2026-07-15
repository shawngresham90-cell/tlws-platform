# Batch 61 — I-90 Minnesota: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean. Master: total 32 / imported 32 / skipped 0 / duplicates 0 / errors 0. part1 (west) 21/21, part2 (east) 11/11.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Minnesota production)
- Minnesota existing production listings: **0** (verified live via Supabase). No dedup avoid-list required.
- In-batch name|city|state duplicates: **0**. Cross-segment reconciliation at the Albert Lea I-90/I-35 junction: Love's #337 + its CAT scale each kept once (West); T&W Towing (same operator, Albert Lea base + Austin page) kept once (West).

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 15 / import-unpublished 17 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i90-minnesota-batch-061-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 43 / median 64 / mean 63.5 / max 76; Good 15, Needs work 17. (Needs-work rows are mostly rest areas, the weigh station, and convenience-store fuel stops that legitimately lack full amenity/phone data.)

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- Four CAT scales verified corridor-wide (Worthington Travel Plaza, Trail's/Petro Albert Lea, Love's Albert Lea, Kwik Trip Austin), each kept once after cross-segment dedup.
- The Albert Lea cluster (Trail's/Petro, Love's, their CAT scales, Trail's truck wash) sits at I-35 Exit 11 (1–2 mi off I-90); interstate kept I-90 with the junction noted in-description. Rochester items (Pomp's Tire, Rapid Roadside) serve I-90 via US-52 Exit 218.
- **Omitted, not fabricated:** no verifiable fixed weigh station on the Austin–Dresbach stretch; the unconfirmed Dexter "Lake Geo Travel Plaza"; a corridor CDL school; Austin Kwik Trip's reported truck wash.
- **I-90 status:** WA, ID, MT, WY, SD, MN now covered as drafts. Remaining east: WI, IL (Jane Addams tollway), and the I-90-only OH-east/PA-Erie/NY (Thruway)/MA (Mass Pike) stretches to Boston. (Indiana and OH-west skipped — covered under I-80 Batches 52–53 via the I-80/90 concurrency.)
