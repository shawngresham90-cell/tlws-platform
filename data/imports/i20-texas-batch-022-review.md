# Batch 22 — I-20 Texas: Review Summary

CSV: `data/imports/i20-texas-batch-022.csv` · researched 2026-07-14 · dry-run validated against
the live import parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`). **Nothing has been imported to production.**

This batch **opens a new corridor — Interstate 20** — with its Texas crossing, ~635 interstate
miles from the New Mexico-adjacent west (Pecos) through the Permian Basin, Abilene, the Dallas-Fort
Worth freight hub, and East Texas to the Louisiana line. Texas has 0 existing production listings
and no prior I-20 coverage, so this batch has zero overlap risk with anything already live.

Research was fanned out across four geographic segments; every facility was confirmed against an
official brand locator and/or 2+ directory sources. Unverifiable fields were left blank.

## Totals

- Total rows in CSV: **29**
- Segments: Permian Basin (7) · Abilene (7) · DFW metroplex (7) · East Texas (8)
- Published flag: all rows imported **unpublished**.
- Featured = yes: **0**; TruckParkingClub URLs: **0**; affiliate codes: **0**.
- Coordinates: **none supplied** — all 29 rows flagged `needs-geocoding`.

> **Correction (2026-07-14):** an earlier version of this batch listed "Love's Travel Stop #530"
> in Midland, TX (Exit 147, no address). Love's store #530 is in fact in **Moody, AL** (Exit 147),
> confirmed via loves.com/locations/530 during Batch 25 research — a directory mis-attribution to
> Midland. That phantom row has been removed; the real #530 appears in Batch 25 (I-20 Alabama).
> Totals below reflect the removal (30 → 29 rows; Permian Basin 8 → 7; Midland 2 → 1).

## Rows by category

| Category | Rows |
| --- | --- |
| truck-stops | 26 |
| cat-scales | 2 |
| tire-repair | 1 |

## Rows by city (west → east)

Pecos (1) · Monahans (1) · Odessa (2) · Midland (1) · Stanton (1) · Big Spring (1) · Sweetwater (2) ·
Tye (2) · Baird (1) · Eastland (1) · Ranger (1) · Weatherford (3) · Dallas (3) · Terrell (1) ·
Canton (1) · Van (2) · Lindale (2) · Winona (1) · Kilgore (1) · Marshall (1)

## Curation & accuracy decisions

- **Permian Basin** (heavy oilfield truck traffic): Love's #492 (Pecos), Pilot #1205 (Monahans),
  Love's #339 + Flying J #580 (Odessa), Pilot #1209 (Midland), TA #230 (Big Spring).
- **DFW freight hub**: three Weatherford stops (Pilot #206, Petro #302, Love's #273) and the south
  Dallas cluster (Love's #294, Pilot #433, TA Dallas South #150) plus TA Terrell #233.
- **Omitted** Pilot #1108 Grand Prairie (on TX-161/Trinity Blvd, not I-20) and a Fort Worth Southern
  Tire Mart (on I-35) — failed the on-I-20 test.
- **Omitted** Longview and Waskom truck stops — the cited "Love's Longview" address is actually a
  Zippy J's/Exxon, and Waskom only has a state welcome center; not fabricated.
- **Omitted** Colorado City and Cisco — only generic gas stations could be confirmed there.
- Blanks kept where sources conflict: several addresses/ZIPs/phones on independents (Stanton Stripes,
  Oasis Lindale, Love's #815 phone, Flying J #738 ZIP).

## Co-location (expected, not duplicates)

- **Sweetwater Exit 242**: Love's #475 (truck-stop) + the independent Sweetwater Travel Center CAT scale.
- **Van Exit 540**: Love's #287 (truck-stop) + its CAT scale (cat-scales).

## Staged import parts

| Part | Segment(s) | Rows |
| --- | --- | --- |
| part1 | Permian Basin + Abilene (Pecos → Ranger) | 14 |
| part2 | DFW + East Texas (Weatherford → Marshall) | 15 |

## Honest limitations

- **Coordinates deferred** — every row needs geocoding before map/near-me use.
- **Category skew**: the genuinely-on-I-20 facilities on this corridor are overwhelmingly full-service
  chain travel centers, so the batch is truck-stop heavy by reality, not by omission.
- **Research-grade candidate set, not a verified import.** Nothing written to production.
