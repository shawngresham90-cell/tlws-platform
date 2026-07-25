-- TA/Petro authorized import - state NJ (4 rows)
-- ONE transaction, INSERT-ONLY. Live dual-key duplicate re-check runs
-- ATOMICALLY inside this transaction; GET DIAGNOSTICS compares the actual
-- inserted count with the expected payload count and RAISES on any mismatch,
-- rolling back this entire state. Idempotent: re-running inserts nothing.
-- source stamped 'official-ta-petro-20260725-5ebe0e9f'. geo is never written.
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Columbia","2 Simpson Road","Columbia","NJ","07832-0305","908-496-4124","172 truck parking spaces. 7 showers. 5 service bays. 8 diesel lanes. On site: Country Pride; Pizza Hut Express, Taco Bell Express. Weigh scale on site (brand unconfirmed)",40.9317,-75.0969,172,["Showers","Food","Fuel","Laundry","Repair"],"ta-columbia"],["TA Bloomsbury","975 State Route 173","Bloomsbury","NJ","08804","908-479-4136","122 truck parking spaces. 7 showers. 4 service bays. 9 diesel lanes. On site: Country Pride; Burger King. Weigh scale on site (brand unconfirmed)",40.6594,-75.075,122,["Showers","Food","Fuel","Laundry","Repair"],"ta-bloomsbury"],["Petro Bordentown","402 Rising Sun Square Road","Bordentown","NJ","08505","609-298-6070","490 truck parking spaces. 20 showers. 6 service bays. 12 diesel lanes. On site: Iron Skillet; Arby''s. Truck wash: Blue Beacon Truck Wash. Weigh scale on site (brand unconfirmed)",40.1234,-74.7131,490,["Showers","Food","Fuel","Laundry","Repair"],"petro-bordentown"],["TA Paulsboro","171 Berkley Road","Paulsboro","NJ","08066","856-423-5500","175 truck parking spaces. 8 showers. 3 service bays. 12 diesel lanes. On site: Miss J\u2019s Caf\u00e9. Weigh scale on site (brand unconfirmed)",39.819,-75.2385,175,["Showers","Food","Fuel","Laundry","Repair"],"ta-paulsboro"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 4 then raise exception 'NJ: expected 4 inserted, got % - rolling back this state', n; end if;
raise notice 'NJ: inserted % of 4', n;
end $g$;
commit;
