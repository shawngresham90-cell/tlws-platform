-- TA/Petro authorized import - state OR (6 rows)
-- ONE transaction, INSERT-ONLY. Live dual-key duplicate re-check runs
-- ATOMICALLY inside this transaction; GET DIAGNOSTICS compares the actual
-- inserted count with the expected payload count and RAISES on any mismatch,
-- rolling back this entire state. Idempotent: re-running inserts nothing.
-- source stamped 'official-ta-petro-20260725-5ebe0e9f'. geo is never written.
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Aurora","21856 Bents Road NE","Aurora","OR","97002","503-678-2111","275 truck parking spaces. 9 showers. 2 service bays. 8 diesel lanes. On site: Popeyes. Weigh scale on site (brand unconfirmed)",45.2361,-122.8072,275,["Showers","Food","Fuel","Laundry","Repair"],"ta-aurora"],["TA Troutdale","790 N W Frontage Road","Troutdale","OR","97060","503-666-1588","240 truck parking spaces. 12 showers. 4 service bays. 10 diesel lanes. On site: Country Pride; Popeyes, Subway. Weigh scale on site (brand unconfirmed)",45.5438,-122.3958,240,["Showers","Food","Fuel","Laundry","Repair"],"ta-troutdale"],["TA Huntington","5945 US Hwy 30","Huntington","OR","97907","541-869-2301","140 truck parking spaces. 6 showers. 8 diesel lanes. On site: Miss J''s",44.29342,-117.22491,140,["Showers","Food","Fuel","Laundry"],"ta-huntington"],["TA Express Biggs Junction","91464 Biggs-Rufus Hwy","Wasco","OR","97065","541-739-2106","35 truck parking spaces. 7 showers. 8 diesel lanes. On site: Krispy Krunchy Chicken, Pizza Hut, Taco Bell",45.66881,-120.83487,35,["Showers","Food","Fuel","Laundry"],"ta-express-biggs-junction"],["Petro Phoenix","3730 Fern Valley Rd.","Phoenix","OR","97535","541-535-3372","87 truck parking spaces. 6 showers. 4 service bays. 8 diesel lanes. On site: Iron Skillet. Weigh scale on site (brand unconfirmed)",42.2795,-122.8116,87,["Showers","Food","Fuel","Laundry","Repair"],"petro-phoenix"],["TA Coburg","32910 E. Pearl St.","Coburg","OR","97408","541-868-2880","100 truck parking spaces. 8 showers. 2 service bays. 8 diesel lanes. On site: Coburg Crossing Cafe. Truck wash: Truck Wash. Weigh scale on site (brand unconfirmed)",44.13637,-123.05737,100,["Showers","Food","Fuel","Laundry","Repair"],"ta-coburg"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 6 then raise exception 'OR: expected 6 inserted, got % - rolling back this state', n; end if;
raise notice 'OR: inserted % of 6', n;
end $g$;
commit;
