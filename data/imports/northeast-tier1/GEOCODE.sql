-- Northeast MD/DE Tier-1 — geocode from US Census (Exact matches, high confidence).
-- Only lat/lng + geocode metadata written; blank-only; one state per transaction.
-- Coordinates verbatim from data/geocoding/census/raw/GeocodeResults.csv.

-- ===== GEOCODE DE (4 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET
    lat = v.lat, lng = v.lng,
    geocode_source = 'batch-csv', geocode_confidence = 'high',
    coord_verification_status = 'machine-checked', last_geocoded_at = now()
  FROM (VALUES
    ('fed4a341-e7ca-4020-b95e-11a589f9d537'::uuid, 39.698089::double precision, -75.708292::double precision),
    ('18df2837-56f3-4b52-9360-d625614d0910'::uuid, 39.705252::double precision, -75.539945::double precision),
    ('a8c03a61-df69-466d-bbf3-9bde66a34005'::uuid, 39.663863::double precision, -75.614792::double precision),
    ('5046a85e-6a9a-49e8-aedd-ab29f95b00d1'::uuid, 39.741768::double precision, -75.532929::double precision)
  ) AS v(id, lat, lng)
  WHERE l.id = v.id
    AND l.state = 'DE'
    AND l.source = 'csv-import'
    AND l.lat IS NULL AND l.lng IS NULL
    AND l.is_published = false;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'GEOCODE DE guard: expected 4, got %', n; END IF;
  RAISE NOTICE 'GEOCODE DE: % rows', n;
END $$;

-- ===== GEOCODE MD (10 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET
    lat = v.lat, lng = v.lng,
    geocode_source = 'batch-csv', geocode_confidence = 'high',
    coord_verification_status = 'machine-checked', last_geocoded_at = now()
  FROM (VALUES
    ('4795b25a-2bb2-4c4e-ac29-d864159cb3f3'::uuid, 39.263086::double precision, -76.542998::double precision),
    ('84a7fdb0-85d9-47e2-a615-c507033be742'::uuid, 39.635825::double precision, -75.806438::double precision),
    ('ebeeef84-4ab8-478a-a46a-3e07a9b29ff3'::uuid, 39.152575::double precision, -76.801447::double precision),
    ('ae5c7f98-3827-4f30-a664-af01f578db47'::uuid, 39.645113::double precision, -75.797782::double precision),
    ('fdc35482-6e2a-44a5-8d70-e976883b9f25'::uuid, 39.635829::double precision, -75.806449::double precision),
    ('44ef662c-3372-40a8-9c5b-eb2f0c76fc2c'::uuid, 39.163838::double precision, -76.769681::double precision),
    ('e45cdd5c-1081-4859-b540-5a800714c6f9'::uuid, 39.161451::double precision, -76.78197::double precision),
    ('1c2331c1-e7c3-4f1c-8080-8c77e26ca570'::uuid, 39.281166::double precision, -76.549108::double precision),
    ('f1e6af7b-d118-4bae-b8f0-5211efc8131e'::uuid, 39.167518::double precision, -76.784088::double precision),
    ('58dc0ef3-dc55-42ec-9b42-3ddcad197aa8'::uuid, 39.645113::double precision, -75.797782::double precision)
  ) AS v(id, lat, lng)
  WHERE l.id = v.id
    AND l.state = 'MD'
    AND l.source = 'csv-import'
    AND l.lat IS NULL AND l.lng IS NULL
    AND l.is_published = false;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 10 THEN RAISE EXCEPTION 'GEOCODE MD guard: expected 10, got %', n; END IF;
  RAISE NOTICE 'GEOCODE MD: % rows', n;
END $$;
