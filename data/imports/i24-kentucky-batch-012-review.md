# Batch 12 — I-24 Kentucky: Review Summary

CSV: `data/imports/i24-kentucky-batch-012.csv` · verified 2026-07-13 · dry-run validated against the live import
parser (`scripts/validate-import.ts`) **and** the Expansion Readiness assessment
(`assessExpansion`). **Nothing has been imported to production.**

## Totals

- Total researched candidates: **48** (37 included + 11 excluded)
- Total rows in CSV: **37**
- Published = yes: **28**
- Published = no (held with documented reasons): **9**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **0** (only where actually listed on truckparkingclub.com); no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category

| Category | Rows | Published | Held |
| --- | --- | --- | --- |
| CAT Scales | 7 | 7 | 0 |
| Hotels with Truck Parking | 6 | 3 | 3 |
| Roadside Service | 1 | 1 | 0 |
| Tire Repair | 4 | 4 | 0 |
| Truck Parking | 1 | 0 | 1 |
| Truck Stops | 13 | 11 | 2 |
| Truck Washes | 2 | 2 | 0 |
| Weigh Stations | 3 | 0 | 3 |
| **Total** | **37** | **28** | **9** |

## Corridor coverage (Chattanooga / I-75 → Monteagle → Murfreesboro → Nashville → Clarksville → Kentucky line)

- Distinct I-24 exits represented: **9** — 3, 4, 11, 16, 27, 40, 65, 86, 89

## Rows by city (east → west)
| City | Rows |
| --- | --- |
| Oak Grove | 14 |
| Hopkinsville | 1 |
| Cadiz | 4 |
| Grand Rivers | 1 |
| Kuttawa | 4 |
| Calvert City | 4 |
| Paducah | 9 |

## Held records (Published = no) — reasons

- **Blue Springs Chevron** (Truck Stops, Cadiz): Listed at 10705 Cadiz Rd near I-24 Exit 56 with truck parking, restaurant/deli, and store, but only one reliable aggregator source (Roadnow) could be corroborated; truck parking/amenities unverified by a second independent source.
- **Knights Inn Cadiz** (Hotels with Truck Parking, Cadiz): Appears in a truck stop/services directory near I-24 Exit 65, but truck parking is not confirmed by an independent source.
- **Cheers Food and Fuel** (Truck Stops, Grand Rivers): Small fuel stop at I-24 Exit 31 (709 Complex Dr); aggregators describe it as having no truck parking, so truck access/overnight legality unconfirmed.
- **Lyon County Weigh Station (I-24 EB)** (Weigh Stations, Kuttawa): Eastbound weigh station near I-24 mile marker 36 in Lyon County; no civic street address and no direct official KYTC/KSP page confirming location, per rule hold weigh stations without civic address + official source.
- **I-24 Weigh Station (Christian County)** (Weigh Stations, Hopkinsville): Could not confirm a civic address or official KYTC/KSP source for an I-24 weigh station in Christian County near Hopkinsville. The only confirmed KY I-24 weigh station in official/aggregator sources is at MM 36 in Lyon County (out of this corridor). Overnight/parking legality not established.
- **Quality Inn Fort Campbell** (Hotels with Truck Parking, Oak Grove): Hotel at I-24 Exit 86, but truck/large-vehicle parking not confirmed by two independent sources (only generic/bus parking referenced); conflicting address listings (201 Auburn St, Oak Grove vs 2923 Fort Campbell Blvd, Hopkinsville).
- **I-24 Christian County Welcome Center (Mile Marker 92)** (Truck Parking, Oak Grove): Westbound welcome center/rest area with separate truck parking, but located at MM 92 (north of the Exit 86-89 target range) and a KYTC bulletin reported it temporarily closed; current operating status and overnight-truck-parking legality unconfirmed.
- **Super 8 by Wyndham Paducah I-24 Exit 4** (Hotels with Truck Parking, Paducah): Hotel at I-24 Exit 4 confirmed with free parking, but truck/large-vehicle parking not explicitly confirmed by any source.
- **I-24 Weigh Station (McCracken County)** (Weigh Stations, Paducah): No official KYTC/KSP source with a civic address for an I-24 weigh station in the Paducah/McCracken County corridor could be verified; KYTC facilities PDF was inaccessible (403). Overnight legality not confirmed.

## Manual phone-verification list

Rows missing a verified phone (blank rather than guessed): **14**. Call before/after import; priority = published rows:
- CAT Scale - Flying J #662 (Oak Grove, CAT Scales)
- CAT Scale - Pilot #439 (Oak Grove, CAT Scales)
- CAT Scale - Love's #782 (Oak Grove, CAT Scales)
- Days Inn by Wyndham Oak Grove/Ft. Campbell (Oak Grove, Hotels with Truck Parking)
- Days Inn by Wyndham Paducah I-24 Exit 4 (Paducah, Hotels with Truck Parking)

## Website-verification list

Rows missing a verified website (blank rather than guessed): **11**. Published rows to backfill:
- I-24 Chevron Fuel Express (I-24/41A Truck Stop) (Oak Grove, Truck Stops)
- Exit 11 Exxon (Paducah, Truck Stops)

## Address-verification concerns

- Rows with no street address: **9**; rows whose address does not start with a street number (rest area / weigh station / mobile / ambiguous): **0**.
  - Blue Springs Chevron (Cadiz) — address: (blank)
  - Knights Inn Cadiz (Cadiz) — address: (blank)
  - Cheers Food and Fuel (Grand Rivers) — address: (blank)
  - Lyon County Weigh Station (I-24 EB) (Kuttawa) — address: (blank)
  - I-24 Weigh Station (Christian County) (Hopkinsville) — address: (blank)
  - Quality Inn Fort Campbell (Oak Grove) — address: (blank)
  - I-24 Christian County Welcome Center (Mile Marker 92) (Oak Grove) — address: (blank)
  - Super 8 by Wyndham Paducah I-24 Exit 4 (Paducah) — address: (blank)
  - I-24 Weigh Station (McCracken County) (Paducah) — address: (blank)

## Parking-verification concerns

- Parking/overnight rows: **20**. Truck-space counts are blank unless a specific number was verified; parking-type flags set only where a source stated them. Overnight is never inferred from truck-space presence.

## Weigh-station review

- Weigh/inspection stations included: **3** (0 published / 3 held). Stations without a civic street address + official source are held pending KYTC/KSP confirmation.
  - Lyon County Weigh Station (I-24 EB) (Kuttawa) — HELD: Eastbound weigh station near I-24 mile marker 36 in Lyon County; no civic street address and no direct official KYTC/KSP page confirming location, per rule hold weigh stations without civic address + official source.
  - I-24 Weigh Station (Christian County) (Hopkinsville) — HELD: Could not confirm a civic address or official KYTC/KSP source for an I-24 weigh station in Christian County near Hopkinsville. The only confirmed KY I-24 weigh station in official/aggregator sources is at MM 36 in Lyon County (out of this corridor). Overnight/parking legality not established.
  - I-24 Weigh Station (McCracken County) (Paducah) — HELD: No official KYTC/KSP source with a civic address for an I-24 weigh station in the Paducah/McCracken County corridor could be verified; KYTC facilities PDF was inaccessible (403). Overnight legality not confirmed.
- Public rest areas / welcome centers and weigh stations without a civic address + official KYTC/KSP source are held.

## Legitimate co-location pairs

- In-file co-location pairs (CAT Scale / Love's Truck Care / Speedco / TA Truck Service at a host truck stop, filed as separate rows per the directory model): **12** (score >= 50 by `classifyPair`). The host business is never duplicated.

## Coordinate readiness (no coordinates supplied)

- **Coordinate-ready candidates (28):** rows with a full verified street address — suitable for the verified geocoding console after import.
- **Manual-review coordinate candidates (9):** mile marker / rest area / weigh station / mobile service / incomplete or ambiguous address:
  - Blue Springs Chevron (Cadiz)
  - Knights Inn Cadiz (Cadiz)
  - Cheers Food and Fuel (Grand Rivers)
  - Lyon County Weigh Station (I-24 EB) (Kuttawa)
  - I-24 Weigh Station (Christian County) (Hopkinsville)
  - Quality Inn Fort Campbell (Oak Grove)
  - I-24 Christian County Welcome Center (Mile Marker 92) (Oak Grove)
  - Super 8 by Wyndham Paducah I-24 Exit 4 (Paducah)
  - I-24 Weigh Station (McCracken County) (Paducah)

## Validation results

- Live import parser (`validate-import.ts` / `prepareImport`): master + all 2 parts = **100% clean** (0 skipped, 0 duplicates, 0 errors).
- Expansion Readiness (`assessExpansion` vs live production): **28 ready-to-publish, 9 import-unpublished, 0 manual-review, 0 reject**; slug collisions vs live: **0**.
- Duplicate detection (`classifyPair`): vs Georgia **0**, Tennessee I-75 **0**, Kentucky **33**, Ohio **0**, Michigan **0**, Florida **0**, Indiana **0**, Alabama **0**, Tennessee I-65 **0**, live DB **33** low-confidence matches; in-file co-location pairs: **12**; in-batch slug duplicates: **0**.
  - All cross-batch/live matches are score-35 `brand-multi-exit` or shared-corporate-contact false positives (same Pilot/Love's/Speedco/Blue Beacon brand or shared CAT Scale/Speedco corporate phone+website at a **different city, exit and street address**). `assessExpansion` — the authoritative gate — returned **0 manual-review and 0 reject**, and there are **0 slug collisions**, so no real duplicate survives.
- Quality (`scoreCompleteness`): min 24, median 72, mean 61.5, max 76; labels: Incomplete 9, Needs work 3, Good 25. Low scorers are the held/thin rows (safety features, single-source holds); every published full-service stop scores Good.

## Existing-Tennessee duplicate protection

- Every candidate was compared (normalized name + city, plus `classifyPair` on name/address/phone/website/category/interstate/exit) against all **99 existing production Kentucky listings** (the I-75 East/Central-East Kentucky batch). This batch is the Western-Kentucky **I-24** corridor (Oak Grove/Hopkinsville/Cadiz/Eddyville/Paducah); the existing KY rows are I-75 (Lexington/Corbin/London/Florence), so there is no city, exit or address overlap.
- Rows dropped because they already exist in production Tennessee (exact/probable existing-TN duplicates; not re-added, production left unchanged): **0**.
- The Nashville Love's #429 (I-65 Trinity Ln, already live) and the Antioch/downtown facilities on the I-24/I-65/I-40 overlap were explicitly excluded rather than re-listed; the Clarksville truck cluster is actually in Oak Grove, KY (I-24 Exit 86, across the state line) and is out of scope for this TN batch.

## Known issues / limitations

- Some brand/official sites (Pilot/Flying J, Love's, TA/Petro, CAT Scale, TruckParkingClub, TDOT) rate-limit or block direct fetches; those facts were corroborated via 2+ independent directories and the affected fields left blank when unconfirmed.
- The KY I-24 corridor is rural Western Kentucky with truck-stop clusters concentrated at Oak Grove, Cadiz, Eddyville and Paducah; quality over quantity.

## Final recommendation

- Approved (Published = yes): **28** · Held (documented): **9** · Rejected in CSV: **0** (rejected candidates excluded pre-compilation — see sources report).
- Import parts: `i24-kentucky-batch-012-part1.csv`, `i24-kentucky-batch-012-part2.csv` (<=25 rows each).
- Nothing imported, published, merged, or deployed. Awaiting approval.
