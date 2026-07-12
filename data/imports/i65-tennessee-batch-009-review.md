# Batch 9 — I-65 Tennessee: Review Summary

CSV: `data/imports/i65-tennessee-batch-009.csv` · verified 2026-07-12 · dry-run validated against the live import
parser (`scripts/validate-import.ts`) **and** the Milestone 21 Expansion Readiness assessment
(`assessExpansion`). **Nothing has been imported to production.**

## Totals

- Total researched candidates: **62** (28 included + 34 excluded)
- Total rows in CSV: **28**
- Published = yes: **21**
- Published = no (held with documented reasons): **7**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **1** (only where actually listed on truckparkingclub.com); no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category

| Category | Rows | Published | Held |
| --- | --- | --- | --- |
| CAT Scales | 6 | 6 | 0 |
| Hotels with Truck Parking | 2 | 1 | 1 |
| Tire Repair | 5 | 5 | 0 |
| Truck Parking | 4 | 1 | 3 |
| Truck Stops | 9 | 8 | 1 |
| Weigh Stations | 2 | 0 | 2 |
| **Total** | **28** | **21** | **7** |

## Corridor coverage (Alabama line → Nashville → Kentucky line)

- Distinct I-65 exits represented: **9** — 6, 14, 22, 46, 61, 87, 97, 108, 112

## Rows by city (south → north)
| City | Rows |
| --- | --- |
| Ardmore | 3 |
| Elkton | 2 |
| Pulaski | 1 |
| Cornersville | 4 |
| Columbia | 4 |
| Franklin | 3 |
| Nashville | 3 |
| Goodlettsville | 2 |
| White House | 3 |
| Mitchellville | 2 |
| Cross Plains | 1 |

## Held records (Published = no) — reasons

- **Tennessee Welcome Center - I-65 (Ardmore, Northbound)** (Truck Parking, Ardmore): Direction (northbound, MM ~3) and truck access are confirmed, but posted rules prohibit overnight parking (2-hour limit), so it does not fit an overnight truck-parking listing. Held per conservative rest-area/welcome-center rule.
- **TDOT I-65 Truck Parking Area (former Northbound Weigh Station, Giles County)** (Truck Parking, Ardmore): TDOT project reporting confirms a NB weigh station was converted to truck parking, but exact location (MM/exit), space count and legal overnight-parking status could not be independently confirmed from an official TDOT source (tn.gov pages were egress-blocked).
- **I-65 Giles County Weigh Station (Northbound, Ardmore)** (Weigh Stations, Ardmore): Conflicting information on current operating status: TDOT widening reporting says a NB weigh station here was converted to truck parking (completed Sept 2024), yet directory/THP references still list a Giles County scale house. Official THP CVE page (tn.gov) was egress-blocked, so permanent/operational status and exact direction/MM could not be independently confirmed.
- **Quality Inn Columbia I-65** (Hotels with Truck Parking, Columbia): Truck/large-vehicle parking is stated only by third-party OTA listings (HotelPlanner, Expedia, HotelGuides); not confirmed on the official Choice Hotels page and no space count available. Category-fit (truck parking) unverified.
- **Twice Daily / Daily's #6603 (Goodlettsville)** (Truck Stops, Goodlettsville): Truck parking minimal/unconfirmed (sources conflict: 'no parking' vs ~2 public spaces); functions primarily as a fuel/convenience stop rather than an overnight truck stop. Category-fit and truck parking not independently confirmed.
- **Tennessee Weigh Station — I-65 Southbound (Robertson County, near KY line)** (Weigh Stations, Mitchellville): Direction (southbound) and general location confirmed via TDOT project page, but exact mile marker and current operational status are uncertain due to active reconstruction (est. completion Q3 2026). TDOT/THP pages are policy-blocked to WebFetch; not independently field-verified.
- **I-65 Northbound Truck Parking Area (former weigh station, Robertson County)** (Truck Parking, Mitchellville): State-operated (unnamed) parking area; capacity, exact mile marker, and legal overnight-parking status unconfirmed. TDOT page policy-blocked to WebFetch; not independently field-verified.

## Manual phone-verification list

Rows missing a verified phone (blank rather than guessed): **5**. Call before/after import; priority = published rows:
- CAT Scale at Dolly's Tennessean Travel Stop (Cornersville, CAT Scales)
- CAT Scale at Pilot Travel Center #406 (Cornersville, CAT Scales)

## Website-verification list

Rows missing a verified website (blank rather than guessed): **7**. Published rows to backfill:
- Shady Lawn Truck Stop (Elkton, Truck Stops)
- Shady Lawn Truck Stop Tire & Repair (Elkton, Tire Repair)
- CAT Scale — Love's Travel Stop #346, Columbia (Columbia, CAT Scales)
- CAT Scale - TA Franklin #157 (Franklin, CAT Scales)
- CAT Scale — Love's Travel Stop #629, White House (White House, CAT Scales)
- MAPCO Express #1028 (Cross Plains, Truck Stops)

## Address-verification concerns

- Rows with no street address: **5**; rows whose address does not start with a street number (rest area / weigh station / mobile / ambiguous): **0**.
  - Tennessee Welcome Center - I-65 (Ardmore, Northbound) (Ardmore) — address: (blank)
  - TDOT I-65 Truck Parking Area (former Northbound Weigh Station, Giles County) (Ardmore) — address: (blank)
  - I-65 Giles County Weigh Station (Northbound, Ardmore) (Ardmore) — address: (blank)
  - Tennessee Weigh Station — I-65 Southbound (Robertson County, near KY line) (Mitchellville) — address: (blank)
  - I-65 Northbound Truck Parking Area (former weigh station, Robertson County) (Mitchellville) — address: (blank)

## Parking-verification concerns

- Parking/overnight rows: **15**. Truck-space counts are blank unless a specific number was verified; parking-type flags set only where a source stated them.

## Weigh-station review

- Weigh/inspection stations included: **2** (0 published / 2 held). Highway coops without a civic street address + official source are held pending TDOT/THP confirmation.
  - I-65 Giles County Weigh Station (Northbound, Ardmore) (Ardmore) — HELD: Conflicting information on current operating status: TDOT widening reporting says a NB weigh station here was converted to truck parking (completed Sept 2024), yet directory/THP references still list a Giles County scale house. Official THP CVE page (tn.gov) was egress-blocked, so permanent/operational status and exact direction/MM could not be independently confirmed.
  - Tennessee Weigh Station — I-65 Southbound (Robertson County, near KY line) (Mitchellville) — HELD: Direction (southbound) and general location confirmed via TDOT project page, but exact mile marker and current operational status are uncertain due to active reconstruction (est. completion Q3 2026). TDOT/THP pages are policy-blocked to WebFetch; not independently field-verified.

## Legitimate co-location pairs

- In-file co-location pairs (CAT Scale / Love's Truck Care / Speedco / TA Truck Service / Petro service at a host truck stop, filed as separate rows per the directory model): **15** (score ≥ 50 by `classifyPair`). The host business is never duplicated.

## Coordinate readiness (no coordinates supplied)

- **Coordinate-ready candidates (23):** rows with a full verified street address — suitable for the verified geocoding console after import.
- **Manual-review coordinate candidates (5):** mile marker / rest area / weigh station / mobile service / incomplete or ambiguous address:
  - Tennessee Welcome Center - I-65 (Ardmore, Northbound) (Ardmore)
  - TDOT I-65 Truck Parking Area (former Northbound Weigh Station, Giles County) (Ardmore)
  - I-65 Giles County Weigh Station (Northbound, Ardmore) (Ardmore)
  - Tennessee Weigh Station — I-65 Southbound (Robertson County, near KY line) (Mitchellville)
  - I-65 Northbound Truck Parking Area (former weigh station, Robertson County) (Mitchellville)

## Validation results

- Live import parser (`validate-import.ts` / `prepareImport`): master + all 2 parts = **100% clean** (0 skipped, 0 duplicates, 0 errors).
- Expansion Readiness (`assessExpansion` vs live production): **18 ready-to-publish, 10 import-unpublished, 0 manual-review, 0 reject**; slug collisions vs live: **0**.
- Duplicate detection (`classifyPair`): vs Georgia **0**, Tennessee **25**, Kentucky **0**, Ohio **0**, Michigan **0**, Florida **0**, Indiana **0**, Alabama **0**, live DB **25** matches; in-file co-location pairs: **15**; in-batch slug duplicates: **0**.
- Quality (`scoreCompleteness`): min 39, median 69, mean 65.2, max 75; labels: Incomplete 1, Needs work 10, Good 17.

## Existing-Tennessee duplicate protection

- Every candidate was compared (normalized name + city + address + phone + website + category + interstate + exit) against all **61 existing production Tennessee listings** (the I-75 batch). The I-65 corridor is Middle-Tennessee (Nashville/Franklin/Columbia/Pulaski) and the live Tennessee rows are East-Tennessee I-75 (Chattanooga/Knoxville/Cleveland), so there is minimal geographic overlap.
- Rows dropped because they already exist in production Tennessee (exact/probable existing-TN duplicates; not re-added, production left unchanged): **0**.
- A property served by another interstate (I-24 / I-40) that already exists in production was NOT re-added; multi-interstate/same-property cases are documented in the per-listing sources report where encountered.

## Known issues / limitations

- Some brand/official sites (Pilot/Flying J, Love's, TA/Petro, CAT Scale, TruckParkingClub, TDOT) rate-limit or block direct fetches; those facts were corroborated via 2+ independent directories and the affected fields left blank when unconfirmed.
- Weigh-station direction/mile-marker detail is corroborated via aggregated truck directories; held until an official TDOT/THP source with a civic address confirms.

## Final recommendation

- Approved (Published = yes): **21** · Held (documented): **7** · Rejected in CSV: **0** (rejected candidates excluded pre-compilation — see sources report).
- Import parts: `i65-tennessee-batch-009-part1.csv`, `i65-tennessee-batch-009-part2.csv` (≤25 rows each).
- Nothing imported, published, merged, or deployed. Awaiting approval.
