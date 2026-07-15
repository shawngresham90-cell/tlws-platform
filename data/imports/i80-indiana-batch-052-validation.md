# Batch 52 — I-80 Indiana: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean.
  - Master: total 32 / imported 32 / skipped 0 / duplicates 0 / errors 0.
  - part1 (Borman): 19 / 19 / 0 / 0 / 0. part2 (Toll Road): 13 / 13 / 0 / 0 / 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Indiana production)
- Indiana existing production listings: **99** — all on **I-65**.
- Compiled against all 99 live `importDupKey(name, city, IN)` keys: **0 collisions**.
- In-batch name|city|state duplicates: **0**. The Blue Beacon Lake Station truck wash (returned by both segment researchers at the Lake Station split) was reconciled to the Borman segment before compile.

## Expansion Readiness (`assessExpansion` vs live)
- Run with the 99 existing IN keys **and** 99 existing IN detail slugs loaded.
- ready-to-publish 22 / import-unpublished 10 / manual-review 0 / reject 0.
- slug collisions vs live production detail slugs: **0**; in-batch: 0. dup hits: **0**.
- Per-row verdicts: `data/imports/i80-indiana-batch-052-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 56 / median 71 / mean 68.3 / max 76; Good 22, Needs work 10.

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- I-80 in Indiana never runs on its own alignment: concurrent with I-94 (Borman Expressway, Hammond→Lake Station) then I-90 (Indiana Toll Road, Lake Station→Ohio line). Interstate recorded as I-80. Toll-road service plazas use mile-marker labels in exit_number (mainline access, no numbered exit).
- **Omitted, not fabricated:** Love's Elkhart and Gallop's Goshen (both on the US-20 bypass, not the toll road); no verifiable state weigh station on the toll-road concurrency.
- **I-80 status:** CA/NV/UT/WY, IL, IA, IN now covered as drafts. NE ready; OH dedup + PA + NJ (completes I-80) to follow.
