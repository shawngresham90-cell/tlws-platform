# Batch 46 — I-80 Nevada: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean.
  - Master: total 41 / imported 41 / skipped 0 / duplicates 0 / errors 0.
  - part1 (west, Verdi→Winnemucca): 24 / 24 / 0 / 0 / 0.
  - part2 (east, Battle Mountain→Wendover): 17 / 17 / 0 / 0 / 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Nevada production)
- Nevada existing production listings: **0** (verified live). No dedup avoid-list required.
- In-batch name|city|state duplicates: **0**. Winnemucca (Exit 176) cross-segment overlap reconciled before compile — Love's #797, Flying J #770, and their CAT scales kept once (West); East retains its unique Sixth Street truck wash.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 32 / import-unpublished 9 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i80-nevada-batch-046-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 36 / median 71 / mean 67.3 / max 76; Good 32, Needs work 7, Incomplete 2.
- The low/Incomplete scores are the DOT rest areas and the NHP mobile scale (no street address/phone by nature) — deliberately blank, not gaps.

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- Nevada operates **no fixed ports of entry**; enforcement is mobile via NHP, so only the one documentable NHP westbound scale near Halleck/Elko is listed.
- Known un-added: a TA at Mill City (Exit 149/151) was referenced but not returned with verified fields — omitted rather than fabricated; candidate for a later verified pass.
- **I-80 status:** NV covered as draft. CA, UT, WY in progress; then the eastern states.
