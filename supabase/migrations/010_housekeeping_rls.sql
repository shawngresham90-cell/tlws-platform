-- 010: updated_at triggers + RLS lockdown
-- Doctrine: anon = SELECT public rows only, ZERO inserts. All writes via
-- server routes / Edge Functions (service role) + Turnstile.

create or replace function public.tlws_set_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.locations
  for each row execute function public.tlws_set_updated_at();
create trigger set_updated_at before update on public.applications
  for each row execute function public.tlws_set_updated_at();
create trigger set_updated_at before update on public.founders
  for each row execute function public.tlws_set_updated_at();
create trigger set_updated_at before update on public.sponsors
  for each row execute function public.tlws_set_updated_at();
create trigger set_updated_at before update on public.tests
  for each row execute function public.tlws_set_updated_at();
create trigger set_updated_at before update on public.leads
  for each row execute function public.tlws_set_updated_at();
create trigger set_updated_at before update on public.content_pages
  for each row execute function public.tlws_set_updated_at();

-- Enable RLS on every table
alter table public.locations enable row level security;
alter table public.location_reviews enable row level security;
alter table public.applications enable row level security;
alter table public.application_events enable row level security;
alter table public.founders enable row level security;
alter table public.sponsors enable row level security;
alter table public.sponsor_touches enable row level security;
alter table public.tests enable row level security;
alter table public.questions enable row level security;
alter table public.test_attempts enable row level security;
alter table public.leads enable row level security;
alter table public.lead_magnets enable row level security;
alter table public.lead_magnet_claims enable row level security;
alter table public.content_pages enable row level security;

-- Anon read policies: PUBLIC rows only. No anon INSERT/UPDATE/DELETE anywhere.
create policy anon_read_locations on public.locations
  for select to anon using (is_indexable = true and deleted_at is null);
create policy anon_read_reviews on public.location_reviews
  for select to anon using (is_approved = true);
create policy anon_read_founders on public.founders
  for select to anon using (is_public = true);
create policy anon_read_tests on public.tests
  for select to anon using (is_published = true);
create policy anon_read_questions on public.questions
  for select to anon using (
    exists (select 1 from public.tests t where t.id = questions.test_id and t.is_published = true)
  );
create policy anon_read_magnets on public.lead_magnets
  for select to anon using (is_active = true);
create policy anon_read_content on public.content_pages
  for select to anon using (status = 'published');

-- Fully locked (RLS on, no policy): applications, application_events, sponsors,
-- sponsor_touches, test_attempts, leads, lead_magnet_claims. Service role bypasses RLS.

grant select on public.campaign_progress to anon;
