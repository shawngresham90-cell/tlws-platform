-- TA/Petro authorized import — state ND (5 rows)
-- ONE transaction, INSERT-ONLY. Idempotent: the NOT EXISTS guards re-check
-- duplicates at execution time, so re-running inserts nothing extra and a row
-- that became a duplicate since planning is SKIPPED, never updated.
-- source is stamped 'official-ta-petro-20260725-5ebe0e9f'.
begin;
with s as (select jsonb_array_elements('[["TA Express Alexander","14256 US-85","Alexander","ND","58831","701-707-1770","55 truck parking spaces. 6 showers. 6 diesel lanes. On site: Champs Chicken. Weigh scale on site (brand unconfirmed)",47.8053,-103.6452,55,["Showers","Food","Fuel","Laundry"],"ta-express-alexander"],["TA Express Steele","620 Mitchell Avenue North","Steele","ND","58482","701-475-2274","70 truck parking spaces. 6 showers. 1 service bays. 7 diesel lanes. On site: Caribou Coffee, Cinnabon, Pizza Hut Express, Subway",46.8618,-99.9157,70,["Showers","Food","Fuel","Laundry","Repair"],"ta-express-steele"],["Petro Fargo","4510 19th Ave S.W.","Fargo","ND","58103","701-282-8105","209 truck parking spaces. 10 showers. 4 service bays. 16 diesel lanes. On site: Dolly Down; Charleys Philly Steaks, Cinnabon, Papa John''s Pizza, Popeyes",46.8503,-96.8632,209,["Showers","Food","Fuel","Laundry","Repair"],"petro-fargo"],["TA Express Grand Forks","1212 North 47th Street","Grand Forks","ND","58203","701-317-3785","65 truck parking spaces. 8 showers. 8 diesel lanes. On site: Miss J\u2019s Caf\u00e9. Weigh scale on site (brand unconfirmed)",47.9322,-97.09564,65,["Showers","Food","Fuel","Laundry"],"ta-express-grand-forks"],["TA Express Williston","13553 64th Street","Williston","ND","58801","701-641-1393","40 truck parking spaces. 5 showers. 8 diesel lanes. On site: Cinnabon, Miss J\u2019s Caf\u00e9, Subway. Weigh scale on site (brand unconfirmed)",48.34334,-103.61586,40,["Showers","Food","Fuel","Laundry"],"ta-express-williston"]]'::jsonb) e),
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
