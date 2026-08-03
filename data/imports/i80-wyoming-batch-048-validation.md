# Batch 48 — I-80 Wyoming: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean.
  - Master: total 41 / imported 41 / skipped 0 / duplicates 0 / errors 0.
  - part1 (west): 21 / 21 / 0 / 0 / 0. part2 (east): 20 / 20 / 0 / 0 / 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Wyoming production)
- Wyoming existing production listings: **0** (verified live). No dedup avoid-list required.
- In-batch name|city|state duplicates: **0**. Rawlins (Exits 209/214) cross-segment overlap reconciled before compile — TA Rawlins, Flying J #763, the Rawlins weigh station, and the Flying J CAT scale are each included once (West); East retains only its unique TA Truck Service Rawlins listing.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 27 / import-unpublished 14 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i80-wyoming-batch-048-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 43 / median 70 / mean 66.2 / max 80; Good 27, Needs work 14.
- Lower scores are the WYDOT rest areas / truck-parking areas and ports of entry (no street address/phone by nature) — deliberately blank.

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- The Cheyenne I-80/I-25 interchange cluster (Flying J #759, Love's #220, Blue Beacon) is signed I-25 Exit 7 but serves I-80 freight; those rows carry a blank I-80 exit_number and say so in-description rather than assert an unverified exit.
- **I-80 status:** NV, UT, WY covered as drafts. California (Batch 45) is the remaining western state; then the eastern states (NE, IA, IL, IN, OH, PA, NJ).
