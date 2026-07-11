-- 022: Per-listing detail pages (Milestone 20).
-- Strictly additive: a globally unique, SEO-stable public slug for every
-- listing, serving /directory/location/[slug]. The existing composite slug
-- (unique per type/state/city, migration 002) stays untouched — it cannot key
-- a public URL because it is not globally unique.

-- Deterministic slug base: "name-city-state" lowercased, non-alphanumerics
-- collapsed to single hyphens, capped at 100 chars, never empty. Mirrors
-- detailSlugBase() in src/lib/directory/detail-slug.ts — keep the two in sync.
create or replace function public.location_detail_slug_base(
  in_name text,
  in_city text,
  in_state text
) returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      left(
        trim(both '-' from regexp_replace(
          lower(coalesce(in_name, '') || '-' || coalesce(in_city, '') || '-' || coalesce(in_state, '')),
          '[^a-z0-9]+', '-', 'g'
        )),
        100
      ),
      ''
    ),
    'listing'
  );
$$;

alter table public.locations add column if not exists detail_slug text;

-- Deterministic backfill: the oldest row (created_at, then id) keeps the base
-- slug; later collisions get -2, -3, … . The set_updated_at touch trigger is
-- disabled around the backfill so updated_at — and every other existing
-- column — is preserved exactly. Soft-deleted and unpublished rows are
-- backfilled too, so publishing later never changes a slug.
alter table public.locations disable trigger set_updated_at;

with ranked as (
  select
    id,
    public.location_detail_slug_base(name, city, state) as base,
    row_number() over (
      partition by public.location_detail_slug_base(name, city, state)
      order by created_at, id
    ) as rn
  from public.locations
  where detail_slug is null
)
update public.locations l
set detail_slug = case when r.rn = 1 then r.base else r.base || '-' || r.rn end
from ranked r
where l.id = r.id;

alter table public.locations enable trigger set_updated_at;

-- Uniqueness is the constraint the whole URL space hangs on; the backing
-- index also serves the /directory/location/[slug] lookup.
alter table public.locations
  add constraint locations_detail_slug_key unique (detail_slug);

alter table public.locations alter column detail_slug set not null;

-- Future inserts (admin create, CSV import, approved community submissions)
-- get a slug automatically; an explicitly provided slug (admin regeneration)
-- passes through untouched. BEFORE INSERT, so NOT NULL sees the filled value.
create or replace function public.tlws_set_detail_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  if new.detail_slug is not null and length(trim(new.detail_slug)) > 0 then
    return new;
  end if;
  base := public.location_detail_slug_base(new.name, new.city, new.state);
  candidate := base;
  while exists (select 1 from public.locations where detail_slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  new.detail_slug := candidate;
  return new;
end;
$$;

drop trigger if exists set_detail_slug on public.locations;
create trigger set_detail_slug before insert on public.locations
  for each row execute function public.tlws_set_detail_slug();
