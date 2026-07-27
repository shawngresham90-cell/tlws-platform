# Love's intake — findings

Source: `LovesSearchResults.xlsx`, uploaded 2026-07-27, sha256
`ec5146ee475af473d037ed4913e4f9b4c1059c737581ff93d2b2eefcc5a89ab2`.
Fuel prices in the file are stamped "07:37 PM CDT July 26, 2026".

Intake steps 1–6 of `INTAKE-PROCESS.md` are complete. **No database write was
performed.** Steps 7–10 are prepared but not run.

---

## Headline

**Tier A goes from 0 to 604.**

604 Love's Travel Stops carry an official source, an exact coordinate, and
truck parking explicitly confirmed by the operator's own space count and
overnight-parking flag. That is the first Tier-A set this project has ever had.

| | |
|---|--:|
| Rows in file | 731 |
| **Eligible truck parking (Tier A)** | **604** |
| Quarantined, with reason | 127 |
| Already in the directory (update) | 62 |
| **Net-new** | **541** |
| States | **42** |
| Interstate corridors | **64** |
| Stated truck parking spaces | **49,976** |

## What the file actually contains

64 columns, 731 data rows, header on row 3. Zero nulls on StoreNumber, State,
City, Address, Zip, Latitude, Longitude. Store numbers unique 731/731.
Coordinates all continental (lat 25.95–48.57, lng −123.37 to −72.26), none zero.

Two columns the acquisition manifest expected are **absent**:

- **`name`** — there is no name column. Names are *derived* from store type and
  number (`Love's Travel Stop #245`), and that derivation is recorded in
  `scripts/reconcile-loves.mjs` rather than being silently invented.
- **`status`** — no open/closed flag. **The only closure signal available is
  absence from a later export**, which makes retaining each dated export
  essential. `source-acquisition.json` says "status column, or absence between
  full exports"; in reality it is absence only.

Fuel prices are present and are deliberately **not** carried into the
directory: they are accurate to a single minute and would be stale before a
page rendered.

## The parking gate

`StoreType` is the load-bearing column, and it is exactly the car-only case the
launch gate warns about:

| StoreType | Rows | Truck parking? |
|---|--:|---|
| Travel Stop | 615 | yes — 614 have spaces > 0 |
| Country Store | 59 | no — 58 flagged overnight N |
| Truck Service | 52 | **no** — Speedco-style service bays |
| **Car Stop** | **4** | **no — car-only by definition** |
| Service Center | 1 | no |

Eligibility requires **all** of: `StoreType = Travel Stop`, `ParkingSpaces > 0`,
`overnightparking = Y`, and a usable coordinate. Neither the space count nor the
flag alone is sufficient.

That yields 604. The 11 Travel Stops excluded are 10 with `overnightparking = N`
and one — **#201 Elk City OK** — with `ParkingSpaces = 0` *and* the flag off,
which is the operator saying plainly that you cannot park there.

Every one of the 127 quarantined rows carries its exact reason in
`quarantine.csv`. None was dropped.

## Defects found in our own data

The authoritative file is the first thing able to check the directory's
existing Love's rows. Six fail, **three of them published**.

| DB row | State/City | Status | Finding |
|---|---|---|---|
| `c32686ff` Love's Travel Stop #618 | MI Birch Run | **published** | #618 is **KY/Sadieville**. Michigan has **no Birch Run Love's** — the authoritative MI list is Alamo, Holland, Marshall, Grand Ledge, Milan, Frenchtown, Bridgeport, Capac, St. Clair. |
| `485085d9` CAT Scale — #618 | MI Birch Run | **published** | same site, same defect |
| `f6404302` Love's Travel Stop #306 | TN Dandridge | **published** | **#306 is absent from the authoritative list entirely.** Closure candidate. |
| `a199a4b9` Love's Truck Care #306 | TN Dandridge | unpublished | same site |
| `beb05d53` Love's Travel Stop #420 | SC Florence | unpublished | #420 is **MS/Flowood**. SC has no Florence Love's. |
| `0c0c4cac` + `b67852b7` + `33c7ebe8` #618 | KY Sadieville | published | **correct** — these keep #618; the Michigan rows are the wrong ones |

**Three live pages point at Love's locations the operator does not list.**
Recommended action, requiring separate authorization: unpublish the three
published rows pending confirmation, and correct or retire the Michigan store
number. Nothing was changed in this run.

Two apparent conflicts were **not** defects, and are recorded so nobody
re-raises them:

- `a8d7a25d` **Boss Truck Shop #40 (at Love's), KY Corbin** — Boss is a
  different brand co-located at a Love's; `#40` is its own numbering, not a
  Love's store number. The store-number matcher must skip rows whose name
  begins with another brand.
- `#330 Baxter TN` — the source city is `"Baxter "` with a trailing space. A
  whitespace artifact, not a mismatch. The normalizer trims.

## Colocation

45 store numbers resolve to **more than one** directory row — a Love's travel
stop plus its CAT scale, truck care or truck wash at the same address. These
are legitimately separate services at one physical site.

This breaks a guard: `ENRICH-TEMPLATE.sql` refuses a batch in which two
facilities share one coordinate, which is correct for directional rest-area
pairs but wrong here. **The guard must not be weakened.** Instead, enrichment
batches are scoped to one row per store number (the `truck-stops` row), and the
colocated service rows are a separate, later batch with a store-number-keyed
colocation allowance. That decision is recorded here rather than made silently
at execution time.

## Completeness — the one thing not yet provable

The gate line is *100 % of Love's Travel Stops*. This file is internally
consistent with a complete national export: 42 states, and the 8 absent states
(AK, DE, HI, MA, ME, NH, RI, VT) are ones Love's does not operate in.

But the filename is `LovesSearchResults`, which is the shape of a **search**,
and there is no independent count to check against without network access.

**Line 2 of the launch gate should not be marked 100 % until Shawn confirms
this is the full national export rather than a filtered search result.** Until
then it is recorded as *pending confirmation* with 604 eligible sites in hand.

## Outputs

| File | |
|---|---|
| `LovesSearchResults.xlsx` | raw, unmodified |
| `CHECKSUM.txt` | sha256 of the raw file |
| `PROFILE.json` | what the parse actually found |
| `normalized.csv` | 731 rows, normalized, nothing invented |
| `RECONCILIATION.csv` | 604 eligible with update / net-new disposition |
| `quarantine.csv` | 127 refused, each with an exact reason |
| `CONFLICTS.csv` | the 2 store-number conflicts |
| `DB-SNAPSHOT.tsv` | the 159 existing Love's rows; id digest `95c858c847c26d96ed799fae06529c83`, matching production exactly |

`scripts/reconcile-loves.mjs` regenerates all of it and re-verifies the raw
file's checksum first, refusing to run if the source has changed.
