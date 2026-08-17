-- =========================================================================
-- 053 — THE RESERVATION FUNCTION IS SERVICE-ROLE ONLY
-- =========================================================================
--
-- WHAT WAS WRONG
--
-- Migration 051 ended with:
--
--   revoke all on function public.navigator_reserve_provider_units(...) from public;
--   grant execute on function public.navigator_reserve_provider_units(...) to authenticated;
--
-- Two separate mistakes are hiding in those two lines.
--
-- FIRST: `revoke … from public` removes only the PUBLIC pseudo-role grant. It
-- does not touch the explicit per-role grants Supabase hands out through
--
--   alter default privileges in schema public grant all on functions
--     to anon, authenticated, service_role;
--
-- which is in the project bootstrap exactly as the tables version is. So on a
-- real Supabase project, 051 leaves EXECUTE held by **anon AND authenticated**
-- — verified by reading `pg_default_acl` on the production project, where the
-- function default ACL reads `anon=X/postgres | authenticated=X/postgres |
-- service_role=X/postgres`.
--
-- SECOND: the `grant … to authenticated` was never needed. Nothing in this
-- repository calls this function as a signed-in user. `reserveProviderUnits`
-- in `src/lib/navigator-api/usage-reservation.ts` builds a service-role client
-- through `createAdminClient()`, which is `server-only` and cannot be imported
-- into a client component. The grant bought no capability the application
-- uses, and cost the one described below.
--
-- WHY IT MATTERS — THE FUNCTION TRUSTS EVERY ARGUMENT
--
-- PostgREST exposes any function in an exposed schema to any role holding
-- EXECUTE, as `POST /rest/v1/rpc/<name>`. `public` is exposed. So a browser
-- holding nothing but the PUBLISHABLE anon key could reach this function, and
-- a signed-in driver certainly could.
--
-- And the function takes all six of its inputs from the caller:
--
--   p_user_id            -- whose budget is charged
--   p_endpoint           -- which ledger row is credited
--   p_units              -- how much to charge
--   p_month              -- which bucket
--   p_global_threshold   -- the ceiling it checks itself against
--   p_user_limit         -- the per-driver ceiling it checks itself against
--
-- The last two are the ones that turn this from untidy into critical. The
-- function is SECURITY DEFINER, so it runs as its owner, and it compares the
-- new total against a threshold THE CALLER SUPPLIED rather than one the server
-- knows. A caller may therefore hand it a threshold of 2147483647 and a units
-- value of 2000000, and the check passes.
--
-- Demonstrated on an isolated PostgreSQL with production-accurate default
-- privileges, three separate abuses, all succeeding before this migration:
--
--   1. ANONYMOUS  — role `anon`, no session at all, reserved units.
--   2. SPOOFING   — driver B passed driver A's uuid and charged 40 units to A,
--                   exhausting a stranger's monthly allowance.
--   3. GLOBAL DoS — one call with a caller-chosen threshold drove the shared
--                   month row to 2,000,041 units against a real server
--                   threshold of 100. Every driver is refused for the rest of
--                   the month, from a single HTTP request.
--
-- (3) is the launch-blocking one. The spend guard's entire purpose is to be
-- the one thing that cannot be talked out of its limit, and it could be talked
-- out of its limit by an argument.
--
-- THE FIX, AND WHY IT IS ONLY A GRANT CHANGE
--
-- The application already does the right thing: the route handler
-- authenticates the driver server-side with a verified `getUser()`, then
-- reserves through the service-role client, passing a user id that can only
-- have come from that verification and thresholds read from server-only
-- environment variables the browser cannot see. The gate is correct. Only the
-- grant was wrong, so only the grant changes here — no function body, no
-- signature, no handler.
--
-- Revoking from `PUBLIC` as well as the three named roles is deliberate
-- belt-and-braces: `revoke from public` alone was what failed in 051, and
-- naming the roles alone would leave a future PUBLIC grant unopposed.
--
-- The grant to `service_role` is written EXPLICITLY rather than left to the
-- project default. Relying on a default ACL is precisely the fragility that
-- produced this defect and the TRUNCATE defect in 050; a privilege the
-- application depends on should be stated where a reader can find it.
--
-- ADDITIVE AND REVERSIBLE. No table, column, policy, function body or
-- signature is created, dropped or altered. Nothing but grants changes, and no
-- row is touched.

-- =========================================================================
-- 1. THE LOCKDOWN
-- =========================================================================

revoke all on function public.navigator_reserve_provider_units(uuid, text, integer, text, integer, integer)
  from public;
revoke all on function public.navigator_reserve_provider_units(uuid, text, integer, text, integer, integer)
  from anon;
revoke all on function public.navigator_reserve_provider_units(uuid, text, integer, text, integer, integer)
  from authenticated;

grant execute on function public.navigator_reserve_provider_units(uuid, text, integer, text, integer, integer)
  to service_role;

comment on function public.navigator_reserve_provider_units(uuid, text, integer, text, integer, integer) is
  'Atomically reserve provider units before an upstream call. SERVICE ROLE ONLY — this function trusts every argument it is given, including both thresholds, so a caller who can reach it can set its own limits. The route handler supplies the user id from a verified getUser() and the thresholds from server-only environment. Never grant EXECUTE to anon or authenticated: see migration 053. Reservations are NEVER refunded — see the no-refund rule in src/lib/navigator-api/usage-guard.ts.';

-- =========================================================================
-- 2. THE DEFAULT THAT CAUSED THIS
-- =========================================================================
-- As in 052, the project-wide `alter default privileges … on functions` line
-- is NOT altered here. It is not a Navigator migration's decision to make, and
-- changing it would silently change every future function in `public`.
--
-- The consequence is the same and must be carried the same way: every
-- migration that creates a function in `public` has to revoke EXECUTE from
-- `anon` and `authenticated` explicitly, because it arrives granted to both.
-- §9 of `scripts/test-live-postgres.mjs` now fails if any `navigator_*`
-- function is executable by either role, so a function added later is covered
-- by a test written today.
--
-- `scripts/sql/supabase-shim.sql` is corrected in the same commit. It modelled
-- the default privileges for TABLES and SEQUENCES but not for FUNCTIONS, and
-- that single omission is why the live suite asserted "anon cannot execute the
-- reservation function" and passed while the opposite was true on Supabase. A
-- test environment that is safer than production does not test production.

-- =========================================================================
-- ROLLBACK
-- =========================================================================
-- Undoing this restores a remotely reachable, caller-parameterised spend
-- guard. It is written out for completeness and should not be run:
--
--   grant execute on function public.navigator_reserve_provider_units(uuid, text, integer, text, integer, integer)
--     to authenticated;
--
-- If some future caller genuinely needs to reserve as the signed-in driver,
-- the answer is NOT this grant. It is a second, differently-shaped function
-- that takes no threshold arguments and derives the user id from `auth.uid()`
-- rather than from a parameter — so that the limits stay on the server side of
-- the trust boundary where they belong.
