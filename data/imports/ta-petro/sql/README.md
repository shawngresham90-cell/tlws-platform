# TA/Petro authorized import — runbook (COMPLETE)

Authorized 2026-07-25. **All 304 rows applied and verified.** All preflight
checks passed; the count never changed from the authorized 304.

| Item | Value |
|---|---|
| Source workbook | `data/imports/locmaster20260725.xlsx`, sha256 `5ebe0e9f0341…` (unmodified) |
| Source label stamped | **`official-ta-petro-20260725-5ebe0e9f`** |
| Rows authorized | **304** across 43 states |
| **Applied** | **304 / 304** across 43 states |
| **Pending** | **0** |
| Live row total | **1,556** (= 1,252 + 304) |
| Published | **0** — every imported row is unpublished |
| Pre-existing rows modified | **0** |

See `CHECKPOINT.md` for the full 8-check, 304-row audit and the per-state
reconciliation. All 43 per-state files now carry the `DONE-` prefix.

## Re-running

Every file is **idempotent**: the `NOT EXISTS` guards re-check duplicates at
execution time, so re-running any `DONE-<ST>.sql` — or `RUN-ALL-PENDING.sql` —
inserts nothing. Each file is **one transaction for one state**, **insert-only**,
and re-checks duplicates immediately before inserting.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f data/imports/ta-petro/sql/RUN-ALL-PENDING.sql
```

Note: the final 167 rows were applied without `DATABASE_URL` present in the
execution environment. The identical SQL ran against the same live Postgres
instance through the project's authenticated Supabase SQL connection, with the
preflight gate, per-state transactions and all count guards preserved. See the
transport note in `CHECKPOINT.md`.

## Guarantees encoded in every file

- **Insert-only.** No `UPDATE` appears anywhere; no existing row can be altered.
- **Duplicate re-check at execution time**, on two independent keys:
  the canonical `importDupKey` (normalized name | city | state) and the live
  unique key `(type, state, city, slug)`. A row that has become a duplicate is
  **skipped**, never merged or overwritten.
- **`on conflict do nothing`** as a final backstop.
- **`geo` is never written.** `is_published`, `is_featured` and `is_indexable`
  are `false` on every row — imports land unpublished for review.
- **Operator coordinates preserved** exactly as supplied; never geocoded.
- **`CAT Scale` never asserted** — the workbook only states a generic
  `Weigh Scale`, recorded in the description as "brand unconfirmed".
- `detail_slug` is populated by the existing `set_detail_slug` BEFORE INSERT
  trigger, so it is deliberately not supplied.

## Verification after finishing

```sql
-- per-state counts (expect the manifest's row counts)
select upper(state), count(*) from public.locations
where source='official-ta-petro-20260725-5ebe0e9f' group by 1 order by 1;

-- expect: 304 / 304 / 0 / 0 / 0
select count(*) total,
       count(*) filter (where lat is not null and lng is not null) with_coords,
       count(*) filter (where is_published) published,
       count(*) filter (where geo is not null) geo_written,
       count(*) filter (where amenities::text like '%CAT Scale%') catscale
from public.locations where source='official-ta-petro-20260725-5ebe0e9f';

-- pre-existing rows untouched (expect 0)
select count(*) from public.locations
where source <> 'official-ta-petro-20260725-5ebe0e9f' and updated_at > '2026-07-25 00:00:00+00';
```

## Rollback

`00-rollback.sql`. Before the run **0** rows carried this source label
(verified), so `where source='official-ta-petro-20260725-5ebe0e9f'` selects
exactly the rows this batch inserted and nothing else.

## Explicitly excluded from this operation

The 6 Goasis/Thorntons rows, the 37 manual-review rows, the 7 existing matches,
the Love's #420 Florence correction, Sapp Bros, and the Pilot-network file. None
of them appear in any file here.
