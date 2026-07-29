-- M2 value-matched rollback — committed BEFORE the backfill write.
-- Reverses ONLY rows the backfill set: same cohort predicate, and only
-- where the exact written values are still present (a later manual
-- correction is never clobbered). Count-guarded to exactly 541.

begin;

do $rollback$
declare
  reverted integer;
begin
  update public.locations
     set overnight_status             = 'unknown',
         overnight_status_source      = null,
         overnight_status_verified_at = null
   where deleted_at is null
     and source = 'loves-master-2026-07-27'
     and overnight_parking = true
     and overnight_status = 'confirmed'
     and overnight_status_source = 'official-operator-export';

  get diagnostics reverted = row_count;
  if reverted <> 541 then
    raise exception 'rollback guard: expected 541 reversions, got % — aborting', reverted;
  end if;
end
$rollback$;

commit;
