# Batch 45 — I-80 California: Review Summary

CSV: `data/imports/i80-california-batch-045.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). California has **0** existing production
rows on I-80 — first coverage of this corridor in the state. **Nothing has been
imported to production.**

Covers I-80 across **California**, from the San Francisco Bay Area east through
the Sacramento metro and over Donner Pass to the Nevada line at Verdi, in three
segments: West (Bay Area → Vacaville), Central (Dixon → Sacramento → Roseville),
and Sierra (Auburn → Truckee → NV line).

## Totals
- Total rows in CSV: **23**
- ready-to-publish: **10** · import-unpublished (held): **13** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 6 |
| CAT Scales | 3 |
| Truck Washes | 1 |
| Tire & Repair | 3 |
| Roadside Service | 2 |
| Truck Parking | 4 |
| Weigh Stations | 3 |
| Hotels with Truck Parking | 1 |
| **Total** | **23** |

## Segments
- **A — West / Bay Area (5):** Vaca Valley Travel Center (Vacaville Exit 57), the Cordelia Truck Scales (Suisun City), Hunter Hill westbound rest area (Vallejo), and the co-located North Bay Truck Center & A & T Road Service (Fairfield).
- **B — Central / Sacramento (12):** the Sacramento 49er Travel Plaza cluster (plaza, CAT scale, truck wash, motel — Exit 85), West Sac Truck Stop (Exit 81), Ramos Oil Co Dixon (Exit 66) + its CAT scale, Pacific Pride cardlock parking (Roseville), the Maverik #654 CAT scale (West Sacramento), the Antelope weigh station, and A Plus Truck Repair & Radial Tire Center (West Sacramento).
- **C — Sierra / Donner Pass (6):** Lucky's Travel Plaza (Cisco Grove Exit 165), Sierra Superstop 13 (Dutch Flat Exit 145), the CHP Donner Pass scale (Truckee), the Gold Run EB/WB rest areas (Exit 144), and McCrary's mobile tire (Truckee corridor).

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators and CHP/Caltrans sources, with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- No field invented: weigh-station/rest-area addresses and several phones/exits left blank where unverified.
- **Ramos Oil Dixon (Exit 66)** cross-segment overlap reconciled: kept once as the truck stop plus one clean co-located CAT-scale row.
- **Omitted, not fabricated:** the urban Bay Area has essentially no true truck stops; Sacramento-area facilities on I-5/US-50/SR-99 excluded per the corridor restriction; early-search "Love's" locations in Dixon/West Sacramento were fabrications and were rejected (the 4790 W Capitol site is the independent West Sac Truck Stop/ARCO).
- Two mobile providers (McCrary's Mobile Tire, A & T Road Service) recorded at their documented corridor base cities to satisfy the required city field.
- **No coordinates** (separate geocoding workflow). No internal duplicates; no collision against the (empty) CA I-80 production set.
