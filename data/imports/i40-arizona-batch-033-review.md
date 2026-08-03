# Batch 33 — I-40 Arizona: Review Summary

CSV: `data/imports/i40-arizona-batch-033.csv` · verified 2026-07-14 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). **Nothing has been imported to
production.**

This batch continues I-40 west out of New Mexico across **Arizona** — the New
Mexico line at Lupton (Speedy's), through Chambers, Holbrook, Joseph City and
Winslow, the **Flagstaff/Bellemont** mountain hub (the I-40/I-17 area), and west
through Williams and the **Kingman** hub to the California line at Topock. It
connects the I-40 New Mexico batch (draft PR #71) to the final I-40 California
batch. Arizona had **0** existing I-40 production rows — first coverage of the
state and corridor.

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
| AZ | 22 | 13 | 9 |

## Rows by category

| Category | Rows | Ready | Held |
| --- | --- | --- | --- |
| Truck Stops & Travel Centers | 15 | 10 | 5 |
| CAT Scales | 1 | 1 | 0 |
| Roadside Service | 2 | 2 | 0 |
| Tire Repair | 1 | 0 | 1 |
| Truck Washes | 1 | 0 | 1 |
| Weigh Stations | 2 | 0 | 2 |
| **Total** | **22** | **13** | **9** |

Held rows are import-unpublished because a source did not confirm a street
address or exit number and blank was kept over a guess — the two AZ ports of
entry (Sanders, Topock, no published street/exit), the Flagstaff tire dealer and
truck wash (exit unconfirmed), and a few travel centers missing a phone/ZIP.
They import cleanly and can be published once a field is verified.

## Corridor coverage (NM line → Flagstaff → Kingman → CA line)

- Distinct I-40 exits represented: **14** — 44, 48, 53, 59, 66, 163, 185, 198, 255, 277, 283, 292, 333, 359

## Rows by city (east → west)

| City | Rows |
| --- | --- |
| Lupton | 1 |
| Sanders | 1 |
| Chambers | 1 |
| Holbrook | 2 |
| Joseph City | 1 |
| Winslow | 2 |
| Flagstaff | 4 |
| Bellemont | 3 |
| Williams | 1 |
| Kingman | 5 |
| Topock | 1 |

## Segments

- **A — East (8):** NM line at Lupton (Exit 359) → Winslow (Exit 255): Speedy's Truck Stop, the Sanders port of entry, Chambers Mobil (I-40/US-191), the Holbrook pair (Hopi Travel Plaza, TA Holbrook), Love's #278 Joseph City, and the Winslow Transcon Ln pair (Love's #971 + Flying J #612, both with CAT scales).
- **B — Flagstaff/Bellemont (7):** the mountain hub (Exits 185–198): the Bellemont Pilot/Flying J + its CAT Scale + Bellemont Truck Repair, Little America Travel Center and Rocky Mountain Truck Centers in Flagstaff, Golightly Tire, and the I-40 Truck Wash.
- **C — West (7):** Williams (Exit 163) → the Kingman hub → CA line: Love's #553 Williams, and the Kingman cluster — TA #094 (Exit 48), Flying J #610 (Exit 53), Love's #272 (Exit 59), Petro #315 (Exit 66) and independent Crazy Fred's (Exit 44) — plus the Topock port of entry near the California line.

## Accuracy & exclusions

- Every row web-verified 2026-07-14 against official brand locators (Love's, Pilot/Flying J, TA/Petro, Little America, CAT Scale, AZDOT) with directory/review sites as secondary confirmation. Per-row sources in `-sources.md`.
- No field invented: unverifiable address/ZIP/phone/exit values are blank (Speedy's website, Crazy Fred's ZIP where sources split 86401/86403, both port-of-entry addresses/exits, conflicting phones left blank).
- **Accuracy corrections by the researchers:** the Bellemont Exit 185 truck stop is a Pilot/Flying J, **not** a Love's — no fabricated Love's was added (nearest Love's is Williams, Exit 163). No weigh station was placed near Flagstaff — Arizona's I-40 ports of entry are only at Sanders (east) and Topock (west).
- **No cross-segment duplicates:** the east/Flagstaff/west segments cover disjoint exit ranges (255+, 185–198, 44–163); 0 rows deduped. Ash Fork, Seligman, Yucca, Navajo and Winona (no verified on-I-40 major facility) were omitted rather than fabricated.
