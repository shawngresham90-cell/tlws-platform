# Batch 46 — I-80 Nevada: Review Summary

CSV: `data/imports/i80-nevada-batch-046.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). Nevada has **0** existing production
rows — first coverage of the state. **Nothing has been imported to production.**

Covers I-80 across **Nevada**, a major freight corridor: West (the California
line at Verdi, Reno/Sparks, Fernley, Lovelock, to Winnemucca) and East (Battle
Mountain, Carlin, Elko, Wells, to West Wendover at the Utah line).

## Totals
- Total rows in CSV: **41**
- ready-to-publish: **32** · import-unpublished (held): **9** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 16 |
| CAT Scales | 12 |
| Truck Washes | 4 |
| Tire & Repair | 3 |
| Roadside Service | 1 |
| Truck Parking | 4 |
| Weigh Stations | 1 |
| **Total** | **41** |

## Segments
- **A — West (24):** Verdi→Winnemucca. Boomtown Chevron (Verdi Exit 4), TA Sparks/Sierra Sid's (Exit 19) + Petro Sparks/Alamo (Exit 21) with washes & CAT scales, the Fernley cluster (Pilot #340, Love's #246, Flying J #1005 at Exits 46/48) with Blue Beacon wash & CAT scales, Rye Patch Chevron (Lovelock Exit 129), Love's #797 + Flying J #770 (Winnemucca Exit 176) with CAT scales & Speedco, plus Trinity/Cosgrave rest areas.
- **B — East (17):** Battle Mountain→Wendover. Broadway Flying J (Exit 229), Love's #978 + Pilot/ONE9 #387 (Carlin Exit 280), the independent Sinclair (Elko Exit 303), Love's #365 + Flying J #692 (Wells Exit 352), Pilot #147 (West Wendover Exit 410), their CAT scales, CMC Tire (Elko), Sixth Street truck wash (Winnemucca), the NHP scale, and the Beowawe/Pequop rest areas.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (Love's, Pilot/Flying J, TA/Petro, Sinclair, CAT Scale, NDOT/NHP) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- No field invented: rest-area/scale addresses & several phones/ZIPs left blank where unverified.
- **Nevada has no fixed ports of entry** — enforcement is mobile (NHP); only the one documentable westbound scale is listed.
- **Omitted, not fabricated:** no verified fixed truck wash between Battle Mountain and Wells; lead-gen "roadside" directories excluded. TA Mill City (Exit 149/151) referenced but not returned with verified fields — omitted.
- Winnemucca (Exit 176) cross-segment overlap reconciled: shared stops/CAT scales kept once.
- **No coordinates** (separate geocoding workflow). No internal duplicates; no collision against the (empty) NV production set.
