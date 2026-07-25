-- TA/Petro authorized import - state OK (7 rows)
-- ONE transaction, INSERT-ONLY. Live dual-key duplicate re-check runs
-- ATOMICALLY inside this transaction; GET DIAGNOSTICS compares the actual
-- inserted count with the expected payload count and RAISES on any mismatch,
-- rolling back this entire state. Idempotent: re-running inserts nothing.
-- source stamped 'official-ta-petro-20260725-5ebe0e9f'. geo is never written.
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Oklahoma City East","801 South Council Road","Oklahoma City","OK","73128-4218","405-787-7411","175 truck parking spaces. 12 showers. 6 service bays. 10 diesel lanes. On site: IHOP. Weigh scale on site (brand unconfirmed)",35.458,-97.6556,175,["Showers","Food","Fuel","Laundry","Repair"],"ta-oklahoma-city-east"],["TA Oklahoma City West","501 South Morgan Road","Oklahoma City","OK","73128","405-324-5376","101 truck parking spaces. 8 showers. 3 service bays. 8 diesel lanes. On site: Fazoli''s, Popeyes. Weigh scale on site (brand unconfirmed)",35.4617,-97.6906,101,["Showers","Food","Fuel","Laundry","Repair"],"ta-oklahoma-city-west"],["TA Sayre","11603 N. 1900 Rd.","Sayre","OK","73662","580-928-5571","101 truck parking spaces. 7 showers. 2 service bays. 10 diesel lanes. On site: Subway, Taco Bell. Weigh scale on site (brand unconfirmed)",35.3355,-99.5946,101,["Showers","Food","Fuel","Repair"],"ta-sayre"],["Petro Oklahoma City","20 Martin Luther King Blvd","Oklahoma City","OK","73117","405-228-7040","280 truck parking spaces. 14 showers. 5 service bays. 12 diesel lanes. On site: Iron Skillet. Weigh scale on site (brand unconfirmed)",35.4662,-97.4755,280,["Showers","Food","Fuel","Laundry","Repair"],"petro-oklahoma-city"],["TA Express Tonkawa","16700 W South Ave","Tonkawa","OK","74653","580-670-1199","32 truck parking spaces. 5 showers. 5 diesel lanes. On site: Dunkin'', Miss J''s. Weigh scale on site (brand unconfirmed)",36.69598,-97.35146,32,["Showers","Food","Fuel","Laundry"],"ta-express-tonkawa"],["TA Express South Coffeyville","111 E. County Road 2","South Coffeyville","OK","74072","918-842-4000","40 truck parking spaces. 4 showers. 5 diesel lanes. On site: Golden Chick, The Stuffed Burrito Company",36.98543,-95.62498,40,["Showers","Food","Fuel","Laundry"],"ta-express-south-coffeyville"],["TA Express Savanna","9062 US Hwy 69","Savanna","OK","74565","405-446-4501","60 truck parking spaces. 3 showers. 5 diesel lanes. On site: Dunkin'', Miss J''s, Sbarro",34.833383,-95.83959,60,["Showers","Food","Fuel","Laundry"],"ta-express-savanna"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 7 then raise exception 'OK: expected 7 inserted, got % - rolling back this state', n; end if;
raise notice 'OK: inserted % of 7', n;
end $g$;
commit;
