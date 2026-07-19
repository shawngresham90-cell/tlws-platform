# Batch 78 — I-95 Connecticut: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean. Master: total 36 / imported 36 / skipped 0 / duplicates 0 / errors 0. part1 (south) 18/18, part2 (east) 18/18.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Connecticut production)
- Connecticut existing production listings: **0** (verified live via Supabase). No dedup avoid-list required.
- In-batch name|city|state duplicates: **0**. Cross-segment boundary clean at New Haven; no service-plaza or CAT-scale overlap. Bud's (Bridgeport) listed once; the Pilot Milford CAT-scale row renamed to drop a conflicting store number.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 16 / import-unpublished 20 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i95-connecticut-batch-078-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 48 / median 61 / mean 63.9 / max 76; Good 16, Needs work 20. (Needs-work rows are the state service plazas — which carry milepost/no-street addresses — plus milepost weigh stations, mobile roadside operators and hotels that legitimately lack full amenity data.)

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- Three CAT scales corridor-wide (Pilot Milford, TA Branford, American Auto Stop North Stonington). No CAT scale fabricated for the state service plazas (catscale.com lists none).
- The CT I-95 service plazas (Darien, Milford, Branford, Madison, North Stonington) are the backbone truck-stop/parking facilities alongside Pilot Milford, TA Branford and American Auto Stop.
- **I-95 status:** FL, GA, SC, NC, VA, MD, DE, PA, NJ, NY, CT now covered as drafts. Next northbound: Rhode Island (Pawcatuck → Providence → MA line), then MA/NH/ME to Maine — completing I-95.
