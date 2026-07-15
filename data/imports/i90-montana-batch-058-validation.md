# Batch 58 — I-90 Montana: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 3 parts: 100% clean. Master: total 51 / imported 51 / skipped 0 / duplicates 0 / errors 0. part1 (west) 14/14, part2 (central) 19/19, part3 (east) 18/18.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Montana production)
- Montana existing production listings: **0** (verified live). No dedup avoid-list required.
- In-batch name|city|state duplicates: **0**. Cross-segment reconciliation: Fic's Plaza (Deer Lodge Exit 184) kept once (West); the Big Timber Town Pump (Exit 367) kept once (Central); East begins at Columbus. The four Pomp's Tire locations were disambiguated by city suffix.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 25 / import-unpublished 26 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i90-montana-batch-058-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 43 / median 64 / mean 62.6 / max 76; Good 25, Needs work 26.

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- Independent Town Pump (Montana-owned) operates most Pilot/Flying J-branded plazas. Butte/Rocker (Exit 122) facilities sit on the I-90/I-15 concurrency (labeled I-90 Exit 122 per directories); interstate kept I-90, concurrency noted in-description.
- Two blank-city West rest areas (Dena Mora/Lookout Pass, Quartz Flats) assigned nearest named localities (Saltese/Superior).
- **Omitted, not fabricated:** no Love's between Missoula and Laurel; the Bozeman Town Pump address/exit unverified (blank); mobile-only tire/repair dispatch networks.
- **I-90 status:** ID, WA, MT (western states) now covered as drafts. Remaining: WY, SD, MN, WI, IL, and the I-90-only OH/PA-Erie/NY/MA stretches east to Boston.
