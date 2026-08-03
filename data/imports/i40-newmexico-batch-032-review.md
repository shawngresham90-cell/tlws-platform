# Batch 32 — I-40 New Mexico: Review Summary

CSV: `data/imports/i40-newmexico-batch-032.csv` · verified 2026-07-14 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). **Nothing has been imported to
production.**

This batch continues I-40 west out of the Texas Panhandle across **New Mexico** —
the Texas line at Glenrio (Russell's), through Tucumcari, Santa Rosa, Clines
Corners and Moriarty, the **Albuquerque** freight hub (the I-40/I-25 interchange
and the west-side / Rio Puerco cluster), and west through Milan/Grants, Jamestown
and Gallup to the Arizona line. It connects the I-40 Texas batch (draft PR #70)
to a future I-40 Arizona batch. New Mexico had **0** existing I-40 production rows
— first coverage of the state and corridor.

## Totals

- Total rows in CSV: **23**
- Expansion verdict — ready-to-publish: **15**
- Expansion verdict — import-unpublished (held, documented): **8**
- manual-review / reject: **0 / 0**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by state

| State | Rows | Ready | Held |
| --- | --- | --- | --- |
| NM | 23 | 15 | 8 |

## Rows by category

| Category | Rows | Ready | Held |
| --- | --- | --- | --- |
| Truck Stops & Travel Centers | 16 | 12 | 4 |
| CAT Scales | 1 | 1 | 0 |
| Tire Repair | 1 | 1 | 0 |
| Truck Washes | 1 | 0 | 1 |
| Roadside Service | 2 | 1 | 1 |
| Weigh Stations | 2 | 0 | 2 |
| **Total** | **23** | **15** | **8** |

Held rows are import-unpublished because a source did not confirm a street
address or exit number and blank was kept over a guess — the two NM ports of
entry (San Jon, Gallup, no published street/exit), the mobile roadside provider
(dispatched, no fixed address), and the Rio Puerco travel center (ZIP unverified).
They import cleanly and can be published once a field is verified.

## Corridor coverage (TX line → Albuquerque → AZ line)

- Distinct I-40 exits represented: **13** — 16, 39, 79, 140, 149, 153, 159, 194, 196, 218, 277, 333, 369

## Rows by city (east → west)

| City | Rows |
| --- | --- |
| Glenrio | 1 |
| San Jon | 1 |
| Tucumcari | 1 |
| Santa Rosa | 2 |
| Clines Corners | 1 |
| Moriarty | 2 |
| Albuquerque | 7 |
| Rio Puerco | 1 |
| Milan | 2 |
| Jamestown | 1 |
| Gallup | 4 |

## Segments

- **A — East (8):** TX line at Glenrio (Exit 369) → Moriarty (Exit 194): Russell's Truck & Travel, San Jon port of entry, Love's #262 Tucumcari (CAT Scale), the Santa Rosa pair (TA + Love's #285, Exit 277), Clines Corners Travel Center (I-40/US-285), and the Moriarty pair (Pilot #475, TA).
- **B — Albuquerque metro (8):** the I-40/I-25 interchange and west-side cluster (Exits 140–159): TA Albuquerque + its CAT Scale, Love's #614 (Exit 149), Flying J #689 (Exit 153), Route 66 Travel Center at Rio Puerco (Exit 140), Commercial Tire, the Corning truck wash at the Flying J plaza, and Interstate Fleet mobile roadside service.
- **C — West (7):** Milan/Grants (Exit 79) → Gallup (Exit 16): Petro #313 & Love's #257 Milan, Pilot/Flying J #305 at Jamestown/Giant Crossing (Exit 39), the Gallup pair (Love's #215 + TA #008, Exit 16), the Gallup port of entry, and Speedway Towing.

## Accuracy & exclusions

- Every row web-verified 2026-07-14 against official brand locators (Love's, Pilot/Flying J, TA/Petro, CAT Scale, Clines Corners, Russell's, Route 66 Casino) with directory/review sites as secondary confirmation. Per-row sources in `-sources.md`.
- No field invented: unverifiable address/ZIP/phone/exit values are blank (Russell's street, Clines Corners street/ZIP, Rio Puerco ZIP, both port-of-entry addresses/exits).
- **Honest naming:** the west-side Albuquerque truck wash at 9920 Avalon Rd NW was listed by an older directory as "Blue Beacon" but current listings show it as Corning/Coss Truck Wash — reported under its current name with the history noted, not asserted as Blue Beacon.
- **No cross-segment duplicates:** the east/ABQ/west segments cover disjoint exit ranges (194+, 140–159, 16–79); 0 rows deduped.
- Lupton (AZ side of the state line) is out of scope for NM and was not included. Towns with no verified on-I-40 facility (San Jon town, Newkirk, Edgewood, Laguna, Mesita, Thoreau, Continental Divide) were omitted rather than fabricated.
