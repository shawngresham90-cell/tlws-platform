-- TA/Petro package — before/after fingerprints. READ-ONLY.
--
-- Run BEFORE anything, record the output, run AFTER each phase, and diff.
-- Anything the phase was not authorized to touch must be byte-identical.

-- ===========================================================================
-- A. CONTROL DIGEST — everything OUT OF the TA-network scope must not change
-- ===========================================================================
-- MEASURED 2026-07-27, read-only:
--   out_of_scope_rows 1161
--   control_digest    64d573283c8c0e35bd39c73bb63819d3
--
-- NOTE: the mislabeled row beb05d53 ("Love's Travel Stop #420") is INSIDE this
-- control set — its name matches no TA pattern. CORRECTIONS-PROPOSALS.sql §B
-- therefore CHANGES the control digest by exactly that one row. Sequence the
-- fingerprints accordingly: control digest is invariant across CANARY/ENRICH/
-- HOLD and across CORRECTIONS §A; after §B, re-baseline and record the new
-- value alongside the authorization that produced it.
with scope as (
  select id from public.locations
  where deleted_at is null
    and (name ~* '^(ta |ta-|petro |ta express|travelcenters|goasis|thorntons)'
      or name ~* '\y(TA Travel Center|TravelCenters of America|Petro Stopping Center|TA Express|TA Truck Service|Petro Lube)\y'
      or name ~* '\y(ta|petro)\y.*#\s*\d')
)
select count(*) as out_of_scope_rows,
       md5(string_agg(md5(to_jsonb(l)::text), '' order by l.id)) as control_digest
from public.locations l
where l.deleted_at is null and l.id not in (select id from scope);

-- ===========================================================================
-- B. TA-SCOPE DIGESTS
-- ===========================================================================
-- MEASURED 2026-07-27, read-only:
--   scope rows            395
--   id_digest             52d4c84e71b50adcecc2956a51c58274
--   row_digest            4106b5fbf74fa4d64a135891fddbc66c
--   imported name+state   e7843f7412c831ca5eb0687b37ab6018   (= import CSV)
--   imported value digest 2ac6c65968f6da9013ee0896b377003b   (= import CSV)
--   legacy row digest     4aabb580c32b3959b196d4c2b8e0aa34   (= LEGACY-91.tsv)
--
-- After ENRICH: exactly 38 rows change (the address-anchored targets); the
-- imported digests must NOT change — enrichment never touches imported rows.
with scope as (
  select l.* from public.locations l
  where l.deleted_at is null
    and (l.name ~* '^(ta |ta-|petro |ta express|travelcenters|goasis|thorntons)'
      or l.name ~* '\y(TA Travel Center|TravelCenters of America|Petro Stopping Center|TA Express|TA Truck Service|Petro Lube)\y'
      or l.name ~* '\y(ta|petro)\y.*#\s*\d')
)
select
 (select count(*) from scope) as scope_rows,
 (select md5(string_agg(id::text, ',' order by id::text)) from scope) as id_digest,
 (select md5(string_agg(md5(to_jsonb(s)::text), '' order by s.id)) from scope s) as row_digest,
 (select md5(string_agg(name || '|' || state, E'\n' order by name, state)) from scope
   where source = 'official-ta-petro-20260725-5ebe0e9f') as imported_name_state_digest,
 (select md5(string_agg(concat_ws('|', name, state, city, coalesce(address,''), coalesce(zip,''),
    coalesce(lat::text,''), coalesce(lng::text,''), coalesce(parking_spaces::text,'')), E'\n' order by name, state))
   from scope where source = 'official-ta-petro-20260725-5ebe0e9f') as imported_value_digest;

-- ===========================================================================
-- C. DIRECTORY-WIDE COUNTERS
-- ===========================================================================
-- Before, measured 2026-07-27:
--   live 1556 · published 1165 · with_coords 534 · published_unmappable 635
--
-- After CANARY (10) + ENRICH (28 more): with_coords 534→572 (+38);
-- published_unmappable 635→597 (−38: all 38 targets are published rows
-- gaining their first coordinate). live and published UNCHANGED — this
-- package inserts nothing and publishes nothing. CORRECTIONS §A (if separately
-- authorized) moves published 1165→1164. HOLD (+2, unpublished rows) moves
-- with_coords only.
select count(*)                                             as live,
       count(*) filter (where is_published)                 as published,
       count(*) filter (where lat is not null)              as with_coords,
       count(*) filter (where is_published and lat is null) as published_unmappable,
       count(*) filter (where is_featured)                  as featured,
       count(*) filter (where is_indexable)                 as indexable,
       count(*) filter (where deleted_at is not null)       as soft_deleted
from public.locations;

-- ===========================================================================
-- D. ENRICHMENT SCOPE MARKER
-- ===========================================================================
-- Only rows this package touched carry the tag. Expected: 0 before; 10 after
-- the canary; 38 after full enrich; 40 if HOLD is verified and run.
select count(*) as tagged_rows
from public.locations
where geocode_source = 'ta-master-2026-07-27';
