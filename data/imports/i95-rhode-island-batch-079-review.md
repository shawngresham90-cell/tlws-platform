# Batch 79 — I-95 Rhode Island: Review Summary

CSV: `data/imports/i95-rhode-island-batch-079.csv` · verified 2026-07-15 · dry-run validated
against the live import parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`). Rhode Island has **0** existing production rows — first coverage of the
state. **Nothing has been imported to production.**

Covers the entire (~43-mile) **Rhode Island** stretch of I-95 — from the Connecticut line at
Hopkinton/Hope Valley northeast through Richmond, West Greenwich, East Greenwich, Warwick
(T.F. Green Airport), Cranston, Providence and Pawtucket to the Massachusetts line at
Attleboro. Single-segment batch.

## Totals
- Total rows in CSV: **10**
- ready-to-publish: **9** · import-unpublished (held): **1** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Roadside Service | 2 |
| Hotels with Truck Parking | 2 |
| Truck Stops & Travel Centers | 1 |
| CAT Scales | 1 |
| Tire & Repair | 1 |
| Weigh Stations | 1 |
| Truck Parking | 1 |
| CDL Schools | 1 |
| **Total** | **10** |

## Rows by city
Warwick 3 · West Greenwich 3 · Pawtucket 2 · Hope Valley 1 · Richmond 1

## Facilities
- **TA West Greenwich (Exit 5A)** — Rhode Island's only full-service truck stop on I-95 (BP
  diesel, ~180 truck spaces, service bays, showers, laundry), with the state's only I-95 **CAT
  scale**.
- **Sullivan Tire Commercial Truck Center** (Warwick) with 24-hour truck road service.
- **Sterry Street Towing** (Pawtucket) and **A Towing** (Warwick) — heavy-duty roadside/towing.
- The **RISP/RIDOT Richmond weigh/inspection station** (I-95 SB near the CT line) and the
  **Rhode Island Welcome Center** (Hope Valley, I-95 NB, mid-renovation with 24/7 temporary
  restrooms into late 2026).
- Two truck-parking hotels — **Best Western West Greenwich Inn** (Exit 6) and **Motel 6 Warwick**
  (Exit 13) — and the **NETTTS Rhode Island** CDL campus (Pawtucket).

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official operator sites, catscale.com, RIDOT and
  directory sites. Per-row sources in `-sources.md`.
- **Exit numbers reconciled to RI's 2022 milepost-based renumbering** — many third-party
  directories still list the old sequential numbers (e.g. "5B" for TA, "15" for Jefferson
  Blvd); current numbers used (TA = 5A, Jefferson Blvd = 13, Best Western Nooseneck = 6).
- **Genuinely scarce truck stops:** RI's short urban/suburban I-95 has only TA West Greenwich
  as a true truck stop — no Pilot/Flying J/Love's exists on the corridor, and none were
  fabricated.
- **Omitted, not fabricated:** milepost facilities (weigh station, welcome center) carry a
  blank exit; no coordinates.
- **Dedup:** RI production is empty (0 rows); no collisions possible. No internal duplicates.
