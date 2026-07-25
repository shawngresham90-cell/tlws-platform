-- TA/Petro authorized import — state SC (5 rows)
-- ONE transaction, INSERT-ONLY. Idempotent: the NOT EXISTS guards re-check
-- duplicates at execution time, so re-running inserts nothing extra and a row
-- that became a duplicate since planning is SKIPPED, never updated.
-- source is stamped 'official-ta-petro-20260725-5ebe0e9f'.
begin;
with s as (select jsonb_array_elements('[["TA Spartanburg","1402 East Main St.","Duncan","SC","29334-9647","864-433-0711","187 truck parking spaces. 11 showers. 8 service bays. 8 diesel lanes. On site: Country Pride. Weigh scale on site (brand unconfirmed)",34.914,-82.11,187,["Showers","Food","Fuel","Laundry","Repair"],"ta-spartanburg"],["Petro Columbia","2154 S. Beltline Blvd.","Columbia","SC","29201","803-908-4889","134 truck parking spaces. 10 showers. 6 service bays. 8 diesel lanes. On site: Quaker Steak & Lube; Starbucks. Weigh scale on site (brand unconfirmed)",33.9533,-80.9896,134,["Showers","Food","Fuel","Laundry","Repair"],"petro-columbia"],["TA Express Fair Play","272 Herring Rd","Fair Play","SC","29643","864-280-7320","52 truck parking spaces. 7 showers. 3 service bays. 5 diesel lanes. On site: Cheryl\u2019s Potato Boat; KFC. Weigh scale on site (brand unconfirmed)",34.50464,-82.96549,52,["Showers","Food","Fuel","Laundry","Repair"],"ta-express-fair-play"],["TA Cowpens","175 Truck Stop Rd","Cowpens","SC","29330","864-755-4335","80 truck parking spaces. 8 showers. 2 service bays. 6 diesel lanes. On site: Sbarro. Weigh scale on site (brand unconfirmed)",35.046879,-81.812281,80,["Showers","Food","Fuel","Laundry","Repair"],"ta-cowpens"],["TA Columbia North","99 Plumbers Road","Columbia","SC","29203","839-228-0693","78 truck parking spaces. 9 showers. 2 service bays. 4 diesel lanes. On site: Dunkin'', Miss J\u2019s Caf\u00e9, Taco Bell. Weigh scale on site (brand unconfirmed)",34.0747,-80.9971,78,["Showers","Food","Fuel","Laundry","Repair"],"ta-columbia-north"]]'::jsonb) e),
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
