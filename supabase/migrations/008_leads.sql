-- 008: Leads + lead magnets join (fixes repeat-magnet break)
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  first_name text,
  phone text,
  sms_consent boolean not null default false,
  source text,
  utm jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_email on public.leads (lower(email));

create table public.lead_magnets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  file_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.lead_magnet_claims (
  lead_id uuid not null references public.leads(id) on delete cascade,
  magnet_id uuid not null references public.lead_magnets(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (lead_id, magnet_id)
);
