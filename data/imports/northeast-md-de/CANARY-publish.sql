-- Northeast MD/DE publication canary — 3 records (guarded)
-- Sets is_published false -> true for EXACTLY the 3 geocoded MD TA rows.
-- Precondition: each row is currently unpublished AND now carries coordinates
-- (lat/lng NOT NULL) written by GEOCODE.sql. id-scoped. Auto-rolls back
-- unless ROW_COUNT = 3. This is also the full eligible publish set for this
-- pass (the 3 deferred plazas are not geocoded, so not eligible).

DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET
    is_published = true
  WHERE l.id IN (
      'ff19357b-eb93-4483-9e4e-ebb40e07fe36',  -- TA Baltimore South #151
      'e102d6bd-874c-43d0-b9f6-c8a9dbbe4832',  -- TA Baltimore #216
      'f35c37d4-6118-40c1-8380-1edf8e79777d'   -- TA Elkton #019
    )
    AND l.state = 'MD'
    AND l.type = 'truck_stop'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;  -- publish only geocoded rows
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 3 THEN
    RAISE EXCEPTION 'CANARY publish guard failed: expected 3 rows, published %', n;
  END IF;
  RAISE NOTICE 'CANARY publish: % rows published', n;
END $$;

-- ===== Publish remaining eligible =====
-- 0 rows. Beyond the 3 canary rows there are no further geocoded-eligible
-- MD/DE candidates this pass; the 3 plazas are deferred (see DEFERRED.md).
