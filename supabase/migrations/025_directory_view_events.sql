-- 025: Most-viewed foundation (Milestone 25).
-- COMMITTED BUT NOT APPLIED in this milestone. Strictly additive.
--
-- PRIVACY BY DESIGN (see docs/most-viewed-privacy.md):
--   * No per-user rows. No IP address. No precise location. No user agent
--     stored. No third-party analytics. No cookies.
--   * The ONLY thing recorded is an aggregate count per listing per UTC day.
--   * Counts are NOT public: there are no anon/authenticated policies, so the
--     public role cannot read them. Reporting is admin-only until enough real
--     data exists to consider a public ranking — and even then it is a
--     deliberate, separate decision, never automatic.
--   * The ingestion route rate-limits and drops obvious bots BEFORE calling
--     the increment, so a single client cannot inflate a count.

create table if not exists public.directory_view_daily (
  location_id uuid not null references public.locations (id) on delete cascade,
  day date not null,
  views integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (location_id, day)
);

create index if not exists directory_view_daily_day on public.directory_view_daily (day);

alter table public.directory_view_daily enable row level security;

-- No anon/authenticated policies AT ALL: view counts are not public. Every read
-- (admin report) and the atomic increment run through the service role.
revoke all on public.directory_view_daily from anon, authenticated;

-- Atomic, privacy-preserving increment. SECURITY DEFINER so the service role
-- can call it; it stores nothing that identifies a viewer — only today's
-- per-listing counter is bumped.
create or replace function public.record_directory_view(p_location uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.directory_view_daily (location_id, day, views, updated_at)
  values (p_location, current_date, 1, now())
  on conflict (location_id, day)
  do update set views = public.directory_view_daily.views + 1, updated_at = now();
$$;

revoke all on function public.record_directory_view(uuid) from anon, authenticated;
