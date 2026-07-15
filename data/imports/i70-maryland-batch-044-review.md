# Batch 44 — I-70 Maryland: Review Summary

CSV: `data/imports/i70-maryland-batch-044.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). Maryland has **0** existing production
rows, so this is first coverage of the state. **Nothing has been imported to
production.**

**This batch completes I-70** — the corridor now runs, as drafts, from the western
terminus at I-15 (Cove Fort, Utah) to the eastern terminus at I-695 near Baltimore.
This batch covers I-70 across **Maryland**: West (the Big Pool/Clear Spring area and
Hagerstown at the I-68/I-81 interchanges, then South Mountain) and East (New
Market/Mount Airy through the Frederick corridor to the Baltimore terminus).

## Totals

- Total rows in CSV: **11**
- Expansion verdict — ready-to-publish: **4**
- Expansion verdict — import-unpublished (held, documented): **7**
- manual-review / reject: **0 / 0**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by state

| State | Rows | Ready | Held |
| --- | --- | --- | --- |
| MD | 11 | 4 | 7 |

## Rows by category

| Category | Rows | Ready | Held |
| --- | --- | --- | --- |
| Truck Stops & Travel Centers | 3 | 3 | 0 |
| CAT Scales | 1 | 0 | 1 |
| Tire & Repair | 2 | 1 | 1 |
| Roadside Service | 1 | 0 | 1 |
| Truck Parking | 3 | 0 | 3 |
| Weigh Stations | 1 | 0 | 1 |
| **Total** | **11** | **4** | **7** |

## Corridor coverage (WV/PA line → Baltimore terminus)

- Distinct I-70 exits represented: **2** — Exit 12 (Big Pool) and Exit 24
  (Hagerstown Pilot #150). Most other rows (welcome centers, weigh station, truck
  rest area, corridor tire/road-service operators, and the Pilot #179 at the
  shared I-70/I-81 interchange) legitimately carry no numbered I-70 exit.

## Rows by city (west → east)

| City | Rows |
| --- | --- |
| Big Pool | 1 |
| Hagerstown | 3 |
| Myersville | 2 |
| New Market | 2 |
| Mount Airy | 1 |
| Frederick | 2 |

## Segments

- **A — West (7):** Big Pool/Clear Spring & Hagerstown → South Mountain: AC&T Big
  Pool (Exit 12), Pilot #150 (Exit 24) + its CAT Scale, Pilot #179 (I-70/I-81
  interchange), the South Mountain Welcome Centers (both directions, Myersville),
  and the New Market Weigh & Inspection Facility.
- **B — East (4):** New Market/Mount Airy → Frederick → Baltimore terminus: the
  eastbound truck-only rest area (Mount Airy area) and three Frederick corridor
  service operators — STTC, Butler Tire Service, and Derek's Towing & Recovery.

## Accuracy & exclusions

- Every row web-verified 2026-07-15 against official brand/operator locators
  (Pilot/Flying J, STTC, Butler Tire, Maryland State Police, MDOT SHA, CAT Scale)
  with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- No field invented: government/parking facilities (welcome centers, weigh station,
  truck rest area) legitimately have no street address/phone/website — left blank.
- **Cross-segment reconciliation:** both researchers returned the New Market Weigh
  & Inspection Facility (East with a "(TWIS)" suffix). It is a single facility and
  is included **once** (West segment); the East "(TWIS)" duplicate was dropped
  before compile. Parser confirms 0 internal duplicate keys.
- **Omitted, not fabricated:** Love's Hagerstown (on I-81 Exit 10A, not I-70) and
  the Hancock Truck Plaza (conflicting "closed" signals). Pilot #179's I-70 exit
  left blank (shared I-70/I-81 interchange; number unverified).
- **No coordinates** (geocoding is a separate verified workflow). No collision
  against the (empty) MD production set.
