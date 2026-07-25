-- TA/Petro authorized import - state IA (6 rows)
-- ONE transaction, INSERT-ONLY. Live dual-key duplicate re-check runs
-- ATOMICALLY inside this transaction; GET DIAGNOSTICS compares the actual
-- inserted count with the expected payload count and RAISES on any mismatch,
-- rolling back this entire state. Idempotent: re-running inserts nothing.
-- source stamped 'official-ta-petro-20260725-5ebe0e9f'. geo is never written.
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Council Bluffs","3210 South Seven Street","Council Bluffs","IA","51501","712-366-2217","78 truck parking spaces. 8 showers. 2 service bays. 8 diesel lanes. Weigh scale on site (brand unconfirmed)",41.2287,-95.8536,78,["Showers","Fuel","Laundry","Repair"],"ta-council-bluffs"],["TA Walcott","755 W. Iowa 80 Road","Walcott","IA","52773","563-284-6961","900 truck parking spaces. 24 showers. 7 service bays. 15 diesel lanes. On site: Iowa 80 Kitchen; Blimpie, Dairy Queen, Orange Julius, Pizza Hut Express, Starbucks, Taco Bell, Wendy''s. Truck wash: Truckomat Truck Wash. Weigh scale on site (brand unconfirmed)",41.6179,-90.7815,900,["Showers","Food","Fuel","Laundry","Repair"],"ta-walcott"],["TA Brooklyn","4124 V18 Rd.","Brooklyn","IA","52211","641-631-0047","70 truck parking spaces. 5 showers. 4 service bays. 7 diesel lanes. On site: Country Pride; Hunt Brothers Pizza. Weigh scale on site (brand unconfirmed)",41.6978,-92.4459,70,["Showers","Food","Fuel","Laundry","Repair"],"ta-brooklyn"],["TA Express Holland","16250 N Ave","Holland","IA","50642","319-823-1477","92 truck parking spaces. 2 showers. 5 diesel lanes. On site: Arby''s, Godfather Pizza",42.466575,-92.7672,92,["Showers","Food","Fuel","Laundry"],"ta-express-holland"],["TA Express Holstein","2010 Indorf Avenue","Holstein","IA","51025","712-371-9965","39 truck parking spaces. 2 showers. 6 diesel lanes. On site: Dunkin'', Hardee''s. Weigh scale on site (brand unconfirmed)",42.4740798579903,-95.5441132080078,39,["Showers","Food","Fuel","Laundry"],"ta-express-holstein"],["TA Williams","3065 220th Street","Williams","IA","50271","515-851-1339","125 truck parking spaces. 6 showers. 6 diesel lanes. On site: Miss J''s, Sbarro. Weigh scale on site (brand unconfirmed)",42.47183,-93.56553,125,["Showers","Food","Fuel","Laundry"],"ta-williams"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 6 then raise exception 'IA: expected 6 inserted, got % - rolling back this state', n; end if;
raise notice 'IA: inserted % of 6', n;
end $g$;
commit;
