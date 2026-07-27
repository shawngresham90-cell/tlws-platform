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
-- After ENRICH (executed 2026-07-27): exactly 37 rows changed (site 0269 was
-- quarantined by the collision guard); the imported digests did NOT change —
-- enrichment never touches imported rows. Measured after: id_digest and both
-- imported digests identical to the values above.
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
-- After CANARY (10) + ENRICH (27 applied of 28 — site 0269 quarantined by the
-- collision guard): with_coords 534→560 MEASURED (+26 — 24 lat+lng and 2
-- lat+lng+spaces fills applied; the 11 spaces-only fills land on
-- already-mapped pages); published_unmappable 635→609 MEASURED (−26).
-- live and published UNCHANGED (measured 1556 / 1165) — this
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
-- The schema CHECK constraint locations_geocode_source_check allows only
-- import | batch-csv | interpolation | external-api | manual — no bespoke
-- package tag. Coordinate fills therefore write the shared legal value
-- 'batch-csv' (what every prior committed-file enrichment wrote), and package
-- membership is tracked by the EXPLICIT coordinate-fill id list from
-- ENRICHMENT-PLAN.csv, never by tag.
--   batch_csv_total: 145 before (prior enrichments, 2026-07-26);
--                    149 after canary (MEASURED); 171 after the executed
--                    enrich (MEASURED — site 0269 quarantined, so +26 not +27).
--   enriched_of_27:  0 before; 4 after canary; 26 after the executed enrich
--                    (both MEASURED; 27 only if 0269 is ever separately
--                    authorized and applied).
-- The 11 spaces-only rows never receive coordinate metadata — audit them by
-- VALUE against ENRICHMENT-PLAN.csv.
select
 (select count(*) from public.locations
   where geocode_source = 'batch-csv') as batch_csv_total,
 (select count(*) from public.locations
   where geocode_source = 'batch-csv' and lat is not null
     and id in (
     '783d1792-e352-4fb3-bd2b-fc38951c19c8',
     'dee17bfa-a6bf-4da0-8d48-95a9231de439',
     '3e5fef77-bc72-4174-b45d-04f6096c8fde',
     '245d9e0f-cb95-461e-822a-e458c03212ed',
     'b9b49d33-ae7d-4ca0-b197-6986c17eef18',
     '7b340f8f-28fc-4bca-83a8-bee8a793a4fb',
     '51296b6f-d325-4a97-a48f-d7a315a5e7e0',
     'eec1d852-2b50-47f7-a59e-b1238f1ace2d',
     '0fd1e82b-0a8e-410b-9af9-8787d6ab89b8',
     '91b8ddaa-6012-4ab7-839a-ded888eb912d',
     '09974385-8c93-4bb5-be59-13552b53e2b3',
     'cd4783d1-b67c-4c09-b056-6a72f5606229',
     '68afff98-8a4c-42be-b099-e87e50b08a38',
     '687996be-4fd9-4464-a9b3-3df5b2c7f505',
     '20ea502e-9d1f-43e3-b369-520d35c38c5f',
     '5e829807-6932-4f13-b44f-e5dea115f755',
     '904bda8d-b42d-49ce-88d2-5b2fd4ca4191',
     'bb4d283f-1f08-4acd-a062-850f5bc309c6',
     '03c39975-0f38-4f41-97e7-d50d95b9edf0',
     '8018aa5b-c428-465d-9809-fde4e03cd4a2',
     '8578017a-7ea0-4c38-a6ed-abf7b5a39d0f',
     'bd27e9bc-6b14-4810-b20d-26a04702c477',
     '25721d01-d3ed-4da5-a9cc-448fd166e75b',
     'eb48d156-9ad9-4fa3-b8eb-cfc7b29a49a4',
     '2937ca5e-063c-4ac7-b4c4-0e7da286f488',
     'd19be5c3-65f2-471d-9281-0cfeeaa8ceb0',
     '366ea2a6-4116-4ce3-bc64-01fdac0dcb60')) as enriched_of_27;
