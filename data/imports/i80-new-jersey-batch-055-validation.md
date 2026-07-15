# Batch 55 — I-80 New Jersey: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + part1: 100% clean.
  - Master: total 8 / imported 8 / skipped 0 / duplicates 0 / errors 0. part1 identical.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live New Jersey production)
- New Jersey existing production listings: **0** (verified live). No dedup avoid-list required.
- In-batch name|city|state duplicates: **0**.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 2 / import-unpublished 6 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i80-new-jersey-batch-055-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 39 / median 43 / mean 49.1 / max 76; Good 2, Needs work 2, Incomplete 4.
- The low scores are the NJDOT rest-area/wayside parking rows and the weigh station — no street address/phone by nature — deliberately blank, not gaps.

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- I-80 in NJ is a dense suburban/urban corridor with essentially **one** true truck stop — TA Columbia (Exit 4), which carries the only CAT Scale on NJ I-80. Reported honestly, not padded.
- **Omitted, not fabricated:** no Pilot/Flying J/Love's on I-80 in NJ; no verifiable fixed truck wash/tire-repair/roadside facility (only regional mobile dispatch outfits, excluded); no hotel with truck parking tied to an I-80 exit.
- **I-80 status:** with NJ (eastern terminus at Teaneck) as a draft, only OH and PA remain in progress to complete the full I-80 corridor.
