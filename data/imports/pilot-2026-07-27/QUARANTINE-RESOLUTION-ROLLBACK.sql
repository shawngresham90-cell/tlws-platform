-- Rollback for QUARANTINE-RESOLUTION.sql — exact-ID / exact-slug,
-- value-matched, reverse order. NOT EXECUTED. Refuses drifted rows.
begin;
-- #1330 AR: de-enrich 69f1f244-c4c0-480b-9e95-f1b02554cb6b only if it still holds exactly the staged values.
update public.locations
   set lat = null, lng = null,
       parking_spaces = null,
       geocode_source = null, geocode_confidence = null,
       coord_verification_status = 'unverified', last_geocoded_at = null,
       updated_at = now()
 where id = '69f1f244-c4c0-480b-9e95-f1b02554cb6b' and lat = 34.912544273597874 and lng = -91.19621866623427
   and geocode_source = 'batch-csv' and parking_spaces = 42;
-- #1550 AL: de-enrich d7247403-1ed3-49de-83a5-af2862cdbd9f only if it still holds exactly the staged values.
update public.locations
   set lat = null, lng = null,
       geocode_source = null, geocode_confidence = null,
       coord_verification_status = 'unverified', last_geocoded_at = null,
       updated_at = now()
 where id = 'd7247403-1ed3-49de-83a5-af2862cdbd9f' and lat = 34.116865025472514 and lng = -86.86373995824155
   and geocode_source = 'batch-csv';
-- #353 KY: de-enrich a8a32662-d389-4d96-9653-6fde235726d0 only if it still holds exactly the staged values.
update public.locations
   set lat = null, lng = null,
       geocode_source = null, geocode_confidence = null,
       coord_verification_status = 'unverified', last_geocoded_at = null,
       updated_at = now()
 where id = 'a8a32662-d389-4d96-9653-6fde235726d0' and lat = 38.27605548759607 and lng = -84.55335544912026
   and geocode_source = 'batch-csv';
-- #95 FL: de-enrich 76f653aa-907b-4800-865a-1dd03003185a only if it still holds exactly the staged values.
update public.locations
   set lat = null, lng = null,
       parking_spaces = null,
       geocode_source = null, geocode_confidence = null,
       coord_verification_status = 'unverified', last_geocoded_at = null,
       updated_at = now()
 where id = '76f653aa-907b-4800-865a-1dd03003185a' and lat = 28.873918542991504 and lng = -82.09515797982287
   and geocode_source = 'batch-csv' and parking_spaces = 10;
-- #282 CA: unpublish then delete the inserted row, value-matched.
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'pilot-travel-center-282-barstow-ca' and source = 'pilot-master-2026-07-27'
   and is_published and lat = 34.8549172 and lng = -117.0874803 and parking_spaces = 18;
delete from public.locations
 where detail_slug = 'pilot-travel-center-282-barstow-ca' and source = 'pilot-master-2026-07-27'
   and not is_published and lat = 34.8549172 and lng = -117.0874803 and parking_spaces = 18;
-- #46 KY: unpublish then delete the inserted row, value-matched.
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'one9-travel-center-46-franklin-ky' and source = 'pilot-master-2026-07-27'
   and is_published and lat = 36.716046 and lng = -86.525849 and parking_spaces = 35;
delete from public.locations
 where detail_slug = 'one9-travel-center-46-franklin-ky' and source = 'pilot-master-2026-07-27'
   and not is_published and lat = 36.716046 and lng = -86.525849 and parking_spaces = 35;
-- #17 MI: unpublish then delete the inserted row, value-matched.
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'pilot-travel-center-17-battle-creek-mi' and source = 'pilot-master-2026-07-27'
   and is_published and lat = 42.3029751720004 and lng = -85.08241893488058 and parking_spaces = 75;
delete from public.locations
 where detail_slug = 'pilot-travel-center-17-battle-creek-mi' and source = 'pilot-master-2026-07-27'
   and not is_published and lat = 42.3029751720004 and lng = -85.08241893488058 and parking_spaces = 75;
-- #266 NM: unpublish then delete the inserted row, value-matched.
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'pilot-travel-center-266-las-cruces-nm' and source = 'pilot-master-2026-07-27'
   and is_published and lat = 32.296515098320114 and lng = -106.8102598392868 and parking_spaces = 28;
delete from public.locations
 where detail_slug = 'pilot-travel-center-266-las-cruces-nm' and source = 'pilot-master-2026-07-27'
   and not is_published and lat = 32.296515098320114 and lng = -106.8102598392868 and parking_spaces = 28;
-- #387 NV: unpublish then delete the inserted row, value-matched.
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'one9-travel-center-387-carlin-nv' and source = 'pilot-master-2026-07-27'
   and is_published and lat = 40.71970773701785 and lng = -116.10611350066375 and parking_spaces = 60;
delete from public.locations
 where detail_slug = 'one9-travel-center-387-carlin-nv' and source = 'pilot-master-2026-07-27'
   and not is_published and lat = 40.71970773701785 and lng = -116.10611350066375 and parking_spaces = 60;
-- #303 OH: unpublish then delete the inserted row, value-matched.
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'pilot-travel-center-303-napoleon-oh' and source = 'pilot-master-2026-07-27'
   and is_published and lat = 41.416480909036544 and lng = -84.10480444773451 and parking_spaces = 75;
delete from public.locations
 where detail_slug = 'pilot-travel-center-303-napoleon-oh' and source = 'pilot-master-2026-07-27'
   and not is_published and lat = 41.416480909036544 and lng = -84.10480444773451 and parking_spaces = 75;
-- #12 OH: unpublish then delete the inserted row, value-matched.
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'pilot-travel-center-12-perrysburg-oh' and source = 'pilot-master-2026-07-27'
   and is_published and lat = 41.52268729754443 and lng = -83.46222870809477 and parking_spaces = 23;
delete from public.locations
 where detail_slug = 'pilot-travel-center-12-perrysburg-oh' and source = 'pilot-master-2026-07-27'
   and not is_published and lat = 41.52268729754443 and lng = -83.46222870809477 and parking_spaces = 23;
-- #35 IN: unpublish then delete the inserted row, value-matched.
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'pilot-travel-center-35-south-bend-in' and source = 'pilot-master-2026-07-27'
   and is_published and lat = 41.736021 and lng = -86.336832 and parking_spaces = 70;
delete from public.locations
 where detail_slug = 'pilot-travel-center-35-south-bend-in' and source = 'pilot-master-2026-07-27'
   and not is_published and lat = 41.736021 and lng = -86.336832 and parking_spaces = 70;
-- #700 OH: unpublish then delete the inserted row, value-matched.
update public.locations set is_published = false, updated_at = now()
 where detail_slug = 'flying-j-travel-center-700-perrysburg-oh' and source = 'pilot-master-2026-07-27'
   and is_published and lat = 41.534688838750284 and lng = -83.4607347506996 and parking_spaces = 150;
delete from public.locations
 where detail_slug = 'flying-j-travel-center-700-perrysburg-oh' and source = 'pilot-master-2026-07-27'
   and not is_published and lat = 41.534688838750284 and lng = -83.4607347506996 and parking_spaces = 150;
commit;
