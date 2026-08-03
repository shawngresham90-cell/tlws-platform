# Batch 49 — I-80 Nebraska: Review Summary

CSV: `data/imports/i80-nebraska-batch-049.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). Nebraska has **0** existing production
rows — first coverage of the state. **Nothing has been imported to production.**

Covers the full I-80 crossing of **Nebraska** — a long, freight-heavy Platte Valley
corridor — from the Wyoming line at Pine Bluffs/Bushnell east through Sidney,
Ogallala, North Platte, Kearney, Grand Island, York, Lincoln, to Omaha at the Iowa
line. West (WY line → North Platte) and East (Gothenburg → Omaha).

## Totals
- Total rows in CSV: **53**
- ready-to-publish: **34** · import-unpublished (held): **19** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 24 |
| CAT Scales | 11 |
| Tire & Repair | 3 |
| Truck Washes | 2 |
| Weigh Stations | 3 |
| Truck Parking | 9 |
| Roadside Service | 1 |
| **Total** | **53** |

## Segments
- **A — West (25):** WY line → North Platte. Conoco (Kimball), Love's #625 + Sapp Bros + Love's Truck Care (Sidney Exit 59), Flying J #904 + Big Springs Truck & Travel (Big Springs Exit 107), the Ogallala cluster (Sapp Bros, TA #090, Fat Dogs — Exit 126), the North Platte cluster (Love's #390, Flying J #687, Pump & Pantry, Boss Truck Shop #18, Red Arrow wash — Exits 177/179), their CAT scales, the North Platte weigh station, and six NDOT rest areas.
- **B — East (28):** Gothenburg → Omaha. Cubby's (Gothenburg), Nebraskaland Tire (Lexington), Sapp Bros (Odessa), Fort Kearney Trading Post, Pilot #912 (Wood River), TA Grand Island (Alda), the flagship Bosselman/Pilot #902 + Boss Truck Shop #12 (Grand Island Exit 312), Love's #309 (Aurora), Petro York #362 + Blue Beacon (York Exit 353), Shoemaker's (Lincoln), Cubby's (Greenwood), Flying J #686 (Gretna), Sapp Bros + Love's #730 (Omaha Exit 440), their CAT scales, the Waverly weigh stations, and Kearney/Grand Island/Lincoln rest areas.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (Love's, Pilot/Flying J, TA/Petro, Sapp Bros, Bosselman, Cubby's, CAT Scale, Blue Beacon, Nebraska DOT/NSP) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- Cross-segment reconciliation at North Platte (Exit 179) — Love's #390, Flying J #687, and their CAT scales kept once (West). Sapp Bros locations disambiguated by city suffix.
- **Omitted, not fabricated:** Sapp Bros Lincoln (on US-6, not an I-80 interchange); no Love's on I-80 in Lincoln (Shoemaker's is the genuine stop); no hotel with verified dedicated truck parking; Blue Beacon Grand Island/Shelton unverifiable (only York confirmed).
- **No coordinates** (separate geocoding workflow). No internal duplicates; no collision against the (empty) NE production set.
