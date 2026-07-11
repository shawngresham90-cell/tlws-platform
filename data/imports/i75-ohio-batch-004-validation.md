# Batch 4 — I-75 Ohio: Validation Report

Generated 2026-07-11. Every file below was run through the REAL production import
pipeline (`scripts/validate-import.ts` → `prepareImport`, the same parser + zod gate
as /admin/directory/import) and the Milestone 21 assessment tools. Read-only: no
database writes anywhere.

## Live import parser (dry run)

```
--- i75-ohio-batch-004.csv
Columns: 32 · rows incl. header: 96
Parsed: total=95 imported=95 skipped=0 duplicates=0 errors=0
OK: all 95 rows validate against the live import schema.
--- i75-ohio-batch-004-part1.csv
Columns: 32 · rows incl. header: 26
Parsed: total=25 imported=25 skipped=0 duplicates=0 errors=0
OK: all 25 rows validate against the live import schema.
--- i75-ohio-batch-004-part2.csv
Columns: 32 · rows incl. header: 26
Parsed: total=25 imported=25 skipped=0 duplicates=0 errors=0
OK: all 25 rows validate against the live import schema.
--- i75-ohio-batch-004-part3.csv
Columns: 32 · rows incl. header: 26
Parsed: total=25 imported=25 skipped=0 duplicates=0 errors=0
OK: all 25 rows validate against the live import schema.
--- i75-ohio-batch-004-part4.csv
Columns: 32 · rows incl. header: 21
Parsed: total=20 imported=20 skipped=0 duplicates=0 errors=0
OK: all 20 rows validate against the live import schema.
```

## Expansion Readiness + duplicate detection + quality (M21 tools, vs live production export + GA/TN/KY batches)

```
=== EXPANSION READINESS (vs live DB) ===
parser: total=95 imported=95 skipped=0 duplicates=0 errors=0
verdicts: {"ready-to-publish":65,"import-unpublished":30,"manual-review":0,"reject":0}
=== DUPLICATES vs GA batch CSV ===
  none
=== DUPLICATES vs TN batch CSV ===
  none
=== DUPLICATES vs KY batch CSV (PR #23, not yet imported) ===
  Ziegler Tire (Toledo OH) <-> Ziegler Tire (Lexington KY) :: similar-name-diff-address score=50 [identical name, same website, same category]
  Ziegler Tire (Walbridge OH) <-> Ziegler Tire (Lexington KY) :: similar-name-diff-address score=50 [identical name, same website, same category]
=== IN-FILE PAIR CLASSES (score >= 50) ===
  CAT Scale — Anna Truck Stop, Anna <-> Anna Truck Stop :: shared-address-sub-service score=55 [similar name (100% token overlap), identical address, same exit, same city/state]
  CAT Scale — Flying J Travel Center #695, Beaverdam <-> Flying J Travel Center #695 :: shared-address-sub-service score=80 [similar name (100% token overlap), identical address, same phone, same website, same exit, same city/state]
  CAT Scale — Pilot Travel Center #360, Findlay <-> Pilot Travel Center #360 :: similar-name-diff-address score=55 [similar name (100% token overlap), same phone, same website, same exit, same city/state]
  CAT Scale — Speedway, Findlay <-> Speedway :: shared-address-sub-service score=70 [similar name (100% token overlap), identical address, same phone, same exit, same city/state]
  CAT Scale — Pilot Travel Center #9, Franklin <-> Pilot Travel Center #9 :: shared-address-sub-service score=80 [similar name (100% token overlap), identical address, same phone, same website, same exit, same city/state]
  CAT Scale — Love's Travel Stop #356, North Baltimore <-> Love's Travel Stop #356 :: shared-address-sub-service score=70 [similar name (100% token overlap), identical address, same phone, same exit, same city/state]
  CAT Scale — Petro Stopping Center #325, North Baltimore <-> Petro Stopping Center #325 :: shared-address-sub-service score=80 [similar name (100% token overlap), identical address, same phone, same website, same exit, same city/state]
  CAT Scale — Love's Travel Stop #747, Sidney <-> Speedco - Love's Travel Stop #747, Sidney :: shared-address-sub-service score=65 [similar name (86% token overlap), identical address, same website, same exit, same city/state]
  CAT Scale — Love's Travel Stop #747, Sidney <-> Love's Travel Stop #747 :: shared-address-sub-service score=80 [similar name (100% token overlap), identical address, same phone, same website, same exit, same city/state]
  CAT Scale — Love's Travel Stop #747, Sidney <-> Love's Truck Wash #747 :: shared-address-sub-service score=80 [similar name (60% token overlap), identical address, same phone, same website, same exit, same city/state]
  CAT Scale — Pilot Travel Center #15, Toledo <-> Pilot Travel Center #15 :: shared-address-sub-service score=80 [similar name (100% token overlap), identical address, same phone, same website, same exit, same city/state]
  CAT Scale — Flying J Travel Center #97, Vandalia <-> Flying J Travel Center #97 :: shared-address-sub-service score=55 [similar name (100% token overlap), identical address, same exit, same city/state]
  CAT Scale — TA Wapakoneta #082, Wapakoneta <-> TA Truck Service - TA Wapakoneta #082, Wapakoneta :: shared-address-sub-service score=65 [similar name (60% token overlap), identical address, same website, same exit, same city/state]
  Speedco - Love's Travel Stop #905, Beaverdam <-> Love's Travel Stop #905 :: shared-address-sub-service score=80 [similar name (100% token overlap), identical address, same phone, same website, same exit, same city/state]
  Speedco - Love's Travel Stop #747, Sidney <-> Love's Travel Stop #747 :: shared-address-sub-service score=65 [similar name (100% token overlap), identical address, same website, same exit, same city/state]
  Speedco - Love's Travel Stop #747, Sidney <-> Love's Truck Wash #747 :: shared-address-sub-service score=65 [similar name (60% token overlap), identical address, same website, same exit, same city/state]
  Ziegler Tire <-> Ziegler Tire :: similar-name-diff-address score=50 [identical name, same website, same category]
  Love's Travel Stop #747 <-> Love's Truck Wash #747 :: shared-address-sub-service score=80 [similar name (60% token overlap), identical address, same phone, same website, same exit, same city/state]
=== QUALITY (completeness) ===
rows=95 min=38 median=64 mean=63.3 max=80
labels: {"Incomplete":1,"Needs work":47,"Good":47}
DONE
```

Full per-row expansion verdicts: `i75-ohio-batch-004-expansion-report.csv` (real `expansionReportCsv`).
