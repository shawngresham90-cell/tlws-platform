# Census geocoder calibration set (100 records)

Read-only export from `public.locations` for calibrating the free US Census
batch geocoder. No coordinates were changed to produce this; nothing here is
applied. See `docs/directory/census-geocoding.md` for the full workflow.

## Composition

| Set | Rows | Notes |
|---|---|---|
| **Controls** | 45 | The web-verified high-confidence listings with existing lat/lng (all I-75 GA/TN). Their coordinates are the ground truth for the distance check and are **never overwritten**. |
| **Sample** | 55 | Coordinate-free listings with a usable street address, spread across all 15 states (4 per state; DE 2, IL 1). Types: 13 truck stops, 13 parking, 8 repair, 19 other/rest-area/weigh-station, 2 CDL schools. Includes highway-only addresses and 2 missing-ZIP rows so the reject/no-match paths are exercised. |
| **Total** | 100 | |

## Files

- `census-calibration-input.csv` — the official 5-column, headerless Census
  batch input (`Unique ID, Street, City, State, ZIP`); missing ZIP is a blank
  field. Row 1–45 are controls, 46–100 the sample.
- `controls.csv` — `listing_id, verified_lat, verified_lng, state` for the 45
  controls (distance ground truth).
- `fixtures/census-addressbatch-output.sample.csv` — a documented synthetic
  Census output used by the parser/classifier tests.

## Status: NETWORK BLOCKED

This environment's egress policy denies `geocoding.geo.census.gov`
("Host not in allowlist"), so the batch was **not** submitted here. The input
CSV above is ready for manual submission at the official Census batch page —
see the "Manual submission fallback" section of
`docs/directory/census-geocoding.md`. Save the raw result unchanged under
`data/geocoding/census/raw/` and run `scripts/validation/validate-geocodes.ts`.
