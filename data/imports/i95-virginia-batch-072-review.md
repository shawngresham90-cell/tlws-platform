# Batch 72 — I-95 Virginia: Review Summary

CSV: `data/imports/i95-virginia-batch-072.csv` · verified 2026-07-15 · dry-run validated
against the live import parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`). Virginia has **0** existing production rows — first coverage of the
state. **Nothing has been imported to production.**

Covers I-95 the length of **Virginia** — from the North Carolina line at Skippers north
through Emporia, Stony Creek, Carson, Petersburg (I-85/I-295 junctions), Colonial Heights,
Richmond, Ashland, Carmel Church/Ruther Glen, Ladysmith, Thornburg, Fredericksburg,
Stafford, Dumfries and Woodbridge to the DC line at Alexandria.
South (NC line/Skippers → Richmond), North (Ashland/Ruther Glen → DC line).

## Totals
- Total rows in CSV: **47**
- ready-to-publish: **19** · import-unpublished (held): **28** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 13 |
| CAT Scales | 8 |
| Truck Parking (rest areas / welcome centers) | 7 |
| CDL Schools | 6 |
| Weigh Stations | 4 |
| Tire & Repair | 4 |
| Roadside Service | 4 |
| Hotels with Truck Parking | 1 |
| **Total** | **47** |

## Rows by city (top)
Fredericksburg 7 · Emporia 5 · Petersburg 5 · Ruther Glen 5 · Carson 4 · Skippers 4 · Ashland 3 · (others 1–2)

## Segments
- **A — South (23):** NC line/Skippers → Richmond. The Skippers Exit 4 pair (Love's #317 +
  Pilot #4651), the Emporia cluster (Simmons Travel Plaza + Pilot/Sadler's, Exits 8/11B),
  TA Express Stony Creek (Exit 33, the reopened Davis Travel Center), US Gas Carson, the
  truck-friendly Sheetz at Petersburg Exit 48B, and Pilot #384 at Colonial Heights Exit 58
  — five CAT scales among them; the twin Carson weigh stations (MM 40) and Carson rest area
  (MM 37); the VA Welcome Center at Skippers; Colony Tire Emporia; Tri-City and Jinks heavy
  towing (Petersburg); and four Petersburg/Richmond CDL schools.
- **B — North (24):** Ashland/Ruther Glen → DC line. The Carmel Church/Ruther Glen Exit 104
  hub (Flying J #749 + Love's #435, each with a CAT scale) plus TA Ashland (Exit 92, CAT
  scale) and TA Richmond (Exit 89), and the truck-friendly Sheetz at Thornburg Exit 118; the
  twin Dumfries weigh stations (MM 154); five VDOT rest areas/welcome centers (Ladysmith,
  Fredericksburg, Dale City); Fredericksburg tire/repair (STTC, 2020, 95 Truck & Trailer)
  and roadside operators; a Ruther Glen hotel; and Fredericksburg/Woodbridge CDL schools.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (Pilot/Flying
  J, Love's, TA/Petro, Sheetz, Colony Tire, CAT Scale), VDOT rest areas, and VA DMV motor-
  carrier weigh-station pages, with directory sites as secondary confirmation. Per-row
  sources in `-sources.md`.
- **Northern Virginia is deliberately sparse on truck stops:** Woodbridge/Springfield/
  Alexandria have no true truck stops — only rest areas, weigh stations, tire/repair, CDL
  schools and a hotel are listed there. None invented to pad the dense-urban stretch.
- The two **CDS Tractor Trailer Training** rows are distinct campuses (Richmond Exit 74 vs
  Fredericksburg Exit 118) — different cities, no key collision.
- Eight distinct CAT scales verified corridor-wide, each kept once. VDOT rest areas/welcome
  centers and the Carson/Dumfries weigh stations are milepost facilities (exit blank,
  nearest named locality for city).
- **Omitted, not fabricated:** no showers claimed where sources don't state them; no invented
  street addresses for mobile roadside operators or milepost facilities; no coordinates.
- **Dedup:** VA production is empty (0 rows); no collisions possible. No internal duplicates.
