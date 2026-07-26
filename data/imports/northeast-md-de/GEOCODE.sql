-- Northeast MD/DE geocode — authoritative coordinate write (guarded)
-- Writes ONLY lat, lng, geocode_source, geocode_confidence,
-- coord_verification_status, last_geocoded_at. Blank-only (lat/lng IS NULL),
-- id-scoped to the 3 verified MD TA rows, one state per transaction.
-- Coordinate value = operator master (locmaster20260725.xlsx,
-- sha256 5ebe0e9f...553303), cross-checked against the US Census batch
-- geocoder (agreement 144-409 m). interstate/exit are NOT touched (already
-- populated). geo is NOT written. Auto-rolls back unless ROW_COUNT = 3.

-- ===== State: MD (3 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET
    lat = v.lat,
    lng = v.lng,
    geocode_source = 'batch-csv',
    geocode_confidence = 'high',
    coord_verification_status = 'machine-checked',
    last_geocoded_at = now()
  FROM (VALUES
    ('ff19357b-eb93-4483-9e4e-ebb40e07fe36'::uuid, 39.1667::double precision, -76.7828::double precision),
    ('e102d6bd-874c-43d0-b9f6-c8a9dbbe4832'::uuid, 39.2775::double precision, -76.5488::double precision),
    ('f35c37d4-6118-40c1-8380-1edf8e79777d'::uuid, 39.6436::double precision, -75.7974::double precision)
  ) AS v(id, lat, lng)
  WHERE l.id = v.id
    AND l.state = 'MD'
    AND l.type = 'truck_stop'
    AND l.source = 'csv-import'
    AND l.lat IS NULL AND l.lng IS NULL   -- blank-only: never overwrite an existing coordinate
    AND l.is_published = false;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 3 THEN
    RAISE EXCEPTION 'GEOCODE MD guard failed: expected 3 rows, updated %', n;
  END IF;
  RAISE NOTICE 'GEOCODE MD: % rows updated', n;
END $$;

-- ===== State: DE (0 rows this pass) =====
-- The single DE truck-stop candidate, Biden Welcome Center
-- (7d3ead5b-1237-474f-9154-06b410f7b410), is DEFERRED: only a single fuzzy
-- Census match exists (zip 19713 -> matched 19702), no corroborating second
-- source. No DE coordinate is written this pass. See DEFERRED.md.
