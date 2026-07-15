# Batch 39 — I-70 Illinois: Review Summary

CSV: `data/imports/i70-illinois-batch-039.csv` · verified 2026-07-14 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`), including **deduplication against the 12
existing Illinois production rows**. **Nothing has been imported to production.**

This batch begins the **eastern I-70 states**. It covers Illinois: West (the St.
Louis metro east side and central plains — Troy on the I-55/I-70 concurrency,
Greenville and Vandalia) and East (the major **Effingham** I-57/I-70 hub, plus
Greenup, Casey and Marshall toward the Indiana line). Illinois already has **12**
production rows — all on **I-24** in Metropolis/Vienna (southern IL), so there is
no city overlap with this I-70 corridor; dedup confirmed **0 collisions**.

## Totals

- Total rows in CSV: **17**
- Expansion verdict — ready-to-publish: **13**
- Expansion verdict — import-unpublished (held, documented): **4**
- manual-review / reject: **0 / 0**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by state

| State | Rows | Ready | Held |
| --- | --- | --- | --- |
| IL | 17 | 13 | 4 |

## Rows by category

| Category | Rows | Ready | Held |
| --- | --- | --- | --- |
| Truck Stops & Travel Centers | 9 | 7 | 2 |
| CAT Scales | 3 | 3 | 0 |
| Tire Repair | 2 | 2 | 0 |
| Roadside Service | 1 | 1 | 0 |
| Weigh Stations | 2 | 0 | 2 |
| **Total** | **17** | **13** | **4** |

## Corridor coverage (St. Louis metro → Effingham → IN line)

- Distinct I-70 exits represented: **7** — 18, 45, 61, 119, 129, 147, 160

## Rows by city (west → east)

| City | Rows |
| --- | --- |
| Maryville | 1 |
| Troy | 2 |
| Greenville | 3 |
| Vandalia | 2 |
| Greenup | 1 |
| Casey | 1 |
| Marshall | 3 |
| Effingham | 4 |

## Segments

- **A — West (8):** St. Louis metro east → Vandalia (Exits 18–61): the Maryville I-55/70 weigh station, TA Troy + Speedco #949 at the I-55/I-70 Exit 18 concurrency, the Greenville Exit-45 cluster (Love's #384 + its Truck Care + CAT Scale), and Pilot #1219 Vandalia + its CAT Scale.
- **B — East (9):** Greenup → Effingham hub → Marshall (Exits 119–160): Love's #688 Greenup, Mach 1 #10 Casey, the Marshall pair (Pilot #1174, Road Ranger) + the Marshall weigh station, and the **Effingham I-57/I-70 Exit 160 hub** (Flying J #643 + its CAT Scale, TA #035, Love's/Speedco #915).

## Accuracy & exclusions

- Every row web-verified 2026-07-14 against official brand locators (Love's, Pilot/Flying J, TA/Petro, Road Ranger, CAT Scale, coopsareopen) with directory/review sites as secondary confirmation. Per-row sources in `-sources.md`.
- No field invented: unverifiable address/phone/exit values are blank (Road Ranger store phone — the only number found was corporate; both weigh-station exits/addresses; some CAT-scale phones). One agent's TA Effingham row arrived missing its `amenities` array — reconstructed conservatively from its own description (Showers/Food/Fuel/Restrooms/Repair/Wi-Fi) before persisting.
- **Researcher accuracy corrections honored:** the Love's at Exit 119 is in **Greenup**, not Casey (common mix-up) — placed correctly; Highland, Pocahontas, Mulberry Grove, Collinsville proper, St. Elmo, Montrose, Teutopolis, Martinsville had no verifiable I-70-signed truck stop (their well-known St. Louis-metro stops sit on I-55/I-64/I-255) and were omitted; the Brownstown weigh station (mm 71.5) was noted but sits between the two segments.
- **Dedup:** compiled against the 12 live IL keys (importDupKey) and 12 live detail slugs — 0 collisions, 0 slug collisions. No cross-segment duplicates (west 18–61, east 119–160 disjoint).
