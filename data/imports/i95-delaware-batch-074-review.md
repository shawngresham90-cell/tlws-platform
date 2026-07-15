# Batch 74 — I-95 Delaware: Review Summary

CSV: `data/imports/i95-delaware-batch-074.csv` · verified 2026-07-15 · dry-run validated
against the live import parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`). Delaware has **0** existing production rows — first coverage of the
state. **Nothing has been imported to production.**

Covers the entire (short, ~23-mile) **Delaware** stretch of I-95 — from the Maryland line at
Newark through Christiana, Wilmington and Claymont to the Pennsylvania line. Single-segment
batch (the corridor is too short to split).

## Totals
- Total rows in CSV: **10**
- ready-to-publish: **6** · import-unpublished (held): **4** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| CDL Schools | 3 |
| Roadside Service | 2 |
| Truck Stops & Travel Centers | 1 |
| Truck Parking | 1 |
| Weigh Stations | 1 |
| Tire & Repair | 1 |
| Truck Washes | 1 |
| **Total** | **10** |

## Rows by city
Newark 5 · New Castle 3 · Wilmington 2

## Facilities
- **Biden Welcome Center (I-95 Service Plaza), Newark (MM 5)** — the one true I-95 Delaware
  travel plaza: 24/7 Sunoco fuel, a food court, tax-free retail, EV charging, and **50
  CabAire truck parking spaces** with anti-idle electrification (listed both as a truck stop
  and as truck parking).
- **Newark Toll Plaza Commercial Vehicle Enforcement (MM 1.4)** — the DelDOT Delaware
  Turnpike toll-plaza commercial-vehicle/weigh-in-motion facility near the MD line.
- **STTC New Castle** (commercial truck tire/service), **Craig's Mobile Steam Cleaning**
  (truck wash), **REDDOT Truck Service** and **B & F Towing** (24-hour heavy roadside/towing,
  Wilmington), and three CDL schools (160 Driving Academy Newark, American Driver Training
  and Smith & Solomon, New Castle).

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official operator sites, DelDOT rest-area/toll
  pages, catscale.com and directory sites. Per-row sources in `-sources.md`.
- **No CAT scale listed on DE I-95** — catscale.com shows none on this stretch, so none was
  fabricated.
- **Genuinely scarce truck stops:** Delaware's I-95 is a short urban/suburban Wilmington-area
  corridor. The Biden Welcome Center is the only on-corridor travel plaza; the big Flying
  J/TA travel centers are just over the line in Elkton MD (Batch 73) or off-corridor on
  US-40, so they are not double-listed here.
- **Omitted, not fabricated:** no coordinates; no invented street address for B & F Towing
  (city-only); milepost facilities carry a blank exit.
- **Dedup:** DE production is empty (0 rows); no collisions possible. No internal duplicates.
