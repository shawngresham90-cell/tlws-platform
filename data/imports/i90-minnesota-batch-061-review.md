# Batch 61 — I-90 Minnesota: Review Summary

CSV: `data/imports/i90-minnesota-batch-061.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). Minnesota has **0** existing production rows
— first coverage of the state. **Nothing has been imported to production.**

Covers I-90 across **southern Minnesota**, from the South Dakota line at Beaver Creek
east through Luverne, Worthington, Jackson, Fairmont, Blue Earth, Albert Lea (I-35
junction), Austin, Dexter, and the Rochester/Stewartville area to La Crescent and the
Wisconsin line at Dresbach. West (SD line → Albert Lea), East (Austin → WI line).

## Totals
- Total rows in CSV: **32**
- ready-to-publish: **15** · import-unpublished (held): **17** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 16 |
| Truck Parking (rest areas / welcome centers) | 5 |
| CAT Scales | 4 |
| Roadside Service | 4 |
| Truck Washes | 1 |
| Tire & Repair | 1 |
| Weigh Stations | 1 |
| **Total** | **32** |

## Rows by city (top)
Albert Lea 7 · Worthington 5 · Stewartville 4 · Blue Earth 3 · Austin 2 · La Crescent 2 · Rochester 2 · (others 1)

## Segments
- **A — West (21):** SD line → Albert Lea. Beaver Creek welcome center + Adrian/Blue Earth rest areas; Casey's (Luverne, Worthington, Sherburn); Worthington Travel Plaza + Blue Line Travel Center (Exit 45) with the Worthington CAT scale + weigh station; Vet's Whoa N Go (Jackson); Kwik Trip Fairmont + Blue Earth + Blue Earth Auto/Truck Stop; and the Albert Lea I-90/I-35 junction cluster — Trail's/Petro + Love's #337 (each with a CAT scale), Trail's truck wash, and T&W + Dean's towing.
- **B — East (11):** Austin → WI line. Kwik Trip #250 Austin (Exit 179) + its CAT scale, Windmill Travel Center (Dexter 193), Kwik Trip Stewartville + Casey's Stewartville (Exit 209), Kwik Trip La Crescent (275), the High Forest rest area and the Dresbach welcome center at the WI line, Pomp's Tire + Rapid Roadside (Rochester, via US-52 Exit 218), and SAC Towing (Stewartville).

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (Love's, TA/Petro, Kwik Trip, Casey's, CAT Scale, Pomp's, MnDOT, Explore Minnesota) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- Cross-segment reconciliation at the Albert Lea I-90/I-35 junction: Love's #337 and its CAT scale (kept once, West); T&W Towing (same operator, kept once, West).
- Four CAT scales corridor-wide (Worthington, Trail's/Petro Albert Lea, Love's Albert Lea, Kwik Trip Austin), each kept once. The Albert Lea cluster sits at I-35 Exit 11 (1–2 mi off I-90); interstate kept I-90 with the junction noted. Rochester items serve I-90 via US-52 Exit 218 (city north of I-90) — noted in-description.
- **Omitted, not fabricated:** no verifiable fixed weigh station on the Austin–Dresbach stretch (only a seasonal blitz scale reported, unconfirmed); the unconfirmed "Lake Geo Travel Plaza" at Dexter; a corridor-specific CDL school; Austin Kwik Trip's reported truck wash (not on the allowed amenity list, no standalone listing).
- **No coordinates** (separate geocoding workflow). No internal duplicates; no collision against the (empty) MN production set.
