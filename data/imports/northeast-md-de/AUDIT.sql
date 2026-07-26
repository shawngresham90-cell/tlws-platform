-- Northeast MD/DE geocode+publish — read-only audit.

-- 1) The 6 candidates: current state
SELECT id, name, state, is_published, is_indexable,
       lat, lng, geo IS NOT NULL AS has_geo,
       geocode_source, geocode_confidence, coord_verification_status,
       interstate, exit_number
FROM public.locations
WHERE id IN (
  'ff19357b-eb93-4483-9e4e-ebb40e07fe36','e102d6bd-874c-43d0-b9f6-c8a9dbbe4832',
  'f35c37d4-6118-40c1-8380-1edf8e79777d','0c8f2702-18ba-465d-ad9f-7222b3db2744',
  '80786332-ef51-4045-9f28-a33abfbf56bd','7d3ead5b-1237-474f-9154-06b410f7b410')
ORDER BY is_published DESC, name;

-- 2) Held networks must remain unpublished, no coordinates written
SELECT id, name, is_published, lat, lng, geocode_source
FROM public.locations
WHERE id IN (
  'f65fd2ef-14d5-456f-a937-bbf3750c87b9',  -- Pilot #290
  'd56cff01-0dcb-4610-82aa-920d1214a828',  -- Flying J #784
  '39a7ad06-c801-4b4f-8ea1-3d847839a62c'); -- Flying J #875

-- 3) Table-wide invariants
SELECT
  count(*)                                                   AS total,
  count(*) FILTER (WHERE is_published)                       AS published,
  count(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL) AS has_latlng,
  count(*) FILTER (WHERE geo IS NOT NULL)                    AS has_geo,
  count(*) FILTER (WHERE is_indexable)                       AS indexable,
  count(*) FILTER (WHERE geocode_source = 'batch-csv')       AS batch_csv_rows
FROM public.locations
WHERE deleted_at IS NULL;

-- 4) Coordinate sanity for the 3 written rows (in MD bounds, near I-95)
SELECT id, name, lat, lng,
       (lat BETWEEN 37.9 AND 39.8 AND lng BETWEEN -79.6 AND -75.0) AS in_md_bbox
FROM public.locations
WHERE id IN ('ff19357b-eb93-4483-9e4e-ebb40e07fe36',
             'e102d6bd-874c-43d0-b9f6-c8a9dbbe4832',
             'f35c37d4-6118-40c1-8380-1edf8e79777d');
