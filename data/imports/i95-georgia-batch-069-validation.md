# Batch 69 — I-95 Georgia: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean. Master: total 41 / imported 41 / skipped 0 / duplicates 0 / errors 0. part1 (south) 21/21, part2 (north) 20/20.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Georgia production)
- Georgia existing production listings: **82** (verified live via Supabase), all on the I-75 corridor + Atlanta metro + I-24 Wildwood. Applied as an avoid-list (82 keys + 82 slugs).
- In-batch name|city|state duplicates: **0**. Live dup hits: **0** (no I-95 coast overlap). No cross-segment duplicates (south ends at Midway Exit 76, north starts at Richmond Hill Exit 87).

## Expansion Readiness (`assessExpansion` vs live + avoid-list)
- ready-to-publish 21 / import-unpublished 20 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i95-georgia-batch-069-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 43 / median 69 / mean 62.6 / max 76; Good 21, Needs work 20.

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- Ten distinct CAT scales verified corridor-wide, each kept once. Georgia has welcome centers at both ends (Kingsland NB, Port Wentworth SB), listed separately.
- Pilot #575 St. Marys website blanked (apostrophe-containing URL would fail validation).
- **Omitted, not fabricated:** I-75 Georgia/Atlanta facilities; Sapp Bros (I-80 chain); unverified Darien "JP Travel Center"; Brunswick Exit 36/38 Shell; Pooler/Port Wentworth hotels without verified truck parking.
- **I-95 status:** FL, GA now covered as drafts. Next northbound: SC (0 live), NC (dedup vs 45 live), VA, then the northeastern states to Maine.
