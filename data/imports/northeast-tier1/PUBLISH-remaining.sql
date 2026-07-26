-- Publish remaining eligible Tier-1 records (after canary passes).
-- One state per transaction; requires coordinates; exact ROW_COUNT guard.

-- ===== REMAINING DE (3 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      '18df2837-56f3-4b52-9360-d625614d0910',
      'a8c03a61-df69-466d-bbf3-9bde66a34005',
      '5046a85e-6a9a-49e8-aedd-ab29f95b00d1'
    )
    AND l.state = 'DE'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 3 THEN RAISE EXCEPTION 'REMAINING DE guard: expected 3, got %', n; END IF;
  RAISE NOTICE 'REMAINING DE: % rows', n;
END $$;

-- ===== REMAINING MD (8 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      '4795b25a-2bb2-4c4e-ac29-d864159cb3f3',
      '84a7fdb0-85d9-47e2-a615-c507033be742',
      'ebeeef84-4ab8-478a-a46a-3e07a9b29ff3',
      'ae5c7f98-3827-4f30-a664-af01f578db47',
      '44ef662c-3372-40a8-9c5b-eb2f0c76fc2c',
      'e45cdd5c-1081-4859-b540-5a800714c6f9',
      '1c2331c1-e7c3-4f1c-8080-8c77e26ca570',
      'f1e6af7b-d118-4bae-b8f0-5211efc8131e'
    )
    AND l.state = 'MD'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 8 THEN RAISE EXCEPTION 'REMAINING MD guard: expected 8, got %', n; END IF;
  RAISE NOTICE 'REMAINING MD: % rows', n;
END $$;
