# Batch 3 — I-75 Kentucky: Review Summary

CSV file: `data/imports/i75-kentucky-batch-003.csv` · verified 2026-07-11 · dry-run validated against the live import parser (`scripts/validate-import.ts`) **and** the Milestone 21 Expansion Readiness assessment (`assessExpansion`). **Nothing has been imported to production.**

## Totals

- Total rows in CSV: **99**
- Published = yes: **70**
- Published = no (held with documented reasons): **29**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **9** (only on listings actually found on truckparkingclub.com); no affiliate codes anywhere (none exist yet).
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category

| Category | Rows | Published | Held |
| --- | --- | --- | --- |
| CAT Scales | 12 | 12 | 0 |
| Hotels with Truck Parking | 14 | 9 | 5 |
| Roadside Service | 9 | 7 | 2 |
| Tire Repair | 14 | 11 | 3 |
| Truck Parking | 17 | 3 | 14 |
| Truck Stops | 23 | 22 | 1 |
| Truck Washes | 6 | 2 | 4 |
| Weigh Stations | 4 | 4 | 0 |
| **Total** | **99** | **70** | **29** |

## Rows by city (south to north where known)

| City | Rows |
| --- | --- |
| Williamsburg | 3 |
| Corbin | 12 |
| London | 5 |
| East Bernstadt | 1 |
| Mount Vernon | 5 |
| Berea | 5 |
| Richmond | 10 |
| Lexington | 11 |
| Georgetown | 14 |
| Sadieville | 3 |
| Corinth | 2 |
| Williamstown | 1 |
| Dry Ridge | 1 |
| Crittenden | 2 |
| Walton | 13 |
| Florence | 9 |
| Erlanger | 2 |

## Held records (Published = no) — reasons

- **Econo Lodge Berea** (Hotels with Truck Parking, Berea): Truck parking claim comes from third-party directories (allstays, hoteltruckparking.com) and guest reviews, not the hotel's official/booking page as required for this category.
- **Quality Inn & Suites Florence - Cincinnati South** (Hotels with Truck Parking, Florence): Truck parking claim could not be confirmed on the official Choice Hotels page or booking pages — only generic "free parking" verified; held.
- **Motel 6 Georgetown, KY - Lexington North** (Hotels with Truck Parking, Georgetown): Truck parking is sourced only to a truck-stop directory (3 spots) and guest reviews — not stated on the official Motel 6 or booking page.
- **Haven Hotel Renfro Valley (formerly Days Inn by Wyndham Renfro Valley)** (Hotels with Truck Parking, Mount Vernon): Rebrand in progress — havenhotelrenfrovalley.com is live while Wyndham still lists Days Inn Renfro Valley at the same address; confirm current operator, phone, and truck-parking policy before publishing.
- **Sunrise Inn Williamstown (formerly Days Inn)** (Hotels with Truck Parking, Williamstown): Staleness/branding conflict — legacy sources list it as "Days Inn Williamstown" with truck/bus/RV parking, but Booking.com and other current booking sites show the property as "Sunrise Inn Williamstown." Current name, phone and truck-parking policy need confirmation before publishing. | Branding transition (legacy Days Inn sources vs current Sunrise Inn booking pages) — confirm current name, phone, and truck-parking policy before publishing.
- **Littrell Truck & Tractor** (Roadside Service, Lexington): Street address could not be verified from official site snippets or directories (site 403 on fetch) — held until address confirmed.
- **HOB-CO LLC Mobile Truck & Trailer Repair** (Roadside Service, Richmond): Mobile-only service with no verifiable street address, and details rest on a single secondary source (Find Truck Service). Hold until a second independent source or official site confirms. | Strong I-75 corridor relevance (self-described I-75 coverage Mt. Vernon-Georgetown) but no verifiable street address — held until address confirmed.
- **Boss Truck Shop #40 (at Love's)** (Tire Repair, Corbin): Adjacent-address conflict with Love's Truck Care/Speedco at Love's #321 (218 vs 222 KY-770, different phones) — confirm whether Boss Truck Shop still operates separately before publishing.
- **Snider Fleet Solutions** (Tire Repair, Lexington): Location page exists on sniderfleet.com but street address and phone could not be extracted (site 403 on fetch; snippets did not include the address) — held until address is verified.
- **Ziegler Tire** (Tire Repair, Lexington): Street address and phone for the Lexington location were not captured from any source (official page not fetched; search snippets omitted them). Hold until address/phone verified.
- **76 Truck Plaza (Truck Parking Club listing)** (Truck Parking, Berea): TPC listing referenced in search results but exact listing URL not surfaced; operator identity partially entangled with 76 Fuel Center at 104 N Dogwood Dr — held pending direct confirmation.
- **Shed Lot Truck Parking** (Truck Parking, Corbin): Street address, phone and exit could not be verified (official site 403 on fetch; only search snippet of shedlottruckparking.com available). Possible overlap with the TPC Corbin lots — unresolved.
- **Truck Parking Club - 250 W Cumberland Gap Pkwy (Corbin)** (Truck Parking, Corbin): Only one source (the TPC listing URL itself, which 403'd to direct fetch); property details, space count, and operator unverified.
- **Truck Parking Club - 830 Byrley Rd (Corbin)** (Truck Parking, Corbin): Listing existence confirmed but no amenity, access, or space details verifiable from snippets.
- **Truck Parking Club - Shell/Gold Star Lot, 355 Violet Rd (Crittenden)** (Truck Parking, Crittenden): Truck-parking claim rests on a single TruckParkingClub sitemap entry; the exact listing URL and details (spots, price, active status) could not be retrieved (403). Shell station identity/exit are solid, but the parking category needs the live TPC listing confirmed.
- **Kentucky Welcome Center / Rest Area (I-71/75, Boone County)** (Truck Parking, Florence): Public rest area/welcome center — new listing type for this directory; held for approval before introducing rest areas as Truck Parking listings.
- **Truck Parking Club - 8477 US-42 (Florence)** (Truck Parking, Florence): Listing existence confirmed (TPC + Trucker Path index) but no verifiable details on spaces, access, or security; TPC page 403 on fetch.
- **Scott County Rest Area Northbound (MM 127)** (Truck Parking, Georgetown): Public rest area — new listing type for this directory; held for approval before introducing rest areas as Truck Parking listings.
- **Scott County Rest Area Southbound (MM 127)** (Truck Parking, Georgetown): Public rest area — new listing type for this directory; held for approval before introducing rest areas as Truck Parking listings.
- **Truck Parking Club - Online Transport (Georgetown)** (Truck Parking, Georgetown): TPC listing confirmed to exist (URL found in truckparkingclub.com search results), but listing page could not be opened (403) — spot count, price, security and distance to I-75 unverified. | Listing existence confirmed but no operational details (spaces, access, surface, security) could be verified from snippets; TPC page 403 on fetch.
- **Truck Parking Club - Phoenix Transportation Services (Georgetown)** (Truck Parking, Georgetown): TPC listing URL/title confirmed via truckparkingclub.com search results, but page could not be opened (403) — details (spots, price, hours, I-75 distance) unverified.
- **Truck Parking Club - 956 Enterprise Ct (Lexington)** (Truck Parking, Lexington): TPC listing confirmed to exist but no amenity/space/access details could be verified (listing page 403; snippets only described the building for lease).
- **I-75 Rest Area (Mile 82.5, both directions)** (Truck Parking, Richmond): Public rest area — new listing type for this directory; held for approval before introducing rest areas as Truck Parking listings.
- **Truck Parking Club - 830 Eastern Bypass (Richmond)** (Truck Parking, Richmond): Listing URL and address verified via truckparkingclub.com search index, but the listing page itself could not be opened (403/JS-blocked), so active status, space count, and amenities are unconfirmed. Exit number not stated by the listing (KY-876 = Exit 87 per iExit, but left blank pending confirmation). | Only generic marketing text verifiable; no space counts, access hours, or surface/security details found; TPC page 403 on fetch.
- **Clays Ferry Travel Center** (Truck Stops, Richmond): Multiple directory sources flag this location as "may be closed / pending verification" and no source confirms it is currently open. Held until current operating status is verified (e.g., by phone).
- **Highway Transport Chemical Tank Wash** (Truck Washes, Florence): Tank-trailer interior cleaning facility, not an exterior truck wash — category fit needs approval before publishing.
- **First American Truck Wash and Chrome Shop** (Truck Washes, Georgetown): Directory-only sourcing (no official site found); no source explicitly states an I-75 exit for this business and current operating status could not be confirmed.
- **TNT Services (Fleet Washing / Drive-Thru Truck Wash)** (Truck Washes, Lexington): No street address for the Lexington facility could be verified (official page returned 403 and search snippets state services but no address). Only company-wide toll-free phone available. Hold until address is confirmed.
- **Triple G Truck Wash** (Truck Washes, Mount Vernon): No street address published anywhere found; directory-only sourcing with no recent confirmation the wash is still operating (host Derby City South Truck Plaza listings do not currently advertise it).

## Cross-agent field conflicts (blanked in the CSV — resolve by phone)

- **CAT Scale — Pilot Travel Center #321, Walton (Richwood)**: phone (859) 365-0368 vs 859-485-1327 — blanked.
- **S&S Tire / Best-One Tire Commercial Center (Lexington)**: phone (859) 255-8932 vs (859) 255-8931 — blanked.
- **TA Truck Service - TA Florence**: phone (859) 317-5773 vs (859) 371-7166 — blanked; also categorized Roadside Service (kept) vs Tire Repair.
- **Haven Hotel Renfro Valley**: website havenhotelrenfrovalley.com vs Wyndham Days Inn page — blanked (row held for the rebrand).

## Manual phone-verification list

Call before or shortly after import:

- CAT Scale — Pilot Travel Center #321, Walton (Richwood) — conflicting phones (see above)
- S&S Tire / Best-One Tire Commercial Center, Lexington — conflicting phones (see above)
- TA Truck Service - TA Florence — conflicting phones (see above)
- Haven Hotel Renfro Valley, Mount Vernon — confirm operator + phone after rebrand (held)
- Sunrise Inn Williamstown — confirm current name/phone/truck parking (held)
- Boss Truck Shop #40 (at Love's), Corbin — confirm it still operates separately from Love's Truck Care (held)
- Mr. Fuel Travel Center, Walton — phone conflict between sources, left blank (published)
- Derby City South Truck Plaza, Mount Vernon — phone conflict between sources, left blank (published)
- TA Walton — space count 90 vs 60 and unverified phone (see sources report)

## Geocoding readiness (no coordinates supplied in this batch)

- **Coordinate-ready candidates (85):** rows with full street addresses — suitable for the verified geocoding console workflow after import.
- **Manual-review coordinate candidates (14):** rows without a street number (weigh stations, rest areas, milepost addresses, mobile services):
  - Littrell Truck & Tractor (Lexington) — address: (blank)
  - HOB-CO LLC Mobile Truck & Trailer Repair (Richmond) — address: (blank)
  - Snider Fleet Solutions (Lexington) — address: (blank)
  - Ziegler Tire (Lexington) — address: (blank)
  - Shed Lot Truck Parking (Corbin) — address: (blank)
  - Kentucky Welcome Center / Rest Area (I-71/75, Boone County) (Florence) — address: (blank)
  - TNT Services (Fleet Washing / Drive-Thru Truck Wash) (Lexington) — address: (blank)
  - Triple G Truck Wash (Mount Vernon) — address: (blank)
  - Scott County Rest Area Northbound (MM 127) (Georgetown) — address: I-75 Northbound, Mile Marker 127
  - Scott County Rest Area Southbound (MM 127) (Georgetown) — address: I-75 Southbound, Mile Marker 127
  - Kentucky Weigh Station - I-75 Southbound (Kenton County) (Crittenden) — address: I-75 Southbound, milepost 168
  - Kentucky Weigh Station - I-75 Northbound (Scott County) (Georgetown) — address: I-75 Northbound
  - Kentucky Weigh Station - I-75 Northbound (Laurel County) (London) — address: I-75 Northbound, mile point 34 (Laurel County)
  - Kentucky Weigh Station - I-75 Southbound (Laurel County) (London) — address: I-75 Southbound, mile point 34 (Laurel County)

## Validation results

- Live import parser (`validate-import.ts`): master + all 4 parts = **100% clean** (0 skipped, 0 duplicates, 0 errors).
- Expansion Readiness (M21 `assessExpansion` vs live production export): **76 ready-to-publish, 23 import-unpublished, 0 manual-review, 0 reject**; no duplicate hits against the live directory; no slug collisions.
- Duplicate detection (M21 `classifyPair`): **0 hits vs Georgia batch, 0 hits vs Tennessee batch, 0 hits vs live DB**. 19 in-file pairs classified `shared-address-sub-service` — all are the established co-location pattern (CAT Scale / Love's Truck Care / TA Truck Service rows at their host truck stops), same as GA/TN.
- Quality Dashboard scoring (M21 `scoreCompleteness`): min 36, median 68, mean 65.2, max 80; labels: Incomplete 1, Needs work 36, Good 62.

## Final audit

- Approved rows (Published = yes): **70**
- Unpublished rows (held, documented): **29**
- Rejected rows: **0 in CSV** — all rejected candidates were excluded before compilation (see the exclusion lists at the end of the sources report).
- Import parts: `i75-kentucky-batch-003-part1.csv`, `i75-kentucky-batch-003-part2.csv`, `i75-kentucky-batch-003-part3.csv`, `i75-kentucky-batch-003-part4.csv` (max 25 rows each).
- Nothing imported, published, merged, or deployed. Awaiting approval.
