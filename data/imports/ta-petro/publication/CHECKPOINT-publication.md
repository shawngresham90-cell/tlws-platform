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

Executed 2026-07-25 via the project's authenticated Supabase SQL connection.
Each state ran in its own transaction (one guarded `DO` block per state, one
call each) with a `GET DIAGNOSTICS ROW_COUNT = expected` guard. Every state's
guard passed on the first attempt; **zero exceptions, zero rollbacks, zero
quarantines, zero retries**. After each pass, a read-only verification confirmed
the running totals, invariants, per-state counts, and both row-digest
fingerprints.

| Pass | States | Rows | Cumulative published (incl. 10 canary) | Unpublished remaining | Result |
|--:|---|--:|--:|--:|---|
| 1 | AL, AR, AZ, CA, CO, CT | 46 | 56 | 248 | ✓ all guards passed |
| 2 | FL, GA, IA, ID, IL, IN, KS | 50 | 106 | 198 | ✓ all guards passed |
| 3 | KY, LA, MI, MN, MO, MS, MT, NC, ND, NE | 52 | 158 | 146 | ✓ all guards passed |
| 4 | NH, NJ, NM, NV, NY, OH | 43 | 201 | 103 | ✓ all guards passed |
| 5 | OK, OR, PA, RI, SC, SD, TN, UT, VA | 45 | 246 | 58 | ✓ all guards passed |
| 6 | WA, WI, WV, WY, TX | 58 | 304 | 0 | ✓ all guards passed |

At every pass boundary: live total stayed 1,556; pre-existing rows stayed 1,252
with 0 touched; indexable stayed 0; missing coords 0; geo writes 0; duplicate
detail_slug / unique keys 0; excluded-network published 0. The batch row-digest
(excluding only `is_published` + `updated_at`) held constant at
`c4931a4abcbf131ceeda27c203d0a121` and the pre-existing full digest (including
`is_published`) held constant at `214b7e0586bd5f641e8f5874f2de6b57` through all
six passes — proving no field other than `is_published` moved on any batch row,
and no pre-existing row changed at all.

Transaction independence: because each state was its own transaction, a failure
would have rolled back only that state and left the others intact. None failed.

## Final audit (live, read-only)

All 294 remaining rows published; the full batch is now live. Every target met:

| Check | Target | Actual |
|---|--:|--:|
| Live rows | 1,556 | 1,556 |
| TA/Petro batch | 304 | 304 |
| Published TA/Petro | 304 | 304 |
| Unpublished TA/Petro | 0 | 0 |
| Indexable TA/Petro | 0 | 0 |
| Featured TA/Petro | 0 | 0 |
| Missing coordinates (batch) | 0 | 0 |
| `geo` writes (batch) | 0 | 0 |
| Pre-existing rows | 1,252 | 1,252 |
| Pre-existing rows touched | 0 | 0 |
| Duplicate `detail_slug` (live) | 0 | 0 |
| Duplicate `type\|state\|city\|slug` | 0 | 0 |
| Excluded-network published | 0 | 0 |
| Blank name/slug/detail_slug (batch) | 0 | 0 |
| States fully published | 43 / 43 | 43 / 43 |
| Published rows with a valid detail-page slug | 304 | 304 |

Row-digest fingerprints, before publication vs. after:

| Fingerprint | Baseline | Final | Result |
|---|---|---|---|
| 304 batch rows, excl. `is_published` | `c4931a4abcbf131ceeda27c203d0a121` | `c4931a4abcbf131ceeda27c203d0a121` | identical |
| 1,252 pre-existing rows, **incl.** `is_published` | `214b7e0586bd5f641e8f5874f2de6b57` | `214b7e0586bd5f641e8f5874f2de6b57` | identical |

Only `is_published` changed, and only on batch rows. `is_indexable` was never
written. No insert, delete, schema, migration, trigger, policy, or
application-code change occurred. Held/excluded-network records (Love's, Sapp
Bros, Pilot, Goasis, Thorntons) and the 37 manual-review rows were untouched.

## Directory query paths (application contracts)

The published rows satisfy the filters the directory pages apply
(`is_published = true AND deleted_at IS NULL`), so on-demand ISR
(`revalidate = 300`, `dynamicParams` true) will render them without a redeploy:

- `/directory/location/<detail_slug>` — all 304 have a slug matching the app's
  `isValidDetailSlug` contract (`/^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/`).
- `/directory` and `/directory/truck-stops` — the 304 are all
  `category_slug = truck-stops`.
- `/directory/map` — all 304 have valid coordinates.
- `/directory/new-locations`, `/directory/recently-updated` — driven by
  publication/update recency.

Production reachability: the sandbox network policy blocks outbound requests to
`truckinglifewithshawn.com` (proxy returns 403 to CONNECT), so live pages could
not be fetched from here. The database query paths and application contracts are
verified above; a geographically diverse URL sample is in the PR for a human to
spot-check.
