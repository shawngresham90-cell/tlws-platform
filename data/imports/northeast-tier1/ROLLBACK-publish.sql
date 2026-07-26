-- ROLLBACK publish: is_published true->false for exactly the 14 rows.
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.locations AS l SET is_published = false
  WHERE l.id IN (
      'fed4a341-e7ca-4020-b95e-11a589f9d537',
      '18df2837-56f3-4b52-9360-d625614d0910',
      '4795b25a-2bb2-4c4e-ac29-d864159cb3f3',
      'a8c03a61-df69-466d-bbf3-9bde66a34005',
      '84a7fdb0-85d9-47e2-a615-c507033be742',
      'ebeeef84-4ab8-478a-a46a-3e07a9b29ff3',
      'ae5c7f98-3827-4f30-a664-af01f578db47',
      'fdc35482-6e2a-44a5-8d70-e976883b9f25',
      '44ef662c-3372-40a8-9c5b-eb2f0c76fc2c',
      '5046a85e-6a9a-49e8-aedd-ab29f95b00d1',
      'e45cdd5c-1081-4859-b540-5a800714c6f9',
      '1c2331c1-e7c3-4f1c-8080-8c77e26ca570',
      'f1e6af7b-d118-4bae-b8f0-5211efc8131e',
      '58dc0ef3-dc55-42ec-9b42-3ddcad197aa8'
    ) AND l.is_published = true;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'ROLLBACK publish: % rows', n;
END $$;
