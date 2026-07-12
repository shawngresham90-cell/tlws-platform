# Batch 7 — I-65 Indiana: Review Summary

CSV: `data/imports/i65-indiana-batch-007.csv` · verified 2026-07-12 · dry-run validated against the live import
parser (`scripts/validate-import.ts`) **and** the Milestone 21 Expansion Readiness assessment
(`assessExpansion`). **Nothing has been imported to production.**

## Totals

- Total researched candidates: **137** (99 included + 38 excluded)
- Total rows in CSV: **99**
- Published = yes: **78**
- Published = no (held with documented reasons): **21**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **13** (only where actually listed on truckparkingclub.com); no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category

| Category | Rows | Published | Held |
| --- | --- | --- | --- |
| CAT Scales | 19 | 18 | 1 |
| Hotels with Truck Parking | 6 | 5 | 1 |
| Roadside Service | 17 | 12 | 5 |
| Tire Repair | 8 | 8 | 0 |
| Truck Parking | 17 | 8 | 9 |
| Truck Stops | 26 | 25 | 1 |
| Truck Washes | 3 | 2 | 1 |
| Weigh Stations | 3 | 0 | 3 |
| **Total** | **99** | **78** | **21** |

## Corridor coverage (KY line → Gary / IL line)

- Distinct I-65 exits represented: **23** — 4, 7, 29, 34, 41, 50, 95, 99, 103, 130, 133, 139, 168, 175, 178, 201, 205, 215, 240, 253, 50A, 50B, 76B

## Rows by city (south → north)
| City | Rows |
| --- | --- |
| Clarksville | 2 |
| Sellersburg | 8 |
| Henryville | 2 |
| Scottsburg | 1 |
| Austin | 2 |
| Crothersville | 1 |
| Seymour | 10 |
| Taylorsville | 2 |
| Columbus | 1 |
| Whiteland | 8 |
| Greenwood | 5 |
| Indianapolis | 2 |
| Whitestown | 9 |
| Lebanon | 3 |
| Lafayette | 5 |
| Remington | 6 |
| Rensselaer | 1 |
| Lowell | 1 |
| Merrillville | 4 |
| Gary | 20 |
| Hammond | 2 |
| Hebron | 4 |

## Held records (Published = no) — reasons

- **Truck & Trailer Parking - Avco Blvd (Sellersburg)** (Truck Parking, Sellersburg): Legitimate marketplace listing (Truck Parking Club, corroborated by TruckerPath and Truxspot) but the lot's operator/business name is not disclosed and no phone is published; held pending confirmation of operator identity and to rule out overlap with the adjacent Pro Stop lot.
- **Mike's Diesel Tech** (Roadside Service, Sellersburg): Mobile-only breakdown/repair service with no verified fixed street address in the segment; published requires a verified address.
- **Interstate Fleet Services** (Roadside Service, Clarksville): Mobile-only dispatch service with no verified fixed street address or published local phone for the Clarksville area; published requires a verified address.
- **Henryville Rest Area (Northbound)** (Truck Parking, Henryville): Conflicting status: an INDOT page and directories list this NB rest area as active, but a Yelp listing marks it CLOSED and no verified street address is available. Held pending confirmation it is currently open.
- **Quality Inn Seymour I-65** (Hotels with Truck Parking, Seymour): Truck parking not confirmed on the official Choice Hotels page (only a third-party aggregator mentions it); phone number conflicts between sources (812-519-2959 vs 812-271-0041) and street number varies (2075 vs 2025 E Tipton St). Held pending verification of truck parking and a single confirmed phone.
- **Seymour Weigh Station (Northbound)** (Weigh Stations, Seymour): State weigh station identified only by milepost; no verifiable street address, phone or website to meet the publish criteria.
- **Seymour Weigh Station (Southbound)** (Weigh Stations, Seymour): State weigh station identified only by milepost; no verifiable street address, phone or website to meet the publish criteria.
- **Indy South Travel Plaza (Phillips 66)** (Truck Stops, Greenwood): Only a single mapping-database source (TruckMap); no phone or official website verified and operating status not corroborated.
- **Road X Truck Repair (Greenwood)** (Roadside Service, Greenwood): Mobile-only roadside service with no verified fixed street address; only a service-area page and phone are available.
- **Taylorsville Rest Area (I-65)** (Truck Parking, Taylorsville): INDOT public rest area with no street address or phone; does not meet the address + phone/website publish threshold.
- **Sam's Roadside Service (mobile)** (Roadside Service, Indianapolis): Mobile-only provider with no verified fixed street address on the I-65 corridor; sourced from a single service directory, insufficient corroboration to publish.
- **Truck Parking Club - 5102 E 500 S, Whitestown** (Truck Parking, Whitestown): Could not verify ZIP or specific I-65 exit access for this lot; minimal detail available and page blocked for direct fetch, so held pending confirmation.
- **CAT Scale at Love's Lafayette #874** (CAT Scales, Lafayette): A CAT Scale in Lafayette IN 47905 is listed as operated by Love's, and the Love's store page notes scale service, but I could not independently confirm the scale is the CAT-brand scale at this exact Love's (vs. a Love's-brand scale). Held pending confirmation from the official catscale.com locator, which was blocked by egress policy.
- **Truck Wash at Pilot Travel Center (Burr Street, Gary)** (Truck Washes, Gary): Truck wash is listed only as a Pilot amenity; no independent operator name, dedicated phone or website verified for the wash itself.
- **Gary Mobile On-Site Truck & Trailer Repair** (Roadside Service, Gary): Listed only on its own website plus lead-generation aggregators; the Gary address/phone are not independently corroborated and the site pattern is consistent with templated lead-gen listings.
- **Truck & Trailer Parking - 6800 W 9th Ave (Gary)** (Truck Parking, Gary): No verified operating business name for the lot (marketplace listing only); address and TPC URL verified but the name field cannot be confirmed.
- **Truck & Trailer Parking - 3870 Chase St (Gary)** (Truck Parking, Gary): No verified operating business name for the lot (marketplace listing only); address and TPC URL verified but the name field cannot be confirmed.
- **Truck & Trailer Parking - 5200 Cleveland St (Merrillville)** (Truck Parking, Merrillville): No verified operating business name for the lot (marketplace listing only); address and TPC URL verified via multiple directories but the name field cannot be confirmed.
- **Truck & Trailer Parking - 743 131st Place (Hammond)** (Truck Parking, Hammond): No verified operating business name and no verified ZIP; marketplace listing only. Also located in Hammond on the I-80/94/I-90 side rather than directly on I-65 (included because task names Hammond / IL-line connection).
- **Truck & Trailer Parking - 1849 Summer St (Hammond)** (Truck Parking, Hammond): No verified operating business name (marketplace listing only). Also located in Hammond on the I-80/94/I-90 side rather than directly on I-65 (included because task names Hammond / IL-line connection).
- **I-65 Southbound Weigh Station (Lowell)** (Weigh Stations, Lowell): No street address, phone or website; only a mile-marker location is verified, which is insufficient for the publish threshold.

## Manual phone-verification list

Rows missing a verified phone (blank rather than guessed): **38**. Call before/after import; priority = published rows:
- Pro Stop (Pilot Flying J Dealer #962) (Sellersburg, Truck Stops)
- CAT Scale at Pro Stop (Sellersburg) (Sellersburg, CAT Scales)
- Ramada by Wyndham Sellersburg / Louisville North (Sellersburg, Hotels with Truck Parking)
- Truck Parking Club - Seymour (1001 S Commerce Dr) (Seymour, Truck Parking)
- Henryville Rest Area (Southbound) (Henryville, Truck Parking)
- CAT Scale (at Pilot Travel Center #37) (Whiteland, CAT Scales)
- CAT Scale (at Flying J Travel Center #656) (Whiteland, CAT Scales)
- CAT Scale (at Love's Travel Stop #451) (Whiteland, CAT Scales)
- CAT Scale (at Road Ranger Travel Center) (Greenwood, CAT Scales)
- Truck Parking Club - Marr Rd Lot (Columbus, Truck Parking)
- Truck Parking Club - 4287 S Indianapolis Rd, Whitestown (Whitestown, Truck Parking)
- Truck Parking Club - 3501 S 500 E, Whitestown (Whitestown, Truck Parking)
- Speedway #8064 (Lafayette, Truck Stops)
- CAT Scale at Pilot Travel Center (Burr Street, Gary) (Gary, CAT Scales)
- CAT Scale at TA Gary (Burr Street) (Gary, CAT Scales)
- CAT Scale at Petro Gary (Grant Street) (Gary, CAT Scales)
- CAT Scale at Love's Travel Stop #417 (Grant Street, Gary) (Gary, CAT Scales)
- CAT Scale at Pilot Travel Center (Hebron) (Hebron, CAT Scales)
- CAT Scale at Flying J Travel Center (Hebron) (Hebron, CAT Scales)
- Southern Tire Mart at Pilot (Gary) (Gary, Tire Repair)
- Quality Inn Merrillville (Merrillville, Hotels with Truck Parking)
- Golden Group Properties Truck & Trailer Parking (Gary, Truck Parking)

## Website-verification list

Rows missing a verified website (blank rather than guessed): **16**. Published rows to backfill:
- Fuel Mart #783 (Austin, Truck Stops)
- Uniontown Fuel Stop (Crothersville, Truck Stops)
- Circle K (AMBEST) (Taylorsville, Truck Stops)
- White Glove Towing Service (Greenwood, Roadside Service)
- Super 8 by Wyndham Indianapolis/Southport Rd (Indianapolis, Hotels with Truck Parking)
- Circle K #2408 (Lafayette, Truck Stops)
- Crazy D's (Remington, Truck Stops)
- Family Express #35 (Rensselaer, Truck Stops)
- Midwest Commercial Semi-Truck Tire Center (Gary, Tire Repair)
- Steve's Towing & Associates (Merrillville, Roadside Service)

## Address-verification concerns

- Rows with no street address: **9**; rows whose address does not start with a street number (rest area / weigh station / mobile / ambiguous): **0**.
  - Mike's Diesel Tech (Sellersburg) — address: (blank)
  - Interstate Fleet Services (Clarksville) — address: (blank)
  - Henryville Rest Area (Northbound) (Henryville) — address: (blank)
  - Seymour Weigh Station (Northbound) (Seymour) — address: (blank)
  - Seymour Weigh Station (Southbound) (Seymour) — address: (blank)
  - Road X Truck Repair (Greenwood) (Greenwood) — address: (blank)
  - Taylorsville Rest Area (I-65) (Taylorsville) — address: (blank)
  - Sam's Roadside Service (mobile) (Indianapolis) — address: (blank)
  - I-65 Southbound Weigh Station (Lowell) (Lowell) — address: (blank)

## Parking-verification concerns

- Parking/overnight rows: **49**. Truck-space counts are blank unless a specific number was verified; parking-type flags set only where a source stated them.

## Weigh-station review

- Weigh/inspection stations included: **3** (0 published / 3 held). Highway coops without a civic street address + official source are held pending INDOT confirmation.
  - Seymour Weigh Station (Northbound) (Seymour) — HELD: State weigh station identified only by milepost; no verifiable street address, phone or website to meet the publish criteria.
  - Seymour Weigh Station (Southbound) (Seymour) — HELD: State weigh station identified only by milepost; no verifiable street address, phone or website to meet the publish criteria.
  - I-65 Southbound Weigh Station (Lowell) (Lowell) — HELD: No street address, phone or website; only a mile-marker location is verified, which is insufficient for the publish threshold.

## Legitimate co-location pairs

- In-file co-location pairs (CAT Scale / Love's Truck Care / Speedco / TA Truck Service / Petro service at a host truck stop, filed as separate rows per the directory model): **28** (score ≥ 50 by `classifyPair`). The host business is never duplicated.

## Coordinate readiness (no coordinates supplied)

- **Coordinate-ready candidates (90):** rows with a full verified street address — suitable for the verified geocoding console after import.
- **Manual-review coordinate candidates (9):** mile marker / rest area / weigh station / mobile service / incomplete or ambiguous address:
  - Mike's Diesel Tech (Sellersburg)
  - Interstate Fleet Services (Clarksville)
  - Henryville Rest Area (Northbound) (Henryville)
  - Seymour Weigh Station (Northbound) (Seymour)
  - Seymour Weigh Station (Southbound) (Seymour)
  - Road X Truck Repair (Greenwood) (Greenwood)
  - Taylorsville Rest Area (I-65) (Taylorsville)
  - Sam's Roadside Service (mobile) (Indianapolis)
  - I-65 Southbound Weigh Station (Lowell) (Lowell)

## Validation results

- Live import parser (`validate-import.ts` / `prepareImport`): master + all 4 parts = **100% clean** (0 skipped, 0 duplicates, 0 errors).
- Expansion Readiness (`assessExpansion` vs live production): **74 ready-to-publish, 25 import-unpublished, 0 manual-review, 0 reject**; slug collisions vs live: **0**.
- Duplicate detection (`classifyPair`): vs Georgia **0**, Tennessee **0**, Kentucky **0**, Ohio **0**, Michigan **0**, Florida **0**, live DB **0** matches; in-file co-location pairs: **28**; in-batch slug duplicates: **0**.
- Quality (`scoreCompleteness`): min 36, median 69, mean 66, max 80; labels: Incomplete 1, Needs work 40, Good 58.

## Known issues / limitations

- Some brand/official sites (Pilot/Flying J, Love's, TA/Petro, CAT Scale, TruckParkingClub, INDOT) rate-limit or block direct fetches; those facts were corroborated via 2+ independent directories and the affected fields left blank when unconfirmed.
- Weigh-station direction/mile-marker detail is corroborated via aggregated truck directories; held until an official INDOT source with a civic address confirms.

## Final recommendation

- Approved (Published = yes): **78** · Held (documented): **21** · Rejected in CSV: **0** (rejected candidates excluded pre-compilation — see sources report).
- Import parts: `i65-indiana-batch-007-part1.csv`, `i65-indiana-batch-007-part2.csv`, `i65-indiana-batch-007-part3.csv`, `i65-indiana-batch-007-part4.csv` (≤25 rows each).
- Nothing imported, published, merged, or deployed. Awaiting approval.
