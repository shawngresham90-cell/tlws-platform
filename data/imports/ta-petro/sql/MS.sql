-- TA/Petro authorized import — state MS (4 rows)
-- ONE transaction, INSERT-ONLY. Idempotent: the NOT EXISTS guards re-check
-- duplicates at execution time, so re-running inserts nothing extra and a row
-- that became a duplicate since planning is SKIPPED, never updated.
-- source is stamped 'official-ta-petro-20260725-5ebe0e9f'.
begin;
with s as (select jsonb_array_elements('[["TA Meridian","2150 Russell Mt. Gilead Road","Meridian","MS","39301","601-483-7611","90 truck parking spaces. 6 showers. 5 service bays. 8 diesel lanes. On site: Country Pride. Weigh scale on site (brand unconfirmed)",32.3962,-88.5826,90,["Showers","Food","Fuel","Laundry","Repair"],"ta-meridian"],["Petro Jackson","970 W Frontage Road","Jackson","MS","39201","601-292-0950","194 truck parking spaces. 15 showers. 5 service bays. 10 diesel lanes. On site: Miss J''s. Weigh scale on site (brand unconfirmed)",32.2787,-90.1977,194,["Showers","Food","Fuel","Laundry","Repair"],"petro-jackson"],["TA McComb","1120 Airport Fernwood Road","McComb","MS","39648","601-996-0614","115 truck parking spaces. 7 showers. 2 service bays. 6 diesel lanes. On site: Denny''s; Subway. Weigh scale on site (brand unconfirmed)",31.18949,-90.48617,115,["Showers","Food","Fuel","Repair"],"ta-mccomb"],["TA Express Mooreville","590 MS 371","Mooreville","MS","38857","662-205-6298","40 truck parking spaces. 5 showers. 7 diesel lanes. On site: Chester Fried Chicken, Sbarro. Weigh scale on site (brand unconfirmed)",34.279082,-88.568724,40,["Showers","Food","Fuel","Laundry"],"ta-express-mooreville"]]'::jsonb) e),
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
