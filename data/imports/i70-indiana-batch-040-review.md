# Batch 40 — I-70 Indiana: Review Summary

CSV: `data/imports/i70-indiana-batch-040.csv` · verified 2026-07-14 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`), including **deduplication against the 99
existing Indiana production rows**. **Nothing has been imported to production.**

This batch covers I-70 across **Indiana**: West (Terre Haute, Brazil, Cloverdale
and the Clayton/Mooresville Exit-59 cluster), the **Indianapolis** metro (Holt Rd
and Post Rd on I-70), and East (Greenfield/Mt. Comfort, Knightstown, Cambridge
City and the **Richmond** hub toward the Ohio line). Indiana already has **99**
production rows — all on **I-65** — so the compile hard-drops any name|city
collision. Indianapolis is a multi-interstate hub, so this dedup was run
carefully; result: **0 collisions**.

## Totals

- Total rows in CSV: **20**
- Expansion verdict — ready-to-publish: **11**
- Expansion verdict — import-unpublished (held, documented): **9**
- manual-review / reject: **0 / 0**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by state

| State | Rows | Ready | Held |
| --- | --- | --- | --- |
| IN | 20 | 11 | 9 |

## Rows by category

| Category | Rows | Ready | Held |
| --- | --- | --- | --- |
| Truck Stops & Travel Centers | 13 | 6 | 7 |
| CAT Scales | 2 | 2 | 0 |
| Tire Repair | 2 | 2 | 0 |
| Roadside Service | 1 | 1 | 0 |
| Weigh Stations | 2 | 0 | 2 |
| **Total** | **20** | **11** | **9** |

## Corridor coverage (IL line → Indianapolis → Richmond/OH line)

- Distinct I-70 exits represented: **12** — 1, 7, 11, 23, 41, 59, 77, 91, 96, 115, 137, 149B

## Rows by city (west → east)

| City | Rows |
| --- | --- |
| Terre Haute | 2 |
| West Terre Haute | 1 |
| Brazil | 2 |
| Cloverdale | 1 |
| Clayton | 2 |
| Mooresville | 1 |
| Indianapolis | 3 |
| Greenfield | 2 |
| Knightstown | 2 |
| Cambridge City | 1 |
| Richmond | 3 |

## Segments

- **A — West (9):** IL line → Clayton/Mooresville (Exits 1–59): the West Terre Haute EB weigh station, Love's #664 (Exit 7) & Pilot #297 (Exit 11) at Terre Haute, the Brazil Exit-23 pair (Pilot #444, Petro Brazil), Cloverdale Travel Plaza (Exit 41), and the Exit-59 cluster (Love's Mooresville, TA Clayton #257 + its TA Truck Service).
- **B — Indianapolis (3):** on-I-70 metro stops: One9/Speedway #3700 (Holt Rd, Exit 77), Circle K (Post Rd, Exit 91), and Reliable Truck & Trailer (east-side tire/roadside).
- **C — East (8):** Greenfield → Richmond (Exits 96–149B): Pilot #30 + its CAT Scale (Greenfield/Mt. Comfort Exit 96), Love's #601 + its Truck Care (Knightstown Exit 115), AMBEST FuelMaster (Cambridge City Exit 137), and the Richmond hub (Love's #222 + its CAT Scale, the WB weigh station).

## Accuracy & exclusions

- Every row web-verified 2026-07-14 against official brand locators (Love's, Pilot/Flying J, TA/Petro, Circle K, AMBEST, CAT Scale, coopsareopen) with directory/review sites as secondary confirmation. Per-row sources in `-sources.md`.
- No field invented: unverifiable address/phone/exit values are blank (Pilot #444 & Petro Brazil phones, AMBEST phone with conflicting listings, Circle K phone, both weigh-station exits).
- **Researcher accuracy corrections honored:** the requested "Post Rd Exit 89" is actually **Exit 91** (Exit 89 is Shadeland Ave) — verified number used; the Terre Haute Exit-11 stop is a **Pilot**, not a TA; the Cloverdale Exit-41 stop is an **independent** Travel Plaza, not a Flying J; the Richmond-area Petro #357 was **excluded** because it is physically in New Paris, **OH** (state ≠ IN); Blue Beacon and Harding St tire shops sit on **I-465**, not I-70, and were omitted.
- **Cross-segment reconciliation:** the Indianapolis researcher also returned the Greenfield Pilot #30 (Exit 96); kept once in the East segment (its geographic home) and removed from the Indianapolis segment.
- **Dedup:** compiled against all 99 live IN `importDupKey` keys and 99 live detail slugs — **0 collisions, 0 slug collisions**. No cross-segment duplicates (west 1–59, indy 77–91, east 96–149B disjoint).
