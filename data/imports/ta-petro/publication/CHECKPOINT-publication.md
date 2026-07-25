# TA/Petro full publication — durable checkpoint

Publishing the remaining **294** unpublished rows of the verified 304-row
TA/Petro batch, in ~6 controlled passes. Only `is_published` is written
(`false → true`). `is_indexable` is never changed. No insert, delete, schema,
migration, trigger, policy, or application-code change. The original 1,252 rows
and all held/excluded-network records are out of scope and untouched.

- **Source label:** `official-ta-petro-20260725-5ebe0e9f` (from `../sql/CHECKPOINT.md`)
- **Project:** `tlws-platform` (`cgvxwvymkembftznhcdl`), Postgres 17, RLS-locked
- **Transport:** `DATABASE_URL` is absent in this environment; the identical SQL
  is executed against the same live Postgres through the project's authenticated
  Supabase SQL connection. Every guarantee is in the SQL (exact IDs, source-label
  scope, `is_published=false` precondition, `GET DIAGNOSTICS` row-count guard,
  auto-rollback on mismatch), not in the transport.

## Starting state (verified live, read-only)

| Metric | Value |
|---|--:|
| Live rows | 1,556 |
| Batch total | 304 |
| Canary already published | 10 |
| Remaining unpublished | 294 |
| Batch indexable | 0 |
| Pre-existing rows | 1,252 (unchanged) |

## Manifest — statically proven exact

`manifest-294.json` holds the exact 294 IDs grouped by state, plus the 10
already-published canary IDs and the per-pass / per-state expected counts. It was
generated from a live read-only query and then proven against the database:

| Check | Expected | Actual |
|---|--:|--:|
| Manifest rows / distinct | 294 / 294 | 294 / 294 |
| In the 304 batch (by source label) | 294 | 294 |
| Currently unpublished | 294 | 294 |
| Manifest IDs not in batch | 0 | 0 |
| Live unpublished rows missing from manifest | 0 | 0 |
| Manifest IDs already published | 0 | 0 |

The manifest is a perfect bijection with the live set of remaining unpublished
batch rows. All 294 also pass the eligibility predicate used at selection:
non-blank name/slug/city/state/detail_slug, coordinates present and in CONUS
range, and 0 matches against Love's / Sapp Bros / Pilot / Flying J / Goasis /
Thorntons.

## Pass plan (states kept whole; each state its own guarded transaction)

| Pass | States | Rows |
|--:|---|--:|
| 1 | AL, AR, AZ, CA, CO, CT | 46 |
| 2 | FL, GA, IA, ID, IL, IN, KS | 50 |
| 3 | KY, LA, MI, MN, MO, MS, MT, NC, ND, NE | 52 |
| 4 | NH, NJ, NM, NV, NY, OH | 43 |
| 5 | OK, OR, PA, RI, SC, SD, TN, UT, VA | 45 |
| 6 | WA, WI, WV, WY, TX | 58 |
| **Total** | **43 states** | **294** |

## Artifacts

| File | Purpose |
|---|---|
| `manifest-294.json` | Exact 294 IDs by state, pass plan, expected counts, canary-10 IDs |
| `PUBLISH-remaining-294.sql` | Per-state guarded publication blocks, grouped by pass |
| `ROLLBACK-per-pass.sql` | Per-pass, per-state rollback (revert a chosen pass) |
| `ROLLBACK-full-294.sql` | Single-statement revert of all 294 (leaves the 10 canary rows alone) |
| `AUDIT.sql` | Read-only full-batch audit + per-state reconciliation |
| `CANARY-10.md`, `PUBLISH-canary-10.sql`, `ROLLBACK-canary-10.sql` | The prior canary record (unchanged) |

## Execution log

_Populated during Phase 3. Each state runs in its own transaction with a
`ROW_COUNT = expected` guard; a mismatch raises and rolls back that state only._

<!-- EXECUTION_LOG -->

## Final audit

_Populated after all passes complete._

<!-- FINAL_AUDIT -->
