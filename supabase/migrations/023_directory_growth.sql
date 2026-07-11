-- 023: Directory growth system (Milestone 21).
-- COMMITTED BUT NOT APPLIED in this milestone: every code path that touches
-- these tables detects a missing relation and degrades safely (redirect
-- lookups are skipped, slug regeneration refuses to run, pair decisions fall
-- back to the existing ignore table). Strictly additive.

-- ------------------------------------------------------------- slug redirects
-- Permanent redirects for regenerated public detail slugs. old_slug is the
-- retired URL segment; the DESTINATION is resolved through location_id →
-- locations.detail_slug at request time, so redirects never go stale and
-- chains collapse to one hop by construction (every old slug points at the
-- listing, and the listing always knows its current slug). A row whose
-- old_slug equals the listing's current detail_slug would be a self-loop —
-- the regeneration flow deletes such rows and a CHECK cannot express the
-- cross-row rule, so the application guards it (tested in
-- scripts/test-redirects.ts).
create table if not exists public.directory_slug_redirects (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete cascade,
  old_slug text not null unique,
  -- The slug that replaced old_slug at creation time (audit trail only;
  -- resolution always uses the listing's CURRENT detail_slug).
  new_slug text not null,
  reason text,
  created_by text not null default 'owner',
  created_at timestamptz not null default now()
);

create index if not exists directory_slug_redirects_location
  on public.directory_slug_redirects (location_id);

alter table public.directory_slug_redirects enable row level security;

-- Redirects are public routing data (they contain only slugs, never internal
-- moderation detail); anon needs SELECT so the detail route can resolve an
-- old URL with the same cookieless client it already uses.
drop policy if exists "redirects are publicly readable" on public.directory_slug_redirects;
create policy "redirects are publicly readable"
  on public.directory_slug_redirects for select
  using (true);

-- Writes go through the service role only (no anon/authenticated policy).

-- ------------------------------------------------------------- pair decisions
-- Persisted outcomes of duplicate review: a pair can be a confirmed
-- co-location (legitimate neighbors), a confirmed non-duplicate (false
-- positive), or a confirmed duplicate awaiting merge. (a, b) is the ordered
-- pair convention used by location_duplicate_ignores (a < b).
create table if not exists public.location_pair_decisions (
  id uuid primary key default gen_random_uuid(),
  a uuid not null references public.locations (id) on delete cascade,
  b uuid not null references public.locations (id) on delete cascade,
  decision text not null check (decision in ('co-located', 'not-duplicates', 'duplicate-confirmed')),
  note text,
  admin text not null default 'owner',
  created_at timestamptz not null default now(),
  constraint location_pair_decisions_ordered check (a < b),
  constraint location_pair_decisions_unique unique (a, b)
);

alter table public.location_pair_decisions enable row level security;
-- Admin/service-role only: no policies. Anon cannot read moderation decisions.
