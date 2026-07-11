# Geocoding batch 001 — review (I-75 Georgia + Tennessee)

## Summary

- **Total listings audited:** 139 (GA 78, TN 61)
- **Coordinates already present in the live DB:** 0 of 139 (every listing needed geocoding)
- **High-confidence `ready` rows:** 45 after the final approval audit (GA 41, TN 4)
- **`manual-review` rows (medium 60 + low 19):** 79
- **`skip` rows (unresolved, no verifiable coordinates):** 12
- **Adversarial second-pass audit:** 55 rows re-verified (41 confirmed, 7 suspect → demoted, 7 wrong → corrected or dropped)

## Counts by category (ready / manual-review / skip)

| category | ready | manual-review | skip |
|---|---|---|---|
| cat-scales | 14 | 11 | 0 |
| hotels-truck-parking | 0 | 9 | 0 |
| parking | 0 | 5 | 3 |
| roadside-service | 0 | 4 | 1 |
| tire-repair | 3 | 16 | 3 |
| truck-stops | 23 | 27 | 3 |
| truck-washes | 1 | 5 | 1 |
| weigh-stations | 7 | 2 | 1 |

## How confidence was assigned

- **high → ready**: two independent sources agree within ~150 m for the exact
  street address (or one authoritative source publishing coordinates for that
  address), corridor bounds pass, and — for 55 audited rows — an independent
  second pass confirmed the point. Only these rows can be applied by the admin tool.
- **medium/low → manual-review**: single-source, interpolated, anchor-based, or
  city-centroid points. Never applied automatically.
- **unresolved → skip**: no verifiable source; coordinates left blank, never guessed.

## Same-address co-locations

43 rows share an address with a host property (CAT scales at truck stops,
Speedco/Truck Care at Love's, TA/Petro service bays). Co-located rows
intentionally carry the host property's point; a >150 m disagreement check ran
across every same-address group. Two flagged groups are explained below.

## Second-pass audit corrections worth knowing about

- **TA Cartersville scale/service rows** were originally placed ~55 m from
  Pilot #67 across the road; corrected to TA's own north-side point
  (34.273972, −84.807762) via TA's feed + house-number parity. All three TA
  rows now agree; TA↔Pilot separation is a plausible 141 m.
- **Love's Truck Care / Speedco #928 (Jackson GA)** is physically at
  **1111 Bucksnort Rd** (west of I-75), not at the Love's #307 lot listed as
  its address in the DB — the live listing's street address appears stale.
  Coordinates corrected; row left at manual-review. **Recommend fixing the
  address via the admin (as a separate, deliberate edit).**
- **Adel Truck Plaza** 800 m geocode conflict settled by the Huddle House
  (in-plaza restaurant) locator; corrected point double-sourced but row kept
  at manual-review because the first-pass value was refuted.
- **Love's #550 Valdosta** (+ its CAT row) corrected ~230 m SW to the OSM/
  campground-directory consensus (30.77424, −83.29849); manual-review.
- **Petro Knoxville host row** corrected to match its own service/scale
  siblings (35.873428, −84.235435); the ta-petro.com corporate locator
  actually reverses TA/Petro on Watt Rd and was outvoted by three
  independent signals.
- **TN Bradley NB "weigh station" (MM 23.5)** demoted to manual-review:
  USDOT NTAD classes it a parking/inspection pull-off, not a fixed scale
  complex — consider renaming the listing.
- **Days Inn Valdosta** demoted to manual-review (single parcel-level source).

## Known limitations

1. The research environment's egress proxy blocked all direct web fetching
   (Nominatim, Overpass, US Census geocoder, brand sites). Research relied on
   WebSearch plus public dataset mirrors (USDOT BTS NTAD, brand location
   exports, AllThePlaces, WhosOnFirst, POI Factory). This lowered achievable
   confidence for many TN rows (single-source ⇒ medium ⇒ manual-review).
2. Weigh-station "high" rows rest on the official USDOT NTAD per-direction
   dataset cross-checked against one independent dataset; the two sources may
   share survey provenance. Directional side checks (SB-west/NB-east) passed
   at all three GA mile-marker pairs.
3. No aerial/satellite verification was possible; "on the property" judgments
   come from multi-source agreement, parcel records, and in-property anchor
   businesses (e.g. Huddle House, Burger King, Popeyes datasets).
4. The Knoxville I-40/I-75 WB weigh station's direction is inferred by
   elimination (NTAD lacks a WB record); kept at manual-review.
5. Same-address >150 m residuals: Love's #307 vs Speedco #928 (stale address,
   see above) and the Love's #861 Loudon trio (~211 m spread, all
   manual-review).

## Recommended manual checks before applying manual-review rows

- Eyeball each `manual-review` point on satellite imagery (the tool links the
  source URL per row); promote to a fresh `ready` CSV only after that.
- Priority checks: Adel Truck Plaza, Speedco #928 (plus its address fix),
  ACT Truck Dalton (two same-address candidates 2.1 km apart),
  Kwik Fuel Clinton / Super 8 Powell / Circle K + Quality Inn Sweetwater
  (city-centroid fallbacks), Blue Beacon Knoxville vs Speedco #932 side-of-road,
  and every `low` row.
- The 12 `skip` rows need fresh research (7 TN listings had no reachable
  coordinate source; the Bradley SB weigh station likely does not exist as a
  separate facility — consider unpublishing or merging it).


## Final approval audit (third pass — all 48 ready rows)

Every ready row was re-verified by a third independent pass before staging.
**Decision: 45 approved to apply · 3 demoted to manual-review · 0 skipped.**

Demotions:
1. **GA DPS Weigh Station 1 (I-75 SB, Catoosa/Tunnel Hill)** and
2. **GA DPS Weigh Station 2 (I-75 NB, Catoosa)** — the audit discovered the
   two "cross-checking" weigh-station datasets are NOT independent (one is a
   decimal truncation of the other), and unlike the Forsyth/Valdosta pairs
   there is no OSM feature here to corroborate the side-of-road placement.
3. **TN Weigh Station I-40 EB MM 372 (Knox)** — facility and mile marker are
   official (THP), but the required south-side placement could not be
   independently confirmed (the dataset's WB row is a duplicate of the EB row).

The Forsyth and Valdosta weigh-station pairs stay approved: OSM features
independently confirm both position and side (13–120 m agreement).

## Staged apply files (approved rows only)

| file | rows |
|---|---|
| `i75-ga-tn-geocoding-batch-001-part1.csv` | 10 |
| `i75-ga-tn-geocoding-batch-001-part2.csv` | 10 |
| `i75-ga-tn-geocoding-batch-001-part3.csv` | 10 |
| `i75-ga-tn-geocoding-batch-001-part4.csv` | 15 |

Apply them in order at /admin/directory/geocoding (each file passes the
tool's validation with every row applicable); verify listings after each
part before uploading the next. The master CSV remains the full record —
its 45 ready rows are exactly the union of the four parts.

## How to apply this batch (exact steps)

1. Open **/admin/directory/geocoding** (admin login required).
2. Upload `data/geocoding/i75-ga-tn-geocoding-batch-001.csv` and click
   **Preview** — the server validates every row (listing IDs, identity
   cross-check, coordinate ranges, 0/0, US bounds, duplicates).
3. Review the preview. All 48 applicable rows are pre-selected; nothing
   medium/low/unresolved can be applied. Use **Download manual-review rows**
   to get the follow-up worklist.
4. Click **Review & apply…**, read the confirmation summary, then
   **Apply**. Each applied row writes a `location_history` record
   (source `geocoding`, old→new values, source URL) BEFORE the update.
5. Verify afterwards on /admin/directory (coordinates visible in the edit
   form) and via the production health check.

Nothing in this PR changes production data by itself — coordinates only land
when an admin performs the steps above.
