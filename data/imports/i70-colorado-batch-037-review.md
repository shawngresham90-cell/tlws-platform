# Batch 37 — I-70 Colorado: Review Summary

CSV: `data/imports/i70-colorado-batch-037.csv` · verified 2026-07-14 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). **Nothing has been imported to
production.**

This batch continues I-70 west across **Colorado**. It covers the East plains
(the Kansas line at Burlington and the Limon I-70/US-24 junction), the **Denver
metro** (Bennett, the Aurora Chambers Rd Flying J, and the Commerce City
I-70/I-270 cluster), and the **Western Slope** (Grand Junction/Fruita and
Rifle/Parachute to the Utah line). The high-mountain stretch between Denver and
Rifle has no interstate truck stops due to terrain and is intentionally empty.
Colorado had **0** existing I-70 production rows — first coverage of the state and
corridor.

## Totals

- Total rows in CSV: **20**
- Expansion verdict — ready-to-publish: **15**
- Expansion verdict — import-unpublished (held, documented): **5**
- manual-review / reject: **0 / 0**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by state

| State | Rows | Ready | Held |
| --- | --- | --- | --- |
| CO | 20 | 15 | 5 |

## Rows by category

| Category | Rows | Ready | Held |
| --- | --- | --- | --- |
| Truck Stops & Travel Centers | 12 | 8 | 4 |
| CAT Scales | 3 | 3 | 0 |
| Tire Repair | 1 | 1 | 0 |
| Truck Washes | 2 | 1 | 1 |
| Weigh Stations | 2 | 2 | 0 |
| **Total** | **20** | **15** | **5** |

## Corridor coverage (KS line → Denver → Grand Junction/UT line)

- Distinct I-70 exits represented: **10** — 15, 19, 26, 75, 90, 278, 285, 304, 359, 437

## Rows by city (east → west)

| City | Rows |
| --- | --- |
| Burlington | 3 |
| Limon | 4 |
| Bennett | 1 |
| Aurora | 2 |
| Commerce City | 3 |
| Rifle | 1 |
| Parachute | 1 |
| Grand Junction | 3 |
| Fruita | 1 |
| Loma | 1 |

## Segments

- **A — East plains (7):** KS line at Burlington (Exit 437) → Limon (Exit 359): Love's #644 + its CAT Scale and the Travel Shoppe (Conoco) at Burlington, and the Limon junction (TA #228 + its CAT Scale, Flying J #621, and the Limon Port of Entry weigh station).
- **B — Denver metro (6):** Bennett → Commerce City (Exits 304–278): Love's #300 Bennett, the Aurora Chambers Rd Flying J + its CAT Scale, and the Commerce City I-70/I-270 cluster (TA Commerce City, Blue Beacon truck wash, Pomp's commercial tire).
- **C — West / Western Slope (7):** Rifle → Grand Junction → UT line (Exits 90–15): Love's #826 Parachute, the Rifle Exit-90 stop, the Grand Junction pair (Love's #517, Pilot #592, both with CAT scales) + a Grand Junction truck wash, Loco Travel Stop Fruita, and the Loma Port of Entry near the Utah line.

## Accuracy & exclusions

- Every row web-verified 2026-07-14 against official brand locators (Love's, Pilot/Flying J, TA/Petro, Blue Beacon, Pomp's, CAT Scale, Colorado State Patrol) with directory/review sites as secondary confirmation. Per-row sources in `-sources.md`.
- No field invented: unverifiable address/ZIP/phone/exit values are blank (Rifle Kum & Go address, Love's Bennett phone, Pomp's & truck-wash exit numbers).
- **Terrain-honest coverage:** the Idaho Springs → Glenwood Springs high-mountain stretch genuinely has no interstate truck stops, so none were fabricated there.
- **Researcher accuracy corrections honored:** the permanently-closed Pilot at 4640 Steele St (Exit 276, closed for I-70 expansion) was excluded; an unconfirmed "Watkins Love's" (AI-summary only) was excluded in favor of the well-documented Love's #300 Bennett; no Denver-metro weigh station was fabricated (only a non-permanent DOT pullout exists there). The Rifle Kum & Go note flags its ongoing rebrand to Maverik.
- **No cross-segment duplicates:** east/Denver/west cover disjoint exit ranges (359–437, 278–304, 15–90) with empty mountain gaps between; 0 rows deduped.
