-- TA/Petro authorized import — state KY (3 rows)
-- ONE transaction, INSERT-ONLY. Idempotent: the NOT EXISTS guards re-check
-- duplicates at execution time, so re-running inserts nothing extra and a row
-- that became a duplicate since planning is SKIPPED, never updated.
-- source is stamped 'official-ta-petro-20260725-5ebe0e9f'.
begin;
with s as (select jsonb_array_elements('[["Petro Glendale","554 W. Glendale Hodgenville Road","Glendale","KY","42740","270-369-6840","263 truck parking spaces. 19 showers. 5 service bays. 12 diesel lanes. On site: Iron Skillet. Truck wash: Blue Beacon Truck Wash. Weigh scale on site (brand unconfirmed)",37.5984,-85.8734,263,["Showers","Food","Fuel","Laundry","Repair"],"petro-glendale"],["TA Truck Service Franklin","101 Trotter Lane","Franklin","KY","42134","270-586-0877","4 service bays",36.7163,-86.5244,null,["Repair"],"ta-truck-service-franklin"],["TA Smiths Grove","605 S Main St","Smiths Grove","KY","42171","270-563-4713","120 truck parking spaces. 6 showers. 2 service bays. 6 diesel lanes. On site: Highway Kitchen, Taco Bell. Weigh scale on site (brand unconfirmed)",37.045027,-86.210351,120,["Showers","Food","Fuel","Repair"],"ta-smiths-grove"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,
  (e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,
  category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,
  'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false
from f on conflict do nothing
returning id::text, state, slug;
commit;
