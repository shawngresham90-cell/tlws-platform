# Census control calibration batch — verified and ready to submit

Verified **2026-07-25** against live production (read-only). This batch exists to
supply the one thing the 927-row full run could not: **a measured accuracy
number** for Census geocoding, obtained by geocoding locations whose true
coordinates are already known and comparing.

**Nothing was applied. No coordinate was written or modified. `geo` was not
populated. Supabase was not modified. PR #177 is not merged.**

## The file

| Field | Value |
|---|---|
| **Path** | `data/geocoding/census/calibration/census-calibration-input.csv` |
| **Rows** | **100** (headerless) |
| **Controls** (known lat/lng) | **45** |
| **Non-control samples** (coordinate-free) | **55** |
| **Columns** | **5** — `Unique ID, Street Address, City, State, ZIP` |
| **SHA-256** | `5030f68e057bc5ca39b858e7b0a3b189772a813543208db628ca6cc0521c2ffa` |

The file is **unchanged** from when it was generated, so its checksum is
unchanged. It round-trips byte-identically through the canonical
`buildBatchInputCsv()`, and all 100 rows pass the authoritative `isEligible()`
gate (100/100, 0 ineligible).

## Pre-delivery verification (all read-only)

### 1. None of the 45 existing coordinates will be modified ✅

Submitting a CSV to the Census geocoder is an outbound HTTP request to
`geocoding.geo.census.gov`. It has **no connection to Supabase** and no ability
to write to `public.locations`. Additionally:

- No apply step is being run. The only code that could ever write coordinates is
  the M4 planner (`scripts/imports/apply-geocodes.ts`), which **emits SQL and
  never executes it**, contains no database client, and requires separate
  explicit authorization.
- That planner independently refuses any row whose live `lat`/`lng` is non-NULL
  (`existing-coordinate-present`). All 45 controls have coordinates, so they are
  **structurally ineligible for any future apply** — they cannot be overwritten
  even by accident.
- The controls are inputs used for *comparison only*. Their production values are
  the yardstick, never the target.

### 2. Every control UUID maps to the correct production location ✅

Verified by SQL against live production:

| Check | Result |
|---|---|
| Stored controls | 45 |
| Found in production | **45 / 45** |
| Not live (soft-deleted) | **0** |
| Missing production coordinates | **0** |
| State mismatch vs stored | **0** |

### 3. Stored control coordinates match current production ✅

Compared at 6-decimal precision: **0 coordinate mismatches** across all 45
controls. The `controls.csv` yardstick is therefore accurate as of today.

Additionally, a **cryptographic whole-file check**: production was asked to
re-emit the 5-column input row for all 100 UUIDs from live data; the SHA-256 of
those sorted rows is

```
6f1f5c759b0c43ad2cd4fff1ae51ca6a1fa1f86ae2ad6107236c400569357c4d
```

which is **identical** to the SHA-256 of the sorted rows in the stored file. That
proves every UUID, street address, city, state and ZIP in the file still matches
production exactly — no drift since generation.

Coordinate state confirmed: exactly **45 rows have coordinates** (precisely the
45 controls) and **55 have none** (the samples) — no sample has silently gained a
coordinate.

### 4. Official headerless five-column format ✅

100 rows, every row exactly 5 fields, no header (as the `addressbatch` endpoint
requires). Blank ZIPs are preserved as empty trailing fields. Example rows:

```
"0f848a8a-9f2f-4e89-bed3-97d656bcd25d","981 Cassville-White Rd","Cartersville","GA","30121"
"1e825644-fb2f-42c6-8bd1-e862fbbcdf40","I-75 North near mile marker 23","Valdosta","GA",""
```

## Composition

**By state** (all 100):

| | GA | TN | AL | AR | FL | IN | KY | MD | MI | NC | OH | SC | VA | DE | IL |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Controls | 41 | 4 | – | – | – | – | – | – | – | – | – | – | – | – | – |
| Samples | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 2 | 1 |
| **Total** | **45** | **8** | **4** | **4** | **4** | **4** | **4** | **4** | **4** | **4** | **4** | **4** | **4** | **2** | **1** |

Controls are GA/TN only — that is simply where the 85 verified coordinates exist
(the I-75 corridor). The 55 samples are stratified across all 15 covered states,
so the batch also probes states with no ground truth.

**By type** (all 100): `truck_stop` 36 · `other` 34 · `parking` 13 ·
`repair` 11 · `weigh_station` 4 · `cdl_school` 2.

## Two honest caveats about what this will measure

**a) ~4 controls will probably return `No_Match`.** Four controls are
milepost weigh-station addresses with no street number:

| UUID | Address |
|---|---|
| `1e825644-…` | I-75 North near mile marker 23, Valdosta GA |
| `3fc244ee-…` | I-75 North near mile marker 190, Forsyth GA |
| `5cacc890-…` | I-75 South near mile marker 23, Valdosta GA |
| `f2f3cfb3-…` | I-75 South near mile marker 190, Forsyth GA |

Expect roughly **41 usable control measurements**, not 45. That is still ample
for a median/p90 error estimate, and how these 4 behave is itself informative
(they *should* fail rather than return a wrong point).

**b) 49 of the 55 samples were already in the 927-row full run.** This is a
bonus, not a problem: re-submitting them gives a **determinism check** — the same
address should return the same coordinate. Any drift signals a service-side
change and would invalidate reusing the earlier results.

The remaining **6 samples were *not* in the 927**. They are service-plaza /
milepost / "street number not published" addresses that the full run's SQL
categorization excluded but the `isEligible()` gate accepts:

`01d5116b` (Smokey Park Hwy, Candler NC) · `0b924a84` (I-95 milepost 37, Carson VA) ·
`0c8f2702` + `208bb775` (I-95 Median Service Plaza MM 82, Aberdeen MD) ·
`0ef95380` (I-95 SB MM 107, Ladysmith VA) · `1b0ef012` (I-95 SB MM 131, Fredericksburg VA)

This is a **real inconsistency** between the SQL mirror in
`census-full-run-query.sql` and the authoritative `isEligible()` in
`scripts/imports/census-geocode.ts` — the SQL is stricter. It did not affect the
full run's integrity (the SQL was the stricter gate, so nothing unsuitable was
submitted), but the two should be reconciled before the next batch. Logged here
rather than silently patched.

## 5. Submitting this batch cannot modify production ✅

Confirmed on three independent grounds:

1. **No write path exists in this direction.** The Census geocoder receives a
   CSV and returns a CSV. It never connects to Supabase and holds no credentials
   for it.
2. **No apply code will run.** The only coordinate-writing design is the M4
   planner, which emits SQL text and never executes it; running it requires your
   separate explicit authorization.
3. **The 45 controls are protected by construction.** Any future apply refuses
   rows that already have coordinates — the controls can never be overwritten.

The only artifact a submission produces is a result CSV on your machine.

## Manual submission instructions

Outbound egress to `geocoding.geo.census.gov` is **policy-denied in this
environment**, so the batch cannot be submitted from here. Submit it manually:

### Option A — the web form (simplest)

1. Open **https://geocoding.geo.census.gov/geocoder/locations/addressbatch**
   (or the "Find Locations Using… Address Batch" form at
   `https://geocoding.geo.census.gov/geocoder/`).
2. **Address File:** upload `census-calibration-input.csv` exactly as delivered —
   do **not** add a header row, re-sort, re-save from Excel, or change encoding
   (any of those change the checksum and can corrupt the UUIDs).
3. **Benchmark:** `Public_AR_Current`.
4. **Vintage:** not required for the *locations* endpoint (leave default).
5. Submit and download the result, which arrives as `GeocodeResults.csv`.

### Option B — curl (equivalent)

```
curl --form addressFile=@census-calibration-input.csv \
     --form benchmark=Public_AR_Current \
     https://geocoding.geo.census.gov/geocoder/locations/addressbatch \
     --output GeocodeResults.csv
```

### After you have the result

1. Save it **unmodified** to
   `data/geocoding/census/raw/GeocodeResults-calibration.csv`
   (a distinct name — do not overwrite the full-run result already there).
2. Record its SHA-256.
3. Commit it to `claude/census-geocode-calibration` and tell me.

I will then compute the checksum myself, confirm all 100 UUIDs are accounted
for, run `parseCensusBatchOutput` → `validateAndClassify` with the 45 controls
supplied as ground truth, and report the **measured** accuracy: median / p75 /
p90 / p95 / max error in metres, counts within 150 m / ¼ mi / ½ mi / 1 mi, plus
`census-calibration-pass` counts — the evidence needed to decide whether the 745
full-run candidates may be applied, and to which surfaces.

## What was not done

No coordinate applied · no existing coordinate modified · `geo` not populated ·
Supabase not modified · no migration · PR #177 not merged · nothing
auto-approved. Delivery is verification + the input file only.
