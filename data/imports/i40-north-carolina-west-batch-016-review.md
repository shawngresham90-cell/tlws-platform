# Batch 16 — I-40 North Carolina West: Review Summary

CSV: `data/imports/i40-north-carolina-west-batch-016.csv` · verified 2026-07-13 · dry-run validated against the live import
parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`). **Nothing has been imported to production.**

This batch extends I-40 east into North Carolina — the mountain half (TN line to
Hickory), the directory's TENTH state. Post-Hurricane-Helene operating status was
verified for every included facility; the Pigeon River Gorge stretch runs one lane
each way with full reconstruction targeted for late 2028.

## Totals

- Total researched candidates: **65** (45 included + 20 excluded)
- Total rows in CSV: **45**
- Published = yes: **23**
- Published = no (held with documented reasons): **22**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **5** (only where actually listed on truckparkingclub.com); no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by state

| State | Rows | Published | Held |
| --- | --- | --- | --- |
| NC | 45 | 23 | 22 |

## Rows by category

| Category | Rows | Published | Held |
| --- | --- | --- | --- |
| CAT Scales | 4 | 4 | 0 |
| Hotels with Truck Parking | 8 | 6 | 2 |
| Roadside Service | 8 | 5 | 3 |
| Tire Repair | 6 | 2 | 4 |
| Truck Parking | 10 | 1 | 9 |
| Truck Stops | 8 | 5 | 3 |
| Weigh Stations | 1 | 0 | 1 |
| **Total** | **45** | **23** | **22** |

## Corridor coverage (TN line/gorge → Waynesville → Asheville → Old Fort Mtn → Marion → Morganton → Hickory)

- Distinct I-24 exits represented: **17** — 24, 37, 44, 47, 55, 64, 65, 75, 81, 85, 86, 90, 103, 119, 123, 125, 128

## Rows by city (west → east)
| City | Rows |
| --- | --- |
| Waynesville | 5 |
| Lake Junaluska | 1 |
| Canton | 1 |
| Candler | 5 |
| Asheville | 5 |
| Black Mountain | 2 |
| Old Fort | 1 |
| Marion | 8 |
| Nebo | 2 |
| Morganton | 2 |
| Hildebran | 1 |
| Hickory | 8 |
| Conover | 3 |
| Newton | 1 |

## Held records (Published = no) — reasons

- **Asheville Weigh Station (NC State Highway Patrol)** (Weigh Stations, Asheville): (see sources)
- **Truck Parking Club - 1464 Brevard Rd lot** (Truck Parking, Asheville): (see sources)
- **Truck Parking Club - Candler lot off Smokey Park Hwy** (Truck Parking, Candler): (see sources)
- **Comfort Inn Asheville East-Blue Ridge Pkwy Access** (Hotels with Truck Parking, Asheville): (see sources)
- **Walker Tire (Bill Walker Tire Centers)** (Tire Repair, Asheville): (see sources)
- **Truck Parking Club - 47 Walker Way** (Truck Parking, Canton): Only one independent source (Truck Parking Club's own listing; page fetch blocked). Gravel lot with 24/7 access just north of I-40 near Exit 31, no overnight idling/reefer allowed per listing snippet; capacity, pricing, and current availability unverified by a second source.
- **Handy Pantry (3360 Crabtree Rd)** (Truck Stops, Lake Junaluska): Single source (Roadnow exit listing) claims truck parking, deli, store, showers, and laundromat near Exit 27; no corroborating source found and current operating status unverified.
- **Pilot Flying J Truck Care Service Center - Waynesville** (Roadside Service, Waynesville): Yelp listing (updated 2025) and directory mentions of 2 truck service bays at Pilot #393 (Exit 24), but the dedicated Truck Care shop's current operating status could not be confirmed on Pilot's official site; repair capability is already noted on the published Pilot #393 truck-stop listing.
- **Waynesville Tire Inc** (Tire Repair, Waynesville): Own website states it carries commercial tires, but heavy-duty/semi-truck service capability, exact address relative to I-40 exits, and a second corroborating source were not verified.
- **McGee Commercial Tire & Service - Hickory** (Tire Repair, Hickory): (see sources)
- **McCabe's Tire & Service** (Tire Repair, Morganton): (see sources)
- **I-40 Diesel & Auto** (Roadside Service, Morganton): (see sources)
- **Truck Parking Club - 325 U.S. Hwy 70 SW, Hickory** (Truck Parking, Hickory): (see sources)
- **Truck Parking Club - 1960 US Highway 70 SE, Hickory** (Truck Parking, Hickory): (see sources)
- **Truck Parking Club - 8814 Dietz Ave, Hickory** (Truck Parking, Hickory): (see sources)
- **Studio 6 Hickory** (Hotels with Truck Parking, Hickory): (see sources)
- **Fast Track (Hildebran)** (Truck Stops, Hildebran): (see sources)
- **McDowell County Rest Area I-40 Eastbound (MM 82)** (Truck Parking, Marion): Official NCDOT source lists only mile marker/county, no civic address as required for rest areas.
- **McDowell County Rest Area I-40 Westbound (MM 82)** (Truck Parking, Marion): Official NCDOT source lists only mile marker/county, no civic address as required for rest areas.
- **Stuckey's / Dairy Queen / Exxon of Old Fort** (Truck Stops, Old Fort): Building fire (Feb. 28); reopening not independently confirmed - operational status unverified.
- **Hollifields Diesel** (Roadside Service, Marion): Single clear source; conflicting addresses across Hollifield listings; fixed-shop address unverified.
- **Travel Store (Burma Rd)** (Truck Parking, Nebo): Single source; existence and current operation unverified.

## Manual phone-verification list

Rows missing a verified phone (blank rather than guessed): **22**. Call before/after import; priority = published rows:
- Days Inn & Suites by Wyndham Hickory (Hickory, Hotels with Truck Parking)
- Super 8 by Wyndham Marion NC (Marion, Hotels with Truck Parking)

## Website-verification list

Rows missing a verified website (blank rather than guessed): **11**. Published rows to backfill:
- West Carolina Freightliner (Asheville, Roadside Service)
- Nebo Truck Stop (Nebo, Truck Stops)

## Address-verification concerns

- Rows with no street address: **6**; rows whose address does not start with a street number (rest area / weigh station / ambiguous): **3**.
  - Truck Parking Club - 47 Walker Way (Canton) — address: (blank)
  - Handy Pantry (3360 Crabtree Rd) (Lake Junaluska) — address: (blank)
  - Pilot Flying J Truck Care Service Center - Waynesville (Waynesville) — address: (blank)
  - Waynesville Tire Inc (Waynesville) — address: (blank)
  - McDowell County Rest Area I-40 Eastbound (MM 82) (Marion) — address: (blank)
  - McDowell County Rest Area I-40 Westbound (MM 82) (Marion) — address: (blank)
  - Asheville Weigh Station (NC State Highway Patrol) (Asheville) — address: I-40 eastbound and westbound, approx. 12 miles west of Asheville (Buncombe County)
  - Truck Parking Club - Candler lot off Smokey Park Hwy (Candler) — address: Smokey Park Hwy (exact street number not published in listing preview)
  - North Carolina Welcome Center - I-40 West (Haywood County) (Waynesville) — address: I-40 Eastbound, Mile Marker 10

## Parking-verification concerns

- Parking/overnight rows: **26**. Truck-space counts are blank unless a specific number was verified; parking-type flags set only where a source stated them. Overnight is never inferred from truck-space presence.

## Weigh-station review

- Weigh/inspection stations included: **1** (0 published / 1 held). Stations without a civic street address + official source are held pending NCDOT/NCSHP confirmation.
  - Asheville Weigh Station (NC State Highway Patrol) (Asheville) — HELD: see sources
- Public rest areas / welcome centers and weigh stations without a civic address + official state source are held.

## Legitimate co-location pairs

- In-file co-location pairs (CAT Scale / Love's Truck Care / Speedco / TA Truck Service at a host truck stop, filed as separate rows per the directory model): **6** (score >= 50 by `classifyPair`). The host business is never duplicated.

## Coordinate readiness (no coordinates supplied)

- **Coordinate-ready candidates (36):** rows with a full verified street address — suitable for the verified geocoding console after import.
- **Manual-review coordinate candidates (9):** mile marker / rest area / weigh station / incomplete or ambiguous address:
  - Truck Parking Club - 47 Walker Way (Canton)
  - Handy Pantry (3360 Crabtree Rd) (Lake Junaluska)
  - Pilot Flying J Truck Care Service Center - Waynesville (Waynesville)
  - Waynesville Tire Inc (Waynesville)
  - McDowell County Rest Area I-40 Eastbound (MM 82) (Marion)
  - McDowell County Rest Area I-40 Westbound (MM 82) (Marion)
  - Asheville Weigh Station (NC State Highway Patrol) (Asheville)
  - Truck Parking Club - Candler lot off Smokey Park Hwy (Candler)
  - North Carolina Welcome Center - I-40 West (Haywood County) (Waynesville)

## Validation results

- Live import parser (`prepareImport`): master + all 2 parts = **100% clean** (0 skipped, 0 duplicates, 0 errors).
- Expansion Readiness (`assessExpansion` vs live production): **32 ready-to-publish, 13 import-unpublished, 0 manual-review, 0 reject**; slug collisions vs live: **0**.
- Duplicate detection (`classifyPair`): vs Georgia I-75 **0**, Tennessee I-75 **0**, Kentucky I-75 **0**, Ohio **0**, Michigan **0**, Florida **0**, Indiana **0**, Alabama **0**, Tennessee I-65 **0**, pending I-65 KY (b010) **0**, pending I-24 TN (b011) **0**, pending I-24 KY (b012) **0**, live DB **0** matches; in-file co-location pairs: **6**; in-batch slug duplicates: **0**.
  - Cross-batch/live hits are reviewed individually in the validation report; brand-multi-exit matches (same chain at a different city/exit/street address) are false positives. `assessExpansion` is the authoritative gate.
- Quality (`scoreCompleteness`): min 24, median 65, mean 61.8, max 80; labels: Incomplete 4, Needs work 18, Good 23.

## Existing-production duplicate protection (NC)

- North Carolina is a NEW state for the directory: production has **0** existing NC listings, so no existing-state collision is possible. All candidates were still cross-checked (`classifyPair`) against every merged batch CSV, all six pending unmerged batches (b010-b015) and the full live DB: zero hits of any score. In-file pairs are the legitimate TA Candler host + CAT Scale + TA Truck Service co-locations.
- Rows dropped because they already exist in production (not re-added, production left unchanged): **0**.

## Known issues / limitations

- Some brand/official sites (Pilot/Flying J, Love's, CAT Scale, TruckParkingClub, IDOT, GDOT) rate-limit or block direct fetches; facts were corroborated via 2+ independent directories and the affected fields left blank when unconfirmed.
- ncshp.gov / ncdps.gov / ncdot.gov 403 through the research proxy, so the officially-confirmed Buncombe County (Asheville) weigh station and the McDowell County rest areas are HELD pending official civic addresses. Post-Helene verification excluded stale listings (Sandy's Canton CLOSED; Exit 44 Wilco now a car-only Speedway; Exit 75 Stuckey's held after its Feb 2026 fire). Exits 100-132 genuinely contain no truck stop, CAT scale, weigh station or rest area (the Rock Barn Rd Pilot is Exit 133, next segment).

## Final recommendation

- Approved (Published = yes): **23** · Held (documented): **22** · Rejected in CSV: **0** (rejected candidates excluded pre-compilation — see sources report).
- Import parts: `i40-north-carolina-west-batch-016-part1.csv`, `i40-north-carolina-west-batch-016-part2.csv` (<=25 rows each).
- Nothing imported, published, merged, or deployed. Awaiting approval.
