# Batch 41 — I-70 Ohio: Review Summary

CSV: `data/imports/i70-ohio-batch-041.csv` · verified 2026-07-14 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`), including **deduplication against the 95
existing Ohio production rows**. **Nothing has been imported to production.**

This batch covers I-70 across **Ohio** — the last I-70 dedup state. It runs West
(the Indiana line at New Paris, the Dayton-north corridor at Brookville/Huber
Heights, and Springfield), the **Columbus** metro (London, west Columbus, Etna),
and East (Hebron, **Zanesville**, **Cambridge** and the St. Clairsville area
toward the West Virginia line). Ohio already has **95** production rows — all on
**I-75** — so the compile hard-drops any name|city collision. The Vandalia Flying
J #97 sits at the shared I-70/I-75 interchange and was left to its existing I-75
listing. Result: **0 collisions**.

## Totals

- Total rows in CSV: **22**
- Expansion verdict — ready-to-publish: **13**
- Expansion verdict — import-unpublished (held, documented): **9**
- manual-review / reject: **0 / 0**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by state

| State | Rows | Ready | Held |
| --- | --- | --- | --- |
| OH | 22 | 13 | 9 |

## Rows by category

| Category | Rows | Ready | Held |
| --- | --- | --- | --- |
| Truck Stops & Travel Centers | 15 | 11 | 4 |
| CAT Scales | 2 | 0 | 2 |
| Truck Washes | 1 | 1 | 0 |
| Roadside Service | 2 | 1 | 1 |
| Weigh Stations | 2 | 0 | 2 |
| **Total** | **22** | **13** | **9** |

## Corridor coverage (IN line → Columbus → WV line)

- Distinct I-70 exits represented: **12** — 21, 36, 59, 79, 94, 118, 122, 126, 160, 178, 186, 208 (the New Paris cluster at the Indiana line is reached via the US-40 / Indiana Exit 156B interchange, so those Ohio rows carry a blank exit)

## Rows by city (west → east)

| City | Rows |
| --- | --- |
| New Paris | 5 |
| Brookville | 1 |
| Huber Heights | 1 |
| Springfield | 2 |
| London | 1 |
| West Jefferson | 1 |
| Columbus | 1 |
| Etna | 1 |
| Millersport | 1 |
| Hebron | 2 |
| Zanesville | 1 |
| Cambridge | 3 |
| Lore City | 1 |
| Belmont | 1 |

## Segments

- **A — West (9):** IN line → Springfield: the New Paris state-line cluster (Petro #357 + its CAT Scale + truck wash, New Paris Food Mart, EB Ohio-entry weigh station), Speedway Brookville (Exit 21), Speedway Huber Heights (Exit 36, Dayton-north), and Love's #605 Springfield (Exit 59) + its CAT Scale.
- **B — Columbus (4):** London → Etna (Exits 79–118): TA London #24, Love's #969 West Jefferson, Pilot #213 (west Columbus/Wilson Rd, Exit 94), Love's #892 Etna (Exit 118).
- **C — East (9):** Millersport/Hebron → St. Clairsville (Exits 122–208): Flying J #699 (Kirkersville, Exit 122), TA Hebron #39 + its TA Truck Service (Exit 126), Love's #221 Zanesville (Exit 160), the Cambridge cluster (Pilot #6 Exit 178, Go Mart #57 Lore City Exit 186, the WB weigh station, Pine Tree Towing), and Love's #563 Belmont/St. Clairsville (Exit 208, opened 2025).

## Accuracy & exclusions

- Every row web-verified 2026-07-14 against official brand locators (Love's, Pilot/Flying J, TA/Petro, Speedway, CAT Scale, coopsareopen) with directory/review sites as secondary confirmation. Per-row sources in `-sources.md`.
- No field invented: unverifiable address/phone/exit values are blank (Speedway Brookville phone with conflicting sources, New Paris Food Mart phone/ZIP, weigh-station addresses/exits, Pine Tree street address).
- **State-line honesty:** the New Paris Petro #357 (and its co-located rows) is physically in **Ohio** but reached via the Indiana Exit 156B / US-40 interchange — the Indiana batch correctly excluded it, and its Ohio `exit_number` is left blank rather than carry Indiana's number (which would collide with Ohio's own Exit 156 near Zanesville).
- **Dedup / reconciliation:** the Vandalia Flying J #97 was **not** re-added (already listed as I-75). The Columbus researcher also returned Flying J #699 (Kirkersville) and TA Hebron #39 — both kept once in the East segment; the unique TA Truck Service - Hebron was moved to East alongside them. Compiled against all 95 live OH `importDupKey` keys and 95 detail slugs — **0 collisions, 0 slug collisions**.
- **No coordinates** (geocoding is a separate verified workflow). No cross-segment duplicates after reconciliation (west ≤59, columbus 79–118, east 122–208).
