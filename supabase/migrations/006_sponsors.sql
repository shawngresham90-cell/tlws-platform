-- 006: Sponsor pipeline + touch history
create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  contact_name text,
  email text,
  phone text,
  stage text not null default 'prospect' check (stage in ('prospect','contacted','warm','committed','closed_won','closed_lost')),
  tier_interest text,
  pledged_cents int default 0,
  paid_cents int default 0,
  priority int not null default 3 check (priority between 1 and 5),
  next_action text,
  next_action_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sponsors_stage on public.sponsors (stage, priority, next_action_date);

create table public.sponsor_touches (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  touch_type text not null check (touch_type in ('email','call','dm','meeting','video','other')),
  direction text not null default 'outbound' check (direction in ('outbound','inbound')),
  summary text,
  created_at timestamptz not null default now()
);

create index sponsor_touches_sponsor on public.sponsor_touches (sponsor_id, created_at desc);
