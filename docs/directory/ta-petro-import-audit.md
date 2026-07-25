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

---

# Approved-decision update (owner decisions, 2026-07-25)

The three decisions were approved and applied. Dry-run outputs regenerated.
**Still nothing applied: no insert, no production row modified, no field
overwritten, `geo` not populated, PR #177 not merged.**

## Final dispositions — 354 source rows

| Disposition | Count |
|---|--:|
| **Net-new** (no production match) | **303** |
| **Keep separate** (co-located, different category) | **30** |
| **Manual review — merge candidate** | **8** |
| **Existing match** (importer drops) | **7** |
| **Other, pending category** (Goasis 4 + Thorntons 2) | **6** |
| Total | **354** |

**Exact-merge (automatic fill-blank-only): 0 rows.**

### Why zero — and why that is structural, not luck

The approved rule was "merge only exact normalized name/address matches". No row
qualified, and it turns out **no row ever can**: an exact normalized *name* match
in the same city+state is intercepted earlier by the canonical `importDupKey`
check and classified `existing-match` (the importer drops the row outright). The
address signal also requires city+state equality. So the "name AND address equal"
merge tier is **unreachable by construction** — asserted by a test, not assumed.

**Consequence:** the approved auto-merge path is a no-op. Enriching existing
records from TA data would need a separate, explicitly-authorized enrichment
pass. Nothing was auto-merged, exactly as instructed.

## Decision 1 — Goasis (4) and Thorntons (2) → `other`

Applied: both brands are excluded from the truck-stop import set. The workbook
data supports the call — all six show **zero or blank truck parking, zero or
blank showers, no service bays, no tire service, no roadside-assistance hours,
and no weigh scale**; only diesel lanes (0–8) and quick-serve food. Operator
coordinates and fuel details are preserved.

**Blocked on a schema gap, flagged rather than worked around:** there is no
generic `other` category. `type='other'` is reachable only via `cat-scales`
(207 live rows), `truck-washes` (56) or `hotels-truck-parking` (101) — none of
which describe a fuel/convenience stop. Assigning one would misfile them on a
directory page. The six are therefore held in
`ta-petro-other-pending-category.csv` with `proposed_type=other` and full data
intact. **Options:** (a) add a category such as "Fuel Stops" → `dbType: 'other'`,
(b) pick one of the three existing slugs, or (c) leave them out. My
recommendation is (a).

## Decision 2 — `Weigh Scale` is NOT `CAT Scale`

Applied and verified: **`CAT Scale` is asserted on 0 rows**. `scale_present`
is retained as source evidence on **308** rows, in the review CSV and as
"Weigh scale on site (brand unconfirmed)" in the description. Awaiting CAT's
official locator for verification.

## Decision 3 — the 38 probable duplicates, resolved

Sub-classified by whether the matched production row is the **same category**:

| Tier | Count | Disposition |
|---|--:|---|
| Address matches, matched row is `repair` (TA Truck Service co-located) | 8 | keep separate |
| Same-operator in city, matched row is `other` (CAT Scale entry co-located) | 21 | keep separate |
| Proximity match, matched row is `other` (CAT Scale entry) | 1 | keep separate |
| Address matches, same category, name variant (store number) | 5 | manual review |
| Proximity match, same category | 1 | manual review |
| Same-operator in city, same category | 2 | manual review |

**The 30 "keep separate" rows are not duplicates of the same business.** They are
co-located listings of a *different* category at the same site — a CAT Scale
entry or a "TA Truck Service" repair shop at a TA travel center. The directory
already lists these separately (207 cat-scales, 135 tire-repair live), and in
most cases **no truck-stop listing exists for that site at all** — so the travel
center is genuinely net-new. Import-ready therefore rises to **333**.

### ⚠️ One genuine data conflict found

| TA row | Matched production row | Signal |
|---|---|---|
| **Petro Florence** @ `3001 TV Rd.`, Florence SC | **Love's Travel Stop #420** @ `3001 TV Rd`, Florence SC (`truck_stop`) | identical normalized address |

Two different operators recorded at the same street address. **One of these
records has a wrong address** — worth resolving regardless of this import. Held
for manual review; never auto-merged.

The other 7 manual-review rows, with the blanks TA could fill (populated fields
are never touched):

| TA row | Matched existing record | Blanks TA could fill |
|---|---|---|
| TA Baltimore South, Jessup MD | TA Baltimore South #151 | lat/lng, parking_spaces |
| TA Baltimore, Baltimore MD | TA Baltimore #216 | lat/lng, parking_spaces |
| TA Denmark, Denmark TN | TA Denmark (TravelCenters of America #245) | lat/lng |
| TA Lake Park, Lake Park GA | TA Lake Park #249 | (none — fully populated) |
| TA Brunswick, Brunswick GA | TA Travel Center Brunswick @ 185 Dungeness Dr | phone, website, lat/lng, parking_spaces |
| Petro Kenly, Kenly NC | Petro Kenly 95 #395 | phone, lat/lng, parking_spaces |
| TA Atkins, Atkins AR | TA Express Atkins | lat/lng |

Note `TA Denmark` differs only by abbreviation (`Hwy.`/`Rd.` vs
`Highway`/`Road`) — `normalizeText` does not expand abbreviations, so it cannot
be auto-matched. `TA Brunswick` lists a different street entirely
(`185 S. Port Parkway` vs `185 Dungeness Dr`) and may be a distinct site.

## Updated outputs

| File | Rows |
|---|--:|
| `ta-petro-import-ready.csv` | **333** (303 net-new + 30 keep-separate) |
| `ta-petro-review.csv` | 354 (every row, with disposition + reason) |
| `ta-petro-merge-review.csv` | 8 (merge candidates, fillable blanks, never-overwrite list) |
| `ta-petro-other-pending-category.csv` | 6 (Goasis + Thorntons) |

### Validation

```
rows 333 | total 333 | imported 333 | skipped 0 | duplicates 0 | errors 0
coordinates preserved: 333/333
'CAT Scale' asserted: 0
scale_present evidence retained: 308
deterministic rerun: identical
```

Tests **41 passed, 0 failed**; `tsc` clean; prettier clean.

## Awaiting approval

1. The **category decision** for the 6 `other` rows (recommend adding a "Fuel
   Stops" category → `dbType: 'other'`).
2. The **8 manual-review** rows — including the Petro Florence / Love's address
   conflict.
3. Then a dry-run insert of the 333 approved rows (insert-only, per-state
   transactional, with rollback).

**Sapp Bros and the Pilot-network file remain not started**, as instructed.

---

# Insert plan for final authorization (2026-07-25) — REVISED COUNT

**Nothing applied. This is the pre-write plan you asked to see. No insert, no
update, no field overwritten, `geo` not populated, PR #177 not merged.**

## ⚠️ Two corrections to the numbers you approved

**1. The 6 held rows were never inside the 333.** Verified against the files:
`import-ready` contained 0 Goasis/Thorntons rows and 0 manual-review rows
(brands were TA 181 / Petro 74 / TA Express 78). The 354 split as
333 + 6 + 8 + 7. So `333 − 6 = 327` double-subtracts, and 327 would have meant
dropping 6 legitimate truck stops chosen arbitrarily.

**2. More importantly — the 333 itself was wrong.** Preparing this plan I found
two defects in my own duplicate matcher and fixed them:

- **Street-abbreviation blindness.** The canonical `normalizeText` does not
  expand abbreviations, so `2301 W. Lucas Street` ≠ `2301 W Lucas St`. Genuine
  same-address pairs were missed. Fixed with an additional
  `normalizeAddressForMatch` heuristic used **only for duplicate detection** —
  the canonical `normalizeText` is unchanged.
- **Co-located CAT Scale masking the travel centre.** The same-operator-in-city
  search returned the *first* match, often a `CAT Scale at …` (`type=other`)
  row, instead of the actual `truck_stop` record. Now a same-category match is
  always preferred.

Together these caught **29 additional duplicates** that the earlier 333 would
have inserted — for example `TA Gary` vs existing `TA Gary #010 (Burr Street)`
at an identical address, `TA Elkton` vs `TA Elkton #019`, `Petro Kenly` vs
`Petro Kenly 95 #395`, and `TA Florence` vs `Petro / TA Florence (#195)`.
Regression tests now cover both fixes.

### Corrected dispositions (354 rows)

| Disposition | Was | **Now** |
|---|--:|--:|
| Net-new | 303 | **303** |
| Keep separate (co-located, different category) | 30 | **1** |
| Manual review — merge candidate | 8 | **37** |
| Existing match (importer drops) | 7 | **7** |
| Other, pending category | 6 | **6** |
| **Insert-eligible total** | ~~333~~ | **304** |

**The verified safe insert count is 304**, not 327 or 333. I have not inserted
anything; please confirm 304 in your final authorization.

## Decisions applied

- **No "Fuel Stops" category created.** Agreed — mapping it to `dbType: 'other'`
  would sweep in the 364 existing `other` rows (207 cat-scales, 101 hotels,
  56 truck-washes). The 6 Goasis/Thorntons rows are **held** in
  `ta-petro-other-pending-category.csv` until a genuine `fuel_stop` subtype
  exists. Coordinates and fuel details preserved.
- **All manual-review rows excluded** — now 37, not 8.
- **`Weigh Scale` never promoted to `CAT Scale`** — verified 0 assertions;
  `scale_present` retained as evidence on 308 rows.

## 1. Final per-state counts — 304 rows across 43 states

| ST | Insert |
|---|--:|
| AL | 8 |
| AR | 3 |
| AZ | 10 |
| CA | 14 |
| CO | 9 |
| CT | 3 |
| FL | 5 |
| GA | 8 |
| IA | 6 |
| ID | 2 |
| IL | 12 |
| IN | 10 |
| KS | 10 |
| KY | 3 |
| LA | 12 |
| MI | 4 |
| MN | 4 |
| MO | 13 |
| MS | 4 |
| MT | 2 |
| NC | 3 |
| ND | 5 |
| NE | 3 |
| NH | 1 |
| NJ | 4 |
| NM | 9 |
| NV | 10 |
| NY | 7 |
| OH | 14 |
| OK | 7 |
| OR | 6 |
| PA | 14 |
| RI | 1 |
| SC | 5 |
| SD | 3 |
| TN | 2 |
| TX | 40 |
| UT | 3 |
| VA | 5 |
| WA | 4 |
| WI | 7 |
| WV | 4 |
| WY | 5 |

**Total: 304.** (MD drops to 0 — all 3 Maryland rows are now manual review.)
Largest net gains are states with no coverage today: **TX 40, CA 14, PA 14,
IL 12, LA 12, MO 13, AZ/KS/NV 10**.

## 2. Transaction / rollback mechanism

Per state, three artefacts (from `buildInsertPlan`, M5 harness):

1. **Before-count** — `select count(*) from public.locations where state=$ and deleted_at is null;`
   captured and recorded before the state's transaction.
2. **Insert transaction** — `begin;` → one `INSERT` per row → a **slug-collision
   guard** that `raise exception`s (aborting that state) if any incoming slug
   already exists for the state → `commit;`. **Insert-only: the plan contains no
   `UPDATE`**, so no existing row can be touched.
3. **Rollback** — `delete from public.locations where source=$batch and state=$ and slug in (…);`
   removing exactly this batch's rows.

State-by-state isolation: one state's failure aborts only that state.
After each state, the before-count must equal `before + inserted`.

### ⚠️ Required fix before execution

`prepareImport` hard-codes **`source = 'csv-import'`**, but the rollback keys on
`source = 'ta-petro-locmaster-20260725'`. **As generated, the rollback would
match zero rows and silently do nothing.** Before any authorized run, the insert
step must stamp `source` with the batch label (preferred — it also makes the
batch identifiable later). I have not changed `prepareImport`, since that is a
shared production module and the change belongs in the authorized write step.

Sample for the first state:

```sql
-- BEFORE count (AL)
select count(*) from public.locations where state='AL' and deleted_at is null;
```

```sql
-- INSERT (AL, 8 rows) — INSERT-ONLY, do NOT run without separate authorization
...
-- ROLLBACK (AL) — removes exactly this batch's inserted rows
begin;
delete from public.locations where source='ta-petro-locmaster-20260725' and state='AL' and slug in ('ta-tuscaloosa', 'ta-mobile', 'petro-bucksville', 'petro-gadsden', 'petro-shorter', 'ta-lincoln', 'ta-express-birmingham', 'ta-robertsdale');
commit;
```

## 3. Duplicate recheck (run against live 1,252 just now)

```
csv rows 304 | insertable 304 | dropped as duplicate 0 | skipped 0 | errors 0
coordinates preserved 304/304 | 'CAT Scale' asserted 0
within-state slug collisions 0
```

Two slugs (`ta-madison`, `ta-mt-vernon`) repeat across the batch, but in
**different states** (GA/WI and IL/MO). The live unique key is
`(type, state, city, slug)`, so real collisions are **0** — verified, not assumed.

**The recheck must be re-run immediately before execution**, since production may
change between now and then.

## 4. Exact columns to be inserted — 29

Produced by the canonical `toRow()` plus the importer's three additions
(`type`, `slug`, `source`). No column outside this list is written; **`geo` is
never written**.

| Column | Value on this batch |
|---|---|
| `name`, `address`, `city`, `state`, `zip`, `phone` | from the operator workbook |
| `lat`, `lng` | **operator-supplied coordinates, 304/304 rows** |
| `description` | composed from parking/showers/bays/diesel/food/wash + "Weigh scale on site (brand unconfirmed)" |
| `amenities` | canonical subset only — Showers/Food/Fuel/Laundry/Repair. **Never** Wi-Fi, Restrooms, Security or CAT Scale |
| `parking_spaces` | workbook truck-parking count |
| `category_slug` / `type` | `truck-stops` / `truck_stop` (single value across the batch) |
| `slug` | `slugify(name)` |
| `source` | ⚠️ currently `csv-import` — must be the batch label (see above) |
| `is_published` | **false** on all rows — imports land unpublished for review |
| `is_indexable`, `is_featured` | false on all rows |
| `free_parking`, `paid_parking`, `reserved_parking`, `overnight_parking` | false (workbook has no such fields) |
| `website`, `interstate`, `exit_number`, `tpc_url`, `affiliate_code`, `image_url`, `verified_at` | NULL on all rows (not supplied) |

## Awaiting your separate final authorization

Confirm the **304** count (or tell me to adjust), approve stamping `source` with
the batch label, and I will then — and only then — execute state by state with
before/after counts and the rollback file in hand.

**Sapp Bros and the Pilot-network file remain not started.**
