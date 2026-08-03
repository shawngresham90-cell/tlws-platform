# Batch 77 — I-95 New York: Review Summary

CSV: `data/imports/i95-new-york-batch-077.csv` · verified 2026-07-15 · dry-run validated
against the live import parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`). New York has **0** existing production rows — first live coverage of the
state (the I-90 NY Thruway batch remains an unmerged draft). **Nothing has been imported to
production.**

Covers the entire (short, ~30-mile, dense-urban) **New York** stretch of I-95 — from the
George Washington Bridge across the Bronx on the Cross Bronx Expressway, onto the New England
Thruway through the Bronx and Westchester County (Pelham, New Rochelle, Mamaroneck, Rye, Port
Chester) to the Connecticut line at Greenwich. Single-segment batch.

## Totals
- Total rows in CSV: **9**
- ready-to-publish: **5** · import-unpublished (held): **4** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Tire & Repair | 4 |
| Roadside Service | 2 |
| CDL Schools | 2 |
| Truck Washes | 1 |
| **Total** | **9** |

## Rows by city
Bronx 8 · New Rochelle 1

## Facilities
- **Tire & repair (Bronx):** Frank's Tire Service (Boston Rd, near the Baychester/Co-op City
  exits), Cross Bronx Tire and Maximus Tire (both fronting the Cross Bronx Expressway service
  road), and Brito 24/7 mobile truck tire (Port Morris/Hunts Point).
- **Heavy towing:** Universe Towing (NYPD-authorized I-95 tower) and Crown Towing (21-truck
  heavy-duty fleet), both Bronx, 24/7.
- **Truck wash:** Bronx 5 Star Truck Wash (Hunts Point freight district).
- **CDL schools:** Al Sorano's (Bronx, since 1964) and Heritage Auto School (New Rochelle,
  since 1974).

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against operator sites and directory listings. Per-row
  sources in `-sources.md`.
- **No truck stops, CAT scales, weigh stations or truck-parking on NY I-95 — and none were
  fabricated.** NYC and Westchester have essentially no true truck stops or CAT scales on
  I-95, and the New England Thruway has no Thruway service areas. No fixed public I-95
  weigh/inspection station with a verifiable address was found in the Bronx/Westchester
  stretch, and no hotel authoritatively confirmed truck parking — both categories omitted
  rather than invented.
- **Omitted, not fabricated:** no coordinates; milepost/urban facilities carry a blank exit
  where not at a numbered ramp.
- **Dedup:** NY production is empty (0 rows); no collisions possible. No internal duplicates.
