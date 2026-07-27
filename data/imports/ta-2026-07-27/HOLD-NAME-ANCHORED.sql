-- HOLD — name-anchored matches. DO NOT RUN until identity is verified.
--
-- NOT EXECUTED, and not part of the enrichment authorization. The prior
-- review linked BOTH of these sites to the same production row; the pairing
-- below is by name+city+state+zip5 and needs a human eye before any value is
-- written. Both rows are UNPUBLISHED, so nothing is in front of drivers.
--
-- Source of record: the current official TA/Petro location master,
-- downloaded 2026-07-27 via "Download Location Data" at ta-petro.com/location/.
-- Official artifact sha256 a0c612f0426d141c481f84aae59dc15a0204617183bbf9c0866bfbb726ed63f7
-- COMMITTED 2026-07-27 as locmaster20260727.xlsx and checksum-verified.
-- Cell-content diff against the earlier working copy (5ebe0e9f…3303): identical
-- except two service-hours cells at TA Kingman AZ — columns never read by the
-- reconciliation and never written by any statement. All ten verified facts
-- hold on the exact artifact. PRECONDITION OF EXECUTION: SATISFIED.
--
-- Stable keys: Site ID first, then Location ID; then address and coordinate
-- checks. A loose business name is never sufficient on its own.
--
-- Goasis and Thorntons are HELD — separate and untouched.
-- The 7 zero-parking locations are never counted as truck-parking coverage.
-- overnight_parking, is_published, is_featured and is_indexable are NEVER
-- written by any statement in this package.
--
-- Site 0001 TA Ashland   (100 North Carter Rd, Ashland VA, 183 spaces)
--   -> e36e07df-2f06-48a6-9494-8cf3b0f4cc15 "TA Ashland (TravelCenters of America)"
-- Site 0142 TA Richmond  (10134 Lewistown Road, Ashland VA, 317 spaces)
--   -> 7a03c1f5-6b4d-4951-98a2-a3e752d2270b "TA Richmond (TravelCenters of America)"
--
-- Ashland, Virginia has TWO distinct official sites, both zip 23005. The
-- verification that matters: confirm which physical site each row's history
-- refers to before writing either coordinate.

-- ---------------- site 0001 -> e36e07df-2f06-48a6-9494-8cf3b0f4cc15 (TA Ashland (TravelCenters of America))
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where id = 'e36e07df-2f06-48a6-9494-8cf3b0f4cc15' and deleted_at is null and category_slug = 'truck-stops'
     and name = 'TA Ashland (TravelCenters of America)' and state = 'VA' and not is_published
     and lat is null and lng is null;
  if n <> 1 then raise exception 'Identity precondition failed for e36e07df-2f06-48a6-9494-8cf3b0f4cc15.'; end if;

  update public.locations
     set lat = 37.7598, lng = -77.4631,
         parking_spaces = coalesce(parking_spaces, 183),
         geocode_source = 'batch-csv', geocode_confidence = 'high',
         coord_verification_status = 'machine-checked',
         last_geocoded_at = now(), updated_at = now()
   where id = 'e36e07df-2f06-48a6-9494-8cf3b0f4cc15' and lat is null and lng is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Expected exactly 1 update.'; end if;
end $$;
commit;

-- ---------------- site 0142 -> 7a03c1f5-6b4d-4951-98a2-a3e752d2270b (TA Richmond (TravelCenters of America))
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where id = '7a03c1f5-6b4d-4951-98a2-a3e752d2270b' and deleted_at is null and category_slug = 'truck-stops'
     and name = 'TA Richmond (TravelCenters of America)' and state = 'VA' and not is_published
     and lat is null and lng is null;
  if n <> 1 then raise exception 'Identity precondition failed for 7a03c1f5-6b4d-4951-98a2-a3e752d2270b.'; end if;

  update public.locations
     set lat = 37.7237, lng = -77.4479,
         parking_spaces = coalesce(parking_spaces, 317),
         geocode_source = 'batch-csv', geocode_confidence = 'high',
         coord_verification_status = 'machine-checked',
         last_geocoded_at = now(), updated_at = now()
   where id = '7a03c1f5-6b4d-4951-98a2-a3e752d2270b' and lat is null and lng is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Expected exactly 1 update.'; end if;
end $$;
commit;

