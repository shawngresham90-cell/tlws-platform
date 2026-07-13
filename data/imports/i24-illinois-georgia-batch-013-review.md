# Batch 13 — I-24 Illinois + Georgia (corridor completion): Review Summary

CSV: `data/imports/i24-illinois-georgia-batch-013.csv` · verified 2026-07-13 · dry-run validated against the live import
parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`). **Nothing has been imported to production.**

This batch completes the I-24 corridor: Tennessee (Batch 11) and Kentucky (Batch 12) are
in-flight draft PRs; this adds the Illinois western end and the short Georgia dip.

## Totals

- Total researched candidates: **30** (16 included + 14 excluded)
- Total rows in CSV: **16**
- Published = yes: **6**
- Published = no (held with documented reasons): **10**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **0** (only where actually listed on truckparkingclub.com); no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by state

| State | Rows | Published | Held |
| --- | --- | --- | --- |
| IL | 12 | 4 | 8 |
| GA | 4 | 2 | 2 |

## Rows by category

| Category | Rows | Published | Held |
| --- | --- | --- | --- |
| CAT Scales | 1 | 1 | 0 |
| Hotels with Truck Parking | 3 | 2 | 1 |
| Roadside Service | 2 | 0 | 2 |
| Tire Repair | 2 | 0 | 2 |
| Truck Parking | 3 | 0 | 3 |
| Truck Stops | 4 | 3 | 1 |
| Weigh Stations | 1 | 0 | 1 |
| **Total** | **16** | **6** | **10** |

## Corridor coverage (I-57/Goreville → Vienna → Metropolis → [Ohio River] … [TN] … Wildwood GA → [TN])

- Distinct I-24 exits represented: **3** — 16, 37, 169

## Rows by city (west → east)
| City | Rows |
| --- | --- |
| Vienna | 3 |
| Metropolis | 9 |
| Wildwood | 4 |

## Held records (Published = no) — reasons

- **Georgia I-24 Weigh / Inspection Station (Dade County)** (Weigh Stations, Wildwood): No official Georgia source (dot.ga.gov / dps.georgia.gov) found confirming an I-24 weigh or inspection station in Dade County with a civic address. GA DPS weigh-station and CVE region pages and general weigh-station directories (allstays, coopsareopen, truckstopsandservices) did not surface an I-24 Georgia facility in search results. Held pending official confirmation.
- **Mapco Express #3524** (Truck Stops, Wildwood): Listed in older truck-stop directories at I-24 Exit 169 with 24-hour diesel, certified scales, and truck parking, but sources conflict on the address (405 Highway 299 vs 955 Highway 299 — possibly two separate Mapco stations) and current trucker amenities (scales, tire/mechanical road service, RV parking) come only from stale directory data. Yelp shows a Mapco Express operating at 405 Highway 299 as a gas station. Held pending verification of address and current truck services.
- **Fort Massac Welcome Center / Rest Area (I-24 MM 37)** (Truck Parking, Metropolis): IDOT confirms a Fort Massac rest area on I-24 near Metropolis (bidirectional, off-freeway on US-45 at Exit 37), but no official IDOT/illinois.gov source with a civic address was retrievable (IDOT pages 403 behind proxy). Third-party sources report the building is closed with only the parking lot open, and an IDOT blog (March 2026) says the facility is in design phase for reconstruction. Status and address need official confirmation before publishing.
- **Truck Parking Club lot - 2409 IL-145 Metropolis** (Truck Parking, Metropolis): Bookable paid truck/trailer parking property at the corner of US-45 and IL-145 described as right off I-24, on a site the owner bought after the State of Illinois decommissioned it. Only one source (Truck Parking Club) documents it; space count, pricing, and exact relationship to Exit 37 unverified.
- **Truck parking only lot - 5570 S US Route 45 (former truck stop)** (Truck Parking, Metropolis): Allstays lists a truck-parking-only site at I-24 Exit 37, 5570 S US Route 45, with 25 spaces at a former (out-of-business) truck stop. Single source; current availability and legality of parking unverified, possibly the same property as the Truck Parking Club listing.
- **Holiday Inn Express Metropolis** (Hotels with Truck Parking, Metropolis): Hotel at 2179 E 5th St near I-24 Exit 37, but no source explicitly confirms truck/large-vehicle parking.
- **On-Site Truck and Trailer Services** (Roadside Service, Metropolis): Commercial truck/trailer repair at 3098 Old Marion Rd, Metropolis offering 24/7 road service, fleet maintenance, DOT inspections, and tire repair. Business name and offerings suggest primarily mobile/on-site dispatch; fixed-facility service and proximity to an I-24 exit not confirmed, and only one substantive source found.
- **Keen's Truck & Trailer Repair (at Metropolis Truck Plaza)** (Roadside Service, Metropolis): Listed by one directory as truck/tire repair at I-24 Exit 37 (phone 270-251-8160, a Kentucky number), likely a mobile vendor serving the truck plaza rather than a distinct fixed facility. Single source, unverified.
- **Plaza Tire Service - Metropolis** (Tire Repair, Metropolis): Tire shop at 1503 E 5th St on the US-45 corridor about a mile from I-24 Exit 37, but sources describe service for cars, SUVs, and light trucks; commercial semi-truck tire service not confirmed.
- **Vienna Automotive Center** (Tire Repair, Vienna): Real repair shop at 35 Industrial Dr near I-24 Exit 16 (tires, towing, roadside assistance), but sources (Yelp, AAA, Bumper to Bumper) describe passenger-vehicle service; no corroboration that it services commercial/semi trucks. M-F daytime hours only.

## Manual phone-verification list

Rows missing a verified phone (blank rather than guessed): **11**. Call before/after import; priority = published rows:
- BP Vienna (E Vine St) (Vienna, Truck Stops)

## Website-verification list

Rows missing a verified website (blank rather than guessed): **11**. Published rows to backfill:
- Metropolis Truck Plaza (Metropolis, Truck Stops)

## Address-verification concerns

- Rows with no street address: **10**; rows whose address does not start with a street number (rest area / weigh station / ambiguous): **0**.
  - Georgia I-24 Weigh / Inspection Station (Dade County) (Wildwood) — address: (blank)
  - Mapco Express #3524 (Wildwood) — address: (blank)
  - Fort Massac Welcome Center / Rest Area (I-24 MM 37) (Metropolis) — address: (blank)
  - Truck Parking Club lot - 2409 IL-145 Metropolis (Metropolis) — address: (blank)
  - Truck parking only lot - 5570 S US Route 45 (former truck stop) (Metropolis) — address: (blank)
  - Holiday Inn Express Metropolis (Metropolis) — address: (blank)
  - On-Site Truck and Trailer Services (Metropolis) — address: (blank)
  - Keen's Truck & Trailer Repair (at Metropolis Truck Plaza) (Metropolis) — address: (blank)
  - Plaza Tire Service - Metropolis (Metropolis) — address: (blank)
  - Vienna Automotive Center (Vienna) — address: (blank)

## Parking-verification concerns

- Parking/overnight rows: **10**. Truck-space counts are blank unless a specific number was verified; parking-type flags set only where a source stated them. Overnight is never inferred from truck-space presence.

## Weigh-station review

- Weigh/inspection stations included: **1** (0 published / 1 held). Stations without a civic street address + official source are held pending IDOT/ISP (Illinois) or GDOT/DPS (Georgia) confirmation.
  - Georgia I-24 Weigh / Inspection Station (Dade County) (Wildwood) — HELD: No official Georgia source (dot.ga.gov / dps.georgia.gov) found confirming an I-24 weigh or inspection station in Dade County with a civic address. GA DPS weigh-station and CVE region pages and general weigh-station directories (allstays, coopsareopen, truckstopsandservices) did not surface an I-24 Georgia facility in search results. Held pending official confirmation.
- Public rest areas / welcome centers and weigh stations without a civic address + official state source are held.

## Legitimate co-location pairs

- In-file co-location pairs (CAT Scale / Love's Truck Care / Speedco / TA Truck Service at a host truck stop, filed as separate rows per the directory model): **1** (score >= 50 by `classifyPair`). The host business is never duplicated.

## Coordinate readiness (no coordinates supplied)

- **Coordinate-ready candidates (6):** rows with a full verified street address — suitable for the verified geocoding console after import.
- **Manual-review coordinate candidates (10):** mile marker / rest area / weigh station / incomplete or ambiguous address:
  - Georgia I-24 Weigh / Inspection Station (Dade County) (Wildwood)
  - Mapco Express #3524 (Wildwood)
  - Fort Massac Welcome Center / Rest Area (I-24 MM 37) (Metropolis)
  - Truck Parking Club lot - 2409 IL-145 Metropolis (Metropolis)
  - Truck parking only lot - 5570 S US Route 45 (former truck stop) (Metropolis)
  - Holiday Inn Express Metropolis (Metropolis)
  - On-Site Truck and Trailer Services (Metropolis)
  - Keen's Truck & Trailer Repair (at Metropolis Truck Plaza) (Metropolis)
  - Plaza Tire Service - Metropolis (Metropolis)
  - Vienna Automotive Center (Vienna)

## Validation results

- Live import parser (`prepareImport`): master + all 1 parts = **100% clean** (0 skipped, 0 duplicates, 0 errors).
- Expansion Readiness (`assessExpansion` vs live production): **6 ready-to-publish, 10 import-unpublished, 0 manual-review, 0 reject**; slug collisions vs live: **0**.
- Duplicate detection (`classifyPair`): vs Georgia I-75 **10**, Tennessee I-75 **0**, Kentucky I-75 **0**, Ohio **0**, Michigan **0**, Florida **0**, Indiana **0**, Alabama **0**, Tennessee I-65 **0**, pending I-65 KY (b010) **0**, pending I-24 TN (b011) **0**, pending I-24 KY (b012) **0**, live DB **10** matches; in-file co-location pairs: **1**; in-batch slug duplicates: **0**.
  - Cross-batch/live hits are reviewed individually in the validation report; brand-multi-exit matches (same chain at a different city/exit/street address) are false positives. `assessExpansion` is the authoritative gate.
- Quality (`scoreCompleteness`): min 24, median 27, mean 43.3, max 80; labels: Incomplete 10, Needs work 1, Good 5.

## Existing-production duplicate protection (IL + GA)

- Illinois has **0** existing production listings (first IL batch), so no existing-IL collision is possible; every GA candidate was compared (normalized name + city + state, plus `classifyPair`) against all **78** existing production Georgia listings (the I-75 Georgia batch). The I-24 GA dip is in Dade County (Wildwood/New England, exits 167-169) in the far NW corner; the existing GA rows are the I-75 corridor (Ringgold → Valdosta), so no address/exit overlap exists.
- Rows dropped because they already exist in production (not re-added, production left unchanged): **0**.

## Known issues / limitations

- Some brand/official sites (Pilot/Flying J, Love's, CAT Scale, TruckParkingClub, IDOT, GDOT) rate-limit or block direct fetches; facts were corroborated via 2+ independent directories and the affected fields left blank when unconfirmed.
- Both segments are rural with few facilities — I-24 in Illinois is a lightly-developed 38-mile connector and the Georgia dip is ~4 miles; a small, honest batch is the correct result. Quality over quantity; nothing was padded.

## Final recommendation

- Approved (Published = yes): **6** · Held (documented): **10** · Rejected in CSV: **0** (rejected candidates excluded pre-compilation — see sources report).
- Import parts: `i24-illinois-georgia-batch-013-part1.csv` (<=25 rows each).
- Nothing imported, published, merged, or deployed. Awaiting approval.
