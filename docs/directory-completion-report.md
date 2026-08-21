# Directory Completion Report — Phase 1 consolidated

Generated 2026-07-21 from committed, reproducible data only: the SELECT-only
production snapshot (1,252 directory rows), the final Census checkpoint
(PR #157), and the corridor interpolation package (PR #158). No production
writes have occurred; every number below that says "after approvals" is
gated on the human review in `/admin/directory/geocoding`
(see `docs/directory-census-approval-runbook.md`).

## 1. Final Census results (workflow complete)

| metric | value |
| --- | --- |
| Eligible worklist | 967 of 1,252 (285 ineligible: 199 blank address, 85 already had coords, 1 highway-only) |
| Fetched | 965 (run 1: 13m49s, 963 · run 2: retried the 2 service errors) |
| **Matched** | **745** (all `medium` — the live API returns no matchType field, so nothing was auto-classified high) |
| Rejected by the service | 220 (217 no-match, 3 tie) |
| **Formally unmatched (persistent-service-error)** | **2** — both Knoxville TN weigh stations, whose "addresses" are corridor descriptions ("I-40 West/I-75 South near mile marker 372"), not street addresses. Two independent runs ~3h apart errored on exactly these two while 965 others succeeded. Routed to manual research — and they are trivial manual geocodes, since the mile marker is given. |

The Census fetch workflow is **finished**: 967/967 worklist rows are now
resolved (745 matched · 220 rejected · 2 formally unmatched).

## 2. Coordinate coverage

| stage | rows with coords | coverage |
| --- | --- | --- |
| Actual today (nothing applied yet) | 85 / 1,252 | **6.8%** |
| After Census approvals (745 rows) | 830 / 1,252 | **66.3%** |
| After corridor interpolation review (+122) | 952 / 1,252 | **76.0%** |

## 3. State-by-state coverage (projected after Census approvals)

| state | rows | now | after Census | % |
| --- | --- | --- | --- | --- |
| TN | 202 | 30 | 169 | 83.7% |
| AR | 127 | 0 | 65 | 51.2% |
| FL | 127 | 0 | 79 | 62.2% |
| GA | 123 | 55 | 96 | 78.0% |
| IN | 99 | 0 | 72 | 72.7% |
| KY | 99 | 0 | 71 | 71.7% |
| OH | 95 | 0 | 70 | 73.7% |
| NC | 89 | 0 | 57 | 64.0% |
| MI | 73 | 0 | 44 | 60.3% |
| AL | 64 | 0 | 32 | 50.0% |
| SC | 47 | 0 | 22 | 46.8% |
| VA | 47 | 0 | 18 | 38.3% |
| MD | 38 | 0 | 24 | 63.2% |
| IL | 12 | 0 | 2 | 16.7% |
| DE | 10 | 0 | 9 | 90.0% |

The corridor candidates then add most heavily to AR (+24), IN (+16),
OH (+15), FL (+15), VA (+11), AL (+8).

## 4. Corridor coverage

19 corridors calibrated from 700 anchors (85 applied · 27 batch ·
588 pending-Census; 28 rejected by the neighbor-distance sanity check).
Interpolation candidates by corridor: I-40 AR 24 · I-65 IN 16 · I-75 OH 15 ·
I-75 FL 13 · I-95 VA 11 · I-65 AL 8 · I-40 TN 6 · four corridors with 4 ·
two with 3 · four with 2. Remaining unmatched by corridor tag after both
packages concentrates on I-95 (Southeast segments) and the I-75 KY/TN gaps.

Cross-validation: 8/8 verified-anchor comparisons agree within 2 mi
(independent corroboration); 273/305 census-internal consistency checks
agree; **32 disagreements flagged for extra scrutiny during approval**.

## 5. Remaining unmatched locations

After Census approvals AND interpolation review: **300 rows still without
coordinates** —

| bucket | rows | difficulty |
| --- | --- | --- |
| No exit number and no street address | 168 | hard — needs phone/web research per listing |
| Street address, Census rejected, no interpolation path | 129 | medium — human geocode from the address (58 lack exits, 53 anchor-gap-too-large, 16 outside anchor range, 2 uncalibrated corridor) |
| The 2 weigh stations + 1 highway-only address | 3 | easy — location described by mile marker |

A **second interpolation pass after approvals** (anchors densify once 867
coordinates are applied) should recover an estimated 30–50 of the 69
gap/range-limited rows at zero manual cost.

## 6. Manual research workload

Worst-case 300 rows; realistic post-second-pass workload ≈ **250–270 rows**:
~130 with addresses at ~3–5 min each (≈ 7–11 h) and ~140 hard rows at
~8–12 min each (≈ 19–28 h). Heaviest states: FL 24, AR 22, TN 21, NC 20,
MI 19.

## 7. Overall Directory completion (13-dimension model)

| stage | completion |
| --- | --- |
| Today | ~65% |
| After Census approvals | ~82% |
| After interpolation review (Phase 1 complete) | **~85–87%** |

## 8. Estimated work to 90% / 95% / 100%

- **90% overall** — finish Phase 1 (owner: ~2–4 h approval session + ~1 h
  candidate review; engineering: ~1 h regeneration + fresh assessment), then
  begin Phase 2 daily-driver utility (amenity facets, Trip Planner links,
  favorites): ~2–3 engineering sessions. Coordinate coverage 90% needs
  +175 rows past 76% — second interpolation pass + ~125–145 manual rows
  (≈ 8–15 h research).
- **95% overall** — Phase 2 complete plus Phase 3 premium data (DOT medical
  examiners, diesel/DEF, fuel brands, wash/CDL/weigh-station detail):
  ~3–5 engineering sessions plus data sourcing you approve. Coverage 95%
  needs ~240 added rows (≈ 20–30 h cumulative manual research).
- **100%** — full premium attributes on every listing plus coordinates for
  all 300 stragglers (40–60 h cumulative research). Honest recommendation:
  a portion of the 168 hard rows will turn out closed or unverifiable —
  retiring those listings is better data quality than forcing coordinates.

## 9. Recommended next milestone

**The owner approval session** (runbook: `docs/directory-census-approval-runbook.md`).
It is the single gate on everything above: 6.8% → 66.3% in one review
session, verified end to end offline (745/745 rows apply cleanly, zero
overwrites). All engineering is staged and stops here until approvals land.
