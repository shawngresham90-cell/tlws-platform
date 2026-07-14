# Batch 18 — I-10 Louisiana: Review Summary

CSV: `data/imports/i10-louisiana-batch-018.csv` · researched 2026-07-14 · dry-run validated
against the live import parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`). **Nothing has been imported to production.**

This batch is the eastward continuation of the I-10 corridor from Batch 17 (Texas). It opens
**Louisiana** as a new state and extends I-10 coverage across the full width of the state,
from the Texas line at Vinton to the Mississippi line past Slidell. Prior production data had
**0 rows in Louisiana and 0 on I-10** (before Batch 17), so this batch has zero overlap risk
with anything already live.

Research was fanned out across four geographic segments, and every facility was confirmed
against an official brand locator and/or 2+ directory sources before inclusion. Unverifiable
fields (some ZIPs, phones, exit numbers, addresses) were left blank rather than guessed.

## Totals

- Total rows in CSV: **30**
- Segments: Southwest (8) · Acadiana/Lafayette (8) · Baton Rouge (8) · Greater New Orleans/Slidell (6)
- Published flag: all rows imported **unpublished** (CSV sets no `published` column).
- Featured = yes: **0** (featuring requires explicit approval).
- TruckParkingClub URLs: **0**; affiliate codes: **0**.
- Coordinates: **none supplied** — geocoding is a separate verified workflow (all 30 rows
  flagged `needs-geocoding`).

## Rows by category

| Category | Rows |
| --- | --- |
| truck-stops | 21 |
| tire-repair | 3 |
| cat-scales | 2 |
| roadside-service | 2 |
| parking | 1 |
| truck-washes | 1 |

## Rows by city (west → east)

Vinton (1) · Sulphur (1) · Iowa (2) · Jennings (1) · Egan (2) · Crowley (1) · Rayne (1) ·
Duson (1) · Scott (1) · Lafayette (1) · Breaux Bridge (2) · Henderson (1) · Grosse Tete (1) ·
Port Allen (5) · Baton Rouge (1) · Sorrento (2) · LaPlace (3) · New Orleans (1) · Slidell (2)

## Curation & accuracy decisions

- **Omitted the former Pilot #82 (LaPlace, Exit 209)** — multiple current sources (incl. Yelp,
  2026) mark it **closed**; not listed despite older directory data.
- **Omitted the Gonzales Love's (I-10/Hwy 44)** — only 2021–2023 "under development" news found,
  with no confirmation it has opened.
- **Omitted the Kangaroo Express / Fleet Travel Center (Exit 263)** — rebranded to a Circle K
  gas station; truck-stop/CAT-scale status no longer reliable.
- **Excluded Love's #379 "Exit 262"** — that store is in Lee, FL, not Slidell (a false-positive
  guard against directory mis-attribution).
- **Blanked the Duson Love's ZIP** — the source ZIP (70578) is Rayne's, not Duson's, so it was
  removed rather than kept wrong.
- **Central/downtown New Orleans** correctly has no truck-stop rows; the only NOLA-area entry is
  Stan's Truck Stop in New Orleans East (US-90/Chef Menteur, reached via I-510), with a blank
  exit number rather than a guess.
- Mobile roadside services (Baton Rouge, Slidell) are dispatch-based with no fixed storefront,
  so their address/exit fields are blank by policy.

## Co-location (expected, not duplicates)

- **Egan Exit 76**: Petro Egan (truck-stop) + its on-site TA Truck Service (tire-repair) — same
  address, different categories.
- **Port Allen Exit 151**: Love's #240 (truck-stop) + its CAT Scale (cat-scales) — same pattern.
- **LaPlace Exit 209**: LaPlace Travel Center (truck-stop) + its CAT Scale (cat-scales).

## Staged import parts (for the owner's later, deliberate import)

| Part | Segment(s) | Rows |
| --- | --- | --- |
| part1 | Southwest + Acadiana (Vinton → Grosse Tete) | 16 |
| part2 | Baton Rouge + Greater New Orleans (Port Allen → Slidell) | 14 |

## Honest limitations

- **Coordinates deferred.** Every row needs geocoding before it can render on the map or power
  near-me. Intentional; matches every prior batch.
- **Some addresses/phones/ZIPs blank** on independents and mobile services — blank by the
  no-fabrication policy; owner/geocoding follow-up will fill them.
- **This is a research-grade candidate set, not a verified import.** It exists for owner review.
  Nothing here has been written to production.
