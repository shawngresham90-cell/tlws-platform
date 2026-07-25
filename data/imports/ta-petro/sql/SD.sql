-- TA/Petro authorized import - state SD (3 rows)
-- ONE transaction, INSERT-ONLY. Live dual-key duplicate re-check runs
-- ATOMICALLY inside this transaction; GET DIAGNOSTICS compares the actual
-- inserted count with the expected payload count and RAISES on any mismatch,
-- rolling back this entire state. Idempotent: re-running inserts nothing.
-- source stamped 'official-ta-petro-20260725-5ebe0e9f'. geo is never written.
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Express Hot Springs","27638 US 385","Hot Springs","SD","57747","605-745-4215","75 truck parking spaces. 2 showers. 4 diesel lanes. On site: Cinnabon, Pizza Hut, Subway. Weigh scale on site (brand unconfirmed)",43.3986,-103.3958,75,["Showers","Food","Fuel","Laundry"],"ta-express-hot-springs"],["TA Express Summit","45789 US Hwy 12","Summit","SD","57266","605-398-6493","70 truck parking spaces. 4 showers. 4 service bays. 8 diesel lanes. On site: Caribou Coffee, Cinnabon, Pizza Hut Express, Subway. Weigh scale on site (brand unconfirmed)",45.3112,-97.04626,70,["Showers","Food","Fuel","Laundry","Repair"],"ta-express-summit"],["TA Express Vermillion","47051 SD Hwy 50","Burbank","SD","57010","605-624-2062","105 truck parking spaces. 5 showers. 8 diesel lanes. On site: Caribou Coffee, Cinnabon, Pizza Hut Express, Subway. Weigh scale on site (brand unconfirmed)",42.785,-96.797,105,["Showers","Food","Fuel","Laundry"],"ta-express-vermillion"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 3 then raise exception 'SD: expected 3 inserted, got % - rolling back this state', n; end if;
raise notice 'SD: inserted % of 3', n;
end $g$;
commit;
