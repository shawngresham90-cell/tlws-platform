-- Founder Wall privacy hardening — least-privilege grants for the public roles.
--
-- PERMISSIONS ONLY. This statement does not read, write, insert, update or
-- delete a single founder row. Every founder's name, tier, position, message,
-- visibility and stored amount is left exactly as it is; only *who may read
-- which column* changes.
--
-- ============================ the exposure ============================
--
-- `anon` (the role every unauthenticated REST request runs as) holds SELECT on
-- ALL SIXTEEN columns of public.founders:
--
--   amount_cents, business_name, business_url, created_at, display_name, id,
--   is_public, logo_url, message, paid_at, payment_provider, payment_ref,
--   position, status, tier, updated_at
--
-- RLS (`anon_read_founders USING (is_public = true)`) limits which ROWS are
-- visible but says nothing about COLUMNS, so
--
--   GET /rest/v1/founders?select=display_name,amount_cents,payment_ref,status
--
-- returns every published founder's contribution amount, payment reference,
-- payment provider and internal status to anyone holding the anon key — which
-- ships in the browser bundle and is public by design. The site never displays
-- any of it; the database simply never stopped anyone from asking.
--
-- `campaign_settings` is worse on paper: anon holds INSERT, UPDATE, DELETE and
-- TRUNCATE on it as well as SELECT. RLS blocks the DML (there is no write
-- policy), but TRUNCATE is NOT subject to RLS — a grant, not a policy, is the
-- only thing standing in front of it. The same stray TRUNCATE grant sits on
-- `founders`.
--
-- ============================== the fix ===============================
--
-- 1. Narrow anon/authenticated to the exact projection the public page reads.
-- 2. Drop every write grant (INSERT/UPDATE/DELETE/TRUNCATE) from both roles.
-- 3. Remove the ONE reason anon needed `amount_cents` at all: the
--    `campaign_progress` view.
--
-- On (3): the view is `security_invoker = true`, so its body is executed with
-- the *caller's* privileges. Its body computes `coalesce(sum(amount_cents), 0)`
-- as a fallback for `raised_cents`. That single reference is what forces anon
-- to hold SELECT on amount_cents — revoke the column and the thermometer 500s.
--
-- The fallback is also dead and wrong. Migration 026, which introduced it,
-- states the design in its own header: individual amounts "are not summed to
-- produce the public total". The public total is the aggregate
-- `campaign_settings.raised_cents_override` (955500 = $9,555). Only 2 of the 27
-- founders carry a non-null amount_cents at all, so the fallback would report
-- $1,000 — not $9,555 — if it ever fired. Removing it aligns the view with its
-- documented contract AND frees the column.
--
-- The alternative was flipping the view to `security_invoker = false` so it
-- could read the column with the owner's rights. That keeps a privileged
-- dependency on payment data, and trips Supabase's `security_definer_view`
-- lint. Removing the dependency is strictly better than hiding it.
--
-- Column order, names and types of the view are preserved exactly, so
-- CREATE OR REPLACE succeeds and every existing reader keeps working.
--
-- ========================== what is preserved =========================
--
--   * the public Founder Wall projection (9 columns) and its is_public filter
--   * campaign totals: raised $9,555, remaining $1,995, goal $11,550, 27 founders
--   * RLS: `anon_read_founders USING (is_public = true)` is NOT touched, so
--     unpublished founders stay invisible
--   * admin: every admin read and write uses the service_role key, which
--     bypasses RLS and column grants entirely — unaffected by anything here
--
-- Preconditions and post-checks are asserted inside one transaction. Anything
-- unexpected raises and the whole change rolls back.

begin;

-- ---------------------------------------------------------------- preconditions
do $$
declare
  n integer;
begin
  -- The exposure must be present exactly as described, or this is not the
  -- database this statement was written against.
  select count(*) into n
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'founders'
     and grantee = 'anon' and privilege_type = 'SELECT';
  if n <> 16 then
    raise exception 'Precondition failed: expected anon to hold SELECT on all 16 founders columns, found %.', n;
  end if;

  select count(*) into n
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'founders'
     and grantee = 'anon' and privilege_type = 'SELECT'
     and column_name in ('amount_cents', 'payment_ref', 'payment_provider', 'status');
  if n <> 4 then
    raise exception 'Precondition failed: expected the 4 restricted columns to be anon-readable, found %.', n;
  end if;

  -- The founder data must be the verified post-Lauren state. Nothing here
  -- changes it; this only proves we are hardening the wall we audited.
  select count(*) into n from public.founders;
  if n <> 27 then
    raise exception 'Precondition failed: expected 27 founders, found %.', n;
  end if;

  -- RLS must already be enforcing row visibility. This statement relies on it
  -- and must never be the thing that turns it on.
  if not exists (
    select 1 from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
     where ns.nspname = 'public' and c.relname = 'founders' and c.relrowsecurity
  ) then
    raise exception 'Precondition failed: RLS is not enabled on public.founders.';
  end if;

  if not exists (
    select 1 from pg_policy p join pg_class c on c.oid = p.polrelid
     where c.relname = 'founders' and p.polname = 'anon_read_founders'
       and pg_get_expr(p.polqual, p.polrelid) = '(is_public = true)'
  ) then
    raise exception 'Precondition failed: policy anon_read_founders is not the expected (is_public = true).';
  end if;

  -- The view must be the one migration 026 left behind, unmodified.
  if md5(pg_get_viewdef('public.campaign_progress'::regclass, true))
     <> '5cb0105c2b3720f35393bfe9a8aa8025' then
    raise exception 'Precondition failed: campaign_progress is not the definition this change was written against.';
  end if;
end $$;

-- --------------------------------------------------- 1. drop the amount_cents dependency
-- Same columns, same order, same types. `raised_cents` now reads only the
-- aggregate override, which is what migration 026 always said it should.
create or replace view public.campaign_progress
  with (security_invoker = true) as
with agg as (
  select count(*)::int as founder_count
  from public.founders
  where is_public = true
)
select
  agg.founder_count,
  coalesce(
    (select raised_cents_override from public.campaign_settings where id = true),
    0
  )::bigint as raised_cents,
  coalesce(
    (select goal_cents from public.campaign_settings where id = true),
    1200000
  )::bigint as goal_cents,
  round(
    coalesce(
      (select raised_cents_override from public.campaign_settings where id = true),
      0
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
          0
        ),
    0
  )::bigint as remaining_cents
from agg;

comment on view public.campaign_progress is
  'Public campaign totals. Aggregates only — never per-founder amounts. raised_cents is the aggregate campaign_settings.raised_cents_override; this view deliberately does not reference founders.amount_cents so the anon role needs no grant on it.';

-- ------------------------------------------------------------- 2. founders grants
-- Clears table-level SELECT (all columns) plus the stray REFERENCES / TRIGGER /
-- TRUNCATE grants, then re-grants only the projection the wall renders.
revoke all on public.founders from anon, authenticated;

-- Exactly the 9 columns src/lib/community/founders.ts selects, plus is_public,
-- which PostgREST needs because the reader filters `.eq('is_public', true)`
-- (a WHERE clause requires SELECT privilege on the column it references).
-- is_public is true for every row a public caller can see, so it discloses
-- nothing. amount_cents, payment_ref, payment_provider, status, created_at and
-- updated_at are deliberately absent.
grant select (
  id,
  display_name,
  business_name,
  business_url,
  tier,
  "position",
  message,
  logo_url,
  paid_at,
  is_public
) on public.founders to anon, authenticated;

-- ---------------------------------------------------- 3. campaign_settings grants
-- Removes anon/authenticated INSERT, UPDATE, DELETE and TRUNCATE. Only the two
-- figures the thermometer publishes remain readable (plus the singleton key the
-- view filters on). updated_at is not needed and is not granted.
revoke all on public.campaign_settings from anon, authenticated;
grant select (id, goal_cents, raised_cents_override)
  on public.campaign_settings to anon, authenticated;

-- ---------------------------------------------------- 4. campaign_progress grants
-- Read-only. The view is the only campaign surface the public roles need.
revoke all on public.campaign_progress from anon, authenticated;
grant select on public.campaign_progress to anon, authenticated;

-- ---------------------------------------------------------------- post-checks
do $$
declare
  n integer;
  raised bigint;
  remaining bigint;
  cnt integer;
begin
  -- (a) No restricted column is readable by either public role.
  select count(*) into n
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'founders'
     and grantee in ('anon', 'authenticated') and privilege_type = 'SELECT'
     and column_name in ('amount_cents', 'payment_ref', 'payment_provider',
                         'status', 'created_at', 'updated_at');
  if n <> 0 then
    raise exception 'Post-check failed: % restricted founders column grant(s) survive.', n;
  end if;

  -- (b) Exactly the 10 approved columns, for each of the two roles.
  select count(*) into n
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'founders'
     and grantee in ('anon', 'authenticated') and privilege_type = 'SELECT';
  if n <> 20 then
    raise exception 'Post-check failed: expected 20 approved column grants (10 x 2 roles), found %.', n;
  end if;

  -- (c) No write grant of any kind survives on the Founder Wall surface.
  select count(*) into n
    from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name in ('founders', 'campaign_settings', 'campaign_progress')
     and grantee in ('anon', 'authenticated')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
  if n <> 0 then
    raise exception 'Post-check failed: % write grant(s) survive on the Founder Wall surface.', n;
  end if;

  -- (d) Functional proof, as the anon role itself — exactly the role PostgREST
  --     assumes for an unauthenticated request.
  set local role anon;

  -- the wall still renders
  select count(*) into cnt from public.founders where is_public = true;
  if cnt <> 27 then
    raise exception 'Post-check failed: anon sees % founders, expected 27.', cnt;
  end if;

  -- the approved projection still resolves
  perform id, display_name, business_name, business_url, tier, "position",
          message, logo_url, paid_at
     from public.founders where is_public = true;

  -- the thermometer still resolves, with the totals unchanged
  select raised_cents, remaining_cents, founder_count
    into raised, remaining, cnt
    from public.campaign_progress;
  if raised <> 955500 or remaining <> 199500 or cnt <> 27 then
    raise exception 'Post-check failed: anon thermometer reads raised=%, remaining=%, count=% (expected 955500/199500/27).',
      raised, remaining, cnt;
  end if;

  -- the restricted columns are refused
  begin
    execute 'select amount_cents from public.founders limit 1';
    raise exception 'Post-check failed: anon can still read founders.amount_cents.';
  exception when insufficient_privilege then null;
  end;

  begin
    execute 'select payment_ref from public.founders limit 1';
    raise exception 'Post-check failed: anon can still read founders.payment_ref.';
  exception when insufficient_privilege then null;
  end;

  begin
    execute 'select payment_provider from public.founders limit 1';
    raise exception 'Post-check failed: anon can still read founders.payment_provider.';
  exception when insufficient_privilege then null;
  end;

  begin
    execute 'select status from public.founders limit 1';
    raise exception 'Post-check failed: anon can still read founders.status.';
  exception when insufficient_privilege then null;
  end;

  reset role;
end $$;

commit;
