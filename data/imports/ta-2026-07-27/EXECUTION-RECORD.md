# TA / Petro / TA Express enrichment — execution record, 2026-07-27

Authorized by Shawn on 2026-07-27, conditional on the official artifact
verifying against sha256 `a0c612f0426d141c481f84aae59dc15a0204617183bbf9c0866bfbb726ed63f7`.
The artifact verified exactly, is committed as
`data/sources/ta-master/2026-07-27/locmaster20260727.xlsx`, and the
authorization covered **only** the 10-state canary and the 38 address-anchored
blank-only enrichments. Corrections A/B, the Ashland/Richmond HOLD rows,
publication changes, inserts, deletes and PR #195's merge remained
**not authorized** and were not performed.

## Outcome

| | Count |
|---|--:|
| Rows authorized (address-anchored, blank-only) | 38 |
| **Rows applied** | **37** |
| Coordinate fills applied (24 `lat+lng` + 2 `lat+lng+spaces`) | 26 |
| Space-count fills applied (11 spaces-only + 2 with coordinates) | 13 |
| **Quarantined** | **1** — site 0269 TA Knoxville West |
| Rows written outside the authorization | 0 (proven — see audits) |

## Two aborted attempts before the successful run (nothing written)

1. `coord_verification_status = 'operator-authoritative'` violated the schema
   CHECK `locations_coord_verification_status_check` (allowed: `unverified`,
   `machine-checked`, `manually-verified`, `disputed`). The transaction
   aborted atomically; verified zero writes (tagged 0, counters at baseline).
   Fixed to `machine-checked` — the coordinates come verbatim from the
   checksummed official master and passed the automated state-bounds and
   collision guards.
2. `geocode_source = 'ta-master-2026-07-27'` violated
   `locations_geocode_source_check` (allowed: `import`, `batch-csv`,
   `interpolation`, `external-api`, `manual`). Also aborted atomically with
   zero writes. Fixed to `batch-csv` — the value every prior committed-file
   enrichment wrote. Because the value is shared, package membership is
   tracked by the explicit id lists in `ENRICHMENT-PLAN.csv` / `canary.json`,
   and `ROLLBACK.sql` was regenerated as per-row, id-scoped, value-matched
   statements. The same latent bug was fixed in the unexecuted Pilot and
   Love's packages, whose stale tag-scoped de-enrich blocks are now hard-stop
   stubs pending regeneration.

## Execution sequence

1. **Canary** (10 rows, 10 states: MD NC GA FL AR SC VA TN IN KY) — committed
   in one guarded transaction. Audit: all 10 rows matched staged values
   server-side; `with_coords` 534→538; `published_unmappable` 635→631;
   `batch-csv` 145→149; control digest, scope id digest, both imported
   digests and the in-scope overnight count (30) unchanged. **Every canary
   guard and fingerprint passed exactly**, satisfying the continuation
   condition.
2. **Remainder** (28 rows, 12 states), one transaction per state:
   AL(2) AR(3) FL(3) GA(2) IN(4) KY(1) MD(2) MI(2) NC(1) OH(2) SC(1) —
   all committed. **TN(5) failed its collision guard** ("2 staged
   coordinate(s) collide with a published pin") and rolled back atomically.
3. **TN quarantine + re-run**: the collision is site 0269 TA Knoxville West
   (`cd4783d1-b67c-4c09-b056-6a72f5606229`), whose staged pin
   35.8731 / −84.2379 exactly matches two published records of the **same
   physical site** — "CAT Scale — TA Knoxville West #269, Knoxville (Watt
   Road)" and "TA Truck Service - TA Knoxville West" (both `csv-import`).
   The evidence says the coordinate is correct, but admitting it would mean
   carving a category exception into the collision guard, and the standing
   instruction is **do not weaken the coordinate-collision guard**. The row
   was quarantined; TN re-ran with the 4 independently safe rows
   (0245, 0287, 0312, 0544) and committed. Site 0269 was proven untouched
   post-run (`lat` null, no geocode metadata, pre-existing space count
   intact).

## Post-execution audit (all measured, read-only)

- All 37 applied rows match their staged values exactly (id + name + value
  match, server-side), remain published, and none is featured or indexable.
- Quarantined 0269: untouched — `true` on the lat-null/no-metadata probe.
- Control digest (1,161 out-of-scope rows): `64d573283c8c0e35bd39c73bb63819d3`
  — **byte-identical to the pre-execution baseline**, proving every row
  outside the TA-network scope is unchanged.
- TA scope: 395 rows, id digest `52d4c84e71b50adcecc2956a51c58274` unchanged
  (no inserts, no deletes).
- Imported rows: name+state digest `e7843f7412c831ca5eb0687b37ab6018` and
  value digest `2ac6c65968f6da9013ee0896b377003b` unchanged — no imported row
  was touched.
- Directory counters: live 1,556 / published 1,165 / featured 0 / indexable 0
  / soft-deleted 0 — all unchanged. `with_coords` 534→**560** (+26);
  `published_unmappable` 635→**609** (−26); `geocode_source='batch-csv'`
  145→**171** (+26).
- In-scope `overnight_parking=true` count: 30, unchanged — no overnight claim
  was invented (no statement writes the field).
- Same-brand published pin proximity (§6): 5 pairs, **none involving a row
  enriched today** — the known TA Atlanta South duplicate pair (Correction A,
  held) and four pre-existing truck-stop ↔ same-site service-record
  co-locations (Atlanta ×2, Cartersville, Caryville). Zero new collisions
  introduced.
- Goasis / Thorntons rows in scope: 0 (held brands, untouched). Deleted in
  scope: 0.

## Gate movement

- **4a directory coverage: 347 of 348** — unchanged; closes only with
  Correction B (site 0393 Petro Florence mislabeled "Love's Travel Stop
  #420"), which is not authorized.
- **4b route-usable: 306 → 343 of 347** (measured 344 route-usable rows =
  343 sites + the Atlanta duplicate row).

## The four positive-parking official sites still not route-usable

| Site ID | Official name | Spaces | Why it remains unresolved |
|---|---|--:|---|
| 0001 | TA Ashland (100 N Carter Rd, Ashland VA) | 183 | Its candidate row is name-anchored only (HOLD), unpublished and blank; identity verification and a publication decision are separate, ungiven authorizations |
| 0142 | TA Richmond (10134 Lewistown Rd, Ashland VA) | 317 | Same HOLD pair — two official sites share the town and zip; writing either without verification risks crossing them |
| 0393 | Petro Florence (3001 TV Rd, Florence SC) | 210 | Its production row is mislabeled "Love's Travel Stop #420" and unpublished; relabeling is Correction B (not authorized), publication a further decision |
| 0269 | TA Knoxville West (Watt Road, Knoxville TN) | 176* | Quarantined this run: staged pin exactly matches the site's own published CAT-scale / truck-service records; applying it requires a decision on same-site service-record collisions, and the collision guard was not weakened |

\* 0269's published page already shows its space count (176 pre-existing);
only the map pin is missing.

---

# Closeout addendum — 2026-07-27, separate authorization

A tightly scoped closeout of the four gaps ran the same day (see
`CLOSEOUT.sql`, `CLOSEOUT-ROLLBACK.sql`, `CLOSEOUT-MANIFEST.md`):

- **Site 0269 — APPLIED.** Coordinate 35.8731/−84.2379 written blank-only
  under a one-record, exact-ID same-site exception naming its two published
  companion records (CAT scale + truck service, both re-proven in-transaction
  to be companion categories at exactly the official coordinate). The global
  collision guard is unmodified; a third pin in the radius still aborts.
  Space count 176 and publication state untouched by construction.
- **Correction A — APPLIED.** `33e41d22…` "TA Atlanta South #268" unpublished
  after in-transaction proof that the imported row of record `15de1227…`
  (official site 0268) is published and mappable. Nothing deleted; exactly
  one published Atlanta South pin remains.
- **Sites 0001/0142 — STILL QUARANTINED.** Exact-address verification is
  impossible today: both candidate rows carry `address = NULL`, and
  city/zip/name anchors were forbidden. No write.
- **Site 0393 — STILL QUARANTINED.** Both operator exports confirm the
  cross-brand proof, but the §B collision precondition failed its dry-run:
  published pin `33dd16f0…` "Blue Beacon Truck Wash #51 - Florence"
  (3003 TV Rd) sits inside the collision box of the official coordinate.
  The granted exception covered only site 0269's two named companions, so
  no relabel and no publication occurred.

Post-closeout, all measured: route-usable **344 of 347 by distinct official
Site ID** (published truck-stop pin collisions in scope: 0); published
1165→1164; with_coords 560→561; published-unmappable 609→608; control digest,
scope digests, imported digests and the overnight count unchanged. The three
remaining gaps are sites 0001, 0142 (no address anchor on either candidate
row) and 0393 (Blue Beacon collision — unblocked by a one-record exception
analogous to 0269's, if authorized).
