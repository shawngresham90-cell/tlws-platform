# Batch 81 — I-95 New Hampshire: Review Summary

CSV: `data/imports/i95-new-hampshire-batch-081.csv` · verified 2026-07-15 · dry-run validated
against the live import parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`). New Hampshire has **0** existing production rows — first coverage of the
state. **Nothing has been imported to production.**

Covers the entire (short, ~16-mile) **New Hampshire** stretch of I-95 (the Blue Star / NH
Turnpike) — from the Massachusetts line at Seabrook north through Hampton (the toll plaza),
Greenland and Portsmouth to the Maine line at the Piscataqua River Bridge. Single-segment batch.

## Totals
- Total rows in CSV: **10**
- ready-to-publish: **5** · import-unpublished (held): **5** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 4 |
| Truck Parking (state rest areas) | 2 |
| CAT Scales | 1 |
| Tire & Repair | 1 |
| Weigh Stations | 1 |
| Roadside Service | 1 |
| **Total** | **10** |

## Rows by city
Portsmouth 4 · Hampton 3 · Greenland 2 · Seabrook 1

## Facilities
- **TA Greenland (Exit 3)** — the anchor full-service truck stop, with NH I-95's only **CAT
  scale**; plus the independent **Exit 3 Travel Stop** (Sunoco, Portsmouth) and **Hanscom's
  Truck Stop North & South** (US-1 Bypass, Portsmouth, Exits 5/7).
- **Seabrook Tire** (commercial tire, Exit 1); **National Wrecker** (24/7 heavy towing,
  Portsmouth); the twin **Hampton I-95 weigh/inspection station**; and the two **NH Liquor &
  Wine Outlet / rest areas** at Hampton (NB/SB) that serve as truck-usable rest stops.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official operator sites, catscale.com, and
  directory sites. Per-row sources in `-sources.md`.
- **Hampton "service plaza" correction:** the Hampton I-95 rest areas currently host only NH
  Liquor & Wine Outlet stores and restrooms — **no fuel/food yet** (a welcome-center
  redevelopment with fuel is planned but not built), so they are listed as **parking / rest
  areas, not as fueling truck stops** — reflecting current reality, not the planned build.
- **One CAT scale on NH I-95** (TA Greenland); none fabricated elsewhere.
- **Omitted, not fabricated:** milepost facilities (weigh station, rest areas) carry a blank
  exit; no coordinates.
- **Dedup:** NH production is empty (0 rows); no collisions possible. No internal duplicates.
