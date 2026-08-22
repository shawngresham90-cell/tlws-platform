-- Verification for the Founder Wall privacy hardening. READ-ONLY: every
-- statement is a SELECT. Safe to run before and after; it writes nothing.
--
-- Run each block and compare against the "expected after" note above it.

-- ---------------------------------------------------------------------------
-- 1. Column grants on public.founders.
--    Expected after: anon and authenticated each hold SELECT on exactly 10
--    columns — business_name, business_url, display_name, id, is_public,
--    logo_url, message, paid_at, position, tier. No amount_cents, no
--    payment_ref, no payment_provider, no status, no created_at, no updated_at.
select grantee,
       count(*) as columns_readable,
       string_agg(column_name, ', ' order by column_name) as columns
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'founders'
  and grantee in ('anon', 'authenticated') and privilege_type = 'SELECT'
group by grantee
order by grantee;

-- ---------------------------------------------------------------------------
-- 2. The restricted columns specifically. Expected after: 0 rows.
select grantee, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'founders'
  and grantee in ('anon', 'authenticated')
  and column_name in ('amount_cents', 'payment_ref', 'payment_provider',
                      'status', 'created_at', 'updated_at')
  and privilege_type = 'SELECT';

-- ---------------------------------------------------------------------------
-- 3. Write grants across the whole Founder Wall surface. Expected after:
--    0 rows (before: TRUNCATE on founders, and full DML on campaign_settings
--    and campaign_progress, for both public roles).
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('founders', 'campaign_settings', 'campaign_progress')
  and grantee in ('anon', 'authenticated')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
order by table_name, grantee, privilege_type;

-- ---------------------------------------------------------------------------
-- 4. campaign_settings is readable only as the two public figures plus the
--    singleton key. Expected after: id, goal_cents, raised_cents_override
--    (no updated_at), SELECT only.
select grantee, privilege_type, string_agg(column_name, ', ' order by column_name) as columns
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'campaign_settings'
  and grantee in ('anon', 'authenticated')
group by grantee, privilege_type
order by grantee, privilege_type;

-- ---------------------------------------------------------------------------
-- 5. RLS is untouched. Expected: founders rowsecurity = true, and the policy
--    anon_read_founders still reads exactly (is_public = true).
select c.relname, c.relrowsecurity as rls_enabled, p.polname,
       pg_get_expr(p.polqual, p.polrelid) as using_expr
from pg_class c
join pg_namespace ns on ns.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where ns.nspname = 'public' and c.relname in ('founders', 'campaign_settings')
order by c.relname, p.polname;

-- ---------------------------------------------------------------------------
-- 6. The view still runs with the caller's privileges (security_invoker), and
--    no longer mentions amount_cents. Expected: security_invoker=true, and
--    references_amount_cents = false.
select array_to_string(c.reloptions, ', ') as reloptions,
       pg_get_viewdef(c.oid, true) like '%amount_cents%' as references_amount_cents
from pg_class c
join pg_namespace ns on ns.oid = c.relnamespace
where ns.nspname = 'public' and c.relname = 'campaign_progress';

-- ---------------------------------------------------------------------------
-- 7. THE PUBLIC PROJECTION, EXECUTED AS anon — the role PostgREST assumes for
--    every unauthenticated REST request. Expected: 27 rows, Lauren Gresham
--    present as steel position 9.
begin;
set local role anon;

select count(*) as anon_visible_founders from public.founders where is_public = true;

select display_name, tier, "position", business_name, paid_at
from public.founders
where is_public = true and display_name = 'Lauren Gresham';

select "position", display_name
from public.founders
where is_public = true and tier = 'steel'
order by "position" nulls last;

-- The thermometer, as anon reads it.
-- Expected: 27 / 955500 / 1155000 / 199500 / 82.7 / true
select founder_count, raised_cents, goal_cents, remaining_cents, pct_to_goal,
       (raised_cents + remaining_cents = goal_cents) as math_reconciles
from public.campaign_progress;

reset role;
commit;

-- ---------------------------------------------------------------------------
-- 8. THE DENIALS, EXECUTED AS anon. Each of these must fail with
--    "ERROR: permission denied for table founders" (SQLSTATE 42501).
--    Run them one at a time — the first error aborts the block.
--
--   begin; set local role anon;
--     select amount_cents      from public.founders limit 1;   -- must fail
--     select payment_ref       from public.founders limit 1;   -- must fail
--     select payment_provider  from public.founders limit 1;   -- must fail
--     select status            from public.founders limit 1;   -- must fail
--     select created_at        from public.founders limit 1;   -- must fail
--     select updated_at        from public.founders limit 1;   -- must fail
--     select * from public.founders limit 1;                   -- must fail
--     update public.campaign_settings set goal_cents = 1;      -- must fail
--   rollback;
--
-- The machine-checked form of the same thing, which reports pass/fail instead
-- of aborting:
begin;
set local role anon;
do $$
declare
  col text;
  denied text[] := '{}';
  leaked text[] := '{}';
begin
  foreach col in array array['amount_cents', 'payment_ref', 'payment_provider',
                             'status', 'created_at', 'updated_at']
  loop
    begin
      execute format('select %I from public.founders limit 1', col);
      leaked := leaked || col;
    exception when insufficient_privilege then
      denied := denied || col;
    end;
  end loop;

  -- select * expands to every column, so it must be refused too.
  begin
    execute 'select * from public.founders limit 1';
    leaked := leaked || 'select_star';
  exception when insufficient_privilege then
    denied := denied || 'select_star';
  end;

  -- anon must not be able to move the campaign totals.
  begin
    execute 'update public.campaign_settings set goal_cents = goal_cents';
    leaked := leaked || 'update_campaign_settings';
  exception when insufficient_privilege then
    denied := denied || 'update_campaign_settings';
  end;

  raise notice 'DENIED (expected, good): %', denied;
  raise notice 'LEAKED (must be empty): %', leaked;
  if array_length(leaked, 1) is not null then
    raise exception 'VERIFY FAILED: anon can still read/write %', leaked;
  end if;
end $$;
reset role;
commit;

-- ---------------------------------------------------------------------------
-- 9. Admin access is unaffected. The admin console uses the service_role key,
--    which bypasses RLS and column grants. Expected: 27 rows, amounts visible.
begin;
set local role service_role;
select count(*) as rows_visible,
       count(*) filter (where amount_cents is not null) as rows_with_amount,
       count(*) filter (where status is not null) as rows_with_status
from public.founders;
reset role;
commit;

-- ---------------------------------------------------------------------------
-- 10. NO FOUNDER DATA CHANGED. Expected: 27 founders, digest
--     ab4b8597a81da1675e4b0daa3e0763d3 (all 27 rows), and the pre-Lauren
--     26-row digest f0b1346a90caca328d8fcc19a7d18331 — both identical to the
--     values recorded before this permission change.
select count(*) as total_founders,
       md5(string_agg(md5(to_jsonb(f)::text), '' order by f.id)) as all_27_digest
from public.founders f;

select md5(string_agg(md5(to_jsonb(f)::text), '' order by f.id)) as pre_lauren_26_digest
from public.founders f
where f.display_name <> 'Lauren Gresham';

select goal_cents, raised_cents_override from public.campaign_settings;
