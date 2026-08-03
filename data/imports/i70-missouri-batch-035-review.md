# Batch 35 — I-70 Missouri: Review Summary

CSV: `data/imports/i70-missouri-batch-035.csv` · verified 2026-07-14 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). **Nothing has been imported to
production.**

This batch **opens the I-70 corridor** — the next priority corridor after I-40 —
starting with **Missouri**, one of the busiest freight stretches on I-70. It runs
the Kansas City metro east through Oak Grove, Odessa, Concordia and Boonville, the
central hub at **Kingdom City** (I-70/US-54) plus Columbia and Warrenton, and east
through the **Foristell** Exit 203 cluster and St. Peters toward St. Louis.
Missouri had **0** existing I-70 production rows — first coverage of the state and
corridor.

## Totals

- Total rows in CSV: **25**
- Expansion verdict — ready-to-publish: **16**
- Expansion verdict — import-unpublished (held, documented): **9**
- manual-review / reject: **0 / 0**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by state

| State | Rows | Ready | Held |
| --- | --- | --- | --- |
| MO | 25 | 16 | 9 |

## Rows by category

| Category | Rows | Ready | Held |
| --- | --- | --- | --- |
| Truck Stops & Travel Centers | 15 | 10 | 5 |
| CAT Scales | 3 | 2 | 1 |
| Tire Repair | 3 | 2 | 1 |
| Truck Washes | 1 | 1 | 0 |
| Truck Parking | 2 | 0 | 2 |
| Weigh Stations | 1 | 1 | 0 |
| **Total** | **25** | **16** | **9** |

Held rows are import-unpublished because a source did not confirm a street
address, ZIP or exit (the Break Time and rest-area parking entries, the Foristell
MSHP scale house, and a few co-located Speedco/CAT rows missing a phone). They
import cleanly and can be published once a field is verified.

## Corridor coverage (KC metro → Kingdom City → St. Louis approach)

- Distinct I-70 exits represented: **12** — 28, 37, 49, 58, 101, 121, 128A, 148, 175, 188, 203, 222

## Rows by city (west → east)

| City | Rows |
| --- | --- |
| Oak Grove | 3 |
| Odessa | 1 |
| Higginsville | 1 |
| Concordia | 2 |
| Boonville | 2 |
| Midway | 1 |
| Columbia | 1 |
| Kingdom City | 3 |
| New Florence | 2 |
| Warrenton | 2 |
| Wright City | 1 |
| Foristell | 5 |
| St. Peters | 1 |

## Segments

- **A — West (9):** KC metro → Boonville (Exits 28–101): the Oak Grove cluster (Love's #940 + its Speedco, Petro Stopping Center), Odessa BP, Pilot #443 Higginsville, TA #018 Concordia + its CAT Scale, and the Boonville pair (Pilot #44, Love's #347).
- **B — Central (9):** Midway/Columbia → Kingdom City hub → Warrenton (Exits 121–188): Midway Travel Plaza, Break Time (Columbia US-63), the **Kingdom City Exit 148 hub** (Petro/TA #318, Westland Travel Center, Quality Truck Washes), Love's #788 New Florence + its Speedco, and Flying J #674 Warrenton + its CAT Scale.
- **C — East (7):** Wright City → Foristell → St. Peters (Exits 198–222): the **Foristell Exit 203 cluster** (TA Foristell, Mr. Fuel Pilot/Flying J dealer + its CAT Scale, Best-One Tire, the MSHP scale house), the Wright City eastbound rest area, and QuikTrip #608 St. Peters.

## Accuracy & exclusions

- Every row web-verified 2026-07-14 against official brand locators (Love's, Pilot/Flying J, TA/Petro, CAT Scale, Quality Truck Washes) with directory/review sites as secondary confirmation. Per-row sources in `-sources.md`.
- No field invented: unverifiable address/ZIP/phone/exit values are blank (Break Time address/ZIP/phone, Speedco/CAT phones, MSHP scale-house exit, rest-area street).
- **Researcher accuracy corrections honored:** the Ashley Rd Love's/Pilot are in Boonville (Exit 101), correctly placed in the West segment, not double-counted in Central; Love's #788 is listed under New Florence (Exit 175) per Love's own page, not High Hill; an unconfirmed Grain Valley "Pilot" and a Blue Beacon with a non-matching exit were excluded rather than fabricated.
- **No cross-segment duplicates:** West/Central/East cover disjoint exit ranges (28–101, 121–188, 198–222); 0 rows deduped.
