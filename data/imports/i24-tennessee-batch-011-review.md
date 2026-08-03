# Batch 11 — I-24 Tennessee: Review Summary

CSV: `data/imports/i24-tennessee-batch-011.csv` · verified 2026-07-13 · dry-run validated against the live import
parser (`scripts/validate-import.ts`) **and** the Expansion Readiness assessment
(`assessExpansion`). **Nothing has been imported to production.**

## Totals

- Total researched candidates: **63** (43 included + 20 excluded)
- Total rows in CSV: **43**
- Published = yes: **31**
- Published = no (held with documented reasons): **12**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **1** (only where actually listed on truckparkingclub.com); no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category

| Category | Rows | Published | Held |
| --- | --- | --- | --- |
| CAT Scales | 9 | 8 | 1 |
| Roadside Service | 6 | 4 | 2 |
| Tire Repair | 1 | 0 | 1 |
| Truck Parking | 1 | 1 | 0 |
| Truck Stops | 23 | 17 | 6 |
| Truck Washes | 1 | 1 | 0 |
| Weigh Stations | 2 | 0 | 2 |
| **Total** | **43** | **31** | **12** |

## Corridor coverage (Chattanooga / I-75 → Monteagle → Murfreesboro → Nashville → Clarksville → Kentucky line)

- Distinct I-24 exits represented: **15** — 11, 24, 35, 62, 64, 70, 81, 89, 114, 117, 135, 152, 158, 175, 180B

## Rows by city (east → west)
| City | Rows |
| --- | --- |
| Chattanooga | 4 |
| Jasper | 3 |
| Kimball | 1 |
| Monteagle | 5 |
| Hillsboro | 3 |
| Manchester | 5 |
| Christiana | 3 |
| Murfreesboro | 2 |
| Smyrna | 2 |
| La Vergne | 2 |
| Antioch | 7 |
| Joelton | 2 |
| Pleasant View | 1 |
| Clarksville | 3 |

## Held records (Published = no) — reasons

- **MAPCO Express (Cummings Hwy)** (Truck Stops, Chattanooga): Truck access/parking unconfirmed: sources conflict — iExit lists 'truck parking' at I-24 Exit 174 but the truckstopsandservices detail shows 0 truck/paid/reserved spaces. Likely a car-oriented convenience store; cannot confirm category-fit.
- **MAPCO Express #3534 (100 W 20th)** (Truck Stops, Chattanooga): Truck parking unconfirmed and conflicting: one listing cites overnight/secured parking, another states 'no parking' at this downtown I-24 Exit 178 site (100 W 20th St, 37408). Cannot confirm 18-wheeler access/parking.
- **Sudden Service #25 (Shell)** (Truck Stops, Clarksville): Shell-branded 24-hr convenience store at 601 Hornbuckle Rd near I-24 Exit 11 (Hwy 76). Official store page describes it only as a convenience store; truck parking/overnight/diesel claim comes from a single aggregator and is not corroborated. Truck access unconfirmed.
- **Scots Market / Chips Quik Stop** (Truck Stops, Joelton): Two names at the same address (1284 Jackson Felts Rd) near I-24 Exit 31; truck-parking claim from a single aggregator (Roadnow), no independent corroboration and no truck access confirmed.
- **I-24 Weigh Station (near KY line, Montgomery/Robertson)** (Weigh Stations, Clarksville): Could not confirm a civic address or an official TDOT/THP listing for an I-24 commercial-vehicle scale near the KY state line. THP CVE list shows the nearest I-24 scale at MM 115 (Manchester, far out of corridor). Holding per instructions; overnight legality never assumed.
- **Monteagle Mountain Runaway Truck Ramps (I-24)** (Roadside Service, Monteagle): Two emergency gravel runaway ramps on the Monteagle grade (approx. 1.9 and 3 miles from the summit, left side). No civic address and no official TDOT facility page confirming a driver-usable/parking location; per rules TDOT safety features are held without a civic address + official TDOT source.
- **Monteagle Mountain Mandatory Brake Check Area (I-24)** (Roadside Service, Monteagle): Mandatory truck brake-check/adjustment area on the Monteagle grade (opened 1992, right side). No civic address or official TDOT source confirming exact location or any legal overnight/parking use; held per rules.
- **THP/TDOT I-24 Commercial Vehicle Scales (Coffee County / Manchester)** (Weigh Stations, Manchester): Official THP/TDOT source references I-24 scales in Coffee County near MM 115 / just north of Exit 117, but no civic street address confirmed and overnight parking legality not established; per rules weigh stations are held without a civic address.
- **K&K Top Stop Market and Truck Stop** (Truck Stops, Manchester): Only a single aggregator mention at I-24 Exit 111; amenities and truck access unverified by a second independent source.
- **Hullets Shell** (Truck Stops, Manchester): Single-source mention at I-24 Exit 110; no independent corroboration of truck amenities/access.
- **CAT Scale (Thornton's, Exit 62)** (CAT Scales, Antioch): Aggregator listings note 'CAT scales' at Thornton's, but not confirmed on the official CAT Scale locator (only TA Antioch and Pilot #52 Exit-64 scales verified there); likely aggregator confusion with the adjacent TA Antioch scale. Needs catscale.com confirmation.
- **Thornton's Tire/Minor Repair (Exit 62)** (Tire Repair, Antioch): Directory lists 'tire sales/repair, minor repair' at Thornton's but no distinct branded tire-service operation is confirmed as a separate facility; single-category aggregator claim only.

## Manual phone-verification list

Rows missing a verified phone (blank rather than guessed): **14**. Call before/after import; priority = published rows:
- Truck Parking Club - Kimball (Main St.) (Kimball, Truck Parking)
- Speedway (Almaville Rd, Exit 70) (Smyrna, Truck Stops)

## Website-verification list

Rows missing a verified website (blank rather than guessed): **21**. Published rows to backfill:
- MAPCO / Circle K (Chattanooga, Truck Stops)
- Conoco / MAPCO Favorite Market (Chattanooga, Truck Stops)
- MAPCO Express #1007 (Pleasant View, Truck Stops)
- Heritage Travel Center (Joelton, Truck Stops)
- Sam's Travel Center (Monteagle, Truck Stops)
- I-24 Truck Plaza (Manchester, Truck Stops)
- Speedway (Almaville Rd, Exit 70) (Smyrna, Truck Stops)
- Circle K #3701 (Almaville Rd, Exit 70) (Smyrna, Truck Stops)
- Thornton's (Antioch, Exit 62) (Antioch, Truck Stops)

## Address-verification concerns

- Rows with no street address: **12**; rows whose address does not start with a street number (rest area / weigh station / mobile / ambiguous): **0**.
  - MAPCO Express (Cummings Hwy) (Chattanooga) — address: (blank)
  - MAPCO Express #3534 (100 W 20th) (Chattanooga) — address: (blank)
  - Sudden Service #25 (Shell) (Clarksville) — address: (blank)
  - Scots Market / Chips Quik Stop (Joelton) — address: (blank)
  - I-24 Weigh Station (near KY line, Montgomery/Robertson) (Clarksville) — address: (blank)
  - Monteagle Mountain Runaway Truck Ramps (I-24) (Monteagle) — address: (blank)
  - Monteagle Mountain Mandatory Brake Check Area (I-24) (Monteagle) — address: (blank)
  - THP/TDOT I-24 Commercial Vehicle Scales (Coffee County / Manchester) (Manchester) — address: (blank)
  - K&K Top Stop Market and Truck Stop (Manchester) — address: (blank)
  - Hullets Shell (Manchester) — address: (blank)
  - CAT Scale (Thornton's, Exit 62) (Antioch) — address: (blank)
  - Thornton's Tire/Minor Repair (Exit 62) (Antioch) — address: (blank)

## Parking-verification concerns

- Parking/overnight rows: **24**. Truck-space counts are blank unless a specific number was verified; parking-type flags set only where a source stated them. Overnight is never inferred from truck-space presence.

## Weigh-station / mountain-safety review

- Weigh/inspection stations included: **2** (0 published / 2 held). Stations without a civic street address + official source are held pending TDOT/THP confirmation.
  - I-24 Weigh Station (near KY line, Montgomery/Robertson) (Clarksville) — HELD: Could not confirm a civic address or an official TDOT/THP listing for an I-24 commercial-vehicle scale near the KY state line. THP CVE list shows the nearest I-24 scale at MM 115 (Manchester, far out of corridor). Holding per instructions; overnight legality never assumed.
  - THP/TDOT I-24 Commercial Vehicle Scales (Coffee County / Manchester) (Manchester) — HELD: Official THP/TDOT source references I-24 scales in Coffee County near MM 115 / just north of Exit 117, but no civic street address confirmed and overnight parking legality not established; per rules weigh stations are held without a civic address.
- Monteagle Mountain runaway-truck ramps and the mandatory brake-check area are held (no civic address / official TDOT facility page); they are safety features, not driver-service or parking facilities.

## Legitimate co-location pairs

- In-file co-location pairs (CAT Scale / Love's Truck Care / Speedco / TA Truck Service at a host truck stop, filed as separate rows per the directory model): **17** (score >= 50 by `classifyPair`). The host business is never duplicated.

## Coordinate readiness (no coordinates supplied)

- **Coordinate-ready candidates (31):** rows with a full verified street address — suitable for the verified geocoding console after import.
- **Manual-review coordinate candidates (12):** mile marker / rest area / weigh station / mobile service / incomplete or ambiguous address:
  - MAPCO Express (Cummings Hwy) (Chattanooga)
  - MAPCO Express #3534 (100 W 20th) (Chattanooga)
  - Sudden Service #25 (Shell) (Clarksville)
  - Scots Market / Chips Quik Stop (Joelton)
  - I-24 Weigh Station (near KY line, Montgomery/Robertson) (Clarksville)
  - Monteagle Mountain Runaway Truck Ramps (I-24) (Monteagle)
  - Monteagle Mountain Mandatory Brake Check Area (I-24) (Monteagle)
  - THP/TDOT I-24 Commercial Vehicle Scales (Coffee County / Manchester) (Manchester)
  - K&K Top Stop Market and Truck Stop (Manchester)
  - Hullets Shell (Manchester)
  - CAT Scale (Thornton's, Exit 62) (Antioch)
  - Thornton's Tire/Minor Repair (Exit 62) (Antioch)

## Validation results

- Live import parser (`validate-import.ts` / `prepareImport`): master + all 2 parts = **100% clean** (0 skipped, 0 duplicates, 0 errors).
- Expansion Readiness (`assessExpansion` vs live production): **28 ready-to-publish, 15 import-unpublished, 0 manual-review, 0 reject**; slug collisions vs live: **0**.
- Duplicate detection (`classifyPair`): vs Georgia **0**, Tennessee I-75 **19**, Kentucky **0**, Ohio **2**, Michigan **0**, Florida **0**, Indiana **0**, Alabama **0**, Tennessee I-65 **22**, live DB **43** low-confidence matches; in-file co-location pairs: **17**; in-batch slug duplicates: **0**.
  - All cross-batch/live matches are score-35 `brand-multi-exit` or shared-corporate-contact false positives (same Pilot/Love's/Speedco/Blue Beacon brand or shared CAT Scale/Speedco corporate phone+website at a **different city, exit and street address**). `assessExpansion` — the authoritative gate — returned **0 manual-review and 0 reject**, and there are **0 slug collisions**, so no real duplicate survives.
- Quality (`scoreCompleteness`): min 24, median 68, mean 59.3, max 76; labels: Incomplete 12, Needs work 5, Good 26. Low scorers are the held/thin rows (safety features, single-source holds); every published full-service stop scores Good.

## Existing-Tennessee duplicate protection

- Every candidate was compared (normalized name + city, plus `classifyPair` on name/address/phone/website/category/interstate/exit) against all **89 existing production Tennessee listings** (the I-75 and I-65 batches). This batch is the **I-24** corridor; the existing TN rows are I-75 (Chattanooga↔Knoxville) and I-65 (Nashville↔Alabama line), so there is no exit or address overlap.
- Rows dropped because they already exist in production Tennessee (exact/probable existing-TN duplicates; not re-added, production left unchanged): **0**.
- The Nashville Love's #429 (I-65 Trinity Ln, already live) and the Antioch/downtown facilities on the I-24/I-65/I-40 overlap were explicitly excluded rather than re-listed; the Clarksville truck cluster is actually in Oak Grove, KY (I-24 Exit 86, across the state line) and is out of scope for this TN batch.

## Known issues / limitations

- Some brand/official sites (Pilot/Flying J, Love's, TA/Petro, CAT Scale, TruckParkingClub, TDOT) rate-limit or block direct fetches; those facts were corroborated via 2+ independent directories and the affected fields left blank when unconfirmed.
- The TN I-24 corridor is short and largely urban (Chattanooga, Nashville) with long rural mountain stretches, so verified truck-service density is lower than the I-75/I-65 batches; quality over quantity.

## Final recommendation

- Approved (Published = yes): **31** · Held (documented): **12** · Rejected in CSV: **0** (rejected candidates excluded pre-compilation — see sources report).
- Import parts: `i24-tennessee-batch-011-part1.csv`, `i24-tennessee-batch-011-part2.csv` (<=25 rows each).
- Nothing imported, published, merged, or deployed. Awaiting approval.
