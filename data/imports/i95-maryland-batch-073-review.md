# Batch 73 — I-95 Maryland: Review Summary

CSV: `data/imports/i95-maryland-batch-073.csv` · verified 2026-07-15 · dry-run validated
against the live import parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`). Maryland has **0** existing production rows — first live coverage of the
state (the I-70 MD batch remains an unmerged draft). **Nothing has been imported to
production.**

Covers I-95 the length of **Maryland** — from the Woodrow Wilson Bridge / Oxon Hill at the
DC/VA line, up the eastern Capital Beltway (I-95/I-495) through College Park and Laurel,
Jessup/BWI, into Baltimore (Fort McHenry Tunnel), then along the JFK Memorial Highway toll
road through White Marsh, Aberdeen, Havre de Grace, Perryville, North East and Elkton to the
Delaware line. South (Oxon Hill/Beltway → south Baltimore), North (Baltimore → DE line).

## Totals
- Total rows in CSV: **38**
- ready-to-publish: **29** · import-unpublished (held): **9** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 8 |
| CAT Scales | 6 |
| CDL Schools | 6 |
| Truck Parking (rest areas / service-plaza parking) | 4 |
| Roadside Service | 4 |
| Weigh Stations | 3 |
| Tire & Repair | 3 |
| Truck Washes | 2 |
| Hotels with Truck Parking | 2 |
| **Total** | **38** |

## Rows by city (top)
Elkton 9 · Jessup 6 · Baltimore 5 · Perryville 5 · North East 4 · Aberdeen 2 · Laurel 2 · Savage 2 · (others 1)

## Segments
- **A — South (13):** Oxon Hill/Beltway → south Baltimore. TA Baltimore South #151 (Jessup
  Exit 41A, the only true truck stop + CAT scale in the DC-Baltimore suburbs); the MSP
  weigh/inspection station on the I-95/I-495 Beltway (College Park); both Maryland Welcome
  Centers near Savage (MM 37, the South center recently expanded to ~60 truck spaces);
  Columbia Fleet, Menendez and Heavy Towing Baltimore roadside; Maryland Truck Tire; VIP
  truck wash; and three Laurel/Baltimore CDL schools.
- **B — North (25):** Baltimore → DE line. The Elkton hub (Flying J #875 + TA #019 at Exits
  109A/B, each with a CAT scale, plus Blue Beacon, Boss Truck Shop and TA Truck Service);
  the two MDTA JFK-Highway service plazas (Maryland House MM 82, Chesapeake House MM 97) —
  each listed as a travel center and with its dedicated truck parking; TA Baltimore #216
  (Exit 57), Pilot #290 (Perryville) and Flying J #784 (North East), each with a CAT scale;
  the twin Perryville weigh/inspection stations; Days Inn Perryville and Elkton Lodge; Vintage
  Wrecker; and CDL programs at Cecil, Harford and All-State.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (Pilot/Flying
  J, TA/Petro, Blue Beacon, Boss, CAT Scale), MDTA service-plaza pages, MDOT SHA/MSP weigh-
  station and welcome-center pages, with directory sites as secondary confirmation. Per-row
  sources in `-sources.md`.
- **Dense DC/Baltimore suburbs are deliberately sparse:** TA Baltimore South (Jessup) is the
  only full-service truck stop in the southern half; no truck stops were fabricated to fill
  the urban stretch, and no hotel-truck-parking was invented there (third-party private lots
  were excluded).
- **Cross-segment reconciliation:** BBT & Recovery (phone 410-789-9800) is one operator that
  surfaced in both segments (as "Heavy Towing Baltimore" and "BBT & Recovery Wrecker,
  Aberdeen") — kept once, in the south, and the north duplicate dropped.
- Six distinct CAT scales verified corridor-wide (TA Jessup, TA Baltimore, Pilot Perryville,
  Flying J North East, Flying J Elkton, TA Elkton), each kept once. MDTA service plazas and
  the College Park/Perryville weigh stations are milepost/Beltway facilities (exit blank,
  nearest named locality for city).
- **Omitted, not fabricated:** no CAT scale invented for the median service plazas (catscale
  does not list one); no invented addresses/phones for mobile operators; no coordinates.
- **Dedup:** MD production is empty (0 rows); no collisions possible. No internal duplicates.
