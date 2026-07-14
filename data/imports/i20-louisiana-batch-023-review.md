# Batch 23 — I-20 Louisiana: Review Summary

CSV: `data/imports/i20-louisiana-batch-023.csv` · researched 2026-07-14 · dry-run validated against
the live import parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`). **Nothing has been imported to production.**

This batch continues the I-20 corridor eastward from Batch 22 (Texas), covering the North Louisiana
crossing — ~186 interstate miles from the Texas line at Greenwood through Shreveport/Bossier City,
Ruston, and Monroe to the Mississippi line past Tallulah. Louisiana has 0 existing production
listings, so this batch has zero overlap risk with anything already live.

## Totals

- Total rows in CSV: **14** (all truck-stops category on this corridor)
- Segments: Northwest (6, Greenwood–Minden) · North/Monroe (8, Grambling–Tallulah)
- Published flag: all rows imported **unpublished**.
- Featured = yes: **0**; TruckParkingClub URLs: **0**; affiliate codes: **0**.
- Coordinates: **none supplied** — all 14 rows flagged `needs-geocoding`.

## Rows by city (west → east)

Greenwood (2) · Shreveport (1) · Haughton (1) · Minden (2) · Grambling (1) · West Monroe (1) ·
Monroe (1) · Rayville (1) · Delhi (1) · Tallulah (3)

## Curation & accuracy decisions

- **Greenwood Exit 3** (TX line): Love's #209 and Flying J #665, both major, both with CAT scales.
- **Shreveport Exit 8**: Petro #308 (large TA/Petro with repair + scales).
- **Tallulah Exit 171** (MS line): three distinct operators — Love's #237, TA Tallulah, and the
  independent Tallulah Truck Stop — each at its own address, not duplicates.
- **Omitted** the "I-220 Travel Plaza" (on I-220, not I-20).
- **No branded stop** could be confirmed directly on I-20 in Ruston, Arcadia, Choudrant, Calhoun, or
  Mound, so none were fabricated (Grambling Exit 81 is the nearest confirmed stop to Ruston).
- Blanks kept where sources conflict: several phones (Grambling, West Monroe, Monroe, TA Tallulah),
  a couple of ZIPs, and the Delhi Exit 153 stop's exact street address.
- Chain official pages (Love's/Pilot/TA) returned HTTP 403 to direct fetch; those rows are
  corroborated via multiple third-party directories plus the chains' own URLs.

## Staged import parts

| Part | Segment | Rows |
| --- | --- | --- |
| part1 | Northwest (Greenwood → Minden) | 6 |
| part2 | North/Monroe (Grambling → Tallulah) | 8 |

## Honest limitations

- **Coordinates deferred** — every row needs geocoding before map/near-me use.
- **All truck-stops**: the genuinely-on-I-20 facilities confirmed on this corridor are all
  full-service travel centers; no standalone CAT scale, wash, or roadside row met the confirmation bar.
- **Research-grade candidate set, not a verified import.** Nothing written to production.
