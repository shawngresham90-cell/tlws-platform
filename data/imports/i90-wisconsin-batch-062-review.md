# Batch 62 — I-90 Wisconsin: Review Summary

CSV: `data/imports/i90-wisconsin-batch-062.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). Wisconsin has **0** existing production rows
— first coverage of the state. **Nothing has been imported to production.**

Covers I-90 across **Wisconsin**, from the Minnesota line at La Crosse east/southeast
through Sparta, Tomah (I-94 split), Oakdale, Mauston, Wisconsin Dells, and Portage
(I-39 junction), then the DeForest/Madison freight node, Janesville, and Beloit to the
Illinois line at South Beloit. West (MN line → Portage), South (Portage → IL line).

**Concurrency note:** I-90 runs with I-94 (Tomah→Madison) and I-39 (Portage→Janesville);
facilities on those overlaps are on I-90 and are included here. When I-94/I-39 are later
covered, these concurrent segments will be skipped to avoid duplicating this draft.

## Totals
- Total rows in CSV: **50**
- ready-to-publish: **23** · import-unpublished (held): **27** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 23 |
| CAT Scales | 9 |
| Truck Parking (rest areas / welcome centers) | 6 |
| Roadside Service | 3 |
| Tire & Repair | 3 |
| Truck Washes | 2 |
| Weigh Stations | 2 |
| CDL Schools | 2 |
| **Total** | **50** |

## Rows by city (top)
Beloit 6 · Janesville 6 · Mauston 5 · DeForest 4 · Oakdale 4 · Sparta 4 · Portage 3 · Tomah 3 · (others 1–2)

## Segments
- **A — West (28):** MN line → Portage. La Crosse/Onalaska (Pomp's Tire, reefer service) + West Salem Kwik Trip (CAT); Sparta Travel Center (CAT) + weigh station + rest areas; the Tomah I-90/I-94 split (Kwik Trip #796 + CAT, Pomp's Tomah); the Oakdale Exit 48 cluster (Love's #345 + CAT, Road Ranger, Award Winning Truck Wash); TA Express New Lisbon; the Mauston Exit 69 cluster (Kwik Trip #775, Pilot #164 + CAT, BP plaza); Lyndon Station BP; Wisconsin Dells + Lake Delton Kwik Trips; and the Lyndon/Mauston rest areas + Craig's Towing.
- **B — South (22):** Portage → IL line. The Portage node (Petro #403 + CAT + Blue Beacon); the DeForest/Windsor freight cluster (Kwik Trip #557 + #673, TA Madison #050 + CAT, Truckers Inn/ONE9); Edgerton Travel Plaza; the Janesville cluster (TA #071 + CAT, Road Ranger, Pomp's Tire); Beloit (Pilot #289 + CAT, Speedway, Dewey's Towing); the Beloit weigh station; Janesville rest area + Beloit welcome center; and two CDL schools (Blackhawk Tech, Madison College).

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (TA/Petro, Love's, Pilot, Kwik Trip, Blue Beacon, CAT Scale, Pomp's, WisDOT) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- Cross-segment reconciliation at the Portage node: Petro #403 + its CAT scale each kept once (South, with the co-located Blue Beacon). Nine distinct CAT scales corridor-wide, each kept once.
- Tomah's Kwik Trip #796 + CAT are signed I-94 Exit 143 at the split; interstate kept I-90 per the concurrency with the I-94 exit noted. Rest areas/weigh stations with no numbered exit assigned the nearest named I-90 locality.
- **Omitted, not fabricated:** the smaller Tomah Kwik Trip c-store (uncertain exit/parking); unverified Pilot dealer numbers at Oakdale Exit 47 / Exit 27; hotels advertising truck parking on this stretch (none verifiable); the I-94-only Millston rest area. Road Ranger Oakdale brand status flagged as possibly changed.
- **No coordinates** (separate geocoding workflow). No internal duplicates; no collision against the (empty) WI production set.
