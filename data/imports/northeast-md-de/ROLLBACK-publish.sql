-- ROLLBACK — publication. Reverts is_published true -> false for exactly the 3
-- canary rows. id-scoped; only affects rows currently published.
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET
    is_published = false
  WHERE l.id IN (
      'ff19357b-eb93-4483-9e4e-ebb40e07fe36',
      'e102d6bd-874c-43d0-b9f6-c8a9dbbe4832',
      'f35c37d4-6118-40c1-8380-1edf8e79777d'
    )
    AND l.is_published = true;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'ROLLBACK publish: % rows unpublished', n;
END $$;
