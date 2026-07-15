# Batch 65 — I-90 Pennsylvania (Erie corner): Review Summary

CSV: `data/imports/i90-pennsylvania-batch-065.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). Pennsylvania has **0** existing production rows
— first coverage of the state. **Nothing has been imported to production.**

Covers the entire **I-90 stretch across northwestern Pennsylvania** (~46 mi), from the
Ohio line at West Springfield east through Girard, Erie (I-79 junction), Harborcreek,
and North East to the New York line near Ripley. Single segment.

## Totals
- Total rows in CSV: **16**
- ready-to-publish: **8** · import-unpublished (held): **8** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 4 |
| CAT Scales | 2 |
| Truck Parking (welcome centers) | 2 |
| Roadside Service | 2 |
| CDL Schools | 2 |
| Truck Washes | 1 |
| Weigh Stations | 1 |
| Tire & Repair | 1 |
| Hotels with Truck Parking | 1 |
| **Total** | **16** |

## Rows by city
Erie 9 · Harborcreek 3 · North East 2 · West Springfield 2

## Highlights
- **Erie Exit 27 hub:** Pilot #311 + its CAT scale, Sheetz, Super 8 (truck parking), plus Erie-area tire/mobile-repair and two CDL schools (PA Pride/RCTC, IMBC).
- **Harborcreek Exit 35 hub:** TA Harborcreek #215 + its CAT scale, Blue Beacon truck wash, BR Czarnecki heavy-duty towing.
- **North East Exit 45:** Kwik Fill A/T Plaza #228 near the NY line.
- **Milepost facilities:** the West Springfield EB welcome center + weigh station (OH line) and the North East WB welcome center (NY line).

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (Pilot, TA/Petro, Blue Beacon, Kwik Fill, CAT Scale, PennDOT, Wyndham) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- Two distinct CAT scales (Erie Pilot #311, Harborcreek TA #215), each kept once. Milepost welcome centers/weigh station left exit blank with MM noted; nearest named I-90 locality used for city.
- Distinct from the I-80 PA draft (central: Clarion/DuBois/Stroudsburg) and the I-70 PA draft (SW: Washington/New Stanton/Breezewood) — the Erie corner has no city overlap.
- **Omitted, not fabricated:** the "Love's #820 Exit 41" that appears in some directory summaries is actually in Waterloo NY on the NY Thruway (I-90), not PA — excluded; no verifiable Love's/Flying J/Petro on the PA I-90 stretch.
- **No coordinates** (separate geocoding workflow). No internal duplicates; no collision against the (empty) PA production set.
