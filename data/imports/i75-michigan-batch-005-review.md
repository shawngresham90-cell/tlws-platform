# Batch 5 — I-75 Michigan: Review Summary

CSV: `data/imports/i75-michigan-batch-005.csv` · verified 2026-07-12 · dry-run validated against the live import
parser (`scripts/validate-import.ts`) **and** the Milestone 21 Expansion Readiness assessment
(`assessExpansion`). **Nothing has been imported to production.**

## Totals

- Total rows in CSV: **73**
- Published = yes: **59**
- Published = no (held with documented reasons): **14**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **4** (only where actually listed on truckparkingclub.com); no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category

| Category | Rows | Published | Held |
| --- | --- | --- | --- |
| CAT Scales | 11 | 11 | 0 |
| Hotels with Truck Parking | 2 | 2 | 0 |
| Roadside Service | 8 | 6 | 2 |
| Tire Repair | 7 | 7 | 0 |
| Truck Parking | 10 | 6 | 4 |
| Truck Stops | 28 | 25 | 3 |
| Truck Washes | 2 | 2 | 0 |
| Weigh Stations | 5 | 0 | 5 |
| **Total** | **73** | **59** | **14** |

## Rows by city (south → north)
| City | Rows |
| --- | --- |
| Erie | 1 |
| Luna Pier | 1 |
| Monroe | 12 |
| Woodhaven | 4 |
| Taylor | 1 |
| Detroit | 5 |
| Madison Heights | 1 |
| Auburn Hills | 3 |
| Flint | 1 |
| Mount Morris | 3 |
| Clio | 1 |
| Birch Run | 6 |
| Bridgeport | 7 |
| Saginaw | 5 |
| Bay City | 2 |
| Grayling | 5 |
| Gaylord | 1 |
| Mackinaw City | 2 |
| St. Ignace | 4 |
| Sault Ste. Marie | 4 |
| Frenchtown | 2 |
| Holly | 2 |

## Held records (Published = no) — reasons

- **Weigh Station — I-75 Northbound, Luna Pier** (Weigh Stations, Luna Pier): Direction/milepost corroborated via aggregated directories only; official MDOT/MSP page was bot-blocked — confirm scale identity, direction, and mile marker before publishing.
- **Weigh Station — I-75 Southbound, Monroe/Erie** (Weigh Stations, Erie): Direction/milepost corroborated via aggregated directories only; official MDOT/MSP page was bot-blocked — confirm scale identity, direction, and mile marker before publishing.
- **Michigan Weigh Station - I-75 Northbound (Oakland County, Baldwin Rd)** (Weigh Stations, Auburn Hills): Direction/milepost corroborated via aggregated directories only; official MDOT/MSP page was bot-blocked — confirm scale identity, direction, and mile marker before publishing.
- **US Fuel Mart (US Petro Mart)** (Truck Stops, Detroit): Conflicting names (US Fuel Mart vs U S Petro Mart), no verified street address/phone, and current operating status unconfirmed. Dense-urban candidate held pending verification.
- **BP Truck Stop (I-75 Exit 47A, Detroit)** (Truck Stops, Detroit): Generic name, no verified address/phone, current operating status unconfirmed. Held pending verification.
- **Truck Parking Club - Auburn Hills** (Truck Parking, Auburn Hills): Specific lot street address, exit, and space count could not be verified because truckparkingclub.com returned 403 to fetch. Held pending exact-address verification.
- **Truck Parking Club - Madison Heights** (Truck Parking, Madison Heights): Specific lot street address, exit, and space count could not be verified because truckparkingclub.com returned 403 to fetch. Held pending exact-address verification.
- **Michigan Weigh Station - I-75 Southbound (Birch Run)** (Weigh Stations, Birch Run): Direction/milepost corroborated via aggregated directories only; official MDOT/MSP page was bot-blocked — confirm scale identity, direction, and mile marker before publishing.
- **Michigan Weigh Station - I-75 Northbound (Mackinac Bridge / St. Ignace)** (Weigh Stations, St. Ignace): Direction/milepost corroborated via aggregated directories only; official MDOT/MSP page was bot-blocked — confirm scale identity, direction, and mile marker before publishing.
- **Mackinaw City Citgo** (Truck Stops, Mackinaw City): Single aggregator source (allstays); current operation and truck-driver amenities not corroborated by a second source.
- **Phil's Towing & Automotive (Grayling)** (Roadside Service, Grayling): Advertised services are primarily light-vehicle roadside; heavy-duty semi/commercial truck capability not confirmed.
- **St. Ignace Rest Area (I-75 SB, MM 348)** (Truck Parking, St. Ignace): Truck parking availability/capacity at this rest area not verified.
- **Sault Ste. Marie Rest Area (I-75 NB, MM 389)** (Truck Parking, Sault Ste. Marie): Truck parking availability/capacity at this rest area not verified.
- **Truck and Trailer Mobile Repair - Flint** (Roadside Service, Flint): Mobile-only provider; no fixed I-75-adjacent address or phone verified from the business site snippet. Corridor coverage plausible but exact I-75 service point unconfirmed.

## Manual phone-verification list

Rows missing a verified phone (blank rather than guessed): **21**. Call before/after import; priority = published rows:
- Baymont by Wyndham Monroe (Monroe)
- Truck Parking Club - 1290 N Monroe St (Monroe) (Monroe)
- TruckParkingClub - Taylor (24420 Pennsylvania Rd) (Taylor)
- BP Fuel Stop - Mt Morris (Mount Morris)
- East Holly Truck Stop (Holly)
- I-75 Bay City Rest Area (Southbound) (Bay City)
- Michigan Welcome Center - St. Ignace (I-75) (St. Ignace)
- Michigan Welcome Center - Mackinaw City (I-75) (Mackinaw City)
- Michigan Welcome Center - Sault Ste. Marie (I-75) (Sault Ste. Marie)

## Coordinate readiness (no coordinates supplied)

- **Coordinate-ready candidates (54):** rows with a full street address — suitable for the verified geocoding console after import.
- **Manual-review coordinate candidates (19):** rows without a street number (weigh stations, rest areas, milepost/mobile):
  - Weigh Station — I-75 Northbound, Luna Pier (Luna Pier) — address: (blank)
  - Weigh Station — I-75 Southbound, Monroe/Erie (Erie) — address: (blank)
  - Michigan Weigh Station - I-75 Northbound (Oakland County, Baldwin Rd) (Auburn Hills) — address: (blank)
  - Diesel Down LLC (Auburn Hills) — address: (blank)
  - Keep It Rolling Semi Truck & Trailer Repair (Detroit) — address: (blank)
  - US Fuel Mart (US Petro Mart) (Detroit) — address: (blank)
  - BP Truck Stop (I-75 Exit 47A, Detroit) (Detroit) — address: (blank)
  - Truck Parking Club - Auburn Hills (Auburn Hills) — address: (blank)
  - Truck Parking Club - Madison Heights (Madison Heights) — address: (blank)
  - T&T Mobile Repair - Birch Run (Birch Run) — address: (blank)
  - Michigan Weigh Station - I-75 Southbound (Birch Run) (Birch Run) — address: (blank)
  - I-75 Bay City Rest Area (Southbound) (Bay City) — address: (blank)
  - Michigan Weigh Station - I-75 Northbound (Mackinac Bridge / St. Ignace) (St. Ignace) — address: (blank)
  - Michigan Welcome Center - Mackinaw City (I-75) (Mackinaw City) — address: (blank)
  - Michigan Welcome Center - Sault Ste. Marie (I-75) (Sault Ste. Marie) — address: (blank)
  - St. Ignace Rest Area (I-75 SB, MM 348) (St. Ignace) — address: (blank)
  - Sault Ste. Marie Rest Area (I-75 NB, MM 389) (Sault Ste. Marie) — address: (blank)
  - Truck and Trailer Mobile Repair - Flint (Flint) — address: (blank)
  - Michigan Welcome Center - St. Ignace (I-75) (St. Ignace) — address: I-75 N Mackinac Bridge Plaza

## Validation results

- Live import parser (`validate-import.ts`): master + all 3 parts = **100% clean** (0 skipped, 0 duplicates, 0 errors).
- Expansion Readiness (`assessExpansion` vs live production): **44 ready-to-publish, 29 import-unpublished, 0 manual-review, 0 reject**; slug collisions vs live: **0**.
- Duplicate detection (`classifyPair`): vs Georgia **0**, Tennessee **0**, Kentucky **0**, Ohio **0**, live DB **0** matches; in-file co-location pairs (established CAT Scale/Speedco/Blue Beacon-at-host pattern): **25**.
- Quality (`scoreCompleteness`): min 32, median 68, mean 63.6, max 80; labels: Incomplete 4, Needs work 29, Good 40.

## Final audit

- Approved (Published = yes): **59** · Held (documented): **14** · Rejected in CSV: **0** (rejected candidates excluded pre-compilation — see sources report).
- Import parts: `i75-michigan-batch-005-part1.csv`, `i75-michigan-batch-005-part2.csv`, `i75-michigan-batch-005-part3.csv` (≤25 rows each).
- Nothing imported, published, merged, or deployed. Awaiting approval.
