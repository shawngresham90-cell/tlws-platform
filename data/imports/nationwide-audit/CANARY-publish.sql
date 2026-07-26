-- Mixed-category publication canary (one state per transaction; coordinates required).

-- ===== CANARY AL (1 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      '48f3af5a-620d-4a44-9dd5-96210e2b3e39'
    )
    AND l.state = 'AL'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;   -- never publish without coordinates
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'CANARY AL guard: expected 1, got %', n; END IF;
  RAISE NOTICE 'CANARY AL: % rows', n;
END $$;

-- ===== CANARY AR (1 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      'e945424b-b704-4e3e-9eaa-0ed1ba82fb98'
    )
    AND l.state = 'AR'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;   -- never publish without coordinates
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'CANARY AR guard: expected 1, got %', n; END IF;
  RAISE NOTICE 'CANARY AR: % rows', n;
END $$;

-- ===== CANARY FL (1 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      '738937f9-3b6d-44d2-9c1e-61ce6e0c43dc'
    )
    AND l.state = 'FL'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;   -- never publish without coordinates
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'CANARY FL guard: expected 1, got %', n; END IF;
  RAISE NOTICE 'CANARY FL: % rows', n;
END $$;

-- ===== CANARY GA (1 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      '4e5234b6-1305-4705-941d-ec5a77370983'
    )
    AND l.state = 'GA'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;   -- never publish without coordinates
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'CANARY GA guard: expected 1, got %', n; END IF;
  RAISE NOTICE 'CANARY GA: % rows', n;
END $$;

-- ===== CANARY IN (1 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      '53bc511f-3b30-4ac3-aed3-597e416f3f38'
    )
    AND l.state = 'IN'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;   -- never publish without coordinates
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'CANARY IN guard: expected 1, got %', n; END IF;
  RAISE NOTICE 'CANARY IN: % rows', n;
END $$;

-- ===== CANARY KY (1 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      'ca06adc7-efad-41a5-9da7-e074fc99a452'
    )
    AND l.state = 'KY'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;   -- never publish without coordinates
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'CANARY KY guard: expected 1, got %', n; END IF;
  RAISE NOTICE 'CANARY KY: % rows', n;
END $$;

-- ===== CANARY NC (1 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      '5ff9ec4c-0bb8-49ad-b411-e84e11644025'
    )
    AND l.state = 'NC'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;   -- never publish without coordinates
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'CANARY NC guard: expected 1, got %', n; END IF;
  RAISE NOTICE 'CANARY NC: % rows', n;
END $$;

-- ===== CANARY OH (1 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      'b338afed-6894-4b1b-b116-d1acae79348c'
    )
    AND l.state = 'OH'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;   -- never publish without coordinates
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'CANARY OH guard: expected 1, got %', n; END IF;
  RAISE NOTICE 'CANARY OH: % rows', n;
END $$;

-- ===== CANARY SC (1 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      '595de56a-aada-4034-882b-60a2fd579ab3'
    )
    AND l.state = 'SC'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;   -- never publish without coordinates
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'CANARY SC guard: expected 1, got %', n; END IF;
  RAISE NOTICE 'CANARY SC: % rows', n;
END $$;

-- ===== CANARY TN (1 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      '54e7735a-85fc-48e7-89ab-3b4e5eeaa514'
    )
    AND l.state = 'TN'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;   -- never publish without coordinates
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'CANARY TN guard: expected 1, got %', n; END IF;
  RAISE NOTICE 'CANARY TN: % rows', n;
END $$;
