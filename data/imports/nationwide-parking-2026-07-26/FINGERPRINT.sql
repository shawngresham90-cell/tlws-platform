-- Before/after fingerprints for the parking expansion. READ-ONLY.
--
-- Run the whole file before applying anything, keep the output, run it again
-- after, and diff. Anything that moves and should not have is then visible as
-- a changed digest rather than something you have to go looking for.

-- 1. Whole-table shape. Only the counts a parking batch is allowed to move
--    should move: published +N, unpublished -N, with_coords +N.
select count(*)                                             as total_rows,
       count(*) filter (where is_published)                 as published,
       count(*) filter (where not is_published)             as unpublished,
       count(*) filter (where lat is not null)              as with_coords,
       count(*) filter (where is_featured)                  as featured,
       count(*) filter (where is_indexable)                 as indexable,
       count(*) filter (where deleted_at is not null)       as deleted
from public.locations;

-- 2. Parking surface specifically.
select category_slug,
       count(*)                                             as total,
       count(*) filter (where is_published)                 as published,
       count(*) filter (where is_published and lat is not null) as published_mappable
from public.locations
where deleted_at is null and category_slug in ('parking','weigh-stations')
group by category_slug order by category_slug;

-- 3. THE CONTROL DIGEST. Every row NOT in this milestone's scope — i.e. every
--    row outside the 216 reconciled ids. This must be byte-identical before
--    and after. If it changes, something touched a row it had no business
--    touching.
--    Measured 2026-07-26, before any change:
--      out_of_scope_rows 1340
--      control_digest    44ad7def9761fa4421060ef8afefaa06
with u as (
  select *,
    (name ~* '(love''?s|pilot|flying\s*j|sapp\s*bros|goasis|thornton)'
     or coalesce(description,'') ~* '(love''?s travel|pilot travel|flying\s*j|sapp\s*bros|goasis|thornton)') as held_brand,
    (address is not null and btrim(address) <> ''
     and address !~* 'mile marker|median service|(north|south|east|west)bound|^i-\d|near us|exit \d') as street_addr
  from public.locations where not is_published and deleted_at is null
),
scope as (select id from u where not held_brand and not street_addr)
select count(*) as out_of_scope_rows,
       md5(string_agg(md5(to_jsonb(l)::text), '' order by l.id)) as control_digest
from public.locations l
where l.id not in (select id from scope);

-- 4. Scope digest — the 216 themselves. Expected id digest
--    1d707c73ad5f2aad741a20b7d88c7d92 (ids only; the row digest changes as
--    rows are legitimately enriched).
with u as (
  select *,
    (name ~* '(love''?s|pilot|flying\s*j|sapp\s*bros|goasis|thornton)'
     or coalesce(description,'') ~* '(love''?s travel|pilot travel|flying\s*j|sapp\s*bros|goasis|thornton)') as held_brand,
    (address is not null and btrim(address) <> ''
     and address !~* 'mile marker|median service|(north|south|east|west)bound|^i-\d|near us|exit \d') as street_addr
  from public.locations where not is_published and deleted_at is null
)
select count(*) as scope_rows,
       md5(string_agg(id::text, '' order by id::text)) as scope_id_digest,
       md5(string_agg(md5(to_jsonb(u)::text), '' order by u.id)) as scope_row_digest
from u where not held_brand and not street_addr;

-- 5. Held networks. NOTE: the held-brand policy is about PROMOTION, not
--    delisting — 273 held-brand rows are legitimately published as ordinary
--    directory listings and must stay that way. What must never change is the
--    count: this milestone may not publish an additional held row, and may not
--    unpublish an existing one.
--    Measured 2026-07-26: held_rows 369, held_published 273, featured 0.
select count(*)                                  as held_rows,
       count(*) filter (where is_published)      as held_published_MUST_NOT_CHANGE,
       count(*) filter (where is_featured)       as held_featured_MUST_BE_ZERO,
       count(*) filter (where lat is not null)   as held_with_coords
from public.locations
where deleted_at is null
  and name ~* '(love''?s|pilot|flying\s*j|sapp\s*bros|goasis|thornton)';

-- 6. Indexability must never move as a side effect of a parking batch.
select count(*) filter (where is_indexable) as indexable_true,
       count(*) filter (where not is_indexable) as indexable_false
from public.locations where deleted_at is null;

-- 7. State/corridor reconciliation for the parking category.
select state,
       count(*) filter (where is_published) as published,
       count(*) filter (where is_published and lat is not null) as mappable,
       coalesce(string_agg(distinct interstate, ' ') filter (where is_published), '-') as corridors
from public.locations
where deleted_at is null and category_slug = 'parking'
group by state having count(*) filter (where is_published) > 0
order by published desc, state;
