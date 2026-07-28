-- Pilot / Flying J / ONE9 import — rollback. NOT EXECUTED. GENERATED.
--
-- Three independent reversals, in reverse order of application:
-- unpublish, then de-enrich (per-row, value-matched), then delete inserts.
-- A row edited since the forward write stops matching and is left alone.

-- ===========================================================================
-- 1. UNPUBLISH — reverses PUBLISH-CANARY.sql / PUBLISH-PER-STATE.sql
-- ===========================================================================
begin;
do $$
declare n integer; expected integer;
begin
  select count(*) into expected from public.locations
   where source = 'pilot-master-2026-07-27' and is_published and deleted_at is null;
  if expected = 0 then raise exception 'Nothing published by this import; nothing to unpublish.'; end if;

  update public.locations set is_published = false, updated_at = now()
   where source = 'pilot-master-2026-07-27' and is_published and deleted_at is null;
  get diagnostics n = row_count;
  if n <> expected then raise exception 'Expected to unpublish %, changed %.', expected, n; end if;

  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and (is_featured or lat is null);
  if n <> 0 then raise exception 'Post-check failed: % row(s) lost a coordinate or became featured.', n; end if;
end $$;
commit;

-- ===========================================================================
-- 2. DE-ENRICH — reverses ENRICH-EXISTING.sql, per-row and value-matched.
--    Blank-only forward writes mean NULL is the exact pre-state of every
--    cleared field (existing_parking_spaces in the plan records the rows
--    that already had a count and were therefore never restaged).
-- ===========================================================================
begin;

-- #89 · ONE9 Travel Center (Pilot #89) - Ellenton (FL) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '5cf98762-e51b-4116-8a71-1934fcc47f35' and lat = 27.528565346887518 and lng = -82.51230464049281
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #226 · ONE9 Travel Center #226 (TN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '5fc5e9a4-17f9-40c7-9c65-d3904e90140f' and lat = 36.03750642605513 and lng = -83.44555030270627
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #457 · Pilot Travel Center #457 (OH) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '7e79bd38-6884-4e0c-a05e-0303faa8514e' and lat = 40.8339660627421 and lng = -83.9644058889723
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #53 · Pilot Travel Center #53 (TN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '7e949312-8bda-4eb3-b270-bed57d56fdc0' and lat = 35.88214835938339 and lng = -87.80100000398463
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #62 · Pilot Travel Center #62 (SC) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'a77f9fde-3b52-4f86-961d-91e168d388d5' and lat = 34.26660455384255 and lng = -79.70179281338103
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = 'a77f9fde-3b52-4f86-961d-91e168d388d5' and parking_spaces = 75 and deleted_at is null;

-- #403 · ONE9 Travel Center #403 (TN) · fills: parking_spaces
update public.locations set parking_spaces = null, updated_at = now()
 where id = 'f9e3ec91-4b3f-4c36-a174-96eafb9e907e' and parking_spaces = 25 and deleted_at is null;

-- #441 · Pilot Travel Center #441 (AL) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '28ed1b57-596a-42e2-bcb7-55434d32fe02' and lat = 34.538005252844954 and lng = -86.91097605562913
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #653 · Flying J Travel Center #653 (Hebron) (IN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '9172f64e-0836-45fd-a136-3e9c914b7097' and lat = 41.28823088555331 and lng = -87.29464827116392
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #4584 · Pilot Travel Center #4584 (SC) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '989e6437-46b1-45ce-a5b2-7f7d4d0cb18a' and lat = 34.344825 and lng = -79.534595
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = '989e6437-46b1-45ce-a5b2-7f7d4d0cb18a' and parking_spaces = 112 and deleted_at is null;

-- #90 · Pilot Travel Center #90 (FL) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'e5c73805-b895-443e-ad46-5b33992106d6' and lat = 27.4138524510288 and lng = -80.40013848915262
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = 'e5c73805-b895-443e-ad46-5b33992106d6' and parking_spaces = 100 and deleted_at is null;

-- #231 · Pilot Travel Center #231 (KY) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'b7a1bf29-998f-498a-a44a-0974411802b6' and lat = 36.97511182002901 and lng = -84.10778245470296
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #254 · ONE9 Travel Center (former Pilot Travel Center #254) (GA) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '2e036deb-3b94-41b3-9fcb-fd5b71923e44' and lat = 34.97848385096656 and lng = -85.4139074441803
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #284 · Pilot Travel Center #284 - Monroe (MI) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '5527d376-b806-4a10-bc75-0478c35672d0' and lat = 41.96358907420919 and lng = -83.35375333735163
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #332 · Pilot Travel Center #332 (AR) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '930d8058-2612-4312-99fe-c80cc9d03e11' and lat = 34.781197952345856 and lng = -92.12783413251053
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #437 · Pilot Travel Center #437 (KY) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '92a67cb7-3086-461e-a710-7ab4be8446cf' and lat = 36.72208144037753 and lng = -84.16803532055776
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #114 · Pilot Travel Center #114 (TN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '4f77aa49-f11e-4ebd-a86e-9c6290ec1ec1' and lat = 35.9857961 and lng = -85.0116688
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #91 · Pilot Travel Center #91 (FL) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '1f226de3-a16d-434e-9db3-2cb86dbf9e31' and lat = 30.065564 and lng = -81.493909
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = '1f226de3-a16d-434e-9db3-2cb86dbf9e31' and parking_spaces = 17 and deleted_at is null;

-- #219 · Pilot Travel Center #219 (TN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'b3c074e4-06a3-4cb4-b205-6ad5ddae3476' and lat = 35.9992434 and lng = -83.7775841
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #409 · Pilot Travel Center #409 (TN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'c4fa7a01-7327-4a45-9a23-1d24e9bd4a3e' and lat = 36.02270726288148 and lng = -87.34116938028716
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #4651 · Pilot Travel Center #4651 (VA) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '8cb6aa2b-13c3-4f79-8b1b-ee434bb8cee8' and lat = 36.6069402079367 and lng = -77.56095702090148
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = '8cb6aa2b-13c3-4f79-8b1b-ee434bb8cee8' and parking_spaces = 85 and deleted_at is null;

-- #353 · Pilot Travel Center #353 (KY) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'a8a32662-d389-4d96-9653-6fde235726d0' and lat = 38.27605548759607 and lng = -84.55335544912026
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #1063 · Pilot Travel Center #1063 (NC) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '49310225-476e-403f-bc11-b296444ee454' and lat = 35.64256181522499 and lng = -82.04021014643918
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #4597 · Pilot Travel Center #4597 (TN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '4c7eff4b-4b93-4969-8d19-5fb1d388779b' and lat = 36.17723841617246 and lng = -85.9486013542818
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #71 · Pilot Travel Center #71 (GA) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'da315672-4e7f-4389-a555-4e4b7aa1d94a' and lat = 32.188725774101115 and lng = -81.19496020325909
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = 'da315672-4e7f-4389-a555-4e4b7aa1d94a' and parking_spaces = 112 and deleted_at is null;

-- #602 · Pilot Travel Center #602 (AL) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'c251431a-ff37-4d55-9b22-1fd126b525aa' and lat = 33.56259486492335 and lng = -86.83074711838533
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = 'c251431a-ff37-4d55-9b22-1fd126b525aa' and parking_spaces = 157 and deleted_at is null;

-- #95 · Pilot Travel Center #95 (Wildwood, 493 SR 44) (FL) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '76f653aa-907b-4800-865a-1dd03003185a' and lat = 28.873918542991504 and lng = -82.09515797982287
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = '76f653aa-907b-4800-865a-1dd03003185a' and parking_spaces = 10 and deleted_at is null;

-- #604 · Flying J Travel Center #604 (AL) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'f77f6c23-384f-4f64-af4d-2b73d30dbfbb' and lat = 32.194202910088684 and lng = -86.41967308332825
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #34 · Pilot Travel Center #34 (IN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '4b07b610-8186-4ad2-b037-cb9c402928a9' and lat = 40.7663019 and lng = -87.1234491
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #265 · ONE9 Travel Center (Pilot #265) (TN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'e780ec0a-3a95-42b8-b7bd-eca1cadf2a72' and lat = 36.133737186379726 and lng = -85.50421763558195
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #366 · Pilot Travel Center #366 (TN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '6e1f345b-b3fd-42bb-848c-acfb5573ebc8' and lat = 35.682945179393094 and lng = -88.77758901995591
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #493 · Flying J Travel Center #493 (SC) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '455f776b-7681-45be-8604-fdb9593beb44' and lat = 33.193987365125956 and lng = -80.60230509010448
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = '455f776b-7681-45be-8604-fdb9593beb44' and parking_spaces = 118 and deleted_at is null;

-- #624 · Flying J Travel Plaza #624 (Dade City / San Antonio) (FL) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '1beb847b-eca9-4b86-a151-558340292504' and lat = 28.326050432621614 and lng = -82.32248806404851
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #664 · Flying J Travel Center #664 (KY) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '54eb73aa-b523-42b7-bb42-be43bfe1e235' and lat = 38.8576816680839 and lng = -84.625863390213
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #713 · Flying J / ONE9 Travel Center #713 (SC) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'a109cc92-378c-4d57-ac39-da50a5c2a2c6' and lat = 34.338987832171995 and lng = -79.53411028419238
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = 'a109cc92-378c-4d57-ac39-da50a5c2a2c6' and parking_spaces = 200 and deleted_at is null;

-- #75 · Pilot Travel Center #75 (AL) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '48942c6d-d58b-46ad-8a29-906278fceb35' and lat = 30.8727989 and lng = -88.0469468
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = '48942c6d-d58b-46ad-8a29-906278fceb35' and parking_spaces = 77 and deleted_at is null;

-- #384 · Pilot Travel Center #384 (VA) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'ac64dd0e-2288-4bb0-85b8-2f1913dfd9f6' and lat = 37.3108667 and lng = -77.3915178
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = 'ac64dd0e-2288-4bb0-85b8-2f1913dfd9f6' and parking_spaces = 110 and deleted_at is null;

-- #429 · Pilot Travel Center #429 (AR) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '7d43f079-09a4-4f73-a484-93682b5e28aa' and lat = 35.157735969602406 and lng = -90.13770261293222
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #656 · Flying J Travel Center #656 (IN) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '1dac7271-b06e-47a7-9845-3ea235276d79' and lat = 39.5496802 and lng = -86.0368062
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = '1dac7271-b06e-47a7-9845-3ea235276d79' and parking_spaces = 173 and deleted_at is null;

-- #37 · Pilot Travel Center #37 (IN) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '7edab277-0c0b-4498-a04d-3389926b0fe4' and lat = 39.55117863378675 and lng = -86.04598800859831
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = '7edab277-0c0b-4498-a04d-3389926b0fe4' and parking_spaces = 110 and deleted_at is null;

-- #24 · Pilot Travel Center #24 - Monroe (MI) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '321b8c5c-5c9f-48e1-aa9c-fd0332dee69e' and lat = 41.9247909 and lng = -83.3661458
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #337 · Pilot Travel Center #337 (SC) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '4f23643b-4ec9-471a-beac-7a7538e73adf' and lat = 34.23256102007648 and lng = -79.80240283883901
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = '4f23643b-4ec9-471a-beac-7a7538e73adf' and parking_spaces = 90 and deleted_at is null;

-- #1047 · Pilot Travel Center #1047 (FL) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'b8bff6ef-fb37-4415-9966-9e0ef40bbb4d' and lat = 30.371257849974512 and lng = -81.7642421064314
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = 'b8bff6ef-fb37-4415-9966-9e0ef40bbb4d' and parking_spaces = 65 and deleted_at is null;

-- #6990 · Pilot Travel Center #6990 (NC) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '062c24f7-7145-41f3-97f7-431b2d8965b3' and lat = 35.58299557135885 and lng = -78.14789037301635
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = '062c24f7-7145-41f3-97f7-431b2d8965b3' and parking_spaces = 125 and deleted_at is null;

-- #430 · Pilot Travel Center #430 (AR) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'd7265e8b-ae0a-4d0b-84f1-de75c9f7a70d' and lat = 35.28063189312379 and lng = -93.09278987752802
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #88 · Pilot / ONE9 Travel Center #88 (FL) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'ca4da6a3-c18d-4f65-88ec-1076319eb6c5' and lat = 28.359164203862274 and lng = -80.79245792270183
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = 'ca4da6a3-c18d-4f65-88ec-1076319eb6c5' and parking_spaces = 8 and deleted_at is null;

-- #92 · Pilot Travel Center #92 (Ocala) (FL) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '894798c3-0460-4016-b5a1-ca4505143ee5' and lat = 29.267799374341905 and lng = -82.19160579877662
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #278 · Mr. Fuel Travel Center (One9 Fuel Network) (KY) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '34ba01ad-945f-4960-b099-01964f28815d' and lat = 38.91921224492679 and lng = -84.62533229563141
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #411 · Pilot Travel Center #411 (TN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '362f1bd5-2789-488a-8652-ffa580d9737a' and lat = 36.1791753 and lng = -86.2994386
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #622 · Flying J Travel Center #622 (FL) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '9d5b4987-bd0e-4332-ae57-b774ca5ee801' and lat = 27.448956010822528 and lng = -80.3977813214264
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = '9d5b4987-bd0e-4332-ae57-b774ca5ee801' and parking_spaces = 156 and deleted_at is null;

-- #875 · Flying J Travel Center #875 (MD) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '39a7ad06-c801-4b4f-8ea1-3d847839a62c' and lat = 39.63836410068015 and lng = -75.80598211474991
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = '39a7ad06-c801-4b4f-8ea1-3d847839a62c' and parking_spaces = 230 and deleted_at is null;

-- #293 · Pilot Travel Center #293 (Ocala, SR 484) (FL) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '7d145a52-2a8c-420b-87c8-5c8668bca4d9' and lat = 29.02513864695603 and lng = -82.15903012349477
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #895 · Flying J Travel Center #895 - Woodhaven (MI) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '3e2d7707-cfa9-4fff-a6e1-b564b40bfc32' and lat = 42.13676883345559 and lng = -83.23951225141504
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = '3e2d7707-cfa9-4fff-a6e1-b564b40bfc32' and parking_spaces = 254 and deleted_at is null;

-- #47 · Pilot Travel Center #47 (KY) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'd4d6ed3b-3e72-4011-b0cc-29783bc21dd0' and lat = 38.27672724577639 and lng = -84.56014385515596
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #271 · Pilot Travel Center #271 (Burr Street) (IN) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'd806f887-5291-49e4-8e36-4e7ae97c3996' and lat = 41.57311335096673 and lng = -87.40281201852419
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = 'd806f887-5291-49e4-8e36-4e7ae97c3996' and parking_spaces = 215 and deleted_at is null;

-- #500 · Pilot Travel Center #500 (Jasper) (FL) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '6d8f6cd0-78e1-489f-9f94-7878cba55e77' and lat = 30.5163005 and lng = -83.0587583
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #627 · Flying J Travel Center #627 (GA) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'f0129700-18d1-49cf-b92f-0be14a549686' and lat = 31.14016746021323 and lng = -81.57832099692367
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = 'f0129700-18d1-49cf-b92f-0be14a549686' and parking_spaces = 150 and deleted_at is null;

-- #898 · Pilot Travel Center - Sadler's Emporia (VA) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '3f7408df-a39e-46cd-843a-61694fabbe9c' and lat = 36.7045199441136 and lng = -77.55285515344238
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = '3f7408df-a39e-46cd-843a-61694fabbe9c' and parking_spaces = 300 and deleted_at is null;

-- #4556 · Pilot Travel Center #4556 (Wildwood, 744 SR 44) (FL) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '58ed9375-a7ad-4139-95ec-8c928564778c' and lat = 28.873736500809937 and lng = -82.09055893068847
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = '58ed9375-a7ad-4139-95ec-8c928564778c' and parking_spaces = 75 and deleted_at is null;

-- #406 · Pilot Travel Center #406 (TN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '07d998a5-79fa-4b95-b63f-7bbeb29ca62e' and lat = 35.30525595924141 and lng = -86.88404011772155
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #424 · Pilot Travel Center #424 (Ocala, 4032 Hwy 326) (FL) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '9eaf0102-674a-4c29-a360-b2de6807e4f1' and lat = 29.26616378692671 and lng = -82.18890931994056
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #448 · Pilot Travel Center #448 (Hebron) (IN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'f7f69a6a-d032-46ee-9ce6-52796f556a07' and lat = 41.290344107421696 and lng = -87.2951070101934
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #9 · Pilot Travel Center #9 (OH) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'da698161-6d20-4069-9e12-64db6fb9cf21' and lat = 39.542654037902615 and lng = -84.29043254773055
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #360 · Pilot Travel Center #360 (OH) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'bf859b17-33b7-4fb7-995a-1d7cb462c529' and lat = 41.136826925351244 and lng = -83.66038718114063
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #393 · Pilot Travel Center #393 (NC) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '6c2078f9-7d25-48bf-8e8f-10d24ac2b372' and lat = 35.5727 and lng = -82.955867
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #652 · Flying J Travel Center #652 (IN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'a70da55a-2a2e-420a-953c-4b6d46e1c435' and lat = 40.0323480743644 and lng = -86.47280271031188
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #695 · Flying J Travel Center #695 (OH) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '0ecffefe-7964-4da6-9052-c230adc0a249' and lat = 40.832295840216204 and lng = -83.9673392043686
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #1550 · Pilot Travel Center #1550 (Good Hope) (AL) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'd7247403-1ed3-49de-83a5-af2862cdbd9f' and lat = 34.116865025472514 and lng = -86.86373995824155
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #1577 · Pilot Travel Center #1577 (TN) · fills: parking_spaces
update public.locations set parking_spaces = null, updated_at = now()
 where id = '5aecf10b-8e95-48a4-a815-da033b1d7cf4' and parking_spaces = 88 and deleted_at is null;

-- #97 · Flying J Travel Center #97 (OH) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'f68a555f-f314-4506-91bc-db780f009c31' and lat = 39.9024827 and lng = -84.1927628
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #94 · Pilot Travel Center #94 (FL) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '7500cfb3-d609-4280-9869-356cb5588398' and lat = 26.8941468 and lng = -82.0092852
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = '7500cfb3-d609-4280-9869-356cb5588398' and parking_spaces = 39 and deleted_at is null;

-- #575 · Pilot Travel Center #575 (GA) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '50cf9353-443d-406e-b1d2-9889112e116c' and lat = 30.760673125363606 and lng = -81.64907624610727
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = '50cf9353-443d-406e-b1d2-9889112e116c' and parking_spaces = 235 and deleted_at is null;

-- #605 · Flying J Travel Center #605 (AR) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '99e14e2c-5498-4df1-b60b-7ff743aec8ae' and lat = 35.28320640968396 and lng = -93.09000597552921
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #58 · Pilot Travel Center #58 (ONE9) (NC) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'b89a9bb7-6833-4f23-8466-1d6660615cd3' and lat = 36.523299 and lng = -77.587281
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = 'b89a9bb7-6833-4f23-8466-1d6660615cd3' and parking_spaces = 42 and deleted_at is null;

-- #321 · Pilot Travel Center #321 (KY) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '5c42f488-24de-40af-a67d-88e61d627d64' and lat = 38.91737631038006 and lng = -84.63245170304107
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #626 · Flying J Travel Center #626 (FL) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'c372a30e-8b6d-44db-b71f-1a3621ef7a7e' and lat = 29.74996120681377 and lng = -81.34444617182768
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = 'c372a30e-8b6d-44db-b71f-1a3621ef7a7e' and parking_spaces = 99 and deleted_at is null;

-- #668 · Flying J Travel Center #668 (Saginaw) (MI) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'effb0793-cbed-44f7-b05c-3645ccfdda21' and lat = 43.45188561064311 and lng = -83.89413353950054
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #784 · Flying J Travel Center #784 (MD) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'd56cff01-0dcb-4610-82aa-920d1214a828' and lat = 39.6254814074548 and lng = -75.95014760199173
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = 'd56cff01-0dcb-4610-82aa-920d1214a828' and parking_spaces = 185 and deleted_at is null;

-- #900 · Pilot Travel Center (Sadler Travel Plaza) (NC) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '438d7ce9-59d8-4fec-b8d5-24f36c3a5481' and lat = 35.31835659787999 and lng = -78.57574679036492
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = '438d7ce9-59d8-4fec-b8d5-24f36c3a5481' and parking_spaces = 265 and deleted_at is null;

-- #607 · Flying J Travel Center #607 (AR) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '394f5b7a-2970-453b-91d4-fc87c30a51a0' and lat = 35.15415439265023 and lng = -90.14396355128943
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- #683 · Flying J Travel Center #683 (NC) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'f97ef111-f094-422a-bc61-7362a0a27d26' and lat = 35.57450741129341 and lng = -78.14640144688613
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = 'f97ef111-f094-422a-bc61-7362a0a27d26' and parking_spaces = 145 and deleted_at is null;

-- #4562 · Pilot Travel Center #4562 (GA) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '0fda85a9-364c-4541-99d7-fac38c8f755e' and lat = 30.75989471461253 and lng = -81.65574789931874
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = '0fda85a9-364c-4541-99d7-fac38c8f755e' and parking_spaces = 111 and deleted_at is null;

-- #4569 · Pilot Travel Center #4569 (SC) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '9ac45310-ac8c-4885-a5aa-ebf787c2f13a' and lat = 32.26878204646999 and lng = -81.08101432460634
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = '9ac45310-ac8c-4885-a5aa-ebf787c2f13a' and parking_spaces = 90 and deleted_at is null;

-- #1330 · ONE9 Travel Center (Pilot Company) (AR) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '69f1f244-c4c0-480b-9e95-f1b02554cb6b' and lat = 34.912544273597874 and lng = -91.19621866623427
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = '69f1f244-c4c0-480b-9e95-f1b02554cb6b' and parking_spaces = 42 and deleted_at is null;

-- #1366 · ONE9 Travel Center #1366 (TN) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'cc5fe530-72f9-4f40-82de-bb55487a82cc' and lat = 35.843010167500815 and lng = -88.08471945506712
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations set parking_spaces = null, updated_at = now()
 where id = 'cc5fe530-72f9-4f40-82de-bb55487a82cc' and parking_spaces = 118 and deleted_at is null;
commit;

-- ===========================================================================
-- 3. DELETE INSERTED ROWS — reverses INSERT-NET-NEW.sql. The only delete in
--    the package; it can only reach rows this import created (source tag set
--    by the insert and nothing else) and refuses while any target is
--    published or featured.
-- ===========================================================================
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and is_published;
  if n <> 0 then
    raise exception 'Rollback refused: % inserted row(s) are published. Run the UNPUBLISH block first.', n;
  end if;
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and is_featured;
  if n <> 0 then raise exception 'Rollback refused: % row(s) are featured.', n; end if;
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and created_at < '2026-07-27';
  if n <> 0 then raise exception 'Rollback refused: % target(s) predate this import.', n; end if;

  delete from public.locations where source = 'pilot-master-2026-07-27';
  get diagnostics n = row_count;
  raise notice 'Deleted % inserted Pilot-network row(s).', n;

  select count(*) into n from public.locations where source = 'pilot-master-2026-07-27';
  if n <> 0 then raise exception 'Post-check failed: % row(s) survive.', n; end if;
end $$;
commit;
