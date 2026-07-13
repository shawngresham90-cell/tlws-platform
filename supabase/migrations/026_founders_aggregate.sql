-- 026: Founders Wall — aggregate campaign totals + privacy-first amounts.
--
-- ADDITIVE and REVERSIBLE. Committed but NOT applied to production; apply only
-- after explicit approval (see docs/founders-wall-source-audit.md).
--
-- What this does:
--   1. Makes founders.amount_cents NULLABLE — individual contribution amounts
--      become PRIVATE/optional and are never required. They are not summed to
--      produce the public total, not distributed across founders, and never
--      exposed in the UI (the reader does not select the column).
--   2. Adds founders.position — 1-based recognition order within a tier, so the
--      wall renders in the exact order shown on the authoritative screenshots.
--   3. Adds a singleton campaign_settings table holding the AGGREGATE campaign
--      figures (goal + raised) independently of any per-founder amount.
--   4. Replaces campaign_progress so `raised_cents` reads the aggregate override,
--      `founder_count` derives from the count of PUBLIC founder records, and
--      `remaining_cents` / `pct_to_goal` are calculated from goal vs. raised.
--
-- Public aggregate figures (confirmed by the site owner):
--   goal   = $12,000  = 1200000 cents
--   raised = $7,100   =  710000 cents   (stored as an override, NOT a sum)
--   remaining = $4,900 (derived: goal − raised)

-- 1. Per-founder amounts become private/optional -------------------------------
alter table public.founders alter column amount_cents drop not null;
-- The existing CHECK (amount_cents > 0) still holds for non-null values; a NULL
-- amount passes the check (unknown), so no data is invalidated.

-- 2. Wall recognition order ----------------------------------------------------
alter table public.founders add column if not exists position int;
comment on column public.founders.position is
  '1-based recognition order within a tier, as shown on the Founders Wall. Null sorts last.';

-- 3. Aggregate campaign settings (singleton) -----------------------------------
create table if not exists public.campaign_settings (
  -- Singleton: the primary key is forced to TRUE so only one row can ever exist.
  id boolean primary key default true check (id),
  goal_cents bigint not null default 1200000 check (goal_cents >= 0),
  -- When set, this is THE public "raised" figure — an aggregate total that is
  -- independent of individual founder amounts. Null falls back to sum(amount_cents).
  raised_cents_override bigint check (raised_cents_override is null or raised_cents_override >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.campaign_settings is
  'Singleton holding aggregate campaign figures (goal + raised override) stored independently of per-founder amounts.';

insert into public.campaign_settings (id, goal_cents, raised_cents_override)
values (true, 1200000, 710000)
on conflict (id) do update
  set goal_cents = excluded.goal_cents,
      raised_cents_override = excluded.raised_cents_override,
      updated_at = now();

-- campaign_settings holds only PUBLIC aggregate figures (no PII, no per-founder
-- amounts), so anon may read it. No anon writes (belt-and-suspenders: RLS on,
-- select-only grant; writes go through the service role only).
alter table public.campaign_settings enable row level security;
drop policy if exists anon_read_campaign_settings on public.campaign_settings;
create policy anon_read_campaign_settings on public.campaign_settings
  for select to anon using (true);
grant select on public.campaign_settings to anon;

-- 4. Aggregate-aware progress view --------------------------------------------
-- security_invoker keeps RLS in effect for the querying role. `agg` always
-- returns exactly one row (aggregate, no GROUP BY); scalar sub-selects on the
-- settings singleton fall back to defaults when the row is absent, so the view
-- always yields exactly one row even before the settings row exists.
--
-- IMPORTANT: `CREATE OR REPLACE VIEW` can only APPEND columns to an existing
-- view — it cannot reorder or rename them. The original view's columns are
-- (founder_count, raised_cents, goal_cents, pct_to_goal); those keep their exact
-- positions here and `remaining_cents` is appended LAST so the replace succeeds.
create or replace view public.campaign_progress
  with (security_invoker = true) as
with agg as (
  select
    count(*)::int as founder_count,
    coalesce(sum(amount_cents), 0)::bigint as amount_sum
  from public.founders
  where is_public = true
)
select
  agg.founder_count,
  coalesce(
    (select raised_cents_override from public.campaign_settings where id = true),
    agg.amount_sum
  )::bigint as raised_cents,
  coalesce(
    (select goal_cents from public.campaign_settings where id = true),
    1200000
  )::bigint as goal_cents,
  round(
    coalesce(
      (select raised_cents_override from public.campaign_settings where id = true),
      agg.amount_sum
    )::numeric
      / nullif(
          coalesce((select goal_cents from public.campaign_settings where id = true), 1200000),
          0
        )
      * 100,
    1
  ) as pct_to_goal,
  greatest(
    coalesce((select goal_cents from public.campaign_settings where id = true), 1200000)
      - coalesce(
          (select raised_cents_override from public.campaign_settings where id = true),
          agg.amount_sum
        ),
    0
  )::bigint as remaining_cents
from agg;

grant select on public.campaign_progress to anon;

-- ROLLBACK (manual):
--   create or replace view public.campaign_progress with (security_invoker = true) as
--   select count(*)::int as founder_count,
--          coalesce(sum(amount_cents),0)::bigint as raised_cents,
--          1200000::bigint as goal_cents,
--          round(coalesce(sum(amount_cents),0)::numeric / 1200000 * 100, 1) as pct_to_goal
--   from public.founders where is_public = true;
--   drop policy if exists anon_read_campaign_settings on public.campaign_settings;
--   drop table if exists public.campaign_settings;
--   alter table public.founders drop column if exists position;
--   -- Re-adding NOT NULL to amount_cents requires backfilling nulls first.
