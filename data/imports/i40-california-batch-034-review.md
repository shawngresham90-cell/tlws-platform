# Batch 34 — I-40 California: Review Summary

CSV: `data/imports/i40-california-batch-034.csv` · verified 2026-07-14 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). **Nothing has been imported to
production.**

This batch completes the **I-40 corridor** at its western terminus. It covers the
California crossing — the Arizona line at Needles, the sparse Mojave desert
stretch (Fenner, Ludlow), and west through Newberry Springs and Daggett to the
I-40/I-15 terminus at **Barstow**. It connects to the I-40 Arizona batch (draft PR
#72). California had **0** existing I-40 production rows — first coverage, and the
final piece of I-40 from the Arkansas/Tennessee production coverage in the east to
the Pacific-side terminus.

## Totals

- Total rows in CSV: **10**
- Expansion verdict — ready-to-publish: **1**
- Expansion verdict — import-unpublished (held, documented): **9**
- manual-review / reject: **0 / 0**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by state

| State | Rows | Ready | Held |
| --- | --- | --- | --- |
| CA | 10 | 1 | 9 |

## Rows by category

| Category | Rows | Ready | Held |
| --- | --- | --- | --- |
| Truck Stops & Travel Centers | 7 | 0 | 7 |
| Truck Parking | 1 | 0 | 1 |
| Weigh Stations | 2 | 1 | 1 |
| **Total** | **10** | **1** | **9** |

**On the high held count:** this is a remote desert corridor. The real stops are
mostly independent Chevron/Shell/Mobil fuel-and-repair stops (Needles, Fenner,
Ludlow, Newberry Springs) that publish no website and, in some cases, no verified
phone/ZIP, so their completeness scores fall in the "Needs work" band and the
assessor holds them as import-unpublished rather than auto-publish. Every row
still imports 100% cleanly; held simply means "publish after a field is
verified," not "rejected." No stop was padded with invented data to raise a score.

## Corridor coverage (AZ line at Needles → Barstow I-40/I-15 terminus)

- Distinct I-40 exits represented: **8** — 1, 4, 18, 23, 50, 107, 143, 144

## Rows by city (east → west)

| City | Rows |
| --- | --- |
| Needles | 3 |
| Fenner | 1 |
| Ludlow | 1 |
| Newberry Springs | 3 |
| Barstow | 2 |

## Segments

- **A — East (5):** AZ line at Needles (Exits 143–144) → Ludlow (Exit 50): Pilot #53 (with CAT Scale) and East Side Chevron at Needles, the CDFA agricultural/border inspection station on WB I-40 east of Needles, Hi Sahara Oasis at Fenner (Exit 107), and the Ludlow Chevron (Exit 50).
- **B — West (5):** Newberry Springs (Exits 18–23) → Barstow terminus (Exits 1–4): Newberry High Desert Truck Stop and Kelly's Market & Truck Stop, the Desert Oasis rest area (overnight truck parking), the CHP I-40 weigh/enforcement facility (Exit 4), and Barstow Fuel near the I-40/I-15 junction (Exit 1).

## Accuracy & exclusions

- Every row web-verified 2026-07-14 against directory/brand/state sources (Pilot locator, CAT Scale directory, CDFA, Caltrans, GasBuddy, truckstopsandservices.com). Per-row sources in `-sources.md`.
- No field invented: unverifiable address/ZIP/phone/exit values are blank (Pilot #53 street/phone, Ludlow Chevron ZIP, both weigh-station addresses/exits).
- **Scope discipline (out-of-scope exclusions):** the major Barstow travel centers — TA (2930 Lenwood Rd), Love's #374, Pilot (2591 Commerce Pkwy), Flying J (2611 Fisher Blvd) — all sit on **I-15** at Lenwood/Fisher, not I-40, and were deliberately excluded. An unconfirmed "Love's Needles" that appeared only in unreliable aggregators was excluded. The historic Daggett agricultural station (closed since 1967) was not listed; the current CHP I-40 facility at Exit 4 was used instead.
- **Honest borderline flag:** Barstow Fuel (1600 E Main St) sits ~0.44 mi from I-40 Exit 1 at the I-40/I-15 junction corridor; included per the junction scope and flagged as such in its description.
- **No cross-segment duplicates:** east (50–144) and west (1–23) cover disjoint exit ranges; 0 rows deduped.
