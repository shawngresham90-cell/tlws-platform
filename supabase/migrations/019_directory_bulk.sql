-- 019: National Directory Database & Bulk Import (Milestone 13)
-- Additive only. Highway metadata for search, a persistence table for
-- dismissed duplicate pairs, and indexes for the search/sort/pagination
-- paths the bulk-scale admin and public browser use.

alter table public.locations
  -- Highway search: "I-75" style designation and exit number (future-ready —
  -- searchable now, exit-based navigation comes with the map milestone).
  add column if not exists interstate text
    check (interstate is null or char_length(interstate) <= 20),
  add column if not exists exit_number text
    check (exit_number is null or char_length(exit_number) <= 20);

-- Duplicate pairs an admin reviewed and chose to keep. Ordered (a < b) so a
-- pair is stored exactly once. RLS on with NO policies: service-role only.
create table if not exists public.location_duplicate_ignores (
  a uuid not null references public.locations(id) on delete cascade,
  b uuid not null references public.locations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b),
  constraint duplicate_pair_ordered check (a < b)
);
alter table public.location_duplicate_ignores enable row level security;
revoke all on public.location_duplicate_ignores from anon, authenticated;

-- Search / sort / pagination indexes (partial on live rows).
create index if not exists locations_zip on public.locations (zip)
  where deleted_at is null;
create index if not exists locations_interstate on public.locations (interstate)
  where deleted_at is null;
create index if not exists locations_created_at on public.locations (created_at desc)
  where deleted_at is null;
create index if not exists locations_pub_cat_featured
  on public.locations (category_slug, is_published, is_featured desc, name)
  where deleted_at is null;
