-- 002: Locations (directory backbone — shaped now, populated Phase 3)
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('truck_stop','rest_area','weigh_station','parking','repair','cdl_school','other')),
  name text not null,
  state char(2) not null,
  city text not null,
  slug text not null,
  address text,
  zip text,
  phone text,
  website text,
  geo geography(point, 4326),
  hours jsonb default '{}'::jsonb,
  amenities jsonb default '[]'::jsonb,
  fuel_brands text[],
  parking_spaces int,
  description text,
  completeness_score int not null default 0 check (completeness_score between 0 and 100),
  is_indexable boolean not null default false, -- thin-content gate
  source text default 'manual',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint locations_composite_slug unique (type, state, city, slug)
);

create index locations_geo_gist on public.locations using gist (geo);
create index locations_type_state_city on public.locations (type, state, city) where deleted_at is null;
create index locations_indexable on public.locations (is_indexable) where deleted_at is null;
create index locations_name_trgm on public.locations using gin (name gin_trgm_ops);
create index locations_amenities_gin on public.locations using gin (amenities);
