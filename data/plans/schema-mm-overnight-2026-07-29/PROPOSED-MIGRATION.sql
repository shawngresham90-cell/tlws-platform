-- ============================================================================
-- INERT PLAN — DO NOT EXECUTE
-- Proposed migration: verified mile_marker + three-way overnight_status.
-- This file lives in data/plans/ (never auto-applied; verified: no CI/Netlify
-- step applies supabase/migrations either). On explicit owner authorization it
-- will be copied to supabase/migrations/047_mile_marker_overnight_status.sql
-- and applied via the guarded Supabase MCP flow.
--
-- Properties: single transaction; fail-closed drift guards; additive only
-- (no existing column/policy/grant/trigger is modified); writes NO data
-- values — every row's overnight_status lands on the default 'unknown' and
-- every mile_marker is NULL. No exit number is copied anywhere.
-- ============================================================================

begin;

-- Drift guard: abort if any target object already exists (fail-closed).
do $guard$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'locations'
               and column_name in ('mile_marker', 'mile_marker_source',
                                   'mile_marker_verified_at', 'overnight_status',
                                   'overnight_status_source', 'overnight_status_verified_at')) then
    raise exception 'schema drift: a target column already exists on public.locations';
  end if;
  if exists (select 1 from pg_constraint
             where conrelid = 'public.locations'::regclass
               and conname in ('locations_mile_marker_range_check',
                               'locations_mile_marker_provenance_check',
                               'locations_overnight_status_check',
                               'locations_overnight_source_check',
                               'locations_overnight_provenance_check',
                               'locations_overnight_no_contradiction_check',
                               'locations_mile_marker_source_check')) then
    raise exception 'schema drift: a target constraint already exists on public.locations';
  end if;
  if exists (select 1 from pg_indexes
             where schemaname = 'public' and tablename = 'locations'
               and indexname = 'locations_corridor_position_idx') then
    raise exception 'schema drift: locations_corridor_position_idx already exists';
  end if;
end
$guard$;

-- Route position: exact decimal, NULL = unknown. NEVER populated from an
-- exit number — provenance is structurally required (pairing check below).
alter table public.locations
  add column mile_marker numeric(6,2),
  add column mile_marker_source text,
  add column mile_marker_verified_at timestamptz;

alter table public.locations
  add constraint locations_mile_marker_range_check
    check (mile_marker is null or (mile_marker >= 0 and mile_marker <= 1500)),
  add constraint locations_mile_marker_source_check
    check (mile_marker_source is null
           or mile_marker_source in ('state-dot', 'official-operator', 'manual')),
  -- a value requires provenance; provenance requires a value
  add constraint locations_mile_marker_provenance_check
    check ((mile_marker is null) = (mile_marker_source is null));

-- Overnight: three-way honest status. Default 'unknown' for every existing
-- and future row; confirmed/prohibited REQUIRE provenance.
alter table public.locations
  add column overnight_status text not null default 'unknown',
  add column overnight_status_source text,
  add column overnight_status_verified_at timestamptz;

alter table public.locations
  add constraint locations_overnight_status_check
    check (overnight_status in ('confirmed', 'prohibited', 'unknown')),
  add constraint locations_overnight_source_check
    check (overnight_status_source is null
           or overnight_status_source in ('official-operator-export', 'state-dot',
                                          'operator-direct', 'manual')),
  add constraint locations_overnight_provenance_check
    check (overnight_status = 'unknown' or overnight_status_source is not null),
  -- anti-drift: the legacy boolean may never claim OK while status says prohibited
  add constraint locations_overnight_no_contradiction_check
    check (not (overnight_parking = true and overnight_status = 'prohibited'));

-- Corridor route-position queries: state + interstate with position in-index.
create index locations_corridor_position_idx
  on public.locations (state, interstate, mile_marker, exit_number)
  where deleted_at is null and is_published = true;

-- Post-conditions (fail-closed): all six columns present, status default sane.
do $verify$
declare
  col_count integer;
begin
  select count(*) into col_count from information_schema.columns
  where table_schema = 'public' and table_name = 'locations'
    and column_name in ('mile_marker', 'mile_marker_source', 'mile_marker_verified_at',
                        'overnight_status', 'overnight_status_source', 'overnight_status_verified_at');
  if col_count <> 6 then
    raise exception 'post-condition failed: expected 6 new columns, found %', col_count;
  end if;
  if exists (select 1 from public.locations where overnight_status <> 'unknown') then
    raise exception 'post-condition failed: a row left the unknown default during migration';
  end if;
  if exists (select 1 from public.locations where mile_marker is not null) then
    raise exception 'post-condition failed: a mile_marker value appeared during migration';
  end if;
end
$verify$;

commit;
