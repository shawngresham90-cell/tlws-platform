# Batch 8 — I-65 Alabama: Review Summary

CSV: `data/imports/i65-alabama-batch-008.csv` · verified 2026-07-12 · dry-run validated against the live import
parser (`scripts/validate-import.ts`) **and** the Milestone 21 Expansion Readiness assessment
(`assessExpansion`). **Nothing has been imported to production.**

## Totals

- Total researched candidates: **112** (64 included + 48 excluded)
- Total rows in CSV: **64**
- Published = yes: **46**
- Published = no (held with documented reasons): **18**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **1** (only where actually listed on truckparkingclub.com); no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category

| Category | Rows | Published | Held |
| --- | --- | --- | --- |
| CAT Scales | 14 | 14 | 0 |
| Hotels with Truck Parking | 5 | 2 | 3 |
| Roadside Service | 6 | 6 | 0 |
| Tire Repair | 4 | 4 | 0 |
| Truck Parking | 7 | 1 | 6 |
| Truck Stops | 23 | 18 | 5 |
| Truck Washes | 3 | 1 | 2 |
| Weigh Stations | 2 | 0 | 2 |
| **Total** | **64** | **46** | **18** |

## Corridor coverage (TN line → Mobile / Gulf Coast)

- Distinct I-65 exits represented: **24** — 8, 13, 19, 54, 69, 93, 96, 158, 168, 181, 200, 205, 208, 219, 228, 246, 264, 299, 304, 305, 310, 334, 351, 262B

## Rows by city (south → north)
| City | Rows |
| --- | --- |
| Elkmont | 1 |
| Athens | 6 |
| Decatur | 1 |
| Priceville | 4 |
| Cullman | 7 |
| Good Hope | 2 |
| Hanceville | 3 |
| Fultondale | 1 |
| Birmingham | 3 |
| Pelham | 2 |
| Calera | 1 |
| Jemison | 1 |
| Clanton | 4 |
| Verbena | 1 |
| Millbrook | 1 |
| Montgomery | 3 |
| Hope Hull | 6 |
| Greenville | 2 |
| Evergreen | 7 |
| Brewton | 1 |
| Atmore | 1 |
| Saraland | 1 |
| Satsuma | 2 |
| Prichard | 3 |

## Held records (Published = no) — reasons

- **Ardmore Welcome Center (I-65 Southbound)** (Truck Parking, Elkmont): No street address (mile-marker facility) and legal overnight-parking status for trucks could not be independently confirmed; per instructions rest-area overnight parking is not assumed even though truck spaces exist.
- **I-65 Athens Weigh Station (Southbound)** (Weigh Stations, Athens): Only a single non-official source (coopsareopen) describes this weigh-in-motion point; not confirmed on an ALEA/ALDOT official source and no scale-house/address to verify.
- **I-65 Athens Weigh Station (Northbound)** (Weigh Stations, Athens): Only a single non-official source (coopsareopen) references a northbound weigh-in-motion point; exact mile marker not given and not confirmed on an ALEA/ALDOT official source.
- **J Mart #1305** (Truck Stops, Priceville): Only a single directory reference; no verified street address/ZIP and current operation under this name could not be independently corroborated.
- **Jack's Truck Stop** (Truck Stops, Cullman): Independent truck stop with no official brand/business website; identity, address (1639 CR 437) and services corroborated only by third-party directories (Yelp, iExit, findfuelstops, allstays, TruckMap). Truck-space count (20), truck wash and repair services not verified by a primary source.
- **Cullman County Rest Area (I-65 MM 301)** (Truck Parking, Cullman): ALDOT confirms a rest area exists near MM 301, but legal overnight parking status is not confirmed by an official source (overnight-stay claims come only from user reviews). Exact mile marker/direction split and truck-space count not officially verified.
- **Truck Wash at Jack's Truck Stop** (Truck Washes, Cullman): Truck wash listed only in a single third-party directory amenity list for Jack's; no primary source confirms an operating truck wash bay, hours or pricing.
- **Comfort Suites Cullman I-65 Exit 310** (Hotels with Truck Parking, Cullman): Truck/large-vehicle parking is claimed only by third-party directories (HotelGuides, TruckerPath); the official Choice Hotels page could not be fetched (HTTP 403) to confirm truck parking, so parking availability/type is unverified.
- **Quality Inn Cullman I-65 Exit 310** (Hotels with Truck Parking, Cullman): RV/bus/truck parking claimed by third-party listings only; official brand page not confirmed. Street address, ZIP and phone not independently verified, so left blank.
- **Speedway Travel Center — Finley Blvd, Birmingham** (Truck Stops, Birmingham): Dedicated truck parking / truck-stop category-fit not independently confirmed — sources describe it primarily as a fuel and convenience travel center; a single aggregator mention of ~10 truck spaces is uncorroborated. Also sits at Exit 262B, just north of the nominal seg4 top (Exit 261). Hold for confirmation of truck accommodation before publishing.
- **Texaco / Shop N Fill (Verbena)** (Truck Stops, Verbena): Small independent station; existence and Exit 200 location confirmed (truckstopsandservices, iExit, Alabama interstate logos, roadnow), but truck-parking availability/overnight status, truck-space count, and truck-stop category-fit are not independently corroborated (truck-parking claim is essentially single-source).
- **Entec Station #105** (Truck Stops, Millbrook): Small independent fuel stop (reported ~5 truck spaces). Existence and Exit 181/Millbrook location appear in TruckMap, iExit and yellowpages, but no confirmed street address or phone, and truck-parking/overnight status and truck-stop category-fit are not independently confirmed.
- **Days Inn by Wyndham Clanton** (Hotels with Truck Parking, Clanton): Hotel identity, address (2000 Big M Blvd) and Exit 205 confirmed via Wyndham official page, allstays and hotelplanner, but truck/large-vehicle parking availability is only reported by a single truck directory (truckstopsandservices) and cannot be independently confirmed; hotel truck parking changes frequently.
- **I-65 Butler County Rest Area (Southbound)** (Truck Parking, Greenville): Legal overnight-parking status not independently confirmed from an official ALDOT source; exact mile marker (SB ~133) needs official confirmation.
- **I-65 Butler County Rest Area (Northbound)** (Truck Parking, Greenville): Legal overnight-parking status not independently confirmed from an official ALDOT source; exact mile marker (NB ~132) needs official confirmation.
- **I-65 Conecuh County Rest Area (Southbound)** (Truck Parking, Evergreen): Legal overnight-parking status not independently confirmed from an official ALDOT source; exact mile marker (SB ~89) needs official confirmation.
- **I-65 Conecuh County Rest Area (Northbound)** (Truck Parking, Evergreen): Legal overnight-parking status not independently confirmed from an official ALDOT source; exact mile marker (NB ~84) needs official confirmation.
- **Qualawash / tank trailer wash, Saraland** (Truck Washes, Saraland): Category-fit and current identity/operating status not independently confirmed (single directory source). Likely tank-container cleaning, not a general truck/trailer wash; name and status need corroboration.

## Manual phone-verification list

Rows missing a verified phone (blank rather than guessed): **10**. Call before/after import; priority = published rows:
- Truck & Trailer Parking off US-72 (Athens) (Athens, Truck Parking)
- Love's Travel Stop #877 (Good Hope) (Cullman, Truck Stops)
- CAT Scale at Love's Travel Stop #877 (Cullman, CAT Scales)
- Comfort Inn & Suites Fultondale Gardendale I-65 (Fultondale, Hotels with Truck Parking)
- CAT Scale — Circle K, Pelham (Pelham, CAT Scales)

## Website-verification list

Rows missing a verified website (blank rather than guessed): **18**. Published rows to backfill:
- Athens Auto Tire & Wrecker Service (Athens, Roadside Service)
- CAT Scale - Pilot Travel Center #602, Birmingham (Birmingham, CAT Scales)
- Circle K (Pelham Truck Stop) (Pelham, Truck Stops)
- CAT Scale — Circle K, Pelham (Pelham, CAT Scales)
- Speed Trac Truck Stop (Calera Citgo/Speed Trac) (Calera, Truck Stops)
- Jemison Exxon (Jemison, Truck Stops)
- CAT Scale — Love's Travel Stop #624, Prichard (Prichard, CAT Scales)
- Love's Truck Tire Care #624, Prichard (Prichard, Tire Repair)
- CAT Scale — Pilot Travel Center #75, Satsuma (Satsuma, CAT Scales)
- Love's Truck Care #225, Evergreen (Evergreen, Tire Repair)
- Spirit Travel Center (Evergreen, Truck Stops)

## Address-verification concerns

- Rows with no street address: **12**; rows whose address does not start with a street number (rest area / weigh station / mobile / ambiguous): **0**.
  - Ardmore Welcome Center (I-65 Southbound) (Elkmont) — address: (blank)
  - I-65 Athens Weigh Station (Southbound) (Athens) — address: (blank)
  - I-65 Athens Weigh Station (Northbound) (Athens) — address: (blank)
  - J Mart #1305 (Priceville) — address: (blank)
  - Cullman County Rest Area (I-65 MM 301) (Cullman) — address: (blank)
  - Quality Inn Cullman I-65 Exit 310 (Cullman) — address: (blank)
  - Entec Station #105 (Millbrook) — address: (blank)
  - Yellow Hammer Travel Center (Brewton) — address: (blank)
  - I-65 Butler County Rest Area (Southbound) (Greenville) — address: (blank)
  - I-65 Butler County Rest Area (Northbound) (Greenville) — address: (blank)
  - I-65 Conecuh County Rest Area (Southbound) (Evergreen) — address: (blank)
  - I-65 Conecuh County Rest Area (Northbound) (Evergreen) — address: (blank)

## Parking-verification concerns

- Parking/overnight rows: **35**. Truck-space counts are blank unless a specific number was verified; parking-type flags set only where a source stated them.

## Weigh-station review

- Weigh/inspection stations included: **2** (0 published / 2 held). Highway coops without a civic street address + official source are held pending ALDOT confirmation.
  - I-65 Athens Weigh Station (Southbound) (Athens) — HELD: Only a single non-official source (coopsareopen) describes this weigh-in-motion point; not confirmed on an ALEA/ALDOT official source and no scale-house/address to verify.
  - I-65 Athens Weigh Station (Northbound) (Athens) — HELD: Only a single non-official source (coopsareopen) references a northbound weigh-in-motion point; exact mile marker not given and not confirmed on an ALEA/ALDOT official source.

## Legitimate co-location pairs

- In-file co-location pairs (CAT Scale / Love's Truck Care / Speedco / TA Truck Service / Petro service at a host truck stop, filed as separate rows per the directory model): **24** (score ≥ 50 by `classifyPair`). The host business is never duplicated.

## Coordinate readiness (no coordinates supplied)

- **Coordinate-ready candidates (52):** rows with a full verified street address — suitable for the verified geocoding console after import.
- **Manual-review coordinate candidates (12):** mile marker / rest area / weigh station / mobile service / incomplete or ambiguous address:
  - Ardmore Welcome Center (I-65 Southbound) (Elkmont)
  - I-65 Athens Weigh Station (Southbound) (Athens)
  - I-65 Athens Weigh Station (Northbound) (Athens)
  - J Mart #1305 (Priceville)
  - Cullman County Rest Area (I-65 MM 301) (Cullman)
  - Quality Inn Cullman I-65 Exit 310 (Cullman)
  - Entec Station #105 (Millbrook)
  - Yellow Hammer Travel Center (Brewton)
  - I-65 Butler County Rest Area (Southbound) (Greenville)
  - I-65 Butler County Rest Area (Northbound) (Greenville)
  - I-65 Conecuh County Rest Area (Southbound) (Evergreen)
  - I-65 Conecuh County Rest Area (Northbound) (Evergreen)

## Validation results

- Live import parser (`validate-import.ts` / `prepareImport`): master + all 3 parts = **100% clean** (0 skipped, 0 duplicates, 0 errors).
- Expansion Readiness (`assessExpansion` vs live production): **38 ready-to-publish, 26 import-unpublished, 0 manual-review, 0 reject**; slug collisions vs live: **0**.
- Duplicate detection (`classifyPair`): vs Georgia **0**, Tennessee **0**, Kentucky **0**, Ohio **0**, Michigan **0**, Florida **0**, Indiana **0**, live DB **0** matches; in-file co-location pairs: **24**; in-batch slug duplicates: **0**.
- Quality (`scoreCompleteness`): min 38, median 69, mean 64.9, max 76; labels: Incomplete 1, Needs work 26, Good 37.

## Known issues / limitations

- Some brand/official sites (Pilot/Flying J, Love's, TA/Petro, CAT Scale, TruckParkingClub, ALDOT) rate-limit or block direct fetches; those facts were corroborated via 2+ independent directories and the affected fields left blank when unconfirmed.
- Weigh-station direction/mile-marker detail is corroborated via aggregated truck directories; held until an official ALDOT source with a civic address confirms.

## Final recommendation

- Approved (Published = yes): **46** · Held (documented): **18** · Rejected in CSV: **0** (rejected candidates excluded pre-compilation — see sources report).
- Import parts: `i65-alabama-batch-008-part1.csv`, `i65-alabama-batch-008-part2.csv`, `i65-alabama-batch-008-part3.csv` (≤25 rows each).
- Nothing imported, published, merged, or deployed. Awaiting approval.
