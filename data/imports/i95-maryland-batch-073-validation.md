# Batch 73 — I-95 Maryland: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean. Master: total 38 / imported 38 / skipped 0 / duplicates 0 / errors 0. part1 (south) 13/13, part2 (north) 25/25.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Maryland production)
- Maryland existing production listings: **0** (verified live via Supabase; the I-70 MD batch is an unmerged draft, never imported). No dedup avoid-list vs live required.
- In-batch name|city|state duplicates: **0**. Cross-segment reconciliation: BBT & Recovery (one operator, phone 410-789-9800) kept once in the south; the north Aberdeen duplicate dropped. TA Baltimore South #151 (Jessup) and TA Baltimore #216 are distinct locations.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 29 / import-unpublished 9 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i95-maryland-batch-073-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 48 / median 71 / mean 68.6 / max 76; Good 30, Needs work 8. (Highest median so far — the JFK Highway's branded truck stops carry full addresses and amenities. Needs-work rows are milepost weigh stations, mobile roadside operators and CDL schools that legitimately lack full address/amenity data.)

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- Six distinct CAT scales verified corridor-wide, each kept once. No CAT scale fabricated for the MDTA median service plazas (catscale.com does not list one there).
- The dense DC/Baltimore-suburb stretch genuinely has few truck stops — TA Baltimore South (Jessup) is the only full-service travel center in the southern half; nothing fabricated to pad it.
- I-95 does not run a mainline through Washington DC (it bypasses via the eastern Capital Beltway), so DC-area facilities appear under this MD batch.
- **I-95 status:** FL, GA, SC, NC, VA, MD now covered as drafts. Next northbound: Delaware (short I-95 Newark→Wilmington→PA line), then PA/NJ/NY/CT/RI/MA/NH/ME to Maine (each deduped vs live where applicable).
