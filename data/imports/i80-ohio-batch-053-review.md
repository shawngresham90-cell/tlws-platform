# Batch 53 — I-80 Ohio: Review Summary

CSV: `data/imports/i80-ohio-batch-053.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`), including **deduplication against the 95
existing Ohio production rows**. **Nothing has been imported to production.**

Covers I-80 across **Ohio** — the Ohio Turnpike (concurrent with I-90 from the
Indiana line to the Elyria split near Exit 142), then the Turnpike alone, then free
I-80 east of Exit 218 through Youngstown, Girard, and Hubbard to the Pennsylvania
line. West (IN line → Toledo → Elyria) and East (Broadview Heights → PA line).
Ohio already has **95** production rows — all on **I-75** — so the compile hard-drops
any name|city collision. Result: **0 collisions**.

## Totals
- Total rows in CSV: **44**
- ready-to-publish: **26** · import-unpublished (held): **18** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 24 |
| CAT Scales | 9 |
| Truck Washes | 3 |
| Tire & Repair | 3 |
| Roadside Service | 3 |
| Weigh Stations | 1 |
| Hotels with Truck Parking | 1 |
| **Total** | **44** |

## Segments
- **A — West (20):** IN line → Elyria. Eight Ohio Turnpike service plazas (Indian Meadow/Tiffin River MP21, Blue Heron/Wyandot MP77, Erie Islands/Commodore Perry MP100, Middle Ridge/Vermilion Valley MP139) and the Exit-71 Perrysburg/Stony Ridge cluster (TA Toledo, Petro, Love's #456, Pilot, Flying J) with four CAT scales, a Blue Beacon wash, and TA/Petro truck-service shops.
- **B — East (24):** Elyria → PA line. Two more Turnpike plaza pairs (Towpath/Great Lakes MP170, Brady's Leap/Portage MP197) and the free-I-80 Youngstown/Girard/Hubbard cluster (Pilot #3, TA #058, Pilot #281, Petro #320, Love's #370, Flying J #697, independent Truck World) with five CAT scales, two Blue Beacon washes, TA/Love's tire & RoadSquad service, the Hubbard weigh station, and the Truck World Travelodge.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (Ohio Turnpike, Love's, Pilot/Flying J, TA/Petro, CAT Scale, Blue Beacon, coopsareopen) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- **Dedup:** compiled against all 95 live OH `importDupKey` keys and 95 detail slugs — **0 collisions, 0 slug collisions**. The generic Perrysburg Pilot/Flying J were renamed with a city suffix (Perrysburg also sits on I-75).
- **Omitted, not fabricated:** Glacier Hills/Mahoning Valley plazas (MP237, on the I-76 portion, not I-80); no "Fallen Timbers" plaza exists on the current Turnpike list.
- **No coordinates** (separate geocoding workflow). No internal duplicates.
