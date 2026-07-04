-- 003: Location reviews
create table public.location_reviews (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  title text,
  body text,
  reviewer_name text,
  reviewer_email text,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index location_reviews_location on public.location_reviews (location_id) where is_approved = true;
