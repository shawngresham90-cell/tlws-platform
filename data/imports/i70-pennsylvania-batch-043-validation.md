# Batch 43 — I-70 Pennsylvania: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)

- Master + 2 parts: 100% clean.
  - Master: total 13 / imported 13 / skipped 0 / duplicates 0 / errors 0.
  - part1 (west): 6 / 6 / 0 / 0 / 0.
  - part2 (east): 7 / 7 / 0 / 0 / 0.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit fields (schema ≤20 chars).
- Column width 20 on every row.

## Duplicate detection (vs live Pennsylvania production)

- Pennsylvania existing production listings: **0** (verified live via `select count(*) ... where state='PA'`).
- No dedup avoid-list required — clean state.
- In-batch name|city|state duplicates: **0**. West (exits 17–49) and East (exits 110–161) are geographically disjoint; no cross-segment collisions.

## Expansion Readiness (`assessExpansion` vs live)

- ready-to-publish 4 / import-unpublished 9 / manual-review 0 / reject 0.
- slug collisions vs live production detail slugs: **0**; in-batch: 0.
- dup hits: **0**.
- Per-row verdicts: `data/imports/i70-pennsylvania-batch-043-expansion-report.csv`.

## Quality (`scoreCompleteness`)

- min 45 / median 58 / mean 57.4 / max 71; Needs work 9, Good 4.
- Lower completeness reflects deliberately blank fields on the Turnpike service plazas (North/South Midway — no street address/phone published) and the Breezewood cluster (some exit numbers/websites unverified), not fabricated data.

## Notes

- No coordinates supplied on any row (geocoding is a separate verified workflow), so 0 coordinate-validation issues by construction.
- I-70 in PA runs on free interstate in the west (WV line → New Stanton) then joins the I-76 Pennsylvania Turnpike (New Stanton → Breezewood). The Somerset, North/South Midway, and Breezewood-area rows sit on that I-70/I-76 concurrency and are legitimately on I-70.
- **Omitted, not fabricated:** the Claysville Petro/Veteran's Truck Stop (permanently closed, bankruptcy liquidation) and the Sideling Hill Service Plaza (on I-76 east of the I-70 split, not on I-70). No New Stanton Exit 57 free-I-70 truck stop could be confirmed — none invented.
- The generic "Pilot Travel Center" (Breezewood) was stored as **"Pilot Travel Center Breezewood"** to keep the name/slug distinct from other-city Pilots.
- **I-70 status:** MO, KS, CO, UT, IL, IN, OH, WV, PA now covered as drafts. Remaining: MD (clean, 0 rows) completes I-70 to the Baltimore eastern terminus.
