-- Northeast MD/DE Tier-1 geocode + publish — read-only audit.

-- 1) The 14 published rows: coordinates + metadata + query-contract fields
SELECT id, name, category_slug, state, is_published, is_indexable,
       lat, lng, geo IS NOT NULL AS has_geo,
       geocode_source, geocode_confidence, coord_verification_status,
       interstate, exit_number, detail_slug
FROM public.locations
WHERE id IN (
  'fed4a341-e7ca-4020-b95e-11a589f9d537','18df2837-56f3-4b52-9360-d625614d0910',
  '4795b25a-2bb2-4c4e-ac29-d864159cb3f3','a8c03a61-df69-466d-bbf3-9bde66a34005',
  '84a7fdb0-85d9-47e2-a615-c507033be742','ebeeef84-4ab8-478a-a46a-3e07a9b29ff3',
  'ae5c7f98-3827-4f30-a664-af01f578db47','fdc35482-6e2a-44a5-8d70-e976883b9f25',
  '44ef662c-3372-40a8-9c5b-eb2f0c76fc2c','5046a85e-6a9a-49e8-aedd-ab29f95b00d1',
  'e45cdd5c-1081-4859-b540-5a800714c6f9','1c2331c1-e7c3-4f1c-8080-8c77e26ca570',
  'f1e6af7b-d118-4bae-b8f0-5211efc8131e','58dc0ef3-dc55-42ec-9b42-3ddcad197aa8')
ORDER BY state, category_slug, name;

-- 2) The 14 quarantined/held rows must remain unpublished with no coordinates
SELECT id, name, is_published, lat, lng, geocode_source
FROM public.locations
WHERE id IN (
  '1c486059-1bf4-47b8-845f-e817c22b7674','588ee9e4-f2de-4961-9cc4-ed1186a74a73',
  '7fa26b2f-a97d-4c5e-aa6f-cb992518cafe','61a7d832-a098-4196-bbe2-5b58562e7b9b',
  'a2881397-1a79-4517-be05-ad60362466c9','ed11b1c5-d80c-4ffb-9d0a-f1fa26089b44',
  'cc5eadd1-f22b-4a84-a1a8-7ec8f315f47a','cdeada8d-83d9-44dd-97ad-bbcbb6867252',
  'f637c363-ed64-4c52-be7c-3bf5b7a32a90','4678d9cd-6eea-460c-8d08-def9f6abec0b',
  '83264a37-d31f-4775-8a1f-05901e60397d','ec267e71-3e9b-4f00-8b8a-40024bcc6010',
  'a7a13453-9509-4465-98f8-e94a8ff9ff75','7eb47ea3-8514-41aa-be0d-82f6fbf5e8c3')
ORDER BY name;

-- 3) Held networks unchanged
SELECT id, name, is_published, lat, lng
FROM public.locations
WHERE id IN ('f65fd2ef-14d5-456f-a937-bbf3750c87b9',
             'd56cff01-0dcb-4610-82aa-920d1214a828',
             '39a7ad06-c801-4b4f-8ea1-3d847839a62c');

-- 4) Table-wide invariants
SELECT count(*) AS total,
       count(*) FILTER (WHERE is_published) AS published,
       count(*) FILTER (WHERE state='MD' AND is_published) AS md_published,
       count(*) FILTER (WHERE state='DE' AND is_published) AS de_published,
       count(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL) AS has_latlng,
       count(*) FILTER (WHERE geo IS NOT NULL) AS has_geo,
       count(*) FILTER (WHERE is_indexable) AS indexable
FROM public.locations WHERE deleted_at IS NULL;
