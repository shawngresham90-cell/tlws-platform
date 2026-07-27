-- TA/Petro closeout — value-matched rollback. Written BEFORE execution.
--
-- Reverses CLOSEOUT.sql part 1 (site 0269) and CORRECTIONS §A (Atlanta).
-- Parts 3 and 4 were never executed and need no reversal.
-- Every statement is exact-id scoped and value-matched: a row edited since
-- the closeout stops matching and is deliberately left alone.

-- 1. Site 0269 — clear exactly the coordinate this closeout wrote.
--    Pre-state (proven by the forward blank-only guard): lat/lng NULL, no
--    geocode metadata, parking_spaces 176, published.
begin;
update public.locations
   set lat = null, lng = null,
       geocode_source = null, geocode_confidence = null,
       coord_verification_status = null, last_geocoded_at = null,
       updated_at = now()
 where id = 'cd4783d1-b67c-4c09-b056-6a72f5606229'
   and lat = 35.8731 and lng = -84.2379
   and geocode_source = 'batch-csv' and deleted_at is null and not is_featured;
commit;

-- 2. Correction A — value-matched republish of the Atlanta duplicate.
begin;
update public.locations set is_published = true, updated_at = now()
 where id = '33e41d22-1dac-425b-a17d-c9b6affcda21'
   and name = 'TA Atlanta South #268' and not is_published and deleted_at is null;
commit;
