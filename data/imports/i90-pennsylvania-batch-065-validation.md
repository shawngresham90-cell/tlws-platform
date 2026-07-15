# Batch 65 — I-90 Pennsylvania: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- 100% clean. Master: total 16 / imported 16 / skipped 0 / duplicates 0 / errors 0. Single segment (part1 = master).
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Pennsylvania production)
- Pennsylvania existing production listings: **0** (verified live via Supabase). No dedup avoid-list required.
- In-batch name|city|state duplicates: **0**.
- Distinct from the I-80 PA draft (central: Clarion/DuBois/Stroudsburg) and the I-70 PA draft (SW: Washington/New Stanton/Breezewood) — the Erie corner has no city overlap with either.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 8 / import-unpublished 8 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i90-pennsylvania-batch-065-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 43 / median 69 / mean 61.2 / max 76; Good 8, Needs work 8. (Needs-work rows are the welcome centers, weigh station, mobile-repair and CDL schools that legitimately lack full address/amenity data.)

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- Two distinct CAT scales verified (Erie Pilot #311, Harborcreek TA #215), each kept once.
- Milepost welcome centers (West Springfield EB, North East WB) and the West Springfield EB weigh station left exit blank with MM noted in-description.
- **Omitted, not fabricated:** the "Love's #820 Exit 41" in some summaries is in Waterloo NY (NY Thruway), not PA — excluded.
- **I-90 status:** WA, ID, MT, WY, SD, MN, WI, IL, OH (lakefront), PA now covered as drafts. Remaining east: NY (Thruway) and MA (Mass Pike) to the Boston terminus. (Indiana and the OH-west Turnpike skipped — covered under I-80 Batches 52–53 via the I-80/90 concurrency.)
