# Batch 10 — I-65 Kentucky: Validation Report

All checks run 2026-07-12 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport` / `scripts/validate-import.ts`)

- Master + 3 parts: 100% clean (0 skipped / 0 duplicates / 0 errors / 0 invalid categories / 0 malformed URLs / 0 coordinates).

## Expansion Readiness (`assessExpansion` vs live)

- ready-to-publish 32 / import-unpublished 26 / manual-review 0 / reject 0; slug collisions 0.
- Per-row verdicts: `data/imports/i65-kentucky-batch-010-expansion-report.csv`.

- vs GA 0 / TN 0 / **KY 41** / OH 1 / MI 0 / FL 0 / IN 0 / AL 2 / TN65 0 / **live 44**; in-file co-location 22; in-batch slug duplicates 0.
- **0 exact-duplicate classifications and 0 same-city matches** against existing Kentucky (I-75) or any live listing — so no `importDupKey` (name|city|state) collision is possible. The 41 KY / 44 live "hits" break down as:
  - **Same brand at a different location** — the existing Kentucky rows are all East-KY I-75 (Lexington, Georgetown, Corbin, Florence…) and this batch is Western/Central-KY I-65 (Bowling Green, Cave City, Elizabethtown, Shepherdsville…); every Pilot/Love's/TA-Petro name-overlap pair is a different city + address (e.g. Pilot #438 Franklin ↔ Pilot in Lexington).
  - **Shared-corporate-contact false positives** — CAT Scale rows carry the CAT Scale corporate phone (1-877-CAT-SCALE) and `catscale.com`, and Love's Truck Care / Speedco rows carry Love's corporate phone/site, so `classifyPair` scores `probable-duplicate`/`co-located` against *other states'* CAT/Speedco rows (Franklin KY ↔ Priceville AL; Shepherdsville KY ↔ Sidney OH) despite different city/state/host. These are false positives, not duplicates.

## Existing-Kentucky duplicate comparison

- Production holds 99 Kentucky listings, all East/Central-East **I-75** (Lexington, Georgetown, Corbin, London, Florence, Walton, Richmond…). This batch is Western/Central-KY **I-65** (Bowling Green → Elizabethtown → Shepherdsville → Louisville) with **no city overlap**, so no `importDupKey` collision is possible.
- reconcile's existing-production exclusion pass (drops any batch row whose normalized name+city already exists live): **0 rows excluded**.
- No same-property/multi-interstate re-listing: Louisville facilities primarily serving I-64/I-71 (and out-of-corridor items like Buc-ee's, which bans 18-wheelers) were excluded during research and documented in `-sources.md` / `-review.md`.

## Production duplicate comparison (read-only)

- Live snapshot reconstructed from the 9 committed batch CSVs (GA/TN/KY/OH/MI/FL/IN/AL + TN I-65); detail_slug is a pure function of name+city+state. Verified against the DB by slug-set fingerprint `md5=6a099cec748ca499ad82f0645e89f8bb` (670 rows) — **matches production exactly**.
- All 58 Kentucky rows compared against every one of the 670 live listings via `classifyPair` + name/phone match: **0 exact/probable-real duplicates** (all hits are same-brand-different-location or shared-corporate-contact false positives).

## Exact command outputs

```
# scripts/validate-import.ts (live parser + zod schema, no DB)
i65-kentucky-batch-010.csv        Columns: 32 · total=58 imported=58 skipped=0 duplicates=0 errors=0 · OK
i65-kentucky-batch-010-part1.csv  Columns: 32 · total=25 imported=25 skipped=0 duplicates=0 errors=0 · OK
i65-kentucky-batch-010-part2.csv  Columns: 32 · total=25 imported=25 skipped=0 duplicates=0 errors=0 · OK
i65-kentucky-batch-010-part3.csv  Columns: 32 · total=8  imported=8  skipped=0 duplicates=0 errors=0 · OK

# CSV safety sweep
coords 0 · affiliate 0 · featured!=no 0 · formula-injection 0 · state!=KY 0 · interstate!=I-65 0
tpc urls 1 (well-formed truckparkingclub.com) · malformed 0 · master == union(parts): True (58==58)
```

## Quality (`scoreCompleteness`)

- min 36 / median 64 / mean 63.9 / max 76; Incomplete 2, Needs work 29, Good 27.

## Slug-collision detection

- vs live production detail slugs: 0; in-batch: 0.
