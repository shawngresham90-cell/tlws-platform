-- ROLLBACK — geocode write. Reverts EXACTLY what GEOCODE.sql wrote, matching on
-- id AND the exact coordinate we set, so it cannot clobber a later re-geocode.
-- Restores lat/lng and all geocode metadata to NULL (their pre-write state).
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET
    lat = NULL, lng = NULL,
    geocode_source = NULL, geocode_confidence = NULL,
    coord_verification_status = NULL, last_geocoded_at = NULL
  FROM (VALUES
    ('ff19357b-eb93-4483-9e4e-ebb40e07fe36'::uuid, 39.1667::double precision, -76.7828::double precision),
    ('e102d6bd-874c-43d0-b9f6-c8a9dbbe4832'::uuid, 39.2775::double precision, -76.5488::double precision),
    ('f35c37d4-6118-40c1-8380-1edf8e79777d'::uuid, 39.6436::double precision, -75.7974::double precision)
  ) AS v(id, lat, lng)
  WHERE l.id = v.id
    AND l.lat = v.lat AND l.lng = v.lng
    AND l.geocode_source = 'batch-csv';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'ROLLBACK geocode: % rows reverted', n;
END $$;
