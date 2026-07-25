# TA/Petro import — durable checkpoint

Read-only verified. Update after every pass.

| Metric | Value |
|---|--:|
| Source label | `official-ta-petro-20260725-5ebe0e9f` |
| **Cumulative inserted** | **137 / 304** |
| Remaining rows | 167 across 24 states |
| Live row total | 1,389 (= 1,252 + 137) |
| Unpublished | 137 / 137 |
| Missing coordinates | 0 |
| `geo` writes | 0 |
| Source-label count | 137 |
| Pre-existing rows | 1,252 (unchanged) |
| Pre-existing changed | 0 |
| Held / excluded-network inserted | 0 |
| Rolled back / quarantined states | 0 / none |

## Completed states (requested = inserted, 0 skipped, 0 rolled back)

| ST | Rows |
|---|--:|
| AL | 8 |
| AR | 3 |
| AZ | 10 |
| CA | 14 |
| CO | 9 |
| CT | 3 |
| FL | 5 |
| GA | 8 |
| IA | 6 |
| ID | 2 |
| IL | 12 |
| IN | 10 |
| KS | 10 |
| KY | 3 |
| LA | 12 |
| MI | 4 |
| MN | 4 |
| MO | 13 |
| NH | 1 |

## Remaining states

| ST | Rows |
|---|--:|
| MS | 4 |
| MT | 2 |
| NC | 3 |
| ND | 5 |
| NE | 3 |
| NJ | 4 |
| NM | 9 |
| NV | 10 |
| NY | 7 |
| OH | 14 |
| OK | 7 |
| OR | 6 |
| PA | 14 |
| RI | 1 |
| SC | 5 |
| SD | 3 |
| TN | 2 |
| TX | 40 |
| UT | 3 |
| VA | 5 |
| WA | 4 |
| WI | 7 |
| WV | 4 |
| WY | 5 |

**Remaining total: 167**

## How to resume

Run the pending per-state files in this directory (those without a `DONE-`
prefix). Each is one transaction, insert-only, with the dual-key duplicate
re-check and a `GET DIAGNOSTICS` count guard that raises and rolls back that
state on any mismatch. Every file is **idempotent** — re-running a completed
state inserts nothing.

```bash
for f in data/imports/ta-petro/sql/[A-Z][A-Z].sql; do psql "$DATABASE_URL" -f "$f"; done
```

## Verification SQL

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
