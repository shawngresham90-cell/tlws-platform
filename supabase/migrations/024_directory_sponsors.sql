-- 024: Directory sponsors (Milestone 25).
-- COMMITTED BUT NOT APPLIED in this milestone. Strictly additive. The sponsor
-- reader (src/lib/directory/sponsors-data.ts) detects a missing relation and
-- returns [], so every sponsor slot renders nothing (its graceful empty state)
-- until this migration is applied and a sponsor is created. No sponsor records
-- are created here.

create table if not exists public.directory_sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tagline text,
  -- Outbound URL. The application validates http(s)+host before render
  -- (isSafeSponsorUrl); this CHECK is a coarse backstop only.
  url text not null check (url ~* '^https?://'),
  logo text,
  -- Placement keys: directory-hub | state | interstate | detail | map-sidebar | parking
  placements text[] not null default '{}',
  -- Targeting: empty array = matches everything.
  states text[] not null default '{}',
  interstates text[] not null default '{}',
  categories text[] not null default '{}',
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by text not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists directory_sponsors_active on public.directory_sponsors (active);

alter table public.directory_sponsors enable row level security;

-- Sponsors are public display content: anon may read only ACTIVE rows (the
-- same cookieless client the directory already uses). Inactive/expired rows
-- are never exposed to the public read path.
drop policy if exists "active sponsors are publicly readable" on public.directory_sponsors;
create policy "active sponsors are publicly readable"
  on public.directory_sponsors for select
  using (active = true);

-- Writes go through the service role only (admin actions). Defense in depth
-- alongside RLS, matching migration 011/023 grant hygiene.
revoke insert, update, delete on public.directory_sponsors from anon, authenticated;
