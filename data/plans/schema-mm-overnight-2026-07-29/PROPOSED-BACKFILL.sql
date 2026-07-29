-- ============================================================================
-- INERT PLAN — DO NOT EXECUTE
-- Evidence-based backfill (milestone M2, requires its own authorization,
-- runs only after PROPOSED-MIGRATION.sql is applied and verified).
--
-- Scope — the ONLY status write this plan proposes:
--   confirmed  <- exactly the loves-master-2026-07-27 rows whose legacy
--                 boolean was set to true in the guarded overnight-closeout
--                 milestones against the official Love's export (541 rows).
--   prohibited <- NOTHING. Zero rows hold explicit authoritative prohibition
--                 evidence today, and unknown values must never drift to
--                 prohibited without it.
--   unknown    <- everything else BY DEFAULT — no write occurs.
--
-- Explicitly excluded from confirmation (evidence rules):
--   * pilot-master-2026-07-27 (718 rows) — export had no overnight field
--   * official-ta-petro-20260725-5ebe0e9f (304 rows) — space counts only
--   * csv-import legacy true (330 rows) — manual review queue, never auto
--   * ntad-2019-v04 (5 rows) — canaries stay unknown
--
-- Correction-safe: the predicate `overnight_status = 'unknown'` means
-- re-running this can never overwrite a status set after it (idempotent,
-- and later manual corrections always win).
-- ============================================================================

begin;

do $backfill$
declare
  updated integer;
begin
  -- Pre-condition: schema present.
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'locations'
                   and column_name = 'overnight_status') then
    raise exception 'backfill guard: overnight_status column missing — apply migration 047 first';
  end if;

  -- Pre-condition: the evidence cohort is exactly the expected 541 rows.
  if (select count(*) from public.locations
      where deleted_at is null
        and source = 'loves-master-2026-07-27'
        and overnight_parking = true) <> 541 then
    raise exception 'backfill guard: Love''s evidence cohort is not 541 rows — re-audit before writing';
  end if;

  update public.locations
     set overnight_status             = 'confirmed',
         overnight_status_source      = 'official-operator-export',
         overnight_status_verified_at = now()
   where deleted_at is null
     and source = 'loves-master-2026-07-27'
     and overnight_parking = true
     and overnight_status = 'unknown';   -- never overwrite a later correction

  get diagnostics updated = row_count;
  if updated <> 541 then
    raise exception 'backfill guard: expected 541 confirmations, got % — aborting', updated;
  end if;

  -- Post-conditions: no prohibited rows were created; Pilot/TA/NTAD/legacy
  -- rows remain unknown.
  if exists (select 1 from public.locations where overnight_status = 'prohibited') then
    raise exception 'backfill post-condition failed: a prohibited status appeared';
  end if;
  if exists (select 1 from public.locations
             where overnight_status <> 'unknown'
               and (source in ('pilot-master-2026-07-27', 'official-ta-petro-20260725-5ebe0e9f',
                               'ntad-2019-v04')
                    or (source = 'csv-import'))) then
    raise exception 'backfill post-condition failed: a non-Love''s row left unknown';
  end if;
end
$backfill$;

commit;

-- Value-matched rollback for this backfill (also inert; run only if M2 must
-- be reversed before any manual correction):
--   update public.locations
--      set overnight_status = 'unknown',
--          overnight_status_source = null,
--          overnight_status_verified_at = null
--    where deleted_at is null
--      and source = 'loves-master-2026-07-27'
--      and overnight_parking = true
--      and overnight_status = 'confirmed'
--      and overnight_status_source = 'official-operator-export';
--   -- expected row_count: 541 (guard identically when executed)
