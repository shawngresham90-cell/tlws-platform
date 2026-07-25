-- TA/Petro authorized import - state WV (4 rows)
-- ONE transaction, INSERT-ONLY. Live dual-key duplicate re-check runs
-- ATOMICALLY inside this transaction; GET DIAGNOSTICS compares the actual
-- inserted count with the expected payload count and RAISES on any mismatch,
-- rolling back this entire state. Idempotent: re-running inserts nothing.
-- source stamped 'official-ta-petro-20260725-5ebe0e9f'. geo is never written.
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Wheeling","270 W. Alexander Road","Valley Grove","WV","26060-8025","304-547-1521","168 truck parking spaces. 12 showers. 4 service bays. 8 diesel lanes. On site: Country Pride. Weigh scale on site (brand unconfirmed)",40.0694,-80.5677,168,["Showers","Food","Fuel","Laundry","Repair"],"ta-wheeling"],["TA Hurricane","4195 State Route 34","Hurricane","WV","25526-9772","304-757-7600","76 truck parking spaces. 7 showers. 5 service bays. 9 diesel lanes. Weigh scale on site (brand unconfirmed)",38.4543,-81.935,76,["Showers","Fuel","Laundry","Repair"],"ta-hurricane"],["TA Jane Lew","102 Jesse Run Rd","Jane Lew","WV","26378","304-543-9604","75 truck parking spaces. 6 showers. 6 diesel lanes. On site: IHOP; Arby''s, Miss J\u2019s Caf\u00e9",39.1031,-80.38971,75,["Showers","Food","Fuel","Laundry"],"ta-jane-lew"],["TA Mineral Wells","470 Frontage Road","Mineral Wells","WV","26150","304-761-3854","104 truck parking spaces. 5 showers. 5 diesel lanes. On site: IHOP; Miss J\u2019s Caf\u00e9. Weigh scale on site (brand unconfirmed)",39.19482,-81.52601,104,["Showers","Food","Fuel","Laundry"],"ta-mineral-wells"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 4 then raise exception 'WV: expected 4 inserted, got % - rolling back this state', n; end if;
raise notice 'WV: inserted % of 4', n;
end $g$;
commit;
