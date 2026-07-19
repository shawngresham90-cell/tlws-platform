-- 044: Cloud sync for Trip Planner saved trips + truck presets.
--
-- Additive and idempotent. Two owner-scoped tables let a signed-in driver sync
-- their saved trips and truck presets across devices. Everything is keyed to
-- auth.users and guarded by RLS so a user can only ever see or change their own
-- rows — ownership is derived from the session (auth.uid()), NEVER from a
-- client-supplied value. Recent searches are deliberately NOT stored here; they
-- stay device-local for privacy. This does not touch the admin auth system.
--
-- `client_id` is a stable, client-generated identifier (the local store's id)
-- used for offline-merge de-duplication and idempotent upserts. It is unique
-- PER USER, not globally, so two users can independently hold the same local id.

-- saved_trips ---------------------------------------------------------------
create table if not exists public.saved_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  name text not null,
  origin_label text not null,
  origin_lat double precision not null,
  origin_lng double precision not null,
  destination_label text not null,
  destination_lat double precision not null,
  destination_lng double precision not null,
  truck jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_planned_at timestamptz,
  -- Bound the coordinate ranges at the database as defense in depth.
  constraint saved_trips_origin_lat_range check (origin_lat between -90 and 90),
  constraint saved_trips_origin_lng_range check (origin_lng between -180 and 180),
  constraint saved_trips_dest_lat_range check (destination_lat between -90 and 90),
  constraint saved_trips_dest_lng_range check (destination_lng between -180 and 180),
  -- One row per (user, client_id) enables idempotent upsert + offline merge.
  constraint saved_trips_user_client_uniq unique (user_id, client_id)
);

create index if not exists saved_trips_user_id_idx on public.saved_trips (user_id);
create index if not exists saved_trips_user_updated_idx
  on public.saved_trips (user_id, updated_at desc);

-- truck_presets -------------------------------------------------------------
create table if not exists public.truck_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  name text not null,
  height_ft double precision not null,
  length_ft double precision not null,
  gross_weight_lbs double precision not null,
  axles integer not null,
  hazmat_class text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint truck_presets_height_range check (height_ft between 8 and 15),
  constraint truck_presets_length_range check (length_ft between 20 and 120),
  constraint truck_presets_weight_range check (gross_weight_lbs between 10000 and 164000),
  constraint truck_presets_axles_range check (axles between 2 and 9),
  constraint truck_presets_user_client_uniq unique (user_id, client_id)
);

create index if not exists truck_presets_user_id_idx on public.truck_presets (user_id);
create index if not exists truck_presets_user_updated_idx
  on public.truck_presets (user_id, updated_at desc);

-- updated_at maintenance (reuses the shared trigger fn from earlier migrations)
drop trigger if exists set_updated_at on public.saved_trips;
create trigger set_updated_at before update on public.saved_trips
  for each row execute function public.tlws_set_updated_at();

drop trigger if exists set_updated_at on public.truck_presets;
create trigger set_updated_at before update on public.truck_presets
  for each row execute function public.tlws_set_updated_at();

-- RLS: strict owner-only access. auth.uid() = user_id on every operation.
alter table public.saved_trips enable row level security;
alter table public.truck_presets enable row level security;

-- saved_trips policies (idempotent: drop-if-exists then create)
drop policy if exists saved_trips_select_own on public.saved_trips;
create policy saved_trips_select_own on public.saved_trips
  for select to authenticated using (user_id = auth.uid());

drop policy if exists saved_trips_insert_own on public.saved_trips;
create policy saved_trips_insert_own on public.saved_trips
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists saved_trips_update_own on public.saved_trips;
create policy saved_trips_update_own on public.saved_trips
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists saved_trips_delete_own on public.saved_trips;
create policy saved_trips_delete_own on public.saved_trips
  for delete to authenticated using (user_id = auth.uid());

-- truck_presets policies
drop policy if exists truck_presets_select_own on public.truck_presets;
create policy truck_presets_select_own on public.truck_presets
  for select to authenticated using (user_id = auth.uid());

drop policy if exists truck_presets_insert_own on public.truck_presets;
create policy truck_presets_insert_own on public.truck_presets
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists truck_presets_update_own on public.truck_presets;
create policy truck_presets_update_own on public.truck_presets
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists truck_presets_delete_own on public.truck_presets;
create policy truck_presets_delete_own on public.truck_presets
  for delete to authenticated using (user_id = auth.uid());

-- No anon access at all; authenticated users reach rows only through RLS.
revoke all on public.saved_trips from anon;
revoke all on public.truck_presets from anon;
grant select, insert, update, delete on public.saved_trips to authenticated;
grant select, insert, update, delete on public.truck_presets to authenticated;
