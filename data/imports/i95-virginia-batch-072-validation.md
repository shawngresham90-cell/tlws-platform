# Batch 72 — I-95 Virginia: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean. Master: total 47 / imported 47 / skipped 0 / duplicates 0 / errors 0. part1 (south) 23/23, part2 (north) 24/24.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Virginia production)
- Virginia existing production listings: **0** (verified live via Supabase). No dedup avoid-list required.
- In-batch name|city|state duplicates: **0**. Cross-segment boundary clean — south tops out at Richmond Exit 74, north starts at Ashland Exit 89; no city overlap between segments.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 19 / import-unpublished 28 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i95-virginia-batch-072-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 45 / median 61 / mean 62.9 / max 76; Good 20, Needs work 27. (Needs-work rows are rest areas, milepost weigh stations, the aggregator-sourced hotel and mobile roadside/CDL operators that legitimately lack full address/amenity data.)

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- Eight distinct CAT scales verified corridor-wide (Pilot Skippers, Simmons Emporia, Pilot/Sadler's Emporia, TA Express Stony Creek, Pilot Colonial Heights, Flying J Carmel Church, Love's Ruther Glen, TA Ashland), each kept once.
- **Northern Virginia truck stops are genuinely scarce:** the dense-urban Woodbridge/Springfield/Alexandria stretch is represented only by rest areas, weigh stations, tire/repair, CDL schools and a hotel — no truck stops fabricated to fill it.
- **I-95 status:** FL, GA, SC, NC, VA now covered as drafts. Next northbound: the DC/Maryland/Delaware corridor, then PA/NJ/NY/CT/RI/MA/NH/ME to Maine (each deduped vs live where applicable).
