# Batch 1 — I-75 Georgia: Review Summary

CSV file: `data/imports/i75-georgia-batch-001.csv` · verified 2026-07-10 · dry-run validated against the live import parser (`scripts/validate-import.ts`). **Nothing has been imported to production.**

## Totals

- Total rows in CSV: **78**
- Published = yes: **69**
- Published = no (held for manual confirmation): **9**
- Researched but excluded entirely: **2**
- Featured = yes: **0** (per instructions, featuring requires explicit approval)
- TruckParkingClub URLs: only on the 4 verified truckparkingclub.com listings; no affiliate codes anywhere (none exist yet).

## Rows by category

| Category | Rows | Published | Held |
| --- | --- | --- | --- |
| CAT Scales | 15 | 15 | 0 |
| Hotels with Truck Parking | 4 | 2 | 2 |
| Roadside Service | 3 | 2 | 1 |
| Tire Repair | 10 | 9 | 1 |
| Truck Parking | 4 | 4 | 0 |
| Truck Stops | 32 | 28 | 4 |
| Truck Washes | 4 | 3 | 1 |
| Weigh Stations | 6 | 6 | 0 |
| **Total** | **78** | **69** | **9** |

## Rows by city (north to south where known)

| City | Rows |
| --- | --- |
| Ringgold | 4 |
| Dalton | 4 |
| Resaca | 2 |
| Calhoun | 4 |
| Adairsville | 2 |
| Cartersville | 10 |
| Emerson | 1 |
| Atlanta | 2 |
| Forest Park | 1 |
| McDonough | 1 |
| Jackson | 8 |
| Forsyth | 4 |
| Macon | 6 |
| Byron | 2 |
| Unadilla | 1 |
| Vienna | 1 |
| Cordele | 3 |
| Ashburn | 1 |
| Tifton | 6 |
| Adel | 2 |
| Hahira | 1 |
| Valdosta | 8 |
| Lake Park | 4 |

## Held records (Published = no) — need manual confirmation

- **Clarion Pointe Forsyth I-75** (Hotels with Truck Parking, Forsyth): Booking sources disagree on branding (Clarion Pointe vs. an older Comfort Inn listing at the same address) — confirm current flag and truck parking by phone.
- **Comfort Inn & Suites Macon West** (Hotels with Truck Parking, Macon): No phone number verified and the property is on the I-475 Macon bypass, not mainline I-75 (Interstate left blank). Confirm truck/RV parking policy by phone.
- **Allstate Repair (All State Truck Stop)** (Roadside Service, Unadilla): The co-located All State Truck Stop is reported closed; unclear whether the repair business still operates at this address. Confirm before publishing.
- **Southern Tire Mart #165** (Tire Repair, Atlanta): Shop is on Fulton Industrial Blvd on Atlanta's west side; no source ties it to an I-75 exit (Interstate left blank). Confirm corridor relevance before publishing.
- **Pathway Travel Plaza** (Truck Stops, Adairsville): Recently rebranded (ex-Pride/76) with no official website found; amenity data is from third-party directories only. Needs a phone call or brand confirmation.
- **A-1 Truck Stop** (Truck Stops, Ashburn): Demoted in the final pre-import audit (owner-approved 2026-07-10): operating status unverified — no 2025–2026 reviews found, fuel brand ambiguous across sources (Chevron vs. Citgo), and the property appears in a commercial real-estate listing. Confirm by phone (229-567-3000) before publishing.
- **America's Truck Stop** (Truck Stops, Atlanta): No phone number verified, and the address sits on the I-75/I-85 downtown connector rather than mainline I-75. Confirm details before publishing.
- **JP Truck Center** (Truck Stops, Cartersville): Only one independent source found for this small independent stop. Needs a second source or a phone call before publishing.
- **S & B Truck Wash — Cartersville** (Truck Washes, Cartersville): No phone number verified and third-party listings conflict on details. Needs direct confirmation.

## Excluded records (not in the CSV)

- **Citgo Valdosta Truck/Auto Plaza** (Truck Stops, Valdosta): Removed in the final pre-import audit (owner-approved 2026-07-10): the site at 2102 W Hill Ave, Valdosta is now a RaceTrac travel center (RaceTrac #2622) per Dec 2025 reviews and fuel-price listings; the Citgo locator URL is stale. Candidate for re-research as RaceTrac in a future batch.
- **CAT Scale — Cochran's Travel Center, Ringgold** (CAT Scales, Ringgold): Host truck stop (Cochran's Travel Center, I-75 Exit 345) is reported closed and demolished by an independent source found while researching Circle K Ringgold. A scale record pointing at a closed host cannot be published, so the record is excluded from the batch entirely.

## Missing-field summary (blank = could not be verified; never guessed)

| Field | Rows blank | Of 78 |
| --- | --- | --- |
| zip | 9 | 12% |
| lat | 78 | 100% |
| lng | 78 | 100% |
| phone | 7 | 9% |
| website | 14 | 18% |
| truck spaces | 39 | 50% |
| exit number | 20 | 26% |
| interstate | 2 | 3% |

- **Latitude/Longitude are blank on every row** — no source published exact coordinates, and coordinates are on the do-not-invent list. They can be added later from a geocoding pass you approve.
- Truck-space counts, amenity flags, and exit numbers appear only where a source stated them.

## Potential duplicate flags (expected, intentional)

The database supports one record per category, so co-located businesses are separate records on purpose. The admin duplicate finder may flag these same-address pairs — all are intentional:

- Adel: CAT Scale — Adel Truck Plaza, Adel (CAT Scales) + Adel Truck Plaza (Truck Stops)
- Calhoun: CAT Scale — Love's Travel Stop #735, Calhoun (CAT Scales) + Love's Travel Stop #735 (Truck Stops)
- Calhoun: CAT Scale — Pilot Travel Center #4558, Calhoun (CAT Scales) + Pilot Travel Center #4558 (Truck Stops)
- Cartersville: CAT Scale — Pilot Travel Center #67, Cartersville (CAT Scales) + Pilot Travel Center #67 (Truck Stops)
- Cartersville: CAT Scale — TA Cartersville (CAT Scales) + TA Cartersville #146 (Truck Stops)
- Dalton: CAT Scale — Pilot Travel Center #319, Dalton (CAT Scales) + ONE9 Travel Center #319 (Truck Stops)
- Jackson: CAT Scale — Flying J Travel Center #630, Jackson (CAT Scales) + Flying J Travel Center #630 (Truck Stops)
- Jackson: Love's Truck Care / Speedco #928 (Tire Repair) + Love's Travel Stop #307 (Truck Stops)
- Jackson: TA Truck Service - TA Atlanta South (Tire Repair) + TA Atlanta South #268 (Truck Stops)
- Macon: CAT Scale — Love's Travel Stop #698, Macon (CAT Scales) + Love's Travel Stop #698 (Truck Stops)
- Tifton: CAT Scale — Pilot Travel Center #192, Tifton (CAT Scales) + Pilot Travel Center #192 (Truck Stops)
- Tifton: Love's Truck Care - Tifton #325 (Tire Repair) + Love's Travel Stop #325 (Truck Stops)
- Valdosta: CAT Scale — Love's Travel Stop #550, Valdosta (CAT Scales) + Love's Travel Stop #550 (Truck Stops)
- Valdosta: CAT Scale — Pilot Travel Center #4561, Valdosta (CAT Scales) + Pilot Travel Center #4561 (Truck Stops)

The remaining CAT Scale rows are also physically co-located with their host truck stops by design; they only escape the list above because a source spelled the street address slightly differently.

- Checked against the live database: the `locations` table currently has **0 rows**, so there are no collisions with existing records.

## Final pre-import audit corrections (owner-approved 2026-07-10)

A second verification pass (~33 of 79 rows independently re-checked online, including all 4 TruckParkingClub URLs and all 6 DPS weigh stations) produced three owner-approved corrections:

1. **Removed — Citgo Valdosta Truck/Auto Plaza** (2102 W Hill Ave, Valdosta): the site is now a RaceTrac travel center (RaceTrac #2622); the Citgo locator URL is stale. Candidate for re-research as RaceTrac.
2. **Demoted to Published = no — A-1 Truck Stop** (Ashburn): operating status unverified (no recent reviews, ambiguous fuel brand, property in a commercial real-estate listing). Confirm by phone.
3. **Circle K (Ringgold Travel Center): Laundry set to "no"** — the flag traced only to a legacy directory from the site's Kangaroo Express era; Circle K's own page does not list laundry. Row stays published.

## Validation performed (dry run only)

- `scripts/validate-import.ts` runs the CSV through the **same** `parseCsv` + `prepareImport` + zod `listingSchema` pipeline as `/admin/directory/import` — 32 columns, every row parsed, 0 skipped, 0 errors, 0 in-file duplicates.
- Category values match the app registry titles; amenity columns map to the shared `AMENITIES` constant; State = GA on all rows; Interstate = I-75 wherever a source tied the location to the corridor; all URLs are http(s); yes/no fields contain only `yes`, `no`, or blank.
- **No production writes, no test rows, nothing merged.** Import happens only after your approval.
