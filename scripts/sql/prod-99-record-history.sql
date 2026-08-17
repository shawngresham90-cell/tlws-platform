-- =========================================================================
-- 99 — MIGRATION HISTORY ROWS
-- =========================================================================
-- Runs LAST, inside the same single transaction as the guard and migrations
-- 049-053. Schema and history therefore commit together or not at all: there
-- is no window in which applied schema carries no history record.
--
-- Six rows. One repairs a record-keeping gap; five record this run.
--
-- ---------------------------------------------------------------------------
-- ROW 1 — 047, RECONSTRUCTED, SCHEMA NOT RE-RUN
--
-- Migration 047's schema is ALREADY APPLIED to production and was verified
-- byte-equivalent during the preflight: all 6 columns match on type,
-- precision (numeric(6,2)), nullability and default; all 7 check constraints
-- match; the partial index matches. Only its history row is missing, because
-- it was applied through a flow that does not write schema_migrations.
--
-- THIS INSERT RE-RUNS NOTHING. It is metadata only.
--
-- `20260729173844` IS RECONSTRUCTED AND IS NOT A CLAIMED PRODUCTION
-- APPLICATION TIMESTAMP. Provenance:
--   - Git commit 13f2694c8c63c5c93d6e407269f7f215289e2c86, author date
--     2026-07-29T17:38:44Z, which introduced the file and whose message reads
--     "M1 migration 047 (applied live, byte-identical to reviewed plan)".
--   - data/imports/rest-area-2026-07-29/M1-EXECUTION-RECORD.md, headed
--     "M1 execution record — migration 047 (2026-07-29)", recording
--     "Applied via the guarded connected Supabase flow (single transaction)"
--     and "Column count 44 -> 50".
-- The DATE is attested by both sources. The TIME OF DAY is the Git author
-- date, used as the best available anchor: PostgreSQL stores no DDL
-- application timestamp, so the true wall-clock moment is unrecoverable.
-- The value sorts strictly between 046 (20260724095153) and 048
-- (20260802002530), which is the ordering it must preserve.
--
-- ---------------------------------------------------------------------------
-- ROWS 2-6 — 049 THROUGH 053, PREDETERMINED
--
-- These five versions were fixed at PREPARATION time (2026-08-17) rather than
-- generated at apply time, so that the reviewed command is byte-identical to
-- the executed command and this file can be hashed and checked. They are
-- sequential, collision-checked against production, and sort after every
-- existing row including the reconstructed 047.
--
-- The honest caveat: the repository's convention assigns a version at APPLY
-- time, so these will read very slightly EARLIER than the moment the
-- transaction actually commits. That costs nothing — ordering against every
-- other row is correct and unambiguous — and it buys a package that can be
-- reviewed and verified rather than assembled at the keyboard.
--
-- `statements` and `rollback` are left null. Existing rows carry a one-element
-- `statements` array; this is a deliberate, documented divergence rather than
-- an oversight. Both columns are nullable and neither is read by anything.

insert into supabase_migrations.schema_migrations (version, name) values
  ('20260729173844', '047_mile_marker_overnight_status'),
  ('20260817020000', '049_email_consents'),
  ('20260817020001', '050_navigator_accounts'),
  ('20260817020002', '051_navigator_provider_usage'),
  ('20260817020003', '052_navigator_account_table_privileges'),
  ('20260817020004', '053_navigator_reservation_service_role_only');

-- Post-condition, inside the transaction: exactly six rows, no more, no less.
-- A duplicate or a missing row aborts the whole run rather than committing a
-- history that disagrees with the schema beside it.
do $verify$
declare
  v_count integer;
begin
  select count(*) into v_count
    from supabase_migrations.schema_migrations
   where version in ('20260729173844','20260817020000','20260817020001',
                     '20260817020002','20260817020003','20260817020004');

  if v_count <> 6 then
    raise exception
      'HISTORY POST-CONDITION: expected 6 rows, found %. Rolling back the entire transaction.', v_count;
  end if;

  raise notice 'HISTORY RECORDED: 047 (reconstructed) + 049-053. Transaction ready to commit.';
end
$verify$;
