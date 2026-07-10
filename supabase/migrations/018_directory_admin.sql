-- 018: Directory Admin Foundation (Milestone 12)
-- Additive only: extends public.locations with the fields the admin manages
-- and the category slug the public directory engine reads. No existing
-- columns, rows, or constraints are dropped; all new columns are nullable or
-- defaulted so existing data (and inserts from older code) keep working.

alter table public.locations
  -- Directory category as the public engine's slug (locations.type stays and
  -- is derived from this in code — see lib/directory/admin.ts).
  add column if not exists category_slug text
    check (category_slug in (
      'parking','truck-stops','cat-scales','truck-washes','tire-repair',
      'weigh-stations','hotels-truck-parking','cdl-schools','roadside-service'
    )),
  -- Plain lat/lng for the admin form. The PostGIS geo column remains for the
  -- future map milestone; these are the human-editable source values.
  add column if not exists lat double precision check (lat between -90 and 90),
  add column if not exists lng double precision check (lng between -180 and 180),
  -- Parking attributes
  add column if not exists free_parking boolean not null default false,
  add column if not exists paid_parking boolean not null default false,
  add column if not exists reserved_parking boolean not null default false,
  add column if not exists overnight_parking boolean not null default false,
  -- Monetization
  add column if not exists tpc_url text,
  add column if not exists affiliate_code text,
  -- Media
  add column if not exists image_url text,
  -- Editorial state. is_published is the public visibility gate;
  -- is_indexable (002) remains the separate SEO thin-content gate.
  add column if not exists is_published boolean not null default false,
  add column if not exists is_featured boolean not null default false,
  add column if not exists verified_at timestamptz;

create index if not exists locations_published
  on public.locations (is_published) where deleted_at is null;
create index if not exists locations_category_slug
  on public.locations (category_slug) where deleted_at is null;

-- Public reads: published, non-deleted listings only. (Previously gated on
-- is_indexable, which now strictly means "include in SEO surfaces".) Writes
-- remain service-role only: RLS stays enabled and no anon/authenticated
-- insert/update/delete policy exists on this table.
drop policy if exists anon_read_locations on public.locations;
create policy anon_read_locations on public.locations
  for select to anon using (is_published = true and deleted_at is null);

-- Belt-and-suspenders addendum to 011: Supabase's default grants also include
-- TRUNCATE, which 011 didn't revoke. Unreachable via PostgREST, but there's no
-- reason for public roles to hold it on the directory table.
revoke truncate on public.locations from anon, authenticated;
