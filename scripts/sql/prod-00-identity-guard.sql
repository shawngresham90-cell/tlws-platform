-- =========================================================================
-- 00 — IDENTITY AND STATE GUARD
-- =========================================================================
-- Runs FIRST, inside the same single transaction as migrations 049-053 and
-- the history rows. Any RAISE here aborts the entire transaction and nothing
-- is applied.
--
-- Two questions, and both must be answered before a single DDL statement runs:
--
--   1. Is this actually the production database we think it is?
--   2. Is it actually in the unmigrated state the plan was written against?
--
-- The second is the one that protects against the dangerous case. A partially
-- applied migration set is exactly the situation where "just run it again"
-- does something nobody reviewed — so every target object is checked
-- INDIVIDUALLY and by name. A single pre-existing table, view, function or
-- trigger stops the run.
--
-- This file is read-only. It creates nothing and writes nothing; it only
-- refuses.

do $guard$
declare
  v_sms      bigint;
  v_loc      bigint;
  v_present  text[] := '{}';
  v_obj      text;
  v_recorded text;
begin
  -- ---------------------------------------------------------------------
  -- 1. IDENTITY — is this the production database?
  -- ---------------------------------------------------------------------
  -- Two independent row counts verified read-only during the preflight. The
  -- disposable test project returns 0 for both, so a mistargeted run stops
  -- here rather than creating Navigator tables somewhere unintended.
  select count(*) into v_sms from public.sms_consents;
  select count(*) into v_loc from public.locations;

  if v_sms <> 16 then
    raise exception
      'IDENTITY GUARD: public.sms_consents holds % row(s), expected 16. This is not the database this plan was prepared against. Nothing applied.', v_sms;
  end if;
  if v_loc <> 2830 then
    raise exception
      'IDENTITY GUARD: public.locations holds % row(s), expected 2830. This is not the database this plan was prepared against. Nothing applied.', v_loc;
  end if;

  -- ---------------------------------------------------------------------
  -- 2. STATE — all 11 target objects must be ABSENT, checked one by one
  -- ---------------------------------------------------------------------
  -- 7 tables + 3 views from 049/050/051. `to_regclass` covers both kinds and
  -- returns null when the relation does not exist.
  foreach v_obj in array array[
    'public.email_consents',
    'public.email_unsubscribes',
    'public.navigator_profiles',
    'public.navigator_state',
    'public.navigator_provider_month',
    'public.navigator_provider_usage',
    'public.navigator_provider_user_usage',
    'public.email_subscription_status',
    'public.navigator_marketing_contacts',
    'public.navigator_provider_usage_report'
  ] loop
    if to_regclass(v_obj) is not null then
      v_present := v_present || v_obj;
    end if;
  end loop;

  -- 11th object: the reservation function from 051.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'navigator_reserve_provider_units'
  ) then
    v_present := v_present || 'public.navigator_reserve_provider_units()';
  end if;

  -- The two triggers from 050. Named on their own tables, so a trigger left
  -- behind by a half-rolled-back attempt is caught even if its table is gone.
  if exists (
    select 1 from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and not t.tgisinternal
       and t.tgname = 'set_updated_at'
       and c.relname in ('navigator_profiles','navigator_state')
  ) then
    v_present := v_present || 'trigger set_updated_at on a navigator table';
  end if;

  -- Any policy on the 049/050/051 tables is likewise evidence of a prior run.
  if exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and (tablename like 'navigator_%' or tablename like 'email_consent%'
            or tablename like 'email_unsubscribe%')
  ) then
    v_present := v_present || 'one or more RLS policies on target tables';
  end if;

  if array_length(v_present, 1) is not null then
    raise exception
      'STATE GUARD: % target object(s) already exist: %. The plan was prepared against a clean slate; a partial state needs review, not a re-run. Nothing applied.',
      array_length(v_present, 1), array_to_string(v_present, ', ');
  end if;

  -- ---------------------------------------------------------------------
  -- 3. HISTORY — none of 049-053 may already be recorded, and 047 must not
  --    have been repaired by someone else in the meantime.
  -- ---------------------------------------------------------------------
  select string_agg(version || ' / ' || coalesce(name, '(unnamed)'), ', ' order by version)
    into v_recorded
    from supabase_migrations.schema_migrations
   where name ~ '^(049|050|051|052|053)_';

  if v_recorded is not null then
    raise exception
      'HISTORY GUARD: migrations 049-053 already have history row(s): %. Nothing applied.', v_recorded;
  end if;

  if exists (select 1 from supabase_migrations.schema_migrations where name like '047%') then
    raise exception
      'HISTORY GUARD: a 047 history row already exists. The reconstructed repair in this package would duplicate it. Nothing applied.';
  end if;

  -- The six versions this package inserts must all be free.
  select string_agg(version, ', ' order by version) into v_recorded
    from supabase_migrations.schema_migrations
   where version in ('20260729173844','20260817020000','20260817020001',
                     '20260817020002','20260817020003','20260817020004');

  if v_recorded is not null then
    raise exception
      'HISTORY GUARD: version collision on %. Nothing applied.', v_recorded;
  end if;

  raise notice 'GUARD PASSED: production identity confirmed, all 11 target objects absent, history clear.';
end
$guard$;
