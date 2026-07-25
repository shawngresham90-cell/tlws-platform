-- =====================================================================
-- TA/Petro authorized import — RUN ALL PENDING STATES + FULL 304-ROW AUDIT
-- =====================================================================
-- Source workbook : data/imports/locmaster20260725.xlsx
--                   sha256 5ebe0e9f034153536fe3946a3e5cc3d5a45c9a59b010131d5ccee20e21553303
-- Source label    : official-ta-petro-20260725-5ebe0e9f
-- Applied already : 137 of 304 (19 states, verified)
-- This runner     : the remaining 167 rows across 24 states, in order
--
-- GUARANTEES (identical to the already-applied states)
--   * one transaction per state; ON_ERROR_STOP halts the run at the first
--     failing state, so that state rolls back and nothing after it runs
--   * INSERT-ONLY: no UPDATE / UPSERT / DELETE / MERGE anywhere
--   * live dual-key duplicate re-check evaluated ATOMICALLY inside each
--     transaction (canonical name|city|state key, and the live unique key
--     type|state|city|slug) -> a row that became a duplicate is SKIPPED
--   * GET DIAGNOSTICS row_count compared with that state's expected payload
--     count; any mismatch RAISES and rolls the whole state back
--   * every row unpublished (is_published/is_featured/is_indexable = false)
--   * geo is NEVER written; detail_slug is left to the set_detail_slug trigger
--   * operator coordinates inserted exactly as supplied
--   * 'CAT Scale' never asserted (workbook states only a generic Weigh Scale)
--
-- EXCLUDED and absent from this file: Love's, Sapp Bros, Pilot-network,
-- Goasis/Thorntons, the 37 held/manual-review rows, the original 1,252 rows.
--
-- RUN:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f data/imports/ta-petro/sql/RUN-ALL-PENDING.sql
-- =====================================================================

\set ON_ERROR_STOP on
\timing off
\echo '== PREFLIGHT =='

-- Sane-state gate. Accepts 137 (the verified checkpoint) through 304 so that a
-- resumed run after a halted state is still permitted; every statement below is
-- idempotent, so re-running an already-applied state inserts nothing.
do $pf$
declare c int; p int;
begin
  select count(*) into c from public.locations
    where source = 'official-ta-petro-20260725-5ebe0e9f';
  select count(*) into p from public.locations
    where source <> 'official-ta-petro-20260725-5ebe0e9f';
  raise notice 'batch rows before run: % (expected 137 at the verified checkpoint)', c;
  raise notice 'pre-existing rows: % (expected 1252)', p;
  if c < 137 or c > 304 then
    raise exception 'preflight: batch count % is outside 137..304 - refusing to run', c;
  end if;
  if p <> 1252 then
    raise exception 'preflight: pre-existing row count % <> 1252 - refusing to run', p;
  end if;
end $pf$;

\echo '== MS (4 rows) =='
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Meridian","2150 Russell Mt. Gilead Road","Meridian","MS","39301","601-483-7611","90 truck parking spaces. 6 showers. 5 service bays. 8 diesel lanes. On site: Country Pride. Weigh scale on site (brand unconfirmed)",32.3962,-88.5826,90,["Showers","Food","Fuel","Laundry","Repair"],"ta-meridian"],["Petro Jackson","970 W Frontage Road","Jackson","MS","39201","601-292-0950","194 truck parking spaces. 15 showers. 5 service bays. 10 diesel lanes. On site: Miss J''s. Weigh scale on site (brand unconfirmed)",32.2787,-90.1977,194,["Showers","Food","Fuel","Laundry","Repair"],"petro-jackson"],["TA McComb","1120 Airport Fernwood Road","McComb","MS","39648","601-996-0614","115 truck parking spaces. 7 showers. 2 service bays. 6 diesel lanes. On site: Denny''s; Subway. Weigh scale on site (brand unconfirmed)",31.18949,-90.48617,115,["Showers","Food","Fuel","Repair"],"ta-mccomb"],["TA Express Mooreville","590 MS 371","Mooreville","MS","38857","662-205-6298","40 truck parking spaces. 5 showers. 7 diesel lanes. On site: Chester Fried Chicken, Sbarro. Weigh scale on site (brand unconfirmed)",34.279082,-88.568724,40,["Showers","Food","Fuel","Laundry"],"ta-express-mooreville"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 4 then raise exception 'MS: expected 4 inserted, got % - rolling back this state', n; end if;
raise notice 'MS: inserted % of 4', n;
end $g$;
commit;

\echo '== MT (2 rows) =='
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Laurel","11360 South Frontage Road","Laurel","MT","59044","406-628-4324","80 truck parking spaces. 4 showers. 5 diesel lanes. On site: TA Cafe. Weigh scale on site (brand unconfirmed)",45.6823,-108.7038,80,["Showers","Food","Fuel","Laundry"],"ta-laurel"],["TA Missoula","8018 Hwy 93 N","Missoula","MT","59808","406-549-2327","130 truck parking spaces. 7 showers. 4 service bays. 6 diesel lanes. On site: Miss J\u2019s Caf\u00e9. Weigh scale on site (brand unconfirmed)",46.9485,-114.1298,130,["Showers","Food","Fuel","Laundry","Repair"],"ta-missoula"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 2 then raise exception 'MT: expected 2 inserted, got % - rolling back this state', n; end if;
raise notice 'MT: inserted % of 2', n;
end $g$;
commit;

\echo '== NC (3 rows) =='
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Greensboro","1101 NC Highway 61","Whitsett","NC","27377-0218","336-449-6060","173 truck parking spaces. 13 showers. 6 service bays. 12 diesel lanes. On site: Burger King, Popeyes. Weigh scale on site (brand unconfirmed)",36.0635,-79.5636,173,["Showers","Food","Fuel","Laundry","Repair"],"ta-greensboro"],["TA Mocksville","1670 US Hwy 601 N","Mocksville","NC","27028","336-751-3815","130 truck parking spaces. 7 showers. 3 service bays. 8 diesel lanes. On site: Popeyes. Weigh scale on site (brand unconfirmed)",35.925,-80.5917,130,["Showers","Food","Fuel","Laundry","Repair"],"ta-mocksville"],["Petro Mebane","500 Buckhorn Road","Mebane","NC","27302","919-304-7476","285 truck parking spaces. 19 showers. 5 service bays. 12 diesel lanes. On site: IHOP; Dunkin''. Weigh scale on site (brand unconfirmed)",36.0772,-79.2251,285,["Showers","Food","Fuel","Laundry","Repair"],"petro-mebane"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 3 then raise exception 'NC: expected 3 inserted, got % - rolling back this state', n; end if;
raise notice 'NC: inserted % of 3', n;
end $g$;
commit;

\echo '== ND (5 rows) =='
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Express Alexander","14256 US-85","Alexander","ND","58831","701-707-1770","55 truck parking spaces. 6 showers. 6 diesel lanes. On site: Champs Chicken. Weigh scale on site (brand unconfirmed)",47.8053,-103.6452,55,["Showers","Food","Fuel","Laundry"],"ta-express-alexander"],["TA Express Steele","620 Mitchell Avenue North","Steele","ND","58482","701-475-2274","70 truck parking spaces. 6 showers. 1 service bays. 7 diesel lanes. On site: Caribou Coffee, Cinnabon, Pizza Hut Express, Subway",46.8618,-99.9157,70,["Showers","Food","Fuel","Laundry","Repair"],"ta-express-steele"],["Petro Fargo","4510 19th Ave S.W.","Fargo","ND","58103","701-282-8105","209 truck parking spaces. 10 showers. 4 service bays. 16 diesel lanes. On site: Dolly Down; Charleys Philly Steaks, Cinnabon, Papa John''s Pizza, Popeyes",46.8503,-96.8632,209,["Showers","Food","Fuel","Laundry","Repair"],"petro-fargo"],["TA Express Grand Forks","1212 North 47th Street","Grand Forks","ND","58203","701-317-3785","65 truck parking spaces. 8 showers. 8 diesel lanes. On site: Miss J\u2019s Caf\u00e9. Weigh scale on site (brand unconfirmed)",47.9322,-97.09564,65,["Showers","Food","Fuel","Laundry"],"ta-express-grand-forks"],["TA Express Williston","13553 64th Street","Williston","ND","58801","701-641-1393","40 truck parking spaces. 5 showers. 8 diesel lanes. On site: Cinnabon, Miss J\u2019s Caf\u00e9, Subway. Weigh scale on site (brand unconfirmed)",48.34334,-103.61586,40,["Showers","Food","Fuel","Laundry"],"ta-express-williston"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 5 then raise exception 'ND: expected 5 inserted, got % - rolling back this state', n; end if;
raise notice 'ND: inserted % of 5', n;
end $g$;
commit;

\echo '== NE (3 rows) =='
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Ogallala","103 Prospector Drive","Ogallala","NE","69153-3198","308-284-3667","94 truck parking spaces. 9 showers. 2 service bays. 8 diesel lanes. On site: Country Pride. Weigh scale on site (brand unconfirmed)",41.1138,-101.7116,94,["Showers","Food","Fuel","Laundry","Repair"],"ta-ogallala"],["TA Grand Island","8033 West Holling Rd.","Alda","NE","68810-0167","308-382-5902","82 truck parking spaces. 7 showers. 2 service bays. 6 diesel lanes. On site: Country Pride. Weigh scale on site (brand unconfirmed)",40.7998,-98.496,82,["Showers","Food","Fuel","Laundry","Repair"],"ta-grand-island"],["Petro York","4700 S. Lincoln Ave.","York","NE","68467","402-362-1776","250 truck parking spaces. 16 showers. 5 service bays. 10 diesel lanes. On site: Iron Skillet; Pizza Hut Express. Truck wash: Blue Beacon Truck Wash. Weigh scale on site (brand unconfirmed)",40.8182,-97.5989,250,["Showers","Food","Fuel","Laundry","Repair"],"petro-york"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 3 then raise exception 'NE: expected 3 inserted, got % - rolling back this state', n; end if;
raise notice 'NE: inserted % of 3', n;
end $g$;
commit;

\echo '== NJ (4 rows) =='
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Columbia","2 Simpson Road","Columbia","NJ","07832-0305","908-496-4124","172 truck parking spaces. 7 showers. 5 service bays. 8 diesel lanes. On site: Country Pride; Pizza Hut Express, Taco Bell Express. Weigh scale on site (brand unconfirmed)",40.9317,-75.0969,172,["Showers","Food","Fuel","Laundry","Repair"],"ta-columbia"],["TA Bloomsbury","975 State Route 173","Bloomsbury","NJ","08804","908-479-4136","122 truck parking spaces. 7 showers. 4 service bays. 9 diesel lanes. On site: Country Pride; Burger King. Weigh scale on site (brand unconfirmed)",40.6594,-75.075,122,["Showers","Food","Fuel","Laundry","Repair"],"ta-bloomsbury"],["Petro Bordentown","402 Rising Sun Square Road","Bordentown","NJ","08505","609-298-6070","490 truck parking spaces. 20 showers. 6 service bays. 12 diesel lanes. On site: Iron Skillet; Arby''s. Truck wash: Blue Beacon Truck Wash. Weigh scale on site (brand unconfirmed)",40.1234,-74.7131,490,["Showers","Food","Fuel","Laundry","Repair"],"petro-bordentown"],["TA Paulsboro","171 Berkley Road","Paulsboro","NJ","08066","856-423-5500","175 truck parking spaces. 8 showers. 3 service bays. 12 diesel lanes. On site: Miss J\u2019s Caf\u00e9. Weigh scale on site (brand unconfirmed)",39.819,-75.2385,175,["Showers","Food","Fuel","Laundry","Repair"],"ta-paulsboro"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 4 then raise exception 'NJ: expected 4 inserted, got % - rolling back this state', n; end if;
raise notice 'NJ: inserted % of 4', n;
end $g$;
commit;

\echo '== NM (9 rows) =='
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Gallup","3404 W Historical Highway 66","Gallup","NM","87301-6841","505-863-6801","76 truck parking spaces. 9 showers. 6 service bays. 8 diesel lanes. On site: Country Pride. Weigh scale on site (brand unconfirmed)",35.5059,-108.8359,76,["Showers","Food","Fuel","Laundry","Repair"],"ta-gallup"],["TA Las Cruces","202 N. Motel Blvd","Las Cruces","NM","88007","575-527-7400","201 truck parking spaces. 10 showers. 6 service bays. 8 diesel lanes. On site: Burger King, Pizza Hut Express, Taco Bell. Weigh scale on site (brand unconfirmed)",32.2977,-106.8115,201,["Showers","Food","Fuel","Laundry","Repair"],"ta-las-cruces"],["TA Santa Rosa","2634 Historic Route 66","Santa Rosa","NM","88435-0372","575-935-9939","116 truck parking spaces. 9 showers. 3 service bays. 11 diesel lanes. On site: Popeyes, Subway. Weigh scale on site (brand unconfirmed)",34.9443,-104.6407,116,["Showers","Food","Fuel","Laundry","Repair"],"ta-santa-rosa"],["TA Albuquerque","2501 University Blvd., NE","Albuquerque","NM","87107","505-884-1066","150 truck parking spaces. 10 showers. 3 service bays. 8 diesel lanes. On site: Country Pride. Weigh scale on site (brand unconfirmed)",35.1111,-106.6247,150,["Showers","Food","Fuel","Laundry","Repair"],"ta-albuquerque"],["TA Moriarty","1700 U.S. Route 66 West","Moriarty","NM","87035","505-832-4421","245 truck parking spaces. 10 showers. 4 service bays. 10 diesel lanes. On site: Country Pride; Burger King, Pizza Hut Express. Weigh scale on site (brand unconfirmed)",35.0095,-106.065,245,["Showers","Food","Fuel","Laundry","Repair"],"ta-moriarty"],["Petro Milan","1430 Motel Drive","Milan","NM","87021","505-285-6648","200 truck parking spaces. 13 showers. 3 service bays. 12 diesel lanes. On site: Iron Skillet. Weigh scale on site (brand unconfirmed)",35.181,-107.9038,200,["Showers","Food","Fuel","Laundry","Repair"],"petro-milan"],["Petro Deming","14150 STE C Hwy 418 SW","Deming","NM","88030","575-546-7070","150 truck parking spaces. 9 showers. 3 service bays. 10 diesel lanes. On site: Iron Skillet; Starbucks. Weigh scale on site (brand unconfirmed)",32.2386,-107.9927,150,["Showers","Food","Fuel","Laundry","Repair"],"petro-deming"],["TA Springer","18 Old French Rd.","Springer","NM","87747","575-483-5004","100 truck parking spaces. 12 showers. 2 service bays. 6 diesel lanes. On site: Russell''s Restaurant; Subway. Weigh scale on site (brand unconfirmed)",36.4499710346809,-104.592856021367,100,["Showers","Food","Fuel","Laundry","Repair"],"ta-springer"],["TA Glenrio","1583 Frontage Rd 4132","Glenrio","NM","88434","575-288-9968","175 truck parking spaces. 8 showers. 10 diesel lanes. On site: Russell''s Route 66 Caf\u00e9; Subway. Weigh scale on site (brand unconfirmed)",35.1752464706606,-103.104072865847,175,["Showers","Food","Fuel","Laundry"],"ta-glenrio"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 9 then raise exception 'NM: expected 9 inserted, got % - rolling back this state', n; end if;
raise notice 'NM: inserted % of 9', n;
end $g$;
commit;

\echo '== NV (10 rows) =='
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Las Vegas","8050 Dean Martin Drive","Las Vegas","NV","89139","702-361-1176","144 truck parking spaces. 13 showers. 3 service bays. 10 diesel lanes. On site: Burger King, Taco Time. Weigh scale on site (brand unconfirmed)",36.0433,-115.1873,144,["Showers","Food","Fuel","Laundry","Repair"],"ta-las-vegas"],["TA Sparks","200 North McCarren","Sparks","NV","89431-5419","775-359-0550","200 truck parking spaces. 10 showers. 3 service bays. 8 diesel lanes. On site: Fuddruckers. Weigh scale on site (brand unconfirmed)",39.5351,-119.7361,200,["Showers","Food","Fuel","Laundry","Repair"],"ta-sparks"],["TA Mill City","6000 E. Frontage Road","Mill City","NV","89418","775-538-7311","152 truck parking spaces. 10 showers. 2 service bays. 10 diesel lanes. On site: Taco Bell Express. Weigh scale on site (brand unconfirmed)",40.6932,-118.056,152,["Showers","Food","Fuel","Laundry","Repair"],"ta-mill-city"],["Petro North Las Vegas","6595 North Hollywood Blvd","North Las Vegas","NV","89115","702-632-2640","207 truck parking spaces. 16 showers. 5 service bays. 12 diesel lanes. On site: Iron Skillet; Dunkin''. Weigh scale on site (brand unconfirmed)",36.2797,-115.0261,207,["Showers","Food","Fuel","Laundry","Repair"],"petro-north-las-vegas"],["Petro Sparks","1950 East Greg St.","Sparks","NV","89431","775-355-8888","400 truck parking spaces. 14 showers. 5 service bays. 10 diesel lanes. On site: Iron Skillet. Weigh scale on site (brand unconfirmed)",39.5233,-119.7087,400,["Showers","Food","Fuel","Laundry","Repair"],"petro-sparks"],["Petro Wells","1440 6th Street","Wells","NV","89835","775-455-4305","250 truck parking spaces. 5 showers. 3 service bays. 6 diesel lanes. On site: Iron Skillet; Dunkin''. Weigh scale on site (brand unconfirmed)",41.101,-114.9561,250,["Showers","Food","Fuel","Laundry","Repair"],"petro-wells"],["TA Express Wendover","800 Leppy Hills Blvd","West Wendover","NV","89883","775-546-1649","153 truck parking spaces. 9 showers. 8 diesel lanes. On site: Black Bear Diner; Bojangles, Del Taco, Sbarro",40.7421,-114.05883,153,["Showers","Food","Fuel","Laundry"],"ta-express-wendover"],["Petro Henderson","1700 Railroad Pass Casino Road","Henderson","NV","89002","725-305-0745","100 truck parking spaces. 5 showers. 8 diesel lanes. On site: Dunkin'', Sonic. Truck wash: Truck Wash",35.9670745402109,-114.915674406748,100,["Showers","Food","Fuel","Laundry"],"petro-henderson"],["TA Express Henderson","1550 Railroad Pass Casino Road","Henderson","NV","89002","725-277-0932","200 truck parking spaces. 5 showers. 7 diesel lanes. On site: Starbucks. Weigh scale on site (brand unconfirmed)",35.9714738262293,-114.910506528296,200,["Showers","Food","Fuel"],"ta-express-henderson"],["TA Express Carlin","932 Fir Street","Carlin","NV","89822","702-421-3701","50 truck parking spaces. 4 showers. 5 diesel lanes. On site: Bojangles",40.72071,-116.10756,50,["Showers","Food","Fuel","Laundry"],"ta-express-carlin"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 10 then raise exception 'NV: expected 10 inserted, got % - rolling back this state', n; end if;
raise notice 'NV: inserted % of 10', n;
end $g$;
commit;

\echo '== NY (7 rows) =='
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

\echo '== OH (14 rows) =='
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Dayton","6762 US Rte 127","Eaton","OH","45320-0030","937-456-5522","198 truck parking spaces. 9 showers. 6 service bays. 8 diesel lanes. On site: Burger King. Weigh scale on site (brand unconfirmed)",39.84,-84.6282,198,["Showers","Food","Fuel","Laundry","Repair"],"ta-dayton"],["TA Lodi","8834 Lake Road","Seville","OH","44273-0125","330-769-2053","237 truck parking spaces. 10 showers. 6 service bays. 9 diesel lanes. On site: IHOP; Burger King, Popeyes, Starbucks. Weigh scale on site (brand unconfirmed)",41.0322,-81.9078,237,["Showers","Food","Fuel","Laundry","Repair"],"ta-lodi"],["TA London","940 US RT 42 NE","London","OH","43140-0560","740-852-3810","138 truck parking spaces. 10 showers. 6 service bays. 8 diesel lanes. On site: Popeyes. Weigh scale on site (brand unconfirmed)",39.9538,-83.3796,138,["Showers","Food","Fuel","Laundry","Repair"],"ta-london"],["TA Kingsville","5551 St Rt 193","Kingsville","OH","44048","440-224-2035","158 truck parking spaces. 9 showers. 2 service bays. 10 diesel lanes. On site: Burger King. Weigh scale on site (brand unconfirmed)",41.8765,-80.6671,158,["Showers","Food","Fuel","Laundry","Repair"],"ta-kingsville"],["TA Hebron","10679 Lancaster Road, SE","Hebron","OH","43025-0520","740-467-2900","130 truck parking spaces. 10 showers. 6 service bays. 8 diesel lanes. On site: Popeyes, Sbarro. Weigh scale on site (brand unconfirmed)",39.9389,-82.5349,130,["Showers","Food","Fuel","Laundry","Repair"],"ta-hebron"],["TA Youngstown","5400 Seventy Six Drive","Youngstown","OH","44515","330-793-4426","145 truck parking spaces. 9 showers. 5 service bays. 10 diesel lanes. Weigh scale on site (brand unconfirmed)",41.1225,-80.7653,145,["Showers","Fuel","Laundry","Repair"],"ta-youngstown"],["TA Toledo","3483 Libbey Road","Perrysburg","OH","43551-9750","567-970-3800","177 truck parking spaces. 12 showers. 4 service bays. 10 diesel lanes. On site: Taco Bell. Weigh scale on site (brand unconfirmed)",41.5215,-83.4624,177,["Showers","Food","Fuel","Laundry","Repair"],"ta-toledo"],["TA North Canton","4450 Portage St. NW","Canton","OH","44720","330-494-7507","85 truck parking spaces. 4 showers. 6 diesel lanes. Weigh scale on site (brand unconfirmed)",40.8788,-81.4295,85,["Showers","Fuel","Laundry","Repair"],"ta-north-canton"],["TA Jeffersonville","12403 US Rt 35 NW","Jeffersonville","OH","43128-0068","740-948-2365","144 truck parking spaces. 7 showers. 5 service bays. 10 diesel lanes. On site: IHOP; Pizza Hut Express, Popeyes. Weigh scale on site (brand unconfirmed)",39.6166,-83.6038,144,["Showers","Food","Fuel","Laundry","Repair"],"ta-jeffersonville"],["Petro Perrysburg","26416 Baker Rd.","Perrysburg","OH","43551","419-443-1800","375 truck parking spaces. 14 showers. 4 service bays. 12 diesel lanes. On site: Fork and Compass. Truck wash: Blue Beacon Truck Wash. Weigh scale on site (brand unconfirmed)",41.5355,-83.4664,375,["Showers","Food","Fuel","Laundry","Repair"],"petro-perrysburg"],["Petro Girard","1 Petro Place","Girard","OH","44420","330-505-3700","323 truck parking spaces. 14 showers. 5 service bays. 14 diesel lanes. On site: Iron Skillet. Weigh scale on site (brand unconfirmed)",41.1408,-80.7172,323,["Showers","Food","Fuel","Laundry","Repair"],"petro-girard"],["Petro New Paris","9787 US Route 40 West","New Paris","OH","45347","937-637-7800","197 truck parking spaces. 13 showers. 4 service bays. 12 diesel lanes. On site: Iron Skillet. Truck wash: Blue Beacon Truck Wash. Weigh scale on site (brand unconfirmed)",39.8346,-84.8111,197,["Showers","Food","Fuel","Laundry","Repair"],"petro-new-paris"],["Petro Napoleon","900 American Road","Napoleon","OH","43545","567-694-9977","107 truck parking spaces. 7 showers. 3 service bays. 8 diesel lanes. On site: Miss J''s Diner; Miss J\u2019s Caf\u00e9. Weigh scale on site (brand unconfirmed)",41.4178,-84.1045,107,["Showers","Food","Fuel","Laundry","Repair"],"petro-napoleon"],["TA Jackson","80 Dixon Run Road","Jackson","OH","45640","740-988-7793","110 truck parking spaces. 4 showers. 3 service bays. 6 diesel lanes. On site: Miss J''s Diner; Miss J''s Pizzeria. Weigh scale on site (brand unconfirmed)",38.99646,-82.55335,110,["Showers","Food","Fuel","Laundry","Repair"],"ta-jackson"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 14 then raise exception 'OH: expected 14 inserted, got % - rolling back this state', n; end if;
raise notice 'OH: inserted % of 14', n;
end $g$;
commit;

\echo '== OK (7 rows) =='
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Oklahoma City East","801 South Council Road","Oklahoma City","OK","73128-4218","405-787-7411","175 truck parking spaces. 12 showers. 6 service bays. 10 diesel lanes. On site: IHOP. Weigh scale on site (brand unconfirmed)",35.458,-97.6556,175,["Showers","Food","Fuel","Laundry","Repair"],"ta-oklahoma-city-east"],["TA Oklahoma City West","501 South Morgan Road","Oklahoma City","OK","73128","405-324-5376","101 truck parking spaces. 8 showers. 3 service bays. 8 diesel lanes. On site: Fazoli''s, Popeyes. Weigh scale on site (brand unconfirmed)",35.4617,-97.6906,101,["Showers","Food","Fuel","Laundry","Repair"],"ta-oklahoma-city-west"],["TA Sayre","11603 N. 1900 Rd.","Sayre","OK","73662","580-928-5571","101 truck parking spaces. 7 showers. 2 service bays. 10 diesel lanes. On site: Subway, Taco Bell. Weigh scale on site (brand unconfirmed)",35.3355,-99.5946,101,["Showers","Food","Fuel","Repair"],"ta-sayre"],["Petro Oklahoma City","20 Martin Luther King Blvd","Oklahoma City","OK","73117","405-228-7040","280 truck parking spaces. 14 showers. 5 service bays. 12 diesel lanes. On site: Iron Skillet. Weigh scale on site (brand unconfirmed)",35.4662,-97.4755,280,["Showers","Food","Fuel","Laundry","Repair"],"petro-oklahoma-city"],["TA Express Tonkawa","16700 W South Ave","Tonkawa","OK","74653","580-670-1199","32 truck parking spaces. 5 showers. 5 diesel lanes. On site: Dunkin'', Miss J''s. Weigh scale on site (brand unconfirmed)",36.69598,-97.35146,32,["Showers","Food","Fuel","Laundry"],"ta-express-tonkawa"],["TA Express South Coffeyville","111 E. County Road 2","South Coffeyville","OK","74072","918-842-4000","40 truck parking spaces. 4 showers. 5 diesel lanes. On site: Golden Chick, The Stuffed Burrito Company",36.98543,-95.62498,40,["Showers","Food","Fuel","Laundry"],"ta-express-south-coffeyville"],["TA Express Savanna","9062 US Hwy 69","Savanna","OK","74565","405-446-4501","60 truck parking spaces. 3 showers. 5 diesel lanes. On site: Dunkin'', Miss J''s, Sbarro",34.833383,-95.83959,60,["Showers","Food","Fuel","Laundry"],"ta-express-savanna"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 7 then raise exception 'OK: expected 7 inserted, got % - rolling back this state', n; end if;
raise notice 'OK: inserted % of 7', n;
end $g$;
commit;

\echo '== OR (6 rows) =='
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

\echo '== PA (14 rows) =='
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Brookville","245 Allegheny Blvd.","Brookville","PA","15825-8211","814-849-3051","221 truck parking spaces. 8 showers. 6 service bays. 8 diesel lanes. On site: Taco Bell. Weigh scale on site (brand unconfirmed)",41.1729,-79.0992,221,["Showers","Food","Fuel","Laundry","Repair"],"ta-brookville"],["TA Harrisburg","7848 Linglestown Road","Harrisburg","PA","17112-0535","717-652-4556","178 truck parking spaces. 13 showers. 6 service bays. 9 diesel lanes. On site: Country Pride. Weigh scale on site (brand unconfirmed)",40.355,-76.7241,178,["Showers","Food","Fuel","Laundry","Repair"],"ta-harrisburg"],["TA Barkeyville","5644 St. Rt. 8","Harrisville","PA","16038-9641","814-786-7988","112 truck parking spaces. 8 showers. 3 service bays. 8 diesel lanes. On site: Country Pride. Weigh scale on site (brand unconfirmed)",41.1992,-79.9758,112,["Showers","Food","Fuel","Laundry","Repair"],"ta-barkeyville"],["TA Lamar","5600 Nittany Valley Drive","Lamar","PA","16848-0278","570-726-4996","168 truck parking spaces. 11 showers. 3 service bays. 9 diesel lanes. On site: Country Pride. Weigh scale on site (brand unconfirmed)",41.0275,-77.521,168,["Showers","Food","Fuel","Laundry","Repair"],"ta-lamar"],["TA Bloomsburg","6 Buckhorn Road","Bloomsburg","PA","17815","570-784-9400","190 truck parking spaces. 13 showers. 4 service bays. 11 diesel lanes. On site: Country Pride; Subway. Weigh scale on site (brand unconfirmed)",41.0143,-76.4928,190,["Showers","Food","Fuel","Laundry","Repair"],"ta-bloomsburg"],["TA Greencastle","10835 John Wayne Drive","Greencastle","PA","17225","717-597-7762","190 truck parking spaces. 14 showers. 4 service bays. 12 diesel lanes. On site: Country Pride. Weigh scale on site (brand unconfirmed)",39.7846,-77.7126,190,["Showers","Food","Fuel","Laundry","Repair"],"ta-greencastle"],["TA Milesburg","875 N. Eagle Valley Rd.","Milesburg","PA","16853","814-355-7561","122 truck parking spaces. 4 showers. 8 diesel lanes. On site: Country Pride; Subway. Weigh scale on site (brand unconfirmed)",40.9589,-77.763,122,["Showers","Food","Fuel","Laundry","Repair"],"ta-milesburg"],["TA Harborcreek","4050 Depot Road","Erie","PA","16510","814-899-1919","266 truck parking spaces. 11 showers. 6 service bays. 10 diesel lanes. On site: IHOP; Pizza Hut Express, Subway. Truck wash: Blue Beacon Truck Wash. Weigh scale on site (brand unconfirmed)",42.1409,-79.9246,266,["Showers","Food","Fuel","Laundry","Repair"],"ta-harborcreek"],["Petro Carlisle","1201 Harrisburg Ave, Route 11","Carlisle","PA","17013","717-249-1919","380 truck parking spaces. 20 showers. 6 service bays. 12 diesel lanes. On site: Iron Skillet. Weigh scale on site (brand unconfirmed)",40.2319,-77.1418,380,["Showers","Food","Fuel","Laundry","Repair"],"petro-carlisle"],["Petro Scranton","98 Grove St.","DuPont","PA","18641","570-654-5111","428 truck parking spaces. 22 showers. 6 service bays. 10 diesel lanes. On site: Iron Skillet/Metro Deli; Metro Deli. Weigh scale on site (brand unconfirmed)",41.3302,-75.7417,428,["Showers","Food","Fuel","Laundry","Repair"],"petro-scranton"],["TA Express Ronks","2622 Lincoln Hwy East","Ronks","PA","17527","717-687-6112","41 truck parking spaces. 3 showers. 5 diesel lanes. On site: Chester Fried Chicken, Subway. Weigh scale on site (brand unconfirmed)",40.0197,-76.1818,41,["Showers","Food","Fuel","Laundry"],"ta-express-ronks"],["TA Breezewood","16563 Lincoln Hwy","Breezewood","PA","15533","814-707-9284","200 truck parking spaces. 13 showers. 5 service bays. 9 diesel lanes. On site: Arby''s, Baskin Robbins, Dunkin'', Gateway Homestyle Express, Papi''s Pizza, Wings And Subs. Weigh scale on site (brand unconfirmed)",40.00035503,-78.23407728,200,["Showers","Food","Fuel","Laundry","Repair"],"ta-breezewood"],["TA Express Hazleton","492 Can Do Expressway","Hazleton","PA","18202","570-599-5063","50 truck parking spaces. 3 showers. 5 diesel lanes. On site: Miss J\u2019s Caf\u00e9. Weigh scale on site (brand unconfirmed)",40.93879,-76.03577,50,["Showers","Food","Fuel","Laundry"],"ta-express-hazleton"],["TA Express Pine Grove","482 Suedberg Road","Pine Grove","PA","17963","717-454-6803","80 truck parking spaces. 3 showers. 6 diesel lanes. On site: Cinnabon, Miss J\u2019s Caf\u00e9. Truck wash: Truck Wash. Weigh scale on site (brand unconfirmed)",40.53385,-76.43174,80,["Showers","Food","Fuel","Laundry"],"ta-express-pine-grove"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 14 then raise exception 'PA: expected 14 inserted, got % - rolling back this state', n; end if;
raise notice 'PA: inserted % of 14', n;
end $g$;
commit;

\echo '== RI (1 rows) =='
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA West Greenwich","849 Victory Hwy West","West Greenwich","RI","02817","401-397-7774","180 truck parking spaces. 6 showers. 3 service bays. 6 diesel lanes. On site: Popeyes. Weigh scale on site (brand unconfirmed)",41.6081,-71.6638,180,["Showers","Food","Fuel","Laundry","Repair"],"ta-west-greenwich"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 1 then raise exception 'RI: expected 1 inserted, got % - rolling back this state', n; end if;
raise notice 'RI: inserted % of 1', n;
end $g$;
commit;

\echo '== SC (5 rows) =='
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Spartanburg","1402 East Main St.","Duncan","SC","29334-9647","864-433-0711","187 truck parking spaces. 11 showers. 8 service bays. 8 diesel lanes. On site: Country Pride. Weigh scale on site (brand unconfirmed)",34.914,-82.11,187,["Showers","Food","Fuel","Laundry","Repair"],"ta-spartanburg"],["Petro Columbia","2154 S. Beltline Blvd.","Columbia","SC","29201","803-908-4889","134 truck parking spaces. 10 showers. 6 service bays. 8 diesel lanes. On site: Quaker Steak & Lube; Starbucks. Weigh scale on site (brand unconfirmed)",33.9533,-80.9896,134,["Showers","Food","Fuel","Laundry","Repair"],"petro-columbia"],["TA Express Fair Play","272 Herring Rd","Fair Play","SC","29643","864-280-7320","52 truck parking spaces. 7 showers. 3 service bays. 5 diesel lanes. On site: Cheryl\u2019s Potato Boat; KFC. Weigh scale on site (brand unconfirmed)",34.50464,-82.96549,52,["Showers","Food","Fuel","Laundry","Repair"],"ta-express-fair-play"],["TA Cowpens","175 Truck Stop Rd","Cowpens","SC","29330","864-755-4335","80 truck parking spaces. 8 showers. 2 service bays. 6 diesel lanes. On site: Sbarro. Weigh scale on site (brand unconfirmed)",35.046879,-81.812281,80,["Showers","Food","Fuel","Laundry","Repair"],"ta-cowpens"],["TA Columbia North","99 Plumbers Road","Columbia","SC","29203","839-228-0693","78 truck parking spaces. 9 showers. 2 service bays. 4 diesel lanes. On site: Dunkin'', Miss J\u2019s Caf\u00e9, Taco Bell. Weigh scale on site (brand unconfirmed)",34.0747,-80.9971,78,["Showers","Food","Fuel","Laundry","Repair"],"ta-columbia-north"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 5 then raise exception 'SC: expected 5 inserted, got % - rolling back this state', n; end if;
raise notice 'SC: inserted % of 5', n;
end $g$;
commit;

\echo '== SD (3 rows) =='
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

\echo '== TN (2 rows) =='
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Antioch","13011 Old Hickory Blvd.","Antioch","TN","37013","615-641-6731","122 truck parking spaces. 10 showers. 5 service bays. 7 diesel lanes. On site: Burger King, Popeyes. Weigh scale on site (brand unconfirmed)",36.015,-86.6184,122,["Showers","Food","Fuel","Laundry","Repair"],"ta-antioch"],["TA Davy Crockett Travel Center","195 Van Hill Road","Greeneville","TN","37745","423-234-4451","245 truck parking spaces. 10 showers. 6 service bays. 8 diesel lanes. On site: IHOP; Dunkin'', Papa John''s Pizza. Weigh scale on site (brand unconfirmed)",36.3254,-82.8354,245,["Showers","Food","Fuel","Laundry","Repair"],"ta-davy-crockett-travel-center"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 2 then raise exception 'TN: expected 2 inserted, got % - rolling back this state', n; end if;
raise notice 'TN: inserted % of 2', n;
end $g$;
commit;

\echo '== TX (40 rows) =='
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Baytown","6800 Thompson Road","Baytown","TX","77521","281-424-7772","173 truck parking spaces. 10 showers. 6 service bays. 12 diesel lanes. On site: IHOP. Weigh scale on site (brand unconfirmed)",29.7967,-95.0311,173,["Showers","Food","Fuel","Laundry","Repair"],"ta-baytown"],["TA Rockwall","2105 South Goliad St.","Rockwall","TX","75032","972-722-7450","100 truck parking spaces. 7 showers. 3 service bays. 6 diesel lanes. On site: Burger King, Pizza Hut Express. Weigh scale on site (brand unconfirmed)",32.9074,-96.45,100,["Showers","Food","Fuel","Laundry","Repair"],"ta-rockwall"],["TA Amarillo","7000 E. Interstate 40","Amarillo","TX","79118","806-342-3080","185 truck parking spaces. 10 showers. 6 service bays. 8 diesel lanes. On site: Black Bear Diner; Burger King, Pizza Hut Express, Popeyes. Weigh scale on site (brand unconfirmed)",35.1915,-101.7589,185,["Showers","Food","Fuel","Laundry","Repair"],"ta-amarillo"],["TA San Antonio","6170 I-10 East","San Antonio","TX","78219","210-310-0145","238 truck parking spaces. 10 showers. 7 service bays. 8 diesel lanes. On site: Burger King, Fazoli''s, Popeyes. Weigh scale on site (brand unconfirmed)",29.4433,-98.3618,238,["Showers","Food","Fuel","Laundry","Repair"],"ta-san-antonio"],["TA Dallas South","7751 Bonnie View Rd","Dallas","TX","75241","469-941-3150","136 truck parking spaces. 9 showers. 5 service bays. 8 diesel lanes. On site: Burger King, Taco Bell & Pizza Hut Express. Weigh scale on site (brand unconfirmed)",32.6534,-96.7517,136,["Showers","Food","Fuel","Laundry","Repair"],"ta-dallas-south"],["TA Laredo","1010 Beltway Parkway","Laredo","TX","78045","956-724-2016","336 truck parking spaces. 15 showers. 5 service bays. 8 diesel lanes. On site: IHOP; Burger King, Taco Bell. Weigh scale on site (brand unconfirmed)",27.6875,-99.4634,336,["Showers","Food","Fuel","Laundry","Repair"],"ta-laredo"],["TA Big Spring","704 West Interstate 20","Big Spring","TX","79720","432-264-4444","108 truck parking spaces. 9 showers. 5 service bays. 6 diesel lanes. On site: IHOP; Popeyes, Subway. Weigh scale on site (brand unconfirmed)",32.2648,-101.49,108,["Showers","Food","Fuel","Laundry","Repair"],"ta-big-spring"],["TA Ganado","802 E. York, Hwy 59","Ganado","TX","77962","361-541-5575","104 truck parking spaces. 9 showers. 5 service bays. 8 diesel lanes. On site: Burger King, Subway. Weigh scale on site (brand unconfirmed)",29.0496,-96.5034,104,["Showers","Food","Fuel","Laundry","Repair"],"ta-ganado"],["TA New Braunfels","4817 I-35 North","New Braunfels","TX","78130","830-608-9395","220 truck parking spaces. 13 showers. 6 service bays. 10 diesel lanes. On site: Black Bear Diner; Popeyes, Subway. Weigh scale on site (brand unconfirmed)",29.7489,-98.0579,220,["Showers","Food","Fuel","Laundry","Repair"],"ta-new-braunfels"],["TA Terrell","1700 Wilson Road","Terrell","TX","75161","972-563-6939","300 truck parking spaces. 12 showers. 5 service bays. 12 diesel lanes. On site: Pizza Hut Express, Subway. Weigh scale on site (brand unconfirmed)",32.6908,-96.2441,300,["Showers","Food","Fuel","Laundry","Repair"],"ta-terrell"],["TA Edinburg","8301 N.Hwy. 281","Edinburg","TX","78541-7060","956-383-0788","105 truck parking spaces. 5 showers. 2 service bays. 5 diesel lanes. On site: Tule Tree Legendary Burritos. Weigh scale on site (brand unconfirmed)",26.3845,-98.1435,105,["Showers","Food","Fuel","Laundry","Repair"],"ta-edinburg"],["TA Denton","6420 North I-35","Denton","TX","76207","940-383-1458","138 truck parking spaces. 7 showers. 6 service bays. 8 diesel lanes. On site: Burger King, Pizza Hut. Weigh scale on site (brand unconfirmed)",33.2622,-97.1767,138,["Showers","Food","Fuel","Laundry","Repair"],"ta-denton"],["TA Bernardo","6701 US Hwy 90","Sealy","TX","77474","979-732-2986","43 truck parking spaces. 5 showers. 8 diesel lanes. On site: Carl''s Jr., Dunkin''. Weigh scale on site (brand unconfirmed)",29.7427,-96.3301,43,["Showers","Food","Fuel","Laundry"],"ta-bernardo"],["TA Express Baytown South","5490 N Hwy 146","Baytown","TX","77523","409-277-3841","29 truck parking spaces. 3 showers. 4 diesel lanes. On site: Miss J''s, Schlotzsky\u2019s. Weigh scale on site (brand unconfirmed)",29.77736,-94.91346,29,["Showers","Food","Fuel","Laundry"],"ta-express-baytown-south"],["TA Express Kilgore","4403 TX - 42","Kilgore","TX","75662","430-253-2656","63 truck parking spaces. 7 showers. 6 diesel lanes. On site: Baskin Robbins, Dunkin'', Miss J\u2019s Caf\u00e9, Wendy''s",32.428842,-94.864307,63,["Showers","Food","Fuel","Laundry"],"ta-express-kilgore"],["TA Express Almeda","12602 South Freeway","Almeda","TX","77047","713-788-8639","50 truck parking spaces. 3 showers. 4 diesel lanes. On site: Miss J\u2019s Caf\u00e9, Subway. Weigh scale on site (brand unconfirmed)",29.6141,-95.38816,50,["Showers","Food","Fuel"],"ta-express-almeda"],["TA Express Mount Vernon","300 SE Access Rd","Mount Vernon","TX","75457","903-537-9200","110 truck parking spaces. 6 showers. 4 service bays. 9 diesel lanes. On site: Taco Casa; Cotton Belt Bbq, Duke''s Bakery, Pickadilly Circus Pizza, The Original Fried Pie Shop",33.14914,-95.20939,110,["Showers","Food","Fuel","Laundry","Repair"],"ta-express-mount-vernon"],["TA Express Nacogdoches","2615 NW Stallings Drive","Nacogdoches","TX","75964","936-234-7998","95 truck parking spaces. 5 showers. 5 diesel lanes. On site: Denny''s; Miss J\u2019s Caf\u00e9",31.65211,-94.67876,95,["Showers","Food","Fuel","Laundry"],"ta-express-nacogdoches"],["TA Express Fairfield","1015 West Commerce St","Fairfield","TX","75840","903-915-8296","102 truck parking spaces. 9 showers. 8 diesel lanes. On site: Miss J''s, The Original Fried Pie Shop, Whataburger. Weigh scale on site (brand unconfirmed)",31.72559,-96.17767,102,["Showers","Food","Fuel","Laundry"],"ta-express-fairfield"],["TA Express Carthage","1086 US 59 South","Carthage","TX","75633","903-690-0272","76 truck parking spaces. 4 showers. 5 diesel lanes. On site: Denny''s",32.12982,-94.3326,76,["Showers","Food","Fuel","Laundry"],"ta-express-carthage"],["Petro El Paso","1295 Horizon Blvd.","El Paso","TX","79927","915-790-4529","290 truck parking spaces. 15 showers. 6 service bays. 12 diesel lanes. On site: Black Bear Diner. Truck wash: Blue Beacon Truck Wash. Weigh scale on site (brand unconfirmed)",31.6609,-106.2424,290,["Showers","Food","Fuel","Laundry","Repair"],"petro-el-paso"],["Petro Weatherford","2001 Santa Fe Dr","Weatherford","TX","76086","817-599-9411","275 truck parking spaces. 16 showers. 5 service bays. 12 diesel lanes. On site: Iron Skillet; Popeyes. Weigh scale on site (brand unconfirmed)",32.7389,-97.7654,275,["Showers","Food","Fuel","Laundry","Repair"],"petro-weatherford"],["Petro Beaumont","5405 Walden Rd","Beaumont","TX","77705","409-842-9600","275 truck parking spaces. 13 showers. 6 service bays. 12 diesel lanes. On site: Black Bear Diner. Truck wash: Blue Beacon Truck Wash. Weigh scale on site (brand unconfirmed)",30.037,-94.1561,275,["Showers","Food","Fuel","Laundry","Repair"],"petro-beaumont"],["Petro San Antonio","1112 Ackerman Road","San Antonio","TX","78219","210-661-9416","250 truck parking spaces. 13 showers. 7 service bays. 12 diesel lanes. On site: Black Bear Diner. Truck wash: Blue Beacon Truck Wash. Weigh scale on site (brand unconfirmed)",29.4376,-98.3799,250,["Showers","Food","Fuel","Laundry","Repair"],"petro-san-antonio"],["Petro Amarillo","8500 E I-40 @ Lakeside Drive","Amarillo","TX","79118","806-372-4899","280 truck parking spaces. 22 showers. 5 service bays. 12 diesel lanes. On site: Iron Skillet. Weigh scale on site (brand unconfirmed)",35.1917,-101.7437,280,["Showers","Food","Fuel","Laundry","Repair"],"petro-amarillo"],["TA Hillsboro","160 State Hwy 77","Hillsboro","TX","76645","254-283-6556","201 truck parking spaces. 10 showers. 5 service bays. 8 diesel lanes. On site: IHOP; Burger King. Weigh scale on site (brand unconfirmed)",32.0455,-97.092,201,["Showers","Food","Fuel","Laundry","Repair"],"ta-hillsboro"],["TA Express Vinton","601 Westway Blvd.","Canutillo","TX","79835","915-886-5761","65 truck parking spaces. 6 showers. 5 service bays. 7 diesel lanes. On site: Subway. Weigh scale on site (brand unconfirmed)",31.9581,-106.58,65,["Showers","Food","Fuel","Laundry","Repair"],"ta-express-vinton"],["TA Sweetwater","100 South Hopkins Rd","Sweetwater","TX","79556","325-235-8488","110 truck parking spaces. 6 showers. 8 service bays. 8 diesel lanes. On site: Family Restaurant; Pizza Hut Express, Popeyes. Weigh scale on site (brand unconfirmed)",32.44859,-100.44327,110,["Showers","Food","Fuel","Laundry","Repair"],"ta-sweetwater"],["TA Express Huntsville","500 I-45","Huntsville","TX","77320","936-295-2488","50 truck parking spaces. 3 showers. 6 diesel lanes. On site: Primo Taqueria; Chester Fried Chicken, Cinnabon, Sbarro. Truck wash: Truck Wash",30.7391369,-95.591114,50,["Showers","Food","Fuel"],"ta-express-huntsville"],["TA Express Pleasanton","109963 Interstate 37","Pleasanton","TX","78064","726-224-0813","75 truck parking spaces. 5 showers. 5 diesel lanes. On site: Big Madre. Weigh scale on site (brand unconfirmed)",28.995209,-98.433321,75,["Showers","Food","Fuel","Laundry"],"ta-express-pleasanton"],["TA Express Belton","8101 South Interstate Hwy 35 Service Rd.","Belton","TX","76513","737-333-5305","64 truck parking spaces. 7 showers. 6 diesel lanes. On site: Champs Chicken, Pizza Hut Express, Ranch Eats",30.98543,-97.503002,64,["Showers","Food","Fuel","Laundry"],"ta-express-belton"],["TA Express Decatur","3400 S US Highway 287","Decatur","TX","76234","940-245-8146","77 truck parking spaces. 7 showers. 8 diesel lanes. On site: Golden Chick, Miss J''s Smokehouse. Weigh scale on site (brand unconfirmed)",33.2026580851408,-97.5684288797929,77,["Showers","Food","Fuel","Laundry"],"ta-express-decatur"],["TA Express North Houston","1104 N Sam Houston Pkwy E","Houston","TX","77032","346-740-1066","80 truck parking spaces. 5 showers. 7 diesel lanes. On site: Denny''s; Cinnabon, Miss J''s, Schlotzsky\u2019s",29.93796,-95.37247,80,["Showers","Food","Fuel","Laundry"],"ta-express-north-houston"],["TA Express Junction","115 S Segovia Access Rd","Junction","TX","76849","325-338-0993","70 truck parking spaces. 4 showers. 5 diesel lanes. On site: Miss J\u2019s Caf\u00e9, Sonic",30.41758,-99.67229,70,["Showers","Food","Fuel"],"ta-express-junction"],["TA Express Kingsville","2104 E. Corral Ave","Kingsville","TX","78363","361-424-1518","40 truck parking spaces. 3 showers. 7 diesel lanes. On site: Charleys Philly Steaks, Miss J\u2019s Caf\u00e9. Weigh scale on site (brand unconfirmed)",27.53175,-97.84155,40,["Showers","Food","Fuel","Laundry"],"ta-express-kingsville"],["Petro North Hillsboro","101 Cornelius Road","Hillsboro","TX","76645","254-714-3000","91 truck parking spaces. 7 showers. 4 service bays. 11 diesel lanes. On site: Miss J''s. Weigh scale on site (brand unconfirmed)",32.0794,-97.0552,91,["Showers","Food","Fuel","Laundry","Repair"],"petro-north-hillsboro"],["Petro Pearsall","110 S. I-35 Frontage Rd.","Pearsall","TX","78061","830-334-8222","175 truck parking spaces. 10 showers. 5 service bays. 8 diesel lanes. On site: Miss J''s Burger, Miss J\u2019s Caf\u00e9. Weigh scale on site (brand unconfirmed)",28.8996,-99.1158,175,["Showers","Food","Fuel","Repair"],"petro-pearsall"],["TA Vernon, TX","2817 US Hwy 287 W","Vernon","TX","76384","940-553-7121","76 truck parking spaces. 7 showers. 7 diesel lanes. On site: Popeyes, Ranchero BBQ, Starbucks. Weigh scale on site (brand unconfirmed)",34.15992,-99.29664,76,["Showers","Food","Fuel","Laundry"],"ta-vernon-tx"],["TA Express Houston","4808 N McCarty Street","Houston","TX","77013","832-993-7704","70 truck parking spaces. 6 showers. 8 diesel lanes. On site: Miss J\u2019s Caf\u00e9",29.80378,-95.26491,70,["Showers","Food","Fuel","Laundry"],"ta-express-houston"],["TA Shepherd","10100 US Highway 59","Shepherd","TX","77371","936-933-9574","120 truck parking spaces. 5 showers. 4 service bays. 8 diesel lanes. On site: IHOP; Miss J\u2019s Caf\u00e9",30.44618,-95.03022,120,["Showers","Food","Fuel","Laundry","Repair"],"ta-shepherd"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 40 then raise exception 'TX: expected 40 inserted, got % - rolling back this state', n; end if;
raise notice 'TX: inserted % of 40', n;
end $g$;
commit;

\echo '== UT (3 rows) =='
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Tooele","8836 North Highway 40","Salt Lake City","UT","84074","801-250-8585","191 truck parking spaces. 11 showers. 3 service bays. 7 diesel lanes. On site: Burger King, Taco Bell. Weigh scale on site (brand unconfirmed)",40.6899,-112.2629,191,["Showers","Food","Fuel","Laundry","Repair"],"ta-tooele"],["TA Express Parowan","1130 N. 100 W.","Parowan","UT","84761","435-477-3311","90 truck parking spaces. 6 showers. 6 service bays. 5 diesel lanes. On site: Subway, Taco Bell. Weigh scale on site (brand unconfirmed)",37.8607,-112.8291,90,["Showers","Food","Fuel","Laundry","Repair"],"ta-express-parowan"],["TA Fillmore","885 S Park Ave","Fillmore","UT","84631","435-222-4431","40 truck parking spaces. 3 showers. 6 diesel lanes. On site: Miss J''s",38.95037,-112.35277,40,["Showers","Food","Fuel","Laundry"],"ta-fillmore"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 3 then raise exception 'UT: expected 3 inserted, got % - rolling back this state', n; end if;
raise notice 'UT: inserted % of 3', n;
end $g$;
commit;

\echo '== VA (5 rows) =='
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Wytheville","1025 Peppers Ferry Road","Wytheville","VA","24382","276-228-8676","114 truck parking spaces. 12 showers. 6 service bays. 10 diesel lanes. On site: IHOP; Popeyes, Subway, Taco Bell. Weigh scale on site (brand unconfirmed)",36.9651,-81.0676,114,["Showers","Food","Fuel","Laundry","Repair"],"ta-wytheville"],["Petro Glade Spring","12433 Maple St.","Glade Spring","VA","24340","276-429-6000","280 truck parking spaces. 8 showers. 5 service bays. 9 diesel lanes. On site: Arby''s, Sbarro, Starbucks. Weigh scale on site (brand unconfirmed)",36.7708,-81.7793,280,["Showers","Food","Fuel","Repair"],"petro-glade-spring"],["Petro Raphine","2440 Raphine Road","Raphine","VA","24472","540-377-2111","725 truck parking spaces. 19 showers. 8 service bays. 16 diesel lanes. On site: Quaker Steak & Lube; Burger King, Nathan''s Famous Express, Papa John''s Pizza, Popeyes, Subway. Weigh scale on site (brand unconfirmed)",37.929,-79.2292,725,["Showers","Food","Fuel","Laundry","Repair"],"petro-raphine"],["TA Lexington","2516 N. Lee Highway","Lexington","VA","24450","540-463-3478","250 truck parking spaces. 8 showers. 7 service bays. 8 diesel lanes. On site: IHOP. Weigh scale on site (brand unconfirmed)",37.8318,-79.3779,250,["Showers","Food","Fuel","Laundry","Repair"],"ta-lexington"],["TA Express Warfield","12461 Old Stage Rd.","Warfield","VA","23889","804-478-4403","80 truck parking spaces. 5 showers. 6 diesel lanes. On site: Little Caesar''s, Subway. Weigh scale on site (brand unconfirmed)",36.9405939298108,-77.7352231306991,80,["Showers","Food","Fuel"],"ta-express-warfield"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 5 then raise exception 'VA: expected 5 inserted, got % - rolling back this state', n; end if;
raise notice 'VA: inserted % of 5', n;
end $g$;
commit;

\echo '== WA (4 rows) =='
begin;
do $g$ declare n int; begin
with s as (select jsonb_array_elements('[["TA Seattle East","46630 North Bend Way","North Bend","WA","98045","425-888-1119","140 truck parking spaces. 8 showers. 3 service bays. 6 diesel lanes. On site: Popeyes, Starbucks. Weigh scale on site (brand unconfirmed)",47.4683,-121.7181,140,["Showers","Food","Fuel","Laundry","Repair"],"ta-seattle-east"],["Petro Spokane","10506 West Aero Road","Spokane","WA","99224","509-842-1100","200 truck parking spaces. 11 showers. 5 service bays. 10 diesel lanes. On site: Iron Skillet; Starbucks. Weigh scale on site (brand unconfirmed)",47.5906,-117.5612,200,["Showers","Food","Fuel","Laundry","Repair"],"petro-spokane"],["TA Express Blaine","1300 Boblett St","Blaine","WA","98230","360-312-7779","34 truck parking spaces. 4 showers. 5 diesel lanes. On site: Cinnabon, Jamba Juice, Pizza Hut Express. Weigh scale on site (brand unconfirmed)",48.99126,-122.73412,34,["Showers","Food","Fuel","Laundry"],"ta-express-blaine"],["TA Grandview","100 Higgins Way","Grandview","WA","98930","509-405-0911","100 truck parking spaces. 6 showers. 3 service bays. 5 diesel lanes. On site: Applebee''s/IHOP; Miss J''s Indian Cuisine, Miss J''s Tacos, Miss J\u2019s Caf\u00e9",46.27591,-119.92876,100,["Showers","Food","Fuel","Laundry","Repair"],"ta-grandview"]]'::jsonb) e),
i as (select e->>0 name,e->>1 address,e->>2 city,e->>3 state,e->>4 zip,e->>5 phone,e->>6 description,(e->>7)::double precision lat,(e->>8)::double precision lng,(e->>9)::int parking_spaces,e->10 amenities,e->>11 slug from s),
f as (select i.* from i
  where not exists (select 1 from public.locations l where l.deleted_at is null
      and trim(regexp_replace(lower(l.name),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.name),'[^a-z0-9]+',' ','g')) and trim(regexp_replace(lower(l.city),'[^a-z0-9]+',' ','g'))=trim(regexp_replace(lower(i.city),'[^a-z0-9]+',' ','g')) and upper(l.state)=upper(i.state))
    and not exists (select 1 from public.locations l2 where l2.deleted_at is null
      and l2.type='truck_stop' and upper(l2.state)=upper(i.state) and l2.city=i.city and l2.slug=i.slug))
insert into public.locations (name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,category_slug,type,source,is_published,is_featured,is_indexable,free_parking,paid_parking,reserved_parking,overnight_parking)
select name,address,city,state,zip,phone,description,lat,lng,parking_spaces,amenities,slug,'truck-stops','truck_stop','official-ta-petro-20260725-5ebe0e9f',false,false,false,false,false,false,false from f on conflict do nothing;
get diagnostics n = row_count;
if n <> 4 then raise exception 'WA: expected 4 inserted, got % - rolling back this state', n; end if;
raise notice 'WA: inserted % of 4', n;
end $g$;
commit;

\echo '== WI (7 rows) =='
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

\echo '== WV (4 rows) =='
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

\echo '== WY (5 rows) =='
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

-- =====================================================================
-- POST-INSERT AUDIT — all 304 rows. Read-only; proves every final number.
-- =====================================================================
\echo '== AUDIT 1: headline totals (expect 304 / 304 / 0 / 0 / 304 / 0) =='
select
  count(*)                                                        as batch_total,
  count(*) filter (where not is_published)                        as unpublished,
  count(*) filter (where lat is null or lng is null)              as missing_coordinates,
  count(*) filter (where geo is not null)                         as geo_writes,
  count(*) filter (where source = 'official-ta-petro-20260725-5ebe0e9f') as source_label_count,
  count(*) filter (where amenities::text like '%CAT Scale%')      as cat_scale_asserted,
  count(*) filter (where is_featured or is_indexable)             as featured_or_indexable
from public.locations
where source = 'official-ta-petro-20260725-5ebe0e9f';

\echo '== AUDIT 2: live totals (expect 1556 live, 1252 pre-existing, 0 changed) =='
select
  (select count(*) from public.locations where deleted_at is null) as live_total,
  (select count(*) from public.locations
     where source <> 'official-ta-petro-20260725-5ebe0e9f')        as preexisting_rows,
  (select count(*) from public.locations
     where source <> 'official-ta-petro-20260725-5ebe0e9f'
       and updated_at > '2026-07-25 00:00:00+00')                  as preexisting_changed;

\echo '== AUDIT 3: per-state reconciliation vs payload (expect every row ok) =='
with expected(st, n) as (values ('AL',8), ('AR',3), ('AZ',10), ('CA',14), ('CO',9), ('CT',3), ('FL',5), ('GA',8), ('IA',6), ('ID',2), ('IL',12), ('IN',10), ('KS',10), ('KY',3), ('LA',12), ('MI',4), ('MN',4), ('MO',13), ('MS',4), ('MT',2), ('NC',3), ('ND',5), ('NE',3), ('NH',1), ('NJ',4), ('NM',9), ('NV',10), ('NY',7), ('OH',14), ('OK',7), ('OR',6), ('PA',14), ('RI',1), ('SC',5), ('SD',3), ('TN',2), ('TX',40), ('UT',3), ('VA',5), ('WA',4), ('WI',7), ('WV',4), ('WY',5)),
actual as (
  select upper(state) st, count(*) n from public.locations
  where source = 'official-ta-petro-20260725-5ebe0e9f' group by 1
)
select e.st, e.n as expected, coalesce(a.n,0) as inserted,
       e.n - coalesce(a.n,0) as missing,
       case when coalesce(a.n,0) = e.n then 'ok' else 'MISMATCH' end as verdict
from expected e left join actual a on a.st = e.st
order by e.st;

\echo '== AUDIT 4: totals across all 43 states (expect 304 = 304, 0 mismatched) =='
with expected(st, n) as (values ('AL',8), ('AR',3), ('AZ',10), ('CA',14), ('CO',9), ('CT',3), ('FL',5), ('GA',8), ('IA',6), ('ID',2), ('IL',12), ('IN',10), ('KS',10), ('KY',3), ('LA',12), ('MI',4), ('MN',4), ('MO',13), ('MS',4), ('MT',2), ('NC',3), ('ND',5), ('NE',3), ('NH',1), ('NJ',4), ('NM',9), ('NV',10), ('NY',7), ('OH',14), ('OK',7), ('OR',6), ('PA',14), ('RI',1), ('SC',5), ('SD',3), ('TN',2), ('TX',40), ('UT',3), ('VA',5), ('WA',4), ('WI',7), ('WV',4), ('WY',5)),
actual as (
  select upper(state) st, count(*) n from public.locations
  where source = 'official-ta-petro-20260725-5ebe0e9f' group by 1
)
select sum(e.n) as expected_total, sum(coalesce(a.n,0)) as inserted_total,
       count(*) filter (where coalesce(a.n,0) <> e.n) as mismatched_states
from expected e left join actual a on a.st = e.st;

\echo '== AUDIT 5: duplicate-key reconciliation (expect 0 and 0) =='
-- (a) canonical dup key must be unique across the WHOLE live table
select count(*) as duplicate_canonical_keys from (
  select trim(regexp_replace(lower(name),'[^a-z0-9]+',' ','g')) nk,
         trim(regexp_replace(lower(city),'[^a-z0-9]+',' ','g')) ck,
         upper(state) sk, count(*) c
  from public.locations where deleted_at is null
  group by 1,2,3 having count(*) > 1) d;
-- (b) live unique key type|state|city|slug must be unique
select count(*) as duplicate_unique_keys from (
  select type, upper(state) st, city, slug, count(*) c
  from public.locations where deleted_at is null
  group by 1,2,3,4 having count(*) > 1) d;

\echo '== AUDIT 6: malformed-value check on batch rows (expect all zero) =='
select
  count(*) filter (where name is null or btrim(name) = '')          as blank_name,
  count(*) filter (where city is null or btrim(city) = '')          as blank_city,
  count(*) filter (where address is null or btrim(address) = '')    as blank_address,
  count(*) filter (where state !~ '^[A-Z]{2}$')                     as bad_state,
  count(*) filter (where zip is not null and zip !~ '^\d{5}(-\d{4})?$') as bad_zip,
  count(*) filter (where lat < -90 or lat > 90 or lng < -180 or lng > 180) as out_of_range_coords,
  count(*) filter (where type <> 'truck_stop' or category_slug <> 'truck-stops') as wrong_type,
  count(*) filter (where slug is null or btrim(slug) = '')          as blank_slug,
  count(*) filter (where detail_slug is null or btrim(detail_slug) = '') as blank_detail_slug
from public.locations
where source = 'official-ta-petro-20260725-5ebe0e9f';

\echo '== AUDIT 7: held / excluded networks untouched (expect 0 in batch) =='
select count(*) as excluded_or_held_in_batch
from public.locations
where source = 'official-ta-petro-20260725-5ebe0e9f'
  and (name ilike '%love%' or name ilike '%sapp%' or name ilike '%pilot%'
       or name ilike '%goasis%' or name ilike '%thornton%');

\echo '== AUDIT 8: rollback-selection check (expect exactly 304, all batch rows) =='
select count(*) as rollback_would_select
from public.locations
where source = 'official-ta-petro-20260725-5ebe0e9f';
-- To revert the entire batch (do NOT run unless reverting):
--   begin; delete from public.locations
--     where source = 'official-ta-petro-20260725-5ebe0e9f'; commit;

\echo '== AUDIT COMPLETE =='
