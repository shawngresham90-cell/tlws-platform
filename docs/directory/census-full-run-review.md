# Census full-run result review (927 rows) — HUMAN REVIEW REQUIRED

Processed **2026-07-25** from the untouched Census `addressbatch` result committed
at `data/geocoding/census/raw/GeocodeResults.csv`. Produced by
`parseCensusBatchOutput` → `validateAndClassify` (`scripts/validation/validate-geocodes.ts`).

**Nothing was applied. No production row was modified. No existing coordinate
was changed. `geo` was not populated.** Every proposed coordinate below is a
*candidate* awaiting a reviewer decision.

## 1. Checksum verification

| File | SHA-256 | Status |
|---|---|---|
| Input (submitted) `census-full-run-input.csv` | `5fe6f87e400a63df8ce6d4e870bc6e5665e15523751a75962188092477fbf908` | matches manifest |
| **Raw result** `raw/GeocodeResults.csv` | `73ea56735232fbb0c4c68c77ddad943531fb0b94634d6e78c70b4486cdfb8efd` | **computed independently; matches the value supplied by the owner** |

The raw result's checksum is distinct from the input's, confirming it is a
different artifact (a genuine response, not an echo of the upload).

## 2. Identity + format verification

- Result rows parsed: **927**; submitted IDs: **927**.
- **Missing outputs: 0** — every submitted UUID received a result row.
- **Duplicate output IDs: 0**; **unknown/unsubmitted IDs: 0** (allowlist clean).
- Format confirmed as real Census output: 8-column rows
  (`id, input, matchStatus, matchType, matchedAddress, "lon,lat", TIGER id, side`),
  with `No_Match`/`Tie` rows correctly carrying only the leading columns.
- Matched rows missing coordinates: **0**. All coordinates fall inside the
  eastern-CONUS envelope actually covered by the directory
  (lat 25.86…46.49, lon −94.36…−75.53).

## 3. Matched vs unmatched totals

| Census `matchStatus` | Count | % of 927 |
|---|---:|---:|
| `Match` | **745** | 80.4% |
| `No_Match` | **180** | 19.4% |
| `Tie` (ambiguous) | **2** | 0.2% |

Match-type split within the 745 matches: **Exact 597** (64.4% of all), **Non_Exact 148** (16.0%).

## 4. Classification (the only four decisions this pipeline emits)

| Decision | Count | Meaning |
|---|---:|---|
| `census-calibration-pass` | **0** | Reserved for controls within 150 m of a verified point — none available in this run (see §8). |
| `census-manual-review` | **745** | Matched with a usable coordinate. **Nothing auto-approves.** |
| `census-rejected` | **2** | Both `tie` (ambiguous candidates). |
| `census-no-match` | **180** | Census found no address match. |

Rejection reasons: `no-match` 180, `tie` 2. **No** row was rejected for
wrong-state, out-of-bounds, impossible coordinates, duplicate ID, or
unsubmitted ID — those checks all passed.

## 5. State-by-state results

Grouped by the **submitted** state. `Review` = matched, awaiting human decision.

| State | Submitted | Matched (review) | No match | Rejected | Match rate |
|---|---:|---:|---:|---:|---:|
| AL | 52 | 32 | 20 | 0 | 61.5% |
| AR | 107 | 67 | 40 | 0 | 62.6% |
| DE | 9 | 9 | 0 | 0 | 100.0% |
| FL | 100 | 79 | 21 | 0 | 79.0% |
| GA | 53 | 41 | 12 | 0 | 77.4% |
| IL | 4 | 2 | 2 | 0 | 50.0% |
| IN | 90 | 70 | 20 | 0 | 77.8% |
| KY | 88 | 71 | 17 | 0 | 80.7% |
| MD | 27 | 24 | 3 | 0 | 88.9% |
| MI | 55 | 44 | 10 | 1 | 80.0% |
| NC | 64 | 57 | 7 | 0 | 89.1% |
| OH | 81 | 70 | 11 | 0 | 86.4% |
| SC | 28 | 22 | 6 | 0 | 78.4% |
| TN | 147 | 139 | 7 | 1 | 94.6% |
| VA | 22 | 18 | 4 | 0 | 81.8% |
| **Total** | **927** | **745** | **180** | **2** | **80.4%** |

Match rate varies widely by state (AL/AR ~62% vs TN 94.6%), which tracks how
many rows in each state are rural/highway-style addresses TIGER cannot resolve.

## 6. Rejected and ambiguous results

Both rejections are `Tie` — Census returned multiple equally-plausible
candidates, so no coordinate can be trusted:

| Listing ID | Submitted address | State |
|---|---|---|
| `72a21b70-6f02-439d-a737-1423eabc65f5` | 4135 I-75 Business Spur, Sault Ste. Marie | MI |
| `a7039d72-37d9-4b9d-aa5b-084491f3a2f6` | 1940 Highway 45 Bypass, Jackson | TN |

Both are highway/bypass addresses — exactly the class TIGER interpolation
handles worst. **Neither may be applied.** The 180 `No_Match` rows are listed in
`review/full-run-exceptions.csv`.

## 7. Address and state mismatches

- **State mismatches: 0.** Every matched row's returned state equals the
  submitted state, and every coordinate fell inside its state's bounds.
- **Material address mismatches: 1** (matched, but the house number differs):

| Listing ID | Submitted | Census matched |
|---|---|---|
| `09974385-8c93-4bb5-be59-13552b53e2b3` | 155 Highway 138 (Providence Road), Denmark, TN 38391 | 138 PROVIDENCE RD, DENMARK, TN, 38391 |

Census appears to have parsed the route number **138** as the house number. This
row is flagged `addressMismatch` and must be individually confirmed or rejected —
it is a good example of why no Census result auto-applies.

## 8. Calibration comparison — no ground truth in this run

**Controls available in this batch: 0 of 45.** This is expected and not a defect:
the 45 verified controls are I-75 GA/TN rows that **already have coordinates**
(part of the 85), whereas this run submitted only the **coordinate-free** 927 —
the two sets are disjoint by construction. Consequently:

- median / p75 / p90 / p95 / max control error: **not computable**
- rows within 150 m / ¼ mi / ½ mi / 1 mi of a verified point: **not measurable**

**This run therefore has no measured accuracy.** The 80.4% match rate says
Census *found* addresses; it says nothing about how close those points are to the
real driveways. Treat the 745 as unvalidated candidates.

**Recommended fix before bulk application:** submit a small control batch — the
45 already-verified coordinates (or ~100 rows mixing them with fresh
manually-verified points) — and measure the error distribution. That is the
missing evidence, and it is cheap to obtain.

## 9. Proposed confidence classifications

Census returns **TIGER address-range interpolations, never rooftop** points, so
no row is ever `high` and nothing is labeled "rooftop verified."

| Proposed | Count | Basis |
|---|---:|---|
| `medium` | **597** | `Match` + `Exact`, state/bounds clean, no address conflict |
| `low` | **148** | `Match` + `Non_Exact` (approximate interpolation) |
| none — do not apply | **182** | 180 `No_Match` + 2 `Tie` |
| quarantine (overrides above) | **1** | the Denmark, TN house-number conflict |

These are *proposals for a reviewer*, not approvals. The apply planner
(`scripts/imports/apply-geocodes.ts`) independently caps Census at `medium` and
refuses any row not explicitly reviewer-approved.

## 10. Human-review report artifacts

All three use the canonical `REVIEW_REPORT_HEADER`, with `reviewer_decision` and
`reviewer_notes` intentionally **blank** for a human to fill:

| File | Rows | Purpose |
|---|---:|---|
| `review/full-run-coordinate-review.csv` | 927 | complete record of every result |
| `review/full-run-matched-for-review.csv` | 745 | the actionable queue |
| `review/full-run-exceptions.csv` | 182 | no-match + tie, for research or exclusion |

Columns: `listing_id, business_name, input_address, census_matched_address,
existing_coordinate, proposed_coordinate, distance_from_control_m,
state_bounds_result, match_classification, reviewer_decision, reviewer_notes`.

## 11. Apply-precondition check (read-only, at review time)

Re-verified against production: the 927 eligible IDs are **still all
`lat IS NULL`** (`eligible_now_coordinated = 0`), and the sorted-ID SHA-256 still
equals `c0761b51ac252afeaefadee17c2ae0d5af3201602903d4e1e048c5c766a22538` — the
same set that was submitted. The apply planner's "coordinate must currently be
NULL" guard would hold for all 927, and the 85 existing coordinates remain
untouchable by it.

## 12. Recommendation per surface

Given **80.4% match coverage but zero measured accuracy**, the recommendation is
gated on getting calibration evidence first.

**Do this before any bulk apply:** run the 45-control calibration batch (§8) and
measure the error distribution. Everything below assumes that step.

| Surface | Recommendation |
|---|---|
| **Directory map** | *Safest first use.* A pin that is 100–300 m off is a small visual error, and the map already shows an address the driver can read. Suitable for **reviewer-approved `medium` (Exact)** rows once calibration shows a sane median (e.g. ≤150–250 m). Hold `low`/`Non_Exact` rows back or mark them approximate. |
| **Nearby search** (`nearby_locations` RPC) | *Acceptable with a margin.* Ranking by distance tolerates modest error, but a wrong point can reorder results or hide a closer stop. Use `medium` rows only, and widen the radius slightly rather than presenting distances as precise. |
| **Trip Planner** | *Conditional.* Corridor/segment selection is tolerant, but "miles to next stop" figures are user-facing promises. Use `medium` rows, and round or qualify distances (e.g. "≈ 12 mi") rather than implying survey precision. |
| **Last Legal Stop** | **Do NOT use Census coordinates.** This feature can determine whether a driver stops legally before running out of hours; a TIGER interpolation landing on the wrong side of an interchange or a few hundred metres down the road is a safety-relevant error. Restrict Last Legal Stop to **manually verified rooftop coordinates** (today's 85 and future hand-verified points) until per-row verification exists. |

**Overall:** approve in stages — map first, then nearby search, then Trip Planner
with qualified distances, and never Last Legal Stop on Census data. Apply only
reviewer-approved rows, state by state, using the M4 planner with its
before-snapshot and rollback.

## 13. What was NOT done

No coordinate applied · no existing coordinate modified · `geo` not populated ·
no migration · no auto-approval · no row labeled rooftop-verified. Applying any
of the 745 candidates requires your explicit authorization and a fresh
before-snapshot immediately prior.
