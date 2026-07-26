# Nationwide audit and controlled publication — checkpoint

Audited all 519 unpublished rows in `public.locations` and published the 128
that meet the evidence standard. No rows were inserted. Only `lat`, `lng`,
`geocode_source`, `geocode_confidence`, `coord_verification_status`,
`last_geocoded_at`, and `is_published` were written, and only on those 128 ids.

- **Project:** `tlws-platform` (`cgvxwvymkembftznhcdl`), Postgres 17.
- **Baseline:** `main` @ `4a7d873`; production deploy `6a66126b` for that commit
  reached `ready` (plugin success, secret scan clean); live totals reconciled
  independently at 1,556 / 1,037 published / 519 unpublished / 406 coordinates /
  `geo` 0 / `is_indexable` 0. PR #186's merge did not rerun SQL — the post-merge
  counts were identical to the post-execution audit.
- **Evidence:** `data/geocoding/census/raw/GeocodeResults.csv` (US Census batch
  geocoder, `Public_AR_Current`), read verbatim. Confidence follows the
  project's own rule in `src/lib/directory/census-geocoder.ts`: an in-state
  `Exact` match is `high`; `Non_Exact` is `medium`; `No_Match` is rejected.
  `PASS_THRESHOLD_METERS = 150`, and the committed calibration measured `Exact`
  matches 65–146 m from verified controls.

## Result

| | |
|---|--:|
| Unpublished rows audited | 519 |
| Approved | **128** |
| Published | **128** |
| Held / quarantined / unsupported | 391 |
| Rows inserted | **0** |
| Guard failures / rollbacks | **0** |

Full class-by-class reconciliation: `ACCOUNTING.md` (sums to exactly 519).
Every non-approved row is classified; nothing was silently discarded.

### Published by state (128)

OH 23 · NC 19 · TN 15 · GA 14 · KY 14 · FL 13 · SC 8 · IN 7 · AL 5 · AR 5 · VA 5

### Published by category (128)

truck-stops 32 · parking 29 · tire-repair 18 · hotels-truck-parking 15 ·
truck-washes 12 · roadside-service 10 · cat-scales 6 · cdl-schools 6

## Execution log (live, 2026-07-26) — 32 guarded transactions, all first-try

| Step | Transactions | Rows | Result |
|---|--:|--:|---|
| GEOCODE (one per state) | 11 | 128 | all guards passed |
| CANARY publish (one per state) | 10 | 10 | all guards passed |
| BATCH publish (one per state) | 11 | 118 | all guards passed |

**Zero exceptions, zero rollbacks.** Order was geocode → audit → canary →
audit → batches, per the milestone. Every block was `ROW_COUNT`-guarded with
`RAISE EXCEPTION` on mismatch (auto-rollback), blank-only for geocoding
(`lat IS NULL AND lng IS NULL`) and coordinate-required for publication
(`lat IS NOT NULL AND lng IS NOT NULL`), scoped by exact id **and** state.

### Canary (10) — 10 states, 8 categories

FL tire-repair · AL truck-washes · AR roadside-service · GA cat-scales ·
NC cdl-schools · IN parking · KY truck-stops · OH hotels-truck-parking ·
SC cat-scales · TN hotels-truck-parking. Verified against the directory query
contract (published, coordinates present, valid `category_slug`, unique
`detail_slug`) before any batch ran; published total moved by exactly +10.

## Fingerprints and invariants

| Check | Before | After |
|---|--:|--:|
| Total rows | 1,556 | 1,556 |
| Published | 1,037 | **1,165** (+128) |
| Unpublished | 519 | **391** (−128) |
| Rows with coordinates | 406 | **534** (+128) |
| `geo` populated | 0 | **0** |
| `is_indexable` | 0 | **0** |
| Duplicate `detail_slug` / composite key | 0 / 0 | **0 / 0** |
| Published-set digest (post-geocode, pre-publish) | `0f1d8000…` | `0f1d8000…` |

The digest of the entire published set was **byte-identical** before and after
the geocoding stage, proving no already-published record was touched while
coordinates were written. `geo` was never written (no trigger derives it —
`set_detail_slug` is `BEFORE INSERT` only and `set_updated_at` is the sole
`BEFORE UPDATE` trigger, which deterministically stamps `updated_at`; that is
the only derived field this run caused to change, and it is documented here).

## Coordinate-proximity findings (all legitimate colocations)

Eleven sub-60 m pairs exist among coordinate-bearing rows. Every one is a
distinct *service* sharing its host truck stop's address — never two rows
describing the same business:

| Pair | Distance |
|---|--:|
| Truck Wash at Jack's Truck Stop ↔ Jack's Truck Stop (Cullman AL) | 0 m |
| CAT Scale at TA Vero Beach ↔ TA Vero Beach #197 (FL) | 0 m |
| CAT Scale at Petro Kingsland ↔ Petro Stopping Center #344 (GA) | 0 m |
| CAT Scale at TA Savannah ↔ TA Savannah #177 (Richmond Hill GA) | 0 m |
| C-R Road Service ↔ C-R Road Service Truck & Trailer Wash (Lumberton NC) | 0 m |
| Kenly 95 Truck Service Center ↔ Petro Kenly 95 #395 (NC) | 0 m |
| CAT Scale at Petro Florence ↔ Petro/TA Florence #195 (SC) | 0 m |
| CAT Scale at TA Manning ↔ TA Manning #179 (SC) | 0 m |
| CAT Scale at TA Express Stony Creek ↔ TA Express Stony Creek (VA) | 0 m |
| CAT Scale at TA Elkton ↔ TA Truck Service (Elkton MD, prior milestone) | 0 m |
| Boss Truck Shop ↔ Blue Beacon (225/227 Belle Hill Rd, Elkton MD, prior) | 1 m |

## Duplicate found and excluded

`74398e08` **TA Jacksonville South #248** (Saint Johns FL, *1650 County Road
210 W*) duplicates the already-published `f3ec3f7f` **TA Jacksonville South**
(Jacksonville FL, *1650 C.R. 210 West*). It was excluded. It was independently
filtered by the Census gate as well (`Non_Exact`), so it never reached a write.

## Held-network integrity

101 unpublished rows match the held-brand pattern and none were published,
geocoded, or otherwise touched. One held-flagged row (`44f54856` S & B Truck
Wash, Cartersville GA) already carried coordinates from a pre-2026-07-11 import;
it has `geocode_source = NULL`, was not written by this run, and remains
unpublished.

**Finding (no action taken):** two rows published by the *previous* milestone
(PR #186) — `84a7fdb0` Boss Truck Shop (Elkton) and `fdc35482` Blue Beacon Truck
Wash of Elkton — carry descriptions that name the neighbouring Flying J purely
as a wayfinding landmark. Both are independent businesses, not held-network
locations. They are currently-published records that this milestone is not
authorized to modify, so they were left untouched and are recorded here for a
future editorial decision.

## Artifacts

`manifest.json` (128 approved rows with per-row Census evidence) ·
`expectations.json` · `ACCOUNTING.md` + `ACCOUNTING.sql` (519-row
reconciliation) · `QUARANTINE.md` · `GEOCODE.sql` · `CANARY-publish.sql` ·
`PUBLISH-remaining.sql` · `ROLLBACK-geocode.sql` · `ROLLBACK-publish.sql` ·
`AUDIT.sql` · `scripts/test-nationwide-audit.ts` (2,514 assertions).

## Rollback

Prepared and validated **before** any write. `ROLLBACK-geocode.sql` clears only
the six geocode fields, matched on id **and** the exact coordinate this run
wrote, so a later correction can never be erased. `ROLLBACK-publish.sql`
reverts `is_published` for exactly this run's 128 ids. Neither was needed.

## Review URLs (sandbox egress is blocked, HTTP 403 — for manual review)

Corridors `/directory/i75`, `/directory/i40`, `/directory/i95`, `/directory/i65`;
categories `/directory/tire-repair`, `/directory/truck-washes`,
`/directory/roadside-service`, `/directory/parking`, `/directory/cat-scales`,
`/directory/cdl-schools`, `/directory/truck-stops`,
`/directory/hotels-truck-parking`. A diverse detail-page sample is listed in
the pull request.
