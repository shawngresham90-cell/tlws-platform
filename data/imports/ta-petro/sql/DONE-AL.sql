-- TA/Petro authorized import - state AL (8 rows)
-- ONE transaction, INSERT-ONLY. Live dual-key duplicate re-check runs
-- ATOMICALLY inside this transaction; GET DIAGNOSTICS compares the actual
-- inserted count with the expected payload count and RAISES on any mismatch,
-- rolling back this entire state. Idempotent: re-running inserts nothing.
-- source stamped 'official-ta-petro-20260725-5ebe0e9f'. geo is never written.
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Tuscaloosa","3501 Buttermilk Road","Tuscaloosa","AL","35453-9364","205-554-0215","151 truck parking spaces. 12 showers. 6 service bays. 10 diesel lanes. On site: Popeyes. Weigh scale on site (brand unconfirmed)",33.1759,-87.4462,151,["Showers","Food","Fuel","Laundry","Repair"],"ta-tuscaloosa"],["TA Mobile","9201 Grand Bay","Grand Bay","AL","36541","251-865-6175","89 truck parking spaces. 8 showers. 5 service bays. 6 diesel lanes. On site: Dunkin'', Popeyes. Weigh scale on site (brand unconfirmed)",30.4985,-88.3336,89,["Showers","Food","Fuel","Laundry","Repair"],"ta-mobile"],["Petro Bucksville","22526 Highway 216","McCalla","AL","35111","205-477-9178","255 truck parking spaces. 14 showers. 5 service bays. 12 diesel lanes. On site: Iron Skillet; Popeyes. Weigh scale on site (brand unconfirmed)",33.2796,-87.0919,255,["Showers","Food","Fuel","Laundry","Repair"],"petro-bucksville"],["Petro Gadsden","1724 West Grand Avenue","Gadsden","AL","35904","256-413-7135","162 truck parking spaces. 9 showers. 6 service bays. 11 diesel lanes. On site: Hunt Brothers Pizza, Popeyes, Starbucks. Weigh scale on site (brand unconfirmed)",33.9956,-86.0827,162,["Showers","Food","Fuel","Laundry","Repair"],"petro-gadsden"],["Petro Shorter","428 Main St","Shorter","AL","36075","334-727-3354","53 truck parking spaces. 6 showers. 4 diesel lanes. On site: Charleys Philly Steaks, Miss J\u2019s Caf\u00e9. Weigh scale on site (brand unconfirmed)",32.4056,-85.9556,53,["Showers","Food","Fuel","Laundry"],"petro-shorter"],["TA Lincoln","75246 Alabama 77","Lincoln","AL","35096","205-763-2771","45 truck parking spaces. 4 showers. 4 service bays. 7 diesel lanes. On site: Popeyes. Weigh scale on site (brand unconfirmed)",33.5865,-86.1248,45,["Showers","Food","Fuel","Laundry","Repair"],"ta-lincoln"],["TA Express Birmingham","901 Bankhead Hwy","Birmingham","AL","35204","205-777-9910","85 truck parking spaces. 7 showers. 8 diesel lanes. On site: Arby''s, Miss J\u2019s Caf\u00e9. Weigh scale on site (brand unconfirmed)",33.52936,-86.85116,85,["Showers","Food","Fuel","Laundry"],"ta-express-birmingham"],["TA Robertsdale","27801 County Road 64","Robertsdale","AL","36567","251-960-1150","178 truck parking spaces. 7 showers. 3 service bays. 11 diesel lanes. On site: Derail Diner; Miss J''s, Sbarro, Subway. Weigh scale on site (brand unconfirmed)",30.63035,-87.61585,178,["Showers","Food","Fuel","Laundry","Repair"],"ta-robertsdale"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 8 then raise exception 'AL: expected 8 inserted, got % - rolling back this state', n; end if;
raise notice 'AL: inserted % of 8', n;
end $g$;
commit;
