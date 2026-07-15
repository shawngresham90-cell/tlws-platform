# Batch 70 — I-95 South Carolina: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean. Master: total 47 / imported 47 / skipped 0 / duplicates 0 / errors 0. part1 (south) 20/20, part2 (north) 27/27.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live South Carolina production)
- South Carolina existing production listings: **0** (verified live via Supabase). No dedup avoid-list required.
- In-batch name|city|state duplicates: **0**. Cross-segment reconciliation at Santee (MM 99): south's combined rest-area/welcome-center row dropped in favor of north's two granular rows.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 23 / import-unpublished 24 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i95-south-carolina-batch-070-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 38 / median 64 / mean 61.9 / max 76; Good 23, Needs work 23, Incomplete 1. (Needs-work/Incomplete rows are rest areas, aggregator-sourced hotels and mobile roadside operators that legitimately lack full address/amenity data.)

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- Twelve distinct CAT scales verified corridor-wide, each kept once. The Florence I-95/US-52 hub genuinely has four branded truck stops (Pilot #337, Petro/TA #195, Love's #420, Pilot #62).
- **Omitted, not fabricated:** no verifiable Santee Exit 98 branded truck stop; no fixed staffed I-95 weigh station in the north segment; the Point South Exit 33 "cluster" (hotels/campground only, no truck stop).
- **I-95 status:** FL, GA, SC now covered as drafts. Next northbound: NC (dedup vs 45 live), VA, then the northeastern states (DC/MD/DE/PA/NJ/NY/CT/RI/MA/NH/ME).
