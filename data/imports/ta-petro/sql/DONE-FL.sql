-- TA/Petro authorized import - state FL (5 rows)
-- ONE transaction, INSERT-ONLY. Live dual-key duplicate re-check runs
-- ATOMICALLY inside this transaction; GET DIAGNOSTICS compares the actual
-- inserted count with the expected payload count and RAISES on any mismatch,
-- rolling back this entire state. Idempotent: re-running inserts nothing.
-- source stamped 'official-ta-petro-20260725-5ebe0e9f'. geo is never written.
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Express Tampa","11706 Tampa Gateway Blvd.","Seffner","FL","33584","813-262-1560","81 truck parking spaces. 7 showers. 3 service bays. 6 diesel lanes. On site: Arby''s, Popeyes. Weigh scale on site (brand unconfirmed)",28.0099,-82.301,81,["Showers","Food","Fuel","Laundry","Repair"],"ta-express-tampa"],["TA Marianna","2112 Highway 71 South","Marianna","FL","32448","850-526-3303","123 truck parking spaces. 9 showers. 5 service bays. 8 diesel lanes. On site: Popeyes, Taco Bell & Pizza Hut Express. Weigh scale on site (brand unconfirmed)",30.7187,-85.1837,123,["Showers","Food","Fuel","Laundry","Repair"],"ta-marianna"],["TA Baldwin","1024 US 301 South","Baldwin","FL","32234","904-266-4281","90 truck parking spaces. 6 showers. 2 service bays. 6 diesel lanes. On site: Arby''s. Weigh scale on site (brand unconfirmed)",30.2855,-81.9841,90,["Showers","Food","Fuel","Laundry","Repair"],"ta-baldwin"],["TA Jacksonville South","1650 C.R. 210 West","Jacksonville","FL","32259-2011","904-829-3946","87 truck parking spaces. 6 showers. 3 service bays. 7 diesel lanes. On site: Popeyes, Subway. Weigh scale on site (brand unconfirmed)",30.0661,-81.4961,87,["Showers","Food","Fuel","Laundry","Repair"],"ta-jacksonville-south"],["TA Express Medley","12200 NW South River Drive","Medley","FL","33178","786-697-6329","58 truck parking spaces. 3 showers. 6 diesel lanes. On site: Miss J\u2019s Caf\u00e9",25.8847,-80.36621,58,["Showers","Food","Fuel","Laundry"],"ta-express-medley"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 5 then raise exception 'FL: expected 5 inserted, got % - rolling back this state', n; end if;
raise notice 'FL: inserted % of 5', n;
end $g$;
commit;
