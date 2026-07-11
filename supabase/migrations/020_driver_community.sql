-- Milestone 16: Driver Community Platform.
-- Additive: driver submissions, per-location change history, and community
-- profiles (trust levels), plus an in-place upgrade of the empty legacy
-- location_reviews table (created in 003, never used by app code) to the
-- moderated model. Nothing publishes automatically — every row starts
-- pending and flows through the admin dashboard. RLS is enabled with NO
-- public policies: only the service-role key (server routes and the gated
-- admin dashboard) can touch these tables; the anon key sees nothing, so
-- pending content is unreachable from the browser by construction.

-- ---------------------------------------------------------------- profiles
-- P5 trust system: model support only (no login yet). Admins create/attach
-- profiles by hand; badges surface once identity exists.
create table if not exists public.community_profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  contact text,
  trust_level text not null default 'none'
    check (trust_level in ('none', 'verified-driver', 'verified-company', 'verified-owner', 'moderator')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------- submissions
create table if not exists public.location_submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null
    check (kind in ('new', 'correction', 'closure', 'missing-info', 'amenity-change')),
  -- The existing listing this refers to (null for kind = 'new').
  location_id uuid references public.locations(id) on delete set null,
  name text not null,
  category_slug text,
  address text,
  city text,
  state text,
  zip text,
  phone text,
  website text,
  description text,
  amenities jsonb not null default '[]'::jsonb,
  -- Nullable on purpose: null = "driver didn't say", distinct from yes/no.
  free_parking boolean,
  paid_parking boolean,
  reserved_parking boolean,
  overnight_parking boolean,
  parking_spaces integer,
  comments text,
  -- Photo upload placeholder: URLs only, no storage integration yet.
  photo_urls jsonb not null default '[]'::jsonb,
  submitter_name text,
  submitter_contact text,
  profile_id uuid references public.community_profiles(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'duplicate', 'merged')),
  admin_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists location_submissions_status_idx
  on public.location_submissions (status, created_at desc);
create index if not exists location_submissions_location_idx
  on public.location_submissions (location_id)
  where location_id is not null;

-- ----------------------------------------------------------------- reviews
-- Upgrade the legacy table (003) in place: it has 0 rows and no app-code
-- references. is_approved gives way to a full moderation status; the old
-- anon-read policy is dropped because approved reviews are now served by
-- server components via the service client.
drop policy if exists anon_read_reviews on public.location_reviews;
drop index if exists public.location_reviews_location;
alter table public.location_reviews
  add column if not exists visited_on date,
  add column if not exists truck_type text,
  add column if not exists profile_id uuid references public.community_profiles(id) on delete set null,
  add column if not exists status text not null default 'pending',
  add column if not exists admin_note text,
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();
update public.location_reviews
  set status = case when is_approved then 'approved' else 'pending' end;
alter table public.location_reviews
  drop column if exists is_approved;
do $$ begin
  alter table public.location_reviews
    add constraint location_reviews_status_check
    check (status in ('pending', 'approved', 'rejected', 'duplicate', 'merged'));
exception when duplicate_object then null; end $$;

create index if not exists location_reviews_status_idx
  on public.location_reviews (status, created_at desc);
-- Approved-review lookups per listing (aggregate rating, review schema).
create index if not exists location_reviews_location_approved_idx
  on public.location_reviews (location_id)
  where status = 'approved';

-- ----------------------------------------------------------------- history
-- P4: every approved change writes a history row BEFORE the listing changes;
-- listings are never overwritten without a record of what changed.
create table if not exists public.location_history (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  source text not null
    check (source in ('submission', 'review', 'admin-edit', 'merge', 'closure')),
  source_id uuid,
  admin text not null,
  -- { field: { from: ..., to: ... } } per changed column.
  changed_fields jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists location_history_location_idx
  on public.location_history (location_id, created_at desc);

-- --------------------------------------------------------------------- RLS
alter table public.community_profiles enable row level security;
alter table public.location_submissions enable row level security;
alter table public.location_reviews enable row level security;
alter table public.location_history enable row level security;
