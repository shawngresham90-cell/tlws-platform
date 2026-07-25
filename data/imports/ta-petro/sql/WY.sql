-- TA/Petro authorized import - state WY (5 rows)
-- ONE transaction, INSERT-ONLY. Live dual-key duplicate re-check runs
-- ATOMICALLY inside this transaction; GET DIAGNOSTICS compares the actual
-- inserted count with the expected payload count and RAISES on any mismatch,
-- rolling back this entire state. Idempotent: re-running inserts nothing.
-- source stamped 'official-ta-petro-20260725-5ebe0e9f'. geo is never written.
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Cheyenne","4000 I-80 Service Road","Burns","WY","82053","307-365-6670","140 truck parking spaces. 12 showers. 3 service bays. 9 diesel lanes. On site: Country Pride; Burger King, Taco Bell. Weigh scale on site (brand unconfirmed)",41.1602,-104.5207,140,["Showers","Food","Fuel","Laundry","Repair"],"ta-cheyenne"],["TA Ft. Bridger","I-80 at Bigelow Road, Exit 30","Ft. Bridger","WY","82933","307-209-2115","165 truck parking spaces. 9 showers. 3 service bays. 10 diesel lanes. On site: Burger King, Taco Bell Express. Weigh scale on site (brand unconfirmed)",41.3144,-110.5095,165,["Showers","Food","Fuel","Laundry","Repair"],"ta-ft-bridger"],["TA Rawlins","1400 Higley Blvd., Exit 214","Rawlins","WY","82301","307-324-8722","188 truck parking spaces. 12 showers. 4 service bays. 12 diesel lanes. On site: Country Pride; Subway. Weigh scale on site (brand unconfirmed)",41.7762,-107.2243,188,["Showers","Food","Fuel","Laundry","Repair"],"ta-rawlins"],["Petro Laramie","1855 West Curtis","Laramie","WY","82070","307-745-6480","236 truck parking spaces. 14 showers. 5 service bays. 12 diesel lanes. On site: Iron Skillet. Truck wash: Blue Beacon Truck Wash. Weigh scale on site (brand unconfirmed)",41.3287,-105.6194,236,["Showers","Food","Fuel","Laundry","Repair"],"petro-laramie"],["TA Express Rock Springs","1620 Elk Street","Rock Springs","WY","82901","307-522-8996","65 truck parking spaces. 3 showers. 7 diesel lanes. On site: Miss J''s",41.6122,-109.22972,65,["Showers","Food","Fuel","Laundry"],"ta-express-rock-springs"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 5 then raise exception 'WY: expected 5 inserted, got % - rolling back this state', n; end if;
raise notice 'WY: inserted % of 5', n;
end $g$;
commit;
