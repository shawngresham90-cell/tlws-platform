-- TA/Petro package — verification. READ-ONLY, safe before and after.
--
-- TA-network scope, everywhere below, is the fixed pattern the reconciliation
-- and fingerprints use. 395 rows at preparation time; id digest
-- 52d4c84e71b50adcecc2956a51c58274 (verified 2026-07-27).

-- 1. BEFORE baseline. Measured 2026-07-27:
--    1556 live / 1165 published / 534 with coords / 635 published-unmappable.
select count(*) as total_live,
       count(*) filter (where is_published) as published,
       count(*) filter (where lat is not null) as with_coords,
       count(*) filter (where is_published and lat is null) as published_unmappable
from public.locations where deleted_at is null;

-- 2. THE TWO GATES, measured separately — never collapsed into one number.
--    Universe: 348 TA/Petro/TA Express U.S. locations (Goasis and Thorntons
--    held; 875-style all-in totals do not exist here — all 354 are U.S.).
--      4a directory coverage: expected 348 after HOLD verification closes
--         (346 already represented + the 2 Ashland/Richmond rows verified).
--      4b route-usable: published + mappable + positive official spaces.
--    Measured after the 2026-07-27 execution: 344 route-usable rows
--    (343 sites + the published Atlanta South duplicate row);
--    published_unmappable_ts = 1 (the quarantined site 0269).
select count(*) filter (where category_slug = 'truck-stops')                          as ta_truck_stop_rows,
       count(*) filter (where category_slug = 'truck-stops' and is_published
                          and lat is not null and coalesce(parking_spaces,0) > 0)     as route_usable,
       count(*) filter (where category_slug = 'truck-stops' and is_published
                          and lat is null)                                            as published_unmappable_ts
from public.locations
where deleted_at is null
  and (name ~* '^(ta |ta-|petro |ta express|travelcenters|goasis|thorntons)'
    or name ~* '\y(TA Travel Center|TravelCenters of America|Petro Stopping Center|TA Express|TA Truck Service|Petro Lube)\y'
    or name ~* '\y(ta|petro)\y.*#\s*\d');

-- 3. ZERO-PARKING INVARIANT. Site 0347 "TA Truck Service Franklin" (KY) and
--    any other row without a positive official space count must never be
--    counted as truck-parking coverage. This query is the counter the gate
--    uses; the row list is the audit.
select id, name, state, city, parking_spaces, is_published
from public.locations
where deleted_at is null and category_slug = 'truck-stops'
  and name = 'TA Truck Service Franklin' and state = 'KY';

-- 4. ENRICHMENT FIDELITY. geocode_source carries the shared legal value
--    'batch-csv' (the schema CHECK allows no bespoke tag), so this audits the
--    EXPLICIT coordinate-fill id list from ENRICHMENT-PLAN.csv. Spaces-only
--    fills never receive coordinate metadata — audit those by value against
--    the plan. None became featured/indexable; none changed publication state
--    (all 38 targets were already published).
select count(*) filter (where lat is not null
                          and geocode_source = 'batch-csv') as enriched_rows,
       count(*) filter (where is_featured)                  as featured,
       count(*) filter (where is_indexable)                 as indexable,
       count(*) filter (where not is_published)             as unpublished
from public.locations
where deleted_at is null and id in (
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
     '366ea2a6-4116-4ce3-bc64-01fdac0dcb60');
-- measured after the 2026-07-27 execution: 26 / 0 / 0 / 0 — site 0269 is
-- quarantined (collision guard), so its id contributes nothing until a
-- separate authorization applies it.
-- (the 2 HOLD rows are audited separately if ever verified & run)

-- 5. OVERNIGHT IS NEVER INVENTED. The TA master has no overnight-permission
--    field, and no statement in this package writes overnight_parking.
--    Expected: identical before and after —
select count(*) filter (where overnight_parking) as overnight_true_in_scope
from public.locations
where deleted_at is null
  and (name ~* '^(ta |ta-|petro |ta express|travelcenters|goasis|thorntons)'
    or name ~* '\y(TA Travel Center|TravelCenters of America|Petro Stopping Center|TA Express|TA Truck Service|Petro Lube)\y'
    or name ~* '\y(ta|petro)\y.*#\s*\d');
-- measured before: record it. Enrichment must not move it. (CORRECTIONS A
-- unpublishes a row that carries true; the COUNT still must not change —
-- unpublishing does not alter the flag.)

-- 6. MAP-PIN / COLLISION. No two published TA-scope rows within ~150 m.
--    Expected: 0 rows after enrichment (the Atlanta South pair appears here
--    until CORRECTIONS A is authorized and applied).
select a.id, a.name, b.id as other_id, b.name as other_name,
       round((abs(a.lat-b.lat)+abs(a.lng-b.lng))::numeric, 6) as deg_delta
from public.locations a
join public.locations b
  on a.id < b.id and a.is_published and b.is_published
 and a.deleted_at is null and b.deleted_at is null
 and a.lat is not null and b.lat is not null
 and abs(a.lat-b.lat) < 0.0015 and abs(a.lng-b.lng) < 0.0015
where a.name ~* '^(ta |petro |ta express)' and b.name ~* '^(ta |petro |ta express)';

-- 7. GOASIS AND THORNTONS UNTOUCHED. Expected: 0 rows exist in scope carrying
--    these brands (they were never imported), and nothing in this package
--    creates one.
select count(*) as goasis_thorntons_rows
from public.locations
where deleted_at is null and name ~* '^(goasis|thorntons)';

-- 8. The correction targets, before and after CORRECTIONS-PROPOSALS.sql.
select id, name, state, city, is_published, lat is not null as has_coord,
       parking_spaces, deleted_at
from public.locations
where id in ('33e41d22-1dac-425b-a17d-c9b6affcda21',   -- A duplicate (published today)
             '15de1227-c048-4efc-9434-ac55e17356f1',   -- A row of record
             'beb05d53-db50-49cb-8790-ec01b45c8187',   -- B mislabeled Petro Florence
             '74398e08-61e6-41b8-b3fd-e22c6c6cf6d0')   -- C quarantined, never touched
order by id;

-- 9. NOTHING DELETED, ever, by any file in this package.
select count(*) as deleted_in_scope
from public.locations
where deleted_at is not null
  and (name ~* '^(ta |ta-|petro |ta express|travelcenters|goasis|thorntons)'
    or name ~* '\y(TA Travel Center|TravelCenters of America|Petro Stopping Center|TA Express|TA Truck Service|Petro Lube)\y'
    or name ~* '\y(ta|petro)\y.*#\s*\d');
-- expected: 0, before and after.
