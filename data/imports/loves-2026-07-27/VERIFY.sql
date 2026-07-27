-- Love's import — verification. READ-ONLY, safe before and after.

-- 1. BEFORE baseline. Capture and keep.
--    Measured 2026-07-26: 1556 total / 1165 published / 534 with coords /
--    76 published parking / 31 mappable / 159 Love's rows / 122 published.
select count(*) as total_rows,
       count(*) filter (where is_published) as published,
       count(*) filter (where lat is not null) as with_coords,
       count(*) filter (where is_published and lat is null) as published_unmappable
from public.locations where deleted_at is null;

-- 2. The two Love's gates, measured separately. They are different numbers and
--    must never be collapsed into one.
--    Expected after full import: directory 615, overnight 604, non-overnight 11.
select count(*) filter (where source = 'loves-master-2026-07-27'
                          or name ~* 'love''?s travel stop')            as loves_travel_stop_rows,
       count(*) filter (where overnight_parking is true
                          and coalesce(parking_spaces,0) > 0)           as overnight_eligible,
       count(*) filter (where overnight_parking is not true)            as non_overnight,
       count(*) filter (where lat is not null)                          as mappable
from public.locations
where deleted_at is null and category_slug = 'truck-stops'
  and (source = 'loves-master-2026-07-27' or name ~* 'love''?s travel stop');

-- 3. THE SAFETY INVARIANT. A non-overnight Love's must never be published as
--    parking, and must never carry overnight_parking = true.
--    Expected: 0 rows, always.
select id, name, state, city, parking_spaces, overnight_parking, is_published
from public.locations
where deleted_at is null
  and source = 'loves-master-2026-07-27'
  and overnight_parking is not true
  and (is_published or category_slug = 'parking');

-- 4. Store #201 Elk City OK — zero stated spaces. Must never qualify as
--    parking under any circumstance. Expected: overnight_parking false,
--    parking_spaces 0, category truck-stops, not on any parking surface.
select id, name, state, city, parking_spaces, overnight_parking, category_slug, is_published
from public.locations
where deleted_at is null and name ~* 'love''?s' and name ~ '#\s*201\b';

-- 5. MAP-PIN RULE. Exactly one coordinate-bearing row per Love's site. A store
--    number with two mappable rows means a duplicate pin.
--    Expected: 0 rows.
select substring(name from '#\s*(\d+)') as store_number, state, count(*) as mappable_rows,
       string_agg(category_slug || ':' || id::text, ' | ') as rows
from public.locations
where deleted_at is null and name ~* 'love''?s' and lat is not null
  and name !~* '^(boss truck shop|speedco)'
group by 1, 2 having count(*) > 1;

-- 6. No two distinct Love's sites share a coordinate. Expected: 0 rows.
select lat, lng, count(*), string_agg(name, ' | ')
from public.locations
where deleted_at is null and source = 'loves-master-2026-07-27' and lat is not null
group by lat, lng having count(*) > 1;

-- 7. Nothing was featured, and indexability did not move.
--    Expected: featured 0; indexable unchanged from the pre-import count.
select count(*) filter (where is_featured) as featured,
       count(*) filter (where is_indexable) as indexable
from public.locations where deleted_at is null;

-- 8. Coverage after, by corridor — the number the launch gate actually cares
--    about. Before: I-80 0, I-90/I-94 0, I-10 0, I-15 0.
select interstate,
       count(*) filter (where is_published) as published,
       count(*) filter (where is_published and lat is not null) as mappable,
       count(*) filter (where is_published and overnight_parking is true) as overnight
from public.locations
where deleted_at is null and interstate is not null
  and source = 'loves-master-2026-07-27'
group by interstate order by published desc;

-- 9. Per-state reconciliation against the source of record.
--    Expected: matches DIRECTORY-615.csv exactly, state by state.
select state, count(*) as rows,
       count(*) filter (where overnight_parking is true) as overnight,
       count(*) filter (where is_published) as published
from public.locations
where deleted_at is null and source = 'loves-master-2026-07-27'
group by state order by state;

-- 10. The four correction targets. Run before and after CORRECTIONS.sql.
--     Expected AFTER: the three published rows are is_published = false; the
--     Florence row is still false; none is deleted (deleted_at stays null).
select id, name, state, city, is_published, deleted_at
from public.locations
where id in ('c32686ff-6cf3-4422-af97-80b823e07eb9',
             '485085d9-98c6-4e88-9661-862c3bc0c514',
             'f6404302-7971-4884-8f37-82f098913d65',
             'beb05d53-db50-49cb-8790-ec01b45c8187',
             'a199a4b9-60d4-4e07-9a81-b518b722a483')
order by state, name;
