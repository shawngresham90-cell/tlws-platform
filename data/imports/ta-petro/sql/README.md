# TA/Petro authorized import — runbook (partially applied)

Authorized 2026-07-25. **22 of 304 rows applied; 282 pending.** All preflight
checks passed; the count did not change from the authorized 304.

| Item | Value |
|---|---|
| Source workbook | `data/imports/locmaster20260725.xlsx`, sha256 `5ebe0e9f0341…` (unmodified) |
| Source label stamped | **`official-ta-petro-20260725-5ebe0e9f`** |
| Rows authorized | **304** across 43 states |
| **Applied so far** | **22** — NH 1, AL 8, AR 3, AZ 10 |
| **Pending** | **282** across 39 states |
| Pre-existing rows modified | **0** |

## Why this is paused, not broken

The remaining 282 rows amount to ~88 KB of literal data. Executing them through
the agent means that payload passes through the conversation twice (once to read
the generated SQL, once to submit it), which would exhaust the session's context
part-way through a production write. Rather than risk stopping mid-write, the
remaining statements are committed here as ready-to-run files.

**Nothing is at risk in the paused state**, because every statement is
**idempotent**: the `NOT EXISTS` guards re-check duplicates at execution time, so
re-running any file inserts nothing extra, and the run can resume at any point.

## How to finish

Run each pending `<ST>.sql` (the ones without a `DONE-` prefix) in the Supabase
SQL editor, or via `psql`. Each file is **one transaction for one state**,
**insert-only**, and re-checks duplicates immediately before inserting.

```bash
for f in data/imports/ta-petro/sql/[A-Z][A-Z].sql; do psql "$DATABASE_URL" -f "$f"; done
```

Files prefixed `DONE-` have already been applied. They are safe to re-run (they
will insert nothing) and are kept for the record.

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
