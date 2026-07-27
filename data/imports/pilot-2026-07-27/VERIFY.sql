-- Pilot / Flying J / ONE9 import — verification. READ-ONLY, safe before and after.
--
-- Source of record: all_locations.csv, sha256 d39ab57d…e330a.
-- 875 locations = 820 U.S. + 55 Canada. Canada is excluded from every U.S.
-- denominator; 875 is never the U.S. coverage number.

-- 1. BEFORE baseline. Capture and keep.
--    Measured read-only 2026-07-27: 1556 live / 1165 published / 534 with
--    coords / 635 published-unmappable / 531 published with a stated parking
--    count, 358 of those mappable, across 43 states and 52 corridors.
select count(*)                                                          as total_live,
       count(*) filter (where is_published)                              as published,
       count(*) filter (where lat is not null)                           as with_coords,
       count(*) filter (where is_published and lat is null)              as published_unmappable,
       count(*) filter (where is_published and coalesce(parking_spaces,0) > 0) as published_with_parking
from public.locations where deleted_at is null;

-- 2. THE TWO U.S. GATES, measured separately. Different numbers; never collapse
--    them into one. Expected after the full import: directory 820, parking 803,
--    zero-space 17.
select count(*)                                                    as pilot_rows,
       count(*) filter (where coalesce(parking_spaces,0) > 0)      as gate_3b_parking,
       count(*) filter (where coalesce(parking_spaces,0) = 0)      as zero_space,
       count(*) filter (where lat is not null)                     as mappable,
       count(distinct state)                                       as states
from public.locations
where deleted_at is null and source = 'pilot-master-2026-07-27';

-- 3. THE SAFETY INVARIANT. A zero-space location must never be published and
--    must never be returned as parking or as a last-legal-stop recommendation.
--    Expected: 0 rows, always.
select id, name, state, city, parking_spaces, is_published
from public.locations
where deleted_at is null
  and source = 'pilot-master-2026-07-27'
  and coalesce(parking_spaces, 0) = 0
  and (is_published or category_slug = 'parking');

-- 4. NO INVENTED OVERNIGHT PERMISSION. The export has no overnight field, so
--    nothing this import touches may claim overnight parking.
--    Expected: 0 rows.
select id, name, state, city, overnight_parking
from public.locations
where deleted_at is null and source = 'pilot-master-2026-07-27' and overnight_parking;

-- 5. BRAND IDENTITY PRESERVED. Every official Name value must still be present
--    and distinguishable. Nothing may have been flattened to "Pilot".
--    Expected: Pilot Travel Center, Flying J Travel Center, ONE9 Travel Center,
--    ONE9 Dealer, Pilot Dealer, Mr. Fuel Travel Center, Pilot Licensed
--    Location, Flying J Dealer, Flying J Cardlock, Flying J Licensed Location,
--    Shell Cardlock, EZ Trip Travel Center, Xpress Fuel Travel Center,
--    Pilot Express, Shell Flying J Dealer, One9 Travel Center, Pride Travel
--    Center, Pilot Licensee, Stamart Travel Center, Arco Travel Center,
--    EZ Trip Dealer.
select regexp_replace(name, '\s*#\s*\d+\s*$', '') as official_name, count(*)
from public.locations
where deleted_at is null and source = 'pilot-master-2026-07-27'
group by 1 order by 2 desc;

-- 6. MAP-PIN RULE. Exactly one coordinate-bearing row per network site. A store
--    number with two mappable rows means a duplicate pin. Third-party brands
--    carry their own numbering and are excluded.
--    Expected: 0 rows.
select substring(name from '#\s*(\d+)') as store_number, state, count(*) as mappable_rows,
       string_agg(category_slug || ':' || id::text, ' | ') as rows
from public.locations
where deleted_at is null and lat is not null
  and name ~* '(pilot|flying\s*j|one\s*9|one9|mr\.?\s*fuel)'
  and name !~* '^(southern tire mart|speedway|blue beacon|pro stop)'
  and name !~* '\(CAT #[0-9]+\)'
group by 1, 2 having count(*) > 1;

-- 7. COORDINATE-COLLISION GUARD, NOT WEAKENED. No two distinct imported sites
--    share a coordinate. Expected: 0 rows.
select lat, lng, count(*), string_agg(name, ' | ')
from public.locations
where deleted_at is null and source = 'pilot-master-2026-07-27' and lat is not null
group by lat, lng having count(*) > 1;

-- 8. Nothing was featured or made manually indexable.
--    Expected: featured 0, indexable 0 among imported rows.
select count(*) filter (where is_featured)  as featured,
       count(*) filter (where is_indexable) as indexable
from public.locations
where deleted_at is null and source = 'pilot-master-2026-07-27';

-- 9. Per-state reconciliation against the source of record.
--    Expected: matches DIRECTORY-820.csv exactly, state by state.
select state, count(*) as rows,
       count(*) filter (where coalesce(parking_spaces,0) > 0) as with_parking,
       count(*) filter (where is_published) as published,
       sum(coalesce(parking_spaces,0)) as stated_spaces
from public.locations
where deleted_at is null and source = 'pilot-master-2026-07-27'
group by state order by state;

-- 10. NO CANADIAN ROW WAS IMPORTED. The 55 Canadian locations are preserved in
--     CANADA-55.csv and excluded from the U.S. denominator. Expected: 0 rows.
select id, name, state from public.locations
where deleted_at is null and source = 'pilot-master-2026-07-27'
  and state in ('AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT');

-- 11. Corridor coverage after. Before (mappable rows with a stated parking
--     count): I-95 4, I-80 28, I-90 15, I-94 12, I-10 23, I-15 7, I-70 19,
--     I-35 11, I-5 10, I-84 7, I-75 53, I-40 19, I-20 20, I-65 4.
select interstate,
       count(*) filter (where is_published) as published,
       count(*) filter (where is_published and lat is not null) as mappable,
       sum(coalesce(parking_spaces,0)) filter (where is_published) as spaces
from public.locations
where deleted_at is null and interstate is not null
  and source = 'pilot-master-2026-07-27'
group by interstate order by published desc;

-- 12. The five conflicting records. None is changed by this package; all need
--     exact-ID verification. Expected: unchanged from the pre-import state.
select id, name, state, city, address, is_published, deleted_at
from public.locations
where id in ('88da4d5c-2816-4329-947d-6a77e584c45d',  -- CAT #231 Monroe OH
             'c318488f-fe10-471f-afb2-407f771beb82',  -- CAT #284 West Chester OH
             '4b60c1b7-624c-4541-8466-0844e9e0369e',  -- CAT #24 Sharonville OH
             'a458560a-f2f2-4149-b476-a63e7a260094',  -- Pilot #24 OH, no city
             '9b0bb934-cb3a-499c-b362-8f665e065b81')  -- Flying J #749 VA, address contradicts
order by state, name;

-- 13. The 12 probable-closure candidates. NOTHING in this package deletes or
--     unpublishes them. Expected: identical to the pre-import state. Closure
--     review is a separate exercise and needs its own authorization.
select id, name, state, city, category_slug, is_published
from public.locations
where id in ('bbb6d29c-9a64-46fa-859f-2496d6085564','5e8660b1-0553-413a-b271-9bdf78f09202',
             '88da4d5c-2816-4329-947d-6a77e584c45d','4b60c1b7-624c-4541-8466-0844e9e0369e',
             'c318488f-fe10-471f-afb2-407f771beb82','1c18704d-99b4-4644-865c-b0d740b9ccd5',
             '63726042-4b3b-41c2-a7e8-267af4a9285b','e1c84a38-7da4-4597-ab5e-331b2e755297',
             'a458560a-f2f2-4149-b476-a63e7a260094','f65fd2ef-14d5-456f-a937-bbf3750c87b9',
             '951b39b1-6f25-40de-b2d3-d7cbca0d66a0','ff14e2af-f0a7-4e65-a341-c15aab36fe6e')
order by is_published desc, state, name;
