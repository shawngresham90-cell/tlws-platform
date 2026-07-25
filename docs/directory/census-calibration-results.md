# Census calibration results — MEASURED accuracy, and the recommendation

Run **2026-07-25**. This is the measured answer the 927-row full run could not
give. **Verdict: do not apply Census coordinates to any user-facing surface.**

**Nothing was applied. No coordinate was written or modified. `geo` was not
populated. Supabase was not modified. PR #177 is not merged.**

## Provenance and integrity

| Item | Value |
|---|---|
| Raw result | `data/geocoding/census/raw/GeocodeResults-calibration.csv` |
| **SHA-256 (computed here)** | `73c5a156f564d69ac12c9f855f632493fba4c7f075a706ed516dd453fa7693dc` |
| Matches the stated checksum | **yes** |
| Input submitted | `census-calibration-input.csv`, sha256 `5030f68e…` |
| Format | genuine 8-column Census output (65 matched rows ×8 cols; 35 unmatched ×3 cols) |
| Rows | 100 / 100 submitted |
| Missing outputs | **0** |
| Unknown UUIDs | **0** |
| Duplicate UUIDs | **0** |
| Deterministic re-run | byte-identical ✅ |

Every submitted UUID is accounted for; the service dropped nothing and invented
nothing.

## Headline classification (all 100)

| Bucket | Count |
|---|--:|
| `census-calibration-pass` (control ≤150 m, no address conflict) | **8** |
| `census-manual-review` (matched, needs a human) | **57** |
| `census-rejected` (3 × `Tie`) | **3** |
| `census-no-match` | **32** |

Match rate: **65 %** overall — **58 %** for controls (26/45), **71 %** for samples
(39/55).

## Measured control accuracy — the number that matters

45 controls submitted; **26 produced a comparable coordinate** (16 `No_Match`,
3 `Tie`). Error = distance from the already-verified production coordinate.

| Metric | Value |
|---|--:|
| Median | **208 m** (0.13 mi) |
| p75 | 360 m (0.22 mi) |
| p90 | **757 m** (0.47 mi) |
| p95 | **5,632 m** (3.50 mi) |
| Max | **5,693 m** (3.54 mi) |
| Within 150 m | **8 / 26 (31 %)** |
| Within ¼ mile | 21 / 26 (81 %) |
| Within ½ mile | 24 / 26 (92 %) |
| **Over 1 mile** | **2 / 26 (7.7 %)** |
| State mismatches | **0** |
| Address conflicts | **0** |

Only **8 of 45 controls (18 %)** — or 31 % of those that returned anything —
landed within the 150 m pass threshold.

## The finding that decides this: `Exact` is not trustworthy

The two worst failures were **3.5 miles off** and every available quality signal
said they were perfect:

| Submitted | Census matched | matchType | Error |
|---|---|---|--:|
| 4431 Union Rd, Tifton, GA 31794 | `4431 UNION RD, TIFTON, GA, 31794` | **Exact** | **3.54 mi** |
| 4431 Union Rd, Tifton, GA 31794 | `4431 UNION RD, TIFTON, GA, 31794` | **Exact** | **3.50 mi** |

Address string matched exactly, ZIP matched, state correct, coordinate inside
state bounds, no tie. Every automated check passes — and the point is 3.5 miles
from the real truck stop. This is TIGER address-range interpolation failing on a
long rural road: Census knows the road and interpolates a house number along it,
which can land miles from the actual driveway.

Error by match type confirms the label carries no useful signal:

| matchType | n | Median | p90 | Max | ≤150 m | >1 mi |
|---|--:|--:|--:|--:|--:|--:|
| `Exact` | 20 | 210 m | 506 m | **5,693 m** | 5 | **2** |
| `Non_Exact` | 6 | 215 m | 757 m | 757 m | 3 | 0 |

`Exact` is not more accurate than `Non_Exact` — and it produced *both*
catastrophic outliers.

**Consequence: no automated gate can separate safe rows from dangerous ones.**
The pipeline's validators (state check, bounds check, address-conflict check,
tie rejection) all worked correctly — they flagged 0 problems on rows that were
miles wrong. The failure mode is *silent positional error*, invisible in the
returned data. That is precisely the failure a review gate cannot catch.

## Why the match rate is poor here specifically

The `No_Match` rows are dominated by rural highway-style addresses — exactly what
truck stops are:

`2965 Hwy 247C` · `507 Hwy 309` · `243 Connector 3 SW` · `2111 US Highway 41 NE` ·
`288 Resaca Beach Blvd` · `1503 W 4th St` · `6901 Bellville Rd` ·
`I-75 … mile marker 23/190`

Census/TIGER is strongest on dense urban street grids and weakest on rural
state-route addressing. The directory is overwhelmingly the latter. The 4 milepost
weigh-station controls failed as predicted — correctly, by returning nothing
rather than a wrong point.

The 3 `Tie` rejections were all Cassville White Rd variants in Cartersville, GA,
where several listings share one road — the pipeline correctly refused to guess.

## Extrapolating to the 745 full-run matches

Applying the measured rates to the 745 matched full-run rows:

- ~**69 %** (≈515 rows) would be **>150 m** from truth,
- ~**8 %** (≈57 rows) would be **>1 mile** off,
- and **none of those ~57 would be identifiable** from the Census output.

Publishing 745 coordinates to gain ≈57 undetectable miles-wrong pins is a bad
trade for a product drivers rely on.

## Recommendation per surface

| Surface | Recommendation |
|---|---|
| **Directory map pins** | ❌ **Do not apply.** A 208 m median is tolerable at low zoom, but a 3.5-mile pin puts a stop in the wrong town, and we cannot detect which pins those are. |
| **Nearby search / `nearby_locations`** | ❌ **Do not apply.** Distance ranking is the feature; ≈8 % miles-wrong rows silently corrupt "closest stop" ordering, which reads as a product bug. |
| **Trip Planner** | ❌ **Do not apply.** Routing and detour estimates compound positional error — a driver detours to a point 3.5 miles from the actual stop. |
| **Last Legal Stop** | ❌ **Absolutely do not apply.** This is safety- and compliance-critical: HOS-driven decisions about where a driver can legally park. A wrong position can strand a driver or contribute to a violation. It requires rooftop-verified coordinates, which Census structurally cannot provide. |

There is no surface where these coordinates are safe as published data.

### What Census *can* still be used for

- **Triage only.** A Census hit is a weak hint that an address is real and
  roughly where we think it is — useful for prioritizing manual verification
  queues, never for display.
- **Contradiction detection.** A returned point in the wrong state or far outside
  expected bounds is a reliable signal the *stored address* is wrong. Zero such
  cases here, which is genuine good news about address quality.

### Recommended path to coordinates

1. **Keep the manual web-verification method** that produced the 45 controls —
   operator locator pages give rooftop-accurate points. It is slower but it is
   the only method demonstrated to meet the bar.
2. **Or evaluate a rooftop-grade geocoder** (Google/Mapbox/HERE — paid) against
   this same 45-control harness. The harness is reusable: swap the input, run
   `validateAndClassify`, compare the same metrics. A candidate should show
   median ≤50 m and **zero** >1-mile outliers before consideration.
3. **Either way, keep the M4 guard** that a Census-sourced coordinate is capped
   at `medium` confidence and never labeled rooftop-verified.

## Artifacts

- `data/geocoding/census/raw/GeocodeResults-calibration.csv` — raw result,
  unmodified (sha256 `73c5a156…`).
- `data/geocoding/census/calibration/results/calibration-review.csv` — per-row
  review sheet, 100 rows: listing id, input address, Census matched address,
  existing (control) coordinate, proposed coordinate, distance from control,
  state/bounds result, classification, and blank reviewer columns.

## What was not done

No coordinate applied · no existing coordinate modified · `geo` not populated ·
Supabase not modified · no migration · PR #177 not merged · nothing
auto-approved. The 745 full-run candidates remain unapplied and, on this
evidence, **should stay that way**.
