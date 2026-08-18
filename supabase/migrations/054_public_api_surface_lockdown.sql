-- =========================================================================
-- 054 — LOCK DOWN THE PUBLIC DATA-API SURFACE
-- =========================================================================
--
-- Driven by the Supabase Security Advisor report of Aug 17 2026
-- ("Table publicly accessible" / rls_disabled_in_public). Every claim below
-- was verified against the live catalog before this file was written; the
-- full table-by-table audit is docs/operations/supabase-rls-audit-2026-08-18.md.
--
-- WHAT THE ADVISOR ACTUALLY FOUND
--
-- Exactly ONE table trips rls_disabled_in_public: `public.spatial_ref_sys`,
-- PostGIS's SRID reference catalog (~8,500 rows of public EPSG data). Every
-- application table already has RLS enabled — 010 and its successors did
-- that work. But spatial_ref_sys is a real hole all the same:
--
--   - it is owned by `supabase_admin`, which granted the API roles the FULL
--     privilege set (arwdDxtm — including INSERT/UPDATE/DELETE) when the
--     extension was installed, and RLS is off;
--   - a rolled-back probe on 2026-08-18 CONFIRMED the anon role can INSERT
--     into it. Anyone holding the publishable anon key — which is every
--     visitor's browser — can also UPDATE or DELETE rows via PostgREST;
--   - the rows are not secrets, but they are load-bearing: corrupt or
--     delete SRID 4326 and every geography calculation the directory,
--     nearby_locations, and the trip planner make starts failing.
--
-- WHY THIS FILE DOES NOT SIMPLY `ENABLE ROW LEVEL SECURITY`
--
-- Migrations run as `postgres`, and both standard fixes are unavailable to
-- it — each verified by probe, not assumed:
--
--   alter table public.spatial_ref_sys enable row level security;
--     -> ERROR: insufficient_privilege (postgres is not the table's owner)
--   revoke insert on public.spatial_ref_sys from anon;
--     -> silent no-op (the grants were made by supabase_admin; a role can
--        only revoke grants it made, and postgres holds no grant option)
--
-- What postgres DOES hold on the table is TRIGGER privilege. So the guard
-- below closes the write path at the data layer: a statement-level trigger
-- that rejects INSERT/UPDATE/DELETE/TRUNCATE arriving as the API roles.
-- SELECT stays open on purpose — PostGIS reads this catalog while executing
-- geography operations as whatever role issued the query (nearby_locations
-- runs as anon), and the data is public reference material.
--
-- The remaining advisor items and why they are or aren't here:
--   - community_profiles / location_history / location_submissions were
--     created after 011_revoke_anon_writes and shipped with Supabase's
--     default FULL table grants to anon+authenticated. RLS default-deny
--     already blocks them (no policies), so nothing is exposed today —
--     this file simply applies 011's belt-and-suspenders doctrine to the
--     three tables that missed it.
--   - TRUNCATE is the one verb row-level security does not govern, and the
--     API roles hold it on nearly every table (011 revoked only
--     insert/update/delete). PostgREST never issues TRUNCATE, so this is
--     unreachable today; the sweep below removes it anyway so that safety
--     never depends on PostgREST's verb mapping.
--   - preschool_enforce_capacity() is flagged by the advisor as an
--     anon-executable SECURITY DEFINER function. It is a trigger function —
--     PostgREST refuses to call trigger functions via /rpc — but the
--     EXECUTE grant buys nothing, so it goes. Trigger firing does not
--     recheck the DML caller's EXECUTE, so inserts via service_role are
--     unaffected. (028 revoked anon+authenticated but missed PUBLIC — the
--     default-grant pseudo-role 053 documented — which is why the advisor
--     still saw it as callable.)
--   - record_directory_view() was MEANT to be service-role-only: 025
--     revoked it from anon+authenticated and the only caller is
--     /api/directory/view using the admin client, behind that route's rate
--     limiter. But 025 also missed the PUBLIC revoke, so the advisor is
--     right that anyone with the anon key can still call it directly —
--     bypassing the rate limiter to spam view counters. This file
--     completes 025's intended lockdown.
--   - admin_role() / is_admin() KEEP authenticated EXECUTE deliberately:
--     the admin_users RLS policies evaluate them as the calling role.
--   - st_estimatedextent() (PostGIS, flagged WARN) cannot be revoked by
--     postgres for the same grantor reason as spatial_ref_sys; it only
--     reads column statistics. Documented in the audit, accepted.
--
-- EXPECTED APP IMPACT: none. Every production write path goes through
-- server-only service-role clients, which pass the guard and keep their
-- grants. Verified: zero anon/authenticated write policies exist except the
-- deliberate user-owned ones (saved_trips, truck_presets, navigator_*,
-- admin_users owner_write), and none of those tables are touched here.
--
-- Idempotent: create-or-replace + drop-if-exists + revokes that no-op when
-- already applied. Safe to re-run.
--
-- ROLLBACK (manual, if ever needed):
--   drop trigger if exists tlws_spatial_ref_sys_write_guard on public.spatial_ref_sys;
--   drop function if exists public.tlws_block_api_writes();
--   grant insert, update, delete on public.community_profiles    to anon, authenticated;
--   grant insert, update, delete on public.location_history      to anon, authenticated;
--   grant insert, update, delete on public.location_submissions  to anon, authenticated;
--   grant truncate on <table> to anon, authenticated;  -- per table, if truly desired
--   grant execute on function public.preschool_enforce_capacity() to anon, authenticated;
--   grant execute on function public.record_directory_view(uuid) to anon, authenticated;

-- ── 1. spatial_ref_sys: block Data-API writes with a guard trigger ──────
--
-- SECURITY INVOKER by design: it must see the REAL calling role. Allows
-- everything except the two API roles, so postgres / supabase_admin
-- (extension upgrades) and service_role are untouched.

create or replace function public.tlws_block_api_writes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'writes to %.% are not permitted over the public Data API',
      tg_table_schema, tg_table_name
      using errcode = 'insufficient_privilege';
  end if;
  return null; -- statement-level; return value is ignored
end;
$$;

-- The guard is fired by triggers only; nothing should call it over /rpc.
revoke execute on function public.tlws_block_api_writes() from public, anon, authenticated;

drop trigger if exists tlws_spatial_ref_sys_write_guard on public.spatial_ref_sys;
create trigger tlws_spatial_ref_sys_write_guard
  before insert or update or delete or truncate on public.spatial_ref_sys
  for each statement execute function public.tlws_block_api_writes();

-- ── 2. tables that missed 011's revoke doctrine ─────────────────────────
--
-- RLS already default-denies all three (no policies exist). This aligns the
-- grant layer with the doctrine 011 stated: anon = SELECT public rows only,
-- zero write grants; all writes via service-role server routes.

do $$
declare t text;
begin
  foreach t in array array[
    'community_profiles', 'location_history', 'location_submissions'
  ]
  loop
    execute format('revoke insert, update, delete on public.%I from anon, authenticated;', t);
  end loop;
end $$;

-- ── 3. TRUNCATE hygiene, schema-wide ────────────────────────────────────
--
-- TRUNCATE is not governed by RLS, so it is the one write verb where the
-- grant layer is the ONLY defense. No API surface reaches it today; revoke
-- it everywhere so that stays true by construction. The spatial_ref_sys
-- attempt is a no-op warning (supabase_admin's grant, see header) — the
-- guard trigger in section 1 covers that table's TRUNCATE instead.

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    begin
      execute format('revoke truncate on public.%I from anon, authenticated;', t);
    exception when others then
      raise notice 'truncate revoke skipped on %: %', t, sqlerrm;
    end;
  end loop;
end $$;

-- ── 4. advisor-flagged functions: finish the PUBLIC revokes ─────────────
--
-- Both were already revoked from anon+authenticated (025 / 028), but the
-- Postgres default EXECUTE grant lives on the PUBLIC pseudo-role, and
-- `revoke … from anon, authenticated` does not touch it — the same defect
-- 051→053 fixed for navigator_reserve_provider_units. Revoking PUBLIC here
-- is what actually closes the /rpc path.

revoke execute on function public.preschool_enforce_capacity() from public, anon, authenticated;

revoke all on function public.record_directory_view(uuid) from public, anon, authenticated;
grant execute on function public.record_directory_view(uuid) to service_role;
