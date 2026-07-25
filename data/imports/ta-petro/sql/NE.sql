-- TA/Petro authorized import - state NE (3 rows)
-- ONE transaction, INSERT-ONLY. Live dual-key duplicate re-check runs
-- ATOMICALLY inside this transaction; GET DIAGNOSTICS compares the actual
-- inserted count with the expected payload count and RAISES on any mismatch,
-- rolling back this entire state. Idempotent: re-running inserts nothing.
-- source stamped 'official-ta-petro-20260725-5ebe0e9f'. geo is never written.
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Ogallala","103 Prospector Drive","Ogallala","NE","69153-3198","308-284-3667","94 truck parking spaces. 9 showers. 2 service bays. 8 diesel lanes. On site: Country Pride. Weigh scale on site (brand unconfirmed)",41.1138,-101.7116,94,["Showers","Food","Fuel","Laundry","Repair"],"ta-ogallala"],["TA Grand Island","8033 West Holling Rd.","Alda","NE","68810-0167","308-382-5902","82 truck parking spaces. 7 showers. 2 service bays. 6 diesel lanes. On site: Country Pride. Weigh scale on site (brand unconfirmed)",40.7998,-98.496,82,["Showers","Food","Fuel","Laundry","Repair"],"ta-grand-island"],["Petro York","4700 S. Lincoln Ave.","York","NE","68467","402-362-1776","250 truck parking spaces. 16 showers. 5 service bays. 10 diesel lanes. On site: Iron Skillet; Pizza Hut Express. Truck wash: Blue Beacon Truck Wash. Weigh scale on site (brand unconfirmed)",40.8182,-97.5989,250,["Showers","Food","Fuel","Laundry","Repair"],"petro-york"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 3 then raise exception 'NE: expected 3 inserted, got % - rolling back this state', n; end if;
raise notice 'NE: inserted % of 3', n;
end $g$;
commit;
