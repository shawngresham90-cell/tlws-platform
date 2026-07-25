-- TA/Petro authorized import — state UT (3 rows)
-- ONE transaction, INSERT-ONLY. Idempotent: the NOT EXISTS guards re-check
-- duplicates at execution time, so re-running inserts nothing extra and a row
-- that became a duplicate since planning is SKIPPED, never updated.
-- source is stamped 'official-ta-petro-20260725-5ebe0e9f'.
begin;
with s as (select jsonb_array_elements('[["TA Tooele","8836 North Highway 40","Salt Lake City","UT","84074","801-250-8585","191 truck parking spaces. 11 showers. 3 service bays. 7 diesel lanes. On site: Burger King, Taco Bell. Weigh scale on site (brand unconfirmed)",40.6899,-112.2629,191,["Showers","Food","Fuel","Laundry","Repair"],"ta-tooele"],["TA Express Parowan","1130 N. 100 W.","Parowan","UT","84761","435-477-3311","90 truck parking spaces. 6 showers. 6 service bays. 5 diesel lanes. On site: Subway, Taco Bell. Weigh scale on site (brand unconfirmed)",37.8607,-112.8291,90,["Showers","Food","Fuel","Laundry","Repair"],"ta-express-parowan"],["TA Fillmore","885 S Park Ave","Fillmore","UT","84631","435-222-4431","40 truck parking spaces. 3 showers. 6 diesel lanes. On site: Miss J''s",38.95037,-112.35277,40,["Showers","Food","Fuel","Laundry"],"ta-fillmore"]]'::jsonb) e),
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
