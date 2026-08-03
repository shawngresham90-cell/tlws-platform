# Batch 60 — I-90 South Dakota: Review Summary

CSV: `data/imports/i90-south-dakota-batch-060.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). South Dakota has **0** existing production
rows — first coverage of the state. **Nothing has been imported to production.**

Covers I-90 all the way across **South Dakota** — the longest I-90 state stretch
(~412 mi) — from the Wyoming line near Spearfish east through Sturgis, Rapid City,
Wall, Kadoka, Murdo, Chamberlain, Mitchell, and Sioux Falls to the Minnesota line at
Valley Springs. West (WY line → Rapid City → Kadoka), Central (Murdo → Mitchell),
East (Mitchell → Sioux Falls → MN line).

## Totals
- Total rows in CSV: **60**
- ready-to-publish: **23** · import-unpublished (held): **37** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 21 |
| Truck Parking (rest areas / welcome centers) | 10 |
| CAT Scales | 7 |
| Roadside Service | 7 |
| Tire & Repair | 4 |
| Truck Washes | 4 |
| Hotels with Truck Parking | 4 |
| Weigh Stations | 2 |
| CDL Schools | 1 |
| **Total** | **60** |

## Rows by city (top)
Rapid City 9 · Sioux Falls 9 · Mitchell 8 · Murdo 4 · Oacoma 3 · Spearfish 3 · Sturgis 3 · Vivian 3 · Box Elder 3 · Belvidere 2 · Chamberlain 2 · Valley Springs 2 · (others 1)

## Segments
- **A — West (21):** WY line → Rapid City → Kadoka. Bosselman Travel Center (Rapid City Exit 55) + Flying J/Crow's + Common Cents 125 (Exit 61) + Love's #602 (Box Elder 67B), each with CAT scales; BJ's Country Store + Common Cents (Sturgis), Conoco (Wall), Discount Fuel (Kadoka); the Tilford port of entry; Spearfish welcome center + Wasta rest area; Pomp's Tire + Boss Truck Shop; D&D Truck Wash; three towing/roadside firms; Quality Inn Spearfish.
- **B — Central (22):** Murdo → Mitchell. Pilot #599 (Murdo Exit 192) + its CAT scale, Coffee Cup Vivian, Prairie Post (Presho), the Oacoma/Chamberlain cluster (Al's Oasis + Cenex + Oasis Pump & Pack at Exit 260), Coffee Cup #4 (Plankinton), the Mitchell cluster (Cubby's Exit 330 + I-90 Travel Center Exit 332 + its CAT scale + Mega Wash), Al's Diesel (Chamberlain), Mitchell Towing, two Murdo motels, and the Belvidere/Vivian/Chamberlain/White Lake rest areas.
- **C — East (17):** Mitchell → Sioux Falls → MN line. The I-90 Travel Center truck wash, Larry's I-90 Service and Super 8 (Mitchell); Salem rest area; Hartford BP; the Sioux Falls Exit 399 cluster (Love's #445 + CAT scale + Blue Beacon + Graham Tire + Pomp's Tire); the Flying J #716 + CAT scale + Jim & Ron's at the I-90/I-29 junction; Southeast Tech CDL; Coffee Cup Brandon; and the Valley Springs welcome center + port of entry at the MN line.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (Love's, Pilot/Flying J, Bosselman, Coffee Cup, Common Cents, CAT Scale, Pomp's/Graham, Blue Beacon, SDDOT, Wyndham) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- Cross-segment reconciliation: Kadoka Discount Fuel (kept once, West); the Mitchell Cubby's + I-90 Travel Center + its CAT scale (kept once, Central). Seven distinct CAT scales corridor-wide, each kept once.
- Ports of entry: Tilford (EB, ~MP 39) and Valley Springs (Exit 410, MN line). Flying J #716 + CAT + Jim & Ron's sit at I-90/I-29 junction (I-29 Exit 83), noted in-description. Rest areas/welcome centers with no town assigned the nearest named I-90 locality.
- **Omitted, not fabricated:** no verifiable TA/Petro on SD I-90 (the Exit 399 facility is a Love's, not a TA); Sioux Falls stops deep on I-29/I-229 off the mainline; Alexandria/Kennebec and small-town gas stations without verifiable truck parking; the permanently-closed Tilford information center.
- **No coordinates** (separate geocoding workflow). No internal duplicates; no collision against the (empty) SD production set.
