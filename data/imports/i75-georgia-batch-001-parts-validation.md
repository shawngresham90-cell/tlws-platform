# Batch 1 — I-75 Georgia: Per-Part Validation Summary

The approved 78-row master (`i75-georgia-batch-001.csv`) is split into four import-sized files for manual upload through `/admin/directory/import`. Each part keeps the exact exported template — same 32 columns, same order, same headers, no schema changes — and each was run through `scripts/validate-import.ts`, which uses the same `parseCsv` + `prepareImport` + zod `listingSchema` pipeline as the production import route. **Nothing has been written to the production database.**

Cross-file checks: all four headers are byte-identical to the export template; the four parts concatenated are identical to the master (no row lost, duplicated, or reordered); the master contains zero duplicate name/city/state keys, so no part collides with rows imported from another part.

## Part 1 — `i75-georgia-batch-001-part1.csv`

- **Validator:** `total=20 imported=20 skipped=0 duplicates=0 errors=0` — 32 columns, 0 validation errors, 0 parser errors, 0 malformed rows, 0 duplicates within the file
- **Total rows:** 20
- **Published:** 18 · **Unpublished:** 2
- **Categories:** CAT Scales (15), Hotels with Truck Parking (4), Roadside Service (1)
- **Cities:** Adel (1), Byron (1), Calhoun (2), Cartersville (2), Cordele (1), Dalton (1), Forsyth (1), Jackson (1), Lake Park (1), Macon (3), Resaca (1), Tifton (2), Valdosta (3)
- **Intentionally blank fields** (unverifiable — never guessed): ZIP on 2 rows, Latitude on 20 rows, Longitude on 20 rows, Phone on 1 row, Website on 5 rows, Truck Spaces on 13 rows, Interstate on 1 row, Exit Number on 3 rows

## Part 2 — `i75-georgia-batch-001-part2.csv`

- **Validator:** `total=20 imported=20 skipped=0 duplicates=0 errors=0` — 32 columns, 0 validation errors, 0 parser errors, 0 malformed rows, 0 duplicates within the file
- **Total rows:** 20
- **Published:** 16 · **Unpublished:** 4
- **Categories:** Roadside Service (2), Tire Repair (10), Truck Parking (4), Truck Stops (4)
- **Cities:** Adairsville (2), Adel (1), Ashburn (1), Atlanta (1), Cartersville (4), Dalton (1), Forest Park (1), Jackson (2), Macon (2), McDonough (1), Ringgold (1), Tifton (1), Unadilla (1), Valdosta (1)
- **Intentionally blank fields** (unverifiable — never guessed): Latitude on 20 rows, Longitude on 20 rows, Phone on 4 rows, Website on 3 rows, Truck Spaces on 15 rows, Interstate on 1 row, Exit Number on 8 rows

## Part 3 — `i75-georgia-batch-001-part3.csv`

- **Validator:** `total=20 imported=20 skipped=0 duplicates=0 errors=0` — 32 columns, 0 validation errors, 0 parser errors, 0 malformed rows, 0 duplicates within the file
- **Total rows:** 20
- **Published:** 18 · **Unpublished:** 2
- **Categories:** Truck Stops (20)
- **Cities:** Atlanta (1), Byron (1), Calhoun (2), Cartersville (3), Cordele (2), Dalton (2), Emerson (1), Forsyth (1), Hahira (1), Jackson (4), Lake Park (2)
- **Intentionally blank fields** (unverifiable — never guessed): ZIP on 1 row, Latitude on 20 rows, Longitude on 20 rows, Phone on 1 row, Website on 4 rows, Truck Spaces on 1 row, Exit Number on 1 row

## Part 4 — `i75-georgia-batch-001-part4.csv`

- **Validator:** `total=18 imported=18 skipped=0 duplicates=0 errors=0` — 32 columns, 0 validation errors, 0 parser errors, 0 malformed rows, 0 duplicates within the file
- **Total rows:** 18
- **Published:** 17 · **Unpublished:** 1
- **Categories:** Truck Stops (8), Truck Washes (4), Weigh Stations (6)
- **Cities:** Cartersville (1), Forsyth (2), Jackson (1), Lake Park (1), Macon (1), Resaca (1), Ringgold (3), Tifton (3), Valdosta (4), Vienna (1)
- **Intentionally blank fields** (unverifiable — never guessed): ZIP on 6 rows, Latitude on 18 rows, Longitude on 18 rows, Phone on 1 row, Website on 2 rows, Truck Spaces on 10 rows, Exit Number on 8 rows

## Combined totals

- **78 rows** across four files = the approved master exactly
- **69 published · 9 unpublished** — the 9 held records are unchanged and import as unpublished; no published record was altered in the split
- Latitude/Longitude are blank on every row by design (no source published coordinates); Featured = no everywhere; affiliate codes blank everywhere; TruckParkingClub URLs only on the 4 verified TPC listings
- **Suggested import order: part 1 → 4** (any order works; this keeps counts easy to track)
