# Geocoding dry run (Phase 2A — Trip Planner data readiness)

Auditable output of the **dry-run geocoding pipeline**. Nothing in this
folder writes to the database, and nothing here is auto-applicable: the only
path from these files to a live coordinate is the admin geocoding console at
`/admin/directory/geocoding` — per-row human review, overwrite confirmation,
history-before-mutation.

## Files

| File | What it is |
|---|---|
| `directory-snapshot.json` | Read-only export of active `locations` rows (id, name, category, address, city/state/zip, lat/lng, interstate, exit) taken 2026-07-17. Input to everything below. |
| `calibration.json` | Milepost anchors built by `scripts/build-calibration.ts` from already-verified coordinates only: applied directory coordinates + high/medium rows of the committed batch CSVs. No invented coordinates. |
| `dry-run-report.json` | Full per-row audit: classification, interpolation provenance (bracketing mileposts, anchor gap), verification findings, notes. |
| `dry-run-candidates.csv` | Interpolated coordinate candidates in the admin console's batch contract. Every row is `action=manual-review`; confidence is capped at `medium` by design. |
| `dry-run-coordinate-review.csv` | Verification triage of every row (invalid / suspect / no-coordinates ordering). |

## Methodology (mile-marker interpolation)

1. **Anchors**: a verified coordinate on a corridor at a known exit becomes a
   `(milepost → lat/lng)` anchor. Sources: coordinates already applied in the
   directory, and high/medium-confidence rows from the committed geocoding
   batch CSVs. Outlier anchors are rejected iteratively when their ground
   distance to neighbors is impossible for their milepost gap.
2. **Interpolation**: a listing with only `interstate + exit` is placed by
   linear interpolation between the two anchors bracketing its milepost —
   only in states whose exits ARE mileposts (Delaware's sequential exits are
   refused, never guessed). No extrapolation beyond the anchor range.
3. **Confidence**: anchor gap ≤ 10 mi → `medium`; ≤ 30 mi → `low`; larger →
   unresolved. An exact exit match to a verified anchor is `medium`. Never
   `high` — the console auto-applies only `high`, so pipeline output always
   requires human review.
4. **Validation**: every proposed point must fall inside its state's framing
   bounds and its corridor's bounds; existing coordinates are cross-checked
   against interpolation (disagreement ⇒ `conflict`, flagged, never touched);
   interpolated points landing on a *different* listing's verified coordinate
   are flagged as potential duplicates.

## Re-running

```
npx esbuild scripts/build-calibration.ts --bundle --platform=node --format=cjs \
  --alias:@=./src --alias:server-only=./scripts/shims/server-only.ts \
  --outfile=/tmp/build-calibration.cjs && node /tmp/build-calibration.cjs \
  data/geocoding/dry-run/directory-snapshot.json data/geocoding/dry-run/calibration.json

npx esbuild scripts/geocode-dry-run.ts --bundle --platform=node --format=cjs \
  --alias:@=./src --alias:server-only=./scripts/shims/server-only.ts \
  --outfile=/tmp/geocode-dry-run.cjs && node /tmp/geocode-dry-run.cjs \
  data/geocoding/dry-run/directory-snapshot.json \
  data/geocoding/dry-run/calibration.json data/geocoding/dry-run
```

Tests: `scripts/test-geocoding-pipeline.ts` (same esbuild runner).

## Results of the 2026-07-17 run

1,252 active listings — 45 already geocoded (all pass validation; zero
suspect, zero invalid, zero conflicts), **52 interpolation candidates**
(48 medium / 4 low; corridors calibrated so far: I-75 GA with 22 anchors,
I-75 TN with 12), **956 need external geocoding** (street address present,
no usable corridor calibration yet), **199 unresolved** (no exit number and
no address-based path). Known data quirk: the Knoxville Watt Road cluster is
tagged `I-75` with exit `369` — an I-40/I-75 concurrency exit number; exact
anchor matching places these correctly, but corridor normalization is a
Phase 2B item.
