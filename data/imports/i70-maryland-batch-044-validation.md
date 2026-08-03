# Batch 44 — I-70 Maryland: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.
**This batch completes I-70** (Utah/Cove Fort → Baltimore terminus).

## Import parser (`prepareImport`)

- Master + 2 parts: 100% clean.
  - Master: total 11 / imported 11 / skipped 0 / duplicates 0 / errors 0.
  - part1 (west): 7 / 7 / 0 / 0 / 0.
  - part2 (east): 4 / 4 / 0 / 0 / 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit fields (schema ≤20 chars).
- Column width 20 on every row.

## Duplicate detection (vs live Maryland production)

- Maryland existing production listings: **0** (verified live via `select count(*) ... where state='MD'`).
- No dedup avoid-list required — clean state.
- **Cross-segment reconciliation:** the New Market Weigh & Inspection Facility was returned by both researchers (West as "New Market Weigh & Inspection Facility", East with a "(TWIS)" suffix). Because the two names normalize to different keys, the duplicate was removed **manually** — the East "(TWIS)" variant was dropped and the facility appears **once** (West segment). Post-reconciliation the compile confirms 0 internal duplicate keys.

## Expansion Readiness (`assessExpansion` vs live)

- ready-to-publish 4 / import-unpublished 7 / manual-review 0 / reject 0.
- slug collisions vs live production detail slugs: **0**; in-batch: 0.
- dup hits: **0**.
- Per-row verdicts: `data/imports/i70-maryland-batch-044-expansion-report.csv`.

## Quality (`scoreCompleteness`)

- min 32 / median 64 / mean 57.2 / max 70; Needs work 6, Good 4, Incomplete 1.
- The one "Incomplete" and the low minimum are the government/parking facilities (South Mountain welcome centers, Mount Airy truck rest area, weigh station) that legitimately have no street address/phone/website — deliberately blank, not a data gap.

## Notes

- No coordinates supplied on any row (geocoding is a separate verified workflow), so 0 coordinate-validation issues by construction.
- The Frederick-to-Baltimore stretch has essentially no branded travel centers; tire/road-service operators (STTC, Butler Tire, Derek's Towing) that cover the I-70 corridor are included there instead.
- **Omitted, not fabricated:** Love's Hagerstown (on I-81 Exit 10A, not I-70) and the Hancock Truck Plaza (conflicting "closed" signals). Pilot #179 sits at the shared I-70/I-81 interchange; its I-70 exit is left blank rather than assert an unverified number.
- **I-70 status: COMPLETE.** MO, KS, CO, UT, IL, IN, OH, WV, PA, MD all covered as drafts — the full corridor from the western terminus at I-15 (Cove Fort, UT) to the eastern terminus at I-695 near Baltimore.
