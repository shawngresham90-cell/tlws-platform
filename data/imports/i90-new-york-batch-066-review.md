# Batch 66 — I-90 New York (NY Thruway): Review Summary

CSV: `data/imports/i90-new-york-batch-066.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). New York has **0** existing production rows
— first coverage of the state. **Nothing has been imported to production.**

Covers I-90 all the way across **New York** — the NY State Thruway plus the Berkshire
Connector — the longest remaining I-90 state (~385 mi): from the Pennsylvania line at
Ripley through Buffalo, Rochester, Syracuse, Utica, Amsterdam and Albany, then east on
the Berkshire spur to the Massachusetts line at Canaan. West (PA line → Rochester),
Central (Rochester → Herkimer), East (Herkimer → Albany → MA line).

## Totals
- Total rows in CSV: **57**
- ready-to-publish: **24** · import-unpublished (held): **33** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 17 |
| Truck Parking (Thruway service areas / rest/parking areas) | 17 |
| Roadside Service | 8 |
| CAT Scales | 6 |
| Tire & Repair | 4 |
| CDL Schools | 2 |
| Truck Washes | 1 |
| Weigh Stations | 1 |
| Hotels with Truck Parking | 1 |
| **Total** | **57** |

## Segments
- **A — West (15):** PA line → Rochester. Love's #833 Ripley (Exit 61) + CAT; Kwik Fill Fredonia; the Angola & Pembroke Thruway service areas; the Pembroke Exit 48A pair (TA #194, Flying J #693); 490 Truck Stop (Le Roy); plus Buffalo/Cheektowaga tire, wash, towing and a CDL school.
- **B — Central (24):** Rochester → Herkimer. Love's #820 Waterloo (Exit 41) + CAT, Pilot #380 Liverpool (Exit 36) + CAT; The Pit Stop, Nice N Easy, Sav-On Diesel, North Utica Citgo, Fastrac; the Ontario/Clifton Springs/Junius Ponds/Port Byron/Warners/DeWitt/Chittenango/Oneida service areas + one Thruway parking area; Syracuse-area tire/towing, NTTS CDL school and Hotel Concord.
- **C — East (18):** Herkimer → Albany → MA line. The Fultonville Exit 28 trio (TA + CAT, Pilot #1317 + CAT, Onvo); Love's #611 Canaan (Berkshire spur Exit B3) + CAT; the Indian Castle/Iroquois/Mohawk/Pattersonville/Guilderland service areas; the NYSDOT Schodack inspection + rest area; and four Amsterdam Exit 27 heavy-duty repair/towing shops.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (Love's, Pilot/Flying J, TA/Petro, Onvo, Kwik Fill, CAT Scale, NY Thruway/Applegreen, NYSDOT, McCarthy Tire) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- Cross-segment reconciliation: the Iroquois Service Area (MP 210 WB) kept once (East, with its EB pair Indian Castle). McCarthy Tire appears in West (Buffalo) and Central (East Syracuse) — distinct locations, both kept.
- Six distinct CAT scales corridor-wide (Ripley, Waterloo, Liverpool, Fultonville TA + Pilot, Canaan), each kept once. Thruway service areas use milepost identifiers (mileposts DECREASE eastbound: Ontario 376 → Iroquois 210); Angola is a single bidirectional plaza (listed once).
- **Omitted, not fabricated:** the NY Thruway has NO fixed permanent weigh stations (NYSP/CVEU run portable inspections at service/rest areas) — only the NYSDOT Schodack WIM inspection site is listed; the "Blue Beacon Exit 35" in some summaries is Erie PA, not NY; Batavia-area hotels not confirmed to allow truck parking; the STTC Syracuse street address left blank (conflicting listings).
- **No coordinates** (separate geocoding workflow). No internal duplicates; no collision against the (empty) NY production set.
