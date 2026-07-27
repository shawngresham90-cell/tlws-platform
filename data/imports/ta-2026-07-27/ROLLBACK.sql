-- TA/Petro package — per-row, id-scoped, value-matched rollback. NOT EXECUTED.
--
-- Reverses CANARY-ENRICH.sql / ENRICH-REMAINDER.sql / ENRICH-EXISTING.sql.
-- geocode_source carries the shared legal value 'batch-csv' (the schema CHECK
-- constraint allows no bespoke tag), so nothing here is scoped by tag: every
-- statement names the exact row id from the committed plan and clears a field
-- only while it still holds the exact staged value. A row someone edited since
-- enrichment stops matching and is deliberately left alone.
--
-- Because every forward write was blank-only (proven by the forward guards),
-- NULL is the exact pre-state for every field cleared here — this is a full
-- value-matched reversal, not an approximation. Pre-state of every target row
-- is also snapshotted in data/sources/ta-master/2026-07-27/DB-STATE-SNAPSHOT.tsv.
--
-- Rollbacks for CORRECTIONS-PROPOSALS.sql live inline in that file.
-- HOLD rows: commented pairs at the bottom — activate only if HOLD was run.

begin;

-- site 0010 · TA Gary #010 (Burr Street) (IN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '783d1792-e352-4fb3-bd2b-fc38951c19c8' and lat = 41.573 and lng = -87.4045
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0019 · TA Elkton #019 (MD) · fills: parking_spaces
update public.locations
   set parking_spaces = null, updated_at = now()
 where id = 'f35c37d4-6118-40c1-8380-1edf8e79777d' and parking_spaces = 151
   and deleted_at is null and not is_featured;

-- site 0028 · TA Walton (KY) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'dee17bfa-a6bf-4da0-8d48-95a9231de439' and lat = 38.9172 and lng = -84.6266
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0033 · TA Earle (TravelCenters of America #033) (AR) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '3e5fef77-bc72-4174-b45d-04f6096c8fde' and lat = 35.1364 and lng = -90.488
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations
   set parking_spaces = null, updated_at = now()
 where id = '3e5fef77-bc72-4174-b45d-04f6096c8fde' and parking_spaces = 137
   and deleted_at is null and not is_featured;

-- site 0053 · TA Wildwood (TravelCenters of America) (FL) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '245d9e0f-cb95-461e-822a-e458c03212ed' and lat = 28.875 and lng = -82.0939
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0065 · TA Seymour (IN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'b9b49d33-ae7d-4ca0-b197-6986c17eef18' and lat = 38.9576 and lng = -85.8366
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0069 · TA Travel Center - Monroe #069 (MI) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '7b340f8f-28fc-4bca-83a8-bee8a793a4fb' and lat = 41.9267 and lng = -83.3632
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0082 · TA Wapakoneta #082 (OH) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '51296b6f-d325-4a97-a48f-d7a315a5e7e0' and lat = 40.5582 and lng = -84.1656
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0093 · TA Florence (KY) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'eec1d852-2b50-47f7-a59e-b1238f1ace2d' and lat = 39.0001 and lng = -84.6447
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0151 · TA Baltimore South #151 (MD) · fills: parking_spaces
update public.locations
   set parking_spaces = null, updated_at = now()
 where id = 'ff19357b-eb93-4483-9e4e-ebb40e07fe36' and parking_spaces = 436
   and deleted_at is null and not is_featured;

-- site 0173 · TA Whitestown (TravelCenters of America #173) (IN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '0fd1e82b-0a8e-410b-9af9-8787d6ab89b8' and lat = 39.9478 and lng = -86.357
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0177 · TA Savannah (TravelCenters of America #177) (GA) · fills: parking_spaces
update public.locations
   set parking_spaces = null, updated_at = now()
 where id = '6bad6451-4f76-45b8-9a3b-4a1aad414f83' and parking_spaces = 222
   and deleted_at is null and not is_featured;

-- site 0179 · TA Manning (TravelCenters of America #179) (SC) · fills: parking_spaces
update public.locations
   set parking_spaces = null, updated_at = now()
 where id = 'b621363d-e4d4-40c6-a04d-09e950264b12' and parking_spaces = 84
   and deleted_at is null and not is_featured;

-- site 0197 · TA Vero Beach #197 (FL) · fills: parking_spaces
update public.locations
   set parking_spaces = null, updated_at = now()
 where id = '7d74bb54-f22d-4594-8bc8-9d9710f88ac0' and parking_spaces = 162
   and deleted_at is null and not is_featured;

-- site 0216 · TA Baltimore #216 (MD) · fills: parking_spaces
update public.locations
   set parking_spaces = null, updated_at = now()
 where id = 'e102d6bd-874c-43d0-b9f6-c8a9dbbe4832' and parking_spaces = 181
   and deleted_at is null and not is_featured;

-- site 0221 · TA Candler (TravelCenters of America #221) (NC) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '91b8ddaa-6012-4ab7-839a-ded888eb912d' and lat = 35.5432 and lng = -82.754
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0245 · TA Denmark (TravelCenters of America #245) (TN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '09974385-8c93-4bb5-be59-13552b53e2b3' and lat = 35.5955 and lng = -89.0557
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0258 · TA Travel Center Brunswick (GA) · fills: parking_spaces
update public.locations
   set parking_spaces = null, updated_at = now()
 where id = '28c41568-118b-4e1f-aee1-469f8a634af9' and parking_spaces = 107
   and deleted_at is null and not is_featured;

-- site 0269 · TA Knoxville West (TN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'cd4783d1-b67c-4c09-b056-6a72f5606229' and lat = 35.8731 and lng = -84.2379
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0287 · TA Express Cookeville (TN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '68afff98-8a4c-42be-b099-e87e50b08a38' and lat = 36.1305 and lng = -85.4796
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0288 · TA Travel Center #288 (Lake City) (FL) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '687996be-4fd9-4464-a9b3-3df5b2c7f505' and lat = 29.99558 and lng = -82.59672
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0311 · Petro Stopping Center #311 (Petro West Memphis) (AR) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '20ea502e-9d1f-43e3-b369-520d35c38c5f' and lat = 35.1544 and lng = -90.136
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0312 · Petro Knoxville (TN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '5e829807-6932-4f13-b44f-e5dea115f755' and lat = 35.875 and lng = -84.2361
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0323 · Petro Stopping Center #323 (Ocala / Reddick) (FL) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '904bda8d-b42d-49ce-88d2-5b2fd4ca4191' and lat = 29.409 and lng = -82.2462
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0325 · Petro Stopping Center #325 (OH) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'bb4d283f-1f08-4acd-a062-850f5bc309c6' and lat = 41.1738 and lng = -83.6475
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0326 · Petro Stopping Center #326 (Petro N. Little Rock) (AR) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '03c39975-0f38-4f41-97e7-d50d95b9edf0' and lat = 34.781 and lng = -92.1298
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0344 · Petro Stopping Center #344 (TA/Petro Kingsland) (GA) · fills: parking_spaces
update public.locations
   set parking_spaces = null, updated_at = now()
 where id = '36d48fe4-d2ce-4d99-987a-9e8341644b7a' and parking_spaces = 136
   and deleted_at is null and not is_featured;

-- site 0349 · Petro Stopping Center Kingston Springs #349 (TN) · fills: lat+lng+parking_spaces
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '8018aa5b-c428-465d-9809-fde4e03cd4a2' and lat = 36.0824 and lng = -87.0955
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
update public.locations
   set parking_spaces = null, updated_at = now()
 where id = '8018aa5b-c428-465d-9809-fde4e03cd4a2' and parking_spaces = 68
   and deleted_at is null and not is_featured;

-- site 0369 · Petro Gary #369 (Grant Street) (IN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '8578017a-7ea0-4c38-a6ed-abf7b5a39d0f' and lat = 41.5638 and lng = -87.3557
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0382 · Petro Stopping Center #382 (IN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'bd27e9bc-6b14-4810-b20d-26a04702c477' and lat = 40.767 and lng = -87.1261
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0395 · Petro Kenly 95 #395 (NC) · fills: parking_spaces
update public.locations
   set parking_spaces = null, updated_at = now()
 where id = '0a0c7a0d-2fb0-4201-a93f-b934e2617b5b' and parking_spaces = 350
   and deleted_at is null and not is_featured;

-- site 0485 · Petro Dodge City (Petro Stopping Center #397) (AL) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '25721d01-d3ed-4da5-a9cc-448fd166e75b' and lat = 34.05078 and lng = -86.87234
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0486 · TA Express Stony Creek (former Davis Travel Center) (VA) · fills: parking_spaces
update public.locations
   set parking_spaces = null, updated_at = now()
 where id = 'ebb8ad22-3283-4fc6-9918-66a8ef8ef9dd' and parking_spaces = 80
   and deleted_at is null and not is_featured;

-- site 0527 · Petro / TA Florence (TravelCenters of America #195) (SC) · fills: parking_spaces
update public.locations
   set parking_spaces = null, updated_at = now()
 where id = '8bf6630b-8c97-45c5-b219-f6b2e21d760a' and parking_spaces = 77
   and deleted_at is null and not is_featured;

-- site 0528 · TA Saginaw #198 (Bridgeport) (MI) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'eb48d156-9ad9-4fa3-b8eb-cfc7b29a49a4' and lat = 43.3517 and lng = -83.869
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0539 · TA Montgomery #111 (AL) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '2937ca5e-063c-4ac7-b4c4-0e7da286f488' and lat = 32.32746 and lng = -86.33221
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0544 · TA Franklin (TravelCenters of America #157) (TN) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'd19be5c3-65f2-471d-9281-0cfeeaa8ceb0' and lat = 35.8603 and lng = -86.8299
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- site 0954 · TA Express Atkins (AR) · fills: lat+lng
update public.locations
   set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '366ea2a6-4116-4ce3-bc64-01fdac0dcb60' and lat = 35.22162 and lng = -92.82594
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;

-- Post-check: after a FULL rollback of a FULL enrichment, every pair above
-- must have matched. Fewer means rows were edited since (investigate those
-- ids); never re-run blindly.
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where id in ('783d1792-e352-4fb3-bd2b-fc38951c19c8', 'dee17bfa-a6bf-4da0-8d48-95a9231de439', '3e5fef77-bc72-4174-b45d-04f6096c8fde', '245d9e0f-cb95-461e-822a-e458c03212ed', 'b9b49d33-ae7d-4ca0-b197-6986c17eef18', '7b340f8f-28fc-4bca-83a8-bee8a793a4fb', '51296b6f-d325-4a97-a48f-d7a315a5e7e0', 'eec1d852-2b50-47f7-a59e-b1238f1ace2d', '0fd1e82b-0a8e-410b-9af9-8787d6ab89b8', '91b8ddaa-6012-4ab7-839a-ded888eb912d', '09974385-8c93-4bb5-be59-13552b53e2b3', 'cd4783d1-b67c-4c09-b056-6a72f5606229', '68afff98-8a4c-42be-b099-e87e50b08a38', '687996be-4fd9-4464-a9b3-3df5b2c7f505', '20ea502e-9d1f-43e3-b369-520d35c38c5f', '5e829807-6932-4f13-b44f-e5dea115f755', '904bda8d-b42d-49ce-88d2-5b2fd4ca4191', 'bb4d283f-1f08-4acd-a062-850f5bc309c6', '03c39975-0f38-4f41-97e7-d50d95b9edf0', '8018aa5b-c428-465d-9809-fde4e03cd4a2', '8578017a-7ea0-4c38-a6ed-abf7b5a39d0f', 'bd27e9bc-6b14-4810-b20d-26a04702c477', '25721d01-d3ed-4da5-a9cc-448fd166e75b', 'eb48d156-9ad9-4fa3-b8eb-cfc7b29a49a4', '2937ca5e-063c-4ac7-b4c4-0e7da286f488', 'd19be5c3-65f2-471d-9281-0cfeeaa8ceb0', '366ea2a6-4116-4ce3-bc64-01fdac0dcb60')
     and lat is not null;
  raise notice 'coordinate rows still enriched after rollback: % (expect 0 after full reversal of %)', n, 27;
end $$;
commit;

-- HOLD rows (site 0001 / site 0142) — activate ONLY if HOLD-NAME-ANCHORED.sql
-- was verified and run:
-- update public.locations
--    set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
--        coord_verification_status = null, last_geocoded_at = null, updated_at = now()
--  where id = 'e36e07df-2f06-48a6-9494-8cf3b0f4cc15' and lat = 37.7598 and lng = -77.4631
--    and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
-- update public.locations
--    set parking_spaces = null, updated_at = now()
--  where id = 'e36e07df-2f06-48a6-9494-8cf3b0f4cc15' and parking_spaces = 183
--    and deleted_at is null and not is_featured;
-- update public.locations
--    set lat = null, lng = null, geocode_source = null, geocode_confidence = null,
--        coord_verification_status = null, last_geocoded_at = null, updated_at = now()
--  where id = '7a03c1f5-6b4d-4951-98a2-a3e752d2270b' and lat = 37.7237 and lng = -77.4479
--    and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
-- update public.locations
--    set parking_spaces = null, updated_at = now()
--  where id = '7a03c1f5-6b4d-4951-98a2-a3e752d2270b' and parking_spaces = 317
--    and deleted_at is null and not is_featured;
