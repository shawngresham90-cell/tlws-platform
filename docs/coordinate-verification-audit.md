# Coordinate Verification — Library + Live Audit (2026-07-13)

## What this adds

`src/lib/directory/coordinate-verification.ts` — a **pure, read-only** cross-check
of a coordinate pair against the listing's own metadata:

1. the hard `coordinateIssues` gate (finite, in-range, not null-island, inside the US), then
2. the listing's **state framing bounds** (`STATE_BOUNDS`), and
3. when the listing carries an interstate, that **corridor's framing bounds** (`INTERSTATE_BOUNDS`).

This catches the geocoding error classes the US-wide gate cannot see — wrong-state
geocodes, transposed/negated lat-lng, and corridor outliers. Because state and
corridor boxes are coarse framing rectangles (not legal boundaries), a miss is
reported as **`suspect` — a triage flag, never proof of error** — together with
`milesOutsideState` / `milesOutsideCorridor` so a reviewer can tell a 2-mile
technicality from a 300-mile wrong-state geocode.

Severities: `ok` · `suspect` (triage) · `invalid` (hard-gate failure) ·
`no-coordinates` (nothing to verify — the normal pre-geocode state).

Also in this change:

- `STATE_BOUNDS` extended with **AL, IN, IL** (AL/IN already have live data;
  IL is the pending Batch 13 state). All 8 live-data states are now covered —
  the batch summary reports `statesWithoutBounds` so future gaps surface
  automatically instead of silently skipping the check.
- `INTERSTATE_BOUNDS` extended with **I-65** (Mobile → Gary) and **I-24**
  (Pulley's Mill → Chattanooga) alongside the existing I-75.
- `verificationReportCsv()` — reviewer CSV of every non-ok row, worst first,
  for the admin geocoding console workflow.
- `scripts/test-coordinate-verification.ts` — **35 checks, all passing.**

## Read-only audit of live production coordinates

Production has **670 locations, 45 of which carry coordinates** (verified by
read-only SQL on 2026-07-13; the remaining 625 are `no-coordinates`, awaiting
the separate verified-geocoding workflow). All 45 were pulled fresh and run
through `verifyCoordinateBatch`:

| Severity | Rows |
| --- | --- |
| ok | **45** |
| suspect | 0 |
| invalid | 0 |
| states without bounds coverage | 0 |

Every geocoded production row sits inside its own state's bounds **and** inside
the I-75 corridor box (all 45 are I-75 listings — 41 GA, 4 TN). No coordinate
was modified; this audit is read-only and repeatable.

## How to re-run

```
# tests
npx esbuild scripts/test-coordinate-verification.ts --bundle --platform=node --format=cjs \
  --alias:@=./src --outfile=/tmp/test-coordver.cjs && node /tmp/test-coordver.cjs

# audit: export id,name,city,state,interstate,lat,lng for rows with coordinates,
# then call verifyCoordinateBatch(rows) and verificationReportCsv(results).
```

## Limitations

- Framing boxes overlap neighboring states near borders, so a wrong-state
  geocode *near* a border can still verify `ok` — the check is a coarse net,
  not a substitute for the per-listing verified-geocoding review.
- Corridor bounds exist for I-75/I-65/I-24 only; other interstates skip the
  corridor check (state check still applies).
- No production data was modified. No coordinates were applied.
