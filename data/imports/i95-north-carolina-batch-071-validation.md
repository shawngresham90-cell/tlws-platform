# Batch 71 — I-95 North Carolina: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean. Master: total 44 / imported 44 / skipped 0 / duplicates 0 / errors 0. part1 (south) 22/22, part2 (north) 22/22.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live North Carolina production)
- North Carolina existing production listings: **45** — all on the I-40 corridor (western/mountain NC). Full 45-key + 45-slug avoid-list loaded.
- Live name|city|state collisions: **0** (I-95 eastern NC has zero overlap with the I-40 western-NC rows).
- In-batch name|city|state duplicates: **0**. Cross-segment boundary clean — north's southernmost entries (Smithfield Exit 95, Selma rest area MM 99) sit above south's Dunn Exit 77.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 18 / import-unpublished 26 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i95-north-carolina-batch-071-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 47 / median 64 / mean 63.2 / max 76; Good 18, Needs work 26. (Needs-work rows are rest areas, milepost weigh stations, aggregator-sourced hotels and mobile roadside/CDL operators that legitimately lack full address/amenity data.)

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- Five distinct CAT scales verified corridor-wide (Love's Dunn, Pilot Dunn, Kenly 95 complex, Flying J Kenly, Pilot/ONE9 Pleasant Hill), each kept once.
- Kenly 95 (Exit 106) genuinely hosts three branded truck stops (Petro #395, Pilot #6990, Flying J #683) — each kept once, mirroring the Florence SC hub.
- **Love's #412 = Dunn NC** (verified loves.com/nc/dunn URL), consistent with Batch 70's rejection of a stale "Love's #412" at St. George SC.
- **I-95 status:** FL, GA, SC, NC now covered as drafts. Next northbound: VA (live dedup TBD), then the northeastern states (DC/MD/DE/PA/NJ/NY/CT/RI/MA/NH/ME) to Maine.
