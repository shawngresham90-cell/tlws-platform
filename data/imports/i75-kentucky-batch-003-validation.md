# Batch 3 — I-75 Kentucky: Validation Report

Generated 2026-07-11. Every file below was run through the REAL production import
pipeline (`scripts/validate-import.ts` → `prepareImport`, the same parser + zod gate
as /admin/directory/import) and the Milestone 21 assessment tools. Read-only: no
database writes anywhere.

## Live import parser (dry run)

```
--- i75-kentucky-batch-003.csv
Columns: 32 · rows incl. header: 100
Parsed: total=99 imported=99 skipped=0 duplicates=0 errors=0
OK: all 99 rows validate against the live import schema.
--- i75-kentucky-batch-003-part1.csv
Columns: 32 · rows incl. header: 26
Parsed: total=25 imported=25 skipped=0 duplicates=0 errors=0
OK: all 25 rows validate against the live import schema.
--- i75-kentucky-batch-003-part2.csv
Columns: 32 · rows incl. header: 26
Parsed: total=25 imported=25 skipped=0 duplicates=0 errors=0
OK: all 25 rows validate against the live import schema.
--- i75-kentucky-batch-003-part3.csv
Columns: 32 · rows incl. header: 26
Parsed: total=25 imported=25 skipped=0 duplicates=0 errors=0
OK: all 25 rows validate against the live import schema.
--- i75-kentucky-batch-003-part4.csv
Columns: 32 · rows incl. header: 25
Parsed: total=24 imported=24 skipped=0 duplicates=0 errors=0
OK: all 24 rows validate against the live import schema.
```

## Expansion Readiness + duplicate detection + quality (M21 tools, vs live production export)

```
=== EXPANSION READINESS (vs live DB) ===
parser: total=99 imported=99 skipped=0 duplicates=0 errors=0
verdicts: {"ready-to-publish":76,"import-unpublished":23,"manual-review":0,"reject":0}
=== DUPLICATES vs GA batch CSV ===
  none
=== DUPLICATES vs TN batch CSV ===
  none
=== IN-FILE PAIR CLASSES (score >= 50) ===
  CAT Scale — Pilot Travel Center #231, Corbin <-> Pilot Travel Center #231 :: shared-address-sub-service score=70 [similar name (100% token overlap), identical address, same phone, same exit, same city/state]
  CAT Scale — TA Florence <-> TA Florence :: shared-address-sub-service score=70 [similar name (100% token overlap), identical address, same phone, same exit, same city/state]
  CAT Scale — Pilot Travel Center #353, Georgetown (Triport Rd) <-> Pilot Travel Center #353 :: shared-address-sub-service score=70 [similar name (100% token overlap), identical address, same phone, same exit, same city/state]
  CAT Scale — Pilot Travel Center #47, Georgetown (Cherry Blossom Way) <-> Pilot Travel Center #47 :: shared-address-sub-service score=70 [similar name (100% token overlap), identical address, same phone, same exit, same city/state]
  CAT Scale — London Travel Plaza (AMBEST) <-> London Travel Plaza (AMBEST, formerly London Auto/Truck Center BP) :: shared-address-sub-service score=70 [similar name (67% token overlap), identical address, same phone, same exit, same city/state]
  CAT Scale — Love's Travel Stop #291, Richmond <-> Love's Truck Care - Love's Travel Stop #291, Richmond :: shared-address-sub-service score=70 [similar name (75% token overlap), identical address, same phone, same exit, same city/state]
  CAT Scale — Love's Travel Stop #291, Richmond <-> Love's Travel Stop #291 :: shared-address-sub-service score=70 [similar name (100% token overlap), identical address, same phone, same exit, same city/state]
  CAT Scale — Love's Travel Stop #618, Sadieville <-> Love's Truck Care / Speedco - Love's Travel Stop #618, Sadieville :: shared-address-sub-service score=70 [similar name (75% token overlap), identical address, same phone, same exit, same city/state]
  CAT Scale — Love's Travel Stop #618, Sadieville <-> Love's Travel Stop #618 :: shared-address-sub-service score=70 [similar name (100% token overlap), identical address, same phone, same exit, same city/state]
  CAT Scale — Flying J Travel Center #664, Walton <-> Flying J Travel Center #664 :: shared-address-sub-service score=70 [similar name (100% token overlap), identical address, same phone, same exit, same city/state]
  CAT Scale — Mr. Fuel Travel Center, Walton <-> Mr. Fuel Travel Center (One9 Fuel Network) :: shared-address-sub-service score=55 [similar name (67% token overlap), identical address, same exit, same city/state]
  CAT Scale — Pilot Travel Center #321, Walton (Richwood) <-> Pilot Travel Center #321 :: shared-address-sub-service score=55 [similar name (100% token overlap), identical address, same exit, same city/state]
  CAT Scale — TA Walton <-> TA Truck Service - TA Walton :: shared-address-sub-service score=50 [identical address, same phone, same exit, same city/state]
  CAT Scale — TA Walton <-> TA Walton :: shared-address-sub-service score=55 [similar name (100% token overlap), identical address, same exit, same city/state]
  CAT Scale — Pilot Travel Center #437, Williamsburg <-> Pilot Travel Center #437 :: shared-address-sub-service score=70 [similar name (100% token overlap), identical address, same phone, same exit, same city/state]
  TA Truck Service - TA Florence <-> TA Florence :: shared-address-sub-service score=65 [similar name (100% token overlap), identical address, same website, same exit, same city/state]
  Love's Truck Care - Love's Travel Stop #291, Richmond <-> Love's Travel Stop #291 :: shared-address-sub-service score=80 [similar name (100% token overlap), identical address, same phone, same website, same exit, same city/state]
  Love's Truck Care / Speedco - Love's Travel Stop #618, Sadieville <-> Love's Travel Stop #618 :: shared-address-sub-service score=80 [similar name (100% token overlap), identical address, same phone, same website, same exit, same city/state]
  TA Truck Service - TA Walton <-> TA Walton :: shared-address-sub-service score=65 [similar name (100% token overlap), identical address, same website, same exit, same city/state]
=== QUALITY (completeness) ===
rows=99 min=36 median=68 mean=65.2 max=80
labels: {"Incomplete":1,"Needs work":36,"Good":62}
lowest 10:
  36 Incomplete — Kentucky Welcome Center / Rest Area (I-71/75, Boone County) (Florence)
  43 Needs work — Shed Lot Truck Parking (Corbin)
  44 Needs work — I-75 Rest Area (Mile 82.5, both directions) (Richmond)
  46 Needs work — Truck Parking Club - Online Transport (Georgetown) (Georgetown)
  46 Needs work — Truck Parking Club - Phoenix Transportation Services (Georgetown) (Georgetown)
  46 Needs work — Truck Parking Club - 956 Enterprise Ct (Lexington) (Lexington)
  46 Needs work — Truck Parking Club - 830 Eastern Bypass (Richmond) (Richmond)
  48 Needs work — HOB-CO LLC Mobile Truck & Trailer Repair (Richmond)
  48 Needs work — Snider Fleet Solutions (Lexington)
  48 Needs work — Ziegler Tire (Lexington)
DONE
```

Full per-row expansion verdicts: `i75-kentucky-batch-003-expansion-report.csv`
(generated by the real `expansionReportCsv`).
