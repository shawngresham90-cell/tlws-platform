-- TA/Petro authorized import — state WA (4 rows)
-- ONE transaction, INSERT-ONLY. Idempotent: the NOT EXISTS guards re-check
-- duplicates at execution time, so re-running inserts nothing extra and a row
-- that became a duplicate since planning is SKIPPED, never updated.
-- source is stamped 'official-ta-petro-20260725-5ebe0e9f'.
begin;
with s as (select jsonb_array_elements('[["TA Seattle East","46630 North Bend Way","North Bend","WA","98045","425-888-1119","140 truck parking spaces. 8 showers. 3 service bays. 6 diesel lanes. On site: Popeyes, Starbucks. Weigh scale on site (brand unconfirmed)",47.4683,-121.7181,140,["Showers","Food","Fuel","Laundry","Repair"],"ta-seattle-east"],["Petro Spokane","10506 West Aero Road","Spokane","WA","99224","509-842-1100","200 truck parking spaces. 11 showers. 5 service bays. 10 diesel lanes. On site: Iron Skillet; Starbucks. Weigh scale on site (brand unconfirmed)",47.5906,-117.5612,200,["Showers","Food","Fuel","Laundry","Repair"],"petro-spokane"],["TA Express Blaine","1300 Boblett St","Blaine","WA","98230","360-312-7779","34 truck parking spaces. 4 showers. 5 diesel lanes. On site: Cinnabon, Jamba Juice, Pizza Hut Express. Weigh scale on site (brand unconfirmed)",48.99126,-122.73412,34,["Showers","Food","Fuel","Laundry"],"ta-express-blaine"],["TA Grandview","100 Higgins Way","Grandview","WA","98930","509-405-0911","100 truck parking spaces. 6 showers. 3 service bays. 5 diesel lanes. On site: Applebee''s/IHOP; Miss J''s Indian Cuisine, Miss J''s Tacos, Miss J\u2019s Caf\u00e9",46.27591,-119.92876,100,["Showers","Food","Fuel","Laundry","Repair"],"ta-grandview"]]'::jsonb) e),
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
