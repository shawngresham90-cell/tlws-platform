# Batch 15 — I-40 Arkansas: Review Summary

CSV: `data/imports/i40-arkansas-batch-015.csv` · verified 2026-07-13 · dry-run validated against the live import
parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`). **Nothing has been imported to production.**

This batch extends I-40 west across the Mississippi River — Arkansas's full 284-mile
crossing and the directory's NINTH state, anchored by the West Memphis cluster, one of
the largest truck-stop concentrations in the country.

## Totals

- Total researched candidates: **149** (127 included + 22 excluded)
- Total rows in CSV: **127**
- Published = yes: **91**
- Published = no (held with documented reasons): **36**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **4** (only where actually listed on truckparkingclub.com); no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by state

| State | Rows | Published | Held |
| --- | --- | --- | --- |
| AR | 127 | 91 | 36 |

## Rows by category

| Category | Rows | Published | Held |
| --- | --- | --- | --- |
| CAT Scales | 18 | 17 | 1 |
| Hotels with Truck Parking | 22 | 11 | 11 |
| Roadside Service | 13 | 10 | 3 |
| Tire Repair | 10 | 10 | 0 |
| Truck Parking | 11 | 3 | 8 |
| Truck Stops | 40 | 31 | 9 |
| Truck Washes | 9 | 9 | 0 |
| Weigh Stations | 4 | 0 | 4 |
| **Total** | **127** | **91** | **36** |

## Corridor coverage (OK line/Van Buren → Russellville → Conway → Little Rock → Brinkley → West Memphis)

- Distinct I-24 exits represented: **32** — 5, 13, 20, 35, 37, 55, 57, 58, 81, 84, 101, 107, 125, 127, 129, 135, 142, 157, 161, 175, 183, 193, 216, 221, 233, 241, 247, 256, 260, 271, 280, 153A

## Rows by city (west → east)
| City | Rows |
| --- | --- |
| Van Buren | 4 |
| Alma | 8 |
| Mulberry | 1 |
| Ozark | 6 |
| Clarksville | 9 |
| Russellville | 11 |
| Atkins | 2 |
| Morrilton | 2 |
| Conway | 5 |
| Mayflower | 2 |
| North Little Rock | 15 |
| Lonoke | 3 |
| Carlisle | 2 |
| Hazen | 8 |
| Brinkley | 10 |
| Wheatley | 1 |
| Palestine | 2 |
| Forrest City | 3 |
| Widener | 1 |
| Heth | 1 |
| Earle | 4 |
| West Memphis | 25 |
| De Valls Bluff | 1 |
| Lehi | 1 |

## Held records (Published = no) — reasons

- **White River Rest Area (I-40 MM 199, EB and WB)** (Truck Parking, De Valls Bluff): Weigh station / rest area / welcome center held pending an official ARDOT/AHP source with a civic street address confirming direction, exit/mile marker and (for parking) legal overnight status; overnight parking is never assumed from truck-space presence alone.
- **Shell Super Stop** (Truck Stops, Hazen): (see sources)
- **Reddy's Super Stop** (Truck Stops, Brinkley): (see sources)
- **Travel Inn Hazen** (Hotels with Truck Parking, Hazen): (see sources)
- **Days Inn & Suites by Wyndham Brinkley** (Hotels with Truck Parking, Brinkley): (see sources)
- **Days Inn Carlisle** (Hotels with Truck Parking, Carlisle): (see sources)
- **Diesel Truck Repairs** (Roadside Service, Brinkley): (see sources)
- **Little Rock Truck Parking - Conway Lot** (Truck Parking, Conway): (see sources)
- **Mapco Express #3059** (Truck Stops, Conway): (see sources)
- **I-40 Truck Turnout - Mile 134 Eastbound (Mayflower/Conway)** (Truck Parking, Mayflower): (see sources)
- **Bethal Diesel Service** (Roadside Service, Conway): (see sources)
- **Alma I-40 Weigh Station (Eastbound)** (Weigh Stations, Alma): Station existence is confirmed by official ARDOT Arkansas Highway Police sources (District 3, Crawford County, 'Alma I-40 East', phone 479-384-3968), but no civic address could be obtained: the official ARDOT weigh station PDF returns HTTP 403 in this environment and search snippets give only direction/phone. Unofficial sources place it near I-40 mile 7 eastbound.
- **Alma I-40 Weigh Station (Westbound)** (Weigh Stations, Alma): Confirmed by official ARDOT/AHP sources ('Alma I-40 West', District 3 Crawford County, phone 479-384-3970), but no civic address available from an accessible official Arkansas source (ARDOT PDF returns 403). Unofficial sources place it near I-40 mile 7 westbound.
- **Arkansas Welcome Center at Van Buren/Fort Smith (I-40 EB, MM 2)** (Truck Parking, Van Buren): Truck parking, 24/7 restrooms, and hours are well documented and the address 2915 Interstate 40, Van Buren, AR 72956 appears in several directories, but the official Arkansas sources (arkansas.com welcome centers page, ARDOT rest-area PDF at media.ark.org) returned HTTP 403 in this environment, so the civic address could not be verified against an official Arkansas source as required.
- **Van Buren Travel Center** (Truck Stops, Van Buren): Listed at I-40 Exit 5 (Fayetteville Rd/AR-59), Van Buren, AR 72956 only by iExit; no second independent source found confirming the business name, address, or current operation.
- **Ozark Truck & Travel Plaza** (Truck Stops, Alma): Single source (TruckMap) places it at I-40 Exit 13 & Hwy 71 in Alma; no independent corroboration found, and it may be a duplicate or former name of the Alma Travel Mart facility at the same interchange.
- **Truck Parking Club - Pence Ln lot behind Workman's Travel Center** (Truck Parking, Ozark): Paid/reservable truck and trailer parking off Pence Ln at I-40 Exit 35 is documented only by Truck Parking Club's own listing pages (single source domain); no independent corroboration found.
- **Quality Inn & Suites Alma I-40** (Hotels with Truck Parking, Alma): Hotel at 439 US Highway 71 N, I-40 Exit 13 is well documented, but no source explicitly confirms truck/large-vehicle parking (only standard free parking), so it does not qualify for hotels-truck-parking.
- **Highway 64 Truck & Trailer Repair** (Roadside Service, Van Buren): Company site claims a shop at 5200 Alma Hwy, Van Buren with 24/7 mobile service along the I-40 corridor, but the fixed-shop address is documented only by the company's own website; no independent second source confirming a fixed facility was found, and its marketing is primarily mobile/roadside dispatch.
- **Flash Market #123** (Truck Stops, North Little Rock): Directory listings only (findfuelstops/allstays); could not verify the facility currently operates under this name and no current phone/zip could be confirmed.
- **Holiday Inn Express & Suites Lonoke I-40 (Exit 175)** (Hotels with Truck Parking, Lonoke): Truck-parking claim from only one source (HotelPlanner); rule requires explicit multi-source truck-parking confirmation for hotels.
- **Motel 6 North Little Rock** (Hotels with Truck Parking, North Little Rock): Semi-truck parking claim from a single source (HotelPlanner); exit proximity and truck parking not independently confirmed.
- **Shell Oil of Clarksville** (Truck Stops, Clarksville): (see sources)
- **Exit 57 Auto Truck Express** (Truck Stops, Clarksville): (see sources)
- **Truck Parking Club lot - 6906 AR-124** (Truck Parking, Russellville): (see sources)
- **Super 8 by Wyndham Russellville** (Hotels with Truck Parking, Russellville): (see sources)
- **CAT Scale - Ozark (Love's #271 area)** (CAT Scales, Ozark): (see sources)
- **Arkansas Highway Police Weigh Station - I-40 Eastbound (Lehi / West Memphis)** (Weigh Stations, West Memphis): Weigh station / rest area / welcome center held pending an official ARDOT/AHP source with a civic street address confirming direction, exit/mile marker and (for parking) legal overnight status; overnight parking is never assumed from truck-space presence alone.
- **Arkansas Highway Police Weigh Station - I-40 Westbound (Riverside / West Memphis)** (Weigh Stations, West Memphis): Weigh station / rest area / welcome center held pending an official ARDOT/AHP source with a civic street address confirming direction, exit/mile marker and (for parking) legal overnight status; overnight parking is never assumed from truck-space presence alone.
- **Forrest City Rest Area - I-40 Eastbound (MM 235)** (Truck Parking, Forrest City): Weigh station / rest area / welcome center held pending an official ARDOT/AHP source with a civic street address confirming direction, exit/mile marker and (for parking) legal overnight status; overnight parking is never assumed from truck-space presence alone.
- **Forrest City Rest Area - I-40 Westbound (MM 242.6)** (Truck Parking, Forrest City): Weigh station / rest area / welcome center held pending an official ARDOT/AHP source with a civic street address confirming direction, exit/mile marker and (for parking) legal overnight status; overnight parking is never assumed from truck-space presence alone.
- **PJ's Country Store (Jump Stop / Valero)** (Truck Stops, Lehi): (see sources)
- **Quality Inn West Memphis I-40** (Hotels with Truck Parking, West Memphis): (see sources)
- **Studio 6 Suites West Memphis** (Hotels with Truck Parking, West Memphis): (see sources)
- **Motel 6 West Memphis** (Hotels with Truck Parking, West Memphis): (see sources)
- **Express Inn West Memphis** (Hotels with Truck Parking, West Memphis): (see sources)

## Manual phone-verification list

Rows missing a verified phone (blank rather than guessed): **36**. Call before/after import; priority = published rows:
- Super 8 by Wyndham Brinkley (Brinkley, Hotels with Truck Parking)
- Delta Repair Shop (Brinkley, Roadside Service)
- Best Western Conway (Conway, Hotels with Truck Parking)
- Motel 6 Morrilton (Morrilton, Hotels with Truck Parking)
- Days Inn by Wyndham Alma (Alma, Hotels with Truck Parking)
- Ozark Inn & Suites (Ozark, Hotels with Truck Parking)
- Days Inn by Wyndham Lonoke (Lonoke, Hotels with Truck Parking)
- EZ Storage & Parking (Truck Parking Club) (Russellville, Truck Parking)
- Southern Tire Mart at Pilot Flying J (West Memphis, Tire Repair)
- Days Inn by Wyndham Forrest City (Forrest City, Hotels with Truck Parking)

## Website-verification list

Rows missing a verified website (blank rather than guessed): **41**. Published rows to backfill:
- T Ricks Travel Center (Hazen, Truck Stops)
- Conoco Truck Stop (Carlisle One Stop) (Carlisle, Truck Stops)
- Pit Stop Diner (Wheatley, Truck Stops)
- Delta Repair Shop (Brinkley, Roadside Service)
- Morgan Shell Truck Stop (North Little Rock, Truck Stops)
- Morgan Valero Truck Stop (North Little Rock, Truck Stops)
- Alma Travel Mart (Alma, Truck Stops)
- Kountry Xpress Truck Stop (Mulberry, Truck Stops)
- Newtown Truck Service (Alma, Roadside Service)
- Ozark Inn & Suites (Ozark, Hotels with Truck Parking)
- Galloway Inn (North Little Rock, Hotels with Truck Parking)
- Exxon Tiger Mart / Truck Center (Clarksville, Truck Stops)
- Shell Lake Travel Center (Earle, Truck Stops)
- Mapco Express #3155 (Heth, Truck Stops)
- 247 Truck Stop (Widener, Truck Stops)
- Southern Tire Mart at Pilot Flying J (West Memphis, Tire Repair)

## Address-verification concerns

- Rows with no street address: **20**; rows whose address does not start with a street number (rest area / weigh station / ambiguous): **0**.
  - White River Rest Area (I-40 MM 199, EB and WB) (De Valls Bluff) — address: (blank)
  - Reddy's Super Stop (Brinkley) — address: (blank)
  - Little Rock Truck Parking - Conway Lot (Conway) — address: (blank)
  - I-40 Truck Turnout - Mile 134 Eastbound (Mayflower/Conway) (Mayflower) — address: (blank)
  - Bethal Diesel Service (Conway) — address: (blank)
  - Alma I-40 Weigh Station (Eastbound) (Alma) — address: (blank)
  - Alma I-40 Weigh Station (Westbound) (Alma) — address: (blank)
  - Arkansas Welcome Center at Van Buren/Fort Smith (I-40 EB, MM 2) (Van Buren) — address: (blank)
  - Van Buren Travel Center (Van Buren) — address: (blank)
  - Ozark Truck & Travel Plaza (Alma) — address: (blank)
  - Truck Parking Club - Pence Ln lot behind Workman's Travel Center (Ozark) — address: (blank)
  - Quality Inn & Suites Alma I-40 (Alma) — address: (blank)
  - Highway 64 Truck & Trailer Repair (Van Buren) — address: (blank)
  - Super 8 by Wyndham Russellville (Russellville) — address: (blank)
  - CAT Scale - Ozark (Love's #271 area) (Ozark) — address: (blank)
  - Arkansas Highway Police Weigh Station - I-40 Eastbound (Lehi / West Memphis) (West Memphis) — address: (blank)
  - Arkansas Highway Police Weigh Station - I-40 Westbound (Riverside / West Memphis) (West Memphis) — address: (blank)
  - Forrest City Rest Area - I-40 Eastbound (MM 235) (Forrest City) — address: (blank)
  - Forrest City Rest Area - I-40 Westbound (MM 242.6) (Forrest City) — address: (blank)
  - Express Inn West Memphis (West Memphis) — address: (blank)

## Parking-verification concerns

- Parking/overnight rows: **73**. Truck-space counts are blank unless a specific number was verified; parking-type flags set only where a source stated them. Overnight is never inferred from truck-space presence.

## Weigh-station review

- Weigh/inspection stations included: **4** (0 published / 4 held). Stations without a civic street address + official source are held pending ARDOT/AHP confirmation.
  - Alma I-40 Weigh Station (Eastbound) (Alma) — HELD: Station existence is confirmed by official ARDOT Arkansas Highway Police sources (District 3, Crawford County, 'Alma I-40 East', phone 479-384-3968), but no civic address could be obtained: the official ARDOT weigh station PDF returns HTTP 403 in this environment and search snippets give only direction/phone. Unofficial sources place it near I-40 mile 7 eastbound.
  - Alma I-40 Weigh Station (Westbound) (Alma) — HELD: Confirmed by official ARDOT/AHP sources ('Alma I-40 West', District 3 Crawford County, phone 479-384-3970), but no civic address available from an accessible official Arkansas source (ARDOT PDF returns 403). Unofficial sources place it near I-40 mile 7 westbound.
  - Arkansas Highway Police Weigh Station - I-40 Eastbound (Lehi / West Memphis) (West Memphis) — HELD: Weigh station / rest area / welcome center held pending an official ARDOT/AHP source with a civic street address confirming direction, exit/mile marker and (for parking) legal overnight status; overnight parking is never assumed from truck-space presence alone.
  - Arkansas Highway Police Weigh Station - I-40 Westbound (Riverside / West Memphis) (West Memphis) — HELD: Weigh station / rest area / welcome center held pending an official ARDOT/AHP source with a civic street address confirming direction, exit/mile marker and (for parking) legal overnight status; overnight parking is never assumed from truck-space presence alone.
- Public rest areas / welcome centers and weigh stations without a civic address + official state source are held.

## Legitimate co-location pairs

- In-file co-location pairs (CAT Scale / Love's Truck Care / Speedco / TA Truck Service at a host truck stop, filed as separate rows per the directory model): **27** (score >= 50 by `classifyPair`). The host business is never duplicated.

## Coordinate readiness (no coordinates supplied)

- **Coordinate-ready candidates (107):** rows with a full verified street address — suitable for the verified geocoding console after import.
- **Manual-review coordinate candidates (20):** mile marker / rest area / weigh station / incomplete or ambiguous address:
  - White River Rest Area (I-40 MM 199, EB and WB) (De Valls Bluff)
  - Reddy's Super Stop (Brinkley)
  - Little Rock Truck Parking - Conway Lot (Conway)
  - I-40 Truck Turnout - Mile 134 Eastbound (Mayflower/Conway) (Mayflower)
  - Bethal Diesel Service (Conway)
  - Alma I-40 Weigh Station (Eastbound) (Alma)
  - Alma I-40 Weigh Station (Westbound) (Alma)
  - Arkansas Welcome Center at Van Buren/Fort Smith (I-40 EB, MM 2) (Van Buren)
  - Van Buren Travel Center (Van Buren)
  - Ozark Truck & Travel Plaza (Alma)
  - Truck Parking Club - Pence Ln lot behind Workman's Travel Center (Ozark)
  - Quality Inn & Suites Alma I-40 (Alma)
  - Highway 64 Truck & Trailer Repair (Van Buren)
  - Super 8 by Wyndham Russellville (Russellville)
  - CAT Scale - Ozark (Love's #271 area) (Ozark)
  - Arkansas Highway Police Weigh Station - I-40 Eastbound (Lehi / West Memphis) (West Memphis)
  - Arkansas Highway Police Weigh Station - I-40 Westbound (Riverside / West Memphis) (West Memphis)
  - Forrest City Rest Area - I-40 Eastbound (MM 235) (Forrest City)
  - Forrest City Rest Area - I-40 Westbound (MM 242.6) (Forrest City)
  - Express Inn West Memphis (West Memphis)

## Validation results

- Live import parser (`prepareImport`): master + all 6 parts = **100% clean** (0 skipped, 0 duplicates, 0 errors).
- Expansion Readiness (`assessExpansion` vs live production): **95 ready-to-publish, 32 import-unpublished, 0 manual-review, 0 reject**; slug collisions vs live: **0**.
- Duplicate detection (`classifyPair`): vs Georgia I-75 **0**, Tennessee I-75 **0**, Kentucky I-75 **0**, Ohio **2**, Michigan **0**, Florida **0**, Indiana **1**, Alabama **0**, Tennessee I-65 **0**, pending I-65 KY (b010) **2**, pending I-24 TN (b011) **4**, pending I-24 KY (b012) **0**, live DB **3** matches; in-file co-location pairs: **27**; in-batch slug duplicates: **0**.
  - Cross-batch/live hits are reviewed individually in the validation report; brand-multi-exit matches (same chain at a different city/exit/street address) are false positives. `assessExpansion` is the authoritative gate.
- Quality (`scoreCompleteness`): min 24, median 70, mean 64.6, max 80; labels: Incomplete 11, Needs work 39, Good 77.

## Existing-production duplicate protection (AR)

- Arkansas is a NEW state for the directory: production has **0** existing AR listings, so no existing-state collision is possible. All candidates were still cross-checked (`classifyPair`) against every merged batch CSV, all five pending unmerged batches (b010-b014) and the full live DB; only shared-corporate-contact chain false positives surfaced (same Speedco/Love's corporate phone+website or same Road Ranger chain name at a different city, state and street address). Memphis TN facilities across the river were excluded (covered by the I-40 TN batch).
- Rows dropped because they already exist in production (not re-added, production left unchanged): **0**.

## Known issues / limitations

- Some brand/official sites (Pilot/Flying J, Love's, CAT Scale, TruckParkingClub, IDOT, GDOT) rate-limit or block direct fetches; facts were corroborated via 2+ independent directories and the affected fields left blank when unconfirmed.
- ardot.gov / arkansas.gov / arkansas.com 403 through the research proxy, so the officially-confirmed Alma and Lehi/Riverside (West Memphis) weigh stations, the ARDOT rest areas (MM 36/199/235/242.6) and the Van Buren Welcome Center are HELD pending official civic addresses rather than published on unofficial data. Store-number corrections were sourced during research (West Memphis Flying J is #607, the MLK Dr Pilot is #429; the 'TA West Memphis' is actually Petro #311).

## Final recommendation

- Approved (Published = yes): **91** · Held (documented): **36** · Rejected in CSV: **0** (rejected candidates excluded pre-compilation — see sources report).
- Import parts: `i40-arkansas-batch-015-part1.csv`, `i40-arkansas-batch-015-part2.csv`, `i40-arkansas-batch-015-part3.csv`, `i40-arkansas-batch-015-part4.csv`, `i40-arkansas-batch-015-part5.csv`, `i40-arkansas-batch-015-part6.csv` (<=25 rows each).
- Nothing imported, published, merged, or deployed. Awaiting approval.
