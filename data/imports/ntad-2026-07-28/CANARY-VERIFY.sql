-- NTAD canary verification - READ-ONLY. Safe before and after execution.

-- 1. Package rows present (expect 5 after execution; 0 before).
select count(*) as ntad_rows,
       count(*) filter (where is_published) as published_should_be_0,
       count(*) filter (where parking_spaces is not null) as with_count_should_be_0,
       count(*) filter (where overnight_parking) as overnight_true_should_be_0,
       count(*) filter (where is_featured or is_indexable) as flags_should_be_0
  from public.locations
 where source = 'ntad-2019-v04' and deleted_at is null;

-- 2. The five rows, field by field.
select name, state, city, category_slug, detail_slug, lat, lng,
       parking_spaces, overnight_parking, is_published, source
  from public.locations
 where source = 'ntad-2019-v04' and deleted_at is null
 order by state;

-- 3. No package row can enter any parking recommendation
--    (hasConfirmedTruckParking requires parking_spaces > 0).
select count(*) as recommendation_eligible_should_be_0
  from public.locations
 where source = 'ntad-2019-v04' and deleted_at is null
   and is_published and lat is not null and parking_spaces > 0
   and overnight_parking;

-- 4. Collision re-check around each package row (expect: only the row itself).
select p.detail_slug, count(*) - 1 as neighbours_within_box_should_be_0
  from public.locations p
  join public.locations l
    on l.deleted_at is null
   and l.lat between p.lat - 0.0015 and p.lat + 0.0015
   and l.lng between p.lng - 0.0015 and p.lng + 0.0015
 where p.source = 'ntad-2019-v04' and p.deleted_at is null
 group by p.detail_slug;

-- 5. Held facilities absent (expect 0 rows).
select count(*) as held_rows_should_be_0
  from public.locations
 where deleted_at is null
   and (name ilike '%grand bay welcome center%'
     or name ilike '%guilford north parking%'
     or name ilike '%nhs rest stop or truck facility%');
