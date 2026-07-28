# NTAD canary — execution record (2026-07-28)

Executed under the owner's 2026-07-28 authorization for the exact five-row
insertion, unpublished records only. **5/5 states inserted, 0 quarantined,
zero guard failures on the executed run, rollback unused.**

## Owner click-through of record (recorded exactly)

On 2026-07-28 the owner manually opened and reviewed all five official
state-source links in `CANARY-EVIDENCE.md` and confirmed **the facility
identities and locations look correct**. The owner did **not** confirm
parking counts, coordinates, or overnight availability — those remain in
the evidence worksheet's NTAD-2019/UNKNOWN columns, and none of them was
written (all `parking_spaces` NULL, all `overnight_parking` false).

## Pre-write proofs (all seven requirements)

1. PR #205 open, draft, head `61d1cc8`, `mergeable_state: clean`, CI
   `verify` green.
2. NTAD ZIP SHA-256 re-verified:
   `d32ebfebb0b84f68057be9d949d9ef13db3da014647042c75329aaf12a762b42`.
3. Live absence proven for all five: 0 detail-slug hits, 0 normalized
   name+state hits, 0 base-name hits, 0 pins in the ±0.0015° box, 0 pins
   within ±0.01°, 0 existing `ntad-2019-v04` rows.
4. Conflict classes clear by the same queries: no operator row, held
   record, directional twin, or existing public facility anywhere near any
   candidate.
5. Pre-write counters: live **2,825** · published **2,454** · with-coords
   **1,968** · published-unmappable **514** · flags **0**. Full digest
   `8a463bce726468e391fdb823df2bf891` — byte-identical to the post-#317
   digest, which also proves the HOS Calculator work made **zero** database
   changes. Pilot scope `f42622d5…` (718) · TA scope `95229290…` (380) ·
   Love's scope `76ef6a8a…` (709, post-#317 value).
6. Value-matched rollback (`CANARY-ROLLBACK.sql`) committed at `61d1cc8`
   **before** execution. Unused.
7. This section is the click-through record (above).

## Execution event log — honest and complete

- **Attempt 1 (22:43 UTC): failed closed, zero rows written.** The staged
  INSERT omitted two NOT-NULL schema columns the preparation had not
  surfaced: `type` and `slug`. Postgres rejected the first row
  (`23502 null value in column "type"`), the DO block aborted its own
  transaction, and the multi-statement request stopped — confirmed by
  requery: `ntad-2019-v04` row count still 0. No guard was weakened.
- **Schema correction (read-only):** `information_schema` shows required
  no-default columns `type, name, state, city, slug, detail_slug`; existing
  public-facility rows use `type='parking'` and `slug` = kebab name (with
  `detail_slug` = slug + city + state). The five inserts were re-authored
  with exactly those two additional columns — no other change.
- **Attempt 2: 5/5 clean.** One guarded transaction per state
  (VT → ME → DE → CT → CA), each re-proving in-transaction: no same-slug
  row from another source (abort), no same-slug row from this source
  (skip = idempotent), empty ±0.0015° collision box (abort), and
  `ROW_COUNT = 1` (abort otherwise). All five committed on the first pass.
  `CANARY-INSERT.sql` in this package is the as-executed SQL.

## Per-state results

| State | Facility | Result |
|---|---|---|
| VT | Guilford Welcome Center (I-91 North) | INSERTED (unpublished) |
| ME | Kennebunk Service Plaza (I-95 Northbound) | INSERTED (unpublished) |
| DE | Smyrna Rest Area (US 13) | INSERTED (unpublished) |
| CT | Darien Service Plaza (I-95 Southbound) | INSERTED (unpublished) |
| CA | Gold Run Safety Roadside Rest Area (I-80 Eastbound) | INSERTED (unpublished) |

Quarantines: **none**. Held (never in SQL, unchanged): AL Grand Bay
Welcome Center, VT Guilford North Parking Area, ME Facility 9.

Fields written per row: `type='parking'`, `name`, `state`, `city`, `slug`,
`category_slug='parking'`, `detail_slug`, `lat`, `lng` (2019 NTAD
provenance stated in the description), `parking_spaces=NULL`,
`overnight_parking=false`, `is_published=false`, `source='ntad-2019-v04'`,
`description` (state-confirmed facts + source URLs + dates + the explicit
"count not yet confirmed" language; CA documents the 24-vs-7 conflict and
stores neither). `is_indexable`/`is_featured` were **not written** — their
NOT NULL DEFAULT false yielded the required false, verified post-insert.
No `geo` write. No enrichment after insertion.

## Post-write audit

- Counters: live **2,830** (+5) · published **2,454** (unchanged) ·
  with-coords **1,973** (+5) · published-unmappable **514** · flags **0**.
- **Byte-identity of all pre-existing rows PROVEN**: digest over every row
  where `source ≠ 'ntad-2019-v04'` = `8a463bce726468e391fdb823df2bf891`
  (2,825 rows) — identical to the pre-write full-table digest.
- Full-table digest after: `640482ae283d3445b88f8d32688cfce7` (2,830).
- Pilot scope byte-identical (`f42622d5…`, 718) · TA scope byte-identical
  (`95229290…`, 380). Love's / Pilot / TA / Truck Parking Club untouched.
- Exactly **5** `ntad-2019-v04` rows exist; 0 published, 0 indexable,
  0 featured, 0 with a parking count, 0 overnight-true.
- Exclusion proofs: public-directory-visible **0** (unpublished);
  map-visible **0** (map requires published); new/recent pages, sitemap and
  indexable structured data all key off `is_published`/`is_indexable` →
  **0**; trip-planner/last-stop eligible **0** (loader takes published rows
  and `hasConfirmedTruckParking` requires a positive count — these rows
  fail both independently).
- Duplicate detail_slugs platform-wide: **0**. Coordinate collisions within
  ±0.0015° of any package row: **0** (each row's box contains only itself).

## Rollback status

`CANARY-ROLLBACK.sql` committed pre-execution, **not executed**. Its
value-match conditions (slug + source + exact coords + unpublished + NULL
count) were re-checked against the inserted rows: every condition matches,
so it remains a valid one-step reversal for all five rows.

## Coverage movement at this step

Zero movement in published/mappable/recommendable coverage (by design —
rows are unpublished with NULL counts). Gate 5's pipeline state advances
from "sourced, package prepared" to "canary rows staged in the database,
unpublished," pending future enrichment + publication authorizations.
