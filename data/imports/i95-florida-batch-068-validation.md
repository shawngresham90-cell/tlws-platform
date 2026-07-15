# Batch 68 — I-95 Florida: Validation Report (first I-95 batch)

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean. Master: total 54 / imported 54 / skipped 0 / duplicates 0 / errors 0. part1 (south) 19/19, part2 (north) 35/35.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Florida production)
- Florida existing production listings: **73** (verified live via Supabase), all on the I-75 corridor. Applied as an avoid-list (73 keys + 73 slugs).
- In-batch name|city|state duplicates: **0**. Live dup hits: **0** (no I-95 east-coast overlap). Cross-segment reconciliation at Fort Pierce (Exit 129): Pilot #90, Love's #415 and their two CAT scales consolidated once (South).

## Expansion Readiness (`assessExpansion` vs live + avoid-list)
- ready-to-publish 29 / import-unpublished 25 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i95-florida-batch-068-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 43 / median 69 / mean 62.0 / max 76; Good 29, Needs work 25. (Needs-work rows are rest areas, weigh/ag-inspection stations, mobile roadside operators and CDL schools that legitimately lack full address/amenity data.)

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- Nine distinct CAT scales verified corridor-wide. I-95/I-295 Jacksonville junction stops kept as I-95 with the I-295 exit noted.
- **Omitted, not fabricated:** I-75/Palmetto and Florida Turnpike facilities; no verifiable truck stops through the Miami/Fort Lauderdale/WPB core; WPB/Fort Lauderdale CDL schools not verifiably on I-95.
- **I-95 status:** Florida (east coast) now covered as a draft — first I-95 batch. Next northbound: Georgia (I-95, Savannah/Brunswick — dedup vs 82 live GA rows), then SC, NC, VA, and the northeastern states to Maine.
