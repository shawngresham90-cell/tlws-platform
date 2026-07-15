# Batch 55 — I-80 New Jersey: Review Summary

CSV: `data/imports/i80-new-jersey-batch-055.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). New Jersey has **0** existing production
rows — first coverage of the state. **Nothing has been imported to production.**

Covers the entirety of I-80 across **New Jersey**, from the Delaware Water Gap at
the Pennsylvania line east through Netcong and Parsippany to the eastern terminus
at Teaneck (I-95/US-46). This is a dense suburban/urban corridor with essentially
one true truck stop.

## Totals
- Total rows in CSV: **8**
- ready-to-publish: **2** · import-unpublished (held): **6** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 1 |
| CAT Scales | 1 |
| Weigh Stations | 1 |
| Truck Parking | 5 |
| **Total** | **8** |

## Segment
- **A — Full (8):** TA Columbia (Exit 4, Route 94) — the only major truck stop on I-80 in NJ — and its CAT scale (the only one on NJ I-80); the eastbound Knowlton weigh/inspection station (MM2); and five I-80 rest-area/wayside truck-parking areas (Knowlton MM7, Allamuchy MM21 EB/WB, Wharton MM32 EB and truck-only WB).

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (TA/Petro, CAT Scale, NJDOT, NJ rest-area guides) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- No field invented: rest-area/weigh-station addresses/phones left blank where unverified.
- **Omitted, not fabricated:** no Pilot/Flying J/Love's on I-80 in NJ (their NJ sites are on I-78/other roads); no verifiable fixed truck wash, tire-repair, or roadside-service facility on/at I-80 (only regional mobile dispatch outfits, excluded); no hotel with truck parking tied to an I-80 exit. Reported honestly, not padded.
- **No coordinates** (separate geocoding workflow). No internal duplicates; no collision against the (empty) NJ production set.
