# Batch 75 — I-95 Pennsylvania: Review Summary

CSV: `data/imports/i95-pennsylvania-batch-075.csv` · verified 2026-07-15 · dry-run validated
against the live import parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`). Pennsylvania has **0** existing production rows — first live coverage of
the state (the I-70/I-80/I-90 PA batches remain unmerged drafts). **Nothing has been imported
to production.**

Covers the **Pennsylvania** stretch of I-95 — the Philadelphia/Delaware Valley corridor from
the Delaware line at Marcus Hook north through Chester, the Philadelphia International Airport
belt, Center City and Northeast Philadelphia, into Bucks County (Bensalem, Bristol, Levittown,
Fairless Hills) to the New Jersey line at the Scudder Falls Bridge. South (DE line → Center
City), North (North Philadelphia → NJ line).

## Totals
- Total rows in CSV: **21**
- ready-to-publish: **15** · import-unpublished (held): **6** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Tire & Repair | 5 |
| Roadside Service | 4 |
| CDL Schools | 4 |
| Truck Washes | 3 |
| Truck Parking | 2 |
| Truck Stops & Travel Centers | 1 |
| Weigh Stations | 1 |
| CAT Scales | 1 |
| **Total** | **21** |

## Rows by city (top)
Philadelphia 9 · Bensalem 5 · Bristol 2 · Linwood 2 · (Essington, Fairless Hills, Levittown 1)

## Segments
- **A — South (10):** DE line/Marcus Hook → Center City. The PennDOT Welcome Center + co-
  located Linwood weigh station (MM 1); Joey's truck/trailer repair near the airport; South
  Philly, SCS and Countywide heavy towing; Fleet Clean and PA Truck Wash mobile washes; and
  the AAA School of Trucking (Fishtown) and All-State Career (Essington) CDL campuses. **No
  truck stops or CAT scales exist in the Chester-to-Center-City stretch — none fabricated.**
- **B — North (11):** North Philadelphia → NJ line. The corridor's **only full-service truck
  stop**, Penn Jersey Diesel / Bensalem Travel Plaza (Exit 37), with the only PA I-95 CAT
  scale (#1316) and the co-located Philadelphia I-95 secure truck park; McCarthy Tire
  (Philadelphia + Levittown), PA Truck Center, Burns Auto diesel repair; Rob's heavy towing
  (Bristol); Quala tank wash (Bensalem); and Gladiator and SSS CDL academies.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official operator sites, PennDOT welcome-center
  pages, catscale.com and commercial-tire dealer locators, with directory sites as secondary
  confirmation. Per-row sources in `-sources.md`.
- **Dense urban Philadelphia is deliberately sparse:** only Penn Jersey (Bensalem) is a true
  truck stop on all of PA I-95; the rest are commercial tire/repair, heavy towing, tank/fleet
  washes, weigh station and CDL schools. No truck stops or CAT scales fabricated for the city.
- **Cross-segment reconciliation:** AAA School of Trucking (442 E Girard, Exit 22) surfaced in
  both segments — kept once, in the south.
- **Excluded:** a TruckParkingClub-brokered bobtail/box-truck lot in Chester (private
  third-party listing, not a public facility) was omitted to keep 0 TPC URLs / no affiliate
  codes, consistent with prior batches.
- **Omitted, not fabricated:** no fixed weigh station claimed in the northern segment (PA runs
  portable enforcement there); no hotel-truck-parking invented; no coordinates.
- **Dedup:** PA production is empty (0 rows); no collisions possible. No internal duplicates.
