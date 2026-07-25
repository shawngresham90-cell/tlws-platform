-- TA/Petro authorized import - state NY (7 rows)
-- ONE transaction, INSERT-ONLY. Live dual-key duplicate re-check runs
-- ATOMICALLY inside this transaction; GET DIAGNOSTICS compares the actual
-- inserted count with the expected payload count and RAISES on any mismatch,
-- rolling back this entire state. Idempotent: re-running inserts nothing.
-- source stamped 'official-ta-petro-20260725-5ebe0e9f'. geo is never written.
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Pembroke","8420 Alleghany","Corfu","NY","14036-0276","585-599-4577","132 truck parking spaces. 6 showers. 6 service bays. 8 diesel lanes. On site: Country Pride. Weigh scale on site (brand unconfirmed)",43.0059,-78.4056,132,["Showers","Food","Fuel","Laundry","Repair"],"ta-pembroke"],["TA Binghamton","753 Upper Court Street","Binghamton","NY","13904","607-775-3500","125 truck parking spaces. 6 showers. 3 service bays. 6 diesel lanes. On site: Country Pride. Weigh scale on site (brand unconfirmed)",42.1013,-75.8418,125,["Showers","Food","Fuel","Laundry","Repair"],"ta-binghamton"],["TA Dansville","9616 Commerce Drive","Dansville","NY","14437","585-335-6023","102 truck parking spaces. 5 showers. 2 service bays. 8 diesel lanes. On site: Country Pride. Weigh scale on site (brand unconfirmed)",42.5662,-77.7195,102,["Showers","Food","Fuel","Laundry","Repair"],"ta-dansville"],["TA Maybrook","125 Neelytown Road","Montgomery","NY","12549","845-457-3163","160 truck parking spaces. 11 showers. 5 service bays. 10 diesel lanes. On site: Country Pride; Pizza Hut Express. Weigh scale on site (brand unconfirmed)",41.5042,-74.2207,160,["Showers","Food","Fuel","Laundry","Repair"],"ta-maybrook"],["Petro Waterloo","1255 Route 414","Waterloo","NY","13165","315-220-6550","221 truck parking spaces. 18 showers. 5 service bays. 12 diesel lanes. On site: Iron Skillet. Weigh scale on site (brand unconfirmed)",42.9653,-76.8454,221,["Showers","Food","Fuel","Laundry","Repair"],"petro-waterloo"],["TA Fultonville","40 Riverside Drive","Fultonville","NY","12072","838-292-9580","121 truck parking spaces. 8 showers. 2 service bays. 10 diesel lanes. On site: Miss J''s Diner; Miss J''s, Sbarro. Weigh scale on site (brand unconfirmed)",42.948546,-74.363064,121,["Showers","Food","Fuel","Laundry","Repair"],"ta-fultonville"],["TA Express Niagara Falls","6021 Porter Rd","Niagara Falls","NY","14304","716-461-4759","60 truck parking spaces. 4 showers. 5 diesel lanes. On site: Miss J\u2019s Caf\u00e9, Tim Horton''s. Truck wash: Truck Wash",43.10695,-78.99444,60,["Showers","Food","Fuel","Laundry"],"ta-express-niagara-falls"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 7 then raise exception 'NY: expected 7 inserted, got % - rolling back this state', n; end if;
raise notice 'NY: inserted % of 7', n;
end $g$;
commit;
