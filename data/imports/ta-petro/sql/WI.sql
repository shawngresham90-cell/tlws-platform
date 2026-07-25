-- TA/Petro authorized import - state WI (7 rows)
-- ONE transaction, INSERT-ONLY. Live dual-key duplicate re-check runs
-- ATOMICALLY inside this transaction; GET DIAGNOSTICS compares the actual
-- inserted count with the expected payload count and RAISES on any mismatch,
-- rolling back this entire state. Idempotent: re-running inserts nothing.
-- source stamped 'official-ta-petro-20260725-5ebe0e9f'. geo is never written.
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Madison","5901 Highway 51","DeForest","WI","53532","608-249-9000","118 truck parking spaces. 9 showers. 4 service bays. 8 diesel lanes. On site: Popeyes. Weigh scale on site (brand unconfirmed)",43.1745,-89.3255,118,["Showers","Food","Fuel","Laundry","Repair"],"ta-madison"],["TA Janesville","3222 Hwy. 14 East","Janesville","WI","53546-8218","608-752-8700","96 truck parking spaces. 12 showers. 4 service bays. 8 diesel lanes. On site: Chester Fried Chicken, Cinnabon, Hunt Brothers Pizza, Wendy''s. Weigh scale on site (brand unconfirmed)",42.7143,-88.9793,96,["Showers","Food","Fuel","Laundry","Repair"],"ta-janesville"],["Petro Portage","North 5800 Kinney Rd.","Portage","WI","53901","608-742-6551","300 truck parking spaces. 14 showers. 4 service bays. 12 diesel lanes. On site: Iron Skillet; Subway. Weigh scale on site (brand unconfirmed)",43.4864,-89.498,300,["Showers","Food","Fuel","Laundry","Repair"],"petro-portage"],["TA Express Osseo","12613 Gunderson Road","Osseo","WI","54758","715-533-6884","60 truck parking spaces. 6 showers. 7 diesel lanes. On site: Family Restaurant; Hunt Brothers Pizza, Miss J\u2019s Caf\u00e9. Weigh scale on site (brand unconfirmed)",44.57829,-91.19926,60,["Showers","Food","Fuel","Laundry"],"ta-express-osseo"],["Petro Racine","717 S. Sylvania Avenue","Sturtevant","WI","53177","262-884-7500","158 truck parking spaces. 6 service bays. 7 diesel lanes. On site: Blue Badger Bar and Grill; Dunkin'', Krispy Krunchy Chicken, O&H Danish Bakery, Taco Bell. Weigh scale on site (brand unconfirmed)",42.72512,-87.955725,158,["Food","Fuel","Laundry","Repair"],"petro-racine"],["TA Hudson","713 Hwy 12","Hudson","WI","54016-0630","715-386-5835","86 truck parking spaces. 8 showers. 2 service bays. 6 diesel lanes. On site: Miss J\u2019s Caf\u00e9. Weigh scale on site (brand unconfirmed)",44.9655,-92.6785,86,["Showers","Food","Fuel","Laundry","Repair"],"ta-hudson"],["TA Express New Lisbon","1700 E Bridge Street","New Lisbon","WI","53950","608-350-9882","50 truck parking spaces. 4 showers. 6 diesel lanes. On site: Miss J\u2019s Caf\u00e9",43.88579,-90.14664,50,["Showers","Food","Fuel","Laundry"],"ta-express-new-lisbon"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 7 then raise exception 'WI: expected 7 inserted, got % - rolling back this state', n; end if;
raise notice 'WI: inserted % of 7', n;
end $g$;
commit;
