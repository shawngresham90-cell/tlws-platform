-- Exact reversal of the Founder Wall privacy hardening.
--
-- Restores the grants and the view definition to the state recorded
-- immediately before APPLY.sql ran on 2026-07-26:
--
--   founders           anon, authenticated: REFERENCES, SELECT, TRIGGER, TRUNCATE
--                      (table-level SELECT = every column)
--   campaign_settings  anon, authenticated: ALL
--   campaign_progress  anon, authenticated: ALL
--   campaign_progress  definition md5 5cb0105c2b3720f35393bfe9a8aa8025
--
-- This re-opens the exposure. It exists so the change is reversible in one
-- step if the public wall or the thermometer regresses; it is not something to
-- run casually.
--
-- Like the forward statement, this touches no founder row.

begin;

-- ------------------------------------------------ 1. restore the view definition
-- Byte-identical to migration 026's version, including the
-- coalesce(sum(amount_cents), 0) fallback that made the amount_cents grant
-- necessary in the first place.
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

comment on view public.campaign_progress is null;

-- ------------------------------------------------------------- 2. restore grants
-- Column-level grants must be cleared first, otherwise they linger alongside
-- the restored table-level grants and the audit no longer matches the original.
revoke all on public.founders from anon, authenticated;
grant select, references, trigger, truncate on public.founders to anon, authenticated;

revoke all on public.campaign_settings from anon, authenticated;
grant all on public.campaign_settings to anon, authenticated;

revoke all on public.campaign_progress from anon, authenticated;
grant all on public.campaign_progress to anon, authenticated;

-- --------------------------------------------------------------- 3. post-checks
do $$
declare
  n integer;
begin
  -- Back to SELECT on all 16 columns for both roles.
  select count(*) into n
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'founders'
     and grantee in ('anon', 'authenticated') and privilege_type = 'SELECT';
  if n <> 32 then
    raise exception 'Rollback post-check failed: expected 32 column grants (16 x 2 roles), found %.', n;
  end if;

  -- The view definition is the original again.
  if md5(pg_get_viewdef('public.campaign_progress'::regclass, true))
     <> '5cb0105c2b3720f35393bfe9a8aa8025' then
    raise exception 'Rollback post-check failed: campaign_progress was not restored to its original definition.';
  end if;

  -- And the wall still reads correctly.
  select count(*) into n from public.founders;
  if n <> 27 then
    raise exception 'Rollback post-check failed: expected 27 founders, found %.', n;
  end if;
end $$;

commit;
