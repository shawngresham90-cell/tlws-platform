-- TA/Petro authorized import - state MN (4 rows)
-- ONE transaction, INSERT-ONLY. Live dual-key duplicate re-check runs
-- ATOMICALLY inside this transaction; GET DIAGNOSTICS compares the actual
-- inserted count with the expected payload count and RAISES on any mismatch,
-- rolling back this entire state. Idempotent: re-running inserts nothing.
-- source stamped 'official-ta-petro-20260725-5ebe0e9f'. geo is never written.
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["Petro Clearwater","950 State Highway 24","Clearwater","MN","55320","320-558-2261","200 truck parking spaces. 7 showers. 8 diesel lanes. On site: Nelson Brothers. Weigh scale on site (brand unconfirmed)",45.4126,-94.0549,200,["Showers","Food","Fuel","Laundry"],"petro-clearwater"],["Petro Albert Lea","820 Happy Trails Lane","Albert Lea","MN","56007","507-481-9434","300 truck parking spaces. 10 showers. 7 service bays. 10 diesel lanes. On site: Skol Tavern; Caribou Coffee, Mcdonald''s, Sbarro, Taco Bell. Truck wash: Truck Wash. Weigh scale on site (brand unconfirmed)",43.6571,-93.3174,300,["Showers","Food","Fuel","Laundry","Repair"],"petro-albert-lea"],["TA Rogers","13400 Rogers Drive","Rogers","MN","55374-0238","763-428-2277","80 truck parking spaces. 8 showers. 3 service bays. 8 diesel lanes. Weigh scale on site (brand unconfirmed)",45.1969,-93.5492,80,["Showers","Fuel","Laundry","Repair"],"ta-rogers"],["TA Express Mankato","3010 Adams St.","Mankato","MN","56001","320-470-9288","75 truck parking spaces. 4 showers. 8 diesel lanes. On site: Ten20 Tavern; Miss J''s. Weigh scale on site (brand unconfirmed)",44.16971,-93.92541,75,["Showers","Food","Fuel","Laundry"],"ta-express-mankato"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 4 then raise exception 'MN: expected 4 inserted, got % - rolling back this state', n; end if;
raise notice 'MN: inserted % of 4', n;
end $g$;
commit;
