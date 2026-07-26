-- Publish remaining approved candidates after the canary passes.
-- One state per transaction; coordinates required; exact ROW_COUNT guards.

-- ===== BATCH AL (4 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      'f972d0f0-b603-4694-824f-36718afa596b',
      '7ca426a1-8f1c-41fd-a721-3c070ccec7c9',
      'dde95330-d441-40ca-8bce-f0361edba20b',
      '0e24e007-db84-40db-bfc1-222e5d0eebad'
    )
    AND l.state = 'AL'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;   -- never publish without coordinates
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'BATCH AL guard: expected 4, got %', n; END IF;
  RAISE NOTICE 'BATCH AL: % rows', n;
END $$;

-- ===== BATCH AR (4 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      '66f48a5d-4b79-4673-a245-f44828333bca',
      '181dd4e9-f9b8-41ca-9b5d-3d38edf629ab',
      '76c7094c-a57d-4c9f-9232-1343eead5d58',
      'b440672c-2cac-41cc-b748-a2c6867dbd67'
    )
    AND l.state = 'AR'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;   -- never publish without coordinates
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 4 THEN RAISE EXCEPTION 'BATCH AR guard: expected 4, got %', n; END IF;
  RAISE NOTICE 'BATCH AR: % rows', n;
END $$;

-- ===== BATCH FL (12 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      'b25603ec-f8d8-415f-a1a6-0ba3d4b616c4',
      '7f5d9778-61ef-40e4-aebb-b4a61d36347f',
      '060c2ac4-6fdf-40d2-83e8-f888143d35dc',
      '65b43b41-ec30-4e6c-bb62-89350773f592',
      '8f2aedd7-e4a2-40b8-98c0-22c027127390',
      '7de48d80-bca0-454b-b71e-71385ae9c6e5',
      '7dd25bf6-0e6b-40f2-b2f8-6f84541b781f',
      'd4513e91-e3b9-43ab-8e65-0d7d1580773f',
      'fc04797c-a678-4c56-b78a-0b8b8ec49cc1',
      'f2dae8e2-4d62-4f12-8765-1d93c1a03f6c',
      '7d74bb54-f22d-4594-8bc8-9d9710f88ac0',
      '6ef81403-6ac8-4aca-8842-8f004d6cbea2'
    )
    AND l.state = 'FL'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;   -- never publish without coordinates
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 12 THEN RAISE EXCEPTION 'BATCH FL guard: expected 12, got %', n; END IF;
  RAISE NOTICE 'BATCH FL: % rows', n;
END $$;

-- ===== BATCH GA (13 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      '9f3e2546-35b1-4aa4-a738-c98b944696e6',
      'a7ec52fe-a86e-44a8-ae48-cd48c12b68bf',
      'c46096bc-5104-421a-8170-22a88bfea17f',
      '27a1a923-bb4b-4022-bdd5-d0397249ed58',
      '7fd02b6b-eeae-4b06-8b67-50c3e9928fec',
      'f1d1bc65-60ea-43df-87b4-266985431b30',
      'f89415ea-400b-4f6a-954b-7e920013cf4a',
      '096dd2fe-80a1-441b-a700-dbea8e1455c2',
      'ee7f6f07-8fff-46dd-9e26-f10766f115a1',
      '36d48fe4-d2ce-4d99-987a-9e8341644b7a',
      '6bad6451-4f76-45b8-9a3b-4a1aad414f83',
      '28c41568-118b-4e1f-aee1-469f8a634af9',
      '4e347a10-336f-40d4-9ef0-e48a91eca38a'
    )
    AND l.state = 'GA'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;   -- never publish without coordinates
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 13 THEN RAISE EXCEPTION 'BATCH GA guard: expected 13, got %', n; END IF;
  RAISE NOTICE 'BATCH GA: % rows', n;
END $$;

-- ===== BATCH IN (6 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      'cf54cfb5-5556-4180-815e-ddeecc159719',
      'd7bc6a17-c3e3-408a-92a1-e403c30794a7',
      '43a04cd8-4924-4c2d-8404-1bb132180ce8',
      'cb0165c3-ad4e-448f-b5ea-7a87baef77a9',
      'b9aaf283-56ff-4714-a122-bff468dfc77c',
      '605eb2aa-f167-4118-b720-5e470775c93d'
    )
    AND l.state = 'IN'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;   -- never publish without coordinates
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 6 THEN RAISE EXCEPTION 'BATCH IN guard: expected 6, got %', n; END IF;
  RAISE NOTICE 'BATCH IN: % rows', n;
END $$;

-- ===== BATCH KY (13 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      'd9b21d1e-9b63-4247-a604-ba390a3bc630',
      'cf7673fe-5039-4d46-a2f3-3e677ab4d546',
      '076b546a-e264-4c18-abfc-bb32380ceaf5',
      '2e9b34a1-7c38-4a1d-92da-d2286d07976d',
      '54011c80-7ce2-44f4-b11a-f2b8985f9794',
      '104adff6-82d2-42b0-9d1b-1a8ef5b55a2a',
      '7d908a8c-749c-4c46-9c03-9c73ad7b7b36',
      '582280fa-d1b8-4e9f-aee1-575fa00b8e8a',
      'c4ad7a64-e08a-4c08-a883-277380ff7226',
      '60782b45-eee6-4dd1-89f2-83b16975bc81',
      '98e68fa9-34aa-446a-b6c4-f8fce0026b24',
      '5b586188-4b1d-455f-931c-8157582a9f92',
      'd6097cf6-67ee-4259-bd01-c63af2c6bc0f'
    )
    AND l.state = 'KY'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;   -- never publish without coordinates
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 13 THEN RAISE EXCEPTION 'BATCH KY guard: expected 13, got %', n; END IF;
  RAISE NOTICE 'BATCH KY: % rows', n;
END $$;

-- ===== BATCH NC (18 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      'b329619c-5f8f-4cdc-97f9-71cc089f535d',
      '38aadae7-1aa0-4cf4-a426-5d7659174852',
      'c01c6383-b1bb-4f29-815a-a9781159e490',
      'b9f278be-2aaa-4588-ba3b-843fe44fe91d',
      'd0b52ba6-cc9b-45c7-878c-ce598cbfaf24',
      '9b1575ec-7faf-47cb-b245-8d261efc12a0',
      'c8a6032f-6f28-430d-acc6-6fb11667529d',
      'cd88c617-b2ec-4c4e-80ba-6ba6f80de3fb',
      '469dadae-9ba0-4f80-aacf-eb83ca8efc25',
      '7c5326e4-da4c-4e5b-a0cd-48b3efd82863',
      '3ec4da2b-9df7-4bba-913c-c6023b9797ca',
      '8bb903e1-31e5-49e4-a4c0-26bfbb21cc7e',
      '7d2aff0a-c2d6-4a14-96d6-6fb5eee5aaa2',
      'e2d59ea7-f110-4411-809a-0cbce128191e',
      '0a0c7a0d-2fb0-4201-a93f-b934e2617b5b',
      '1339b41e-8930-4c32-a99c-832bffae406e',
      'b2bf2309-7ab1-402c-9edf-8d3fcd07cf48',
      'f4967041-7344-4787-9573-c5c7bdf7e538'
    )
    AND l.state = 'NC'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;   -- never publish without coordinates
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 18 THEN RAISE EXCEPTION 'BATCH NC guard: expected 18, got %', n; END IF;
  RAISE NOTICE 'BATCH NC: % rows', n;
END $$;

-- ===== BATCH OH (22 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      'e5b8447a-f9cd-4f17-a967-5531916edd12',
      '261a3522-4245-43c2-98c9-31a3856a7650',
      'bf442593-3ba3-4d1b-b752-64b98bbf4d0f',
      '1fabdfbe-abcc-4db1-b41b-dec1fa3d3fa7',
      '659aef3d-030d-4e6b-b626-74956b50d0b5',
      '8f05b35f-a63f-4345-a04c-fac2729ef302',
      '592fd7e2-c237-4e04-931c-ba3329687ed7',
      '02249e40-0250-4d39-8929-73504935f55f',
      '431cc9de-65e3-48ad-aed1-2bc3794f95ad',
      '00151f69-dcb6-4510-ac9e-19f6c5ba77a2',
      '253d5108-e1f2-4387-ad7d-b82e1a18712a',
      'de70c755-60b8-4e50-bf23-b807d3f7da97',
      '00da872b-f8e1-4216-87b8-2991147f166f',
      'fef1dd1a-90de-48ea-b494-e652fbb84715',
      '4be0bff5-6246-43d0-8501-159b1d07cf32',
      '12fa9201-e925-4e5c-8c73-6f1037cd4082',
      '48d81093-d807-4023-b971-9277d9f47cd8',
      'f12efc5b-1023-449c-b0b6-5b4df2dbadb1',
      '63337a0c-f3e4-4af5-ae0c-ba30923c6f18',
      '8e766083-c9ba-4102-a0f6-3615f14b3b54',
      '9acc0450-cc55-4324-92b7-85d68f4e4b0b',
      'f393fa83-15a7-4d7c-9f98-4440c77db4c8'
    )
    AND l.state = 'OH'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;   -- never publish without coordinates
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 22 THEN RAISE EXCEPTION 'BATCH OH guard: expected 22, got %', n; END IF;
  RAISE NOTICE 'BATCH OH: % rows', n;
END $$;

-- ===== BATCH SC (7 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      '4c1a72f9-a863-484e-ae1d-600e8bd8b7a0',
      'fa924e2a-0ffe-418f-851f-2f784856e91d',
      '9659739b-ba64-409b-9d90-e350b6c250ca',
      '5ad2354d-2ee0-42ab-b983-c07c9716e753',
      '8bf6630b-8c97-45c5-b219-f6b2e21d760a',
      'b621363d-e4d4-40c6-a04d-09e950264b12',
      '33dd16f0-9cfc-486e-822f-83fe6ecf8197'
    )
    AND l.state = 'SC'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;   -- never publish without coordinates
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 7 THEN RAISE EXCEPTION 'BATCH SC guard: expected 7, got %', n; END IF;
  RAISE NOTICE 'BATCH SC: % rows', n;
END $$;

-- ===== BATCH TN (14 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      'b22dba94-110c-4d51-8302-f220ef34a43c',
      '5d4edba9-0200-41ea-9b33-43cb436d42c4',
      '737b6683-853c-4c7c-9b81-30aadadb627d',
      '910b954b-022b-4076-90dd-ef5e144fa3ef',
      '50c54637-cbc4-4afc-95f4-10e946870d06',
      'e808cd20-757a-42c2-b9ed-fbf02e964b3e',
      '8954f3e6-074f-40a5-b8b5-d960808ab94d',
      '85a4e108-aa86-4a0f-8bd2-aa595ed5c6a2',
      'c041cd41-88dc-4a27-9533-4f5d11219fb7',
      '20055899-b195-49e7-ab99-e86cadf665e4',
      '48597a5d-b599-4e11-9826-eae4352b3e51',
      'e8bfa090-96d9-4462-99e7-72f277dce27b',
      'b1a240d4-a067-4094-83b1-6bd6fc63f308',
      '4212adfe-4234-48bc-aa89-73a1d0ca09a8'
    )
    AND l.state = 'TN'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;   -- never publish without coordinates
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 14 THEN RAISE EXCEPTION 'BATCH TN guard: expected 14, got %', n; END IF;
  RAISE NOTICE 'BATCH TN: % rows', n;
END $$;

-- ===== BATCH VA (5 rows) =====
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = true
  WHERE l.id IN (
      '8e79a54d-cad6-460c-9fd5-d5d118342bd3',
      '6da51cc0-fd95-4dd9-b43e-a677ea9ccec3',
      'be40a471-cbe3-4486-9c3d-daa610788abd',
      'f425a11a-845c-4f88-81d6-d805ee8ee0e7',
      'ebb8ad22-3283-4fc6-9918-66a8ef8ef9dd'
    )
    AND l.state = 'VA'
    AND l.is_published = false
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL;   -- never publish without coordinates
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 5 THEN RAISE EXCEPTION 'BATCH VA guard: expected 5, got %', n; END IF;
  RAISE NOTICE 'BATCH VA: % rows', n;
END $$;
