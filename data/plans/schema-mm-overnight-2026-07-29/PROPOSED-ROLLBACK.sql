-- ============================================================================
-- INERT PLAN — DO NOT EXECUTE
-- Rollback for PROPOSED-MIGRATION.sql. Drops, in dependency order, exactly
-- the objects that migration adds: 1 index, 7 constraints, 6 columns.
-- Guarded so it is safe to run once and a no-op error if the migration never
-- ran (fail-closed rather than silently "succeeding").
--
-- WARNING (correction safety): running this AFTER the M2 backfill or after
-- manual status/mile-marker corrections DELETES those values with the
-- columns. The backfill is deterministically re-runnable from the committed
-- manifest, but manual corrections are not — export them first
-- (select id, overnight_status, overnight_status_source,
--         overnight_status_verified_at, mile_marker, mile_marker_source,
--         mile_marker_verified_at from public.locations
--   where overnight_status <> 'unknown' or mile_marker is not null)
-- before rolling back once any correction has been made.
-- ============================================================================

begin;

do $guard$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'locations'
                   and column_name = 'overnight_status') then
    raise exception 'rollback guard: overnight_status does not exist — migration 047 is not applied';
  end if;
end
$guard$;

drop index if exists public.locations_corridor_position_idx;

alter table public.locations
  drop constraint if exists locations_overnight_no_contradiction_check,
  drop constraint if exists locations_overnight_provenance_check,
  drop constraint if exists locations_overnight_source_check,
  drop constraint if exists locations_overnight_status_check,
  drop constraint if exists locations_mile_marker_provenance_check,
  drop constraint if exists locations_mile_marker_source_check,
  drop constraint if exists locations_mile_marker_range_check;

alter table public.locations
  drop column if exists overnight_status_verified_at,
  drop column if exists overnight_status_source,
  drop column if exists overnight_status,
  drop column if exists mile_marker_verified_at,
  drop column if exists mile_marker_source,
  drop column if exists mile_marker;

-- Post-condition: none of the six columns remain.
do $verify$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'locations'
               and column_name in ('mile_marker', 'mile_marker_source', 'mile_marker_verified_at',
                                   'overnight_status', 'overnight_status_source',
                                   'overnight_status_verified_at')) then
    raise exception 'rollback post-condition failed: a target column still exists';
  end if;
end
$verify$;

commit;
