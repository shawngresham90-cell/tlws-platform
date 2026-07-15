# Batch 49 — I-80 Nebraska: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean.
  - Master: total 53 / imported 53 / skipped 0 / duplicates 0 / errors 0.
  - part1 (west): 25 / 25 / 0 / 0 / 0. part2 (east): 28 / 28 / 0 / 0 / 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Nebraska production)
- Nebraska existing production listings: **0** (verified live). No dedup avoid-list required.
- In-batch name|city|state duplicates: **0**. North Platte (Exit 179) cross-segment overlap reconciled — Love's #390, Flying J #687, and their CAT scales kept once (West). Sapp Bros locations disambiguated by city suffix.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 34 / import-unpublished 19 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i80-nebraska-batch-049-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 43 / median 71 / mean 64.3 / max 76; Good 34, Needs work 19.

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- Long Platte Valley freight corridor; Nebraska independents (Bosselman/Pilot Grand Island, Sapp Bros, Cubby's, Fat Dogs, Shoemaker's) feature alongside the national brands.
- **Omitted, not fabricated:** Sapp Bros Lincoln (on US-6, not an I-80 interchange); no Love's on I-80 in Lincoln (Shoemaker's is the genuine stop); no hotel with verified dedicated truck parking; Blue Beacon Grand Island/Shelton unverifiable (only York confirmed).
- **I-80 status:** CA/NV/UT/WY, IL, IA, IN, NE now covered as drafts. OH dedup + PA + NJ (completes I-80) to follow.
