# Batch 43 — I-70 Pennsylvania: Review Summary

CSV: `data/imports/i70-pennsylvania-batch-043.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). Pennsylvania has **0** existing
production rows, so this is first coverage of the state. **Nothing has been
imported to production.**

This batch covers I-70 across **Pennsylvania**, from the West Virginia line to the
point where I-70 leaves the Pennsylvania Turnpike at Breezewood. It runs West (the
WV line / Claysville, Washington, Bentleyville, Smithton on free I-70) and East
(Somerset, Bedford, and the Breezewood cluster, where I-70 is concurrent with the
I-76 Turnpike).

## Totals

- Total rows in CSV: **13**
- Expansion verdict — ready-to-publish: **4**
- Expansion verdict — import-unpublished (held, documented): **9**
- manual-review / reject: **0 / 0**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by state

| State | Rows | Ready | Held |
| --- | --- | --- | --- |
| PA | 13 | 4 | 9 |

## Rows by category

| Category | Rows | Ready | Held |
| --- | --- | --- | --- |
| Truck Stops & Travel Centers | 10 | 4 | 6 |
| Truck Parking | 1 | 0 | 1 |
| CAT Scales | 1 | 0 | 1 |
| Weigh Stations | 1 | 0 | 1 |
| **Total** | **13** | **4** | **9** |

## Corridor coverage (WV line → Breezewood)

- Distinct I-70 exits represented: **5** — 17, 32B, 49, 110, 161. Several
  Breezewood-cluster and Turnpike-plaza rows carry blank exits (reached via the
  US-30 interchange or milepost-based Turnpike access, not a numbered free-I-70 exit).

## Rows by city (west → east)

| City | Rows |
| --- | --- |
| Claysville | 2 |
| Washington | 1 |
| Bentleyville | 2 |
| Smithton | 1 |
| Somerset | 1 |
| Bedford | 2 |
| Breezewood | 4 |

## Segments

- **A — West (6):** WV line → Smithton on free I-70: the 24/7 Travel Store
  (Washington, Exit 17), Pilot #348 (Bentleyville, Exit 32B) + its CAT Scale,
  Flying J #620 (Smithton, Exit 49), and the eastbound PA Welcome Center rest area
  + adjacent eastbound weigh station near Claysville (MM5).
- **B — East (7):** Somerset → Breezewood on the I-70/I-76 Turnpike concurrency:
  Somerset Travel Center (Exit 110), the North and South Midway service plazas
  (MM 147.3, Bedford), and the four-stop Breezewood cluster (Exit 161 / US-30) —
  TA Breezewood, Gateway Travel Plaza, Pilot Travel Center Breezewood, and the
  Mega Truck Stop (former Flying J).

## Accuracy & exclusions

- Every row web-verified 2026-07-15 against official brand/operator locators
  (Pilot/Flying J, TA/Petro, PA Turnpike, CAT Scale) with directory sites as
  secondary confirmation. Per-row sources in `-sources.md`.
- No field invented: unverifiable addresses/phones/exits/ZIPs are blank (24/7
  Travel Store address, Turnpike plaza addresses/phones, some Breezewood exits).
  The Gateway Travel Plaza address (16563 Lincoln Hwy) is flagged lower-confidence
  in its source note (a hinted 16621 differed).
- **Omitted, not fabricated:** the Claysville Petro/Veteran's Truck Stop
  (permanently closed) and the Sideling Hill Service Plaza (on I-76 east of the
  I-70 split, not on I-70).
- The generic "Pilot Travel Center" (Breezewood) is stored as **"Pilot Travel
  Center Breezewood"** to keep the name and detail slug distinct from other-city
  Pilots.
- **No coordinates** (geocoding is a separate verified workflow). No internal
  duplicates; no collision against the (empty) PA production set.
