-- 015: Knowledge Center — the SEO engine. Built to scale to 10,000+ articles.
-- Categories (with hierarchy) + articles (with full-text search, SEO fields,
-- sources, FAQ, author, reg-verification gate).

-- ---------- Categories ----------
create table public.kc_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,                 -- shown on category landing + used for meta
  intro_md text,                    -- longer intro copy for the landing page
  icon text,                        -- icon key (rendered client-side)
  parent_id uuid references public.kc_categories(id) on delete set null, -- hierarchy
  sort_order int not null default 0,
  is_active boolean not null default true,
  meta_title text,
  meta_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index kc_categories_active on public.kc_categories (sort_order) where is_active = true;
create index kc_categories_parent on public.kc_categories (parent_id);

-- ---------- Articles ----------
create table public.kc_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  category_id uuid not null references public.kc_categories(id) on delete restrict,
  title text not null,
  excerpt text,                     -- card + meta description fallback
  body_mdx text,                    -- MDX/markdown body
  meta_title text,
  meta_description text,
  hero_image_url text,
  author_name text not null default 'Shawn Gresham',
  author_bio text,
  sources jsonb not null default '[]'::jsonb,   -- [{label, url}] — citations
  faqs jsonb not null default '[]'::jsonb,       -- [{q, a}] — drives FAQ schema
  tags text[] not null default '{}',
  reading_time_min int,
  featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  reg_verified boolean not null default false,   -- eCFR gate before publish (hard rule)
  reg_verified_date date,
  view_count int not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- slug unique within a category (composite) so two categories can reuse a slug
  constraint kc_articles_category_slug unique (category_id, slug),
  -- full-text search vector, generated + stored, weighted title > excerpt > body
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(excerpt,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(body_mdx,'')), 'C')
  ) stored
);

create index kc_articles_category on public.kc_articles (category_id, published_at desc)
  where status = 'published';
create index kc_articles_published on public.kc_articles (published_at desc)
  where status = 'published';
create index kc_articles_featured on public.kc_articles (published_at desc)
  where status = 'published' and featured = true;
create index kc_articles_search on public.kc_articles using gin (search);
create index kc_articles_tags on public.kc_articles using gin (tags);
create index kc_articles_title_trgm on public.kc_articles using gin (title gin_trgm_ops);

-- ---------- Manual "related" curation (optional; auto-related falls back to tags) ----------
create table public.kc_related (
  article_id uuid not null references public.kc_articles(id) on delete cascade,
  related_id uuid not null references public.kc_articles(id) on delete cascade,
  sort_order int not null default 0,
  primary key (article_id, related_id),
  constraint kc_related_no_self check (article_id <> related_id)
);

-- ---------- Triggers ----------
create trigger set_updated_at before update on public.kc_categories
  for each row execute function public.tlws_set_updated_at();
create trigger set_updated_at before update on public.kc_articles
  for each row execute function public.tlws_set_updated_at();

-- ---------- RLS ----------
alter table public.kc_categories enable row level security;
alter table public.kc_articles enable row level security;
alter table public.kc_related enable row level security;

-- Anon reads active categories and published articles only.
create policy anon_read_kc_categories on public.kc_categories
  for select to anon using (is_active = true);
create policy anon_read_kc_articles on public.kc_articles
  for select to anon using (status = 'published');
create policy anon_read_kc_related on public.kc_related
  for select to anon using (
    exists (select 1 from public.kc_articles a
            where a.id = kc_related.article_id and a.status = 'published')
  );

-- Strip default write grants from anon/authenticated (writes go through service role).
revoke insert, update, delete on public.kc_categories from anon, authenticated;
revoke insert, update, delete on public.kc_articles from anon, authenticated;
revoke insert, update, delete on public.kc_related from anon, authenticated;

-- ---------- Search RPC: ranked full-text search over published articles ----------
create or replace function public.kc_search(q text, max_results int default 20)
returns table (
  id uuid, slug text, title text, excerpt text,
  category_id uuid, published_at timestamptz, rank real
)
language sql stable security invoker set search_path = public
as $$
  select a.id, a.slug, a.title, a.excerpt, a.category_id, a.published_at,
         ts_rank(a.search, websearch_to_tsquery('english', q)) as rank
  from public.kc_articles a
  where a.status = 'published'
    and a.search @@ websearch_to_tsquery('english', q)
  order by rank desc, a.published_at desc
  limit greatest(1, least(max_results, 50));
$$;

revoke execute on function public.kc_search(text, int) from public;
grant execute on function public.kc_search(text, int) to anon, authenticated;
