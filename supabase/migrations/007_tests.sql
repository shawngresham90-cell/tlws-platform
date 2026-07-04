-- 007: Practice tests
create table public.tests (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  category text not null check (category in ('general_knowledge','air_brakes','combination','hazmat','tanker','doubles_triples','passenger','school_bus','pre_trip')),
  is_published boolean not null default false,
  question_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  prompt text not null,
  choices jsonb not null,
  correct_key text not null,
  explanation text,
  cfr_cite text,                 -- 49 CFR citation — verified before publish (hard rule)
  verified_date date,
  miss_count int not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index questions_test on public.questions (test_id, sort_order);

create table public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  lead_email text,
  score int,
  total int,
  answers jsonb default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index test_attempts_test on public.test_attempts (test_id, created_at desc);
