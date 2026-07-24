# Census batch geocoding — calibration workflow

Free official geocoder calibration for `public.locations`. This workflow
decides **whether the US Census batch geocoder is accurate enough** for the
TLWS directory map and Trip Planner before it is used to backfill the ~1,167
coordinate-free listings. It never writes to Supabase, never applies
coordinates, and never auto-approves a result — the admin console
(`/admin/directory/geocoding`, `action=ready` + human sign-off) stays the only
door to a live coordinate.

## Official service (the only one permitted)

- Batch endpoint: `https://geocoding.geo.census.gov/geocoder/locations/addressbatch`
- Benchmark: **`Public_AR_Current`**, resolved by name → id at run time from
  `https://geocoding.geo.census.gov/geocoder/benchmarks` (never hardcode a
  numeric benchmark — it changes each vintage).
- Free federal service: **no key, no billing, no paid fallback.** If the
  endpoint is unreachable we STOP — we never substitute another geocoder.
- Census coordinates are **TIGER address-range interpolations, not rooftop.**
  Nothing in this workflow is ever labeled "rooftop verified."

## Input format

Official five columns, headerless, one row per listing:

```
Unique ID, Street address, City, State, ZIP
```

- **Unique ID** = the production `locations.id` UUID (so results map back
  deterministically).
- Street address, City, and a two-letter State are **required**; a row without
  them is not eligible.
- **ZIP is preserved blank** when the listing has none — never invented.
- PO-box and highway-only addresses are excluded up front (they only produce
  junk/ties in the TIGER matcher).

## Files

| Path | Role |
|---|---|
| `scripts/imports/census-geocode.ts` | Eligibility filter, input-CSV framing, benchmark resolver, multipart batch submit (injected fetch), SHA-256 checksums, run manifest |
| `scripts/validation/validate-geocodes.ts` | Raw output parser, validation rules, four-way classifier, control-distance metrics |
| `scripts/test-census-geocode.ts` | Offline tests (parse / validate / classify / rerun / control metrics) |
| `data/geocoding/census/calibration/census-calibration-input.csv` | The 100-record calibration input (45 controls + 55 coordinate-free) |
| `data/geocoding/census/calibration/controls.csv` | The 45 verified controls' existing lat/lng, for the distance check |
| `data/geocoding/census/calibration/fixtures/` | Documented sample `addressbatch` output for parser tests |
| `data/geocoding/census/raw/` | Where raw Census responses are stored **unchanged** (one file per run) |

## Reuse (no forked logic)

- `@/lib/directory/census-geocoder` — `normalizeCensusAddress` (PO-box /
  highway-only / blank rejection) and **`classifyCensusResponse`**, the single
  deterministic source of the state / bounds / coordinate rules. The batch
  parser maps each output row into that classifier's shape, so no rule is
  re-implemented.
- `@/lib/map/geo` `haversineMiles`, `@/lib/map/bounds` `STATE_BOUNDS`,
  `@/lib/directory/coordinate-verification` `milesOutsideBounds`.
- The existing admin review contract + `backfill-stages.ts` remain the path
  from a reviewed result to a staged apply.

## What every result records

benchmark · run timestamp · input checksum · raw-output checksum · match
status · match type · matched address · longitude · latitude · input state ·
returned state · review decision · rejection reason. (See `RunManifest` and
`ReviewRecord`.)

## Validation rules (reject or quarantine)

Rejected/quarantined when: the UUID was not submitted; coordinates are missing
or malformed; the returned state differs from the input state; the coordinate
falls outside the expected state boundary (>5 mi framing tolerance);
coordinates are `0,0`, oceanic, or outside the US; Census returns `No_Match`;
the result is a `Tie`; the matched address materially conflicts with the
submitted address (different house number → quarantined to manual review);
or a duplicate output ID appears.

## Classification (only four)

- `census-calibration-pass` — a **control** whose Census point lands within
  150 m of its already-verified coordinate, with no address conflict.
- `census-manual-review` — any matched non-control, or a control beyond the
  threshold, or a matched row with an address conflict. Nothing auto-applies.
- `census-rejected` — failed a hard validation rule (reason recorded).
- `census-no-match` — Census returned `No_Match`.

## Running it

**Build the input (offline, from a directory snapshot):**

```
npx esbuild scripts/imports/census-geocode.ts --bundle --platform=node --format=cjs \
  --alias:@=./src --alias:server-only=./scripts/shims/server-only.ts \
  --outfile=/tmp/census-geocode.cjs && node /tmp/census-geocode.cjs build \
  data/geocoding/dry-run/directory-snapshot.json data/geocoding/census/calibration
```

**Submit + validate (requires network egress to `geocoding.geo.census.gov`):**
wire a real `fetch` into `submitBatch`, store the raw response under
`data/geocoding/census/raw/`, then run `validate-geocodes.ts` over it with the
input and controls maps.

## Manual submission fallback (when egress is blocked)

This sandbox's egress policy does not currently allow
`geocoding.geo.census.gov`. To run the calibration by hand:

1. Open the official batch form: **https://geocoding.geo.census.gov/geocoder/locations/inputAddressBatchPage.html**
2. **Find Locations Using…** → *Address Batch*.
3. Upload `data/geocoding/census/calibration/census-calibration-input.csv`
   (it is already in the required 5-column, headerless format).
4. Benchmark: **Public_AR_Current**. Vintage is not needed for `/locations`.
5. Download the result CSV and save it **unchanged** to
   `data/geocoding/census/raw/census-calibration-output.<UTC-timestamp>.csv`.
6. Run the validator:

   ```
   npx esbuild scripts/validation/validate-geocodes.ts --bundle --platform=node --format=cjs \
     --alias:@=./src --alias:server-only=./scripts/shims/server-only.ts \
     --outfile=/tmp/validate-geocodes.cjs
   # then a thin runner loads the raw output + input + controls and prints the summary
   ```

7. Record the run manifest (benchmark, timestamp, input + raw-output
   checksums) alongside the raw file.

The parser and classifier are already unit-tested against
`fixtures/census-addressbatch-output.sample.csv`, so a hand-run result flows
through the identical, verified path.
