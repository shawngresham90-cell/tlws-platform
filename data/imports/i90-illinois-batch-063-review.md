# Batch 63 — I-90 Illinois: Review Summary

CSV: `data/imports/i90-illinois-batch-063.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`), with the **12-row live-IL avoid-list applied**.
**Nothing has been imported to production.**

Covers I-90 across **northern Illinois** — the Jane Addams Memorial Tollway — from the
Wisconsin line at South Beloit through Rockford, Belvidere, Hampshire and Elgin, then
the Chicago Kennedy/Skyway urban stretch to the Indiana line. West (WI line → Hampshire),
East (Elgin → Chicago → IN line).

## Totals
- Total rows in CSV: **17**
- ready-to-publish: **13** · import-unpublished (held): **4** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 5 |
| CAT Scales | 3 |
| Roadside Service | 3 |
| Truck Parking (oasis / welcome center) | 2 |
| Tire & Repair | 2 |
| Truck Washes | 1 |
| CDL Schools | 1 |
| **Total** | **17** |

## Rows by city
Rockford 5 · Hampshire 4 · South Beloit 3 · Elgin 2 · Belvidere 1 · Gilberts 1 · Schaumburg 1

## Segments
- **A — West (13):** WI line → Hampshire. Road Ranger #536 + CAT (South Beloit Exit 1); the Illinois Welcome Center (Turtle Creek); Pilot #535/Road Ranger + CAT, Pomp's Tire, Meiborg Enterprises, and Rock Valley College CDL (south Rockford, via US-20); the Belvidere Oasis (over-the-highway tollway plaza); and the Hampshire Exit 42 cluster — TA Elgin #044, Love's #763, Road Ranger #543 (each with CAT service) plus one standalone Hampshire CAT Scale.
- **B — East (4):** Elgin → Chicago → IN line. Corridor service operators only (the urban Kennedy/Skyway has no on-highway truck stops): Pomp's Tire and Ultimate Spray-N-Wash (Elgin), Schock's Towing (Gilberts), Speedy G Towing (Schaumburg).

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (Road Ranger, Pilot, TA/Petro, Love's, CAT Scale, Pomp's, Illinois Tollway, IDOT) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- **Dedup:** the 12 live-IL production rows (all in Metropolis/Vienna on the far-southern I-24 corridor) were applied as an avoid-list — 0 collisions, 0 dup hits, as expected (no city overlap with the northern I-90 corridor). Distinct from the I-80 IL draft (Joliet/south suburbs) and I-70 IL (St. Louis metro) — different cities.
- Off-corridor near-I-90 facilities (south-Rockford Pilot/US-20, Pomp's Rockford, Meiborg, Rock Valley) reached via the US-20 freeway are noted in-description with exit blank. The Belvidere Oasis is an over-the-highway tollway plaza (exit blank, MM 24 noted).
- **Omitted, not fabricated:** no verifiable I-90 truck stops/CAT scales/weigh stations on the Kennedy/Skyway urban stretch; O'Hare/Rosemont hotels advertise parking on I-190/I-294 (not I-90); the Des Plaines Oasis (demolished 2014); Cassidy Tire / All Fleet (no verifiable Elgin/Schaumburg address).
- **No coordinates** (separate geocoding workflow). No internal duplicates; no collision against the live IL production set.
