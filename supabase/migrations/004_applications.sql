-- 004: Academy applications + event log
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  sms_consent boolean not null default false,       -- TCPA: explicit opt-in
  sms_consent_at timestamptz,
  sms_consent_text text,
  has_permit boolean,
  cdl_class text check (cdl_class in ('A','B','none')),
  funding_type text check (funding_type in ('self','employer','wioa','va','sponsor','unsure')),
  start_timeframe text check (start_timeframe in ('asap','30_days','60_days','90_plus','researching')),
  step2_completed boolean not null default false,
  lead_score int not null default 0,
  status text not null default 'new' check (status in ('new','contacted','qualified','enrolled','declined','no_response')),
  utm jsonb default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index applications_status on public.applications (status, created_at desc);
create index applications_email on public.applications (lower(email));

create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  event_type text not null,
  detail jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index application_events_app on public.application_events (application_id, created_at desc);
