# Batch 4 — I-75 Ohio: Review Summary

CSV file: `data/imports/i75-ohio-batch-004.csv` · verified 2026-07-11 · dry-run validated against the live import parser (`scripts/validate-import.ts`) **and** the Milestone 21 Expansion Readiness assessment (`assessExpansion`). **Nothing has been imported to production.**

## Totals

- Total rows in CSV: **95**
- Published = yes: **49**
- Published = no (held with documented reasons): **46**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **17** (only on listings actually found on truckparkingclub.com); no affiliate codes anywhere (none exist yet).
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category

| Category | Rows | Published | Held |
| --- | --- | --- | --- |
| CAT Scales | 16 | 13 | 3 |
| Hotels with Truck Parking | 5 | 1 | 4 |
| Roadside Service | 8 | 5 | 3 |
| Tire Repair | 9 | 5 | 4 |
| Truck Parking | 21 | 4 | 17 |
| Truck Stops | 27 | 17 | 10 |
| Truck Washes | 7 | 4 | 3 |
| Weigh Stations | 2 | 0 | 2 |
| **Total** | **95** | **49** | **46** |

## Rows by city (south to north where known)

| City | Rows |
| --- | --- |
| Cincinnati | 4 |
| Sharonville | 3 |
| West Chester | 1 |
| Monroe | 5 |
| Middletown | 3 |
| Franklin | 2 |
| Dayton | 6 |
| Englewood | 1 |
| Vandalia | 2 |
| Troy | 1 |
| Piqua | 2 |
| Sidney | 6 |
| Anna | 3 |
| Botkins | 1 |
| Wapakoneta | 3 |
| Cridersville | 1 |
| Lima | 5 |
| Beaverdam | 8 |
| Bluffton | 1 |
| Findlay | 9 |
| North Baltimore | 7 |
| Portage | 1 |
| Perrysburg | 2 |
| Rossford | 1 |
| Walbridge | 1 |
| Northwood | 2 |
| Toledo | 13 |
| (I-75 Exit 15 area) | 1 |

## Held records (Published = no) — reasons

- **CAT Scale — Pilot Travel Center #231, Monroe** (CAT Scales, Monroe): Street address/ZIP/phone not verified from an official source. Hold for confirmation.
- **CAT Scale — Pilot Travel Center #24, Sharonville** (CAT Scales, Sharonville): Street address/ZIP/phone not verified from an official source; a TA #069 is also indexed at Exit 15, so host identity for the CAT scale at this exit is not fully disambiguated. Hold for address confirmation.
- **CAT Scale — Pilot Travel Center #284, West Chester** (CAT Scales, West Chester): City not disambiguated (Exit 18 area) and street address/ZIP not verified from an official source. Hold for confirmation.
- **Red Roof Inn Findlay** (Hotels with Truck Parking, Findlay): I-75 Exit 159 location and free parking confirmed by hotelguides/allstays, but explicit TRUCK/semi parking not stated by an official Red Roof page in results. Category requires a source stating truck parking — hold pending confirmation.
- **Holiday Inn Express & Suites Monroe (Cincinnati North)** (Hotels with Truck Parking, Monroe): Only "complimentary parking" is stated — no source confirms TRUCK/semi parking. Does not meet category requirement. Hold/likely exclude pending explicit truck-parking source.
- **Super 8 by Wyndham Sidney** (Hotels with Truck Parking, Sidney): Truck parking claim comes from a single directory (HotelGuides), not the official Wyndham/Super 8 property page. I-75 Exit 92 confirmed. Hold pending official-page or second-source truck-parking confirmation.
- **Motel 6 Toledo** (Hotels with Truck Parking, Toledo): Truck/large-vehicle parking claim is single-source (trivago listing), not the official Motel 6 property page; exact I-75 exit not stated. Hold pending official-page confirmation.
- **Englewood Truck (SW Ohio Towing, Recovery & Mobile Truck Repair)** (Roadside Service, Englewood): Corridor relevance explicit (I-75 SW Ohio) and phone captured, but no verified street address/ZIP (official page 403). Hold pending street address confirmation.
- **Ed's 24 Hour Service** (Roadside Service, Findlay): Strong corridor relevance (explicitly services I-75 in Findlay) but no verified street address/ZIP/phone captured yet (official page 403). Hold pending address/phone confirmation.
- **Alpha Dawg Diesel Truck & Trailer Repair** (Roadside Service, Monroe): Yelp lists the shop as CLOSED (updated Sept 2025). Closure signal; do not publish without confirmation it is operating.
- **Hamilton Truck and Tire Service** (Tire Repair, Cincinnati): Single-source (Yelp) so far; no ZIP/phone captured and I-75 proximity inferred, not stated. Needs a second independent directory + phone.
- **Love's Truck Tire Care - Dayton (S. Edwin C. Moses Blvd)** (Tire Repair, Dayton): Truck Tire Care center "scheduled to open late Dec 2025" — operational status as a tire-repair facility not confirmed as of research date; hold pending confirmation it is open.
- **Ziegler Tire** (Tire Repair, Toledo): Toledo commercial location confirmed to exist (official + Yellowpages 43611) but street address/phone not captured (official page 403); exact I-75 proximity unconfirmed. Hold pending address confirmation.
- **Ziegler Tire** (Tire Repair, Walbridge): Corridor ambiguity — Walbridge/Lemoyne Rd sits between I-75 (exit 193 area) and I-280; no source ties it to a specific I-75 exit. Hold until I-75 relevance vs I-280 is confirmed.
- **Truck Parking Club - 3928 Glenway Ave (Cincinnati)** (Truck Parking, Cincinnati): Glenway Ave (west side, 45205) is closer to I-75/US-50 but exact I-75 distance/exit not stated in a source; corridor relevance plausible but unconfirmed.
- **Truck Parking Club - 737 W 6th St (Cincinnati, bobtail/box only)** (Truck Parking, Cincinnati): Bobtail/box-truck only (not full tractor-trailer); I-75 exit/distance not stated. Downtown, near I-75 but unconfirmed corridor detail.
- **Truck Parking Club - 215 Basswood Ave (Dayton, bobtail/box)** (Truck Parking, Dayton): Bobtail/box-truck only; located "between Hwy-48 and I-75" but no exact exit/distance stated.
- **Truck Parking Club - 3100 Transportation Rd / Heavy Haul Transport (Dayton)** (Truck Parking, Dayton): Security & 24/7 confirmed, but specific I-75 exit/distance not stated in a source; Dayton corridor relevance plausible but unconfirmed.
- **Truck Parking Club - 636 N Irwin St (Dayton)** (Truck Parking, Dayton): I-75 exit/distance not stated in a source; Dayton corridor relevance plausible but unconfirmed.
- **Truck Parking Club - 11758 Township Rd 100 (Findlay)** (Truck Parking, Findlay): TruckParkingClub listing confirmed, but exact I-75 exit and space count not published; third-party marketplace listing. Publish once exit/capacity confirmed. | Exact I-75 exit/distance not stated per-listing; Findlay corridor relevance plausible but unconfirmed.
- **Truck Parking Club - 750 Buckeye Rd (Lima, bobtail)** (Truck Parking, Lima): Bobtail-only; exact I-75 exit/distance not stated per-listing.
- **Truck Parking Club - 2601 Verity Pkwy (Middletown)** (Truck Parking, Middletown): I-75 distance/exit not stated in a source for this specific lot; corridor relevance plausible (Middletown) but unconfirmed. | TruckParkingClub lot; the TPC specialist pass could not confirm a per-listing I-75 exit/distance or operational details (page 403) — held pending confirmation.
- **I-75 Rest Area — Northbound (Miami County)** (Truck Parking, Piqua): Public rest area — new listing type for this directory; held for approval before introducing rest areas as Truck Parking listings.
- **I-75 Rest Area — Southbound (Miami County)** (Truck Parking, Piqua): Public rest area — new listing type for this directory; held for approval before introducing rest areas as Truck Parking listings.
- **My Parking Hub - Toledo (Sam's Hub Access)** (Truck Parking, Toledo): No verified street address/ZIP/phone found; "near I-75" not tied to a specific exit. Hold pending address confirmation.
- **Toledo Truck Hub** (Truck Parking, Toledo): No verified street address/ZIP/phone found; "near I-75" not tied to a specific exit.
- **Truck Parking Club - 1333 Matzinger Rd / Ironhorn Enterprises (Toledo)** (Truck Parking, Toledo): Exact I-75 exit/distance not stated per-listing; corridor relevance plausible but unconfirmed.
- **Truck Parking Club - 435 Dura Ave (Toledo)** (Truck Parking, Toledo): Exact I-75 exit/distance not stated per-listing; corridor relevance plausible (north Toledo) but unconfirmed.
- **Truck Parking Club - 5430 Stickney Ave (Toledo)** (Truck Parking, Toledo): Exact I-75 exit/distance not stated per-listing; corridor relevance plausible but unconfirmed.
- **Truck Parking Club - 6180 Benore Rd (Toledo)** (Truck Parking, Toledo): Exit 210 / "1 mile from I-75" reported in the Toledo city page snippet describing "a paved lot," but not explicitly tied by the source to this exact Benore Rd listing (Benore Rd does sit near Exit 210). Hold pending per-listing confirmation.
- **Truck Parking Club - 6180 Hagman Rd (Toledo)** (Truck Parking, Toledo): Exact I-75 exit/distance not stated per-listing; corridor relevance plausible but unconfirmed.
- **Pilot Travel Center #24** (Truck Stops, (I-75 Exit 15 area)): Could not verify street address, phone, ZIP or current operating status from any primary/secondary source; one directory even placed the nearest operating Pilot ~7 mi from Exit 29, casting doubt on an Exit-15 Pilot. Do not publish without address confirmation.
- **Shell** (Truck Stops, Bluffton): Generic "Shell" identity from a single secondary directory; truck-parking claim not corroborated by a second independent source and no phone/ZIP confirmed. Hold pending verification.
- **Circle K (formerly Shell)** (Truck Stops, Botkins): Brand in transition (Shell -> Circle K) and truck-parking availability is contradictory across sources (one lists truck parking, another states "no parking spaces"). Not clearly a truck-driver-facing stop; hold pending verification.
- **NEU CLARK 24 Hour Truck Stop** (Truck Stops, Lima): I-75 exit/proximity not confirmed and truck-specific amenities (parking count, showers, overnight) not documented by any source; only c-store/food confirmed. Needs verification of truck parking and exit before publishing.
- **Speedway #9383** (Truck Stops, Monroe): A gas station, not verified as truck-driver-facing (no confirmed truck parking, showers, high-flow diesel lanes or scale). Insufficient truck amenities to classify as a Truck Stop; no address confirmed.
- **Stony Ridge Travel Center / Stony Ridge Truck Plaza** (Truck Stops, Monroe): Yelp lists it as CLOSED (updated Jan 2026). Staleness/closure signal; do not publish without confirming it is open.
- **Hy-Miler (Mobil) Travel Center** (Truck Stops, Northwood): Brand-name ambiguity (directory lists "Hy-miler," Yelp/GasBuddy list "Mobil") and small footprint with no confirmed truck parking. Hold pending clarification.
- **US Fuel Mart / Interstate Truck Stop** (Truck Stops, Portage): Single directory source; directory explicitly states "no parking" and minimal amenities. Low value / unverified current status — hold.
- **Barney's Convenience Mart** (Truck Stops, Rossford): Very small (only 2 truck spaces per directory), no official brand page, and only directory (allstays/truckmap/findtruckservice) coverage. Held as minor/low-value; verify current operation before publishing.
- **Speedway #3424** (Truck Stops, Troy): Diesel/fuel stop with no confirmed overnight truck parking, showers, or scale; not clearly a driver-facing truck stop. Held pending confirmation of truck parking.
- **Blue Beacon Truck Wash of Perrysburg** (Truck Washes, Perrysburg): Located on I-280 at Exit 1B (Stony Ridge), not on the I-75 mainline. I-280 splits from I-75 near Perrysburg, so this is off-corridor for an I-75 directory; hold/exclude unless I-75-adjacent listings are desired. Address digits vary by source (26525 vs 26416 Baker Dr).
- **Superior Wash** (Truck Washes, Sharonville): Superior Wash is an on-site/mobile fleet power-washing franchise (superiorwash.com), not confirmed as a driver drive-up wash bay. Not clearly truck-driver-facing walk-in; hold pending confirmation of a fixed public wash bay.
- **Toledo Tank Wash** (Truck Washes, Toledo): Only one secondary directory (findtruckservice) verifies identity/address; exit 207 relevance and hours need a 2nd independent source. Hold pending corroboration.
- **Ohio Weigh Station - I-75 Southbound (Hancock County)** (Weigh Stations, Findlay): PrePass weigh/inspection site near Findlay; exact mile marker/exit not confirmed on an official Ohio source — held for verification.
- **Ohio Weigh Station - I-75 Northbound (Wood County)** (Weigh Stations, North Baltimore): Weigh station north of North Baltimore; exact mile marker/exit not confirmed on an official Ohio source, and two passes described its location differently — held for verification.

## Cross-agent field conflicts (blanked in the CSV — resolve by phone)

Where two research passes reported different values for the same field, the field was left **blank** rather than guessed (the no-guessing rule). Genuine conflicts this batch:

- **Hamilton Truck and Tire Service (Cincinnati)**: categorized Tire Repair (corridor pass) vs Roadside Service (sweep) — kept Tire Repair; row held for open-status confirmation.
- **North Dixie Truck & Trailer (Lima)**: three conflicting phone numbers across sources — left blank (published on verified address + identity).
- **Truck Parking Club - 2601 Verity Pkwy / 2710 S Main St (Middletown)**: the two Middletown TPC lots carry distinct addresses/ZIPs (45044 vs 45042); each kept on its own row, Verity held by the TPC specialist pass.

## Manual phone-verification list

Call before or shortly after import:

- North Dixie Truck & Trailer, Lima — three conflicting phone numbers across sources, left blank (published)
- Hamilton Truck and Tire Service, Cincinnati — confirm open status + phone (held; two category reads)
- Anna Truck Stop / 99 Truck Stop, Anna — brand shows Marathon/Shell across sources, confirm current operator
- Wayne Truck & Trailer, Sidney — two conflicting phone numbers, left blank (published)
- Circle K (formerly Shell), Botkins — brand-in-transition, confirm truck-parking policy (held)
- NEU CLARK 24 Hour Truck Stop, Lima — confirm exit/amenities (held)
- All held CAT scales (Pilot #24 Sharonville, #284 West Chester, #231 Monroe) — confirm host address before publishing
- All held TruckParkingClub lots — confirm per-listing I-75 exit/distance and operational details (TPC pages 403)

## Geocoding readiness (no coordinates supplied in this batch)

- **Coordinate-ready candidates (81):** rows with full street addresses — suitable for the verified geocoding console workflow after import.
- **Manual-review coordinate candidates (14):** rows without a street number (weigh stations, rest areas, milepost addresses, mobile services):
  - CAT Scale — Pilot Travel Center #231, Monroe (Monroe) — address: (blank)
  - CAT Scale — Pilot Travel Center #24, Sharonville (Sharonville) — address: (blank)
  - CAT Scale — Pilot Travel Center #284, West Chester (West Chester) — address: (blank)
  - Englewood Truck (SW Ohio Towing, Recovery & Mobile Truck Repair) (Englewood) — address: (blank)
  - Ed's 24 Hour Service (Findlay) — address: (blank)
  - Ziegler Tire (Toledo) — address: (blank)
  - My Parking Hub - Toledo (Sam's Hub Access) (Toledo) — address: (blank)
  - Toledo Truck Hub (Toledo) — address: (blank)
  - Pilot Travel Center #24 ((I-75 Exit 15 area)) — address: (blank)
  - Speedway #9383 (Monroe) — address: (blank)
  - Ohio Weigh Station - I-75 Southbound (Hancock County) (Findlay) — address: (blank)
  - Ohio Weigh Station - I-75 Northbound (Wood County) (North Baltimore) — address: (blank)
  - I-75 Rest Area — Northbound (Miami County) (Piqua) — address: I-75 Northbound near mile marker 80
  - I-75 Rest Area — Southbound (Miami County) (Piqua) — address: I-75 Southbound near mile marker 81

## Validation results

- Live import parser (`validate-import.ts`): master + all 4 parts = **100% clean** (0 skipped, 0 duplicates, 0 errors).
- Expansion Readiness (M21 `assessExpansion` vs live production export): **65 ready-to-publish, 30 import-unpublished, 0 manual-review, 0 reject**; no duplicate hits against the live directory; no slug collisions.
- Duplicate detection (M21 `classifyPair`): **0 hits vs Georgia batch, 0 hits vs Tennessee batch, 0 hits vs the live production DB**. Vs the Kentucky batch (PR #23, not yet imported): only **2 brand-name matches** — Ziegler Tire (Toledo/Walbridge OH) against Ziegler Tire (Lexington KY), classified `similar-name-diff-address` (same national brand, different states); all three Ziegler rows are held, so no action needed. In-file pairs classified `shared-address-sub-service` are all the established co-location pattern (CAT Scale / Speedco / Love's Truck Wash / TA Truck Service rows at their host truck stops), same as GA/TN/KY.
- Quality Dashboard scoring (M21 `scoreCompleteness`): min 38, median 64, mean 63.3, max 80; labels: Incomplete 1, Needs work 47, Good 47.

## Final audit

- Approved rows (Published = yes): **49**
- Unpublished rows (held, documented): **46**
- Rejected rows: **0 in CSV** — all rejected candidates were excluded before compilation (see the exclusion lists at the end of the sources report).
- Import parts: `i75-ohio-batch-004-part1.csv`, `i75-ohio-batch-004-part2.csv`, `i75-ohio-batch-004-part3.csv`, `i75-ohio-batch-004-part4.csv` (max 25 rows each).
- Nothing imported, published, merged, or deployed. Awaiting approval.
