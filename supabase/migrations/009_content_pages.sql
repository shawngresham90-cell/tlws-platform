-- 009: Content pages (machine-written only by scripts/content-sync)
create table public.content_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  meta_description text,
  body_mdx text,
  cluster text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  reg_verified boolean not null default false,   -- eCFR verification gate
  reg_verified_date date,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index content_pages_status on public.content_pages (status, published_at desc);
create index content_pages_cluster on public.content_pages (cluster) where status = 'published';
