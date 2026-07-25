-- TA/Petro authorized import — state CT (3 rows)
-- ONE transaction, INSERT-ONLY. Idempotent: the NOT EXISTS guards re-check
-- duplicates at execution time, so re-running inserts nothing extra and a row
-- that became a duplicate since planning is SKIPPED, never updated.
-- source is stamped 'official-ta-petro-20260725-5ebe0e9f'.
begin;
with s as (select jsonb_array_elements('[["TA Willington","327 Ruby Road","Willington","CT","06279","860-684-0499","240 truck parking spaces. 10 showers. 3 service bays. 8 diesel lanes. On site: Country Pride; Burger King. Weigh scale on site (brand unconfirmed)",41.9177,-72.2615,240,["Showers","Food","Fuel","Laundry","Repair"],"ta-willington"],["TA Southington","1875 Meriden-Waterbury Turnpike","Milldale","CT","06467","860-621-0106","145 truck parking spaces. 10 showers. 3 service bays. 8 diesel lanes. On site: Popeyes, Taco Bell. Weigh scale on site (brand unconfirmed)",41.5647,-72.9102,145,["Showers","Food","Fuel","Laundry","Repair"],"ta-southington"],["TA Express New Haven","3 East Industrial Road","Branford","CT","06405-6508","203-481-0301","75 truck parking spaces. 7 showers. 4 service bays. 6 diesel lanes. On site: Pizza Hut Express, Popeyes, Starbucks. Weigh scale on site (brand unconfirmed)",41.2968,-72.7595,75,["Showers","Food","Fuel","Laundry","Repair"],"ta-express-new-haven"]]'::jsonb) e),
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
