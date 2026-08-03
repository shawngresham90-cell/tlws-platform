# Batch 48 — I-80 Wyoming: Review Summary

CSV: `data/imports/i80-wyoming-batch-048.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). Wyoming has **0** existing production
rows — first coverage of the state. **Nothing has been imported to production.**

Covers I-80 across **Wyoming**, a major high-elevation freight corridor with
severe winter weather: West (Evanston at the Utah line, Fort Bridger/Lyman, Little
America, Green River, Rock Springs, Wamsutter, to Rawlins) and East (Rawlins,
Laramie, over Sherman Summit, to Cheyenne and Pine Bluffs at the Nebraska line).

## Totals
- Total rows in CSV: **41**
- ready-to-publish: **27** · import-unpublished (held): **14** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 16 |
| CAT Scales | 7 |
| Tire & Repair | 5 |
| Truck Washes | 2 |
| Weigh Stations | 3 |
| Truck Parking | 7 |
| Hotels with Truck Parking | 1 |
| **Total** | **41** |

## Segments
- **A — West (21):** Evanston→Rawlins. Flying J #761 (Evanston Exit 3), TA Ft. Bridger (30), Little America fuel center + hotel (68), Love's #888 (Green River 85), Flying J #764 + TA Express (Rock Springs 104), Love's #310 (Wamsutter 173), Flying J #763 + TA Rawlins (209/214), their CAT scales, Boss Truck Shop & Reliable Truck Repair (Rawlins tire), Wyoming Trucks Wash (Rock Springs), the Evanston & Rawlins weigh stations, and the Fort Bridger (34) & Lyman (41) truck-parking/rest areas.
- **B — East (20):** Rawlins→Pine Bluffs. Petro Laramie #303 + Love's #723 (Laramie 310), Pilot #402 (Cheyenne 367) & TA Cheyenne (Burns 377), the I-80/I-25 interchange cluster (Flying J #759, Love's #220, Blue Beacon), the Pine Bluffs Sinclair (401), CAT scales, TA/Petro truck-service shops (Rawlins/Laramie/Cheyenne), the Cheyenne Port of Entry, and the Fort Steele/Wagonhound/Quealy Dome/Summit/Pine Bluffs rest & truck-parking areas.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (Love's, Pilot/Flying J, TA/Petro, Sinclair, CAT Scale, WHP ports of entry, WYDOT) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- No field invented: rest-area/port addresses and several phones/exits left blank where unverified.
- Rawlins (Exits 209/214) cross-segment overlap reconciled: shared stops/scale/weigh-station kept once; East keeps only its unique TA Truck Service listing.
- The Cheyenne I-80/I-25 interchange cluster is signed I-25 Exit 7 but serves I-80 freight — blank I-80 exit, noted in-description.
- **Omitted, not fabricated:** Love's Rock Springs "#603/Exit 102" (not on the official Love's locator, unverified); un-detailed WYDOT pull-offs not padded.
- **No coordinates** (separate geocoding workflow). No internal duplicates; no collision against the (empty) WY production set.
