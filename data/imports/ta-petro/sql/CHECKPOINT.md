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

## How to finish — one command

No database connection is configured in the agent environment (no `DATABASE_URL`,
`POSTGRES_URL`, `SUPABASE_DB_URL`, service-role key, `PG*` vars, `.pgpass` or
`.pg_service.conf` — only the public `NEXT_PUBLIC_SUPABASE_ANON_KEY`, which
cannot write through RLS). So the remaining work ships as a single runner.

**Configure `DATABASE_URL` securely** (shell export from a secret manager, or a
`.pgpass` entry — never committed, never echoed), then run:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f data/imports/ta-petro/sql/RUN-ALL-PENDING.sql
```

`RUN-ALL-PENDING.sql` contains, in order: a preflight gate, all **24** pending
states (one guarded transaction each, 167 rows), and the complete **304-row
audit** (8 checks). `ON_ERROR_STOP=1` means the first failing state rolls back
and nothing after it runs.

Individual per-state files remain available; those already applied carry a
`DONE-` prefix. Every file is **idempotent** — re-running inserts nothing.

### Guards in every state block (statically verified)

| Property | Count in runner |
|---|--:|
| `begin;` / one transaction per state | 24 |
| `insert into public.locations` | 24 |
| `raise exception` (24 state count guards + 2 preflight) | 26 |
| `not exists` dual-key duplicate re-checks (2 per state) | 48 |
| Unpublished flag sets | 24 |
| `update` / upsert / `merge` / `truncate` / `alter` | **0** |

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
