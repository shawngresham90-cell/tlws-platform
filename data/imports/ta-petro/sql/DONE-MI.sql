-- TA/Petro authorized import - state MI (4 rows)
-- ONE transaction, INSERT-ONLY. Live dual-key duplicate re-check runs
-- ATOMICALLY inside this transaction; GET DIAGNOSTICS compares the actual
-- inserted count with the expected payload count and RAISES on any mismatch,
-- rolling back this entire state. Idempotent: re-running inserts nothing.
-- source stamped 'official-ta-petro-20260725-5ebe0e9f'. geo is never written.
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Ann Arbor","200 Baker Road","Dexter","MI","48130","734-426-3951","203 truck parking spaces. 8 showers. 3 service bays. 9 diesel lanes. On site: Popeyes. Weigh scale on site (brand unconfirmed)",42.2963,-83.8764,203,["Showers","Food","Fuel","Laundry","Repair"],"ta-ann-arbor"],["TA Sawyer","6100 Sawyer Road","Sawyer","MI","49125","269-426-4884","155 truck parking spaces. 9 showers. 3 service bays. 10 diesel lanes. On site: Burger King, Pizza Hut, Popeyes, Taco Bell Express. Weigh scale on site (brand unconfirmed)",41.8845,-86.6001,155,["Showers","Food","Fuel","Laundry","Repair"],"ta-sawyer"],["TA Battle Creek","15874 Eleven Mile Rd.","Battle Creek","MI","49014","269-965-7721","157 truck parking spaces. 6 showers. 5 service bays. 9 diesel lanes. On site: Country Pride. Weigh scale on site (brand unconfirmed)",42.3029,-85.0811,157,["Showers","Food","Fuel","Repair"],"ta-battle-creek"],["TA Tekonsha","15587 M-60","Tekonsha","MI","49092","517-767-4135","85 truck parking spaces. 6 showers. 4 service bays. 5 diesel lanes. Weigh scale on site (brand unconfirmed)",42.1065,-84.9897,85,["Showers","Fuel","Laundry","Repair"],"ta-tekonsha"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 4 then raise exception 'MI: expected 4 inserted, got % - rolling back this state', n; end if;
raise notice 'MI: inserted % of 4', n;
end $g$;
commit;
