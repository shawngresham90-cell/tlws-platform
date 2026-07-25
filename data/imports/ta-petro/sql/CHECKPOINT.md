# TA/Petro import — durable checkpoint

**COMPLETE.** All 304 authorized rows applied and verified against the live
database. Read-only audit re-run after the final state; every number below is
a live query result, not a projection.

| Metric | Value |
|---|--:|
| Source label | `official-ta-petro-20260725-5ebe0e9f` |
| **Cumulative inserted** | **304 / 304** |
| Remaining rows | 0 |
| Live row total | **1,556** (= 1,252 + 304) |
| Unpublished | 304 / 304 |
| Missing coordinates | 0 |
| `geo` writes | 0 |
| Source-label count | 304 |
| Pre-existing rows | 1,252 (unchanged) |
| Pre-existing changed | 0 |
| Held / excluded-network inserted | 0 |
| `CAT Scale` asserted | 0 |
| Featured or indexable | 0 |
| Rolled back / quarantined states | 0 / none |
| Verified at | 2026-07-25, live read-only audit |

## Applied states — all 43 (requested = inserted, 0 skipped, 0 rolled back)

| ST | Rows | ST | Rows | ST | Rows | ST | Rows |
|---|--:|---|--:|---|--:|---|--:|
| AL | 8 | IL | 12 | ND | 5 | SC | 5 |
| AR | 3 | IN | 10 | NE | 3 | SD | 3 |
| AZ | 10 | KS | 10 | NH | 1 | TN | 2 |
| CA | 14 | KY | 3 | NJ | 4 | TX | 40 |
| CO | 9 | LA | 12 | NM | 9 | UT | 3 |
| CT | 3 | MI | 4 | NV | 10 | VA | 5 |
| FL | 5 | MN | 4 | NY | 7 | WA | 4 |
| GA | 8 | MO | 13 | OH | 14 | WI | 7 |
| IA | 6 | MS | 4 | OK | 7 | WV | 4 |
| ID | 2 | MT | 2 | OR | 6 | WY | 5 |
| | | NC | 3 | PA | 14 | | |
| | | | | RI | 1 | | |

**Total: 304**

States applied in this pass (24, 167 rows): MS 4, MT 2, NC 3, ND 5, NE 3,
NJ 4, NM 9, NV 10, NY 7, OH 14, OK 7, OR 6, PA 14, RI 1, SC 5, SD 3, TN 2,
TX 40, UT 3, VA 5, WA 4, WI 7, WV 4, WY 5.

## Execution record

Resumed from the verified 137/304 checkpoint (commit `16a1bce`). The live
checkpoint was queried read-only **before** any write and matched the expected
starting state exactly: 137 imported, 1,389 live, 1,252 pre-existing, 137/137
unpublished, 0 missing coordinates.

### Transport note

`DATABASE_URL` was **not present** in the execution environment, so the
documented `psql "$DATABASE_URL" -f RUN-ALL-PENDING.sql` invocation could not
run. The identical SQL was executed against the same live Postgres instance
through the project's authenticated Supabase SQL connection instead.

The substitution is transport-only. Every guarantee is encoded in the SQL
itself, not in `psql`:

- one `begin;` / `commit;` transaction per state, executed in manifest order;
- `ON_ERROR_STOP` semantics preserved — states were submitted in order and a
  raised exception would have rolled back that state and halted the run
  before any later state;
- the preflight gate ran first and passed (batch count within 137..304;
  pre-existing rows exactly 1,252);
- insert-only, dual-key duplicate re-check inside each transaction, and the
  `GET DIAGNOSTICS` count guard on every state.

No file in `data/imports/ta-petro/sql/` was modified to make this run; the
statements executed are byte-equivalent to the committed per-state files.

## Full 304-row audit — all 8 checks pass

| # | Check | Expected | Actual | Result |
|---|---|--:|--:|---|
| 1 | batch total | 304 | 304 | pass |
| 1 | unpublished | 304 | 304 | pass |
| 1 | missing coordinates | 0 | 0 | pass |
| 1 | `geo` writes | 0 | 0 | pass |
| 1 | source-label count | 304 | 304 | pass |
| 1 | `CAT Scale` asserted | 0 | 0 | pass |
| 1 | featured or indexable | 0 | 0 | pass |
| 2 | live total | 1,556 | 1,556 | pass |
| 2 | pre-existing rows | 1,252 | 1,252 | pass |
| 2 | pre-existing changed | 0 | 0 | pass |
| 3 | per-state reconciliation | 43 states ok | 43 ok, 0 mismatch | pass |
| 4 | expected vs inserted total | 304 = 304 | 304 = 304, 0 mismatched states | pass |
| 5 | duplicate canonical keys (whole live table) | 0 | 0 | pass |
| 5 | duplicate unique keys `type\|state\|city\|slug` | 0 | 0 | pass |
| 6 | blank name / city / address | 0 | 0 | pass |
| 6 | bad state / bad zip | 0 | 0 | pass |
| 6 | out-of-range coordinates | 0 | 0 | pass |
| 6 | wrong type / category | 0 | 0 | pass |
| 6 | blank slug / blank detail_slug | 0 | 0 | pass |
| 7 | held / excluded networks in batch | 0 | 0 | pass |
| 8 | rollback selection | 304 | 304 | pass |

`detail_slug` is populated on all 304 rows by the existing `set_detail_slug`
BEFORE INSERT trigger (audit 6 confirms zero blanks), so it was correctly never
supplied by the import.

## Held and excluded records — untouched

Audit 7 confirms **0** rows in the batch match Love's, Sapp Bros, Pilot,
Goasis or Thorntons. Audit 2 confirms **0** pre-existing rows were modified.
The Love's Florence correction, Sapp Bros, the Pilot-network file, the 6
Goasis/Thorntons held rows and the 37 manual-review rows are all unchanged.

## Publication status

All 304 rows are **unpublished** (`is_published`, `is_featured`,
`is_indexable` all false). Nothing was published and nothing was merged as
part of this pass — publication remains a separate, deliberate step.

## Rollback

The entire batch is still selectable by its source label and nothing else:

```sql
-- verify first (expect 304)
select count(*) from public.locations
where source = 'official-ta-petro-20260725-5ebe0e9f';

-- revert (do NOT run unless reverting)
begin;
delete from public.locations
where source = 'official-ta-petro-20260725-5ebe0e9f';
commit;
```

## Re-verification SQL

```sql
select upper(state), count(*) from public.locations
where source='official-ta-petro-20260725-5ebe0e9f' group by 1 order by 1;

select count(*) total,
  count(*) filter (where not is_published) unpublished,
  count(*) filter (where lat is null or lng is null) missing_coords,
  count(*) filter (where geo is not null) geo_writes
from public.locations where source='official-ta-petro-20260725-5ebe0e9f';

-- pre-existing untouched (expect 0)
select count(*) from public.locations
where source <> 'official-ta-petro-20260725-5ebe0e9f'
  and updated_at > '2026-07-25 00:00:00+00';
```

Every per-state file now carries the `DONE-` prefix. All files remain
idempotent — re-running any of them, or `RUN-ALL-PENDING.sql`, inserts nothing.
