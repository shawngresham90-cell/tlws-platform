-- De-enrich rollback for ENRICH-EXECUTED-51.sql — VALUE-MATCHED, per row.
-- Generated 2026-07-28 from the live pre-write snapshot, BEFORE any write.
-- Each statement fires only if the row still holds exactly the staged
-- coordinate with 'batch-csv' provenance; it restores the exact pre-write
-- values of every field the enrichment touches.

begin;

-- #271
update public.locations set
  lat = null, lng = null,
  interstate = 'I-40', exit_number = '37', parking_spaces = null,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'd7f9bcc5-6dd2-4bc5-aa45-004414540bf2' and lat = 35.511466 and lng = -93.822309 and geocode_source = 'batch-csv';

-- #822
update public.locations set
  lat = null, lng = null,
  interstate = 'I-40', exit_number = '57', parking_spaces = 114,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '88873aca-7462-45e9-bbe1-a9ebaa15cf60' and lat = 35.460073 and lng = -93.480111 and geocode_source = 'batch-csv';

-- #267
update public.locations set
  lat = null, lng = null,
  interstate = 'I-40', exit_number = '107', parking_spaces = null,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'eb21f83a-5ec0-4447-b261-6ecb564187c7' and lat = 35.172923 and lng = -92.743251 and geocode_source = 'batch-csv';

-- #236
update public.locations set
  lat = null, lng = null,
  interstate = 'I-40', exit_number = '161', parking_spaces = 65,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'd33bd5af-db05-4f0b-a829-7db826c27a96' and lat = 34.786217 and lng = -92.125573 and geocode_source = 'batch-csv';

-- #759
update public.locations set
  lat = null, lng = null,
  interstate = 'I-40', exit_number = '193', parking_spaces = 132,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'b5d906d6-22c5-4ed5-b39e-b8eea589346d' and lat = 34.815314 and lng = -91.567393 and geocode_source = 'batch-csv';

-- #275
update public.locations set
  lat = null, lng = null,
  interstate = 'I-40', exit_number = '233', parking_spaces = 90,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '8fbdb2db-5a92-446e-97c8-fd0473a6a2a8' and lat = 34.986489 and lng = -90.905235 and geocode_source = 'batch-csv';

-- #450
update public.locations set
  lat = null, lng = null,
  interstate = 'I-40', exit_number = '280', parking_spaces = 111,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '9615e271-6080-44ba-bb9a-94ee75384e83' and lat = 35.153922 and lng = -90.138293 and geocode_source = 'batch-csv';

-- #244
update public.locations set
  lat = null, lng = null,
  interstate = 'I-40', exit_number = '87', parking_spaces = 108,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '6c5d6f67-da95-4378-a089-72e6b7a307c4' and lat = 35.679204 and lng = -88.74243 and geocode_source = 'batch-csv';

-- #791
update public.locations set
  lat = null, lng = null,
  interstate = 'I-40', exit_number = '126', parking_spaces = 125,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '4e060c6a-1fab-4808-928a-bd991bf8f694' and lat = 35.840559 and lng = -88.081783 and geocode_source = 'batch-csv';

-- #369
update public.locations set
  lat = null, lng = null,
  interstate = 'I-40', exit_number = '163', parking_spaces = 106,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'e602551b-092f-4d03-9417-03c6196ca4eb' and lat = 35.99203 and lng = -87.48819 and geocode_source = 'batch-csv';

-- #346
update public.locations set
  lat = null, lng = null,
  interstate = 'I-65', exit_number = '46', parking_spaces = null,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'cdeb1524-21ed-4454-9667-4b4781f3e8fb' and lat = 35.643953 and lng = -86.891465 and geocode_source = 'batch-csv';

-- #429
update public.locations set
  lat = null, lng = null,
  interstate = 'I-65', exit_number = '87', parking_spaces = null,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '1f6e7f3a-9e20-4a57-8eae-d44d24a80243' and lat = 36.205575 and lng = -86.771637 and geocode_source = 'batch-csv';

-- #629
update public.locations set
  lat = null, lng = null,
  interstate = 'I-65', exit_number = '108', parking_spaces = 83,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'e862ec83-1ad2-4128-90dd-2cb529a71c79' and lat = 36.467853 and lng = -86.687413 and geocode_source = 'batch-csv';

-- #877
update public.locations set
  lat = null, lng = null,
  interstate = 'I-65', exit_number = '305', parking_spaces = 82,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '12cb5734-b6f3-48d8-adc1-71b693367a2a' and lat = 34.129181 and lng = -86.864036 and geocode_source = 'batch-csv';

-- #624
update public.locations set
  lat = null, lng = null,
  interstate = 'I-65', exit_number = '8', parking_spaces = 73,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '9d0ebd15-c261-4702-a709-a7828d639a9d' and lat = 30.742 and lng = -88.1108 and geocode_source = 'batch-csv';

-- #368
update public.locations set
  lat = null, lng = null,
  interstate = 'I-65', exit_number = '208', parking_spaces = null,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '08e36b89-6dee-438f-bd37-edf4a6eab784' and lat = 32.844151 and lng = -86.591963 and geocode_source = 'batch-csv';

-- #225
update public.locations set
  lat = null, lng = null,
  interstate = 'I-65', exit_number = '93', parking_spaces = null,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '4487c8c2-b9dc-4b24-bf94-e18b76de138e' and lat = 31.419105 and lng = -87.00765 and geocode_source = 'batch-csv';

-- #330
update public.locations set
  lat = null, lng = null,
  interstate = 'I-40', exit_number = '280', parking_spaces = null,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '5f922ea7-ad01-4fff-aa2e-33a9d2cf1177' and lat = 36.139694 and lng = -85.63023 and geocode_source = 'batch-csv';

-- #718
update public.locations set
  lat = null, lng = null,
  interstate = 'I-65', exit_number = '158', parking_spaces = 96,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'b3f396e1-8990-4df2-9cd8-b0c8d353d66c' and lat = 32.19624 and lng = -86.415235 and geocode_source = 'batch-csv';

-- #874
update public.locations set
  lat = null, lng = null,
  interstate = 'I-65', exit_number = '175', parking_spaces = 64,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '76e36705-8140-4902-8922-1ae83351ce7a' and lat = 40.452717 and lng = -86.850201 and geocode_source = 'batch-csv';

-- #459
update public.locations set
  lat = null, lng = null,
  interstate = 'I-65', exit_number = '133', parking_spaces = null,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'f6502eed-0e6a-40c4-a5df-d5a0068ef809' and lat = 39.979492 and lng = -86.395742 and geocode_source = 'batch-csv';

-- #417
update public.locations set
  lat = null, lng = null,
  interstate = 'I-65', exit_number = null, parking_spaces = 154,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '786bf473-2404-4915-bd74-a05c7c07989a' and lat = 41.561796 and lng = -87.35664 and geocode_source = 'batch-csv';

-- #480
update public.locations set
  lat = null, lng = null,
  interstate = null, exit_number = null, parking_spaces = 95,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'd58e3dbf-f1ed-4822-adf6-94841a1a7c64' and lat = 35.872378 and lng = -84.32321 and geocode_source = 'batch-csv';

-- #618
update public.locations set
  lat = null, lng = null,
  interstate = 'I-75', exit_number = '136', parking_spaces = 80,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'b67852b7-a14e-43d2-b786-b8536fed05d5' and lat = 38.379493 and lng = -84.572583 and geocode_source = 'batch-csv';

-- #291
update public.locations set
  lat = null, lng = null,
  interstate = 'I-75', exit_number = '95', parking_spaces = 63,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'd02cc1cc-ddec-4108-b686-69b43432bcca' and lat = 37.84322 and lng = -84.324537 and geocode_source = 'batch-csv';

-- #321
update public.locations set
  lat = null, lng = null,
  interstate = 'I-75', exit_number = '29', parking_spaces = null,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '703372a3-ddb0-4201-b738-cab8ded1a1cf' and lat = 36.977491 and lng = -84.116242 and geocode_source = 'batch-csv';

-- #747
update public.locations set
  lat = null, lng = null,
  interstate = 'I-75', exit_number = '90', parking_spaces = 130,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '37c4007f-e708-43e7-9ec3-42a933595dfa' and lat = 40.265328 and lng = -84.186013 and geocode_source = 'batch-csv';

-- #796
update public.locations set
  lat = null, lng = null,
  interstate = 'I-40', exit_number = '432', parking_spaces = 95,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '849b2949-0caf-4874-9c23-e1c79c2ecf35' and lat = 35.970619 and lng = -83.247821 and geocode_source = 'batch-csv';

-- #356
update public.locations set
  lat = null, lng = null,
  interstate = 'I-75', exit_number = '167', parking_spaces = 65,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'ce2b1d46-bc97-4dd5-8006-b3f0877740b5' and lat = 41.17372 and lng = -83.65167 and geocode_source = 'batch-csv';

-- #308
update public.locations set
  lat = null, lng = null,
  interstate = 'I-40', exit_number = '86', parking_spaces = 48,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '7b969fa7-19c1-4bd2-b0c5-9663b9007464' and lat = 35.657872 and lng = -81.96337 and geocode_source = 'batch-csv';

-- #645
update public.locations set
  lat = null, lng = null,
  interstate = 'I-75', exit_number = '18', parking_spaces = 100,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'bd6dadb7-6053-4d42-a0e9-028f9d319b5c' and lat = 41.964765 and lng = -83.345143 and geocode_source = 'batch-csv';

-- #743
update public.locations set
  lat = null, lng = null,
  interstate = 'I-75', exit_number = '144', parking_spaces = 102,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '8e2421bd-15c8-49f2-8442-874641d24719' and lat = 43.348709 and lng = -83.861776 and geocode_source = 'batch-csv';

-- #470
update public.locations set
  lat = null, lng = null,
  interstate = 'I-75', exit_number = '451', parking_spaces = 125,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '493f87f4-8dca-4681-9d42-1da6c4646855' and lat = 30.452116 and lng = -82.933564 and geocode_source = 'batch-csv';

-- #724
update public.locations set
  lat = null, lng = null,
  interstate = 'I-75', exit_number = '414', parking_spaces = 106,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'c9ebaa0f-5ca1-44d9-91c3-1965fdd9f9a4' and lat = 30.002627 and lng = -82.598483 and geocode_source = 'batch-csv';

-- #338
update public.locations set
  lat = null, lng = null,
  interstate = 'I-95', exit_number = '90', parking_spaces = null,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '89c2531c-300b-4d19-b9f8-e4f065f2d605' and lat = 31.960662 and lng = -81.331564 and geocode_source = 'batch-csv';

-- #893
update public.locations set
  lat = null, lng = null,
  interstate = 'I-95', exit_number = '94', parking_spaces = null,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'a7cd01f6-bc31-4983-8bb6-89a2d6360e0f' and lat = 32.103201 and lng = -81.194401 and geocode_source = 'batch-csv';

-- #405
update public.locations set
  lat = null, lng = null,
  interstate = 'I-95', exit_number = '29', parking_spaces = null,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'cb44453b-2e91-403c-b840-fa0ebe9c211e' and lat = 31.137752 and lng = -81.571797 and geocode_source = 'batch-csv';

-- #740
update public.locations set
  lat = null, lng = null,
  interstate = 'I-95', exit_number = '38', parking_spaces = null,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'b2af1bed-36cf-4497-8e3d-d2c2209fca12' and lat = 32.705457 and lng = -80.874488 and geocode_source = 'batch-csv';

-- #828
update public.locations set
  lat = null, lng = null,
  interstate = 'I-95', exit_number = 'I-295 Exit 33', parking_spaces = null,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '29e9199c-a535-47dd-8d12-887485484bc3' and lat = 30.463245 and lng = -81.673875 and geocode_source = 'batch-csv';

-- #603
update public.locations set
  lat = null, lng = null,
  interstate = 'I-95', exit_number = '366', parking_spaces = null,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '8c6afd87-8cac-4a4e-9490-fae510386cdf' and lat = 30.516861 and lng = -81.632633 and geocode_source = 'batch-csv';

-- #790
update public.locations set
  lat = null, lng = null,
  interstate = 'I-95', exit_number = '108', parking_spaces = null,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'a5c289a1-177f-479f-9e18-84571c3d8190' and lat = 33.591813 and lng = -80.355763 and geocode_source = 'batch-csv';

-- #363
update public.locations set
  lat = null, lng = null,
  interstate = 'I-75', exit_number = '358', parking_spaces = 72,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'fe6917b6-5da4-42db-a6ab-e533a1101e62' and lat = 29.267562 and lng = -82.198425 and geocode_source = 'batch-csv';

-- #708
update public.locations set
  lat = null, lng = null,
  interstate = 'I-75', exit_number = '314', parking_spaces = 99,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '3a3394cc-5ac2-4f22-bd59-158f71d062c9' and lat = 28.66815 and lng = -82.147216 and geocode_source = 'batch-csv';

-- #894
update public.locations set
  lat = null, lng = null,
  interstate = 'I-95', exit_number = '305', parking_spaces = null,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'aab7a84d-f5c3-436a-a8c4-5b3c181f2ed2' and lat = 29.745791 and lng = -81.349601 and geocode_source = 'batch-csv';

-- #371
update public.locations set
  lat = null, lng = null,
  interstate = 'I-95', exit_number = '190', parking_spaces = null,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '22da63bd-9ee8-45b1-b8cd-ada2c8cb7899' and lat = 34.419584 and lng = -79.41594 and geocode_source = 'batch-csv';

-- #316
update public.locations set
  lat = null, lng = null,
  interstate = 'I-95', exit_number = '273', parking_spaces = null,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'ad67dd4a-685b-4d62-be05-0b97f31c8e5f' and lat = 29.339663 and lng = -81.13461 and geocode_source = 'batch-csv';

-- #412
update public.locations set
  lat = null, lng = null,
  interstate = 'I-95', exit_number = '77', parking_spaces = null,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '29c0000b-e9ee-401d-a502-417243b91f6c' and lat = 35.339906 and lng = -78.55693 and geocode_source = 'batch-csv';

-- #495
update public.locations set
  lat = null, lng = null,
  interstate = 'I-75', exit_number = '143', parking_spaces = null,
  overnight_parking = true,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '5f6849f3-fd15-4de2-93e7-69dd2003af1a' and lat = 26.71396 and lng = -81.81507 and geocode_source = 'batch-csv';

-- #435
update public.locations set
  lat = null, lng = null,
  interstate = 'I-95', exit_number = '104', parking_spaces = null,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = '025700b8-af4a-4322-96c1-64fff65ec6b4' and lat = 37.937868 and lng = -77.465815 and geocode_source = 'batch-csv';

-- #467
update public.locations set
  lat = null, lng = null,
  interstate = 'I-95', exit_number = '131B', parking_spaces = null,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'f31f9d24-b631-4513-869b-d943b30882d3' and lat = 27.445606 and lng = -80.398175 and geocode_source = 'batch-csv';

-- #415
update public.locations set
  lat = null, lng = null,
  interstate = 'I-95', exit_number = '129', parking_spaces = null,
  overnight_parking = false,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
where id = 'd875c6d8-cf43-4d30-a76f-53bed4397cb3' and lat = 27.413167 and lng = -80.397701 and geocode_source = 'batch-csv';

commit;
