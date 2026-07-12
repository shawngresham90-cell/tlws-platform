# Batch 9 — I-65 Tennessee: Validation Report

All checks run 2026-07-12 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport` / `scripts/validate-import.ts`)

- Master + 2 parts: 100% clean (0 skipped / 0 duplicates / 0 errors / 0 invalid categories / 0 malformed URLs / 0 coordinates).

## Expansion Readiness (`assessExpansion` vs live)

- ready-to-publish 18 / import-unpublished 10 / manual-review 0 / reject 0; slug collisions 0.
- Per-row verdicts: `data/imports/i65-tennessee-batch-009-expansion-report.csv`.

## Duplicate detection (`classifyPair`)

- vs GA 0 / **TN 25** / KY 0 / OH 0 / MI 0 / FL 0 / IN 0 / AL 0 / **live 25**; in-file co-location 15; in-batch slug duplicates 0.
- **The 25 Tennessee/live "hits" are NOT duplicates.** Every one is a low-score (35) `brand-multi-exit` or `similar-name-diff-address` classification — the same national brand (Pilot, Love's, TA Truck Service, Truck Parking Club, "Tennessee Weigh Station") at a **different city and street address** on the existing I-75 corridor (e.g. Love's #346 Columbia ↔ Love's #364 Charleston; TA Truck Service Franklin ↔ TA Truck Service Knoxville; Pilot #406 Cornersville ↔ Pilot #481 McDonald). Classification: **same brand at a different location** — zero exact or probable duplicates. (The live and TN CSV sets are identical, hence both = 25.)

## Existing-Tennessee duplicate comparison

- Production already holds 61 Tennessee listings, all East-Tennessee **I-75** (Chattanooga → Jellico). The new I-65 batch is Middle Tennessee (Cornersville, Columbia, Franklin, Nashville-Trinity, White House, …). **No city overlaps** between the two sets, so no `importDupKey` (name|city|state) collision is possible.
- reconcile's existing-production exclusion pass (drops any batch row whose normalized name+city already exists live): **0 rows excluded** — nothing in the batch re-lists a live Tennessee business.
- No same-property/multi-interstate re-listing: Nashville-area facilities that primarily serve I-24 or I-40 (Blue Beacon Antioch, rebranded Pilot #292→Love's #429 host, closed downtown TA/Pilot #413) were excluded during research and documented in `-sources.md` / `-review.md`.

## Production duplicate comparison (read-only)

- Live snapshot reconstructed from the 8 committed batch CSVs (GA/TN/KY/OH/MI/FL/IN/AL); detail_slug is a pure function of name+city+state. Verified against the DB by slug-set fingerprint `md5=dad0a7034087ce27ff88e2e8dd68d556` (642 rows) — **matches production exactly**.
- All 28 Tennessee rows compared against every one of the 642 live listings via `classifyPair` + name/phone match: 25 same-brand-different-location classifications, **0 exact/probable duplicates**.

## Exact command outputs

```
# scripts/validate-import.ts (live parser + zod schema, no DB)
i65-tennessee-batch-009.csv        Columns: 32 · total=28 imported=28 skipped=0 duplicates=0 errors=0 · OK
i65-tennessee-batch-009-part1.csv  Columns: 32 · total=25 imported=25 skipped=0 duplicates=0 errors=0 · OK
i65-tennessee-batch-009-part2.csv  Columns: 32 · total=3  imported=3  skipped=0 duplicates=0 errors=0 · OK

# CSV safety sweep
coords 0 · affiliate 0 · featured!=no 0 · formula-injection 0 · state!=TN 0 · interstate!=I-65 0
tpc urls 1 (well-formed truckparkingclub.com) · malformed 0 · master == union(parts): True (28==28)
```

## Quality (`scoreCompleteness`)

- min 39 / median 69 / mean 65.2 / max 75; Incomplete 1, Needs work 10, Good 17.

## Slug-collision detection

- vs live production detail slugs: 0; in-batch: 0.
