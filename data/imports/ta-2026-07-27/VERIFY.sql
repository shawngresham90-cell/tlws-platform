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
--    Expected after canary+enrich: route-usable rises from 310 toward 347.
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

-- 4. ENRICHMENT FIDELITY. After ENRICH-EXISTING.sql, every row it touched
--    carries the tag; none of them became featured/indexable; none changed
--    publication state (the plan records 38 of 38 were already published).
select count(*)                                        as enriched_rows,
       count(*) filter (where is_featured)             as featured,
       count(*) filter (where is_indexable)            as indexable,
       count(*) filter (where not is_published)        as unpublished
from public.locations
where deleted_at is null and geocode_source = 'ta-master-2026-07-27';
-- expected after full enrich: 38 / 0 / 0 / 0   (+2 if HOLD is verified & run)

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
