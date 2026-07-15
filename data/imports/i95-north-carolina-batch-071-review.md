# Batch 71 — I-95 North Carolina: Review Summary

CSV: `data/imports/i95-north-carolina-batch-071.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). North Carolina has **45** existing production
rows — but every one is on the **I-40 corridor** in western/mountain NC (Asheville,
Hickory, Marion, Morganton, Old Fort, Canton, Waynesville, Black Mountain, Lake
Junaluska). I-95 is eastern NC, so there is **zero** corridor overlap: 0 live
collisions, 0 slug collisions. **Nothing has been imported to production.**

Covers I-95 the length of **eastern North Carolina** — from the South Carolina line at
Rowland north through Lumberton, St. Pauls, Hope Mills, Fayetteville, Dunn, Benson,
Smithfield (the I-95/I-40 junction), Kenly, Wilson, Rocky Mount, Enfield, Halifax and
Roanoke Rapids to the Virginia line at Pleasant Hill (Exit 180).
South (SC line/Rowland → Dunn), North (Smithfield/Kenly → VA line).

## Totals
- Total rows in CSV: **44**
- ready-to-publish: **18** · import-unpublished (held): **26** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 10 |
| CDL Schools | 6 |
| Truck Parking (rest areas / welcome centers) | 6 |
| CAT Scales | 5 |
| Roadside Service | 5 |
| Tire & Repair | 5 |
| Weigh Stations | 3 |
| Truck Washes | 2 |
| Hotels with Truck Parking | 2 |
| **Total** | **44** |

## Rows by city (top)
Kenly 9 · Fayetteville 8 · Lumberton 8 · Rocky Mount 5 · Dunn 4 · Pleasant Hill 3 · (others 1)

## Segments
- **A — South (22):** SC line/Rowland → Dunn. The Dunn Exit 75/77 pair (Love's #412 + a
  Pilot/Sadler travel plaza), each with a CAT scale; Sheetz #804 (Hope Mills Exit 41), the
  independent Sun Do (Lumberton Exit 22) and Sunoco Cedar Creek plaza (Fayetteville Exit
  49); the twin Robeson County I-95 weigh stations (MM 24 NB/SB); the I-95 South NC
  Welcome Center (Rowland) and the twin Cumberland County rest areas (MM 47); C-R Road
  Service (repair + wash) and Mangum's towing; Royal Inn Lumberton; commercial tire shops;
  and four Fayetteville/Lumberton-area CDL schools (Robeson CC, FTCC, Miller-Motte,
  TransTech).
- **B — North (22):** Smithfield/Kenly → VA line. The **Kenly 95** freight landmark at
  Exit 106 (Petro/TA #395 + Pilot #6990 + Flying J #683), with two CAT scales, Blue Beacon,
  Love's Speedco #930 and the Kenly 95 service center; the Oasis Travel Center (Halifax
  Exit 168) and Pilot/ONE9 #58 (Pleasant Hill Exit 180, last stop before VA) with a CAT
  scale; the Halifax County SHP weigh station (MM 151); the Johnston (MM 99) and Nash (MM
  142) rest areas plus the NC Welcome Center near the VA line; Colony Tire Rocky Mount;
  Mangum's, Coastal and Central Carolina roadside operators; Rocky Mount Inn; and CDL
  programs at Nash CC (SAGE) and Johnston CC.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators
  (Pilot/Flying J, Love's/Speedco, TA/Petro/Kenly 95, Blue Beacon, CAT Scale, NCDOT, NC
  SHP, NC Commerce welcome centers) with directory sites as secondary confirmation. Per-row
  sources in `-sources.md`.
- **Love's #412 is the Dunn, NC store** (real loves.com/nc/dunn URL) — consistent with
  Batch 70, where a stale directory "Love's #412" at St. George SC was correctly rejected
  in favor of Flying J #493. No conflict.
- **Mangum's Towing** appears once per depot city (Fayetteville in the south, Rocky Mount
  in the north) — a single mobile operator dispatched from multiple I-95 bases, listed the
  same way as other multi-location roadside/wash brands. Distinct city rows, no key
  collision.
- Kenly 95 genuinely hosts three branded truck stops (Petro #395, Pilot #6990, Flying J
  #683) at one complex, like the Florence SC hub — each kept once; two distinct CAT scales
  (the Petro/Pilot complex + the separate Flying J) kept, no third scale fabricated.
- NCDOT rest areas / welcome centers and the SHP weigh stations are milepost facilities
  (exit blank, nearest named locality for city).
- **Omitted, not fabricated:** no showers claimed for the Oasis Travel Center (none
  reported); no street address invented for mobile roadside operators or milepost
  facilities; no coordinates on any row.
- **Dedup:** 45 live NC production keys + slugs loaded; **0** collisions (all live NC rows
  are I-40/mountain NC). No internal duplicates.
