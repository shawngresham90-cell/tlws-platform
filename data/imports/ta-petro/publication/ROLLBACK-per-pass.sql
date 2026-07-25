-- Per-pass rollback for the TA/Petro full publication.
--
-- Reverts is_published true -> false for the rows of a chosen pass, one state
-- per guarded block (scoped by id AND source label AND is_published=true). Run
-- only the pass section you need to revert. Each block aborts unless it matches
-- its exact state count, so a partially-published pass is reverted safely.
--
-- Source label: official-ta-petro-20260725-5ebe0e9f. Exact IDs only. is_indexable never touched.


-- ===== ROLLBACK PASS 1: AL, AR, AZ, CA, CO, CT (46 rows) =====

-- AL: 8 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '4d83a5f4-3a68-4047-a6b3-cc2724e32ea3',
    '572fb3e7-00db-4124-be14-1973179305b1',
    '6f59cf8c-3082-4665-b028-278e5cabb48a',
    '83ce88cc-b0ba-48dc-b375-068ee3ffc107',
    '89efc304-db46-447a-8b9a-b83ab93b9d9c',
    '95a8fd44-581d-4dbc-b4db-0a12cfa04cbb',
    'aa22aebc-827d-4c44-afb4-98dd3be03ff1',
    'aa7af198-e51a-4d6a-ac33-dc29291321e4'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 8 then
    raise exception 'AL UNPUBLISH GUARD: expected 8, matched %. State rolled back.', n;
  end if;
  raise notice 'AL: unpublished % rows.', n;
end $$;

-- AR: 3 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '09c2f55b-774e-4670-8120-e8f282978c00',
    '6032ab89-70c9-4df4-9c05-9e2d1eee2485',
    'eac91b9e-1cf4-491a-82b0-4441bbd6f045'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 3 then
    raise exception 'AR UNPUBLISH GUARD: expected 3, matched %. State rolled back.', n;
  end if;
  raise notice 'AR: unpublished % rows.', n;
end $$;

-- AZ: 10 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '1722ae34-d370-4a32-b4d0-3ef0f6a1e6ba',
    '249a5cf2-c5e2-44f1-9acf-b2bf69642433',
    '3a717f8d-0255-42a0-980d-65edf384ee7b',
    '53eac1be-8c71-41fe-852b-d6515f065b06',
    '5868c989-c250-447d-85cf-a9838893ac86',
    'acb31a81-5cf6-43e8-b150-6625dfa38988',
    'de5add61-864c-41ee-9997-341c3c60a9b6',
    'dee1ea0a-e155-45cc-9d3c-6ef2af3bb10d',
    'ed302d2a-630e-48b8-8f94-7b9e75351624',
    'fbc89448-ea08-4d8c-8dfb-5aee3008f490'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 10 then
    raise exception 'AZ UNPUBLISH GUARD: expected 10, matched %. State rolled back.', n;
  end if;
  raise notice 'AZ: unpublished % rows.', n;
end $$;

-- CA: 13 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '17842fd0-024e-4687-b3d9-64fa8002cb9d',
    '20753bae-652d-4356-a30a-35aa1e2ade7e',
    '2b385a1b-f950-4410-8f87-2ee4a7d5fb71',
    '38b62428-c1d8-4e5c-9f84-22a9adb17469',
    '5853847c-19b3-4623-912f-4d965355ea1e',
    '5c4f1bd6-e79e-48b2-8d3c-b0cf4b91b934',
    '7220877f-0b69-4559-a7aa-175ab7e82c6e',
    '8a92c12c-7f82-40ca-8244-38a54f195999',
    '9c7bdf1a-fe83-41ef-a925-a73eb3c4d4a4',
    'ac2fb202-c39a-49e4-a1ae-fc78ab554009',
    'd58dbde6-582b-4601-8bbf-bd8999741f2f',
    'f522cc1a-d3b9-4b42-8e57-55f35c07fa69',
    'fb50e64a-1887-4db8-9415-2059d8b7ae88'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 13 then
    raise exception 'CA UNPUBLISH GUARD: expected 13, matched %. State rolled back.', n;
  end if;
  raise notice 'CA: unpublished % rows.', n;
end $$;

-- CO: 9 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '1af7e56a-9913-49a4-99c2-9ab5af0dcdb3',
    '5d30b5eb-cba8-4759-af08-66c1a63dced3',
    '6005b068-702b-42c9-9fcd-43c73359591d',
    '67812e7e-dcd5-4673-954d-4f4d783ba708',
    '72b9f7a6-7ee8-4498-b53e-6d3ef73fbfe1',
    '84c4403f-64c2-46e5-b2a5-bd39557d8f80',
    'bf0d01cb-2d92-4e53-9ccd-340cff7bfb4a',
    'c1b150a8-ae13-45ae-befe-b0b88dc676cc',
    'fdaa5d66-468c-4c9d-b7a9-98f4b976aba6'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 9 then
    raise exception 'CO UNPUBLISH GUARD: expected 9, matched %. State rolled back.', n;
  end if;
  raise notice 'CO: unpublished % rows.', n;
end $$;

-- CT: 3 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    'b1a810d9-fa26-4b9f-a829-7ff3a327a6ed',
    'e2294476-d094-44fa-85f2-88464d6fad92',
    'fa09d896-cd19-4d18-8362-ef5fa21d84be'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 3 then
    raise exception 'CT UNPUBLISH GUARD: expected 3, matched %. State rolled back.', n;
  end if;
  raise notice 'CT: unpublished % rows.', n;
end $$;


-- ===== ROLLBACK PASS 2: FL, GA, IA, ID, IL, IN, KS (50 rows) =====

-- FL: 4 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '8961b7bf-e704-4c95-b7aa-13e323b7feb5',
    'c8d42a99-8adc-4143-9db1-61eed3e986d6',
    'e73a19c9-8ec7-417b-9347-6df1177804ba',
    'f3ec3f7f-ca2e-48b0-9cbc-113b78a155ba'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 4 then
    raise exception 'FL UNPUBLISH GUARD: expected 4, matched %. State rolled back.', n;
  end if;
  raise notice 'FL: unpublished % rows.', n;
end $$;

-- GA: 7 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '15de1227-c048-4efc-9434-ac55e17356f1',
    '248c8882-cbfb-4e69-92a8-b229a54dceac',
    '3315aec6-1457-457d-a928-f2ac60c9601f',
    '5ef4d83d-9b81-40cc-b362-014183b69595',
    '8f93fd04-a71e-4c59-8bbe-9c6bcd23f1fe',
    '95054be6-8ab3-4994-a0bf-92f85087cf2f',
    'e32efb95-b1ab-4a54-a931-c6eb071a8448'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 7 then
    raise exception 'GA UNPUBLISH GUARD: expected 7, matched %. State rolled back.', n;
  end if;
  raise notice 'GA: unpublished % rows.', n;
end $$;

-- IA: 6 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '2ffca043-b2bc-4895-b9fa-0453057840c4',
    '3e8796c6-77f4-4c8c-9832-e46e040689c5',
    '56e288be-090e-435c-982a-7d7355c5e464',
    'cf1c022a-77d9-42a4-996a-4f012c353ed0',
    'e2956773-d29a-4270-8bc7-f041a78c34f8',
    'f97e88cd-9e27-4e36-9b20-777bd710ed92'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 6 then
    raise exception 'IA UNPUBLISH GUARD: expected 6, matched %. State rolled back.', n;
  end if;
  raise notice 'IA: unpublished % rows.', n;
end $$;

-- ID: 2 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '0c347f93-9185-4cd7-89d6-a411df092ced',
    '8b16110b-263b-41f1-81f7-f05a3c028b11'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 2 then
    raise exception 'ID UNPUBLISH GUARD: expected 2, matched %. State rolled back.', n;
  end if;
  raise notice 'ID: unpublished % rows.', n;
end $$;

-- IL: 12 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '2b72144a-269f-4d29-b6fe-0b9068ee7a37',
    '2e1fe245-218d-4632-bdd4-4b320d69eba1',
    '3e613b47-7f44-420d-b839-01e19ad138ab',
    '670336d0-8400-4a92-a882-d5be882b83cc',
    '7910dd09-6b8f-41da-a86b-1bbf6d07ee5c',
    '8cb6b807-56bd-4e9a-8602-614ce19e1fc1',
    '8cf8aaf4-ffe0-46b7-b6b7-2965c93d4ba4',
    'b4676e5b-415d-49ad-89fc-54093a291c67',
    'b98f412b-81ce-42ac-8977-adec80ca53ec',
    'c2856021-e58e-432f-a0e1-b909d41f2ce9',
    'c5ec9b22-8675-4047-8b0f-f80dbfc0b218',
    'cbd7c985-75b5-4368-8bad-35d4c52784b0'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 12 then
    raise exception 'IL UNPUBLISH GUARD: expected 12, matched %. State rolled back.', n;
  end if;
  raise notice 'IL: unpublished % rows.', n;
end $$;

-- IN: 9 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '27a3e6fd-17cb-4f9d-8047-c0170c2d5783',
    '27d37d5d-0313-44e4-9f0e-86cb7f2b0db5',
    '34a70d3b-0b4b-46d5-8bbf-50053ee3e4de',
    '3c7f74fd-3ec0-4334-866d-21185e736f28',
    '5b9f3833-3c26-446a-9911-2a2470d265f5',
    '7e566af4-17cc-41e7-844b-7dcb0f755df3',
    'cad3881e-22a2-46e5-a77d-84dd18c7d261',
    'e5a53a41-d491-48fa-a73f-00c545239b16',
    'f4cbbe52-930d-4e01-8359-f695d521df60'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 9 then
    raise exception 'IN UNPUBLISH GUARD: expected 9, matched %. State rolled back.', n;
  end if;
  raise notice 'IN: unpublished % rows.', n;
end $$;

-- KS: 10 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '3b91ee32-c27c-4e8e-a560-e3f10a921715',
    '4490055a-aec0-4b26-bfb7-6fbcabf72904',
    '676a342f-b814-4485-8538-4c9c01069ab2',
    '6f7a664a-0574-4de1-8acc-7de5a8371ba8',
    '821c8dbb-5e52-4920-96a1-9d98bbeeaa8b',
    '8bdfa9b4-b6d9-4ad3-b282-c310238260a6',
    '98bf5e1e-ec9e-4632-8c0e-637117ea9e4a',
    'a5223dac-4a03-472b-bf5b-166870745bce',
    'b388395a-7ff7-4a2f-b6d9-7d5451513972',
    'ed7e8f37-c9cb-43dd-a4bd-0d2f7edc1d46'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 10 then
    raise exception 'KS UNPUBLISH GUARD: expected 10, matched %. State rolled back.', n;
  end if;
  raise notice 'KS: unpublished % rows.', n;
end $$;


-- ===== ROLLBACK PASS 3: KY, LA, MI, MN, MO, MS, MT, NC, ND, NE (52 rows) =====

-- KY: 3 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '2bde784a-0feb-43ca-bd29-8bb461612903',
    '409390ee-aca9-4f0f-8f46-56675e324adc',
    'ce461491-1e00-4179-92b7-126cd264a7f3'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 3 then
    raise exception 'KY UNPUBLISH GUARD: expected 3, matched %. State rolled back.', n;
  end if;
  raise notice 'KY: unpublished % rows.', n;
end $$;

-- LA: 12 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '04ba7dbb-2a5b-4a1c-8b2a-f55a2025e4ad',
    '0d926d31-2fa5-4ef2-9101-1b9e074c8495',
    '1e8f2e34-9b2b-40a2-9ae6-40a2062651b5',
    '32031c1e-0d62-46a2-94e5-7f0d4ea4a6e9',
    '467704e4-9578-4109-a37c-6f035359f6b4',
    '4ba96d81-95a1-46a5-afaf-78678c45d232',
    '5a3d5ca7-5e82-4e44-a1c3-725da6ecfeb4',
    '6f39b35c-812e-4818-b251-8470c223e06f',
    '8ebaa65f-063e-4c52-abeb-a3a53820927c',
    'd252527d-20a8-4459-a44d-63c668ff30b9',
    'd964745d-fcae-4925-88bb-52ba116e655d',
    'db388573-84aa-42ca-ba18-40922752d573'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 12 then
    raise exception 'LA UNPUBLISH GUARD: expected 12, matched %. State rolled back.', n;
  end if;
  raise notice 'LA: unpublished % rows.', n;
end $$;

-- MI: 4 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '92690d91-86e8-47bf-9a48-647aaa6140d0',
    'ba06c4b9-ca65-4489-92df-4f01e1643299',
    'bef45037-3843-49ae-9a3a-31ad5f47857e',
    'e7e9af27-8e8d-4c63-9c1d-ea303d8773df'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 4 then
    raise exception 'MI UNPUBLISH GUARD: expected 4, matched %. State rolled back.', n;
  end if;
  raise notice 'MI: unpublished % rows.', n;
end $$;

-- MN: 4 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '2b5ef8ac-3b7a-430e-b750-ba5603f2d016',
    '9fc68613-b774-4b5e-bee0-ad9bf1893a65',
    'def9df5b-c34e-4689-91fb-2f00a07df238',
    'df1df6b9-0dc3-4928-a66d-6c84da588283'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 4 then
    raise exception 'MN UNPUBLISH GUARD: expected 4, matched %. State rolled back.', n;
  end if;
  raise notice 'MN: unpublished % rows.', n;
end $$;

-- MO: 12 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '136b5207-6f2a-41bf-8132-0896ddb2a9ae',
    '17af745f-ea45-4e29-aaee-bd16903a3748',
    '41b1adce-ca72-4792-bbfc-ddacda862291',
    '486d3f65-047c-4625-a09a-b18aacde7cb8',
    '4cb52e15-221b-4692-b8b7-7d079d2abafb',
    '6a98e38a-7607-4995-a6a0-0223bea186e5',
    '8354b718-2894-40f8-aab9-f41d85b5e6af',
    'a6a22e48-5661-4c5c-a35c-719586116621',
    'b67f5fd5-e9ff-40a9-b666-a2ed01b51dd1',
    'c5babc9e-53d3-491c-94d4-e2f426743d95',
    'd99bc2b5-9cd1-44ac-ac35-a50d38e140db',
    'e6c7f853-921d-4df2-bddc-992a821a8ac1'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 12 then
    raise exception 'MO UNPUBLISH GUARD: expected 12, matched %. State rolled back.', n;
  end if;
  raise notice 'MO: unpublished % rows.', n;
end $$;

-- MS: 4 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '13a6bfd0-c9b2-408e-b422-5135086846a9',
    '18e05b55-8bc4-41bc-85e1-7175d735559a',
    '79ed9b27-cfef-49ff-acd0-04e7965ba5e4',
    '8fa6268e-9d60-4ae3-aa8e-e48541e0c976'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 4 then
    raise exception 'MS UNPUBLISH GUARD: expected 4, matched %. State rolled back.', n;
  end if;
  raise notice 'MS: unpublished % rows.', n;
end $$;

-- MT: 2 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '0e36423d-5940-4c06-b144-7635400be38f',
    'd416036c-c939-45db-81ab-fb282cbe0383'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 2 then
    raise exception 'MT UNPUBLISH GUARD: expected 2, matched %. State rolled back.', n;
  end if;
  raise notice 'MT: unpublished % rows.', n;
end $$;

-- NC: 3 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '216cd4e6-5b52-4658-82dd-9e781d935166',
    '22e0f5b9-e72b-44aa-b29e-8f453e4501a7',
    'd3adcae1-fdab-496c-8b41-6a7d1333603b'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 3 then
    raise exception 'NC UNPUBLISH GUARD: expected 3, matched %. State rolled back.', n;
  end if;
  raise notice 'NC: unpublished % rows.', n;
end $$;

-- ND: 5 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '0873b4fe-f874-49a0-a217-7fe10dd3370a',
    '2e035156-5cb9-4463-a8c6-b92c92af911e',
    'd879ad53-039a-453f-bdc4-45286e20988f',
    'ea832d1e-20f8-4404-be52-d29baaea1404',
    'ffa7bd90-81ef-43a2-a224-fa5c520503ad'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 5 then
    raise exception 'ND UNPUBLISH GUARD: expected 5, matched %. State rolled back.', n;
  end if;
  raise notice 'ND: unpublished % rows.', n;
end $$;

-- NE: 3 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '28318499-0eaf-4b76-9f4f-ae01cb8396a0',
    'b510ec16-bc73-41d0-a0ef-9ebd47ffc3da',
    'b5d08f45-45b1-4a20-8fc0-f1b829117674'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 3 then
    raise exception 'NE UNPUBLISH GUARD: expected 3, matched %. State rolled back.', n;
  end if;
  raise notice 'NE: unpublished % rows.', n;
end $$;


-- ===== ROLLBACK PASS 4: NH, NJ, NM, NV, NY, OH (43 rows) =====

-- NH: 1 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    'f3940f82-c33c-4372-b2bb-ce4a1be2cb88'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'NH UNPUBLISH GUARD: expected 1, matched %. State rolled back.', n;
  end if;
  raise notice 'NH: unpublished % rows.', n;
end $$;

-- NJ: 4 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '00142022-f6dc-4fed-a554-306eec23afe7',
    '9199ed34-10fc-4c7e-b97e-1f4064d0563d',
    'a68a2f81-f86a-4a31-9d44-bd984bd5cc4f',
    'ab9e6216-ab0e-4061-9e9d-4ec995e335dc'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 4 then
    raise exception 'NJ UNPUBLISH GUARD: expected 4, matched %. State rolled back.', n;
  end if;
  raise notice 'NJ: unpublished % rows.', n;
end $$;

-- NM: 8 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '143b958b-df45-4a6b-aca0-533fc2ffc3c4',
    '55e1fb1c-c301-4318-b159-5bae49b9388d',
    '811fb0fb-5059-42cf-a5e6-6f4bf08cd8c2',
    '9242379f-96b4-406f-a847-ed6a71d2a0f7',
    '94e95243-640b-413e-8a5a-788c0a0852ca',
    '96c08424-b705-4f6f-8a87-b3fb4ad8d89c',
    'ec2a4c60-2aaa-4b5c-b4d2-e04d8307cbce',
    'fb867211-3593-446d-9cc9-4928efef2181'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 8 then
    raise exception 'NM UNPUBLISH GUARD: expected 8, matched %. State rolled back.', n;
  end if;
  raise notice 'NM: unpublished % rows.', n;
end $$;

-- NV: 10 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '1f675baa-f7da-4b99-a416-a43d9e88d9f4',
    '2c6c4a86-6341-4e33-9bd2-bb3734f18f2c',
    '4f266277-7d26-4c13-a2da-ca6f912ae326',
    '55c93d34-4a3e-4b19-9dd3-0dfc01ad5886',
    '66ceee09-494c-4084-b160-7df39a9a0370',
    '704ccbb5-06de-46c0-9df7-88bcb9230865',
    '7d1a9974-1ea2-4db1-aa2e-d2588cc9a771',
    '8e8fa590-7cde-453b-a475-2c491bdef58c',
    'c67c28f5-002d-453e-bda9-c110ce9999db',
    'e28ef446-e1d5-4cc4-bef5-a83cf583e4bb'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 10 then
    raise exception 'NV UNPUBLISH GUARD: expected 10, matched %. State rolled back.', n;
  end if;
  raise notice 'NV: unpublished % rows.', n;
end $$;

-- NY: 7 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '0ac6d1c9-ce7e-4b42-ac1f-53c4d65b2cc3',
    '2d1fa3cc-ebe8-42a5-9754-540224c38300',
    '6da62e0d-e7be-40ef-bb6f-e75f81eb9054',
    '774f19f9-32b2-49e8-b951-5d6c6be8cd42',
    '880237bc-4555-463c-af2c-d3ab372abadd',
    '9e057575-35d7-461f-81f6-6f21f12bae73',
    'defd2a11-d531-4614-90fe-c21b5b852864'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 7 then
    raise exception 'NY UNPUBLISH GUARD: expected 7, matched %. State rolled back.', n;
  end if;
  raise notice 'NY: unpublished % rows.', n;
end $$;

-- OH: 13 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '05b1d3b3-93d3-42f7-a0d5-1b45868350f0',
    '3032b5f3-fdf5-498d-92bc-25bf2b05dfda',
    '46df0896-0192-4056-b62d-de7b1eb9fc7b',
    '5d0a8618-d22f-4b27-85d5-f9f034e0a566',
    '652d5e4b-4230-4be2-bee5-b1eaae5100d9',
    '67913b24-ea64-44e3-96ae-50bd2cad8211',
    '7b4584a4-a7d4-442f-8a7c-c6c669f77792',
    '9cd8d49c-66ba-4b0c-8949-9b7b4630c5c5',
    'b41b468e-60f2-4ddd-a09e-1c94fd8ff498',
    'b844db40-161f-40fd-8acb-36724c188e8c',
    'bc4f3d5f-2d97-4d63-a7d1-54319568d691',
    'be303508-8e10-4e3f-8a20-d2921e976019',
    'c6501867-ea15-4d24-974f-b8ccd6bd22da'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 13 then
    raise exception 'OH UNPUBLISH GUARD: expected 13, matched %. State rolled back.', n;
  end if;
  raise notice 'OH: unpublished % rows.', n;
end $$;


-- ===== ROLLBACK PASS 5: OK, OR, PA, RI, SC, SD, TN, UT, VA (45 rows) =====

-- OK: 7 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '14ce47e2-b0a6-496c-b609-c42de9de30bf',
    '3729868d-bde5-4715-a127-21130d19ef10',
    '6f153a3e-d48c-4d1f-a797-d429eacf7cf7',
    '910e886c-8f9e-49c9-915e-1309a65ef8cc',
    '950f61ef-9576-43b2-a466-67f1dc72f17e',
    '97ac5fed-e286-4c86-92eb-d74680569d7c',
    'f6ed705a-0762-4c1d-8e1b-6ae6ff283649'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 7 then
    raise exception 'OK UNPUBLISH GUARD: expected 7, matched %. State rolled back.', n;
  end if;
  raise notice 'OK: unpublished % rows.', n;
end $$;

-- OR: 6 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '1c2e6308-f237-48f2-9a75-45b9ec4ad747',
    '3930709c-24ab-4805-946a-070fa9753645',
    '812e90fb-f2de-4a3d-b608-6c180fb49ccd',
    '91a2474c-f971-4634-97a0-da712ea5a073',
    '976ccdf0-4db6-4fec-a760-0aecfcadb309',
    'f541220b-09e6-4690-bc0c-ec7e19fc6a5b'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 6 then
    raise exception 'OR UNPUBLISH GUARD: expected 6, matched %. State rolled back.', n;
  end if;
  raise notice 'OR: unpublished % rows.', n;
end $$;

-- PA: 13 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '0a9be4f1-72f1-46e8-8858-c4096156df61',
    '18af7741-cdbf-49dc-82e2-b4cb9eb93868',
    '28e8ed02-5c3b-47ec-962b-a10303cca0dc',
    '332e4737-2cd9-4f02-b7c1-d1e62f2f60fa',
    '58eed292-c064-47fe-bcae-3c53e1759038',
    '5a3d40c4-0ae9-4858-88d1-c6587f3cc128',
    '73687504-efb0-413a-8866-f2c767134470',
    '73b74559-cfa0-4283-b8b7-4cf7bd99ab46',
    '800e86f8-a7f5-4761-9a77-6b6a12ee662d',
    '90c056f0-049f-4625-9a86-839e13a27380',
    'bca82ad8-d579-48ac-a7bd-a8d6aa6ee5e6',
    'c5a3c53e-3f30-4902-b41c-3d2fd1745c0d',
    'fee3dcbf-8796-498d-9abc-a42c240a1443'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 13 then
    raise exception 'PA UNPUBLISH GUARD: expected 13, matched %. State rolled back.', n;
  end if;
  raise notice 'PA: unpublished % rows.', n;
end $$;

-- RI: 1 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    'd65aef14-449b-4f7d-8e58-07ac6dfb1350'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'RI UNPUBLISH GUARD: expected 1, matched %. State rolled back.', n;
  end if;
  raise notice 'RI: unpublished % rows.', n;
end $$;

-- SC: 5 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '081aef9c-5527-4c10-b1af-d2d753c4d14e',
    '4cbcf0de-5ef2-4609-9c62-7eb9014508b5',
    'ad4f8b95-806b-4915-8c0f-b3891d426bba',
    'b218282d-ef85-4141-a735-625a10f3f181',
    'd44c1a38-3b26-41ae-85b4-1eca0df8cfeb'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 5 then
    raise exception 'SC UNPUBLISH GUARD: expected 5, matched %. State rolled back.', n;
  end if;
  raise notice 'SC: unpublished % rows.', n;
end $$;

-- SD: 3 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '461f0ad8-e0b1-472e-a740-d8a31dd83d2a',
    '779e8a21-0220-4f69-9af5-b2d7f2c53830',
    '881711e7-c677-4935-99e2-f241d0138914'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 3 then
    raise exception 'SD UNPUBLISH GUARD: expected 3, matched %. State rolled back.', n;
  end if;
  raise notice 'SD: unpublished % rows.', n;
end $$;

-- TN: 2 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '24a18b2d-3432-48a7-91ea-9e6986c566ed',
    'd4f0ad44-9364-4e50-9f8f-0e47a6637cf0'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 2 then
    raise exception 'TN UNPUBLISH GUARD: expected 2, matched %. State rolled back.', n;
  end if;
  raise notice 'TN: unpublished % rows.', n;
end $$;

-- UT: 3 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '1f2fce58-e15f-45e8-986c-989e8116ad30',
    '8d8e01b6-06fe-4775-957d-4c24d49500a2',
    'e363ff42-1221-47e2-8ad5-43d1003fd317'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 3 then
    raise exception 'UT UNPUBLISH GUARD: expected 3, matched %. State rolled back.', n;
  end if;
  raise notice 'UT: unpublished % rows.', n;
end $$;

-- VA: 5 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '3926b89c-55a6-4de4-9a5e-d867729e0304',
    '655676ad-c86b-483c-9df8-e80dd24e90d7',
    '85b076b4-dccc-48d5-b119-5b1d2843b358',
    '9f0e3d73-4329-4da6-8417-454d3f65bec9',
    '9f855b14-f665-4612-af50-2e6d14ab0216'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 5 then
    raise exception 'VA UNPUBLISH GUARD: expected 5, matched %. State rolled back.', n;
  end if;
  raise notice 'VA: unpublished % rows.', n;
end $$;


-- ===== ROLLBACK PASS 6: WA, WI, WV, WY, TX (58 rows) =====

-- WA: 4 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '7eda1356-1bc5-42c9-831a-bf5205ae4ef4',
    'ac439c50-e673-403d-ba71-2cc121f66204',
    'c9e79215-06cd-4057-9563-8ebee52f3f63',
    'faa6f12f-84f6-49ff-93c6-f2edd5248ccc'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 4 then
    raise exception 'WA UNPUBLISH GUARD: expected 4, matched %. State rolled back.', n;
  end if;
  raise notice 'WA: unpublished % rows.', n;
end $$;

-- WI: 7 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '103277c8-ef2d-4c03-8454-49020ed7d271',
    '33639f44-8f76-491b-8a0f-4feeccb24cb7',
    '4edbc14a-d5b7-4a30-bba9-3eb99ed2a3b7',
    'c1b46983-d4cb-4a2d-ac4b-6db925770586',
    'cf841c5e-1e5a-49e5-927e-190fae5d6c05',
    'd2a9add5-27c1-412f-8635-fe85fd97f812',
    'd95026e2-c51b-4d0e-b5f7-fec32c63fdc3'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 7 then
    raise exception 'WI UNPUBLISH GUARD: expected 7, matched %. State rolled back.', n;
  end if;
  raise notice 'WI: unpublished % rows.', n;
end $$;

-- WV: 4 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '83d598f6-d049-46d5-8a43-2fff1d2edb5b',
    '98d364ee-a930-4e1d-94d3-aabf020ba0b5',
    'c6daf923-a5f7-43fe-8809-2fc32bb9267c',
    'dd8d6960-1a16-4612-9482-71c3f8966f0a'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 4 then
    raise exception 'WV UNPUBLISH GUARD: expected 4, matched %. State rolled back.', n;
  end if;
  raise notice 'WV: unpublished % rows.', n;
end $$;

-- WY: 4 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '270ef64e-2759-404f-a315-9762341e1f80',
    '416175cb-4cf3-41b8-a73a-faf66a24d238',
    '7e4cb477-0965-4353-94b1-b2702a5bf302',
    'e990a211-f23e-4ab1-b747-52a3b1f998da'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 4 then
    raise exception 'WY UNPUBLISH GUARD: expected 4, matched %. State rolled back.', n;
  end if;
  raise notice 'WY: unpublished % rows.', n;
end $$;

-- TX: 39 rows
do $$
declare
  n integer;
  ids uuid[] := array[
    '03244367-3119-4814-87e4-053e41911e9f',
    '03b29085-9803-43d1-969a-60f9d0013202',
    '0d485be0-bd40-49ad-9ad5-763719c9e05b',
    '0e68e425-6312-4c84-8e84-f91e0fa03696',
    '0f6185fb-0880-4b6a-8ffa-8e49d42dbb1c',
    '28731d9f-ea62-46be-8652-75aa1c6cea5f',
    '2c0bdf31-3c30-4841-b0e4-04f6c577b11a',
    '2eeab937-c31d-4291-af4d-6980dddfe85e',
    '3b3f3419-87b3-41c4-ab43-0f6ea76caca5',
    '3b62fd6b-6f93-4293-a098-7444d1dfab12',
    '3bb601de-cc55-456a-9b47-f2858fc61139',
    '46e2a1b3-e880-49d5-8c06-56a0c86775ab',
    '487fc933-b573-4576-92b6-e8afa9e772fd',
    '4de4fa9f-d845-4da4-811a-9143d0510533',
    '4e2f34ee-9123-47fd-8479-60fea56bdd8b',
    '51523c99-d4c4-4da6-afb4-6be3c338472b',
    '54898d88-9b51-4d99-b92c-fc4170d68faf',
    '5c4e6e30-8e3f-4744-9ebf-492e1133a2d0',
    '61dfec81-1296-4a53-a4b0-e2c3aa1c3175',
    '731b7615-d350-4d42-aa87-6ae2d0754ff4',
    '7c063466-49a8-4354-b20a-dfcaf86e524d',
    '7e00b614-a4ca-4769-ad75-27a663684329',
    '834a29f2-963b-4f55-8567-9bd99ac5f806',
    '89a0194f-b908-46bd-87d7-722f881e16d6',
    '9827b776-6ef7-4853-aa88-b0989dee9ddf',
    'a1dd255a-8a8b-4dc0-8568-ba8ac37ee80e',
    'a25b0c0d-12c7-49ad-b03b-fbc75c382244',
    'a352788b-7de6-4a22-b4db-a0579f467d2c',
    'a793c66a-9219-4646-b295-ee6bee94cae5',
    'b80df7c1-c1ce-4031-bb79-e597454cd22e',
    'b940af68-43e4-4fa6-b56c-8b4636b66149',
    'c930f79c-58e6-4108-8aab-2c3ef3ed512c',
    'd38955c0-2208-4277-a897-473f8b73d677',
    'd5617606-2f27-451a-b250-a2e9ca0dc58b',
    'de8176bc-1fa0-493b-b0f9-15a307b0b746',
    'e205c7b8-8a50-4443-a26b-7a955788b922',
    'f1ac4d06-e831-4614-9338-a5a5f1d36e39',
    'f4352f4d-70ef-4383-b568-1294d1887a5c',
    'fb7c5f36-922e-47d6-b322-957aa069090f'
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(ids)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 39 then
    raise exception 'TX UNPUBLISH GUARD: expected 39, matched %. State rolled back.', n;
  end if;
  raise notice 'TX: unpublished % rows.', n;
end $$;
