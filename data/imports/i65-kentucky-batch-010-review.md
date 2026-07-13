# Batch 10 — I-65 Kentucky: Review Summary

CSV: `data/imports/i65-kentucky-batch-010.csv` · verified 2026-07-12 · dry-run validated against the live import
parser (`scripts/validate-import.ts`) **and** the Milestone 21 Expansion Readiness assessment
(`assessExpansion`). **Nothing has been imported to production.**

## Totals

- Total researched candidates: **89** (58 included + 31 excluded)
- Total rows in CSV: **58**
- Published = yes: **46**
- Published = no (held with documented reasons): **12**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **1** (only where actually listed on truckparkingclub.com); no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category

| Category | Rows | Published | Held |
| --- | --- | --- | --- |
| CAT Scales | 11 | 10 | 1 |
| Hotels with Truck Parking | 8 | 6 | 2 |
| Roadside Service | 8 | 7 | 1 |
| Tire Repair | 4 | 4 | 0 |
| Truck Parking | 5 | 1 | 4 |
| Truck Stops | 15 | 15 | 0 |
| Truck Washes | 4 | 3 | 1 |
| Weigh Stations | 3 | 0 | 3 |
| **Total** | **58** | **46** | **12** |

## Corridor coverage (Tennessee line → Bowling Green → Elizabethtown → Louisville / Indiana line)

- Distinct I-65 exits represented: **14** — 2, 6, 22, 38, 48, 53, 58, 65, 86, 91, 94, 105, 116, 128

## Rows by city (south → north)
| City | Rows |
| --- | --- |
| Franklin | 13 |
| Bowling Green | 3 |
| Smiths Grove | 2 |
| Park City | 1 |
| Cave City | 4 |
| Horse Cave | 4 |
| Munfordville | 2 |
| Glendale | 7 |
| Elizabethtown | 10 |
| Lebanon Junction | 2 |
| Shepherdsville | 8 |
| Louisville | 2 |

## Held records (Published = no) — reasons

- **Kentucky Weigh Station - I-65 Northbound (Simpson County)** (Weigh Stations, Franklin): Weigh/inspection station held pending an official KYTC/KSP source with a civic street address and confirmed direction/facility identity; corroborated via aggregated truck directories only — confirm before publishing.
- **Simpson County (Franklin) Welcome Center - I-65 Northbound** (Truck Parking, Franklin): Legal overnight-parking status not independently confirmed; welcome centers are day-use unless posted otherwise, so per conservative rest-area rules this is held pending confirmation of overnight legality. Direction (NB), existence and truck access are confirmed.
- **All Star Towing & Road Service (at Sudden Service #62)** (Roadside Service, Franklin): Operator identity, current operating status and exact affiliation confirmed only via a single truck-stop directory listing; not independently corroborated. Held pending a second independent source.
- **Hart County Rest Area (I-65 Northbound)** (Truck Parking, Horse Cave): Existence, direction (northbound), mile marker (~59) and separate truck parking are confirmed via KYTC and news/directory sources, but LEGAL overnight-parking status is not independently confirmed (never assumed from truck-space presence). No street address (mile-marker facility).
- **Munfordville Rest Area (I-65 Southbound)** (Truck Parking, Munfordville): Existence, direction (southbound), mile marker (~60) and separate truck parking are confirmed via KYTC/directory sources, but LEGAL overnight-parking status is not independently confirmed. No street address (mile-marker facility).
- **Baymont by Wyndham Cave City** (Hotels with Truck Parking, Cave City): Brand page lists free RV/bus/truck parking, but exact street address/zip could not be independently confirmed and some guest reviews cite limited parking; semi/overnight truck capacity not clearly confirmed. Held pending address and truck-parking confirmation.
- **CAT Scale - RaceTrac #2597 (Elizabethtown)** (CAT Scales, Elizabethtown): CAT Scale presence at a RaceTrac is atypical and could not be confirmed via the official CAT Scale locator (egress-blocked). Directory sources (truckstopsandservices, way.com, iExit) list a 'CAT scale / truck scale CAT' at this RaceTrac, but these directories may share source data; holding pending official CAT Scale locator confirmation.
- **Plaza 94 Truck Wash (Elizabethtown)** (Truck Washes, Elizabethtown): A truck wash is listed as a Plaza 94 amenity by AllStays/iExit, but the wash's brand, operating hours, attended/self-serve status, and current operational status could not be independently confirmed. Holding pending confirmation.
- **Kentucky Weigh Station - I-65 Southbound (Elizabethtown, KSP Post 3)** (Weigh Stations, Elizabethtown): Weigh/inspection station held pending an official KYTC/KSP source with a civic street address and confirmed direction/facility identity; corroborated via aggregated truck directories only — confirm before publishing.
- **Bullitt County Welcome Center (I-65 Southbound, MM 114) - truck parking** (Truck Parking, Shepherdsville): Direction (SB) and MM 114 confirmed by KYTC welcome-center documentation, and separate truck parking is present, but LEGAL overnight parking status is not independently confirmed (never assumed from truck-space presence). Exact street address/zip not confirmed. Held per conservative rest-area/welcome-center rules.
- **I-65 Bullitt County Weigh Station (KVE/KSP)** (Weigh Stations, Shepherdsville): Existence of an I-65 Bullitt County weigh/scale facility is asserted by directory sources, but direction (NB/SB), mile marker/exact location, and permanent-vs-mobile/inspection-only status could not be independently confirmed from KYTC/KSP. Note: the MM-114 facility is a KYTC Welcome Center, not a weigh station; the nearest confirmed permanent KSP scale (Post 3 / Elizabethtown, MM ~89.5, Hardin County) is south of this segment. Held per conservative weigh-station rules.
- **Motel 6 Louisville, KY - Airport/Fair Expo** (Hotels with Truck Parking, Louisville): Truck/large-vehicle parking is reported only by third-party booking aggregators (ParkSleepHotels and other travel sites); the official Motel 6 property page returned HTTP 403 to automated fetch and truck-parking availability could not be independently confirmed on an official source. Identity/address (6121 Airport Hotels Blvd, Louisville 40213; phone 502-742-4722) and I-65 Exit 128 location are corroborated, but category-fit (confirmed truck parking) is not.

## Manual phone-verification list

Rows missing a verified phone (blank rather than guessed): **21**. Call before/after import; priority = published rows:
- TA Truck Service Franklin (Franklin, Roadside Service)
- Ramada by Wyndham Bowling Green (Bowling Green, Hotels with Truck Parking)
- Park City Shell (IGA Express) (Park City, Truck Stops)
- Red Roof Inn & Suites Cave City (Cave City, Hotels with Truck Parking)
- Munfordville Truck Parking (Truck Parking Club) (Munfordville, Truck Parking)
- CAT Scale - Petro Glendale (#330) (Glendale, CAT Scales)
- Blue Beacon Truck Wash of Glendale (Glendale, Truck Washes)
- CAT Scale - Pilot Travel Center #48 (Glendale) (Glendale, CAT Scales)
- Wingfoot Truck Care - Pilot #48 (Glendale) (Glendale, Tire Repair)
- CAT Scale - Love's Travel Stop #716 (Elizabethtown) (Elizabethtown, CAT Scales)
- Plaza 94 (Elizabethtown) (Elizabethtown, Truck Stops)
- Greenfield Inn & Suites Elizabethtown (I-65 Exit 94) (Elizabethtown, Hotels with Truck Parking)
- Best Western Plus Elizabethtown Inn & Suites (I-65 Exit 94) (Elizabethtown, Hotels with Truck Parking)

## Website-verification list

Rows missing a verified website (blank rather than guessed): **18**. Published rows to backfill:
- Keystop Truck Stop (Franklin, Truck Stops)
- Pride Truck Wash - Franklin (Franklin, Truck Washes)
- CAT Scale - TA Smiths Grove (Smiths Grove, CAT Scales)
- Higdon's Service Center (Cave City, Roadside Service)
- CAT Scale #1174 - Love's #360 Horse Cave (Horse Cave, CAT Scales)
- Love's Truck Care #360 (Horse Cave, Roadside Service)
- CAT Scale - Petro Glendale (#330) (Glendale, CAT Scales)
- CAT Scale - Pilot Travel Center #48 (Glendale) (Glendale, CAT Scales)
- CAT Scale - Love's Travel Stop #716 (Elizabethtown) (Elizabethtown, CAT Scales)
- Plaza 94 (Elizabethtown) (Elizabethtown, Truck Stops)
- Greenfield Inn & Suites Elizabethtown (I-65 Exit 94) (Elizabethtown, Hotels with Truck Parking)
- All American Truck Wash (Shepherdsville, Truck Washes)

## Address-verification concerns

- Rows with no street address: **7**; rows whose address does not start with a street number (rest area / weigh station / mobile / ambiguous): **1**.
  - Kentucky Weigh Station - I-65 Northbound (Simpson County) (Franklin) — address: (blank)
  - Hart County Rest Area (I-65 Northbound) (Horse Cave) — address: (blank)
  - Munfordville Rest Area (I-65 Southbound) (Munfordville) — address: (blank)
  - Baymont by Wyndham Cave City (Cave City) — address: (blank)
  - Kentucky Weigh Station - I-65 Southbound (Elizabethtown, KSP Post 3) (Elizabethtown) — address: (blank)
  - Bullitt County Welcome Center (I-65 Southbound, MM 114) - truck parking (Shepherdsville) — address: (blank)
  - I-65 Bullitt County Weigh Station (KVE/KSP) (Shepherdsville) — address: (blank)
  - Simpson County (Franklin) Welcome Center - I-65 Northbound (Franklin) — address: I-65 Northbound near Mile Marker 0.3

## Parking-verification concerns

- Parking/overnight rows: **28**. Truck-space counts are blank unless a specific number was verified; parking-type flags set only where a source stated them.

## Weigh-station review

- Weigh/inspection stations included: **3** (0 published / 3 held). Highway coops without a civic street address + official source are held pending KYTC/KSP confirmation.
  - Kentucky Weigh Station - I-65 Northbound (Simpson County) (Franklin) — HELD: Weigh/inspection station held pending an official KYTC/KSP source with a civic street address and confirmed direction/facility identity; corroborated via aggregated truck directories only — confirm before publishing.
  - Kentucky Weigh Station - I-65 Southbound (Elizabethtown, KSP Post 3) (Elizabethtown) — HELD: Weigh/inspection station held pending an official KYTC/KSP source with a civic street address and confirmed direction/facility identity; corroborated via aggregated truck directories only — confirm before publishing.
  - I-65 Bullitt County Weigh Station (KVE/KSP) (Shepherdsville) — HELD: Existence of an I-65 Bullitt County weigh/scale facility is asserted by directory sources, but direction (NB/SB), mile marker/exact location, and permanent-vs-mobile/inspection-only status could not be independently confirmed from KYTC/KSP. Note: the MM-114 facility is a KYTC Welcome Center, not a weigh station; the nearest confirmed permanent KSP scale (Post 3 / Elizabethtown, MM ~89.5, Hardin County) is south of this segment. Held per conservative weigh-station rules.

## Legitimate co-location pairs

- In-file co-location pairs (CAT Scale / Love's Truck Care / Speedco / TA Truck Service / Petro service at a host truck stop, filed as separate rows per the directory model): **22** (score ≥ 50 by `classifyPair`). The host business is never duplicated.

## Coordinate readiness (no coordinates supplied)

- **Coordinate-ready candidates (50):** rows with a full verified street address — suitable for the verified geocoding console after import.
- **Manual-review coordinate candidates (8):** mile marker / rest area / weigh station / mobile service / incomplete or ambiguous address:
  - Kentucky Weigh Station - I-65 Northbound (Simpson County) (Franklin)
  - Hart County Rest Area (I-65 Northbound) (Horse Cave)
  - Munfordville Rest Area (I-65 Southbound) (Munfordville)
  - Baymont by Wyndham Cave City (Cave City)
  - Kentucky Weigh Station - I-65 Southbound (Elizabethtown, KSP Post 3) (Elizabethtown)
  - Bullitt County Welcome Center (I-65 Southbound, MM 114) - truck parking (Shepherdsville)
  - I-65 Bullitt County Weigh Station (KVE/KSP) (Shepherdsville)
  - Simpson County (Franklin) Welcome Center - I-65 Northbound (Franklin)

## Validation results

- Live import parser (`validate-import.ts` / `prepareImport`): master + all 3 parts = **100% clean** (0 skipped, 0 duplicates, 0 errors).
- Expansion Readiness (`assessExpansion` vs live production): **32 ready-to-publish, 26 import-unpublished, 0 manual-review, 0 reject**; slug collisions vs live: **0**.
- Duplicate detection (`classifyPair`): vs Georgia **0**, Tennessee **0**, Kentucky **41**, Ohio **1**, Michigan **0**, Florida **0**, Indiana **0**, Alabama **2**, Tennessee I-65 **0**, live DB **44** matches; in-file co-location pairs: **22**; in-batch slug duplicates: **0**.
- Quality (`scoreCompleteness`): min 36, median 64, mean 63.9, max 76; labels: Incomplete 2, Needs work 29, Good 27.

## Existing-Kentucky duplicate protection

- Every candidate was compared (normalized name + city + address + phone + website + category + interstate + exit) against all **99 existing production Kentucky listings** (the I-75 batch). The I-65 corridor is Western/Central Kentucky (Bowling Green/Cave City/Elizabethtown/Louisville) and the live Kentucky rows are Eastern/Central-East I-75 (Lexington/Georgetown/Corbin/London/Florence), so there is minimal geographic overlap. Louisville is served by I-65/I-64/I-71, so any Louisville facility primarily serving I-64 or I-71 was excluded rather than re-listed.
- Rows dropped because they already exist in production Kentucky (exact/probable existing-KY duplicates; not re-added, production left unchanged): **0**.
- A property served by another interstate (I-24 / I-40) that already exists in production was NOT re-added; multi-interstate/same-property cases are documented in the per-listing sources report where encountered.

## Known issues / limitations

- Some brand/official sites (Pilot/Flying J, Love's, TA/Petro, CAT Scale, TruckParkingClub, KYTC) rate-limit or block direct fetches; those facts were corroborated via 2+ independent directories and the affected fields left blank when unconfirmed.
- Weigh-station direction/mile-marker detail is corroborated via aggregated truck directories; held until an official KYTC/KSP source with a civic address confirms.

## Final recommendation

- Approved (Published = yes): **46** · Held (documented): **12** · Rejected in CSV: **0** (rejected candidates excluded pre-compilation — see sources report).
- Import parts: `i65-kentucky-batch-010-part1.csv`, `i65-kentucky-batch-010-part2.csv`, `i65-kentucky-batch-010-part3.csv` (≤25 rows each).
- Nothing imported, published, merged, or deployed. Awaiting approval.
