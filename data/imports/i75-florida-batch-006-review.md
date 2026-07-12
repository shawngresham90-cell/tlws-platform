# Batch 6 — I-75 Florida: Review Summary

CSV: `data/imports/i75-florida-batch-006.csv` · verified 2026-07-12 · dry-run validated against the live import
parser (`scripts/validate-import.ts`) **and** the Milestone 21 Expansion Readiness assessment
(`assessExpansion`). **Nothing has been imported to production.**

## Totals

- Total rows in CSV: **73**
- Published = yes: **67**
- Published = no (held with documented reasons): **6**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **2** (only where actually listed on truckparkingclub.com); no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category

| Category | Rows | Published | Held |
| --- | --- | --- | --- |
| CAT Scales | 19 | 19 | 0 |
| Hotels with Truck Parking | 4 | 4 | 0 |
| Roadside Service | 3 | 2 | 1 |
| Tire Repair | 11 | 11 | 0 |
| Truck Parking | 6 | 4 | 2 |
| Truck Stops | 23 | 23 | 0 |
| Truck Washes | 3 | 3 | 0 |
| Weigh Stations | 4 | 1 | 3 |
| **Total** | **73** | **67** | **6** |

## Rows by city (south → north)
| City | Rows |
| --- | --- |
| Miami | 1 |
| Hialeah Gardens | 3 |
| Pembroke Pines | 1 |
| Ochopee | 1 |
| Alligator Alley | 1 |
| Naples | 3 |
| Fort Myers | 3 |
| North Fort Myers | 4 |
| Port Charlotte | 1 |
| Punta Gorda | 4 |
| Bradenton | 4 |
| Ellenton | 2 |
| Ruskin | 1 |
| San Antonio | 3 |
| Bushnell | 2 |
| Wildwood | 11 |
| Ocala | 13 |
| Reddick | 3 |
| Lake City | 6 |
| White Springs | 2 |
| Jasper | 4 |

## Held records (Published = no) — reasons

- **Florida Secure Self-Storage — Pembroke Pines** (Truck Parking, Pembroke Pines): Real facility near I-75 Exit 11 (Sheridan St), but marketed as general vehicle/trailer storage; accommodation of over-the-road semi tractor-trailers and overnight driver use not verified. Held pending confirmation it serves working truckers.
- **Florida Weigh Station - I-75 Northbound (Punta Gorda)** (Weigh Stations, Punta Gorda): FDOT weigh-station listing (fdot.gov/mcsaw) returned HTTP 403; direction and mile marker corroborated via aggregated truck directories only — confirm scale identity, direction, and mile marker against the official FDOT source before publishing.
- **Marion County Truck Comfort / Weigh Station (I-75 MM 338)** (Weigh Stations, Ocala): FDOT weigh-station listing (fdot.gov/mcsaw) returned HTTP 403; direction and mile marker corroborated via aggregated truck directories only — confirm scale identity, direction, and mile marker against the official FDOT source before publishing.
- **White Springs Weigh Station (I-75)** (Weigh Stations, White Springs): Milepost and bidirectional direction sourced from truck directories only; official FDOT weigh-station listing (fdot.gov/mcsaw) returned HTTP 403 and could not be used to confirm exact location/direction. Hold pending official FDOT/FLHSMV confirmation.
- **TruckParkingClub - 1100 NW 1st Ave, Ocala** (Truck Parking, Ocala): Downtown Ocala lot near US-301; specific I-75 exit/distance not stated on listing (several miles east of I-75). I-75 adjacency unverifiable.
- **Wildwood Truck Repair & Wrecker Service** (Roadside Service, Wildwood): Fixed independent business appears in one search result only; not yet corroborated by 2+ sources and exact I-75 distance/exit adjacency unconfirmed.

## Manual phone-verification list

Rows missing a verified phone (blank rather than guessed): **17**. Call before/after import; priority = published rows:
- Collier County Rest Area (Alligator Alley, Milepost 63) (Alligator Alley)
- Big Ass Truck Wash - North Fort Myers (North Fort Myers)
- RecNation Storage - Ruskin (Truck Parking) (Ruskin)
- Super 8 by Wyndham Ocala I-75 (Ocala)
- Comfort Inn & Suites Wildwood - The Villages (Wildwood)
- Agricultural Inspection Station No. 9A — Interstate 75 (Southbound) (White Springs)
- CAT Scale - Flying J, Miami (Miami)
- TruckParkingClub - RecNation Storage, Fort Myers (Fort Myers)
- Days Inn by Wyndham Wildwood I-75 (Wildwood)
- TA Truck Service - Lake City (Lake City)
- Speedco - Lake City (Lake City)

## Coordinate readiness (no coordinates supplied)

- **Coordinate-ready candidates (64):** rows with a full street address — suitable for the verified geocoding console after import.
- **Manual-review coordinate candidates (9):** rows without a street number (weigh stations, rest areas, milepost/mobile):
  - Collier County Rest Area (Alligator Alley, Milepost 63) (Alligator Alley) — address: (blank)
  - After Hours Road Service, Inc. (Naples) — address: (blank)
  - Florida Weigh Station - I-75 Northbound (Punta Gorda) (Punta Gorda) — address: (blank)
  - LP Mobile Tire (Bradenton area) (Bradenton) — address: (blank)
  - CAT Scale - Flying J, Miami (Miami) — address: (blank)
  - Days Inn by Wyndham Wildwood I-75 (Wildwood) — address: (blank)
  - TA Truck Service - Lake City (Lake City) — address: (blank)
  - Marion County Truck Comfort / Weigh Station (I-75 MM 338) (Ocala) — address: I-75 near Mile Marker 338
  - White Springs Weigh Station (I-75) (White Springs) — address: I-75 near mile marker 448

## Validation results

- Live import parser (`validate-import.ts`): master + all 3 parts = **100% clean** (0 skipped, 0 duplicates, 0 errors).
- Expansion Readiness (`assessExpansion` vs live production): **58 ready-to-publish, 15 import-unpublished, 0 manual-review, 0 reject**; slug collisions vs live: **0**.
- Duplicate detection (`classifyPair`): vs Georgia **0**, Tennessee **0**, Kentucky **0**, Ohio **0**, Michigan **0**, live DB **0** matches; in-file co-location pairs (established CAT Scale/Speedco/Blue Beacon-at-host pattern): **25**.
- Quality (`scoreCompleteness`): min 36, median 72, mean 68.8, max 76; labels: Incomplete 1, Needs work 20, Good 52.

## Final audit

- Approved (Published = yes): **67** · Held (documented): **6** · Rejected in CSV: **0** (rejected candidates excluded pre-compilation — see sources report).
- Import parts: `i75-florida-batch-006-part1.csv`, `i75-florida-batch-006-part2.csv`, `i75-florida-batch-006-part3.csv` (≤25 rows each).
- Nothing imported, published, merged, or deployed. Awaiting approval.
