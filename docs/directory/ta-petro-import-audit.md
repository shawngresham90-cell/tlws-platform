# TA/Petro official-operator import audit (read-only)

Run **2026-07-25**. Read-only audit of the official TA/Petro location master
against all 1,252 live production locations.

**Nothing was applied. No production data was modified. The source workbook was
not modified. `geo` was not populated. PR #177 is not merged.**

## Source — preserved unchanged

| Item | Value |
|---|---|
| File | `data/imports/locmaster20260725.xlsx` |
| **SHA-256** | `5ebe0e9f034153536fe3946a3e5cc3d5a45c9a59b010131d5ccee20e21553303` |
| Sheet | `sheet1` |
| Dimensions | `A1:CS355` — 97 columns × 355 rows = header + **354 data rows** ✅ |
| Handling | read in place via openpyxl `read_only=True`; never rewritten. All outputs are new files. |

**Source data quality (excellent):** 0 rows missing a name, street address, city
or coordinates; 0 malformed ZIPs; 0 phone values failing the schema regex.

Brands: `TA` 192 · `TA Express` 79 · `Petro` 77 · `Goasis` 4 · `Thorntons` 2.
44 states represented (state names given in full, normalized to USPS codes).

## Verdicts — 354 source rows

| Verdict | Count |
|---|--:|
| **Net-new candidate** | **303** |
| **Probable duplicate** | **38** |
| **Existing match** | **7** |
| **Rejected / ambiguous** | **6** |
| Total | **354** |

Signals that produced them:

| Signal | Hits |
|---|--:|
| No production match → net-new | 303 |
| Same-operator name in same city+state | 23 |
| Same normalized address + city + state | 13 |
| Canonical dup key (name\|city\|state) — importer would drop | 7 |
| Coordinate within 0.25 mi of a same-operator row | 2 |
| Non-core brand needing a category decision | 6 |

## Dedup method — three independent signals, all reusing canonical code

1. **Canonical dup key** — `importDupKey(name, city, state)` from
   `src/lib/directory/import.ts`, the exact key the admin importer uses. A hit
   means the importer itself would drop the row → **existing match**.
2. **Address identity** — normalized `address|city|state` via the shared
   `normalizeText`.
3. **Coordinate proximity** — `haversineMiles` within **0.25 mi**, restricted to
   production rows whose name indicates the same operator (`TA`, `Petro`,
   `TravelCenters`, `Goasis`). TA supplies coordinates on all 354 rows, so this
   signal actually works here — unlike the 1,167 coordinate-free rows.
4. **Same-operator-in-city** — a TA/Petro-branded production row in the same
   city+state, which catches renamed or differently-spelled sites.

No module was forked: `importDupKey`, `normalizeText`, `DIRECTORY_STATES`,
`AMENITIES`, `haversineMiles` and `prepareImport` are all the production
implementations.

## State-by-state

| ST | Total | Existing | Probable dup | Net-new | Rejected |
|---|--:|--:|--:|--:|--:|
| AL | 10 | 0 | 2 | 8 | 0 |
| AR | 7 | 0 | 4 | 3 | 0 |
| AZ | 10 | 0 | 0 | 10 | 0 |
| CA | 14 | 0 | 0 | 14 | 0 |
| CO | 9 | 0 | 0 | 9 | 0 |
| CT | 3 | 0 | 0 | 3 | 0 |
| FL | 9 | 0 | 4 | 5 | 0 |
| GA | 13 | 0 | 6 | 7 | 0 |
| IA | 6 | 0 | 0 | 6 | 0 |
| ID | 2 | 0 | 0 | 2 | 0 |
| IL | 14 | 0 | 0 | 12 | 2 |
| IN | 15 | 1 | 4 | 10 | 0 |
| KS | 10 | 0 | 0 | 10 | 0 |
| KY | 5 | 2 | 0 | 3 | 0 |
| LA | 12 | 0 | 0 | 12 | 0 |
| MD | 3 | 0 | 3 | 0 | 0 |
| MI | 6 | 0 | 2 | 4 | 0 |
| MN | 4 | 0 | 0 | 4 | 0 |
| MO | 13 | 0 | 0 | 13 | 0 |
| MS | 4 | 0 | 0 | 4 | 0 |
| MT | 2 | 0 | 0 | 2 | 0 |
| NC | 5 | 0 | 2 | 3 | 0 |
| ND | 5 | 0 | 0 | 5 | 0 |
| NE | 3 | 0 | 0 | 3 | 0 |
| NH | 1 | 0 | 0 | 1 | 0 |
| NJ | 4 | 0 | 0 | 4 | 0 |
| NM | 9 | 0 | 0 | 9 | 0 |
| NV | 10 | 0 | 0 | 10 | 0 |
| NY | 7 | 0 | 0 | 7 | 0 |
| OH | 17 | 0 | 2 | 14 | 1 |
| OK | 7 | 0 | 0 | 7 | 0 |
| OR | 7 | 0 | 0 | 6 | 1 |
| PA | 15 | 0 | 0 | 14 | 1 |
| RI | 1 | 0 | 0 | 1 | 0 |
| SC | 8 | 0 | 3 | 5 | 0 |
| SD | 3 | 0 | 0 | 3 | 0 |
| TN | 9 | 4 | 3 | 2 | 0 |
| TX | 40 | 0 | 0 | 40 | 0 |
| UT | 3 | 0 | 0 | 3 | 0 |
| VA | 9 | 0 | 3 | 5 | 1 |
| WA | 4 | 0 | 0 | 4 | 0 |
| WI | 7 | 0 | 0 | 7 | 0 |
| WV | 4 | 0 | 0 | 4 | 0 |
| WY | 5 | 0 | 0 | 5 | 0 |

All overlap sits in the 15 states already covered (GA 6, AR 4, FL 4, IN 4, TN 3+4,
MD 3, SC 3, VA 3, AL 2, MI 2, NC 2, OH 2, KY 2). The other 29 states are entirely
net-new — **notably TX 40, CA 14, AZ/KS/NV 10 each**, none of which the directory
covers today.

Brand × verdict:

| Brand | Net-new | Probable dup | Existing | Rejected |
|---|--:|--:|--:|--:|
| TA | 161 | 26 | 5 | 0 |
| TA Express | 77 | 1 | 1 | 0 |
| Petro | 65 | 11 | 1 | 0 |
| Goasis | 0 | 0 | 0 | 4 |
| Thorntons | 0 | 0 | 0 | 2 |

## The 6 rejected / ambiguous rows

All six are **non-core brands** held back for a category decision, not data
defects — 4 × `Goasis` and 2 × `Thorntons`. `Goasis` is TA's own travel-center
brand and would very likely map to `truck-stops`; `Thorntons` is a
convenience/fuel banner whose sites may not meet the truck-stop bar. Rather than
silently classify them I've left them out of the import-ready set. **Tell me how
you want each brand treated and I'll reclassify.**

There were **no** rows rejected for missing data, bad states, malformed ZIPs, or
in-workbook duplication.

## Amenity normalization — conservative, nothing invented

Mapped to the canonical nine (`AMENITIES`), schema-validated:

| Canonical amenity | Rows | Derived from |
|---|--:|---|
| Fuel | 351 | `Total Diesel Dispensers/Lanes` > 0 |
| Showers | 345 | `Showers` count > 0 |
| Food | 338 | `Full Service Restaurant` or `QSR(s)` non-empty |
| Laundry | 324 | `Laundry Room` = `y` |
| Repair | 258 | service bays/pits > 0, or tire/brake/oil/diagnostics/PM = `y` |
| **Wi-Fi** | **0** | **no data — both Wi-Fi columns are empty on all 354 rows** |
| **Restrooms** | **0** | **no column in the workbook** |
| **Security** | **0** | **no column in the workbook** |
| **CAT Scale** | **0** | **see below** |

Three deliberate abstentions, consistent with the project's "blank when
unverifiable" rule:

- **Wi-Fi** — `Courtesy Wifi In Restaurant Fast Food Area` and
  `Interstate Speedzone Wifi` are empty on **all 354** rows. TA sites almost
  certainly have Wi-Fi, but the workbook does not say so, so it is not asserted.
- **Restrooms** — no column. A site with 11 showers obviously has restrooms, but
  that is inference, not source data.
- **CAT Scale** — the workbook column is the generic **`Weigh Scale`** (=1 on
  **308** rows). The canonical amenity list only offers the *branded* `CAT Scale`,
  and asserting a specific brand the source never names would be a fabrication.
  Scale presence is therefore carried as a separate **`scale_present`** column in
  the review CSV and noted in the description as "Weigh scale on site (brand
  unconfirmed)". **If you confirm TA's scales are CAT Scales, I'll promote all
  308 to the `CAT Scale` amenity in one pass.**

## Coordinates and provenance — preserved as supplied

TA supplies latitude/longitude on all 354 rows; **all 303 import-ready rows carry
the operator's own coordinates unchanged** (`303/303`). They are *not* geocoded,
not rounded, and not passed through Census. Every review row carries the
provenance string:

> `TA/Petro official location master locmaster20260725.xlsx sha256 5ebe0e9f0341…; coordinates as supplied by operator`

This matters given the calibration verdict: operator-published coordinates are a
**materially better** source than Census TIGER interpolation (which measured a
208 m median error and 7.7 % of matches >1 mile off). They still land in the
review queue rather than going live automatically, and they do **not** touch the
85 existing coordinates.

## Outputs

| File | Contents |
|---|---|
| `data/imports/ta-petro/ta-petro-import-ready.csv` | **303** net-new candidates in the canonical import column format, with TA coordinates |
| `data/imports/ta-petro/ta-petro-review.csv` | **all 354** rows with verdict, reasons, matched production id/name, match distance, mapped amenities, `scale_present`, provenance, and blank reviewer columns |

### Validation

Run through the **real** `prepareImport` against all 1,252 production dup keys:

```
rows 303 | total 303 | imported 303 | skipped 0 | duplicates 0 | errors 0
coordinates preserved: 303/303
deterministic rerun: identical
```

**100 % clean** — no schema error, and zero residual duplicates, which
independently confirms the dedup pass. Module tests: `28 passed, 0 failed`
(`scripts/test-ta-petro-audit.ts`), covering state normalization, the amenity
abstentions above, all four verdicts, in-workbook duplicate detection, and
determinism. `tsc --noEmit` clean.

## Recommended next steps (your call)

1. **Decide the two brand questions** — `Goasis` (4) and `Thorntons` (2).
2. **Decide the CAT Scale question** — promote the 308 `scale_present` rows or
   leave the amenity unset.
3. **Review the 38 probable duplicates** — each has a matched production id and
   name in the review CSV; merge-or-keep is a human call.
4. **Then** authorize a dry-run insert of the approved subset (insert-only,
   per-state transactional, with rollback — the M5 plan shape).

## What was not done

No insert · no production row modified · no coordinate applied · `geo` not
populated · source workbook unmodified · PR #177 not merged · Sapp Bros and the
Pilot-network file **not started** (awaiting approval, as instructed).
