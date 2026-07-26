-- Publication canary — 3 diverse records (DE cdl + MD truck-wash + MD cat-scale).
-- Requires coordinates; one state per transaction; exact ROW_COUNT guard.

-- ===== CANARY DE (1 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      'fed4a341-e7ca-4020-b95e-11a589f9d537'
    )
    AND l.state = 'DE'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'CANARY DE guard: expected 1, got %', n; END IF;
  RAISE NOTICE 'CANARY DE: % rows', n;
END $$;

-- ===== CANARY MD (2 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      'fdc35482-6e2a-44a5-8d70-e976883b9f25',
      '58dc0ef3-dc55-42ec-9b42-3ddcad197aa8'
    )
    AND l.state = 'MD'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'CANARY MD guard: expected 2, got %', n; END IF;
  RAISE NOTICE 'CANARY MD: % rows', n;
END $$;
