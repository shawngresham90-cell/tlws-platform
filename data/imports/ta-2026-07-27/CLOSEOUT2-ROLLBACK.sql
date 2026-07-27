-- TA/Petro closeout 2 — value-matched rollback. Written BEFORE execution.
-- Exact-id scoped; a row edited since stops matching and is left alone.
-- Blank-only forward writes mean NULL is the exact pre-state for every
-- cleared field; publication reversals restore the exact prior false.

-- A. TA Ashland (site 0001) — full reversal: unpublish, then clear fills.
begin;
update public.locations set is_published = false, updated_at = now()
 where id = 'e36e07df-2f06-48a6-9494-8cf3b0f4cc15' and is_published
   and name = 'TA Ashland (TravelCenters of America)' and deleted_at is null;
update public.locations
   set address = null, phone = null, lat = null, lng = null, parking_spaces = null,
       geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'e36e07df-2f06-48a6-9494-8cf3b0f4cc15' and deleted_at is null
   and address = '100 North Carter Rd' and phone = '804-798-6011'
   and lat = 37.7598 and lng = -77.4631 and parking_spaces = 183
   and geocode_source = 'batch-csv';
commit;

-- B. TA Richmond (site 0142) — same shape.
begin;
update public.locations set is_published = false, updated_at = now()
 where id = '7a03c1f5-6b4d-4951-98a2-a3e752d2270b' and is_published
   and name = 'TA Richmond (TravelCenters of America)' and deleted_at is null;
update public.locations
   set address = null, phone = null, lat = null, lng = null, parking_spaces = null,
       geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = '7a03c1f5-6b4d-4951-98a2-a3e752d2270b' and deleted_at is null
   and address = '10134 Lewistown Road' and phone = '804-798-6021'
   and lat = 37.7237 and lng = -77.4479 and parking_spaces = 317
   and geocode_source = 'batch-csv';
commit;

-- C. Petro Florence (site 0393) — unpublish first, then restore the exact
--    prior (mislabeled) identity so the quarantine state is recoverable.
begin;
update public.locations set is_published = false, updated_at = now()
 where id = 'beb05d53-db50-49cb-8790-ec01b45c8187' and is_published
   and name = 'Petro Florence' and deleted_at is null;
update public.locations
   set name = 'Love''s Travel Stop #420', slug = 'love-s-travel-stop-420',
       detail_slug = 'love-s-travel-stop-420-florence-sc',
       website = 'https://www.loves.com/locations/420',
       description = 'Love''s at I-95 Exit 169 (TV Rd, Florence) with 24-hour diesel, truck parking, showers, laundry, tire/truck repair and fast food, adjacent to a Blue Beacon truck wash.',
       lat = null, lng = null, parking_spaces = null,
       geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null, updated_at = now()
 where id = 'beb05d53-db50-49cb-8790-ec01b45c8187' and deleted_at is null
   and name = 'Petro Florence' and lat = 34.2665 and lng = -79.7321
   and parking_spaces = 210 and not is_published;
commit;
