# Batch 54 — I-80 Pennsylvania: Review Summary

CSV: `data/imports/i80-pennsylvania-batch-054.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). Pennsylvania has **0** existing I-80
production rows. **Nothing has been imported to production.**

**This batch completes I-80** — the corridor now runs, as drafts, from the western
terminus in San Francisco to the eastern terminus at Teaneck, NJ. This batch covers
the ~310-mile free-interstate crossing of northern **Pennsylvania**: West (Ohio line
→ Clarion → DuBois), Central (Clearfield → Bellefonte → Milton), and East
(Bloomsburg → Hazleton corridor → Stroudsburg/Delaware Water Gap).

## Totals
- Total rows in CSV: **52**
- ready-to-publish: **34** · import-unpublished (held): **18** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 20 |
| CAT Scales | 14 |
| Truck Washes | 3 |
| Tire & Repair | 2 |
| Weigh Stations | 4 |
| Truck Parking | 7 |
| Roadside Service | 2 |
| **Total** | **52** |

## Segments
- **A — West (19):** OH line → DuBois. TA Barkeyville + Kwik Fill (Exit 29), Emlenton Truck Plaza (42), Clarion Travel Plaza (62), Flying J #707 (Brookville 78) + Love's #829 (Brookville 81, w/ Speedco), Pilot #336 + Sheetz (DuBois/Falls Creek 97), their CAT scales, Hurricane Truck Wash, the Clarion weigh stations, and the West Middlesex & Jefferson County rest areas.
- **B — Central (16):** Clearfield → Milton. Sapp Bros (Clearfield 120), Snow Shoe Auto Truck Plaza (147), TA Milesburg (158), the Lamar/Mill Hall Exit-173 cluster (TA Lamar, Flying J #709, Pilot Mill Hall), Flying J #555 (Milton 215), their CAT scales, Eagle United Truck Wash, and the MM146/194/220 rest areas.
- **C — East (17):** Bloomsburg → Delaware Water Gap. TA Bloomsburg (232), Love's #324 (Mifflinville 242), Pilot #298 (Drums 256), Onvo/Hickory Run (White Haven 274), Pocono Mountain Travel Plaza (Bartonsville 302), their CAT scales, Bartonsville Truck Wash, STTC Mifflinville, the Nescopeck DOT inspection stations, and the Poconos rest areas.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (TA/Petro, Pilot/Flying J, Love's, Sapp Bros, Kwik Fill, Sheetz, Onvo/AMBEST, CAT Scale, PennDOT/511PA, coopsareopen) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- **Cross-segment reconciliation:** DuBois Exit 97 anchor kept once (West); Bloomsburg 232 / Mifflinville 242 anchor kept once (East); Central retains only its unique middle rows. Generic Mill Hall Pilot renamed for a distinct slug; mile-marker rest areas assigned their nearest named locality.
- **Omitted, not fabricated:** Hazleton-area facilities on I-81 (not I-80); a "Love's Clearfield"/"Love's Milton" that were actually Sapp Bros and Flying J #555; the Delaware Water Gap Welcome Center (closed for building damage); legacy Mifflinville stops of unverified operation.
- **No coordinates** (separate geocoding workflow). No internal duplicates; no collision against the (empty) PA production set.
