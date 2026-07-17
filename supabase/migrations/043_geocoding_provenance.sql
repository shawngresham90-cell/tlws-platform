-- Phase 2A (Trip Planner data readiness): geocoding provenance. Additive
-- only — new nullable columns on public.locations, no defaults that rewrite
-- rows, no changes to existing columns, data, policies, or shipped
-- migrations. Idempotent: every statement is IF NOT EXISTS-guarded (inline
-- CHECK constraints are created only when their column is created).
--
-- Purpose: today a coordinate on a listing says nothing about WHERE it came
-- from, HOW confident we are, or WHETHER a human verified it. These columns
-- let the geocoding pipeline (dry-run now, applies later) record provenance
-- alongside the existing location_history audit trail:
--   geocode_source          — how the coordinate was produced
--   geocode_confidence      — producer's confidence (mirrors batch CSV values)
--   coord_verification_status — lifecycle: unverified → machine-checked →
--                                manually-verified (or disputed)
--   last_geocoded_at        — when the coordinate was last produced/applied
--   manually_verified_at/by — who signed off, and when

alter table public.locations
  add column if not exists geocode_source text
    check (geocode_source in ('import', 'batch-csv', 'interpolation', 'external-api', 'manual'));

alter table public.locations
  add column if not exists geocode_confidence text
    check (geocode_confidence in ('high', 'medium', 'low'));

alter table public.locations
  add column if not exists coord_verification_status text
    check (coord_verification_status in ('unverified', 'machine-checked', 'manually-verified', 'disputed'));

alter table public.locations
  add column if not exists last_geocoded_at timestamptz;

alter table public.locations
  add column if not exists manually_verified_at timestamptz;

alter table public.locations
  add column if not exists manually_verified_by text;

comment on column public.locations.geocode_source is
  'How the current lat/lng was produced: import | batch-csv | interpolation | external-api | manual. Null = pre-provenance coordinate (or no coordinate).';
comment on column public.locations.geocode_confidence is
  'Producer confidence for the current lat/lng, mirroring the geocoding batch CSV values (high | medium | low).';
comment on column public.locations.coord_verification_status is
  'Coordinate verification lifecycle: unverified | machine-checked | manually-verified | disputed. Null = never assessed.';
comment on column public.locations.last_geocoded_at is
  'When the current lat/lng was last produced or applied.';
comment on column public.locations.manually_verified_at is
  'When a human last verified the coordinate (map/street-level check).';
comment on column public.locations.manually_verified_by is
  'Who manually verified the coordinate (admin identifier, free text).';

-- Review-queue reads ("what still needs coordinate verification?") stay fast
-- as the table grows; partial index keeps it tiny.
create index if not exists locations_coord_verification_idx
  on public.locations (coord_verification_status)
  where deleted_at is null
    and lat is not null
    and lng is not null
    and (coord_verification_status is null or coord_verification_status <> 'manually-verified');
