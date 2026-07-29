-- M2 Love's overnight-status backfill — AS-EXECUTED script (2026-07-29).
-- Reviewed semantics from PROPOSED-BACKFILL.sql (merged PR #207) with the
-- owner's M2 authorization guards layered on ADDITIVELY (nothing weakened):
--   * exact cohort identity: md5 of the ordered id set must equal the
--     preflight fingerprint d68a000a205e14cfd7c58b4e60da34dc (re-derived
--     from the checksummed official export via the guarded import's source
--     tag + the evidenced overnight closeouts of PRs #202/#203 — never
--     name-only matching)
--   * operator evidence intact: overnight_parking = true (set only under
--     export overnight = Y in the guarded closeouts)
--   * positive parking count required on every row
--   * no held/conflicting record: cohort excludes the 10 unconfirmed
--     Love's rows by definition (overnight_parking = false)
--   * current status still 'unknown' (correction-safe)
--   * legacy csv-import true queue must equal exactly 330 and is NOT
--     touched (Option A binding)
--   * exact row count 541 or the transaction aborts (automatic rollback)
--   * writes ONLY confirmed/official-operator-export/now(); never
--     'prohibited'; never mile_marker; overnight_parking never modified.
-- Value-matched rollback committed alongside BEFORE execution:
-- M2-ROLLBACK.sql.

begin;

do $backfill$
declare
  updated integer;
  cohort_fp text;
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'locations'
                   and column_name = 'overnight_status') then
    raise exception 'backfill guard: overnight_status column missing — apply migration 047 first';
  end if;

  -- Exact cohort identity (ids, not names).
  select md5(string_agg(id::text, ',' order by id)) into cohort_fp
  from public.locations
  where deleted_at is null
    and source = 'loves-master-2026-07-27'
    and overnight_parking = true;
  if cohort_fp is distinct from 'd68a000a205e14cfd7c58b4e60da34dc' then
    raise exception 'backfill guard: cohort id fingerprint % != authorized d68a000a… — re-audit', cohort_fp;
  end if;

  if (select count(*) from public.locations
      where deleted_at is null
        and source = 'loves-master-2026-07-27'
        and overnight_parking = true) <> 541 then
    raise exception 'backfill guard: cohort is not 541 rows';
  end if;

  if (select count(*) from public.locations
      where deleted_at is null
        and source = 'loves-master-2026-07-27'
        and overnight_parking = true
        and (parking_spaces is null or parking_spaces <= 0)) <> 0 then
    raise exception 'backfill guard: a cohort row lacks a positive parking count';
  end if;

  -- Option A binding: legacy queue accounted and untouched.
  if (select count(*) from public.locations
      where deleted_at is null and source = 'csv-import' and overnight_parking = true) <> 330 then
    raise exception 'backfill guard: legacy csv-import true queue is not 330 — re-audit';
  end if;

  update public.locations
     set overnight_status             = 'confirmed',
         overnight_status_source      = 'official-operator-export',
         overnight_status_verified_at = now()
   where deleted_at is null
     and source = 'loves-master-2026-07-27'
     and overnight_parking = true
     and parking_spaces > 0
     and overnight_status = 'unknown';   -- never overwrite a later correction

  get diagnostics updated = row_count;
  if updated <> 541 then
    raise exception 'backfill guard: expected 541 confirmations, got % — aborting', updated;
  end if;

  -- Post-conditions.
  if exists (select 1 from public.locations where overnight_status = 'prohibited') then
    raise exception 'backfill post-condition failed: a prohibited status appeared';
  end if;
  if exists (select 1 from public.locations
             where overnight_status <> 'unknown'
               and (source in ('pilot-master-2026-07-27', 'official-ta-petro-20260725-5ebe0e9f',
                               'ntad-2019-v04')
                    or source = 'csv-import')) then
    raise exception 'backfill post-condition failed: a non-Love''s row left unknown';
  end if;
  if (select count(*) from public.locations where overnight_status = 'confirmed') <> 541 then
    raise exception 'backfill post-condition failed: confirmed total is not 541';
  end if;
end
$backfill$;

commit;
