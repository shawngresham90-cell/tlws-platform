# Batch 76 — I-95 New Jersey: Review Summary

CSV: `data/imports/i95-new-jersey-batch-076.csv` · verified 2026-07-15 · dry-run validated
against the live import parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`). New Jersey has **0** existing production rows — first live coverage of
the state (the I-80 NJ batch remains an unmerged draft). **Nothing has been imported to
production.**

Covers the **New Jersey** stretch of I-95 — which IS the New Jersey Turnpike from the
Pennsylvania line at the Scudder Falls Bridge / Trenton north through Bordentown, Hamilton,
Cranbury, East Brunswick, New Brunswick, Woodbridge, the Newark-Elizabeth port district,
Kearny and Ridgefield to the George Washington Bridge approach at Fort Lee. South (PA
line/Trenton → Woodbridge), North (Woodbridge → Newark/port → GWB).

## Totals
- Total rows in CSV: **33**
- ready-to-publish: **16** · import-unpublished (held): **17** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 9 |
| Truck Parking (service-area + port lots) | 8 |
| Roadside Service | 5 |
| CDL Schools | 4 |
| CAT Scales | 2 |
| Truck Washes | 2 |
| Tire & Repair | 2 |
| Hotels with Truck Parking | 1 |
| **Total** | **33** |

## Rows by city (top)
Newark 6 · Woodbridge 5 · Bordentown 4 · Cranbury 3 · Hamilton Township 3 · East Brunswick 2 · Elizabeth 2 · Ridgefield 2 · (others 1)

## Segments
- **A — South (16):** PA line/Trenton → Woodbridge. The four southern NJ Turnpike service
  areas (Richard Stockton MM 58, Woodrow Wilson MM 58, Molly Pitcher MM 71, Joyce Kilmer
  MM 78), each with truck parking; **Petro Bordentown (Exit 7)** — the one major branded
  truck stop in this stretch, with the segment's only CAT scale and a co-located Blue Beacon
  wash; Cranbury Service Center and American Truck roadside; STTC South Plainfield tire; and
  Woodbridge/Hopelawn CDL schools.
- **B — North (17):** Woodbridge → GWB. The three northern service areas (Thomas Edison +
  Grover Cleveland MM 92.9 Woodbridge, **Vince Lombardi MM 116 Ridgefield** — the major
  northern truck stop), each with truck parking; **Pilot Express #1098 (Port Newark, Exit
  15E)** with a CAT scale; the Port Newark secure truck park; Inter City Tire (Elizabeth);
  O.J. tank wash (Kearny); Tire Dose, B&L and George's port-district roadside; a Carteret
  hotel; and Linden/Elizabeth CDL schools.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against njta.gov (Turnpike service areas), official
  brand/operator sites, catscale.com and directory sites. Per-row sources in `-sources.md`.
- **Two CAT scales verified corridor-wide** (Petro Bordentown, Pilot #1098 Port Newark),
  each kept once. NJ Turnpike service areas are milepost facilities (exit blank, nearest
  named locality for city).
- **Cross-segment reconciliation:** no facility appears in both segments; the two E-Z Wheels
  CDL schools are distinct campuses (Hopelawn Exit 11 vs Elizabeth Exit 13), different cities.
- **Omitted, not fabricated:** no fixed public weigh station claimed on the Turnpike (NJSP
  runs roving inspection — none with a verifiable address); no hotel-truck-parking invented in
  the Cranbury/South Brunswick area (none authoritatively confirmed); the port-district
  standalone secure lot (Port Newark Truck Parking) is a real operator's own site, not a TPC
  broker; no coordinates.
- **Dedup:** NJ production is empty (0 rows); no collisions possible. No internal duplicates.
