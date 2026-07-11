-- Milestone 17: geocoding + near-me foundation. Additive only:
--   1) location_history accepts source = 'geocoding' (coordinate applies are
--      recorded like every other listing change — history before mutation)
--   2) indexes for coordinate-ready reads and radius queries
--   3) nearby_locations(): the "Near Me" RPC — published/non-deleted rows
--      with coordinates, optional category filter, radius + limit hard-capped,
--      nearest first. SECURITY INVOKER on purpose: called with the anon key
--      it still runs under RLS (published-only), and it only ever SELECTs.

-- ------------------------------------------------------------- history source
alter table public.location_history drop constraint location_history_source_check;
alter table public.location_history add constraint location_history_source_check
  check (source in ('submission', 'review', 'admin-edit', 'merge', 'closure', 'geocoding'));

-- ------------------------------------------------------------------- indexes
-- Fast "published rows that have coordinates" scans (map + near-me).
create index if not exists locations_coords_published_idx
  on public.locations (lat, lng)
  where is_published = true and deleted_at is null and lat is not null and lng is not null;

-- Geography index so radius queries stay fast as the table grows to
-- thousands of rows (expression matches the RPC's distance operand).
create index if not exists locations_geog_gist_idx
  on public.locations
  using gist ((st_setsrid(st_makepoint(lng, lat), 4326)::geography))
  where deleted_at is null and lat is not null and lng is not null;

-- ----------------------------------------------------------------- near-me RPC
create or replace function public.nearby_locations(
  in_lat double precision,
  in_lng double precision,
  in_radius_miles double precision default 100,
  in_category text default null,
  in_limit integer default 25
)
returns table (
  id uuid,
  name text,
  category_slug text,
  state text,
  city text,
  slug text,
  address text,
  zip text,
  phone text,
  website text,
  lat double precision,
  lng double precision,
  interstate text,
  exit_number text,
  distance_miles double precision
)
language sql
stable
set search_path = public
as $$
  select
    l.id, l.name, l.category_slug, l.state::text, l.city, l.slug, l.address, l.zip,
    l.phone, l.website, l.lat, l.lng, l.interstate, l.exit_number,
    round((st_distancesphere(st_makepoint(l.lng, l.lat), st_makepoint(in_lng, in_lat))
      / 1609.344)::numeric, 2)::double precision as distance_miles
  from public.locations l
  where
    -- strict input validation: bad origins return nothing instead of erroring
    in_lat is not null and in_lng is not null
    and in_lat between -90 and 90
    and in_lng between -180 and 180
    and not (in_lat = 0 and in_lng = 0)
    and l.is_published = true
    and l.deleted_at is null
    and l.lat is not null and l.lng is not null
    and (in_category is null or in_category = '' or l.category_slug = in_category)
    and st_distancesphere(st_makepoint(l.lng, l.lat), st_makepoint(in_lng, in_lat))
        <= least(greatest(coalesce(in_radius_miles, 100), 1), 500) * 1609.344
  order by st_distancesphere(st_makepoint(l.lng, l.lat), st_makepoint(in_lng, in_lat)) asc
  limit least(greatest(coalesce(in_limit, 25), 1), 100)
$$;

-- Read-only RPC: callable by the public keys, never grants any write path.
revoke all on function public.nearby_locations(
  double precision, double precision, double precision, text, integer) from public;
grant execute on function public.nearby_locations(
  double precision, double precision, double precision, text, integer)
  to anon, authenticated, service_role;
