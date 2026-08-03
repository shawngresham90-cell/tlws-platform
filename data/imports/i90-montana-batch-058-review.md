# Batch 58 — I-90 Montana: Review Summary

CSV: `data/imports/i90-montana-batch-058.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). Montana has **0** existing production rows
— first coverage of the state. **Nothing has been imported to production.**

Covers I-90 across **Montana**, from the Idaho line at Lookout Pass east through
Missoula, Butte, Bozeman, Livingston, Billings, and Hardin to the Wyoming/South
Dakota line. West (Lookout Pass → Deer Lodge), Central (Deer Lodge → Big Timber),
East (Columbus → WY/SD line).

## Totals
- Total rows in CSV: **51**
- ready-to-publish: **25** · import-unpublished (held): **26** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 22 |
| CAT Scales | 8 |
| Truck Washes | 5 |
| Tire & Repair | 4 |
| Roadside Service | 3 |
| Weigh Stations | 3 |
| Truck Parking | 5 |
| Hotels with Truck Parking | 1 |
| **Total** | **51** |

## Segments
- **A — West (14):** Lookout Pass → Deer Lodge. TA Missoula + Flying J/Town Pump #914 (Exit 96) with CAT scale, Town Pump Superior (47), St. Regis Conoco/Cenex (33), Fic's Plaza (Deer Lodge 184), Missoula washes/Pomp's Tire/roadside, the Saltese weigh station, and the Dena Mora & Quartz Flats rest areas.
- **B — Central (19):** Deer Lodge → Big Timber. Town Pump Deer Lodge, the Butte/Rocker cluster (Town Pump/Pilot #908 + Flying J #924 on the I-90/I-15 concurrency) with CAT scale + port of entry, Whitehall (249), Three Forks (274), the Belgrade cluster (Town Pump/Pilot #1013 + Broadway Flying J + MCM Truck Repair), Bozeman, Livingston (333), and Big Timber Town Pump #922 + Super 8.
- **C — East (18):** Columbus → WY/SD line. Pilot Columbus (408), the Laurel cluster (Love's #1043 Exit 432 + TA Laurel Exit 437) with CAT scales, the Billings cluster (Flying J #923 + Pilot #915 at Exit 455) with CAT scales + Pomp's Tire + Fly In/Hoogies washes + Hanser's towing, Love's Hardin (495), the Hardin MCS weigh station, and the Greycliff/Columbus/Hardin rest areas.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (TA/Petro, Love's, Pilot/Flying J, Town Pump, Broadway Group, CAT Scale, Pomp's, MDT) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- Cross-segment reconciliation: Fic's Plaza (Deer Lodge) and the Big Timber Town Pump each kept once. Four Pomp's Tire locations disambiguated by city.
- Butte/Rocker facilities on the I-90/I-15 concurrency noted in-description; two blank-city rest areas assigned nearest named locality.
- **Omitted, not fabricated:** no Love's between Missoula and Laurel; the Bozeman Town Pump address/exit unverified; mobile-only tire/repair dispatch networks.
- **No coordinates** (separate geocoding workflow). No internal duplicates; no collision against the (empty) MT production set.
