# Batch 2 — I-75 Tennessee: Review Summary

CSV file: `data/imports/i75-tennessee-batch-002.csv` · verified 2026-07-10 · dry-run validated against the live import parser (`scripts/validate-import.ts`). **Nothing has been imported to production.**

## Totals

- Total rows in CSV: **61**
- Published = yes: **50**
- Published = no (held for manual confirmation): **11**
- Researched but excluded entirely: **0**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **4** (only on verified truckparkingclub.com listings); no affiliate codes anywhere (none exist yet).

## Rows by category

| Category | Rows | Published | Held |
| --- | --- | --- | --- |
| CAT Scales | 10 | 10 | 0 |
| Hotels with Truck Parking | 5 | 4 | 1 |
| Roadside Service | 2 | 2 | 0 |
| Tire Repair | 12 | 9 | 3 |
| Truck Parking | 4 | 4 | 0 |
| Truck Stops | 21 | 16 | 5 |
| Truck Washes | 3 | 3 | 0 |
| Weigh Stations | 4 | 2 | 2 |
| **Total** | **61** | **50** | **11** |

## Rows by city (north to south where known)

| City | Rows |
| --- | --- |
| Jellico | 1 |
| Pioneer | 5 |
| Caryville | 1 |
| Clinton | 1 |
| Powell | 2 |
| Knoxville | 20 |
| Lenoir City | 1 |
| Loudon | 3 |
| Sweetwater | 3 |
| Niota | 4 |
| Athens | 5 |
| Charleston | 3 |
| Cleveland | 3 |
| Collegedale | 1 |
| Chattanooga | 4 |
| Heiskell | 2 |
| McDonald | 2 |

## Held records (Published = no) — need manual/phone confirmation

- **Days Inn by Wyndham Jellico - Tennessee State Line** (Hotels with Truck Parking, Jellico): Final audit could not reproduce a truck-parking claim on the official Wyndham page (third-party listings like Expedia do claim semi-truck parking, and Wyndham notes parking may carry charges). Confirm truck parking policy by phone before publishing.
- **Snider Fleet Solutions - Chattanooga** (Tire Repair, Chattanooga): No local phone verified, and a Michelin dealer listing shows a second Snider address in Chattanooga (6114 Bonny Oaks Dr). Confirm which location serves I-75 before publishing.
- **Best-One Tire of Knoxville** (Tire Repair, Knoxville): Company site lists the commercial division at 5425 N Middlebrook Pike while Bridgestone/Yelp list 5407; not tied to an I-75 exit. Confirm before publishing.
- **Southern Tire Mart #230 - Knoxville** (Tire Repair, Knoxville): On Rutledge Pike on Knoxville's I-40 side; no source ties it to an I-75 exit. Held for a corridor-relevance call.
- **Ponderosa Truck Stop** (Truck Stops, Charleston): One directory user report marks it closed (January 2015) while other directories still list it. Operating status must be confirmed by phone (423-336-5521) before publishing.
- **Pilot Travel Center #187** (Truck Stops, Knoxville): No official Pilot location page found (directory/review sources only), and the address appears as both "100 Merchant Dr" and "100 Merchants Rd". Confirm by phone before publishing.
- **Speedway #7156 (Lovell Road)** (Truck Stops, Knoxville): No phone or website verified, and sources label the exit I-40 (Lovell Rd, Exit 374) rather than I-75. Confirm details and corridor relevance before publishing.
- **Love's Travel Stop #480** (Truck Stops, Lenoir City): Sources place this at I-40 Exit 364 (US-321), a few miles west of the I-40/I-75 split — not directly on I-75. Lenoir City is a corridor town, so held for a corridor-relevance call.
- **Crazy Ed's Travel Center** (Truck Stops, Niota): Only dated directory listings found (some still under WilcoHess-era branding); no recent activity evidence. Confirm current operation by phone before publishing.
- **Tennessee Weigh Station - I-75 Northbound (Bradley County)** (Weigh Stations, Cleveland): Directory-only periodic enforcement site ("DOT sets up a couple times a year"); NOT on the TN Dept. of Safety official scale-complex list. Held so it is not presented as a permanent staffed station without confirmation.
- **Tennessee Weigh Station - I-75 Southbound (Bradley County)** (Weigh Stations, Cleveland): Directory-only periodic enforcement site with no address or mile marker given by sources; NOT on the TN Dept. of Safety official list. Held pending confirmation. (Audit note: the TN DOS page lists NO permanent I-75 scale complex in Bradley, Hamilton, or Campbell counties, corroborating that this is not a permanent station.)

## Excluded records (not in the CSV)

- None.

## Missing-field summary (blank = could not be verified; never guessed)

| Field | Rows blank | Of 61 |
| --- | --- | --- |
| zip | 7 | 11% |
| lat | 61 | 100% |
| lng | 61 | 100% |
| phone | 14 | 23% |
| website | 10 | 16% |
| truck spaces | 40 | 66% |
| exit number | 17 | 28% |
| interstate | 9 | 15% |

- **Latitude/Longitude are blank on every row** — no source published exact coordinates, and coordinates are on the do-not-invent list.
- Truck-space counts, amenity flags, and exit numbers appear only where a source stated them.

## Potential duplicate flags / same-address co-locations (expected, intentional)

Co-located businesses are separate records per category by design. The admin duplicate finder may flag these same-address groups — all are intentional:

- Athens: CAT Scale — Speedway #7147, Athens (CAT Scales) + Speedway #7147 (Truck Stops)
- Knoxville: CAT Scale — Petro Knoxville #312, Knoxville (Watt Road) (CAT Scales) + TA Truck Service - Petro Knoxville (Tire Repair) + Petro Knoxville (Truck Stops)
- Knoxville: CAT Scale — Pilot Travel Center (Flying J #722), Knoxville (Watt Road) (CAT Scales) + Flying J Travel Center #722 (Truck Stops)
- Knoxville: CAT Scale — TA Knoxville West #269, Knoxville (Watt Road) (CAT Scales) + TA Truck Service - TA Knoxville West (Tire Repair) + TA Knoxville West (Truck Stops)
- Loudon: Speedco at Love's Travel Stop #861 (Tire Repair) + Love's Travel Stop #861 (Truck Stops)
- McDonald: CAT Scale — Pilot Travel Center #481, McDonald (Cleveland) (CAT Scales) + Pilot Travel Center #481 (Truck Stops)
- Niota: CAT Scale — Pilot Travel Center #4598, Niota (CAT Scales) + Pilot Travel Center #4598 (Truck Stops)
- Pioneer: CAT Scale — TA Caryville #255, Pioneer (CAT Scales) + TA Truck Service - TA Caryville (Tire Repair) + TA Caryville (Truck Stops)

Remaining CAT Scale rows are physically co-located with their host truck stops by design; they escape the list above only when a source spelled the street address differently.

## Duplicate control

- Zero duplicate name/city/state keys within this batch (checked with the production importer's `importDupKey` normalization).
- Zero collisions against the live production `locations` table snapshot (78 Georgia rows) and the Batch 1 Georgia master CSV.

## TruckParkingClub URL audit

- **Truck Parking Club - R.C. Transport LLC (Athens)** (Athens): https://truckparkingclub.com/truck-parking/tennessee/athens/417-east-avenue-37303 — paid/reserved flags set; URL verified against the TPC listing for this exact address.
- **Truck Parking Club - 415 Scruggs Road (Chattanooga)** (Chattanooga): https://truckparkingclub.com/truck-parking/tennessee/chattanooga/415-scruggs-road — paid/reserved flags set; URL verified against the TPC listing for this exact address.
- **Truck Parking Club - 7422 Bonnyshire Drive (Chattanooga)** (Chattanooga): https://truckparkingclub.com/truck-parking/tennessee/chattanooga/7422-bonnyshire-drive-37416 — paid/reserved flags set; URL verified against the TPC listing for this exact address.
- **Truck Parking Club - 11775 Snyder Rd (Knoxville)** (Knoxville): https://truckparkingclub.com/truck-parking/tennessee/knoxville/11775-snyder-rd-37932 — paid/reserved flags set; URL verified against the TPC listing for this exact address.

## Final pre-PR audit (independent re-verification, 2026-07-10)

All 61 rows manually inspected; ~20 rows independently re-verified online across every category (all 4 TPC URLs, all 5 hotels, the weigh stations against the TN Dept. of Safety page, and a 10-row published sample). Corrections applied from the audit:

1. **Quality Inn West Sweetwater** — the researched address (731 S Main St) belonged to a different hotel (Rodeway Inn Sweetwater South); corrected to the official Choice TN125 data: 249 Hwy 68, Sweetwater TN 37874, (423) 337-3353, I-75 Exit 60.
2. **Days Inn Jellico** — demoted to Published = no: the official Wyndham page does not explicitly advertise truck parking (third-party listings do); description reworded to attribute the claim.
3. **CAT Scale — TA Knoxville West** — address/ZIP aligned to TA's official listing (615 Watt Rd, 37922); the 617/37934 variant was third-party.
4. **Kwik Fuel Center (Clinton)** — official site (leestravelcenter.com) found and added; current operation confirmed.
5. **Super 8 Powell** — ZIP 37849 corroborated and added.
6. **TN weigh stations** — TN DOS page confirms the Knox County I-40/I-75 complex phones and that NO permanent I-75 scale exists in Bradley/Hamilton/Campbell counties (corroborating the two Bradley holds).
7. **Blue Beacon Knoxville** — operating, but temporarily on a single wash bay (~July 9-13) per bluebeacon.com.
8. **Pilot #4598 Niota** — some directories list an alternate phone (423) 597-3719; the listed (423) 568-3500 is per Find Truck Service. Minor phone re-check candidate.

## Validation performed (dry run only)

- `scripts/validate-import.ts` runs each CSV through the **same** `parseCsv` + `prepareImport` + zod `listingSchema` pipeline as `/admin/directory/import` — 32 columns, every row parsed, 0 skipped, 0 errors, 0 in-file duplicates (master and every part file).
- Category values match the app registry titles; amenity columns map to the shared `AMENITIES` constant; State = TN on all rows; Interstate = I-75 wherever a source tied the location to the corridor; all URLs are http(s); yes/no fields contain only `yes`, `no`, or blank.
- Part files recombine byte-identically to the master (verified programmatically).
- **No production writes, no test rows, nothing merged.** Import happens only after owner approval.
