# Batch 82 — I-95 Maine: Validation Report — COMPLETES I-95

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean. Master: total 42 / imported 42 / skipped 0 / duplicates 0 / errors 0. part1 (south) 22/22, part2 (north) 20/20.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Maine production)
- Maine existing production listings: **0** (verified live via Supabase). No dedup avoid-list required.
- In-batch name|city|state duplicates: **0**. Cross-segment boundary clean at Augusta (Exit 113); NTI Scarborough and NTI Bangor are distinct campuses.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 27 / import-unpublished 15 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i95-maine-batch-082-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 54 / median 69 / mean 66.8 / max 76; Good 29, Needs work 13. (Needs-work rows are milepost weigh stations/rest areas, mobile roadside operators and service-plaza rows that carry milepost/no-street addresses.)

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- Four CAT scales corridor-wide (Irving Kittery, Auburn Irving #1196, Fairfield Irving, Houlton Irving). Dysart's Hermon "certified scales" not confirmed CAT-branded — no CAT row fabricated.
- Bangor/Hermon is the northern freight hub (Dysart's + Irving Big Stops); no national chain (TA/Pilot) currently operates the northern segment — none fabricated. Houlton Irving (Exit 302) is the last stop before the Canadian border.
- **I-95 CORRIDOR COMPLETE:** FL, GA, SC, NC, VA, MD, DE, PA, NJ, NY, CT, RI, MA, NH, ME — all 15 I-95 states now covered as drafts, from Miami to the Houlton/Canada terminus.
