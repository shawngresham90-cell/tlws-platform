-- 051: Navigator provider usage — the counter every serverless instance shares.
--
-- PROPOSED — DO NOT APPLY WITHOUT EXPLICIT APPROVAL, and do not apply from a
-- feature branch. Nothing reads or writes these tables until
-- NAVIGATOR_ACCESS_MODE=account (or =public), and neither mode is switched on
-- by the change that adds this file. Production remains on `pilot`.
--
-- DEPENDS ON 050 only for `auth.users` being the identity source, which it
-- already is. Additive and idempotent. Touches no existing table, no existing
-- policy, and nothing the Trip Planner or the admin auth system owns.
--
-- =========================================================================
-- WHY THIS IS IN THE DATABASE AND NOT IN THE APPLICATION
-- =========================================================================
-- Every existing limiter in this repository is per-process: the per-IP token
-- buckets, the routing adapter's free-tier guard, and `public-budget.ts` — the
-- last of which documents the problem against itself, that its ceiling is
-- multiplied by however many instances the platform decided to run.
--
-- A monthly spending bound cannot be per-process. Netlify may run one instance
-- or forty, and the application cannot read that number, let alone divide by
-- it. The only counter that bounds the month is one that all of them contend
-- for, which means a row, which means here.
--
-- =========================================================================
-- WHY A FUNCTION AND NOT A READ-THEN-WRITE
-- =========================================================================
-- `select units; if (units + n <= threshold) update units = units + n` is
-- wrong under concurrency and wrong in the expensive direction: two instances
-- both read the last free unit, both conclude they may spend it, and both do.
-- Under load — which is exactly when a spend limit matters — that error
-- compounds with the number of concurrent callers.
--
-- The reservation below is a single UPDATE whose WHERE clause contains the
-- limit test. UPDATE takes a row-level lock, and in READ COMMITTED a statement
-- that finds the row concurrently modified re-evaluates its WHERE against the
-- NEW version before proceeding. So the test and the increment are one
-- indivisible act: a loser of the race re-checks against the winner's total
-- and matches zero rows. The threshold cannot be exceeded, whatever the
-- concurrency.
--
-- =========================================================================
-- WHAT MAY NEVER BE STORED HERE
-- =========================================================================
-- No email, no phone, no name, no position, no destination, no search text,
-- no route, no geometry, no user agent, no IP address. A usage ledger needs
-- to answer "how many, this month, on which endpoint" and nothing else, and
-- every additional column would be a new place for a driver's movements to
-- accumulate under an operational justification.
--
-- What IS stored is a `user_id` on the per-user table, because a per-user
-- limit has no meaning without one — and that is a uuid pointing at
-- auth.users, not an identity in itself. It cascades on account deletion, so
-- deleting an account removes it. The aggregate tables hold no user id at all.

-- =========================================================================
-- 1. THE SHARED MONTHLY TOTAL
-- =========================================================================
-- One row per month, across every endpoint and every caller. This is the row
-- that instances contend for, and the reason the guard works at all.

create table if not exists public.navigator_provider_month (
  -- 'YYYY-MM', always UTC. Text rather than a date because it is a bucket
  -- label, not a day, and two servers in different regions must agree on it.
  month text primary key,

  units integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint navigator_provider_month_shape
    check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  constraint navigator_provider_month_units_nonneg
    check (units >= 0)
);

comment on table public.navigator_provider_month is
  'The shared monthly provider-usage total that every serverless instance contends for. Units are a LOCAL unit of account, not a HERE transaction count — routing and search bill against different HERE products. See src/lib/navigator-api/usage-guard.ts for the full statement of what this number is and is not.';

-- =========================================================================
-- 2. THE PER-ENDPOINT LEDGER (admin reporting)
-- =========================================================================
-- Split by endpoint so the admin view can answer "where did the month go?".
-- Not consulted by the reservation decision — it is written alongside it, in
-- the same transaction, purely so the total above can be explained.

create table if not exists public.navigator_provider_usage (
  month text not null,
  -- Matches METERED_ENDPOINT_KEYS in src/lib/navigator-api/metered-endpoints.ts.
  -- Constrained rather than free text: an endpoint key that does not exist in
  -- the application is a bug, and a ledger that accepts it hides the bug in a
  -- report nobody reconciles.
  endpoint text not null,

  units integer not null default 0,
  requests integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (month, endpoint),

  constraint navigator_provider_usage_month_shape
    check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  constraint navigator_provider_usage_endpoint_known
    check (endpoint in ('navigator.route', 'navigator.destination-search')),
  constraint navigator_provider_usage_units_nonneg
    check (units >= 0 and requests >= 0)
);

comment on table public.navigator_provider_usage is
  'Monthly provider usage split by endpoint, for admin reporting only. Holds no email, phone, name, position, destination, search text or route — only counts. `requests` counts calls, `units` counts weighted units; they differ when an endpoint weight is not 1.';

-- =========================================================================
-- 3. THE PER-USER LEDGER
-- =========================================================================
-- Keyed to auth.uid(), never to an IP. An IP is shared by a whole carrier's
-- NAT and split across towers by one moving truck; a user id is the only key
-- that means one driver.

create table if not exists public.navigator_provider_user_usage (
  month text not null,
  user_id uuid not null references auth.users(id) on delete cascade,

  units integer not null default 0,
  requests integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (month, user_id),

  constraint navigator_provider_user_usage_month_shape
    check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  constraint navigator_provider_user_usage_units_nonneg
    check (units >= 0 and requests >= 0)
);

comment on table public.navigator_provider_user_usage is
  'Per-driver monthly provider usage, for the per-user ceiling. The user_id is the only identifier here and it cascades on account deletion. No email, phone, position, destination or route.';

create index if not exists navigator_provider_user_usage_month_idx
  on public.navigator_provider_user_usage (month);

-- =========================================================================
-- 4. THE ATOMIC RESERVATION
-- =========================================================================
-- Returns one row: whether the units were reserved, why not if they were not,
-- and the post-reservation totals.
--
-- ORDER OF OPERATIONS, and why it is this order:
--
--   1. Per-user first. It is the cheaper refusal, the more common one, and
--      checking it first means one driver exhausting their own limit never
--      touches — and never contends for — the shared row that every other
--      driver needs.
--   2. Global second, under its own row lock.
--   3. If the global test fails after the per-user increment succeeded, the
--      per-user increment is UNDONE explicitly. A function's writes are part
--      of the caller's transaction and returning normally commits them, so
--      "just return" would leave a driver charged for a request that was
--      refused. We still hold the row lock from step 1, so the undo cannot
--      race anything.
--
-- SECURITY DEFINER, with a pinned search_path. Callers are `authenticated`
-- drivers who must be able to reserve without holding any direct privilege on
-- the ledger tables — RLS below grants them none, so the only way to touch a
-- counter is through this function, which will not let them choose their own
-- user id or their own threshold from the client. Both arrive from the server
-- route handler, which read them from the session and the environment.

create or replace function public.navigator_reserve_provider_units(
  p_user_id uuid,
  p_endpoint text,
  p_units integer,
  p_month text,
  p_global_threshold integer,
  p_user_limit integer
)
returns table (
  allowed boolean,
  reason text,
  global_units integer,
  user_units integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_units integer;
  v_global_units integer;
begin
  -- Refuse nonsense before touching a row. These are programming errors, not
  -- driver errors, and they fail closed like everything else here.
  if p_user_id is null or p_units is null or p_units <= 0
     or p_month is null or p_global_threshold is null or p_global_threshold <= 0
     or p_user_limit is null or p_user_limit <= 0 then
    return query select false, 'invalid-request'::text, 0, 0;
    return;
  end if;

  if p_endpoint not in ('navigator.route', 'navigator.destination-search') then
    return query select false, 'unknown-endpoint'::text, 0, 0;
    return;
  end if;

  -- ---- 1. per-user ------------------------------------------------------
  insert into public.navigator_provider_user_usage (month, user_id, units, requests)
  values (p_month, p_user_id, 0, 0)
  on conflict (month, user_id) do nothing;

  update public.navigator_provider_user_usage
     set units = units + p_units,
         requests = requests + 1,
         updated_at = now()
   where month = p_month
     and user_id = p_user_id
     and units + p_units <= p_user_limit
  returning units into v_user_units;

  if v_user_units is null then
    return query select false, 'user-limit'::text, 0, 0;
    return;
  end if;

  -- ---- 2. global --------------------------------------------------------
  insert into public.navigator_provider_month (month, units)
  values (p_month, 0)
  on conflict (month) do nothing;

  update public.navigator_provider_month
     set units = units + p_units,
         updated_at = now()
   where month = p_month
     and units + p_units <= p_global_threshold
  returning units into v_global_units;

  if v_global_units is null then
    -- Undo step 1. We still hold its row lock, so nothing can have moved.
    update public.navigator_provider_user_usage
       set units = units - p_units,
           requests = requests - 1,
           updated_at = now()
     where month = p_month
       and user_id = p_user_id;
    return query select false, 'global-threshold'::text, 0, 0;
    return;
  end if;

  -- ---- 3. per-endpoint ledger, for reporting only -----------------------
  insert into public.navigator_provider_usage (month, endpoint, units, requests)
  values (p_month, p_endpoint, p_units, 1)
  on conflict (month, endpoint) do update
     set units = public.navigator_provider_usage.units + excluded.units,
         requests = public.navigator_provider_usage.requests + excluded.requests,
         updated_at = now();

  return query select true, 'ok'::text, v_global_units, v_user_units;
end;
$$;

comment on function public.navigator_reserve_provider_units(uuid, text, integer, text, integer, integer) is
  'Atomically reserve provider units before an upstream call. The limit test lives inside the UPDATE WHERE clause, so the check and the increment are one indivisible act and the threshold cannot be exceeded under concurrency. Reservations are NEVER refunded — see the no-refund rule in src/lib/navigator-api/usage-guard.ts.';

-- =========================================================================
-- 5. ROW LEVEL SECURITY
-- =========================================================================
-- All three tables are enabled with NO policy for `anon` and NO policy for
-- `authenticated`. No policy match means zero rows, so a signed-in driver
-- reading these tables directly gets an empty set rather than another
-- driver's usage or the operator's remaining budget — the last of which is a
-- progress bar for exhausting it.
--
-- Drivers still reserve, because the function above is SECURITY DEFINER and
-- runs as its owner. That is the entire access path, and it accepts no
-- caller-chosen threshold: the route handler supplies the limits from server
-- environment the browser cannot read.
--
-- Admin reporting reads with the service role, which bypasses RLS by design
-- and is server-only — the admin dashboard is a shared-password session with
-- no Supabase identity, so there is no principal an RLS policy could name.

alter table public.navigator_provider_month      enable row level security;
alter table public.navigator_provider_usage      enable row level security;
alter table public.navigator_provider_user_usage enable row level security;

-- Stated as explicit drops so that a policy added by hand in the dashboard is
-- removed by re-running this migration, rather than surviving it unnoticed.
drop policy if exists navigator_provider_month_anon      on public.navigator_provider_month;
drop policy if exists navigator_provider_usage_anon      on public.navigator_provider_usage;
drop policy if exists navigator_provider_user_usage_anon on public.navigator_provider_user_usage;
drop policy if exists navigator_provider_user_usage_select_own
  on public.navigator_provider_user_usage;

revoke all on public.navigator_provider_month      from anon, authenticated;
revoke all on public.navigator_provider_usage      from anon, authenticated;
revoke all on public.navigator_provider_user_usage from anon, authenticated;

-- The one grant: reserving. Not reading, not writing directly.
revoke all on function public.navigator_reserve_provider_units(uuid, text, integer, text, integer, integer) from public;
grant execute on function public.navigator_reserve_provider_units(uuid, text, integer, text, integer, integer)
  to authenticated;

-- =========================================================================
-- 6. ADMIN REPORTING VIEW
-- =========================================================================
-- Month, endpoint, requests, units — and nothing that identifies a driver.
-- Granted to service_role alone, matching navigator_marketing_contacts.

create or replace view public.navigator_provider_usage_report as
  select
    u.month,
    u.endpoint,
    u.requests,
    u.units,
    m.units as month_total_units
  from public.navigator_provider_usage u
  join public.navigator_provider_month m on m.month = u.month;

comment on view public.navigator_provider_usage_report is
  'Admin usage reporting: month, endpoint, request count, weighted units, and the month total. Contains no user id, email, phone, position, destination or route.';

revoke all on public.navigator_provider_usage_report from anon, authenticated;
grant select on public.navigator_provider_usage_report to service_role;

-- =========================================================================
-- ROLLBACK
-- =========================================================================
-- Everything below is derived operational data, not evidence: the ledger
-- records how many provider units were reserved, and losing it costs a
-- reporting history, not a record of anything anyone agreed to. That makes
-- this rollback materially safer than 049's or 050's — neither of which can
-- be run without exporting first.
--
-- IT IS STILL NOT FREE, AND THE COST IS SPECIFIC. Dropping these tables resets
-- the month's reserved total to zero. In `account` or `public` mode the guard
-- reads that total to decide whether the monthly safety threshold has been
-- reached, so a drop mid-month hands back the entire remaining allowance and
-- the month can be spent a second time. Export the current month before
-- running this, and prefer to run it only while the deploy is in `pilot` or
-- `closed`, where the guard is inert and there is nothing to lose:
--
--   -- keep the evidence of what was already spent
--   \copy (select * from public.navigator_provider_month) to 'provider_month.csv' csv header
--   \copy (select * from public.navigator_provider_usage) to 'provider_usage.csv' csv header
--
--   drop view     if exists public.navigator_provider_usage_report;
--   drop function if exists public.navigator_reserve_provider_units(uuid, text, integer, text, integer, integer);
--   drop index    if exists public.navigator_provider_user_usage_month_idx;
--   drop table    if exists public.navigator_provider_user_usage;
--   drop table    if exists public.navigator_provider_usage;
--   drop table    if exists public.navigator_provider_month;
--
-- ORDER MATTERS: the view depends on two of the tables and the per-user table
-- carries the `auth.users` foreign key, so dropping the tables first would
-- either fail or force a `cascade` that takes the view with it silently.
--
-- Dropping the function while the deploy is in `account` or `public` mode does
-- NOT open the endpoints. `reserveProviderUnits` treats a missing function the
-- same as an unreachable database — `guard-unavailable`, which the metered gate
-- answers 503. Metered requests are refused until the migration is restored.
-- That is the intended direction of failure and it is asserted against a real
-- server, with the function genuinely renamed away, in §11 of
-- `scripts/test-live-postgres.mjs`.
