# Census full-run batch package (coordinate-free locations)

Deterministic, read-only export of **every coordinate-free `public.locations`
row eligible for the free US Census batch geocoder.** No production data was
changed to produce this; nothing here is applied. The 85 rows that already have
`lat`/`lng` are excluded by construction (the query filters `lat is null`), so
this batch can never overwrite an existing coordinate. See
`docs/directory/census-geocoding.md` for the workflow and the result path.

## Manifest (snapshot: production, read-only)

- **Coordinate-free rows:** 1,167
- **Eligible (in the batch):** **927** — `census-full-run-input.csv`
  (`sha256 5fe6f87e400a63df8ce6d4e870bc6e5665e15523751a75962188092477fbf908`)
- **Excluded:** 240 — `census-full-run-excluded.csv`
  (`sha256 17459256e0316797cf44d88a2fcf127492382d357cccdd1a5b28b38a5346aefe`)
  - `missing-address`: 199
  - `highway-or-insufficient`: 41 (no house number for the TIGER matcher —
    mile-markers, service plazas, bare interstate refs)
  - `po-box`: 0 · `duplicate-output-id`: n/a (each row is a distinct UUID)
- **Blank ZIP (preserved):** 48 of the 927
- **Same-address dup-key groups within eligible:** 181 — cross-type
  co-locations (e.g. a CAT scale + truck stop at one address). Distinct UUIDs;
  fine for Census (only duplicate *output IDs* would be a problem).
- **Batch split:** none. 927 ≪ the 10,000-per-batch Census limit → one file.

### Eligible by state

`AL 52 · AR 107 · DE 9 · FL 100 · GA 53 · IL 4 · IN 90 · KY 88 · MD 27 ·
MI 55 · NC 64 · OH 81 · SC 28 · TN 147 · VA 22` = 927.

The full-run input passes the authoritative harness gate 100% (927/927
eligible, 0 duplicate IDs, byte-identical round-trip) — verified by
`scripts/validation/validate-census-input.ts`.

## Reproduce (read-only)

The eligible set is `deleted_at is null AND lat is null AND` a usable street
address (non-blank, not PO box, not highway-only) — the same gate as
`isEligible()` in `scripts/imports/census-geocode.ts`. The exact categorization
query is committed at `docs/directory/census-geocoding.md`. Re-running it and
re-validating with `validate-census-input.ts` must reproduce the same 927 rows
and `sha256`.

## Manual submission (this environment is NETWORK BLOCKED)

Egress denies `geocoding.geo.census.gov`, so the batch was **not** submitted.
To run it by hand:

1. Open **https://geocoding.geo.census.gov/geocoder/locations/inputAddressBatchPage.html**.
2. Upload `census-full-run-input.csv` (already the required 5-column,
   headerless format; blank ZIP = empty field).
3. Benchmark: **Public_AR_Current**.
4. Download the result and save it **unchanged** to
   `data/geocoding/census/raw/census-full-run-output.<UTC-timestamp>.csv`.
5. Parse + classify with `scripts/validation/validate-geocodes.ts` (loads the
   raw output + this input + the calibration controls, prints the summary).
   Record benchmark + input/raw-output SHA-256 in the run manifest.

## Retention decision

These are **public business addresses** keyed to internal UUIDs — no personal
data, no credentials. Committing them is acceptable for reproducibility and
review. The `excluded` file carries UUID + reason + state only (no address
text). Raw Census results, once produced, are stored unmodified under
`../raw/` and are the audit source of truth.
