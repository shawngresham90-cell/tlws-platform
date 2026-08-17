-- A MINIMAL SUPABASE SHAPE, FOR PLAIN POSTGRESQL ONLY.
--
-- THIS IS NOT A MIGRATION AND MUST NEVER BE APPLIED TO A SUPABASE PROJECT.
-- `scripts/test-live-postgres.mjs` applies it only after confirming that
-- `auth.users` does NOT exist — which on any real Supabase project it always
-- does. Running it there would be creating a counterfeit auth schema beside
-- the real one.
--
-- WHY IT EXISTS. Migrations 049–051 reference four things Supabase provides
-- and stock PostgreSQL does not: the `anon` / `authenticated` / `service_role`
-- roles, the `auth` schema with `auth.users`, `auth.uid()`, and this
-- repository's own `public.tlws_set_updated_at()` trigger function (added back
-- in migration 013). Without them the migrations cannot execute anywhere
-- except Supabase, and "does this SQL actually run?" stays unanswerable on a
-- throwaway cluster.
--
-- WHAT IT IS AND IS NOT EVIDENCE OF. It makes the migrations executable and
-- the reservation function's concurrency, RLS and grant behaviour testable
-- against a real server. It is NOT evidence that the real Supabase project's
-- auth schema behaves identically — that is exactly what a disposable Supabase
-- test project is for, and this shim does not substitute for one.
--
-- `auth.uid()` is defined the way Supabase defines it: reading the `sub` claim
-- out of the `request.jwt.claims` GUC. That is the part the RLS tests depend
-- on, so it is copied faithfully rather than approximated.

create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

-- The identity table the migrations' foreign keys point at. Only the columns
-- 049/050/051 actually reference.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  created_at timestamptz not null default now()
);

-- Supabase's own definition, copied so the RLS tests exercise the real rule.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;

/*
 * Supabase's DEFAULT TABLE GRANTS, which the migrations assume and stock
 * PostgreSQL does not give.
 *
 * This matters more than it looks. On Supabase, `anon` and `authenticated`
 * hold table privileges on everything in `public`, and RLS — not the grant —
 * is what actually decides which rows they see. Without these grants a
 * cross-user read fails with "permission denied for table", which LOOKS like
 * the test passing while proving something entirely different: that the role
 * could not reach the table at all, rather than that the policy filtered it.
 *
 * With the grants in place, an RLS refusal is what it is on the real
 * platform — a query that succeeds and returns zero rows.
 *
 * Migration 051 then REVOKEs these privileges back off the usage ledger
 * specifically, which is why the ledger tests still expect a hard denial.
 * That contrast is only visible if the baseline matches Supabase first.
 */
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;

/*
 * FUNCTIONS TOO — AND OMITTING THIS HID A CRITICAL DEFECT.
 *
 * Supabase's bootstrap grants default EXECUTE on new functions in `public` to
 * all three roles, exactly as it does for tables. This shim modelled tables and
 * sequences but not functions, and the gap was not academic: §9 of
 * `test-live-postgres.mjs` asserted "anon CANNOT execute the reservation
 * function" and passed here, while on a real Supabase project anon and
 * authenticated both held EXECUTE on it. Migration 053 is the repair; this line
 * is why the test can see the thing it claims to test.
 *
 * Read off the production project's own `pg_default_acl`, which reads
 * `anon=X/postgres | authenticated=X/postgres | service_role=X/postgres` for
 * object type `f`.
 *
 * A TEST ENVIRONMENT THAT IS SAFER THAN PRODUCTION DOES NOT TEST PRODUCTION.
 * Every privilege default this shim omits is a class of finding the live suite
 * is structurally unable to report.
 */
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;

-- From migration 013. Re-created here only when absent, because a throwaway
-- cluster starts from nothing rather than from migration 001.
create or replace function public.tlws_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;
