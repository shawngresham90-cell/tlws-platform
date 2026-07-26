# Northeast MD/DE Tier-1 geocode + publish — checkpoint

Geocode and publish the eligible Tier-1 candidates from the merged
second-candidate manifest (`data/imports/northeast-prep/`). Writes only `lat`,
`lng`, `geocode_source`, `geocode_confidence`, `coord_verification_status`,
`last_geocoded_at`, and `is_published`, and only on the 28 documented Tier-1 ids.
`interstate`/`exit_number` were already populated (`I-95`) and were not touched;
`geo` and `is_indexable` were never written.

- **Project:** `tlws-platform` (`cgvxwvymkembftznhcdl`), Postgres 17.
- **Confidence rule (project's own):** `src/lib/directory/census-geocoder.ts` —
  a US Census **`Exact`** match, in-state, inside bounds → `high`; `Non_Exact`
  → `medium`; `No_Match` → reject. `PASS_THRESHOLD_METERS = 150` and the
  calibration measured Exact matches at 65–146 m from verified controls.
- **Coordinate source:** `data/geocoding/census/raw/GeocodeResults.csv`
  (US Census batch geocoder, `Public_AR_Current`) — verbatim. The four
  TA-colocated rows are additionally cross-checked against the operator master
  (`locmaster20260725.xlsx`, sha256 `5ebe0e9f…553303`); all agree < 500 m.

## Outcome — 14 published, 14 held/quarantined

| Disposition | Count |
|---|--:|
| Published (Census Exact, high; address agrees; not held-brand) | **14** |
| Held — hotel, no authoritative truck-parking evidence | 2 |
| Quarantined — held-network brand in name | 3 |
| Quarantined — Census `Non_Exact` (medium) | 7 |
| Quarantined — Census `No_Match` | 2 |

Details of every non-published row: `QUARANTINE.md`.

### Published (14) — DE 4, MD 10

| Name | Category | ST | lat, lng | Cross-check |
|---|---|---|---|---|
| 160 Driving Academy - Newark | cdl-schools | DE | 39.698089, -75.708292 | — |
| American Driver Training Academy | cdl-schools | DE | 39.705252, -75.539945 | — |
| Service Tire Truck Center (STTC) New Castle | tire-repair | DE | 39.663863, -75.614792 | — |
| REDDOT Truck Service Inc. | roadside-service | DE | 39.741768, -75.532929 | — |
| All-State Career School (Baltimore) | cdl-schools | MD | 39.263086, -76.542998 | — |
| Boss Truck Shop (Elkton) | tire-repair | MD | 39.635825, -75.806438 | — |
| Maryland Truck Tire Services Inc | tire-repair | MD | 39.152575, -76.801447 | — |
| TA Truck Service (Elkton) | tire-repair | MD | 39.645113, -75.797782 | master 171 m |
| Blue Beacon Truck Wash of Elkton | truck-washes | MD | 39.635829, -75.806449 | — |
| VIP Quality Express Truck Wash | truck-washes | MD | 39.163838, -76.769681 | — |
| Columbia Fleet Service, Inc. | roadside-service | MD | 39.161451, -76.781970 | — |
| CAT Scale at TA Baltimore | cat-scales | MD | 39.281166, -76.549108 | master 409 m |
| CAT Scale at TA Baltimore South Jessup | cat-scales | MD | 39.167518, -76.784088 | master 144 m |
| CAT Scale at TA Elkton | cat-scales | MD | 39.645113, -75.797782 | master 171 m |

All: `geocode_source='batch-csv'`, `geocode_confidence='high'`,
`coord_verification_status='machine-checked'`, `last_geocoded_at=now()`.

## Execution log (live, 2026-07-26) — six guarded transactions, all first-try

| Step | Guard | Result |
|---|---|---|
| GEOCODE DE | ROW_COUNT = 4, blank-only, id+state+source | passed |
| GEOCODE MD | ROW_COUNT = 10, blank-only | passed |
| CANARY DE (160 Academy) | ROW_COUNT = 1, coords required | passed |
| CANARY MD (Blue Beacon, CAT Scale TA Elkton) | ROW_COUNT = 2 | passed |
| REMAINING DE (3) | ROW_COUNT = 3 | passed |
| REMAINING MD (8) | ROW_COUNT = 8 | passed |

**Zero exceptions, zero rollbacks.** Canary (3 rows, both states, 3 categories:
cdl-schools + truck-washes + cat-scales) was verified through the directory query
contract (published, coordinates, `category_slug`, `interstate='I-95'`, unique
`detail_slug`) before the remaining 11 were published.

## Fingerprints — only authorized fields on the 28 moved

- 28-row digest **excluding** the authorized fields:
  `c423bc4e8c7c43b5d7d3e57f051852e4` — identical before and after (no
  non-authorized field on any candidate changed).
- Digest of all **1,528 non-candidate rows** (full jsonb):
  `12cf2d3364619341157596b47a8963b4` — identical before and after (nothing
  outside the 28 changed).

## Final audit (live, read-only)

| Check | Before | After |
|---|--:|--:|
| Live rows | 1,556 | 1,556 |
| Published | 1,023 | 1,037 (+14) |
| MD published | 3 | 13 (+10) |
| DE published | 0 | 4 (+4) |
| Rows with lat/lng | 392 | 406 (+14) |
| `geo` populated | 0 | 0 |
| `is_indexable` | 0 | 0 |
| `geocode_source='batch-csv'` | 3 | 17 (+14) |
| Quarantined rows published or coordinated | — | 0 |
| Held networks touched | — | 0 |

Coordinate-proximity check: the only sub-60 m pairs are legitimate colocations
(CAT Scale at TA Elkton ↔ TA Truck Service at 1400 Elkton Rd; Blue Beacon 225 ↔
Boss Truck Shop 227 Belle Hill Rd) — distinct businesses/services, no duplicate.

## Category & corridor impact

+14 published I-95 rows: tire-repair ×4, cat-scales ×3, cdl-schools ×3,
truck-washes ×2, roadside-service ×2. First published DE directory rows (4).
Populates the `tire-repair`, `truck-washes`, `cat-scales`, `roadside-service`,
and `cdl-schools` category pages along I-95 in MD/DE.

## Review URLs (sandbox egress blocked, 403 — manual check)

Detail pages `/directory/location/<detail_slug>` for each published row (e.g.
`…/blue-beacon-truck-wash-of-elkton-elkton-md`,
`…/cat-scale-at-ta-elkton-elkton-md`, `…/160-driving-academy-newark-newark-de`);
category pages `/directory/tire-repair`, `/directory/truck-washes`,
`/directory/cat-scales`, `/directory/roadside-service`, `/directory/cdl-schools`;
corridor `/directory/i95`.

## Artifacts

`manifest.json`, `expectations.json`, `GEOCODE.sql`, `CANARY-publish.sql`,
`PUBLISH-remaining.sql`, `ROLLBACK-geocode.sql`, `ROLLBACK-publish.sql`,
`AUDIT.sql`, `QUARANTINE.md`, and `scripts/test-northeast-tier1.ts`
(331 assertions).
