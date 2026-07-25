-- TA/Petro authorized import - state ID (2 rows)
-- ONE transaction, INSERT-ONLY. Live dual-key duplicate re-check runs
-- ATOMICALLY inside this transaction; GET DIAGNOSTICS compares the actual
-- inserted count with the expected payload count and RAISES on any mismatch,
-- rolling back this entire state. Idempotent: re-running inserts nothing.
-- source stamped 'official-ta-petro-20260725-5ebe0e9f'. geo is never written.
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Boise","4115 Broadway Ave","Boise","ID","83705","208-344-1091","171 truck parking spaces. 12 showers. 3 service bays. 7 diesel lanes. On site: Country Pride; Subway, Taco Bell. Weigh scale on site (brand unconfirmed)",43.5656,-116.1994,171,["Showers","Food","Fuel","Laundry","Repair"],"ta-boise"],["TA Express Dubois","424 W. Main Street","Dubois","ID","83423","208-374-5381","30 truck parking spaces. 2 showers. 2 diesel lanes. On site: Blu Taco, Champs Chicken, Hangar 54 Pizza",44.17658,-112.23663,30,["Showers","Food","Fuel"],"ta-express-dubois"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 2 then raise exception 'ID: expected 2 inserted, got % - rolling back this state', n; end if;
raise notice 'ID: inserted % of 2', n;
end $g$;
commit;
