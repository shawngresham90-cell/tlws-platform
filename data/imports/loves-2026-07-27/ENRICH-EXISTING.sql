-- Love's enrichment of EXISTING rows — GUARDED, blank-only, exact id.
--
-- NOT EXECUTED. 62 rows, all of them the `truck-stops` record for
-- a Love's site. THE MAP-PIN RULE: only this row receives a coordinate. The
-- 62 colocated CAT scale / truck care / truck wash rows at the same
-- addresses are reconciled in COLOCATED-SERVICE-ROWS.csv and deliberately get
-- NO coordinate, so the collision guard is never weakened and the map never
-- shows two pins for one site.
--
-- Blank-only: refuses to overwrite a coordinate that already exists.

begin;

create temporary table _enr (
  db_id uuid primary key, source_ref text, lat double precision, lng double precision,
  interstate text, exit_number text, parking_spaces int, overnight boolean
) on commit drop;

insert into _enr values
  ('d7f9bcc5-6dd2-4bc5-aa45-004414540bf2', '271', 35.511466, -93.822309, 'I-40', '37', 18, true),
  ('88873aca-7462-45e9-bbe1-a9ebaa15cf60', '822', 35.460073, -93.480111, 'I-40', '57/S Crawford St', 114, true),
  ('eb21f83a-5ec0-4447-b261-6ecb564187c7', '267', 35.172923, -92.743251, 'I-40', '107', 37, true),
  ('d33bd5af-db05-4f0b-a829-7db826c27a96', '236', 34.786217, -92.125573, 'I-40', '161', 68, true),
  ('b5d906d6-22c5-4ed5-b39e-b8eea589346d', '759', 34.815314, -91.567393, 'I-40', '193/US Highway 63', 132, true),
  ('8fbdb2db-5a92-446e-97c8-fd0473a6a2a8', '275', 34.986489, -90.905235, 'I-40', '233', 90, true),
  ('9615e271-6080-44ba-bb9a-94ee75384e83', '450', 35.153922, -90.138293, 'I-40', '280', 96, true),
  ('6c5d6f67-da95-4378-a089-72e6b7a307c4', '244', 35.679204, -88.74243, 'I-40', '87 @ Hwy 70', 108, true),
  ('4e060c6a-1fab-4808-928a-bd991bf8f694', '791', 35.840559, -88.081783, 'I-40', '126/Hwy 641', 125, true),
  ('e602551b-092f-4d03-9417-03c6196ca4eb', '369', 35.99203, -87.48819, 'I-40', '163', 106, true),
  ('cdeb1524-21ed-4454-9667-4b4781f3e8fb', '346', 35.643953, -86.891465, 'I-65', '46', 80, true),
  ('1f6e7f3a-9e20-4a57-8eae-d44d24a80243', '429', 36.205575, -86.771637, 'I-65', '87', 58, true),
  ('e862ec83-1ad2-4128-90dd-2cb529a71c79', '629', 36.467853, -86.687413, 'I-65', '108 @ Hwy 76', 83, true),
  ('12cb5734-b6f3-48d8-adc1-71b693367a2a', '877', 34.129181, -86.864036, null, null, 82, true),
  ('9d0ebd15-c261-4702-a709-a7828d639a9d', '624', 30.742, -88.1108, 'I-65', '8', 73, true),
  ('08e36b89-6dee-438f-bd37-edf4a6eab784', '368', 32.844151, -86.591963, 'I-65', '208', 65, true),
  ('4487c8c2-b9dc-4b24-bf94-e18b76de138e', '225', 31.419105, -87.00765, 'I-65', '93', 148, true),
  ('5f922ea7-ad01-4fff-aa2e-33a9d2cf1177', '330', 36.139694, -85.63023, 'I-40', '280', 120, true),
  ('b3f396e1-8990-4df2-9cd8-b0c8d353d66c', '718', 32.19624, -86.415235, 'I-65', '158/Tyson Rd', 85, true),
  ('76e36705-8140-4902-8922-1ae83351ce7a', '874', 40.452717, -86.850201, 'I-65', '175/IN Hwy-25', 64, true),
  ('f6502eed-0e6a-40c4-a5df-d5a0068ef809', '459', 39.979492, -86.395742, 'I-65', '133', 90, true),
  ('1822b81f-648c-4711-a265-fe1800ccb423', '451', 39.551539, -86.044627, 'I-65', '95', 70, true),
  ('786bf473-2404-4915-bd74-a05c7c07989a', '417', 41.561796, -87.35664, 'I-94', '9', 154, true),
  ('08d24d71-a131-473b-9ffd-cc56b92b5466', '364', 35.290197, -84.817591, 'I-75', '33', 85, true),
  ('15f5c84b-8284-455e-8928-c688f5a308ab', '735', 34.443856, -84.915181, 'I-75', '310', 93, true),
  ('a45b0906-ec99-4785-bfd6-afae328bc2aa', '359', 34.118857, -84.743165, 'I-75', '283', 93, true),
  ('0b49a63f-9886-4ac2-a547-81b6ecda5d6f', '861', 35.732785, -84.400061, 'I-75', '72-SWC', 102, true),
  ('d58e3dbf-f1ed-4822-adf6-94841a1a7c64', '480', 35.872378, -84.32321, 'I-40', '364', 100, true),
  ('b67852b7-a14e-43d2-b786-b8536fed05d5', '618', 38.379493, -84.572583, 'I-75', '136', 80, true),
  ('d02cc1cc-ddec-4108-b686-69b43432bcca', '291', 37.84322, -84.324537, 'I-75', '95', 63, true),
  ('703372a3-ddb0-4201-b738-cab8ded1a1cf', '321', 36.977491, -84.116242, 'I-75', '29', 90, true),
  ('4c23e030-e4d3-473c-a3b8-cfafc1599bc4', '307', 33.208091, -84.05852, 'I-75', '201', 40, true),
  ('37c4007f-e708-43e7-9ec3-42a933595dfa', '747', 40.265328, -84.186013, 'I-75', '90/Fair Rd', 130, true),
  ('849b2949-0caf-4874-9c23-e1c79c2ecf35', '796', 35.970619, -83.247821, 'I-40', '432 EB / 432B WB', 95, true),
  ('ed2d89b5-609b-4e0e-91fa-bde1dbd93533', '698', 32.717528, -83.733418, 'I-75', '153/Sardis Church Rd', 119, true),
  ('f4591f0b-087b-4856-8957-5a7e020fa209', '801', 31.975579, -83.758552, 'I-75', '102/GA Hwy-257', 92, true),
  ('ce2b1d46-bc97-4dd5-8006-b3f0877740b5', '356', 41.17372, -83.65167, 'I-75', '167', 65, true),
  ('6dbef08c-6306-4db2-bccf-5da49a0a2ac8', '325', 31.415715, -83.503054, 'I-75', '59', 115, true),
  ('7b969fa7-19c1-4bd2-b0c5-9663b9007464', '308', 35.657872, -81.96337, 'I-40', '86', 48, true),
  ('371724fa-2260-4d55-bbc7-0ddeeb680138', '550', 30.774407, -83.298368, 'I-75', '13', 112, true),
  ('bd6dadb7-6053-4d42-a0e9-028f9d319b5c', '645', 41.964765, -83.345143, 'I-75', '18/Nadeau Rd', 85, true),
  ('8e2421bd-15c8-49f2-8442-874641d24719', '743', 43.348709, -83.861776, 'I-75', '144', 102, true),
  ('493f87f4-8dca-4681-9d42-1da6c4646855', '470', 30.452116, -82.933564, 'I-75', '451/US Hwy-129', 118, true),
  ('c9ebaa0f-5ca1-44d9-91c3-1965fdd9f9a4', '724', 30.002627, -82.598483, 'I-75', '414/US Hwy-41/441', 106, true),
  ('89c2531c-300b-4d19-b9f8-e4f065f2d605', '338', 31.960662, -81.331564, 'I-95', '90', 140, true),
  ('a7cd01f6-bc31-4983-8bb6-89a2d6360e0f', '893', 32.103201, -81.194401, null, null, 97, true),
  ('cb44453b-2e91-403c-b840-fa0ebe9c211e', '405', 31.137752, -81.571797, 'I-95', '29', 78, true),
  ('b2af1bed-36cf-4497-8e3d-d2c2209fca12', '740', 32.705457, -80.874488, 'I-95', '38/Hwy 68', 52, true),
  ('29e9199c-a535-47dd-8d12-887485484bc3', '828', 30.463245, -81.673875, 'I-295', '33/Duval Rd', 77, true),
  ('8c6afd87-8cac-4a4e-9490-fae510386cdf', '603', 30.516861, -81.632633, 'I-95', '366', 82, true),
  ('a5c289a1-177f-479f-9e18-84571c3d8190', '790', 33.591813, -80.355763, 'I-95', '108/Bluff Blvd.', 97, true),
  ('fe6917b6-5da4-42db-a6ab-e533a1101e62', '363', 29.267562, -82.198425, 'I-75', '358', 70, true),
  ('3a3394cc-5ac2-4f22-bd59-158f71d062c9', '708', 28.66815, -82.147216, 'I-75', '314/CR-48', 99, true),
  ('aab7a84d-f5c3-436a-a8c4-5b3c181f2ed2', '894', 29.745791, -81.349601, 'I-95', '305/FL-206', 64, true),
  ('22da63bd-9ee8-45b1-b8cd-ada2c8cb7899', '371', 34.419584, -79.41594, 'I-95', '190', 92, true),
  ('ad67dd4a-685b-4d62-be05-0b97f31c8e5f', '316', 29.339663, -81.13461, 'I-95', '273', 79, true),
  ('29c0000b-e9ee-401d-a502-417243b91f6c', '412', 35.339906, -78.55693, 'I-95', '77', 55, true),
  ('5f6849f3-fd15-4de2-93e7-69dd2003af1a', '495', 26.71396, -81.81507, 'I-75', '143', 96, true),
  ('5a5fa4df-c324-4405-bdb6-977ffb7f01a5', '317', 36.605447, -77.560647, 'I-95', '4', 72, true),
  ('025700b8-af4a-4322-96c1-64fff65ec6b4', '435', 37.937868, -77.465815, 'I-95', '104', 52, true),
  ('f31f9d24-b631-4513-869b-d943b30882d3', '467', 27.445606, -80.398175, 'I-95', '131', 130, true),
  ('d875c6d8-cf43-4d30-a76f-53bed4397cb3', '415', 27.413167, -80.397701, 'I-95', '129', 87, true);

do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _enr;
  if batch <> 62 then
    raise exception 'Expected 62 staged rows, found %.', batch;
  end if;

  -- 1. Every id resolves to a live row.
  select count(*) into n from _enr e join public.locations l on l.id = e.db_id where l.deleted_at is null;
  if n <> batch then raise exception '% id(s) do not resolve to a live row.', batch - n; end if;

  -- 2. Every target is the truck-stops record — the only row that gets a pin.
  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.category_slug <> 'truck-stops';
  if n <> 0 then raise exception '% target(s) are not truck-stops rows; only the map-pin row may be enriched.', n; end if;

  -- 3. BLANK-ONLY. Never overwrite an existing coordinate.
  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.lat is not null or l.lng is not null;
  if n <> 0 then raise exception '% target(s) already carry coordinates; this statement never overwrites.', n; end if;

  -- 4. Coordinates plausible and in the row's own state envelope.
  select count(*) into n from _enr
   where lat is null or lng is null or lat = 0 or lng = 0
      or lat not between 24.0 and 49.5 or lng not between -125.0 and -66.5;
  if n <> 0 then raise exception '% coordinate(s) unusable.', n; end if;

  -- 5. No two sites share a coordinate.
  select count(*) into n from (select lat, lng from _enr group by lat, lng having count(*) > 1) d;
  if n <> 0 then raise exception '% coordinate(s) shared by more than one site.', n; end if;

  -- 6. Store number on the row must match the source ref it is being given.
  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where coalesce(substring(l.name from '#\s*(\d+)'), '') <> e.source_ref;
  if n <> 0 then raise exception '% row(s) have a store number that disagrees with the source.', n; end if;

  -- 7. Write. Authorized fields only; publication state untouched.
  update public.locations l
     set lat = e.lat, lng = e.lng,
         interstate = coalesce(l.interstate, e.interstate),
         exit_number = coalesce(l.exit_number, e.exit_number),
         parking_spaces = coalesce(l.parking_spaces, e.parking_spaces),
         overnight_parking = e.overnight,
         geocode_source = 'loves-master-2026-07-27',
         geocode_confidence = 'high',
         coord_verification_status = 'operator-authoritative',
         last_geocoded_at = now(), updated_at = now()
    from _enr e
   where l.id = e.db_id and l.lat is null and l.lng is null;
  get diagnostics n = row_count;
  if n <> batch then raise exception 'Expected to enrich exactly % row(s), updated %.', batch, n; end if;

  -- 8. Enrichment must never publish.
  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.is_featured;
  if n <> 0 then raise exception 'Post-check failed: % row(s) became featured.', n; end if;
end $$;

commit;
