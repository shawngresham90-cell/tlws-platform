# Batch 8 — I-65 Alabama: Validation Report

All checks run 2026-07-12 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport` / `scripts/validate-import.ts`)

- Master + 3 parts: 100% clean (0 skipped / 0 duplicates / 0 errors / 0 invalid categories / 0 malformed URLs / 0 coordinates).

## Expansion Readiness (`assessExpansion` vs live)

- ready-to-publish 38 / import-unpublished 26 / manual-review 0 / reject 0; slug collisions 0.
- Per-row verdicts: `data/imports/i65-alabama-batch-008-expansion-report.csv`.

## Duplicate detection (`classifyPair`)

- vs GA 0 / TN 0 / KY 0 / OH 0 / MI 0 / FL 0 / IN 0 / live 0; in-file co-location 24; in-batch slug duplicates 0.

## Quality (`scoreCompleteness`)

- min 38 / median 69 / mean 64.9 / max 76; Incomplete 1, Needs work 26, Good 37.

## Slug-collision detection

- vs live production detail slugs: 0; in-batch: 0.

## Production duplicate comparison (read-only)

- Live snapshot reconstructed deterministically from the 7 committed, already-merged
  batch CSVs (GA/TN/KY/OH/MI/FL/IN); detail_slug is a pure function of name+city+state.
- Snapshot verified against the production DB by read-only slug-set fingerprint:
  `md5=4f69d699e45ba71a0e959a19dede87c1` (578 rows: GA 78 / TN 61 / KY 99 / OH 95 /
  MI 73 / FL 73 / IN 99; 442 published / 136 unpublished) — matches DB exactly.
- All 64 Alabama rows compared against every one of the 578 live listings via
  `classifyPair` + name/phone match: **0 duplicates**.

## Exact command outputs

```
# scripts/validate-import.ts (live parser + zod schema, no DB)
data/imports/i65-alabama-batch-008.csv        Columns: 32 · rows incl. header: 65 · total=64 imported=64 skipped=0 duplicates=0 errors=0 · OK
data/imports/i65-alabama-batch-008-part1.csv  Columns: 32 · rows incl. header: 26 · total=25 imported=25 skipped=0 duplicates=0 errors=0 · OK
data/imports/i65-alabama-batch-008-part2.csv  Columns: 32 · rows incl. header: 26 · total=25 imported=25 skipped=0 duplicates=0 errors=0 · OK
data/imports/i65-alabama-batch-008-part3.csv  Columns: 32 · rows incl. header: 15 · total=14 imported=14 skipped=0 duplicates=0 errors=0 · OK

# CSV safety sweep
coordinates present: NONE · formula-injection cells: NONE · affiliate non-blank: NONE
featured != no: NONE · state != AL: NONE · interstate != I-65: NONE
tpc urls: 1 (well-formed truckparkingclub.com location URL) · malformed: NONE
master rows: 64 · master keys: 64 · part keys: 64 · master == union(parts): True
```
